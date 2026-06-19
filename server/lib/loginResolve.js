const { getDb } = require("../db");
const {
    verifyLoginPassword,
    verifyVendorLoginPassword,
    setLoginPassword,
    migrateCollectionLoginFields
} = require("./loginAccount");
const {
    findStaffByLoginId,
    findVendorByLoginId,
    findVendorDocsByLoginId,
    vendorAccountsHaveCredentials
} = require("./loginLookup");
const { verifyStaffPassword, isStaffRole } = require("./staff");
const { getCompanyName: getVendorCompanyName, parseGrade, F: VF } = require("./vendorFields");
const { vendorCanPlaceOrders } = require("./orderAccess");
const { findStaffByRegisteredBy } = require("./staffRegisteredBy");
const { vendorProfilesFromDocs } = require("./vendorLookup");
const { getCompanyName: getStaffCompanyName, staffOrderEnabledFromDoc, fromLegacyDoc, F: SF } = require("./staffFields");

function vendorGradeFromDoc(vendor) {
    if (!vendor) return "1";
    const raw = vendor[VF.grade] != null ? vendor[VF.grade] : vendor.vn_grade;
    return parseGrade(raw) || "1";
}

/** staff · vendors 동시 조회 */
async function lookupStaffAndVendor(loginId) {
    const [staff, vendorDocs] = await Promise.all([
        findStaffByLoginId(loginId, { login: true }),
        findVendorDocsByLoginId(loginId)
    ]);
    return { staff, vendorDocs, vendor: vendorDocs[0] || null };
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
        displayName: companyLabel || staff.loginId,
        staffOrderEnabled: staffOrderEnabledFromDoc(staff),
        stLogo: ""
    };
}

async function tryVendorLogin(vendor, loginId, password) {
    if (!vendor) return null;

    const vendorCheck = await verifyVendorLoginPassword(vendor, loginId, password);
    if (!vendorCheck.valid) return null;

    if (vendorCheck.migratePassword != null) {
        const db = getDb();
        const { collectionNameForVendorDoc } = require("./vendorCollections");
        const col = db.collection(collectionNameForVendorDoc(vendor));
        await setLoginPassword(col, { id: vendor.id }, loginId, vendorCheck.migratePassword);
    }

    const regBy = String(vendor[VF.registeredBy] || "").trim();
    let stLogo = "";
    let brandCompanyName = String(vendor[VF.registeredByName] || "").trim();
    if (regBy) {
        try {
            const adminStaff = await findStaffByRegisteredBy(regBy, { light: true });
            if (adminStaff) {
                const legacy = fromLegacyDoc(adminStaff);
                stLogo = legacy ? String(legacy[SF.logo] || "").trim() : "";
                brandCompanyName = getStaffCompanyName(adminStaff) || brandCompanyName;
            }
        } catch (brandErr) {
            console.warn("[login] vendor brand lookup:", brandErr.message);
        }
    }

    let vendorOrderEnabled = false;
    let vendorProfiles = [];
    try {
        const { findAllVendorsByLoginId } = require("./vendorLookup");
        const allVendors = await findAllVendorsByLoginId(loginId);
        vendorProfiles = vendorProfilesFromDocs(allVendors);
        vendorOrderEnabled = allVendors.length > 0;
    } catch (orderErr) {
        console.warn("[login] vendor profiles:", orderErr.message);
        try {
            vendorOrderEnabled = await vendorCanPlaceOrders(vendor);
        } catch (e2) {}
    }

    return {
        ok: true,
        role: "vendor",
        userId: vendor.loginId,
        companyName: getVendorCompanyName(vendor),
        displayName: getVendorCompanyName(vendor) || vendor.loginId || "",
        vendorGrade: vendorGradeFromDoc(vendor),
        vendorRegisteredBy: regBy,
        vendorRegisteredByName: brandCompanyName,
        brandCompanyName: brandCompanyName,
        vendorOrderEnabled: vendorOrderEnabled,
        vendorProfiles: vendorProfiles,
        vendorMgrName: String(vendor[VF.mgrName] || "").trim(),
        vendorMgrTel: String(vendor[VF.mgrTel] || "").trim(),
        vendorMgrEmail: String(vendor[VF.mgrEmail] || "").trim(),
        stLogo: stLogo
    };
}

/**
 * staff · vendors 컬렉션에서 아이디를 찾고 비밀번호를 검증합니다.
 * 업체는 vendors · vendor_new 등에 저장된 loginId·password 로 로그인합니다.
 */
async function resolveFormLogin(loginId, password) {
    const { staff, vendorDocs } = await lookupStaffAndVendor(loginId);
    const hasStaffAccount = !!(staff && isStaffRole(staff.role));
    const hasVendorAccount = vendorDocs.length > 0;

    if (hasVendorAccount) {
        for (let i = 0; i < vendorDocs.length; i++) {
            const vendorResult = await tryVendorLogin(vendorDocs[i], loginId, password);
            if (vendorResult) return vendorResult;
        }
    }

    const staffResult = await tryStaffLogin(staff, loginId, password);
    if (staffResult) return staffResult;

    if (!hasStaffAccount && !hasVendorAccount) {
        return { ok: false, reason: "NOT_REGISTERED" };
    }

    if (hasVendorAccount && !(await vendorAccountsHaveCredentials(loginId))) {
        return { ok: false, reason: "VENDOR_NO_PASSWORD" };
    }

    return { ok: false, reason: "BAD_PASSWORD" };
}

async function ensureLoginFieldsMigrated(db) {
    await migrateCollectionLoginFields(db, "staff");
    /** vendors는 vendorFields.migrateVendorsCollection 이 password·loginIdNorm 스키마를 유지합니다 */
}

module.exports = {
    normalizeId: require("./loginLookup").normalizeId,
    findStaffByLoginId,
    findVendorByLoginId,
    lookupStaffAndVendor,
    resolveFormLogin,
    ensureLoginFieldsMigrated,
    vendorAccountsHaveCredentials
};
