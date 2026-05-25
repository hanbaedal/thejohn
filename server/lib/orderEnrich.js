const { F: VF, fromLegacyDoc: vendorFromLegacy, parseGrade } = require("./vendorFields");
const { F: PF, fromLegacyDoc: productFromLegacy } = require("./productFields");
const { deptLabel } = require("./orderDeptLabels");
const { findStaffByLoginId } = require("./loginResolve");
const {
    fromLegacyDoc: staffFromLegacy,
    getCompanyName: getStaffCompanyName,
    getCeoName: getStaffCeoName,
    F: SF
} = require("./staffFields");

const DEFAULT_STAFF_LOGIN = "aksangsa";

function str(v) {
    return String(v ?? "").trim();
}

function gradeLabel(grade) {
    const g = parseGrade(grade) || "1";
    return g + "등급";
}

/**
 * staff 컬렉션 — 공급·주문 접수 주체 (업체 등록 담당 관리자)
 * 추후 st_addr, 업종·업태 등 필드 추가 예정
 */
async function staffSupplierFromLoginId(loginId) {
    const id = str(loginId).toLowerCase();
    if (!id) {
        return { loginId: "", name: "", ceo: "", tel: "", addr: "" };
    }
    const staff = await findStaffByLoginId(id);
    if (!staff) {
        return { loginId: id, name: id, ceo: "", tel: "", addr: "" };
    }
    const d = staffFromLegacy(staff) || {};
    return {
        loginId: str(staff.loginId) || id,
        name: getStaffCompanyName(staff) || id,
        ceo: getStaffCeoName(staff) || "",
        tel: str(d[SF.ceoTel]),
        addr: ""
    };
}

async function resolveSupplierStaffLoginId(vendorDoc) {
    const v = vendorFromLegacy(vendorDoc) || {};
    const reg = str(v[VF.registeredBy]).toLowerCase();
    if (reg && reg !== "legacy") return reg;
    return str(process.env.ORDER_NOTIFY_STAFF_ID || DEFAULT_STAFF_LOGIN).toLowerCase();
}

async function enrichOrderItems(db, rawItems) {
    const out = [];
    for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i] || {};
        const product = await db.collection("products").findOne({ id: it.productId });
        const p = productFromLegacy(product) || {};
        const deptId = str(it.pd_dept || p[PF.dept]);
        const productReg = str(p[PF.registeredBy]);
        let productRegName = str(p[PF.registeredByName]);
        if (productReg && !productRegName) {
            const st = await staffSupplierFromLoginId(productReg);
            productRegName = st.name || productReg;
        }
        out.push(
            Object.assign({}, it, {
                pd_dept: deptId,
                pd_dept_label: deptLabel(deptId),
                productRegisteredBy: productReg,
                productRegisteredByName: productRegName
            })
        );
    }
    return out;
}

async function buildEnrichedOrder(db, vendorDoc, items, extras) {
    extras = extras || {};
    const v = vendorFromLegacy(vendorDoc) || {};
    const supplierLogin = await resolveSupplierStaffLoginId(vendorDoc);
    const supplier = await staffSupplierFromLoginId(supplierLogin);
    const grade = parseGrade(v[VF.grade]) || "1";

    return {
        id: extras.id,
        orderNo: extras.orderNo,
        createdAt: extras.createdAt || Date.now(),
        status: extras.status || "submitted",
        note: str(extras.note),
        totalAmount: extras.totalAmount || 0,
        vendorUserId: str(vendorDoc.loginId || extras.vendorUserId),
        vendorCompany: str(v[VF.company]) || str(extras.vendorCompany),
        vendorGrade: grade,
        vendorGradeLabel: gradeLabel(grade),
        vendorAddr: str(v[VF.addr]),
        vendorPhone: str(v[VF.phone]),
        vendorCeo: str(v[VF.ceo]),
        vendorCeoTel: str(v[VF.ceoTel]),
        vendorMgrName: str(v[VF.mgrName]),
        vendorMgrTel: str(v[VF.mgrTel]),
        vendorMgrEmail: str(v[VF.mgrEmail]),
        vendorRegisteredBy: supplierLogin,
        vendorRegisteredByName: supplier.name,
        supplier: supplier,
        notifyStaff: supplier,
        items: await enrichOrderItems(db, items)
    };
}

module.exports = {
    DEFAULT_STAFF_LOGIN,
    staffSupplierFromLoginId,
    buildEnrichedOrder,
    gradeLabel
};
