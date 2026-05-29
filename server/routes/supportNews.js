const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { normalizeDept } = require("../lib/productDept");
const {
    buildFromBody,
    toPublic,
    toDbDoc,
    validateBuilt
} = require("../lib/supportNewsFields");
const {
    buildFromBody: buildCommentBody,
    toPublic: toPublicComment,
    toDbDoc: toCommentDbDoc,
    validateBuilt: validateComment
} = require("../lib/supportNewsCommentFields");
const { findStaffByLoginId, findVendorByLoginId } = require("../lib/loginResolve");
const { getCompanyName: getVendorCompanyName } = require("../lib/vendorFields");

const router = express.Router();
const COL = "support_news";
const COMMENT_COL = "support_news_comments";

function newId(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function staffTel(staff) {
    if (!staff) return "";
    return (
        String(staff.st_ceo_tel || staff.ceoPhone || "").trim() ||
        String(staff.st_phone || staff.phone || "").trim()
    );
}

async function staffMeta(auth) {
    const createdBy = String((auth && auth.userId) || "").trim();
    let createdByName = createdBy;
    let createdByTel = "";
    if (createdBy) {
        try {
            const staff = await findStaffByLoginId(createdBy);
            if (staff) {
                const name = String(staff.st_ceo || staff.name || "").trim();
                if (name) createdByName = name;
                createdByTel = staffTel(staff);
            }
        } catch (e) {
            /* ignore */
        }
    }
    return { createdBy: createdBy, createdByName: createdByName, createdByTel: createdByTel };
}

async function enrichContact(item) {
    if (!item) return item;
    if (item.sn_created_by_tel) return item;
    const loginId = String(item.sn_created_by || "").trim();
    if (!loginId) return item;
    try {
        const staff = await findStaffByLoginId(loginId);
        const tel = staffTel(staff);
        if (tel) item.sn_created_by_tel = tel;
        if (!item.sn_created_by_name && staff) {
            const name = String(staff.st_ceo || staff.name || "").trim();
            if (name) item.sn_created_by_name = name;
        }
    } catch (e) {
        /* ignore */
    }
    return item;
}

async function enrichList(items) {
    const out = [];
    for (const row of items || []) {
        out.push(await enrichContact(row));
    }
    return out;
}

router.get("/", async function (req, res) {
    try {
        const dept = normalizeDept(req.query.dept || "");
        const query = dept ? { sn_dept: dept } : {};
        const rows = await getDb()
            .collection(COL)
            .find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .toArray();
        const items = await enrichList(rows.map(toPublic).filter(Boolean));
        res.json({ ok: true, items: items });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/:id/comments", async function (req, res) {
    try {
        const newsId = String(req.params.id || "");
        const news = await getDb().collection(COL).findOne({ id: newsId });
        if (!news) {
            return res.status(404).json({ ok: false, error: "소식을 찾을 수 없습니다." });
        }
        const rows = await getDb()
            .collection(COMMENT_COL)
            .find({ snc_news_id: newsId })
            .sort({ createdAt: 1 })
            .toArray();
        res.json({
            ok: true,
            items: rows.map(toPublicComment).filter(Boolean)
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

async function resolveCommentAuthor(auth) {
    const loginId = String((auth && auth.userId) || "").trim();
    const role = String((auth && auth.role) || "").trim();
    let authorName = loginId;
    if (role === "vendor") {
        try {
            const vendor = await findVendorByLoginId(loginId);
            if (vendor) authorName = getVendorCompanyName(vendor) || loginId;
        } catch (e) {
            /* ignore */
        }
    } else if (role === "admin" || role === "supervisor") {
        try {
            const staff = await findStaffByLoginId(loginId);
            if (staff) {
                const name = String(staff.st_ceo || staff.name || "").trim();
                if (name) authorName = name;
            }
        } catch (e) {
            /* ignore */
        }
    }
    return { authorRole: role, authorUserId: loginId, authorName: authorName };
}

router.post("/:id/comments", requireRole("vendor", "admin", "supervisor"), async function (req, res) {
    try {
        const newsId = String(req.params.id || "");
        const news = await getDb().collection(COL).findOne({ id: newsId });
        if (!news) {
            return res.status(404).json({ ok: false, error: "소식을 찾을 수 없습니다." });
        }
        const built = buildCommentBody(req.body || {});
        const errMsg = validateComment(built);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        if (built.snc_parent_id) {
            const parent = await getDb().collection(COMMENT_COL).findOne({
                id: built.snc_parent_id,
                snc_news_id: newsId
            });
            if (!parent) {
                return res.status(400).json({ ok: false, error: "원 댓글을 찾을 수 없습니다." });
            }
            if (String(parent.snc_parent_id || "").trim()) {
                return res.status(400).json({ ok: false, error: "답글에는 답글을 달 수 없습니다." });
            }
        }
        const author = await resolveCommentAuthor(req.auth);
        const id = newId("snc");
        const doc = toCommentDbDoc(id, newsId, built, author);
        await getDb().collection(COMMENT_COL).insertOne(doc);
        res.status(201).json({ ok: true, item: toPublicComment(doc) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.delete("/:id/comments/:commentId", requireRole("vendor", "admin", "supervisor"), async function (req, res) {
    try {
        const newsId = String(req.params.id || "");
        const commentId = String(req.params.commentId || "");
        const comment = await getDb().collection(COMMENT_COL).findOne({
            id: commentId,
            snc_news_id: newsId
        });
        if (!comment) {
            return res.status(404).json({ ok: false, error: "댓글을 찾을 수 없습니다." });
        }
        const auth = req.auth || {};
        const role = String(auth.role || "");
        const userId = String(auth.userId || "").trim().toLowerCase();
        const authorId = String(comment.snc_author_user_id || "").trim().toLowerCase();
        const isStaff = role === "admin" || role === "supervisor";
        const isOwner = role === "vendor" && userId && userId === authorId;
        if (!isStaff && !isOwner) {
            return res.status(403).json({ ok: false, error: "댓글을 삭제할 권한이 없습니다." });
        }
        await getDb().collection(COMMENT_COL).deleteOne({ id: commentId, snc_news_id: newsId });
        await getDb().collection(COMMENT_COL).deleteMany({
            snc_parent_id: commentId,
            snc_news_id: newsId
        });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.get("/:id", async function (req, res) {
    try {
        const doc = await getDb().collection(COL).findOne({ id: String(req.params.id || "") });
        if (!doc) {
            return res.status(404).json({ ok: false, error: "소식을 찾을 수 없습니다." });
        }
        const item = await enrichContact(toPublic(doc));
        res.json({ ok: true, item: item });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.post("/", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const built = buildFromBody(req.body || {});
        const errMsg = validateBuilt(built);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const id = newId("sn");
        const meta = await staffMeta(req.auth);
        const doc = toDbDoc(id, built, null, meta);
        await getDb().collection(COL).insertOne(doc);
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.put("/:id", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const existing = await getDb().collection(COL).findOne({ id: id });
        if (!existing) {
            return res.status(404).json({ ok: false, error: "소식을 찾을 수 없습니다." });
        }
        const built = buildFromBody(req.body || {});
        const errMsg = validateBuilt(built);
        if (errMsg) {
            return res.status(400).json({ ok: false, error: errMsg });
        }
        const doc = toDbDoc(id, built, existing, {});
        await getDb().collection(COL).replaceOne({ id: id }, doc);
        res.json({ ok: true, item: toPublic(doc) });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

router.delete("/:id", requireRole("admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const result = await getDb().collection(COL).deleteOne({ id: id });
        if (!result.deletedCount) {
            return res.status(404).json({ ok: false, error: "소식을 찾을 수 없습니다." });
        }
        await getDb().collection(COMMENT_COL).deleteMany({ snc_news_id: id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
