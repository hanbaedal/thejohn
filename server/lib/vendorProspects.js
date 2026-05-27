const { toPublic } = require("./vendorFields");

/** 예비거래처 — vendors 와 동일 필드 구조, 별도 컬렉션 */
const COLLECTION = "vendor_prospects";

function toPickerItem(doc) {
    const pub = toPublic(doc);
    if (!pub || !pub.id) return null;
    return pub;
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

/** DB 연결 시 컬렉션·인덱스 보장 (빈 컬렉션도 Compass 등에서 보이도록 createCollection 사용) */
async function ensureProspectIndexes(db) {
    const existing = await db.listCollections({ name: COLLECTION }, { nameOnly: true }).toArray();
    if (!existing.length) {
        await db.createCollection(COLLECTION);
        console.log("[thejohn] created MongoDB collection:", COLLECTION);
    }
    const col = db.collection(COLLECTION);
    await safeIndex(col, { id: 1 }, { unique: true, sparse: true });
    await safeIndex(col, { vn_company: 1 });
}

module.exports = {
    COLLECTION,
    toPickerItem,
    ensureProspectIndexes
};
