const { MongoClient, ServerApiVersion } = require("mongodb");

let client;
let db;
let ready = false;
let connecting = false;
let lastDbError = "";
let migrationsRunning = false;
let migrationsDone = false;

function envTrim(key) {
    return String(process.env[key] || "").trim();
}

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
    if (!uri) return "";
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

    const dbName = envTrim("MONGODB_DB") || "thejhon";
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

/** Render 권장: USER/PASSWORD/HOST 분리 (비밀번호에 ! 있어도 안전) */
function buildUriFromParts() {
    const user = envTrim("MONGODB_USER");
    const pass = envTrim("MONGODB_PASSWORD");
    const host = envTrim("MONGODB_HOST");
    if (!user || !pass || !host) return "";
    const dbName = envTrim("MONGODB_DB") || "thejhon";
    return (
        "mongodb+srv://" +
        encodeURIComponent(user) +
        ":" +
        encodeURIComponent(pass) +
        "@" +
        host +
        "/" +
        dbName +
        "?retryWrites=true&w=majority&authSource=admin"
    );
}

function getMongoUriCandidates() {
    const list = [];
    const fromParts = buildUriFromParts();
    if (fromParts) list.push({ label: "USER/PASSWORD/HOST", uri: fromParts });

    const standard = fixMongoUri(envTrim("MONGODB_URI_STANDARD"));
    if (standard) list.push({ label: "URI_STANDARD", uri: standard });

    const main = fixMongoUri(process.env.MONGODB_URI);
    if (main) list.push({ label: "MONGODB_URI", uri: main });

    const seen = new Set();
    return list.filter(function (item) {
        if (seen.has(item.uri)) return false;
        seen.add(item.uri);
        return true;
    });
}

function hasMongoConfig() {
    return getMongoUriCandidates().length > 0;
}

function mongoClientOptions() {
    return {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: false,
            deprecationErrors: false
        },
        serverSelectionTimeoutMS: 12000,
        connectTimeoutMS: 12000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        autoSelectFamily: false,
        family: 4
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

/** 예전 배포: loginIdNorm·password 유니크 인덱스 → 업체 여러 건 등록 시 E11000 */
async function dropObsoleteVendorIndexes(database) {
    const col = database.collection("vendors");
    const obsolete = ["loginIdNorm_1", "password_1"];
    for (var i = 0; i < obsolete.length; i++) {
        const name = obsolete[i];
        try {
            await col.dropIndex(name);
            console.log("[thejohn] dropped obsolete vendors." + name + " index");
        } catch (e) {
            const code = e && (e.code || e.codeName);
            if (code === 27 || code === "IndexNotFound" || /index not found/i.test(String(e.message || ""))) {
                continue;
            }
            console.warn("[thejohn] drop vendors." + name + ":", e.message);
        }
    }
}

async function runStartupMigrations(database) {
    await safeCreateIndex(database.collection("products"), { id: 1 }, { unique: true });
    await safeCreateIndex(
        database.collection("products"),
        { pd_registered_by: 1, updatedAt: -1 },
        { name: "products_registered_by_updated" }
    );
    const { migrateProductsCollection } = require("./lib/productFields");
    await migrateProductsCollection(database);
    await safeCreateIndex(database.collection("vendors"), { id: 1 }, { unique: true });
    await dropObsoleteVendorIndexes(database);
    await safeCreateIndex(database.collection("vendors"), { loginId: 1 }, { unique: true });
    await safeCreateIndex(
        database.collection("vendors"),
        { vn_registered_by: 1, updatedAt: -1 },
        { name: "vendors_registered_by_updated" }
    );

    const staff = require("./lib/staff");
    const { ensureDefaultStaffSeeds, migrateStaffCollection } = require("./lib/staffFields");
    await staff.ensureStaffIndexes(database);
    await ensureDefaultStaffSeeds(database);
    await migrateStaffCollection(database);
    const {
        reconcileStaleRegisteredByReferences,
        reconcileRegisteredByCase
    } = require("./lib/staffRegisteredBy");
    await reconcileStaleRegisteredByReferences(database);
    await reconcileRegisteredByCase(database);
    const { migrateVendorsCollection } = require("./lib/vendorFields");
    await migrateVendorsCollection(database);
    const { ensureProspectIndexes } = require("./lib/vendorProspects");
    await ensureProspectIndexes(database);
    const { ensureVendorNewIndexes } = require("./lib/vendorNew");
    await ensureVendorNewIndexes(database);
    const { ensureAccessLogIndexes } = require("./lib/accessLog");
    await ensureAccessLogIndexes(database);
    await safeCreateIndex(database.collection("support_news"), { id: 1 }, { unique: true });
    await safeCreateIndex(database.collection("support_news_comments"), { id: 1 }, { unique: true });
    await safeCreateIndex(
        database.collection("support_news_comments"),
        { snc_news_id: 1, createdAt: 1 },
        { name: "support_news_comments_news_created" }
    );
    await safeCreateIndex(database.collection("support_board"), { id: 1 }, { unique: true });
    await safeCreateIndex(database.collection("support_board"), { createdAt: -1 }, { name: "support_board_created" });
    await safeCreateIndex(database.collection("support_inquiry"), { id: 1 }, { unique: true });
    await safeCreateIndex(
        database.collection("support_inquiry"),
        { createdAt: -1 },
        { name: "support_inquiry_created" }
    );
    try {
        const { ensureLoginFieldsMigrated } = require("./lib/loginResolve");
        await ensureLoginFieldsMigrated(database);
    } catch (migErr) {
        console.error("[thejohn] login migrate warning:", migErr.message);
    }
}

function scheduleStartupMigrations(database) {
    if (migrationsRunning || migrationsDone) return;
    migrationsRunning = true;
    runStartupMigrations(database)
        .then(function () {
            migrationsDone = true;
            console.log("[thejohn] MongoDB startup migrations OK");
        })
        .catch(function (e) {
            migrationsDone = false;
            console.error("[thejohn] MongoDB startup migrations failed:", e.message);
        })
        .finally(function () {
            migrationsRunning = false;
        });
}

async function connectDbOnce() {
    const candidates = getMongoUriCandidates();
    if (!candidates.length) {
        throw new Error(
            "MongoDB 설정 없음: MONGODB_USER+PASSWORD+HOST 또는 MONGODB_URI 를 Environment에 설정하세요."
        );
    }

    const dbName = envTrim("MONGODB_DB") || "thejhon";
    let lastErr;

    for (var i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        let newClient;
        try {
            console.log("[thejohn] MongoDB connect via", c.label);
            newClient = new MongoClient(c.uri, mongoClientOptions());
            await newClient.connect();
            await newClient.db(dbName).command({ ping: 1 });

            const database = newClient.db(dbName);

            if (client) {
                try {
                    await client.close();
                } catch (e) {}
            }
            client = newClient;
            db = database;
            ready = true;
            lastDbError = "";
            console.log("[thejohn] MongoDB OK (" + c.label + ")");
            scheduleStartupMigrations(database);
            return db;
        } catch (e) {
            lastErr = e;
            if (newClient) {
                try {
                    await newClient.close();
                } catch (e2) {}
            }
            console.error("[thejohn] MongoDB", c.label, "failed:", e.message);
        }
    }

    ready = false;
    throw lastErr;
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
            return result;
        } catch (e) {
            lastErr = e;
            setDbError(e);
            var msg = e.message || "";
            console.error("[thejohn] MongoDB round " + attempt + " failed:", msg);
            if (/SSL|TLS|tlsv1|alert internal/i.test(msg)) {
                console.error(
                    "[thejohn] → Atlas Network Access 0.0.0.0/0 확인, Render에 MONGODB_USER/PASSWORD/HOST 사용"
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
        if (!hasMongoConfig()) return;
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

module.exports = {
    connectDb,
    getDb,
    closeDb,
    isDbReady,
    getLastDbError,
    fixMongoUri,
    hasMongoConfig,
    buildUriFromParts
};
