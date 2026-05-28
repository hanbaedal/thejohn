const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { isReservedStaffLoginId } = require("../lib/staff");
const {
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    validateLoginIdLength,
    F
} = require("../lib/vendorFields");
const {
    canReadVendor,
    canWriteVendor,
    canReadProspectForPicker,
    canWriteProspectForRegistration,
    buildVendorListQuery,
    stampNewVendorRegistration,
    applyRegistrationOnUpdate
} = require("../lib/vendorAccess");
const {
    COLLECTION,
    newProspectId,
    toPickerItem,
    findProspectByLoginId,
    findVendorByLoginId,
    findDuplicateProspectCompany,
    applyCompanyNormToDoc,
    normalizeCompanyKey
} = require("../lib/vendorProspects");
const {
    MAX_IMPORT_ROWS,
    validateImportRow,
    toImportDbDoc
} = require("../lib/vendorProspectImport");

const router = express.Router();

function escapeRegex(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isReservedAdminLoginId(loginId) {
    return isReservedStaffLoginId(loginId);
}

function prospectWriteErrorMessage(e) {
    if (e && e.code === 11000) {
        const key = e.keyPattern || {};
        if (key.loginId) return "이미 사용 중인 아이디입니다.";
        return "중복된 값이 있어 저장할 수 없습니다.";
    }
    return "";
}

async function findStaffLoginConflict(loginId) {
    const { loginLookupFilter } = require("../lib/loginAccount");
    return getDb().collection("staff").findOne(loginLookupFilter(loginId));
}

/** 아이디 중복 — staff · vendors · vendor_prospects */
router.get("/check-login-id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const loginId = String(req.query.loginId || "").trim();
        const excludeId = req.query.excludeId ? String(req.query.excludeId) : "";
        if (!loginId) {
            return res.json({ ok: true, duplicate: false });
        }
        const fmt = validateLoginIdLength(loginId);
        if (fmt) {
            return res.json({ ok: true, duplicate: false, invalid: true, error: fmt });
        }
        if (isReservedAdminLoginId(loginId)) {
            return res.json({
                ok: true,
                duplicate: true,
                reserved: true,
                error: "사용할 수 없는 아이디입니다."
            });
        }
        if (await findStaffLoginConflict(loginId)) {
            return res.json({
                ok: true,
                duplicate: true,
                error: "이미 관리자(staff)에 사용 중인 아이디입니다."
            });
        }
        const db = getDb();
        const dupVendor = await findVendorByLoginId(db, loginId, excludeId);
        if (dupVendor) {
            return res.json({
                ok: true,
                duplicate: true,
                error: "이미 사용 중인 아이디입니다. (기존 업체)"
            });
        }
        const dupProspect = await findProspectByLoginId(db, loginId, excludeId);
        res.json({
            ok: true,
            duplicate: !!dupProspect,
            error: dupProspect ? "이미 사용 중인 아이디입니다." : ""
        });
    } catch (e) {
        console.error("GET /api/vendor-prospects/check-login-id", e);
        res.status(500).json({ ok: false, error: "아이디 중복 확인에 실패했습니다." });
    }
});

/** 신규업체·예비거래처 목록 */
router.get("/", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const q = String(req.query.q || "").trim();
        const forPicker =
            req.query.forPicker === "1" ||
            req.query.forPicker === "true" ||
            req.query.picker === "1";
        const listQuery = forPicker ? {} : buildVendorListQuery(req.auth);
        const filter = Object.assign({}, listQuery);
        if (q) {
            filter.vn_company = { $regex: escapeRegex(q), $options: "i" };
        }
        const docs = await getDb()
            .collection(COLLECTION)
            .find(filter)
            .sort({ updatedAt: -1 })
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
        res.status(500).json({ ok: false, error: "신규업체 목록을 불러오지 못했습니다." });
    }
});

router.get("/:id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const doc = await getDb().collection(COLLECTION).findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        if (!canReadVendor(req.auth, doc) && !canReadProspectForPicker(req.auth)) {
            return res.status(403).json({ ok: false, error: "이 신규업체를 조회할 권한이 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/vendor-prospects/:id", e);
        res.status(500).json({ ok: false, error: "신규업체를 불러오지 못했습니다." });
    }
});

/** 슈퍼바이저 — 엑셀 등에서 일괄 등록 (로그인 아이디 없음) */
router.post("/import", requireRole("supervisor"), async function (req, res) {
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
                    error: "이미 등록된 업체명입니다: " + company
                });
                continue;
            }
            seenInBatch.add(norm);

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

router.post("/", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "").trim();

        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const body = Object.assign({}, req.body, { vn_record_type: "new" });
        const built = buildFromBody(body, null, loginId, password);
        const err = validateBuilt(built, true);
        if (err) return res.status(400).json({ ok: false, error: err });

        const db = getDb();
        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }
        if (await findVendorByLoginId(db, loginId)) {
            return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다. (기존 업체)" });
        }
        if (await findProspectByLoginId(db, loginId)) {
            return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });
        }
        const dupCompany = await findDuplicateProspectCompany(db, built.vn_company);
        if (dupCompany) {
            return res.status(409).json({
                ok: false,
                error: "이미 등록된 업체명입니다: " + (built.vn_company || "")
            });
        }

        const col = db.collection(COLLECTION);
        let doc = toDbDoc(newProspectId(), built, null);
        doc = applyCompanyNormToDoc(doc, built.vn_company);
        doc = await stampNewVendorRegistration(doc, req.auth);
        await col.insertOne(doc);
        console.log(
            "[vendor_prospects] inserted:",
            doc.id,
            doc.loginId,
            doc.vn_company,
            "by",
            doc[F.registeredBy]
        );
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/vendor-prospects", e);
        const dup = prospectWriteErrorMessage(e);
        if (dup) return res.status(409).json({ ok: false, error: dup });
        res.status(500).json({ ok: false, error: "신규업체 저장에 실패했습니다." });
    }
});

router.put("/:id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const id = req.params.id;
        const col = getDb().collection(COLLECTION);
        const existing = await col.findOne({ id });
        if (!existing) return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        if (!canWriteProspectForRegistration(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 신규업체는 수정할 수 없습니다."
            });
        }

        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "").trim();
        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const body = Object.assign({}, req.body, { vn_record_type: "new" });
        const built = buildFromBody(body, existing, loginId, password);
        const err = validateBuilt(built, false);
        if (err) return res.status(400).json({ ok: false, error: err });

        const db = getDb();
        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }
        if (await findVendorByLoginId(db, loginId, id)) {
            return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다. (기존 업체)" });
        }
        if (await findProspectByLoginId(db, loginId, id)) {
            return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });
        }
        const dupCompany = await findDuplicateProspectCompany(db, built.vn_company, id);
        if (dupCompany) {
            return res.status(409).json({
                ok: false,
                error: "이미 등록된 업체명입니다: " + (built.vn_company || "")
            });
        }

        let doc = toDbDoc(id, built, existing);
        doc = applyCompanyNormToDoc(doc, built.vn_company);
        doc = await applyRegistrationOnUpdate(doc, existing, req.auth, req.body);
        await col.replaceOne({ id }, doc);
        console.log("[vendor_prospects] updated:", doc.id, doc.loginId);
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("PUT /api/vendor-prospects/:id", e);
        const dup = prospectWriteErrorMessage(e);
        if (dup) return res.status(409).json({ ok: false, error: dup });
        res.status(500).json({ ok: false, error: "신규업체 수정에 실패했습니다." });
    }
});

router.delete("/:id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const col = getDb().collection(COLLECTION);
        const existing = await col.findOne({ id: req.params.id });
        if (!existing) {
            return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        }
        if (!canWriteVendor(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 신규업체는 삭제할 수 없습니다."
            });
        }
        const result = await col.deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/vendor-prospects/:id", e);
        res.status(500).json({ ok: false, error: "신규업체 삭제에 실패했습니다." });
    }
});

module.exports = router;
