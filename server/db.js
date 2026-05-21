const { MongoClient } = require("mongodb");

let client;
let db;
let ready = false;
let connecting = false;
let lastDbError = "";

function normalizeMongoUri(uri) {
    let u = String(uri || "").trim();
    if (
        (u.startsWith('"') && u.endsWith('"')) ||
        (u.startsWith("'") && u.endsWith("'"))
    ) {
        u = u.slice(1, -1).trim();
    }
    return u;
}

function setDbError(err) {
    lastDbError = err ? String(err.message || err) : "";
}

function getLastDbError() {
    return lastDbError;
}

async function safeCreateIndex(collection, spec, options) {
    try {
        await collection.createIndex(spec, options);
    } catch (e) {
        var code = e && (e.code || e.codeName);
        if (code === 85 || code === 86 || code === "IndexOptionsConflict" || code === "IndexKeySpecsConflict") {
            return;
        }
        console.warn("[thejohn] index warning:", e.message);
    }
}

async function connectDbOnce() {
    const uri = normalizeMongoUri(process.env.MONGODB_URI);
    if (!uri) {
        throw new Error("MONGODB_URI 환경 변수가 설정되지 않았습니다.");
    }
    if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
        throw new Error("MONGODB_URI 형식이 올바르지 않습니다. mongodb+srv:// 로 시작해야 합니다.");
    }

    const dbName = String(process.env.MONGODB_DB || "thejhon").trim() || "thejhon";
    const newClient = new MongoClient(uri, {
        serverSelectionTimeoutMS: 20000,
        connectTimeoutMS: 20000,
        maxPoolSize: 10
    });

    await newClient.connect();
    await newClient.db(dbName).command({ ping: 1 });

    const database = newClient.db(dbName);
    await safeCreateIndex(database.collection("products"), { id: 1 }, { unique: true });
    await safeCreateIndex(database.collection("vendors"), { id: 1 }, { unique: true });
    await safeCreateIndex(database.collection("vendors"), { loginIdNorm: 1 }, { unique: true });

    const staff = require("./lib/staff");
    await staff.ensureStaffIndexes(database);
    await staff.ensureSupervisorSeed(database);

    if (client) {
        try {
            await client.close();
        } catch (e) {}
    }
    client = newClient;
    db = database;
    ready = true;
    lastDbError = "";
    return db;
}

async function connectDb() {
    if (db && ready) return db;
    if (connecting) {
        await new Promise(function (resolve) {
            setTimeout(resolve, 500);
        });
        if (db && ready) return db;
    }

    connecting = true;
    const maxAttempts = 3;
    var attempt;
    var lastErr;

    for (attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await connectDbOnce();
            connecting = false;
            console.log("[thejohn] MongoDB connected (attempt " + attempt + ")");
            return result;
        } catch (e) {
            lastErr = e;
            setDbError(e);
            console.error("[thejohn] MongoDB attempt " + attempt + " failed:", e.message);
            if (attempt < maxAttempts) {
                await new Promise(function (r) {
                    setTimeout(r, 2000 * attempt);
                });
            }
        }
    }

    connecting = false;
    ready = false;
    throw lastErr;
}

function scheduleReconnect() {
    setInterval(function () {
        if (ready || connecting) return;
        if (!normalizeMongoUri(process.env.MONGODB_URI)) return;
        connectDb().catch(function () {});
    }, 30000);
}

scheduleReconnect();

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

module.exports = { connectDb, getDb, closeDb, isDbReady, getLastDbError };
