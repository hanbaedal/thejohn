const { toPublic } = require("./vendorFields");
const {
    normalizeCompanyKey,
    applyCompanyNormToDoc,
    findLoginInCollection,
    findDuplicateCompanyInCollection
} = require("./vendorCollections");

/** 예비거래처 — 엑셀 일괄 등록·선택 모달용 (로그인 없음) */
const COLLECTION = "vendor_prospects";

function newProspectId() {
    return "vp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function toPickerItem(doc) {
    const pub = toPublic(doc);
    if (!pub || !pub.id) return null;
    return pub;
}

async function findProspectByLoginId(db, loginId, excludeId) {
    return findLoginInCollection(db, COLLECTION, loginId, excludeId);
}

async function findDuplicateProspectCompany(db, companyName, excludeId) {
    return findDuplicateCompanyInCollection(db, COLLECTION, companyName, excludeId);
}

async function safeIndex(col, spec, options) {
    try {
        await col.createIndex(spec, options);
    } catch (e) {
        const code = e && (e.code || e.codeName);
        if (code === 85 || code === 86 || code === "IndexOptionsConflict" || code === "IndexKeySpecsConflict") {
            return;
        }
        if (/must be connected|Topology is closed|connection closed/i.test(String(e.message || ""))) {
            throw e;
        }
        console.warn("[thejohn] vendor_prospects index warning:", e.message);
    }
}

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
    await safeIndex(
        col,
        { vn_registered_by: 1, updatedAt: -1 },
        { name: "vendor_prospects_registered_by_updated" }
    );
}

module.exports = {
    COLLECTION,
    newProspectId,
    toPickerItem,
    normalizeCompanyKey,
    applyCompanyNormToDoc,
    findProspectByLoginId,
    findDuplicateProspectCompany,
    ensureProspectIndexes
};
