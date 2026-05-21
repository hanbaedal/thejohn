const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const {
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt
} = require("../lib/productFields");

const router = express.Router();

function newId() {
    return "pr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

router.get("/", async (req, res) => {
    try {
        const items = await getDb()
            .collection("products")
            .find({})
            .sort({ updatedAt: -1 })
            .toArray();
        res.json({ ok: true, items: items.map(toPublic) });
    } catch (e) {
        console.error("GET /api/products", e);
        res.status(500).json({ ok: false, error: "상품 목록을 불러오지 못했습니다." });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const doc = await getDb().collection("products").findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/products/:id", e);
        res.status(500).json({ ok: false, error: "상품을 불러오지 못했습니다." });
    }
});

router.post("/", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const built = buildFromBody(req.body, null);
        const err = validateBuilt(built, true);
        if (err) return res.status(400).json({ ok: false, error: err });

        const doc = toDbDoc(newId(), built, null);
        await getDb().collection("products").insertOne(doc);
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/products", e);
        res.status(500).json({ ok: false, error: "상품 저장에 실패했습니다." });
    }
});

router.put("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const id = req.params.id;
        const existing = await getDb().collection("products").findOne({ id });
        if (!existing) return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });

        const built = buildFromBody(req.body, existing);
        const err = validateBuilt(built, false);
        if (err) return res.status(400).json({ ok: false, error: err });

        const doc = toDbDoc(id, built, existing);
        await getDb().collection("products").replaceOne({ id }, doc);
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("PUT /api/products/:id", e);
        res.status(500).json({ ok: false, error: "상품 수정에 실패했습니다." });
    }
});

router.delete("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const result = await getDb().collection("products").deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/products/:id", e);
        res.status(500).json({ ok: false, error: "상품 삭제에 실패했습니다." });
    }
});

module.exports = router;
