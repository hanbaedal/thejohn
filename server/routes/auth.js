const express = require("express");
const { signToken } = require("../middleware/auth");
const { normalizeId, resolveFormLogin, resolveGuestLogin } = require("../lib/loginResolve");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "");
        const idn = normalizeId(loginId);

        if (!loginId || !password) {
            return res.status(400).json({ ok: false, error: "아이디와 비밀번호를 입력해 주세요." });
        }

        if (idn === normalizeId("guest")) {
            const guest = resolveGuestLogin(password);
            if (!guest.ok) {
                return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
            }
            const token = signToken({ role: guest.role, userId: guest.userId });
            return res.json({ ok: true, role: guest.role, userId: guest.userId, companyName: guest.companyName, token });
        }

        const result = await resolveFormLogin(loginId, password);
        if (!result.ok) {
            return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
        }

        const token = signToken({ role: result.role, userId: result.userId });
        return res.json({
            ok: true,
            role: result.role,
            userId: result.userId,
            companyName: result.companyName || "",
            displayName: result.displayName || result.userId,
            token
        });
    } catch (e) {
        console.error("POST /api/auth/login", e);
        return res.status(500).json({ ok: false, error: "로그인 처리 중 오류가 발생했습니다." });
    }
});

module.exports = router;
