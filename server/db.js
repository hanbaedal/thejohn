const { MongoClient } = require("mongodb");

let client;
let db;

async function connectDb() {
    if (db) return db;
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI 환경 변수가 설정되지 않았습니다.");
    }
    const dbName = process.env.MONGODB_DB || "thejhon";
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    await db.collection("products").createIndex({ id: 1 }, { unique: true });
    await db.collection("vendors").createIndex({ id: 1 }, { unique: true });
    await db.collection("vendors").createIndex({ loginIdNorm: 1 }, { unique: true });
    return db;
}

function getDb() {
    if (!db) throw new Error("DB가 연결되지 않았습니다. connectDb()를 먼저 호출하세요.");
    return db;
}

async function closeDb() {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}

module.exports = { connectDb, getDb, closeDb };
