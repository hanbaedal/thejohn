const { getDb } = require("../db");
const {
    loginLookupFilter,
    verifyLoginPassword,
    verifyVendorLoginPassword,
    setLoginPassword,
    migrateCollectionLoginFields
} = require("./loginAccount");
const { verifyStaffPassword, isStaffRole } = require("./staff");
const { getCompanyName: getVendorCompanyName, parseGrade, F: VF } = require("./vendorFields");
const { vendorCanPlaceOrders } = require("./orderAccess");

function vendorGradeFromDoc(vendor) {
    if (!vendor) return "1";
    const raw = vendor[VF.grade] != null ? vendor[VF.grade] : vendor.vn_grade;
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
    if (idn === "hanbaedal") clauses.push({ id: "st_supervisor_hanbaedal" });

    return getDb()
        .collection("staff")
        .findOne({ active: { $ne: false }, $or: clauses });
}

/** vendors 컬렉션 — loginId로 1건 조회 (loginIdNorm·대소문자 혼용 지원) */
async function findVendorByLoginId(loginId) {
    const resolved = resolveLoginIdForLookup(loginId);
    const trimmed = String(resolved || "").trim();
    const idn = normalizeId(resolved);
    if (!trimmed) return null;

    const clauses = [{ loginIdNorm: idn }];
    const lf = loginLookupFilter(resolved);
    if (lf.$or) clauses.push.apply(clauses, lf.$or);
    else if (lf.loginId) clauses.push({ loginId: lf.loginId });

    const db = getDb();
    const filter = { $or: clauses };
    const vendor = await db.collection("vendors").findOne(filter);
    if (vendor) return vendor;
    return db.collection("vendor_prospects").findOne(filter);
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
    const companyLabel = company || "";
    return {
        ok: true,
        role: staff.role || "admin",
        userId: staff.loginId,
        companyName: companyLabel,
        displayName: companyLabel || staff.loginId
    };
}

async function tryVendorLogin(vendor, loginId, password) {
    if (!vendor) return null;

    const vendorCheck = await verifyVendorLoginPassword(vendor, loginId, password);
    if (!vendorCheck.valid) return null;

    if (vendorCheck.migratePassword != null) {
        const db = getDb();
        const inProspects =
            String(vendor.id || "").indexOf("vp_") === 0 ||
            String(vendor.vn_record_type || "")
                .trim()
                .toLowerCase() === "new";
        const col = inProspects ? db.collection("vendor_prospects") : db.collection("vendors");
        await setLoginPassword(col, { id: vendor.id }, loginId, vendorCheck.migratePassword);
    }

    const regBy = String(vendor[VF.registeredBy] || "").trim();
    return {
        ok: true,
        role: "vendor",
        userId: vendor.loginId,
        companyName: getVendorCompanyName(vendor),
        displayName: getVendorCompanyName(vendor) || vendor.loginId || "",
        vendorGrade: vendorGradeFromDoc(vendor),
        vendorRegisteredBy: regBy,
        vendorRegisteredByName: String(vendor[VF.registeredByName] || "").trim(),
        vendorOrderEnabled: vendorCanPlaceOrders(vendor),
        vendorMgrName: String(vendor[VF.mgrName] || "").trim(),
        vendorMgrTel: String(vendor[VF.mgrTel] || "").trim(),
        vendorMgrEmail: String(vendor[VF.mgrEmail] || "").trim()
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

    if (hasVendorAccount) {
        const vendorResult = await tryVendorLogin(vendor, loginId, password);
        if (vendorResult) return vendorResult;
    }

    const staffResult = await tryStaffLogin(staff, loginId, password);
    if (staffResult) return staffResult;

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
