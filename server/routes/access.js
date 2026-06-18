const express = require("express");
const { getDb } = require("../db");
const { extractBearer, verifyToken } = require("../middleware/auth");
const { logPageView } = require("../lib/accessLog");

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
