require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

console.log("[thejohn] boot", {
    node: process.version,
    cwd: process.cwd(),
    port: process.env.PORT || "(default 3000)"
});

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const {
    connectDb,
    getDb,
    isDbReady,
    getLastDbError,
    hasMongoConfig,
    buildUriFromParts
} = require("./db");

const authRoutes = require("./routes/auth");
const staffRoutes = require("./routes/staff");
const productRoutes = require("./routes/products");
const vendorRoutes = require("./routes/vendors");
const orderRoutes = require("./routes/orders");
const { requireRole } = require("./middleware/auth");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(function (req, res, next) {
    const host = String(req.headers.host || "")
        .split(":")[0]
        .toLowerCase();
    if (host === "thejohn.co.kr") {
        return res.redirect(301, "https://www.thejohn.co.kr" + req.originalUrl);
    }
    next();
});

function resolveStaticRoot() {
    var pub = path.join(__dirname, "public");
    if (fs.existsSync(path.join(pub, "index.html"))) return pub;
    var parent = path.join(__dirname, "..");
    if (fs.existsSync(path.join(parent, "index.html"))) return parent;
    console.warn("[thejohn] index.html not found — check build (npm run build)");
    return pub;
}

const staticRoot = resolveStaticRoot();
console.log("[thejohn] static root:", staticRoot);

function parseOrigins() {
    const raw = process.env.ALLOWED_ORIGINS || "";
    const list = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (list.length) return list;
    return true;
}

function dbErrorHint(msg) {
    var m = String(msg || "");
    if (/설정 없음|NO_CONFIG/i.test(m)) {
        return "Render Environment에 MONGODB_USER, MONGODB_PASSWORD, MONGODB_HOST(또는 MONGODB_URI)를 설정한 뒤 Manual Deploy 하세요.";
    }
    if (/bad auth|Authentication failed/i.test(m)) {
        return "Atlas 비밀번호와 Render MONGODB_PASSWORD가 일치하는지 확인하세요.";
    }
    if (/SSL|TLS|tlsv1|alert internal/i.test(m)) {
        return "Atlas Network Access에 0.0.0.0/0을 추가하고, MONGODB_USER/PASSWORD/HOST 분리 설정을 권장합니다.";
    }
    if (/ENOTFOUND|getaddrinfo/i.test(m)) {
        return "MONGODB_HOST(클러스터 주소)가 올바른지 확인하세요.";
    }
    return "잠시 후 다시 시도하거나 /api/health 의 dbError를 확인하세요.";
}

function requireDb(req, res, next) {
    if (isDbReady()) return next();

    if (!hasMongoConfig()) {
        return res.status(503).json({
            ok: false,
            code: "NO_MONGO_CONFIG",
            error: "MongoDB 환경 변수가 없습니다. Render Environment를 확인해 주세요.",
            hint: dbErrorHint("설정 없음")
        });
    }

    connectDb()
        .then(function () {
            next();
        })
        .catch(function () {
            var errMsg = getLastDbError();
            return res.status(503).json({
                ok: false,
                code: "DB_UNAVAILABLE",
                error: "데이터베이스에 연결할 수 없습니다. " + dbErrorHint(errMsg),
                dbError: errMsg
            });
        });
}

app.use(
    cors({
        origin: parseOrigins(),
        credentials: true
    })
);
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", async function (req, res) {
    try {
        const payload = {
            ok: true,
            service: "thejhon-homepage",
            db: isDbReady(),
            dbError: isDbReady() ? "" : getLastDbError(),
            loginSource: "mongodb collections staff and vendors (not source code)"
        };
        if (isDbReady()) {
            const { EXPECTED_STAFF_LOGIN_IDS, findExpectedStaffInDb } = require("./lib/staffFields");
            const docs = await findExpectedStaffInDb(getDb());
            payload.staffInDb = docs;
            payload.staffExpected = EXPECTED_STAFF_LOGIN_IDS;
            payload.staffOk = EXPECTED_STAFF_LOGIN_IDS.every(function (id) {
                return docs.some(function (d) {
                    return d.loginId === id;
                });
            });
            payload.vendorCount = await getDb().collection("vendors").countDocuments();
        }
        res.json(payload);
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

app.get("/api/env-check", (req, res) => {
    res.json({
        ok: true,
        env: {
            MONGODB_URI: !!process.env.MONGODB_URI,
            MONGODB_USER: !!envTrim("MONGODB_USER"),
            MONGODB_PASSWORD: !!envTrim("MONGODB_PASSWORD"),
            MONGODB_HOST: !!envTrim("MONGODB_HOST"),
            mongoFromParts: !!buildUriFromParts(),
            MONGODB_DB: process.env.MONGODB_DB || "thejhon",
            JWT_SECRET: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16),
            THEJHON_SEED_SUPERVISOR_PASSWORD: !!process.env.THEJHON_SEED_SUPERVISOR_PASSWORD,
            ALLOWED_ORIGINS: !!process.env.ALLOWED_ORIGINS,
            PORT_set: !!process.env.PORT
        },
        db: isDbReady(),
        dbError: isDbReady() ? "" : getLastDbError()
    });
});

app.post("/api/admin/reconnect-db", requireDb, requireRole("supervisor", "admin"), async function (req, res) {
    try {
        await connectDb();
        const { ensureDefaultStaffSeeds, findExpectedStaffInDb, EXPECTED_STAFF_LOGIN_IDS } =
            require("./lib/staffFields");
        await ensureDefaultStaffSeeds(getDb());
        const staffInDb = await findExpectedStaffInDb(getDb());
        const staffOk = EXPECTED_STAFF_LOGIN_IDS.every(function (id) {
            return staffInDb.some(function (d) {
                return d.loginId === id;
            });
        });
        res.json({
            ok: true,
            db: true,
            staffOk,
            staffInDb
        });
    } catch (err) {
        res.status(503).json({ ok: false, db: false, error: err.message });
    }
});

app.use("/api/auth", requireDb, authRoutes);
app.use("/api/staff", requireDb, staffRoutes);
app.use("/api/products", requireDb, productRoutes);
app.use("/api/vendors", requireDb, vendorRoutes);
app.use("/api/orders", requireDb, orderRoutes);

app.use(express.static(staticRoot, { index: "index.html", extensions: ["html"] }));

app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    const filePath = path.join(staticRoot, req.path.endsWith("/") ? "index.html" : req.path);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).send("Not found");
    });
});

function envTrim(key) {
    return String(process.env[key] || "").trim();
}

function startMongoConnect() {
    if (!hasMongoConfig()) {
        console.error("[thejohn] MongoDB 환경 변수 없음 — MONGODB_USER/PASSWORD/HOST 또는 MONGODB_URI 필요");
        return;
    }
    if (envTrim("JWT_SECRET").length < 16) {
        console.error("[thejohn] JWT_SECRET(16자 이상) 없음 — 로그인 토큰 발급 불가");
    }
    connectDb()
        .then(function () {
            console.log("[thejohn] MongoDB connected");
        })
        .catch(function (err) {
            console.error("[thejohn] MongoDB 연결 실패:", err.message);
            console.error(
                "[thejohn] → /api/health · /api/env-check 확인, Atlas 0.0.0.0/0, 비밀번호 일치"
            );
        });
}

app.listen(PORT, "0.0.0.0", function () {
    console.log("[thejohn] listening on port " + PORT);
    startMongoConnect();
});
