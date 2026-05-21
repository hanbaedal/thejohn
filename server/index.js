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
const { connectDb, isDbReady, getLastDbError } = require("./db");

const authRoutes = require("./routes/auth");
const staffRoutes = require("./routes/staff");
const productRoutes = require("./routes/products");
const vendorRoutes = require("./routes/vendors");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

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

function requireDb(req, res, next) {
    if (isDbReady()) return next();
    return res.status(503).json({
        ok: false,
        error: "데이터베이스 연결 중입니다. 잠시 후 다시 시도해 주세요."
    });
}

app.use(
    cors({
        origin: parseOrigins(),
        credentials: true
    })
);
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        service: "thejhon-homepage",
        db: isDbReady(),
        dbError: isDbReady() ? "" : getLastDbError()
    });
});

app.get("/api/env-check", (req, res) => {
    res.json({
        ok: true,
        env: {
            MONGODB_URI: !!process.env.MONGODB_URI,
            MONGODB_DB: process.env.MONGODB_DB || "thejhon",
            JWT_SECRET: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16),
            THEJHON_SEED_SUPERVISOR_PASSWORD: !!process.env.THEJHON_SEED_SUPERVISOR_PASSWORD,
            THEJHON_GUEST_PASSWORD: !!process.env.THEJHON_GUEST_PASSWORD,
            ALLOWED_ORIGINS: !!process.env.ALLOWED_ORIGINS,
            PORT_set: !!process.env.PORT
        },
        db: isDbReady(),
        dbError: isDbReady() ? "" : getLastDbError()
    });
});

app.post("/api/admin/reconnect-db", function (req, res) {
    connectDb()
        .then(function () {
            res.json({ ok: true, db: true });
        })
        .catch(function (err) {
            res.status(503).json({ ok: false, db: false, error: err.message });
        });
});

app.use("/api/auth", requireDb, authRoutes);
app.use("/api/staff", requireDb, staffRoutes);
app.use("/api/products", requireDb, productRoutes);
app.use("/api/vendors", requireDb, vendorRoutes);

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

function validateEnv() {
    var missing = [];
    if (!envTrim("MONGODB_URI")) missing.push("MONGODB_URI");
    if (envTrim("JWT_SECRET").length < 16) missing.push("JWT_SECRET(16자 이상)");
    if (missing.length) {
        console.error("[thejohn] 필수 환경 변수 없음:", missing.join(", "));
        console.error("[thejohn] Render → Environment 에서 설정 후 Manual Deploy 하세요.");
        return false;
    }
    return true;
}

app.listen(PORT, "0.0.0.0", function () {
    console.log("[thejohn] listening on port " + PORT);
    if (!validateEnv()) {
        console.error("[thejohn] 환경 변수 미설정 — API는 503, 정적 페이지만 제공");
        return;
    }
    connectDb()
        .then(function () {
            console.log("[thejohn] MongoDB connected");
        })
        .catch(function (err) {
            console.error("[thejohn] MongoDB 연결 실패:", err.message);
            console.error(
                "[thejohn] 확인: Atlas Network Access 0.0.0.0/0, MONGODB_URI 비밀번호·따옴표 없음, /api/health 의 dbError"
            );
        });
});
