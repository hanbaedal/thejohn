const express = require("express");
const { getDb } = require("../db");
const { loginLookupFilter } = require("../lib/loginAccount");
const { requireRole } = require("../middleware/auth");
const { isReservedStaffLoginId } = require("../lib/staff");
const {
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    validateLoginIdLength
} = require("../lib/vendorFields");

const router = express.Router();

function newId() {
    return "vr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function isReservedAdminLoginId(loginId) {
    return isReservedStaffLoginId(loginId);
}

async function findDuplicateVendor(vendors, loginId, excludeId) {
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return vendors.findOne(filter);
}

async function findStaffLoginConflict(loginId) {
    return getDb().collection("staff").findOne(loginLookupFilter(loginId));
}

router.get("/", async (req, res) => {
    try {
        const items = await getDb()
            .collection("vendors")
            .find({})
            .sort({ updatedAt: -1 })
            .toArray();
        res.json({ ok: true, items: items.map(toPublic) });
    } catch (e) {
        console.error("GET /api/vendors", e);
        res.status(500).json({ ok: false, error: "업체 목록을 불러오지 못했습니다." });
    }
});

router.get("/check-login-id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const loginId = String(req.query.loginId || "").trim();
        const excludeId = req.query.excludeId ? String(req.query.excludeId) : "";
        if (!loginId) {
            return res.json({ ok: true, duplicate: false });
        }
        const fmt = validateLoginIdLength(loginId);
        if (fmt) {
            return res.json({ ok: true, duplicate: false, invalid: true, error: fmt });
        }
        if (isReservedAdminLoginId(loginId)) {
            return res.json({
                ok: true,
                duplicate: true,
                reserved: true,
                error: "사용할 수 없는 아이디입니다."
            });
        }
        if (await findStaffLoginConflict(loginId)) {
            return res.json({
                ok: true,
                duplicate: true,
                error: "이미 관리자(staff)에 사용 중인 아이디입니다."
            });
        }
        const dup = await findDuplicateVendor(getDb().collection("vendors"), loginId, excludeId);
        res.json({
            ok: true,
            duplicate: !!dup,
            error: dup ? "이미 사용 중인 아이디입니다." : ""
        });
    } catch (e) {
        console.error("GET /api/vendors/check-login-id", e);
        res.status(500).json({ ok: false, error: "아이디 중복 확인에 실패했습니다." });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const doc = await getDb().collection("vendors").findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "업체를 찾을 수 없습니다." });
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/vendors/:id", e);
        res.status(500).json({ ok: false, error: "업체를 불러오지 못했습니다." });
    }
});

router.post("/", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "");

        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const built = buildFromBody(req.body, null, loginId, password);
        const err = validateBuilt(built, true);
        if (err) return res.status(400).json({ ok: false, error: err });

        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }

        const vendors = getDb().collection("vendors");
        const dup = await findDuplicateVendor(vendors, loginId);
        if (dup) return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });

        const doc = toDbDoc(newId(), built, null);
        await vendors.insertOne(doc);
        console.log("[vendors] inserted:", doc.id, doc.loginId, doc.vn_company);
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/vendors", e);
        res.status(500).json({ ok: false, error: "업체 저장에 실패했습니다." });
    }
});

router.put("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const id = req.params.id;
        const vendors = getDb().collection("vendors");
        const existing = await vendors.findOne({ id });
        if (!existing) return res.status(404).json({ ok: false, error: "업체를 찾을 수 없습니다." });

        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "");

        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const built = buildFromBody(req.body, existing, loginId, password);
        const err = validateBuilt(built, false);
        if (err) return res.status(400).json({ ok: false, error: err });

        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }

        const dup = await findDuplicateVendor(vendors, loginId, id);
        if (dup) return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });

        const doc = toDbDoc(id, built, existing);
        await vendors.replaceOne({ id }, doc);
        console.log("[vendors] updated:", doc.id, doc.loginId);
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("PUT /api/vendors/:id", e);
        res.status(500).json({ ok: false, error: "업체 수정에 실패했습니다." });
    }
});

router.delete("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const result = await getDb().collection("vendors").deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ ok: false, error: "업체를 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/vendors/:id", e);
        res.status(500).json({ ok: false, error: "업체 삭제에 실패했습니다." });
    }
});

module.exports = router;
