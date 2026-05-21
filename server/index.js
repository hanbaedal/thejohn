require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

console.log("[thejohn] boot", {
    node: process.version,
    cwd: process.cwd(),
    port: process.env.PORT || "(default 3000)"
});

const path = require("path");
const express = require("express");
const cors = require("cors");
const { connectDb, isDbReady } = require("./db");

const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const vendorRoutes = require("./routes/vendors");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const staticRoot = path.join(__dirname, "..");

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
        db: isDbReady()
    });
});

app.get("/api/env-check", (req, res) => {
    res.json({
        ok: true,
        env: {
            MONGODB_URI: !!process.env.MONGODB_URI,
            MONGODB_DB: process.env.MONGODB_DB || "thejhon",
            JWT_SECRET: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16),
            THEJHON_ADMIN_PASSWORD: !!process.env.THEJHON_ADMIN_PASSWORD,
            THEJHON_GUEST_PASSWORD: !!process.env.THEJHON_GUEST_PASSWORD,
            ALLOWED_ORIGINS: !!process.env.ALLOWED_ORIGINS,
            PORT_set: !!process.env.PORT
        },
        db: isDbReady()
    });
});

app.use("/api/auth", requireDb, authRoutes);
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

function validateEnv() {
    var missing = [];
    if (!process.env.MONGODB_URI) missing.push("MONGODB_URI");
    if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 16) {
        missing.push("JWT_SECRET(16자 이상)");
    }
    if (!process.env.THEJHON_ADMIN_PASSWORD) missing.push("THEJHON_ADMIN_PASSWORD");
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
            console.error("[thejohn] Atlas Network Access에 0.0.0.0/0 허용 여부를 확인하세요.");
        });
});
