const { extractBearer, verifyToken } = require("./auth");
const { isSupervisorAuth } = require("../lib/vendorAccess");

/** 레거시: role supervisor 전용 (thejohn 은 admin 과 동일 — 신규 코드는 requireRole 사용) */
function requireSupervisor(req, res, next) {
    const token = extractBearer(req);
    if (!token) {
        return res.status(401).json({ ok: false, error: "로그인이 필요합니다." });
    }
    try {
        const payload = verifyToken(token);
        req.auth = payload;
        if (!isSupervisorAuth(payload)) {
            return res.status(403).json({
                ok: false,
                error: "이 기능을 사용할 권한이 없습니다."
            });
        }
        next();
    } catch (e) {
        return res.status(401).json({
            ok: false,
            error: "세션이 만료되었거나 유효하지 않습니다."
        });
    }
}

module.exports = { requireSupervisor };
