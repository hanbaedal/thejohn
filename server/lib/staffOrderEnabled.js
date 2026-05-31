const { getDb } = require("../db");
const { F, staffOrderEnabledFromDoc } = require("./staffFields");
const { findStaffByLoginId } = require("./loginResolve");
/** MongoDB — st_order_enabled=true 인 관리자(admin)만 */
function orderEnabledStaffFilter() {
    return {
        role: "admin",
        active: { $ne: false },
        $or: [{ [F.orderEnabled]: true }, { st_order_enabled: true }]
    };
}

async function listOrderEnabledStaff() {
    const docs = await getDb()
        .collection("staff")
        .find(orderEnabledStaffFilter())
        .toArray();
    return docs.filter(staffOrderEnabledFromDoc);
}

async function getOrderEnabledStaffLoginIds() {
    const docs = await listOrderEnabledStaff();
    const ids = [];
    for (let i = 0; i < docs.length; i++) {
        const loginId = String(docs[i].loginId || "").trim();
        if (loginId) ids.push(loginId);
    }
    return ids;
}

async function isLoginIdOrderEnabled(loginId) {
    const key = String(loginId || "").trim();
    if (!key) return false;
    const staff = await findStaffByLoginId(key);
    return staffOrderEnabledFromDoc(staff);
}
/** 주문 SMS — 담당자를 특정할 수 없을 때 st_order_enabled 관리자 연락처 순회 */
async function phoneFromOrderEnabledStaff() {
    const docs = await listOrderEnabledStaff();
    for (let i = 0; i < docs.length; i++) {
        const raw = String(docs[i].st_ceo_tel || docs[i][F.ceoTel] || "").trim();
        if (raw) return raw;
    }
    return "";
}

module.exports = {
    orderEnabledStaffFilter,
    listOrderEnabledStaff,
    getOrderEnabledStaffLoginIds,
    isLoginIdOrderEnabled,
    phoneFromOrderEnabledStaff
};