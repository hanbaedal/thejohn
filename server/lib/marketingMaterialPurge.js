const { deleteObject } = require("./r2Storage");
const { sanitizeExistingFiles } = require("./marketingMaterialFields");

const COL = "marketing_materials";

async function deleteMaterialFiles(files) {
    const list = sanitizeExistingFiles(files);
    for (let i = 0; i < list.length; i++) {
        const key = list[i].r2Key;
        if (key) {
            try {
                await deleteObject(key);
            } catch (e) {
                console.warn("[marketing-materials] r2 delete", key, e.message);
            }
        }
    }
}

async function purgeExpiredMaterials(db) {
    if (!db) return { deleted: 0 };
    const now = Date.now();
    const expired = await db
        .collection(COL)
        .find({ expireAt: { $lte: now } })
        .toArray();
    let deleted = 0;
    for (let i = 0; i < expired.length; i++) {
        const doc = expired[i];
        await deleteMaterialFiles(doc.mm_files);
        const result = await db.collection(COL).deleteOne({ id: doc.id });
        if (result.deletedCount) deleted += 1;
    }
    if (deleted) {
        console.log("[marketing-materials] purged expired:", deleted);
    }
    return { deleted: deleted };
}

async function deleteMaterialById(db, id) {
    const doc = await db.collection(COL).findOne({ id: String(id || "") });
    if (!doc) return false;
    await deleteMaterialFiles(doc.mm_files);
    const result = await db.collection(COL).deleteOne({ id: doc.id });
    return !!result.deletedCount;
}

function scheduleMarketingMaterialPurge(dbGetter) {
    const INTERVAL_MS = 60 * 60 * 1000;
    async function run() {
        try {
            const db = dbGetter();
            if (!db) return;
            await purgeExpiredMaterials(db);
        } catch (e) {
            console.warn("[marketing-materials] purge", e.message);
        }
    }
    run();
    return setInterval(run, INTERVAL_MS);
}

module.exports = {
    COL,
    purgeExpiredMaterials,
    deleteMaterialById,
    deleteMaterialFiles,
    scheduleMarketingMaterialPurge
};
