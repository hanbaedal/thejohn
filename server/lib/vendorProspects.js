const { loginLookupFilter } = require("./loginAccount");
const { toPublic } = require("./vendorFields");

/** 예비거래처·신규업체 — vendors 와 동일 필드 구조, 별도 컬렉션 */
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
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return db.collection(COLLECTION).findOne(filter);
}

async function findVendorByLoginId(db, loginId, excludeId) {
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return db.collection("vendors").findOne(filter);
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
    await safeIndex(col, { loginId: 1 }, { unique: true, sparse: true });
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
    findProspectByLoginId,
    findVendorByLoginId,
    ensureProspectIndexes
};
