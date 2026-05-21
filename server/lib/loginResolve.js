const { getDb } = require("../db");
const { verifyStoredPassword, setPlainPassword } = require("./passwordStore");
const {
    verifyStaffPassword,
    isStaffRole,
    isReservedStaffLoginId
} = require("./staff");

const GUEST_ID = "guest";

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

/** staff · vendors 컬렉션 동시 조회 (슈퍼바이저 로그인 오류 방지) */
async function lookupStaffAndVendor(loginId) {
    const idn = normalizeId(loginId);
    const db = getDb();
    const [staff, vendor] = await Promise.all([
        db.collection("staff").findOne({ loginIdNorm: idn, active: { $ne: false } }),
        db.collection("vendors").findOne({ loginIdNorm: idn })
    ]);
    return { staff, vendor, idn };
}

/**
 * guest 제외 폼 로그인
 * 1) staff·vendors 병렬 조회
 * 2) staff(슈퍼바이저/관리자) 비밀번호 확인
 * 3) vendors 업체 비밀번호 확인
 * 4) 예약 아이디 + 레거시 env (둘 다 실패 시)
 */
async function resolveFormLogin(loginId, password) {
    const { staff, vendor } = await lookupStaffAndVendor(loginId);

    if (staff && isStaffRole(staff.role)) {
        const valid = await verifyStaffPassword(staff, password);
        if (valid) {
            return {
                ok: true,
                role: staff.role,
                userId: staff.loginId,
                companyName: staff.role === "supervisor" ? "슈퍼바이저" : "(주)더존",
                displayName: staff.name || staff.loginId
            };
        }
    }

    if (vendor) {
        const vendors = getDb().collection("vendors");
        const vendorCheck = await verifyStoredPassword(vendor, password);
        if (vendorCheck.valid) {
            if (vendorCheck.migratePlain != null) {
                await setPlainPassword(vendors, { id: vendor.id }, vendorCheck.migratePlain);
            }
            return {
                ok: true,
                role: "vendor",
                userId: vendor.loginId,
                companyName: String(vendor.companyName || "").trim(),
                displayName: String(vendor.companyName || vendor.loginId || "").trim()
            };
        }
    }

    if (isReservedStaffLoginId(loginId)) {
        const legacyPw = String(process.env.THEJHON_ADMIN_PASSWORD || "").trim();
        if (legacyPw && password === legacyPw) {
            return {
                ok: true,
                role: "admin",
                userId: loginId,
                companyName: "(주)더존",
                displayName: loginId
            };
        }
    }

    return { ok: false };
}

function resolveGuestLogin(password) {
    const guestPw = String(process.env.THEJHON_GUEST_PASSWORD || "guest").trim();
    if (password !== guestPw) return { ok: false };
    return {
        ok: true,
        role: "guest",
        userId: GUEST_ID,
        companyName: "",
        displayName: ""
    };
}

module.exports = {
    GUEST_ID,
    normalizeId,
    lookupStaffAndVendor,
    resolveFormLogin,
    resolveGuestLogin
};
