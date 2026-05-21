const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

function newId() {
    return "pr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function toPublic(doc) {
    if (!doc) return null;
    return {
        id: doc.id,
        title: doc.title || "",
        image: doc.image || "",
        content: doc.content || "",
        spec: doc.spec || "",
        price: Number(doc.price) || 0,
        updatedAt: doc.updatedAt || 0
    };
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
        const title = String(req.body.title || "").trim();
        const content = String(req.body.content || "").trim();
        const spec = String(req.body.spec || "").trim();
        const price = parseInt(req.body.price, 10);
        const image = String(req.body.image || "");

        if (!title) return res.status(400).json({ ok: false, error: "제목을 입력해 주세요." });
        if (!content) return res.status(400).json({ ok: false, error: "내용을 입력해 주세요." });
        if (!isFinite(price) || price < 0) {
            return res.status(400).json({ ok: false, error: "가격을 올바르게 입력해 주세요." });
        }
        if (!image) return res.status(400).json({ ok: false, error: "신규 등록 시 사진이 필요합니다." });

        const doc = {
            id: newId(),
            title,
            content,
            spec,
            price,
            image,
            updatedAt: Date.now()
        };
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

        const title = String(req.body.title || "").trim();
        const content = String(req.body.content || "").trim();
        const spec = String(req.body.spec || "").trim();
        const price = parseInt(req.body.price, 10);
        const image =
            req.body.image !== undefined && req.body.image !== null
                ? String(req.body.image)
                : existing.image || "";

        if (!title) return res.status(400).json({ ok: false, error: "제목을 입력해 주세요." });
        if (!content) return res.status(400).json({ ok: false, error: "내용을 입력해 주세요." });
        if (!isFinite(price) || price < 0) {
            return res.status(400).json({ ok: false, error: "가격을 올바르게 입력해 주세요." });
        }

        const doc = {
            id,
            title,
            content,
            spec,
            price,
            image,
            updatedAt: Date.now()
        };
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
