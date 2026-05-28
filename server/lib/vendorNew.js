const { toPublic } = require("./vendorFields");
const { normalizeCompanyKey, applyCompanyNormToDoc, findDuplicateCompanyInCollection } = require("./vendorCollections");

/** 관리자 신규업체 등록 — 로그인·비밀번호 포함 */
const COLLECTION = "vendor_new";

function newVendorNewId() {
    return "vnew_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function toListItem(doc) {
    const pub = toPublic(doc);
    if (!pub || !pub.id) return null;
    return pub;
}

async function findNewVendorByLoginId(db, loginId, excludeId) {
    const { findLoginInCollection } = require("./vendorCollections");
    return findLoginInCollection(db, COLLECTION, loginId, excludeId);
}

async function findDuplicateNewCompany(db, companyName, excludeId) {
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
        console.warn("[thejohn] vendor_new index warning:", e.message);
    }
}

async function ensureVendorNewIndexes(db) {
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
        { name: "vendor_new_registered_by_updated" }
    );
}

module.exports = {
    COLLECTION,
    newVendorNewId,
    toListItem,
    normalizeCompanyKey,
    applyCompanyNormToDoc,
    findNewVendorByLoginId,
    findDuplicateNewCompany,
    ensureVendorNewIndexes
};
