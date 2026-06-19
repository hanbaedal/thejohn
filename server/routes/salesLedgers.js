const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const {
    COL,
    newId,
    buildFromBody,
    toPublic,
    listFilter,
    canAccessDoc,
    assertSalesLedgerAccess,
    validateBuilt,
    ensureIndexes
} = require("../lib/salesLedger");

const router = express.Router();

router.use(requireRole("supervisor", "admin"));

router.get("/", async function (req, res) {
    try {
        await assertSalesLedgerAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        const filter = listFilter(req.auth, req.query);
        const items = await db
            .collection(COL)
            .find(filter)
            .sort({ issueDate: -1, updatedAt: -1 })
            .limit(500)
            .toArray();
        res.json({ ok: true, items: items.map(toPublic) });
    } catch (e) {
        console.error("GET /api/sales-ledgers", e);
        res.status(500).json({ ok: false, error: e.message || "매출장 목록을 불러오지 못했습니다." });
    }
});

router.get("/:id", async function (req, res) {
    try {
        await assertSalesLedgerAccess(req.auth);
        const doc = await getDb().collection(COL).findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "매출장을 찾을 수 없습니다." });
        if (!canAccessDoc(req.auth, doc)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/sales-ledgers/:id", e);
        res.status(500).json({ ok: false, error: e.message || "매출장을 불러오지 못했습니다." });
    }
});

router.post("/", async function (req, res) {
    try {
        await assertSalesLedgerAccess(req.auth);
        const built = buildFromBody(req.body || {}, req.auth, null);
        const err = validateBuilt(built);
        if (err) return res.status(400).json({ ok: false, error: err });
        const now = Date.now();
        const doc = Object.assign({}, built, {
            id: newId(),
            createdAt: now,
            updatedAt: now,
            createdBy: req.auth.userId || ""
        });
        const db = getDb();
        await ensureIndexes(db);
        await db.collection(COL).insertOne(doc);
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/sales-ledgers", e);
        res.status(500).json({ ok: false, error: e.message || "매출장 저장에 실패했습니다." });
    }
});

router.put("/:id", async function (req, res) {
    try {
        await assertSalesLedgerAccess(req.auth);
        const db = getDb();
        const existing = await db.collection(COL).findOne({ id: req.params.id });
        if (!existing) return res.status(404).json({ ok: false, error: "매출장을 찾을 수 없습니다." });
        if (!canAccessDoc(req.auth, existing)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        const built = buildFromBody(req.body || {}, req.auth, existing);
        const err = validateBuilt(built);
        if (err) return res.status(400).json({ ok: false, error: err });
        const updated = Object.assign({}, existing, built, { updatedAt: Date.now() });
        await db.collection(COL).updateOne({ id: existing.id }, { $set: updated });
        res.json({ ok: true, item: toPublic(updated) });
    } catch (e) {
        console.error("PUT /api/sales-ledgers/:id", e);
        res.status(500).json({ ok: false, error: e.message || "매출장 수정에 실패했습니다." });
    }
});

router.delete("/:id", async function (req, res) {
    try {
        await assertSalesLedgerAccess(req.auth);
        const db = getDb();
        const existing = await db.collection(COL).findOne({ id: req.params.id });
        if (!existing) return res.status(404).json({ ok: false, error: "매출장을 찾을 수 없습니다." });
        if (!canAccessDoc(req.auth, existing)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        await db.collection(COL).deleteOne({ id: existing.id });
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/sales-ledgers/:id", e);
        res.status(500).json({ ok: false, error: e.message || "매출장 삭제에 실패했습니다." });
    }
});

module.exports = router;
