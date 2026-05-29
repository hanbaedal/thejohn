const { getDb } = require("../db");
const { loginLookupFilter } = require("./loginAccount");
const { F: VF, fromLegacyDoc: vendorFromLegacy } = require("./vendorFields");
const { staffOrderEnabledFromDoc } = require("./staffFields");

function normalizeStaffLoginId(loginId) {
    return String(loginId || "")
        .trim()
        .toLowerCase();
}

function isStaffAuth(auth) {
    if (!auth) return false;
    return auth.role === "supervisor" || auth.role === "admin";
}

async function staffOrderEnabledByLoginId(loginId) {
    const key = String(loginId || "").trim();
    if (!key) return false;
    const staff = await getDb()
        .collection("staff")
        .findOne({ active: { $ne: false }, ...loginLookupFilter(key) });
    return staffOrderEnabledFromDoc(staff);
}

/** 업체 주문 — 등록 담당 관리자(st_order_enabled)인 업체만 */
async function vendorCanPlaceOrders(vendorDoc) {
    if (!vendorDoc) return false;
    const v = vendorFromLegacy(vendorDoc) || {};
    const reg = normalizeStaffLoginId(v[VF.registeredBy]);
    if (!reg || reg === "legacy") return false;
    return staffOrderEnabledByLoginId(reg);
}

/** 주문서관리 — st_order_enabled 관리자만 (DB 최신값 반영) */
async function staffCanAccessOrderManage(auth) {
    if (!auth || auth.role !== "admin") return false;
    if (auth.staffOrderEnabled === true) return true;
    return staffOrderEnabledByLoginId(auth.userId);
}

async function buildOrderListQuery(auth) {
    if (!(await staffCanAccessOrderManage(auth))) return { id: "__none__" };
    return { vendorRegisteredBy: normalizeStaffLoginId(auth.userId) };
}

function buildVendorOrderListQuery(auth) {
    const uid = String((auth && auth.userId) || "").trim();
    if (!uid) return { id: "__none__" };
    const idn = normalizeStaffLoginId(uid);
    if (uid === idn) return { vendorUserId: uid };
    return { $or: [{ vendorUserId: uid }, { vendorUserId: idn }] };
}

function vendorOwnsOrder(auth, order) {
    if (!auth || auth.role !== "vendor" || !order) return false;
    const mine = normalizeStaffLoginId(auth.userId);
    const theirs = normalizeStaffLoginId(order.vendorUserId);
    return !!mine && mine === theirs;
}

function supervisorCanAccessAllOrders(auth) {
    return !!(auth && auth.role === "supervisor");
}

function buildSupervisorOrderListQuery(auth, adminStaffId) {
    if (!supervisorCanAccessAllOrders(auth)) return { id: "__none__" };
    var reg = normalizeStaffLoginId(adminStaffId);
    if (reg) return { vendorRegisteredBy: reg };
    return {};
}

async function staffCanReadOrder(auth, order) {
    if (!order) return false;
    if (auth.role === "vendor") {
        return vendorOwnsOrder(auth, order);
    }
    if (supervisorCanAccessAllOrders(auth)) return true;
    if (!(await staffCanAccessOrderManage(auth))) return false;
    return normalizeStaffLoginId(order.vendorRegisteredBy) === normalizeStaffLoginId(auth.userId);
}

/** 상품 주문 가능 — 업체 담당과 상품 등록 담당이 같고, 그 관리자가 주문 권한 보유 */
async function vendorProductAllowsOrderForVendor(productRegisteredBy, vendorDoc) {
    const v = vendorFromLegacy(vendorDoc) || {};
    const vReg = normalizeStaffLoginId(v[VF.registeredBy]);
    const pReg = normalizeStaffLoginId(productRegisteredBy);
    if (!vReg || !pReg || vReg === "legacy" || pReg === "legacy" || vReg !== pReg) {
        return false;
    }
    return staffOrderEnabledByLoginId(vReg);
}

module.exports = {
    normalizeStaffLoginId,
    staffOrderEnabledByLoginId,
    vendorCanPlaceOrders,
    staffCanAccessOrderManage,
    supervisorCanAccessAllOrders,
    buildOrderListQuery,
    buildSupervisorOrderListQuery,
    buildVendorOrderListQuery,
    vendorOwnsOrder,
    staffCanReadOrder,
    vendorProductAllowsOrderForVendor
};
