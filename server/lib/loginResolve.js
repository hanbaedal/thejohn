const { getDb } = require("../db");
const {
    loginLookupFilter,
    verifyLoginPassword,
    setLoginPassword
} = require("./loginAccount");
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

/** staff · vendors 동시 조회 (loginId 기준) */
async function lookupStaffAndVendor(loginId) {
    const db = getDb();
    const staffFilter = Object.assign({ active: { $ne: false } }, loginLookupFilter(loginId));
    const [staff, vendor] = await Promise.all([
        db.collection("staff").findOne(staffFilter),
        db.collection("vendors").findOne(loginLookupFilter(loginId))
    ]);
    return { staff, vendor };
}

async function resolveFormLogin(loginId, password) {
    const { staff, vendor } = await lookupStaffAndVendor(loginId);

    if (staff && isStaffRole(staff.role)) {
        const valid = await verifyStaffPassword(staff, loginId, password);
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
        const vendorCheck = await verifyLoginPassword(vendor, loginId, password);
        if (vendorCheck.valid) {
            if (vendorCheck.migratePassword != null) {
                await setLoginPassword(
                    getDb().collection("vendors"),
                    { id: vendor.id },
                    loginId,
                    vendorCheck.migratePassword
                );
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
