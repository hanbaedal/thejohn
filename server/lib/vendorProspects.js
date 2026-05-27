const { toPublic } = require("./vendorFields");

/** 예비거래처 — vendors 와 동일 필드 구조, 별도 컬렉션 */
const COLLECTION = "vendor_prospects";

function toPickerItem(doc) {
    const pub = toPublic(doc);
    if (!pub || !pub.id) return null;
    return pub;
}

async function ensureProspectIndexes(db) {
    const col = db.collection(COLLECTION);
    await col.createIndex({ id: 1 }, { unique: true, sparse: true });
    await col.createIndex({ vn_company: 1 });
}

module.exports = {
    COLLECTION,
    toPickerItem,
    ensureProspectIndexes
};
