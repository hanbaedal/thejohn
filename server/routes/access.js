const express = require("express");
const { getDb } = require("../db");
const { extractBearer, verifyToken } = require("../middleware/auth");
const { logPageView, logGuestLogin } = require("../lib/accessLog");

const router = express.Router();

function optionalAuth(req) {
    var token = extractBearer(req);
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

function guestAuthFromBody(body) {
    var guestId = String((body && body.guestId) || "").trim();
    if (!guestId || guestId.length > 80) return null;
    return { role: "guest", userId: guestId };
}

/** login.html 게스트 로그인 — 접속 통계 */
router.post("/guest-login", async function (req, res) {
    try {
        var guestId = String((req.body && req.body.guestId) || "").trim();
        if (!guestId || guestId.length > 80) {
            return res.status(400).json({ ok: false, error: "게스트 정보가 없습니다." });
        }
        await logGuestLogin(getDb(), guestId);
        return res.json({ ok: true });
    } catch (e) {
        console.error("POST /api/access/guest-login", e);
        return res.status(500).json({ ok: false, error: "게스트 접속 기록에 실패했습니다." });
    }
});

router.post("/page-view", async function (req, res) {
    try {
        var page = String((req.body && req.body.page) || "").trim();
        if (!page || page.length > 120) {
            return res.status(400).json({ ok: false, error: "페이지 정보가 없습니다." });
        }
        var auth = optionalAuth(req);
        if (!auth) {
            auth = { role: "public", userId: "" };
        }
        await logPageView(getDb(), auth, page);
        return res.json({ ok: true });
    } catch (e) {
        console.error("POST /api/access/page-view", e);
        return res.status(500).json({ ok: false, error: "접속 기록에 실패했습니다." });
    }
});

module.exports = router;
