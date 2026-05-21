const express = require("express");
const { requireRole } = require("../middleware/auth");
const { createStaffAccount } = require("../lib/staff");
const { getDb } = require("../db");
const { sensitiveLoginProjection } = require("../lib/loginAccount");
const { toPublic } = require("../lib/staffFields");

const router = express.Router();

/** 관리자 계정 추가 */
router.post("/", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const result = await createStaffAccount(
            {
                loginId: req.body.loginId,
                password: req.body.password,
                role: "admin",
                st_company: req.body.st_company,
                st_ceo: req.body.st_ceo,
                st_ceo_tel: req.body.st_ceo_tel,
                name: req.body.name
            },
            req.auth.role
        );
        res.status(201).json({ ok: true, staff: result });
    } catch (e) {
        const msg = e.message || "관리자 추가에 실패했습니다.";
        const code = msg.includes("이미") ? 409 : msg.includes("권한") ? 403 : 400;
        res.status(code).json({ ok: false, error: msg });
    }
});

router.get("/", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const items = await getDb()
            .collection("staff")
            .find({ active: { $ne: false } })
            .project(sensitiveLoginProjection)
            .sort({ role: 1, loginId: 1 })
            .toArray();
        res.json({ ok: true, items: items.map(toPublic) });
    } catch (e) {
        console.error("GET /api/staff", e);
        res.status(500).json({ ok: false, error: "목록을 불러오지 못했습니다." });
    }
});

module.exports = router;
