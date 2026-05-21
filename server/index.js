require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const path = require("path");
const express = require("express");
const cors = require("cors");
const { connectDb } = require("./db");

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

app.use(
    cors({
        origin: parseOrigins(),
        credentials: true
    })
);
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (req, res) => {
    res.json({ ok: true, service: "thejhon-homepage" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/vendors", vendorRoutes);

app.use(express.static(staticRoot, { index: "index.html", extensions: ["html"] }));

app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    const filePath = path.join(staticRoot, req.path.endsWith("/") ? "index.html" : req.path);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).send("Not found");
    });
});

async function start() {
    await connectDb();
    app.listen(PORT, "0.0.0.0", () => {
        console.log("thejhon server listening on port " + PORT);
    });
}

start().catch((err) => {
    console.error(err);
    process.exit(1);
});
