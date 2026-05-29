const { F: VF, fromLegacyDoc: vendorFromLegacy } = require("./vendorFields");

const DEFAULT_ORDER_VENDOR_STAFF = "aksangsa";

function normalizeStaffLoginId(loginId) {
    return String(loginId || "")
        .trim()
        .toLowerCase();
}

function isStaffAuth(auth) {
    if (!auth) return false;
    return auth.role === "supervisor" || auth.role === "admin";
}

function getOrderEnabledStaffId() {
    return normalizeStaffLoginId(
        String(process.env.ORDER_VENDOR_STAFF_ID || DEFAULT_ORDER_VENDOR_STAFF).trim()
    );
}

/** 주문·장바구니 — vn_registered_by 가 ORDER_VENDOR_STAFF_ID(기본 aksangsa) 인 업체만 */
function vendorCanPlaceOrders(vendorDoc) {
    if (!vendorDoc) return false;
    const v = vendorFromLegacy(vendorDoc) || {};
    const reg = normalizeStaffLoginId(v[VF.registeredBy]);
    if (!reg || reg === "legacy") return false;
    return reg === getOrderEnabledStaffId();
}

/** 주문서관리 메뉴·API — aksangsa 관리자만 */
function staffCanAccessOrderManage(auth) {
    if (!auth || auth.role !== "admin") return false;
    return normalizeStaffLoginId(auth.userId) === getOrderEnabledStaffId();
}

function buildOrderListQuery(auth) {
    if (!staffCanAccessOrderManage(auth)) return { id: "__none__" };
    return { vendorRegisteredBy: getOrderEnabledStaffId() };
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

function staffCanReadOrder(auth, order) {
    if (!order) return false;
    if (auth.role === "vendor") {
        return vendorOwnsOrder(auth, order);
    }
    if (supervisorCanAccessAllOrders(auth)) return true;
    if (!staffCanAccessOrderManage(auth)) return false;
    return normalizeStaffLoginId(order.vendorRegisteredBy) === getOrderEnabledStaffId();
}

module.exports = {
    DEFAULT_ORDER_VENDOR_STAFF,
    getOrderEnabledStaffId,
    vendorCanPlaceOrders,
    staffCanAccessOrderManage,
    supervisorCanAccessAllOrders,
    buildOrderListQuery,
    buildSupervisorOrderListQuery,
    buildVendorOrderListQuery,
    vendorOwnsOrder,
    staffCanReadOrder,
    normalizeStaffLoginId
};
