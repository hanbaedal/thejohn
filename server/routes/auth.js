const express = require("express");
const { signToken, extractBearer, verifyToken } = require("../middleware/auth");
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
            if (result.reason === "NOT_REGISTERED") {
                const hint =
                    normalizeId(loginId) === "thejhon"
                        ? "아이디는 thejohn 입니다. (thejhon 은 옛 아이디입니다.)"
                        : "관리자 아이디 thejohn 또는 aksangsa 를 확인해 주세요.";
                return res.status(404).json({
                    ok: false,
                    code: "NOT_REGISTERED",
                    error: "더존 관리자에게 회원 등록을 요청해야 합니다.",
                    hint: hint
                });
            }
            return res.status(401).json({
                ok: false,
                code: "BAD_PASSWORD",
                error: "아이디 또는 비밀번호가 올바르지 않습니다."
            });
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

router.get("/session", function (req, res) {
    const token = extractBearer(req);
    if (!token) {
        return res.json({ ok: true, loggedIn: false, error: "토큰 없음" });
    }
    try {
        const payload = verifyToken(token);
        return res.json({
            ok: true,
            loggedIn: true,
            role: payload.role,
            userId: payload.userId
        });
    } catch (e) {
        return res.json({ ok: true, loggedIn: false, error: "세션이 만료되었습니다." });
    }
});

module.exports = router;
