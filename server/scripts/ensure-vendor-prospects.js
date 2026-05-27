/**
 * vendor_prospects 컬렉션·인덱스 수동 생성 (로컬/배포 DB 확인용)
 * 사용: cd server && node scripts/ensure-vendor-prospects.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { MongoClient } = require("mongodb");
const { ensureProspectIndexes, COLLECTION } = require("../lib/vendorProspects");

async function main() {
    const uri =
        process.env.MONGODB_URI ||
        (process.env.MONGODB_USER && process.env.MONGODB_PASSWORD && process.env.MONGODB_HOST
            ? null
            : null);
    if (!uri && !(process.env.MONGODB_USER && process.env.MONGODB_HOST)) {
        console.error("MONGODB_URI 또는 MONGODB_USER/PASSWORD/HOST 가 필요합니다.");
        process.exit(1);
    }
    const dbName = String(process.env.MONGODB_DB || "thejhon").trim();
    let connectUri = uri;
    if (!connectUri) {
        const user = encodeURIComponent(process.env.MONGODB_USER);
        const pass = encodeURIComponent(process.env.MONGODB_PASSWORD || "");
        const host = process.env.MONGODB_HOST;
        connectUri = "mongodb+srv://" + user + ":" + pass + "@" + host + "/" + dbName;
    }
    const client = new MongoClient(connectUri, { serverSelectionTimeoutMS: 20000 });
    try {
        await client.connect();
        const db = client.db(dbName);
        await db.command({ ping: 1 });
        console.log("DB:", dbName);
        await ensureProspectIndexes(db);
        const cols = await db.listCollections({}, { nameOnly: true }).toArray();
        const names = cols.map((c) => c.name).sort();
        console.log("collections:", names.join(", ") || "(none)");
        const n = await db.collection(COLLECTION).countDocuments();
        console.log(COLLECTION + " document count:", n);
    } catch (e) {
        console.error("FAIL", e.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

main();
