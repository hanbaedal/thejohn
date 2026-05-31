const { F: VF, fromLegacyDoc: vendorFromLegacy } = require("./vendorFields");
const { staffOrderEnabledFromDoc } = require("./staffFields");
const { findStaffByRegisteredBy } = require("./staffRegisteredBy");
const {
    trimStaffLoginId,
    staffLoginIdsEqual,
    isLegacyRegisteredBy,
    registeredByInFilter
} = require("./staffLoginId");

function normalizeStaffLoginId(loginId) {
    return trimStaffLoginId(loginId);
}

function isStaffAuth(auth) {
    if (!auth) return false;
    return auth.role === "supervisor" || auth.role === "admin";
}

async function staffOrderEnabledByLoginId(loginId) {
    const staff = await findStaffByRegisteredBy(loginId);
    return staffOrderEnabledFromDoc(staff);
}

/** 업체 주문 — 등록 담당 관리자(st_order_enabled)인 업체만 */
async function vendorCanPlaceOrders(vendorDoc) {
    if (!vendorDoc) return false;
    const v = vendorFromLegacy(vendorDoc) || {};
    const reg = trimStaffLoginId(v[VF.registeredBy]);
    if (!reg || isLegacyRegisteredBy(reg)) return false;
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
    return { vendorRegisteredBy: registeredByInFilter(auth.userId) };
}

function buildVendorOrderListQuery(auth) {
    const uid = trimStaffLoginId(auth && auth.userId);
    if (!uid) return { id: "__none__" };
    return { vendorUserId: uid };
}

function vendorOwnsOrder(auth, order) {
    if (!auth || auth.role !== "vendor" || !order) return false;
    const mine = trimStaffLoginId(auth.userId);
    const theirs = trimStaffLoginId(order.vendorUserId);
    return !!mine && mine === theirs;
}

function supervisorCanAccessAllOrders(auth) {
    return !!(auth && auth.role === "supervisor");
}

function buildSupervisorOrderListQuery(auth, adminStaffId) {
    if (!supervisorCanAccessAllOrders(auth)) return { id: "__none__" };
    const reg = trimStaffLoginId(adminStaffId);
    if (reg) return { vendorRegisteredBy: registeredByInFilter(reg) };
    return {};
}

async function staffCanReadOrder(auth, order) {
    if (!order) return false;
    if (auth.role === "vendor") {
        return vendorOwnsOrder(auth, order);
    }
    if (supervisorCanAccessAllOrders(auth)) return true;
    if (!(await staffCanAccessOrderManage(auth))) return false;
    return staffLoginIdsEqual(order.vendorRegisteredBy, auth.userId);
}

/** 상품 주문 가능 — 업체·상품 담당 관리자가 같고, 그 관리자가 주문 권한(st_order_enabled) 보유 */
async function vendorProductAllowsOrderForVendor(productRegisteredBy, vendorDoc) {
    const v = vendorFromLegacy(vendorDoc) || {};
    const vStaff = await findStaffByRegisteredBy(v[VF.registeredBy]);
    const pStaff = await findStaffByRegisteredBy(productRegisteredBy);
    if (!vStaff || !pStaff) return false;
    if (!staffLoginIdsEqual(vStaff.loginId, pStaff.loginId)) return false;
    return staffOrderEnabledFromDoc(vStaff);
}

module.exports = {
    normalizeStaffLoginId,
    trimStaffLoginId,
    staffLoginIdsEqual,
    isStaffAuth,
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
