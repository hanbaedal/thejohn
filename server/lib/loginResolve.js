const { getDb } = require("../db");
const {
    loginLookupFilter,
    verifyLoginPassword,
    setLoginPassword,
    migrateCollectionLoginFields
} = require("./loginAccount");
const { verifyStaffPassword, isStaffRole } = require("./staff");
const { getCompanyName: getVendorCompanyName } = require("./vendorFields");
const { getCompanyName: getStaffCompanyName, getCeoName: getStaffCeoName } = require("./staffFields");

const GUEST_ID = "guest";

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

/** staff 컬렉션 — loginId로 1건 조회 */
async function findStaffByLoginId(loginId) {
    const filter = Object.assign({ active: { $ne: false } }, loginLookupFilter(loginId));
    return getDb().collection("staff").findOne(filter);
}

/** vendors 컬렉션 — loginId로 1건 조회 */
async function findVendorByLoginId(loginId) {
    return getDb().collection("vendors").findOne(loginLookupFilter(loginId));
}

/** staff · vendors 동시 조회 */
async function lookupStaffAndVendor(loginId) {
    const [staff, vendor] = await Promise.all([
        findStaffByLoginId(loginId),
        findVendorByLoginId(loginId)
    ]);
    return { staff, vendor };
}

async function tryStaffLogin(staff, loginId, password) {
    if (!staff || !isStaffRole(staff.role)) return null;

    const valid = await verifyStaffPassword(staff, loginId, password);
    if (!valid) return null;

    const company = getStaffCompanyName(staff);
    const ceo = getStaffCeoName(staff);
    return {
        ok: true,
        role: staff.role,
        userId: staff.loginId,
        companyName: company || (staff.role === "supervisor" ? "(주)더존" : ""),
        displayName: ceo || staff.loginId
    };
}

async function tryVendorLogin(vendor, loginId, password) {
    if (!vendor) return null;

    const vendorCheck = await verifyLoginPassword(vendor, loginId, password);
    if (!vendorCheck.valid) return null;

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
        companyName: getVendorCompanyName(vendor),
        displayName: getVendorCompanyName(vendor) || vendor.loginId || ""
    };
}

/**
 * staff · vendors 컬렉션에서 아이디를 찾고 비밀번호를 검증합니다.
 * (게스트·환경 변수 관리자 비밀번호는 사용하지 않음)
 */
async function resolveFormLogin(loginId, password) {
    const { staff, vendor } = await lookupStaffAndVendor(loginId);
    const hasStaffAccount = !!(staff && isStaffRole(staff.role));
    const hasVendorAccount = !!vendor;

    const staffResult = await tryStaffLogin(staff, loginId, password);
    if (staffResult) return staffResult;

    const vendorResult = await tryVendorLogin(vendor, loginId, password);
    if (vendorResult) return vendorResult;

    if (!hasStaffAccount && !hasVendorAccount) {
        return { ok: false, reason: "NOT_REGISTERED" };
    }

    return { ok: false, reason: "BAD_PASSWORD" };
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

async function ensureLoginFieldsMigrated(db) {
    await migrateCollectionLoginFields(db, "staff");
    await migrateCollectionLoginFields(db, "vendors");
}

module.exports = {
    GUEST_ID,
    normalizeId,
    findStaffByLoginId,
    findVendorByLoginId,
    lookupStaffAndVendor,
    resolveFormLogin,
    resolveGuestLogin,
    ensureLoginFieldsMigrated
};
