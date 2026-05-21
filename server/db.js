const { MongoClient } = require("mongodb");

let client;
let db;
let ready = false;

async function connectDb() {
    if (db && ready) return db;
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI 환경 변수가 설정되지 않았습니다.");
    }
    const dbName = process.env.MONGODB_DB || "thejhon";
    client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000
    });
    await client.connect();
    db = client.db(dbName);
    await db.collection("products").createIndex({ id: 1 }, { unique: true });
    await db.collection("vendors").createIndex({ id: 1 }, { unique: true });
    await db.collection("vendors").createIndex({ loginIdNorm: 1 }, { unique: true });

    const staff = require("./lib/staff");
    await staff.ensureStaffIndexes(db);
    await staff.ensureSupervisorSeed(db);

    ready = true;
    return db;
}

function isDbReady() {
    return ready;
}

function getDb() {
    if (!db || !ready) throw new Error("DB가 연결되지 않았습니다.");
    return db;
}

async function closeDb() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        ready = false;
    }
}

module.exports = { connectDb, getDb, closeDb, isDbReady };
