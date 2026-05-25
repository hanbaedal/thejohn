const { getDb } = require("../db");
const {
    loginLookupFilter,
    verifyLoginPassword,
    setLoginPassword,
    migrateCollectionLoginFields
} = require("./loginAccount");
const { verifyStaffPassword, isStaffRole } = require("./staff");
const { getCompanyName: getVendorCompanyName, parseGrade, F } = require("./vendorFields");

function vendorGradeFromDoc(vendor) {
    if (!vendor) return "1";
    const raw = vendor[F.grade] != null ? vendor[F.grade] : vendor.vn_grade;
    return parseGrade(raw) || "1";
}
const { getCompanyName: getStaffCompanyName } = require("./staffFields");

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

/** 옛 아이디 thejhon → thejohn (staff 시드는 thejohn) */
function resolveLoginIdForLookup(loginId) {
    const trimmed = String(loginId || "").trim();
    if (normalizeId(trimmed) === "thejhon") return "thejohn";
    return trimmed;
}

/** staff 컬렉션 — loginId로 1건 조회 */
async function findStaffByLoginId(loginId) {
    const resolved = resolveLoginIdForLookup(loginId);
    const idn = normalizeId(resolved);
    const clauses = [];
    const lf = loginLookupFilter(resolved);
    if (lf.$or) clauses.push.apply(clauses, lf.$or);
    else clauses.push(lf);
    if (idn === "thejohn") clauses.push({ id: "st_admin_thejohn" });
    if (idn === "aksangsa") clauses.push({ id: "st_admin_aksangsa" });

    return getDb()
        .collection("staff")
        .findOne({ active: { $ne: false }, $or: clauses });
}

/** vendors 컬렉션 — loginId로 1건 조회 */
async function findVendorByLoginId(loginId) {
    return getDb()
        .collection("vendors")
        .findOne(loginLookupFilter(resolveLoginIdForLookup(loginId)));
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
    const companyLabel = company || (staff.role === "supervisor" ? "(주)더존" : "");
    return {
        ok: true,
        role: staff.role,
        userId: staff.loginId,
        companyName: companyLabel,
        displayName: companyLabel || staff.loginId
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
        displayName: getVendorCompanyName(vendor) || vendor.loginId || "",
        vendorGrade: vendorGradeFromDoc(vendor)
    };
}

/**
 * staff · vendors 컬렉션에서 아이디를 찾고 비밀번호를 검증합니다.
 * 업체는 업체등록(vendors)에 저장된 loginId·password 로만 로그인합니다.
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

async function ensureLoginFieldsMigrated(db) {
    await migrateCollectionLoginFields(db, "staff");
    /** vendors는 vendorFields.migrateVendorsCollection 이 password·loginIdNorm 스키마를 유지합니다 */
}

module.exports = {
    normalizeId,
    findStaffByLoginId,
    findVendorByLoginId,
    lookupStaffAndVendor,
    resolveFormLogin,
    ensureLoginFieldsMigrated
};
