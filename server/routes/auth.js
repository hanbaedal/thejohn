const express = require("express");
const { signToken, extractBearer, verifyToken } = require("../middleware/auth");
const { normalizeId, resolveFormLogin, findVendorByLoginId } = require("../lib/loginResolve");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "").trim();
        if (!loginId || !password) {
            return res.status(400).json({ ok: false, error: "아이디와 비밀번호를 입력해 주세요." });
        }

        const result = await resolveFormLogin(loginId, password);
        if (!result.ok) {
            if (result.reason === "NOT_REGISTERED") {
                const hint =
                    "업체등록에서 만든 아이디·비밀번호로 로그인해 주세요. 등록되지 않은 아이디면 관리자에게 문의하세요.";
                return res.status(404).json({
                    ok: false,
                    code: "NOT_REGISTERED",
                    error: "더존 관리자에게 회원 등록을 요청해야 합니다.",
                    hint: hint
                });
            }
            const vendorDoc = await findVendorByLoginId(loginId);
            const hint = vendorDoc
                ? "업체등록 시 설정한 비밀번호(8~16자)를 그대로 입력해 주세요. 아이디·비밀번호 앞뒤 공백은 제외됩니다."
                : "아이디와 비밀번호를 다시 확인해 주세요.";
            return res.status(401).json({
                ok: false,
                code: "BAD_PASSWORD",
                error: "아이디 또는 비밀번호가 올바르지 않습니다.",
                hint: hint
            });
        }

        const tokenPayload = { role: result.role, userId: result.userId };
        if (result.vendorGrade) tokenPayload.vendorGrade = result.vendorGrade;
        if (result.vendorRegisteredBy) tokenPayload.vendorRegisteredBy = result.vendorRegisteredBy;
        if (result.vendorOrderEnabled) tokenPayload.vendorOrderEnabled = true;
        const token = signToken(tokenPayload);
        return res.json({
            ok: true,
            role: result.role,
            userId: result.userId,
            companyName: result.companyName || "",
            displayName: result.companyName || result.displayName || result.userId,
            vendorGrade: result.vendorGrade || "",
            vendorRegisteredBy: result.vendorRegisteredBy || "",
            vendorRegisteredByName: result.vendorRegisteredByName || "",
            vendorOrderEnabled: !!result.vendorOrderEnabled,
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
            userId: payload.userId,
            vendorGrade: payload.vendorGrade || "",
            vendorRegisteredBy: payload.vendorRegisteredBy || "",
            vendorOrderEnabled: !!payload.vendorOrderEnabled
        });
    } catch (e) {
        return res.json({ ok: true, loggedIn: false, error: "세션이 만료되었습니다." });
    }
});

module.exports = router;
