const express = require("express");
const { requireRole } = require("../middleware/auth");
const { createStaffAccount, updateStaffAccount, deleteStaffAccount, findStaffById } = require("../lib/staff");
const { getDb } = require("../db");
const { sensitiveLoginProjection } = require("../lib/loginAccount");
const { toPublic } = require("../lib/staffFields");

const router = express.Router();

/** 슈퍼바이저 — 관리자 계정 추가 */
router.post("/", requireRole("supervisor"), async (req, res) => {
    try {
        const result = await createStaffAccount(req.body, req.auth.role);
        res.status(201).json({ ok: true, staff: result });
    } catch (e) {
        const msg = e.message || "관리자 추가에 실패했습니다.";
        const code = msg.includes("이미") ? 409 : msg.includes("권한") ? 403 : 400;
        res.status(code).json({ ok: false, error: msg });
    }
});

/** 관리자·슈퍼바이저 목록 (담당 필터 등) */
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

/** 슈퍼바이저 — 관리자 1건 조회 */
router.get("/:id", requireRole("supervisor"), async (req, res) => {
    try {
        const doc = await findStaffById(req.params.id);
        if (!doc || doc.active === false) {
            return res.status(404).json({ ok: false, error: "계정을 찾을 수 없습니다." });
        }
        res.json({ ok: true, staff: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/staff/:id", e);
        res.status(500).json({ ok: false, error: "조회에 실패했습니다." });
    }
});

/** 슈퍼바이저 — 관리자 정보 수정 */
router.put("/:id", requireRole("supervisor"), async (req, res) => {
    try {
        const result = await updateStaffAccount(req.params.id, req.body, req.auth.role);
        res.json({ ok: true, staff: result });
    } catch (e) {
        const msg = e.message || "수정에 실패했습니다.";
        const code = msg.includes("찾을") ? 404 : msg.includes("권한") ? 403 : 400;
        res.status(code).json({ ok: false, error: msg });
    }
});

/** 슈퍼바이저 — 관리자 삭제(비활성화) */
router.delete("/:id", requireRole("supervisor"), async (req, res) => {
    try {
        const result = await deleteStaffAccount(req.params.id, req.auth.role);
        res.json({ ok: true, ...result });
    } catch (e) {
        const msg = e.message || "삭제에 실패했습니다.";
        const code = msg.includes("찾을") ? 404 : msg.includes("권한") || msg.includes("삭제할 수 없") ? 403 : 400;
        res.status(code).json({ ok: false, error: msg });
    }
});

module.exports = router;
