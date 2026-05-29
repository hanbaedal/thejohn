const jwt = require("jsonwebtoken");
const { isDbReady } = require("../db");
const { verifyAuthSession, sessionEnforced } = require("../lib/sessionControl");

function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s || s.length < 16) {
        throw new Error("JWT_SECRET(16자 이상)을 .env에 설정하세요.");
    }
    return s;
}

function signToken(payload) {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

function extractBearer(req) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer ")) return h.slice(7).trim();
    return "";
}

function requireRole(...roles) {
    return function (req, res, next) {
        const token = extractBearer(req);
        if (!token) {
            return res.status(401).json({ ok: false, error: "로그인이 필요합니다." });
        }
        let payload;
        try {
            payload = jwt.verify(token, getJwtSecret());
        } catch (e) {
            return res.status(401).json({ ok: false, error: "세션이 만료되었거나 유효하지 않습니다." });
        }
        if (roles.length && !roles.includes(payload.role)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        if (!sessionEnforced(payload.role)) {
            req.auth = payload;
            return next();
        }
        if (!isDbReady()) {
            req.auth = payload;
            return next();
        }
        verifyAuthSession(payload)
            .then(function (valid) {
                if (!valid) {
                    return res.status(401).json({
                        ok: false,
                        code: "SESSION_INVALID",
                        error: "다른 곳에서 로그인되었거나 접속이 종료되었습니다. 다시 로그인해 주세요."
                    });
                }
                req.auth = payload;
                next();
            })
            .catch(function () {
                return res.status(401).json({
                    ok: false,
                    code: "SESSION_INVALID",
                    error: "세션을 확인할 수 없습니다. 다시 로그인해 주세요."
                });
            });
    };
}

function verifyToken(token) {
    return jwt.verify(token, getJwtSecret());
}

module.exports = { signToken, extractBearer, requireRole, verifyToken, getJwtSecret };
