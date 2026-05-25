const express = require("express");
const { getDb } = require("../db");
const { requireSupervisor } = require("../middleware/supervisor");
const {
    runFullDataMigration,
    productDeptSummary,
    countEmptyProductDept
} = require("../lib/dataMigrate");

const router = express.Router();

router.get("/migrate-preview", requireSupervisor, async function (req, res) {
    try {
        const db = getDb();
        res.json({
            ok: true,
            products: await db.collection("products").countDocuments(),
            vendors: await db.collection("vendors").countDocuments(),
            productsEmptyDept: await countEmptyProductDept(db),
            productDepts: await productDeptSummary(db)
        });
    } catch (e) {
        console.error("GET /api/admin/migrate-preview", e);
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post("/migrate-data", requireSupervisor, async function (req, res) {
    try {
        const report = await runFullDataMigration(getDb());
        res.json(report);
    } catch (e) {
        console.error("POST /api/admin/migrate-data", e);
        res.status(500).json({
            ok: false,
            error: "DB 형식 변환 중 오류: " + (e.message || String(e))
        });
    }
});

module.exports = router;
