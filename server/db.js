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

/** 비밀번호의 ! @ # 등을 URL 인코딩 (Render/Linux TLS 오류 방지) */
function encodeCredentialPart(part) {
    const raw = String(part || "");
    try {
        const decoded = decodeURIComponent(raw);
        if (encodeURIComponent(decoded) === raw && /[^A-Za-z0-9._~-]/.test(decoded)) {
            return encodeURIComponent(decoded);
        }
        if (decoded !== raw) return raw;
        return encodeURIComponent(decoded);
    } catch (e) {
        return encodeURIComponent(raw);
    }
}

function fixMongoUri(raw) {
    let uri = normalizeMongoUri(raw);
    const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^@]+)@(.+)$/);
    if (match) {
        const prefix = match[1];
        const userPass = match[2];
        const rest = match[3];
        const colon = userPass.indexOf(":");
        if (colon > 0) {
            const user = encodeCredentialPart(userPass.slice(0, colon));
            const pass = encodeCredentialPart(userPass.slice(colon + 1));
            uri = prefix + user + ":" + pass + "@" + rest;
        }
    }

    const qIndex = uri.indexOf("?");
    const base = qIndex >= 0 ? uri.slice(0, qIndex) : uri;
    let qs = qIndex >= 0 ? uri.slice(qIndex + 1) : "";
    const params = new URLSearchParams(qs);

    if (!params.has("retryWrites")) params.set("retryWrites", "true");
    if (!params.has("w")) params.set("w", "majority");
    if (!params.has("authSource")) params.set("authSource", "admin");

    const dbName = String(process.env.MONGODB_DB || "thejhon").trim() || "thejhon";
    let pathBase = base;
    const hostStart = pathBase.indexOf("@");
    if (hostStart >= 0) {
        const afterHost = pathBase.slice(hostStart + 1);
        const slash = afterHost.indexOf("/");
        if (slash < 0) {
            pathBase = pathBase + "/" + dbName;
        } else if (slash === afterHost.length - 1) {
            pathBase = pathBase + dbName;
        }
    }

    const query = params.toString();
    return query ? pathBase + "?" + query : pathBase;
}

function mongoClientOptions() {
    return {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        autoSelectFamily: false
    };
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
    const uri = fixMongoUri(process.env.MONGODB_URI);
    if (!uri) {
        throw new Error("MONGODB_URI 환경 변수가 설정되지 않았습니다.");
    }
    if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
        throw new Error("MONGODB_URI 형식이 올바르지 않습니다. mongodb+srv:// 로 시작해야 합니다.");
    }

    const dbName = String(process.env.MONGODB_DB || "thejhon").trim() || "thejhon";
    const newClient = new MongoClient(uri, mongoClientOptions());

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
            var msg = e.message || "";
            console.error("[thejohn] MongoDB attempt " + attempt + " failed:", msg);
            if (/SSL|TLS|tlsv1|alert internal/i.test(msg)) {
                console.error(
                    "[thejohn] TLS 힌트: Atlas Network Access 0.0.0.0/0, MONGODB_URI 비밀번호 URL 인코딩(! → %21)"
                );
            }
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

module.exports = { connectDb, getDb, closeDb, isDbReady, getLastDbError, fixMongoUri };
