const express = require("express");
const { getDb } = require("../db");
const { normalizePasswordInput, decodePasswordFromAscii } = require("../lib/passwordStore");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

function newId() {
    return "vr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

const { isReservedStaffLoginId } = require("../lib/staff");

function isReservedAdminLoginId(idn) {
    return isReservedStaffLoginId(idn);
}

function toPublic(doc) {
    if (!doc) return null;
    return {
        id: doc.id,
        loginId: doc.loginId || "",
        companyName: doc.companyName || "",
        ceo: doc.ceo || "",
        ceoPhone: doc.ceoPhone || "",
        bizNo: doc.bizNo || "",
        manager: doc.manager || "",
        managerPhone: doc.managerPhone || "",
        website: doc.website || "",
        email: doc.email || "",
        address: doc.address || "",
        logo: doc.logo || "",
        note: doc.note || "",
        updatedAt: doc.updatedAt || 0
    };
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
        const companyName = String(req.body.companyName || "").trim();
        const idn = normalizeId(loginId);

        if (!loginId) return res.status(400).json({ ok: false, error: "아이디를 입력해 주세요." });
        if (isReservedAdminLoginId(idn)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }
        if (!password || password.length < 4) {
            return res.status(400).json({ ok: false, error: "비밀번호는 4자 이상으로 입력해 주세요." });
        }
        if (!companyName) return res.status(400).json({ ok: false, error: "업체명을 입력해 주세요." });

        const vendors = getDb().collection("vendors");
        const dup = await vendors.findOne({ loginIdNorm: idn });
        if (dup) return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });

        const doc = {
            id: newId(),
            loginId,
            loginIdNorm: idn,
            password: normalizePasswordInput(password),
            companyName,
            ceo: String(req.body.ceo || "").trim(),
            ceoPhone: String(req.body.ceoPhone || "").trim(),
            bizNo: String(req.body.bizNo || "").trim(),
            manager: String(req.body.manager || "").trim(),
            managerPhone: String(req.body.managerPhone || "").trim(),
            website: String(req.body.website || "").trim(),
            email: String(req.body.email || "").trim(),
            address: String(req.body.address || "").trim(),
            logo: String(req.body.logo || ""),
            note: String(req.body.note || "").trim(),
            updatedAt: Date.now()
        };
        await vendors.insertOne(doc);
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
        const companyName = String(req.body.companyName || "").trim();
        const password = String(req.body.password || "");
        const idn = normalizeId(loginId);

        if (!loginId) return res.status(400).json({ ok: false, error: "아이디를 입력해 주세요." });
        if (isReservedAdminLoginId(idn)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }
        if (!companyName) return res.status(400).json({ ok: false, error: "업체명을 입력해 주세요." });

        const dup = await vendors.findOne({ loginIdNorm: idn, id: { $ne: id } });
        if (dup) return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });

        const doc = {
            id,
            loginId,
            loginIdNorm: idn,
            companyName,
            ceo: String(req.body.ceo || "").trim(),
            ceoPhone: String(req.body.ceoPhone || "").trim(),
            bizNo: String(req.body.bizNo || "").trim(),
            manager: String(req.body.manager || "").trim(),
            managerPhone: String(req.body.managerPhone || "").trim(),
            website: String(req.body.website || "").trim(),
            email: String(req.body.email || "").trim(),
            address: String(req.body.address || "").trim(),
            logo:
                req.body.logo !== undefined && req.body.logo !== null
                    ? String(req.body.logo)
                    : existing.logo || "",
            note: String(req.body.note || "").trim(),
            updatedAt: Date.now(),
            password: existing.password ? String(existing.password) : ""
        };

        if (password) {
            if (password.length < 4) {
                return res.status(400).json({ ok: false, error: "비밀번호는 4자 이상으로 입력해 주세요." });
            }
            doc.password = normalizePasswordInput(password);
        } else if (!doc.password && existing.passwordAscii) {
            doc.password = decodePasswordFromAscii(existing.passwordAscii);
        }

        await vendors.replaceOne({ id }, doc);
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
