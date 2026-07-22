const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { F } = require("../lib/vendorFields");
const { stampNewVendorRegistration } = require("../lib/vendorAccess");
const {
    COLLECTION,
    newProspectId,
    toPickerItem,
    normalizeCompanyKey,
    findDuplicateProspectCompany
} = require("../lib/vendorProspects");
const {
    MAX_IMPORT_ROWS,
    validateImportRow,
    toImportDbDoc
} = require("../lib/vendorProspectImport");
const {
    findExternalVendorInfo,
    canUseNaver,
    searchFuneralHalls
} = require("../lib/vendorExternalLookup");

const router = express.Router();

function normText(v) {
    return String(v || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function normPhone(v) {
    return String(v || "").replace(/[^\d]/g, "");
}

function pickFirstValue(doc, keys) {
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = String((doc && doc[k]) || "").trim();
        if (v) return v;
    }
    return "";
}

function applyMatchedFields(target, matched) {
    if (!target || !matched) return target;
    if (!target.vn_ceo && matched.vn_ceo) target.vn_ceo = matched.vn_ceo;
    if (!target.vn_ceo_tel && matched.vn_ceo_tel) target.vn_ceo_tel = matched.vn_ceo_tel;
    if (!target.vn_web && matched.vn_web) target.vn_web = matched.vn_web;
    if (!target.vn_email && matched.vn_email) target.vn_email = matched.vn_email;
    if (!target.vn_phone && matched.vn_phone) target.vn_phone = matched.vn_phone;
    if (!target.vn_addr && matched.vn_addr) target.vn_addr = matched.vn_addr;
    return target;
}

const ENRICH_FIELDS = ["vn_ceo", "vn_ceo_tel", "vn_web", "vn_email", "vn_phone", "vn_addr"];

async function findMatchedVendorInfo(db, built) {
    const company = normText(built.vn_company);
    const phone = normPhone(built.vn_phone);
    if (!company || !phone) return null;
    const collections = ["vendors", "vendor_new", "vendor_prospects"];
    for (let c = 0; c < collections.length; c++) {
        const col = db.collection(collections[c]);
        const docs = await col
            .find({
                $or: [{ vn_company: { $exists: true } }, { companyName: { $exists: true } }]
            })
            .limit(2000)
            .toArray();
        for (let i = 0; i < docs.length; i++) {
            const d = docs[i];
            const dc = normText(d.vn_company || d.companyName);
            const dp = normPhone(d.vn_phone || d.phone);
            const companyMatch = dc && (dc === company || dc.indexOf(company) >= 0 || company.indexOf(dc) >= 0);
            if (!companyMatch) continue;
            const phoneMatch = dp && dp === phone;
            if (!phoneMatch) continue;
            return {
                vn_ceo: pickFirstValue(d, ["vn_ceo", "ceo"]),
                vn_ceo_tel: pickFirstValue(d, ["vn_ceo_tel", "ceoPhone"]),
                vn_web: pickFirstValue(d, ["vn_web", "website"]),
                vn_email: pickFirstValue(d, ["vn_email", "email"]),
                source: collections[c]
            };
        }
    }
    return null;
}

function escapeRegex(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 예비거래처 목록 — 선택 모달(forPicker) · 검색 */
router.get("/", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const q = String(req.query.q || "").trim();
        const filter = {};
        if (q) {
            filter.vn_company = { $regex: escapeRegex(q), $options: "i" };
        }
        const docs = await getDb()
            .collection(COLLECTION)
            .find(filter)
            .sort({ vn_company: 1, updatedAt: -1 })
            .limit(500)
            .toArray();
        const items = [];
        for (const doc of docs) {
            const row = toPickerItem(doc);
            if (row) items.push(row);
        }
        res.json({ ok: true, items: items });
    } catch (e) {
        console.error("GET /api/vendor-prospects", e);
        res.status(500).json({ ok: false, error: "예비거래처 목록을 불러오지 못했습니다." });
    }
});

/** 관리자/슈퍼바이저 — 예비거래처 삭제 */
router.delete("/:id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) return res.status(400).json({ ok: false, error: "삭제할 ID가 없습니다." });
        const ret = await getDb().collection(COLLECTION).deleteOne({ id: id });
        if (!ret || !ret.deletedCount) {
            return res.status(404).json({ ok: false, error: "삭제할 예비거래처를 찾지 못했습니다." });
        }
        res.json({ ok: true, deleted: 1, id: id });
    } catch (e) {
        console.error("DELETE /api/vendor-prospects/:id", e);
        res.status(500).json({ ok: false, error: "예비거래처 삭제에 실패했습니다." });
    }
});

/** 관리자 — 도시명/장례식장명으로 장례식장 조회 (한국장례협회 FTA) */
router.get("/search-funeral-halls", requireRole("admin"), async function (req, res) {
    try {
        const q = String(req.query.q || "").trim();
        const mode = String(req.query.mode || "city").trim().toLowerCase() === "name" ? "name" : "city";
        if (!q) {
            return res.status(400).json({
                ok: false,
                error: mode === "name" ? "장례식장 이름을 입력해 주세요." : "도시명을 입력해 주세요."
            });
        }
        const found = await searchFuneralHalls(q, mode);
        if (!Array.isArray(found.items) || !found.items.length) {
            var unknownCity =
                found.lastErr && String(found.lastErr).indexOf("UNKNOWN_CITY:") === 0;
            return res.status(404).json({
                ok: false,
                error: unknownCity
                    ? "지원하지 않는 도시명입니다. FTA 도/시 목록(서울, 부산, 대구, 인천, 광주, 대전, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주)으로 입력해 주세요."
                    : mode === "name"
                      ? "조회 결과가 없습니다. 장례식장 이름을 정확히 입력하거나 일부 키워드로 다시 시도해 주세요."
                      : "조회 결과가 없습니다. 도시명을 FTA 기준(예: 서울, 경기, 전남)으로 입력해 주세요.",
                hint: found.lastErr ? "debug: " + found.lastErr : ""
            });
        }
        res.json({ ok: true, items: found.items || [], q: q, mode: mode, source: "fta_board" });
    } catch (e) {
        console.error("GET /api/vendor-prospects/search-funeral-halls", e);
        res.status(500).json({ ok: false, error: "장례식장 조회에 실패했습니다." });
    }
});

/** 슈퍼바이저 — 미리보기 데이터 빈 항목 조회 채우기 */
router.post("/enrich-preview", requireRole("supervisor"), async function (req, res) {
    try {
        const rows = req.body && Array.isArray(req.body.rows) ? req.body.rows : [];
        const useExternal = !!(req.body && req.body.useExternal);
        if (!rows.length) return res.json({ ok: true, items: [], enriched: 0 });
        if (rows.length > MAX_IMPORT_ROWS) {
            return res.status(400).json({
                ok: false,
                error: "한 번에 최대 " + MAX_IMPORT_ROWS + "건까지 조회할 수 있습니다."
            });
        }
        const db = getDb();
        const items = [];
        let enriched = 0;
        const diffs = [];
        for (let i = 0; i < rows.length; i++) {
            const src = Object.assign({}, rows[i] || {});
            const check = validateImportRow(src, i + 2);
            if (!check.ok) {
                items.push(src);
                continue;
            }
            const matched = await findMatchedVendorInfo(db, check.built);
            const before = {};
            for (let f = 0; f < ENRICH_FIELDS.length; f++) {
                const key = ENRICH_FIELDS[f];
                before[key] = String(check.built[key] || "");
            }
            let usedSource = matched && matched.source ? matched.source : "";
            applyMatchedFields(check.built, matched);
            if (useExternal) {
                const ext = await findExternalVendorInfo(check.built);
                if (ext) {
                    applyMatchedFields(check.built, ext);
                    if (!usedSource) usedSource = ext.source || "external";
                    else usedSource += "+" + (ext.source || "external");
                }
            }
            const changes = [];
            for (let f = 0; f < ENRICH_FIELDS.length; f++) {
                const key = ENRICH_FIELDS[f];
                const afterVal = String(check.built[key] || "");
                if (before[key] !== afterVal) {
                    changes.push({
                        field: key,
                        before: before[key],
                        after: afterVal
                    });
                }
            }
            if (changes.length) {
                enriched++;
                diffs.push({
                    row: i + 2,
                    company: String(check.built.vn_company || ""),
                    source: usedSource,
                    changes: changes
                });
            }
            items.push(check.built);
        }
        return res.json({
            ok: true,
            items: items,
            enriched: enriched,
            diffs: diffs,
            externalEnabled: useExternal,
            naverConfigured: canUseNaver()
        });
    } catch (e) {
        console.error("POST /api/vendor-prospects/enrich-preview", e);
        return res.status(500).json({ ok: false, error: "미리보기 조회 보강에 실패했습니다." });
    }
});

/** 슈퍼바이저/관리자 — 일괄 등록 → vendor_prospects */
router.post("/import", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const rows = req.body && Array.isArray(req.body.rows) ? req.body.rows : [];
        if (!rows.length) {
            return res.status(400).json({ ok: false, error: "불러올 데이터가 없습니다." });
        }
        if (rows.length > MAX_IMPORT_ROWS) {
            return res.status(400).json({
                ok: false,
                error: "한 번에 최대 " + MAX_IMPORT_ROWS + "건까지 등록할 수 있습니다."
            });
        }

        const db = getDb();
        const col = db.collection(COLLECTION);
        const docs = [];
        const errors = [];
        const seenInBatch = new Set();
        let registration = null;
        let skipped = 0;

        for (let i = 0; i < rows.length; i++) {
            const rowNum = i + 2;
            const check = validateImportRow(rows[i], rowNum);
            if (!check.ok) {
                errors.push({ row: rowNum, error: check.error });
                continue;
            }
            const company = check.built.vn_company;
            const norm = normalizeCompanyKey(company);
            if (seenInBatch.has(norm)) {
                skipped++;
                errors.push({
                    row: rowNum,
                    error: "같은 파일에 중복된 업체명입니다: " + company
                });
                continue;
            }
            const dup = await findDuplicateProspectCompany(db, company);
            if (dup) {
                skipped++;
                errors.push({
                    row: rowNum,
                    error: "이미 등록된 예비거래처입니다: " + company
                });
                continue;
            }
            seenInBatch.add(norm);

            const matched = await findMatchedVendorInfo(db, check.built);
            applyMatchedFields(check.built, matched);

            let doc = toImportDbDoc(newProspectId(), check.built, null);
            if (!registration) {
                doc = await stampNewVendorRegistration(doc, req.auth);
                registration = {
                    registeredBy: doc[F.registeredBy],
                    registeredByName: doc[F.registeredByName],
                    registeredAt: doc[F.registeredAt]
                };
            } else {
                doc[F.registeredBy] = registration.registeredBy;
                doc[F.registeredByName] = registration.registeredByName;
                doc[F.registeredAt] = registration.registeredAt;
            }
            docs.push(doc);
        }

        if (!docs.length) {
            return res.status(400).json({
                ok: false,
                error: "저장할 수 있는 행이 없습니다. (중복·오류 행 제외)",
                inserted: 0,
                skipped: skipped,
                failed: errors.length,
                errors: errors.slice(0, 50)
            });
        }

        await col.insertMany(docs, { ordered: false });
        console.log("[vendor_prospects] import:", docs.length, "rows by", registration && registration.registeredBy);

        res.status(201).json({
            ok: true,
            inserted: docs.length,
            skipped: skipped,
            failed: errors.length,
            errors: errors.slice(0, 50)
        });
    } catch (e) {
        console.error("POST /api/vendor-prospects/import", e);
        res.status(500).json({ ok: false, error: "엑셀 데이터 저장에 실패했습니다." });
    }
});

module.exports = router;
