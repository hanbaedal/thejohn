const express = require("express");
const { getDb } = require("../db");
const { optionalAuth, requireRole } = require("../middleware/auth");
const {
    buildFromBody,
    toPublic,
    toDbDoc,
    validateBuilt,
    validateReplyBody,
    applyReply,
    previewFromBody,
    canViewDoc,
    hasPassword,
    F
} = require("../lib/supportInquiryFields");
const {
    resolvePostAuthor,
    isStaffAdmin,
    matchesAuthor,
    matchesGuest,
    guestIdFromBody,
    parseUnlockedIds,
    str
} = require("../lib/supportAuthor");

const router = express.Router();
const COL = "support_inquiry";

function newId(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function inquiryContext(req, doc, unlockedIds) {
    return {
        isAdmin: isStaffAdmin(req.auth),
        isAuthor: matchesAuthor(req.auth, doc, F.fromRole, F.fromUserId),
        unlockedIds: unlockedIds || []
    };
}

router.get("/", optionalAuth, async function (req, res) {
    try {
        const unlockedIds = parseUnlockedIds(req.query);
        const rows = await getDb()
            .collection(COL)
            .find({})
            .sort({ createdAt: -1 })
            .toArray();
        const items = rows.map(function (doc) {
            const ctx = inquiryContext(req, doc, unlockedIds);
            const pub = toPublic(doc, ctx);
            if (!pub.canView) {
                pub.preview = "🔒 비밀글입니다";
            } else {
                pub.preview = previewFromBody(pub.body);
            }
            return pub;
        });
        res.json({ ok: true, items: items });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/:id", optionalAuth, async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const doc = await getDb().collection(COL).findOne({ id: id });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "문의를 찾을 수 없습니다." });
        }
        const unlockedIds = parseUnlockedIds(req.query);
        const ctx = inquiryContext(req, doc, unlockedIds);
        if (!canViewDoc(doc, ctx)) {
            return res.status(403).json({
                ok: false,
                code: "LOCKED",
                error: "비밀글입니다. 비밀번호를 입력해 주세요.",
                item: {
                    id: doc.id,
                    subject: str(doc[F.subject]),
                    hasPassword: true,
                    canView: false,
                    fromLabel: str(doc[F.fromLabel]),
                    status: str(doc[F.status]) === "answered" ? "answered" : "open",
                    createdAt: doc.createdAt || 0
                }
            });
        }
        res.json({ ok: true, item: toPublic(doc, ctx) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/:id/unlock", optionalAuth, async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const doc = await getDb().collection(COL).findOne({ id: id });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "문의를 찾을 수 없습니다." });
        }
        const ctx = inquiryContext(req, doc, [id]);
        if (canViewDoc(doc, ctx)) {
            return res.json({ ok: true, item: toPublic(doc, ctx) });
        }
        if (!hasPassword(doc)) {
            return res.json({ ok: true, item: toPublic(doc, Object.assign({}, ctx, { unlockedIds: [id] })) });
        }
        const entered = str(req.body && (req.body.password || req.body.si_password));
        if (entered !== str(doc[F.password])) {
            return res.status(403).json({ ok: false, error: "비밀번호가 올바르지 않습니다." });
        }
        res.json({
            ok: true,
            item: toPublic(doc, Object.assign({}, ctx, { unlockedIds: [id] }))
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/", optionalAuth, async function (req, res) {
    try {
        const built = buildFromBody(req.body || {});
        const errMsg = validateBuilt(built, true);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const author = await resolvePostAuthor(req.auth, req.body || {});
        if (author.error) {
            return res.status(400).json({ ok: false, error: author.error });
        }
        const id = newId("inq");
        const packed = toDbDoc(id, built, author, null);
        if (packed.error) {
            return res.status(400).json({ ok: false, error: packed.error });
        }
        await getDb().collection(COL).insertOne(packed.doc);
        const ctx = inquiryContext(req, packed.doc, [id]);
        res.status(201).json({ ok: true, item: toPublic(packed.doc, ctx) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.put("/:id/reply", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const doc = await getDb().collection(COL).findOne({ id: id });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "문의를 찾을 수 없습니다." });
        }
        const errMsg = validateReplyBody(req.body || {});
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const adminId = str((req.auth && req.auth.userId) || "admin");
        const next = applyReply(doc, req.body || {}, adminId);
        await getDb().collection(COL).replaceOne({ id: id }, next);
        const ctx = { isAdmin: true, isAuthor: false, unlockedIds: [id] };
        res.json({ ok: true, item: toPublic(next, ctx) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.delete("/:id", optionalAuth, async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const doc = await getDb().collection(COL).findOne({ id: id });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "문의를 찾을 수 없습니다." });
        }
        const guestId = guestIdFromBody(req.body || {});
        const allowed =
            isStaffAdmin(req.auth) ||
            matchesAuthor(req.auth, doc, F.fromRole, F.fromUserId) ||
            matchesGuest(doc, guestId, F.fromRole, F.fromUserId);
        if (!allowed) {
            return res.status(403).json({ ok: false, error: "삭제할 권한이 없습니다." });
        }
        const result = await getDb().collection(COL).deleteOne({ id: id });
        if (!result.deletedCount) {
            return res.status(404).json({ ok: false, error: "문의를 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
