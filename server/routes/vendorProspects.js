const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { COLLECTION, toPickerItem } = require("../lib/vendorProspects");

const router = express.Router();

function escapeRegex(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 관리자·슈퍼바이저 — 예비거래처 목록(선택 모달용) */
router.get("/", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const q = String(req.query.q || "").trim();
        const filter = {};
        if (q) {
            filter.vn_company = { $regex: escapeRegex(q), $options: "i" };
        }
        const docs = await getDb()
            .collection(COLLECTION)
            .find(filter)
            .sort({ vn_company: 1, updatedAt: -1 })
            .limit(300)
            .toArray();
        const items = [];
        for (const doc of docs) {
            const row = toPickerItem(doc);
            if (row && row.vn_company) items.push(row);
        }
        res.json({ ok: true, items: items });
    } catch (e) {
        console.error("GET /api/vendor-prospects", e);
        res.status(500).json({ ok: false, error: "예비거래처 목록을 불러오지 못했습니다." });
    }
});

module.exports = router;
