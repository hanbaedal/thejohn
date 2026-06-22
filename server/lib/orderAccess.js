const { F: VF, fromLegacyDoc: vendorFromLegacy } = require("./vendorFields");
const { F: PF } = require("./productFields");
const {
    trimStaffLoginId,
    staffLoginIdsEqual,
    isLegacyRegisteredBy,
    registeredByInFilter
} = require("./staffLoginId");
const { vendorHasAnyRegistration } = require("./vendorLookup");

function normalizeStaffLoginId(loginId) {
    return trimStaffLoginId(loginId);
}

function isStaffAuth(auth) {
    if (!auth) return false;
    return auth.role === "supervisor" || auth.role === "admin";
}

/** 등록된 업체(vendors) 계정이면 주문 가능 */
async function vendorCanPlaceOrders(vendorDoc) {
    if (!vendorDoc) return false;
    const loginId = String(vendorDoc.loginId || "").trim();
    if (!loginId) return false;
    return vendorHasAnyRegistration(loginId);
}

/** 모든 관리자 — 주문서관리·거래명세·매출 */
async function staffCanAccessOrderManage(auth) {
    return !!(auth && auth.role === "admin");
}

function legacyAdminOrderFilter(auth) {
    return {
        orderKind: { $exists: false },
        vendorRegisteredBy: registeredByInFilter(auth.userId)
    };
}

function legacyVendorOrderFilter(uid) {
    return {
        orderKind: { $exists: false },
        vendorUserId: uid
    };
}

async function buildOrderListQuery(auth) {
    if (!(await staffCanAccessOrderManage(auth))) return { id: "__none__" };
    const staffFilter = registeredByInFilter(auth.userId);
    return {
        $or: [
            { orderKind: "admin", orderStaffLoginId: staffFilter },
            legacyAdminOrderFilter(auth)
        ]
    };
}

function buildVendorOrderListQuery(auth) {
    const uid = trimStaffLoginId(auth && auth.userId);
    if (!uid) return { id: "__none__" };
    return {
        $or: [{ orderKind: "vendor", vendorUserId: uid }, legacyVendorOrderFilter(uid)]
    };
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
    const kind = String(adminStaffId || "").trim() ? "admin" : "";
    if (reg) {
        return {
            $or: [
                { orderKind: "admin", orderStaffLoginId: registeredByInFilter(reg) },
                {
                    orderKind: { $exists: false },
                    vendorRegisteredBy: registeredByInFilter(reg)
                }
            ]
        };
    }
    return {};
}

async function staffCanReadOrder(auth, order) {
    if (!order) return false;
    if (auth.role === "vendor") {
        if (order.orderKind === "admin") return false;
        return vendorOwnsOrder(auth, order);
    }
    if (supervisorCanAccessAllOrders(auth)) return true;
    if (!(await staffCanAccessOrderManage(auth))) return false;
    if (order.orderKind === "admin") {
        return staffLoginIdsEqual(order.orderStaffLoginId, auth.userId);
    }
    if (order.orderKind === "vendor") {
        return false;
    }
    return staffLoginIdsEqual(order.vendorRegisteredBy, auth.userId);
}

/** 상품 주문 — vendors에 1건 이상 등록된 업체는 모든 관리자 상품 주문 가능 */
async function vendorProductAllowsOrderForVendor(productRegisteredBy, vendorLoginId) {
    const pReg = trimStaffLoginId(productRegisteredBy);
    const loginId = trimStaffLoginId(vendorLoginId);
    if (!pReg || isLegacyRegisteredBy(pReg) || !loginId) return false;
    return vendorHasAnyRegistration(loginId);
}

module.exports = {
    normalizeStaffLoginId,
    trimStaffLoginId,
    staffLoginIdsEqual,
    isStaffAuth,
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
