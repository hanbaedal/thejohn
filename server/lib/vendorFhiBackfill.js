/**
 * 등록 업체 ↔ e하늘(FHI) — 빈 필드만 채워 DB 저장
 */

const { F, FHI_EXTRA_KEYS } = require("./vendorFields");
const { findBestFhiMatch, hasVendorLogo } = require("./vendorFhiMatch");
const { FHI_REGIONS, getRegionItems } = require("./funeralHallInfoLookup");
const { applyFhiLogoToBuilt } = require("./vendorFhiMedia");

const DEFAULT_MIN_SCORE = 20;

/** vendors DB에 저장·노출하는 e하늘 보조 필드 — vendorFields.FHI_EXTRA_KEYS 와 동일 */

const FILL_RULES = [
    { dbKey: F.roomCount, fhiKey: "vn_room_count" },
    { dbKey: F.phone, fhiKey: "vn_phone" },
    { dbKey: F.web, fhiKey: "vn_web" },
    { dbKey: F.addr, fhiKey: "vn_addr", onlyIfEmpty: true },
    { dbKey: "vn_public_type", fhiKey: "vn_public_type" },
    { dbKey: "vn_fax", fhiKey: "vn_fax" },
    { dbKey: "vn_mortuary_count", fhiKey: "vn_mortuary_count" },
    { dbKey: "vn_park_count", fhiKey: "vn_park_count" },
    { dbKey: "fileurl", fhiKey: "fileurl" },
    { dbKey: "mealroomyn", fhiKey: "mealroomyn" },
    { dbKey: "waitroomyn", fhiKey: "waitroomyn" },
    { dbKey: "parkyn", fhiKey: "parkyn" },
    { dbKey: "superyn", fhiKey: "superyn" },
    { dbKey: "imparyn", fhiKey: "imparyn" }
];

function strVal(v) {
    return String(v ?? "").trim();
}

function isEmpty(v) {
    return !strVal(v);
}

function vendorCompany(doc) {
    return strVal(
        doc && (doc[F.company] || doc.vn_company || doc.companyName)
    );
}

async function loadPartnerVendorDocs(db) {
    const docs = await db
        .collection("vendors")
        .find({ vn_record_type: { $ne: "new" } })
        .toArray();
    return docs.filter(function (doc) {
        return doc && doc.id && vendorCompany(doc);
    });
}

async function loadAllFhiItems() {
    const all = [];
    for (let i = 0; i < FHI_REGIONS.length; i++) {
        const slug = FHI_REGIONS[i].slug;
        const result = await getRegionItems(slug, { withPhones: true, refresh: false });
        if (result.items && result.items.length) {
            all.push.apply(all, result.items);
        }
    }
    return all;
}

function vendorMissingAnyFhiField(vendor) {
    if (isEmpty(vendor.fhi_id)) return true;
    for (let i = 0; i < FILL_RULES.length; i++) {
        if (isEmpty(vendor[FILL_RULES[i].dbKey])) return true;
    }
    for (let j = 0; j < FHI_EXTRA_KEYS.length; j++) {
        const key = FHI_EXTRA_KEYS[j];
        if (key === "fhi_id") continue;
        if (isEmpty(vendor[key])) return true;
    }
    if (!hasVendorLogo(vendor)) return true;
    return false;
}

function buildFillPatch(vendor, fhiRow, options) {
    options = options || {};
    const force = !!options.force;
    const minScore = Number(options.minScore) || DEFAULT_MIN_SCORE;
    const score = Number(fhiRow.score) || 0;
    if (score < minScore) {
        return { patch: null, filled: [], score: score };
    }

    const patch = {};
    const filled = [];

    if (isEmpty(vendor.fhi_id) && fhiRow.fhi_id) {
        patch.fhi_id = String(fhiRow.fhi_id);
        filled.push("fhi_id");
    }

    for (let i = 0; i < FILL_RULES.length; i++) {
        const rule = FILL_RULES[i];
        const current = vendor[rule.dbKey];
        if (!force && !isEmpty(current)) continue;
        if (rule.onlyIfEmpty && !isEmpty(current)) continue;
        const next = strVal(fhiRow[rule.fhiKey]);
        if (!next) continue;
        if (!force && strVal(current) === next) continue;
        patch[rule.dbKey] = next;
        filled.push(rule.dbKey);
    }

    return { patch: patch, filled: filled, score: score };
}

function copyFhiExtrasToDoc(doc, existing) {
    if (!existing) return doc;
    FHI_EXTRA_KEYS.forEach(function (key) {
        if (existing[key] != null && strVal(existing[key])) {
            doc[key] = existing[key];
        }
    });
    return doc;
}

async function backfillPartnerVendorsFromFhi(db, options) {
    options = options || {};
    const dryRun = !!options.dryRun;
    const force = !!options.force;
    const includeLogo = options.includeLogo !== false;
    const onlyMissing = options.onlyMissing !== false;
    const minScore = Number(options.minScore) || DEFAULT_MIN_SCORE;

    const vendors = await loadPartnerVendorDocs(db);
    const targets = onlyMissing
        ? vendors.filter(vendorMissingAnyFhiField)
        : vendors.slice();

    const allFhi = await loadAllFhiItems();
    const col = db.collection("vendors");

    const results = [];
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let noMatch = 0;

    for (let i = 0; i < targets.length; i++) {
        const vendor = targets[i];
        const match = findBestFhiMatch(vendor, allFhi);
        if (!match || !match.fhi_id) {
            noMatch++;
            results.push({
                vendorId: vendor.id,
                company: vendorCompany(vendor),
                status: "no_match"
            });
            continue;
        }

        const built = buildFillPatch(vendor, match, { force: force, minScore: minScore });
        if (built.score < minScore) {
            noMatch++;
            results.push({
                vendorId: vendor.id,
                company: vendorCompany(vendor),
                fhi_id: match.fhi_id,
                score: built.score,
                status: "low_score"
            });
            continue;
        }

        const patch = Object.assign({}, built.patch || {});
        const filled = built.filled.slice();
        const needLogo = includeLogo && !hasVendorLogo(vendor);

        if (!filled.length && !needLogo) {
            skipped++;
            results.push({
                vendorId: vendor.id,
                company: vendorCompany(vendor),
                fhi_id: match.fhi_id,
                score: built.score,
                status: "unchanged"
            });
            continue;
        }

        if (needLogo) {
            if (dryRun) {
                filled.push(F.logo);
            } else {
                try {
                    const logoBuilt = { vn_logo: "" };
                    await applyFhiLogoToBuilt(logoBuilt, match.fhi_id, match.fileurl);
                    patch[F.logo] = logoBuilt.vn_logo;
                    filled.push(F.logo);
                } catch (e) {
                    failed++;
                    results.push({
                        vendorId: vendor.id,
                        company: vendorCompany(vendor),
                        fhi_id: match.fhi_id,
                        score: built.score,
                        status: "logo_failed",
                        error: (e && e.message) || "이미지 저장 실패"
                    });
                    continue;
                }
            }
        }

        if (!filled.length) {
            skipped++;
            results.push({
                vendorId: vendor.id,
                company: vendorCompany(vendor),
                fhi_id: match.fhi_id,
                score: built.score,
                status: "unchanged"
            });
            continue;
        }

        if (dryRun) {
            results.push({
                vendorId: vendor.id,
                company: vendorCompany(vendor),
                fhi_id: match.fhi_id,
                score: built.score,
                filled: filled,
                status: "would_update"
            });
            continue;
        }

        patch.updatedAt = Date.now();
        try {
            const ret = await col.updateOne({ id: vendor.id }, { $set: patch });
            if (ret && ret.modifiedCount) {
                updated++;
                results.push({
                    vendorId: vendor.id,
                    company: vendorCompany(vendor),
                    fhi_id: match.fhi_id,
                    score: built.score,
                    filled: filled,
                    status: "updated"
                });
            } else {
                skipped++;
                results.push({
                    vendorId: vendor.id,
                    company: vendorCompany(vendor),
                    fhi_id: match.fhi_id,
                    score: built.score,
                    status: "unchanged"
                });
            }
        } catch (e) {
            failed++;
            results.push({
                vendorId: vendor.id,
                company: vendorCompany(vendor),
                fhi_id: match.fhi_id,
                status: "save_failed",
                error: (e && e.message) || "저장 실패"
            });
        }
    }

    return {
        ok: true,
        dryRun: dryRun,
        totalVendors: vendors.length,
        targetCount: targets.length,
        updated: updated,
        skipped: skipped,
        failed: failed,
        noMatch: noMatch,
        fhiPool: allFhi.length,
        results: results.slice(0, 150)
    };
}

module.exports = {
    vendorMissingAnyFhiField,
    backfillPartnerVendorsFromFhi
};
