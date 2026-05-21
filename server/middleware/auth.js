const jwt = require("jsonwebtoken");

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
        try {
            const payload = jwt.verify(token, getJwtSecret());
            if (roles.length && !roles.includes(payload.role)) {
                return res.status(403).json({ ok: false, error: "권한이 없습니다." });
            }
            req.auth = payload;
            next();
        } catch (e) {
            return res.status(401).json({ ok: false, error: "세션이 만료되었거나 유효하지 않습니다." });
        }
    };
}

module.exports = { signToken, extractBearer, requireRole };
