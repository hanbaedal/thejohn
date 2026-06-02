const express = require("express");
const { getDb } = require("../db");
const { optionalAuth, requireRole } = require("../middleware/auth");
const {
    buildFromBody,
    toPublic,
    toDbDoc,
    validateBuilt,
    F
} = require("../lib/supportBoardFields");
const {
    resolvePostAuthor,
    isStaffAdmin,
    matchesAuthor,
    matchesGuest,
    guestIdFromBody
} = require("../lib/supportAuthor");

const router = express.Router();
const COL = "support_board";

function newId(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

router.get("/", async function (req, res) {
    try {
        const rows = await getDb()
            .collection(COL)
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        res.json({
            ok: true,
            items: rows.map(toPublic).filter(Boolean)
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/:id", async function (req, res) {
    try {
        const doc = await getDb().collection(COL).findOne({ id: String(req.params.id || "") });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "글을 찾을 수 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/", optionalAuth, async function (req, res) {
    try {
        const built = buildFromBody(req.body || {});
        const errMsg = validateBuilt(built);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const author = await resolvePostAuthor(req.auth, req.body || {});
        if (author.error) {
            return res.status(400).json({ ok: false, error: author.error });
        }
        const id = newId("board");
        const doc = toDbDoc(id, built, author, null);
        await getDb().collection(COL).insertOne(doc);
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.put("/:id", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const doc = await getDb().collection(COL).findOne({ id: id });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "글을 찾을 수 없습니다." });
        }
        const built = buildFromBody(req.body || {});
        const errMsg = validateBuilt(built);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const updated = toDbDoc(id, built, {
            role: doc[F.authorRole] || doc.authorRole,
            userId: doc[F.authorUserId] || doc.authorUserId,
            label: doc[F.authorLabel] || doc.authorLabel
        }, doc);
        await getDb().collection(COL).updateOne({ id: id }, { $set: updated });
        res.json({ ok: true, item: toPublic(updated) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.delete("/:id", optionalAuth, async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const doc = await getDb().collection(COL).findOne({ id: id });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "글을 찾을 수 없습니다." });
        }
        const guestId = guestIdFromBody(req.body || {});
        const allowed =
            isStaffAdmin(req.auth) ||
            matchesAuthor(req.auth, doc, F.authorRole, F.authorUserId) ||
            matchesGuest(doc, guestId, F.authorRole, F.authorUserId);
        if (!allowed) {
            return res.status(403).json({ ok: false, error: "삭제할 권한이 없습니다." });
        }
        const result = await getDb().collection(COL).deleteOne({ id: id });
        if (!result.deletedCount) {
            return res.status(404).json({ ok: false, error: "글을 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
