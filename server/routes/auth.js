const express = require("express");
const { signToken, extractBearer, verifyToken, requireRole } = require("../middleware/auth");
const { getDb, isDbReady } = require("../db");
const { resolveFormLogin, findVendorByLoginId, findStaffByLoginId } = require("../lib/loginResolve");
const { findStaffById } = require("../lib/staff");
const { toPublic, F: VF, getCompanyName: getVendorCompanyName } = require("../lib/vendorFields");
const {
    toPublic: toPublicStaff,
    staffOrderEnabledFromDoc,
    getCompanyName: getStaffCompanyName
} = require("../lib/staffFields");
const { vendorCanPlaceOrders } = require("../lib/orderAccess");
const { findStaffByRegisteredBy } = require("../lib/staffRegisteredBy");
const { logStaffLogin, logVendorLogin } = require("../lib/accessLog");
const {
    assertCanStartLogin,
    assignLoginSession,
    verifyAuthSession,
    clearLoginSession,
    sessionEnforced
} = require("../lib/sessionControl");

const router = express.Router();

function normalizeFooterStaffLoginId(loginIdRaw) {
    var id = String(loginIdRaw || "thejohn").trim();
    var idn = id.toLowerCase();
    return idn === "thejhon" ? "thejohn" : id || "thejohn";
}

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
            if (result.reason === "VENDOR_NO_PASSWORD") {
                return res.status(401).json({
                    ok: false,
                    code: "VENDOR_NO_PASSWORD",
                    error: "비밀번호가 설정되지 않은 업체 계정입니다.",
                    hint: "관리자에게 업체 수정 화면에서 비밀번호를 다시 설정해 달라고 요청해 주세요."
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
        if (result.staffOrderEnabled) tokenPayload.staffOrderEnabled = true;

        if (isDbReady()) {
            const sessionGate = await assertCanStartLogin(result.role, result.userId);
            if (!sessionGate.ok) {
                const status = sessionGate.code === "ALREADY_LOGGED_IN" ? 409 : 403;
                return res.status(status).json({
                    ok: false,
                    code: sessionGate.code,
                    error: sessionGate.error,
                    activeSessions: sessionGate.activeSessions,
                    maxSessions: sessionGate.maxSessions
                });
            }
            if (sessionEnforced(result.role)) {
                const sid = await assignLoginSession(result.role, result.userId, sessionGate.resolved);
                if (sid) tokenPayload.sid = sid;
            }
        }

        const token = signToken(tokenPayload);
        try {
            if (!isDbReady()) throw new Error("DB not ready");
            const db = getDb();
            if (result.role === "vendor") {
                await logVendorLogin(
                    db,
                    result.userId,
                    result.vendorRegisteredBy || "",
                    result.companyName || result.userId
                );
            } else if (result.role === "admin" || result.role === "supervisor") {
                await logStaffLogin(
                    db,
                    result.role,
                    result.userId,
                    result.companyName || result.displayName || result.userId
                );
            }
        } catch (logErr) {
            console.warn("[thejohn] login access log:", logErr.message);
        }
        return res.json({
            ok: true,
            role: result.role,
            userId: result.userId,
            companyName: result.companyName || "",
            displayName: result.companyName || result.displayName || result.userId,
            vendorGrade: result.vendorGrade || "",
            vendorRegisteredBy: result.vendorRegisteredBy || "",
            vendorRegisteredByName: result.vendorRegisteredByName || result.brandCompanyName || "",
            brandCompanyName: result.brandCompanyName || result.vendorRegisteredByName || "",
            vendorOrderEnabled: !!result.vendorOrderEnabled,
            staffOrderEnabled: !!result.staffOrderEnabled,
            vendorMgrName: result.vendorMgrName || "",
            vendorMgrTel: result.vendorMgrTel || "",
            vendorMgrEmail: result.vendorMgrEmail || "",
            stLogo: result.stLogo || "",
            token
        });
    } catch (e) {
        console.error("POST /api/auth/login", e);
        return res.status(500).json({ ok: false, error: "로그인 처리 중 오류가 발생했습니다." });
    }
});

/** 업체 로그인 — 장바구니·주문 담당자 표시용 (비밀번호 제외) */
router.get("/vendor-profile", requireRole("vendor"), async function (req, res) {
    try {
        const vendor = await findVendorByLoginId(req.auth.userId || "");
        if (!vendor) {
            return res.status(404).json({ ok: false, error: "업체 정보를 찾을 수 없습니다." });
        }
        return res.json({ ok: true, item: toPublic(vendor) });
    } catch (e) {
        console.error("GET /api/auth/vendor-profile", e);
        return res.status(500).json({ ok: false, error: "업체 정보를 불러오지 못했습니다." });
    }
});

/** 비로그인 푸터 — 기본 staff(기본 thejohn, 환경변수 DEFAULT_FOOTER_STAFF_ID로 변경) */
router.get("/public-footer-staff", async function (_req, res) {
    try {
        var loginHint = normalizeFooterStaffLoginId(
            process.env.DEFAULT_FOOTER_STAFF_ID || "thejohn"
        );
        var staff = await findStaffByLoginId(loginHint);
        if (!staff) {
            return res.status(404).json({ ok: false, error: "기본 관리자 정보를 찾을 수 없습니다." });
        }
        return res.json({ ok: true, item: toPublicStaff(staff) });
    } catch (e) {
        console.error("GET /api/auth/public-footer-staff", e);
        return res.status(500).json({ ok: false, error: "관리자 정보를 불러오지 못했습니다." });
    }
});

/** 로그인 사용자 footer — staff 컬렉션 (관리자·슈퍼바이저: 본인, 업체: 등록 담당 관리자) */
router.get("/staff-profile", requireRole("admin", "supervisor", "vendor"), async function (req, res) {
    try {
        let staffLoginId = "";
        if (req.auth.role === "vendor") {
            const vendor = await findVendorByLoginId(req.auth.userId || "");
            if (!vendor) {
                return res.status(404).json({ ok: false, error: "업체 정보를 찾을 수 없습니다." });
            }
            staffLoginId = String(vendor[VF.registeredBy] || req.auth.vendorRegisteredBy || "").trim();
            if (!staffLoginId) {
                return res.status(404).json({ ok: false, error: "등록 담당 관리자 정보가 없습니다." });
            }
        } else {
            staffLoginId = String(req.auth.userId || "").trim();
        }

        let staff = await findStaffById(staffLoginId);
        if (!staff) staff = await findStaffByLoginId(staffLoginId);
        if (!staff) staff = await findStaffByRegisteredBy(staffLoginId);
        if (!staff) {
            return res.status(404).json({ ok: false, error: "관리자 정보를 찾을 수 없습니다." });
        }
        return res.json({ ok: true, item: toPublicStaff(staff) });
    } catch (e) {
        console.error("GET /api/auth/staff-profile", e);
        return res.status(500).json({ ok: false, error: "관리자 정보를 불러오지 못했습니다." });
    }
});

router.post("/logout", async function (req, res) {
    try {
        const token = extractBearer(req);
        if (token && isDbReady()) {
            try {
                const payload = verifyToken(token);
                await clearLoginSession(payload);
            } catch (e) {}
        }
        return res.json({ ok: true });
    } catch (e) {
        console.error("POST /api/auth/logout", e);
        return res.status(500).json({ ok: false, error: "로그아웃 처리 중 오류가 발생했습니다." });
    }
});

router.get("/session", async function (req, res) {
    const token = extractBearer(req);
    if (!token) {
        return res.json({ ok: true, loggedIn: false, error: "토큰 없음" });
    }
    try {
        const payload = verifyToken(token);
        if (sessionEnforced(payload.role) && isDbReady()) {
            const valid = await verifyAuthSession(payload);
            if (!valid) {
                return res.json({
                    ok: true,
                    loggedIn: false,
                    code: "SESSION_INVALID",
                    error: "다른 곳에서 로그인되었거나 접속이 종료되었습니다."
                });
            }
        }
        var vendorOrderEnabled = !!payload.vendorOrderEnabled;
        var staffOrderEnabled = !!payload.staffOrderEnabled;
        var companyName = "";
        var brandCompanyName = "";
        var displayName = "";
        if (isDbReady()) {
            try {
                if (payload.role === "vendor") {
                    const vendor = await findVendorByLoginId(payload.userId || "");
                    vendorOrderEnabled = !!(vendor && (await vendorCanPlaceOrders(vendor)));
                    if (vendor) {
                        companyName = getVendorCompanyName(vendor);
                        brandCompanyName = String(vendor[VF.registeredByName] || "").trim();
                        if (!brandCompanyName) {
                            const regBy = String(
                                vendor[VF.registeredBy] || payload.vendorRegisteredBy || ""
                            ).trim();
                            if (regBy) {
                                let adminStaff = await findStaffByLoginId(regBy);
                                if (!adminStaff) adminStaff = await findStaffByRegisteredBy(regBy);
                                if (adminStaff) {
                                    brandCompanyName = getStaffCompanyName(adminStaff) || "";
                                }
                            }
                        }
                        displayName = companyName || payload.userId || "";
                    }
                } else if (payload.role === "admin" || payload.role === "supervisor") {
                    const staff = await findStaffByLoginId(payload.userId || "");
                    staffOrderEnabled = staffOrderEnabledFromDoc(staff);
                    if (staff) {
                        companyName = getStaffCompanyName(staff);
                        brandCompanyName = companyName;
                        displayName = companyName || payload.userId || "";
                    }
                }
            } catch (refreshErr) {
                console.warn("[auth] session permission refresh:", refreshErr.message);
            }
        }
        return res.json({
            ok: true,
            loggedIn: true,
            role: payload.role,
            userId: payload.userId,
            vendorGrade: payload.vendorGrade || "",
            vendorRegisteredBy: payload.vendorRegisteredBy || "",
            vendorOrderEnabled: vendorOrderEnabled,
            staffOrderEnabled: staffOrderEnabled,
            companyName: companyName,
            brandCompanyName: brandCompanyName,
            displayName: displayName
        });
    } catch (e) {
        return res.json({ ok: true, loggedIn: false, error: "세션이 만료되었습니다." });
    }
});

module.exports = router;
