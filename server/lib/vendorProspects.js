const { loginLookupFilter } = require("./loginAccount");
const { toPublic } = require("./vendorFields");

/** 예비거래처·신규업체 — vendors 와 동일 필드 구조, 별도 컬렉션 */
const COLLECTION = "vendor_prospects";
const F_COMPANY_NORM = "vn_company_norm";

function normalizeCompanyKey(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function applyCompanyNormToDoc(doc, companyName) {
    if (!doc) return doc;
    const norm = normalizeCompanyKey(companyName != null ? companyName : doc.vn_company);
    if (norm) doc[F_COMPANY_NORM] = norm;
    return doc;
}

function newProspectId() {
    return "vp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function toPickerItem(doc) {
    const pub = toPublic(doc);
    if (!pub || !pub.id) return null;
    return pub;
}

async function findProspectByLoginId(db, loginId, excludeId) {
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return db.collection(COLLECTION).findOne(filter);
}

async function findVendorByLoginId(db, loginId, excludeId) {
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return db.collection("vendors").findOne(filter);
}

/** 동일 업체명(정규화) — 신규업체 컬렉션 */
async function findDuplicateProspectCompany(db, companyName, excludeId) {
    const norm = normalizeCompanyKey(companyName);
    if (!norm) return null;
    const col = db.collection(COLLECTION);
    const idClause = excludeId ? { id: { $ne: excludeId } } : {};

    let doc = await col.findOne(Object.assign({ vn_company_norm: norm }, idClause));
    if (doc) return doc;

    const trimmed = String(companyName || "").trim();
    if (trimmed) {
        doc = await col.findOne(Object.assign({ vn_company: trimmed }, idClause));
        if (doc) return doc;
    }

    const legacy = await col
        .find(
            Object.assign(
                {
                    vn_company: { $exists: true, $nin: ["", null] },
                    $or: [{ vn_company_norm: { $exists: false } }, { vn_company_norm: "" }]
                },
                idClause
            )
        )
        .limit(3000)
        .toArray();
    for (let i = 0; i < legacy.length; i++) {
        if (normalizeCompanyKey(legacy[i].vn_company) === norm) return legacy[i];
    }
    return null;
}

async function safeIndex(col, spec, options) {
    try {
        await col.createIndex(spec, options);
    } catch (e) {
        const code = e && (e.code || e.codeName);
        if (code === 85 || code === 86 || code === "IndexOptionsConflict" || code === "IndexKeySpecsConflict") {
            return;
        }
        console.warn("[thejohn] vendor_prospects index warning:", e.message);
    }
}

/** DB 연결 시 컬렉션·인덱스 보장 */
async function ensureProspectIndexes(db) {
    const existing = await db.listCollections({ name: COLLECTION }, { nameOnly: true }).toArray();
    if (!existing.length) {
        await db.createCollection(COLLECTION);
        console.log("[thejohn] created MongoDB collection:", COLLECTION);
    }
    const col = db.collection(COLLECTION);
    await safeIndex(col, { id: 1 }, { unique: true, sparse: true });
    await safeIndex(col, { vn_company: 1 });
    await safeIndex(col, { vn_company_norm: 1 });
    await safeIndex(col, { loginId: 1 }, { unique: true, sparse: true });
    await safeIndex(
        col,
        { vn_registered_by: 1, updatedAt: -1 },
        { name: "vendor_prospects_registered_by_updated" }
    );
}

module.exports = {
    COLLECTION,
    F_COMPANY_NORM,
    newProspectId,
    toPickerItem,
    normalizeCompanyKey,
    applyCompanyNormToDoc,
    findProspectByLoginId,
    findVendorByLoginId,
    findDuplicateProspectCompany,
    ensureProspectIndexes
};
