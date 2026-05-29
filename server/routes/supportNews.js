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

const { findStaffByLoginId } = require("../lib/loginResolve");

const router = express.Router();
const COL = "support_news";

function newId() {
    return "sn_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

async function staffMeta(auth) {
    const createdBy = String((auth && auth.userId) || "").trim();
    let createdByName = createdBy;
    if (createdBy) {
        try {
            const staff = await findStaffByLoginId(createdBy);
            if (staff) {
                const name = String(staff.st_ceo || staff.name || "").trim();
                if (name) createdByName = name;
            }
        } catch (e) {
            /* ignore */
        }
    }
    return { createdBy: createdBy, createdByName: createdByName };
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
            return res.status(404).json({ ok: false, error: "소식을 찾을 수 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
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
        const id = newId();
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
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
