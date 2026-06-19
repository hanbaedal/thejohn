const { getDb } = require("../db");
const { F } = require("./staffFields");
const { findStaffByLoginId } = require("./loginResolve");

/** 활성 관리자(admin) — st_order_enabled 폐지 후 전원 대상 */
function activeAdminStaffFilter() {
    return {
        role: "admin",
        active: { $ne: false }
    };
}

/** @deprecated — activeAdminStaffFilter 와 동일 (구 st_order_enabled 필터 제거) */
function orderEnabledStaffFilter() {
    return activeAdminStaffFilter();
}

async function listActiveAdminStaff() {
    return getDb().collection("staff").find(activeAdminStaffFilter()).toArray();
}

/** @deprecated — listActiveAdminStaff */
async function listOrderEnabledStaff() {
    return listActiveAdminStaff();
}

async function getAdminStaffLoginIds() {
    const docs = await listActiveAdminStaff();
    const ids = [];
    for (let i = 0; i < docs.length; i++) {
        const loginId = String(docs[i].loginId || "").trim();
        if (loginId) ids.push(loginId);
    }
    return ids;
}

/** @deprecated — getAdminStaffLoginIds */
async function getOrderEnabledStaffLoginIds() {
    return getAdminStaffLoginIds();
}

async function isLoginIdOrderEnabled(loginId) {
    const key = String(loginId || "").trim();
    if (!key) return false;
    const staff = await findStaffByLoginId(key);
    if (!staff || staff.role !== "admin" || staff.active === false) return false;
    return true;
}

/** 주문 SMS — 담당자 번호 없을 때 활성 관리자 대표 연락처 순회 */
async function phoneFromAnyAdminStaff() {
    const docs = await listActiveAdminStaff();
    for (let i = 0; i < docs.length; i++) {
        const raw = String(docs[i].st_ceo_tel || docs[i][F.ceoTel] || "").trim();
        if (raw) return raw;
    }
    return "";
}

/** @deprecated — phoneFromAnyAdminStaff */
async function phoneFromOrderEnabledStaff() {
    return phoneFromAnyAdminStaff();
}

module.exports = {
    activeAdminStaffFilter,
    orderEnabledStaffFilter,
    listActiveAdminStaff,
    listOrderEnabledStaff,
    getAdminStaffLoginIds,
    getOrderEnabledStaffLoginIds,
    isLoginIdOrderEnabled,
    phoneFromAnyAdminStaff,
    phoneFromOrderEnabledStaff
};
