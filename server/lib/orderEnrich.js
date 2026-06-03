const { formatFullAddress } = require("./addressFormat");
const { F: VF, fromLegacyDoc: vendorFromLegacy, parseGrade } = require("./vendorFields");
const { F: PF, fromLegacyDoc: productFromLegacy } = require("./productFields");
const { deptLabel } = require("./orderDeptLabels");
const { findVendorByLoginId } = require("./loginResolve");
const { findStaffByRegisteredBy } = require("./staffRegisteredBy");
const { trimStaffLoginId, isLegacyRegisteredBy } = require("./staffLoginId");
const {
    fromLegacyDoc: staffFromLegacy,
    getCompanyName: getStaffCompanyName,
    getCeoName: getStaffCeoName,
    F: SF
} = require("./staffFields");
const { resolveIssuerForOrder } = require("./transactionIssuer");

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
    const raw = str(loginId);
    if (!raw) {
        return { loginId: "", name: "", ceo: "", tel: "", addr: "" };
    }
    const staff = await findStaffByRegisteredBy(raw);
    if (!staff) {
        return { loginId: raw, name: raw, ceo: "", tel: "", addr: "" };
    }
    const d = staffFromLegacy(staff) || {};
    return {
        loginId: str(staff.loginId) || raw,
        name: getStaffCompanyName(staff) || raw,
        ceo: getStaffCeoName(staff) || "",
        tel: str(d[SF.ceoTel]),
        addr: formatFullAddress(d[SF.zip], d[SF.addr], d[SF.addrDetail]) || str(d[SF.address] || staff.st_address)
    };
}

async function resolveSupplierStaffLoginId(vendorDoc) {
    const v = vendorFromLegacy(vendorDoc) || {};
    const reg = trimStaffLoginId(v[VF.registeredBy]);
    if (reg && !isLegacyRegisteredBy(reg)) {
        const staff = await findStaffByRegisteredBy(reg);
        if (staff && staff.loginId) return trimStaffLoginId(staff.loginId);
        return reg;
    }
    return "";
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
                pd_code: str(p[PF.code] || p.pd_code),
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
        vendorAddr:
            formatFullAddress(v[VF.zip], v[VF.addr], v[VF.addrDetail]) || str(v[VF.addr]),
        vendorZip: str(v[VF.zip]),
        vendorAddrRoad: str(v[VF.addr]),
        vendorAddrDetail: str(v[VF.addrDetail]),
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
        orderContactConfirmed: !!extras.orderContactConfirmed,
        orderContactConfirmedAt: extras.orderContactConfirmedAt || 0,
        items: await enrichOrderItems(db, items)
    };
}

/**
 * PDF 생성용 — DB에 저장된 주문(과거 주문 포함)을 최신 발주서 양식에 맞게 보강
 */
async function prepareOrderForPdf(db, order) {
    if (!order) return order;
    const o = Object.assign({}, order);
    let vendor = null;
    if (o.vendorUserId) {
        vendor = await findVendorByLoginId(o.vendorUserId);
    }
    const v = vendorFromLegacy(vendor) || {};

    if (!str(o.vendorCompany)) o.vendorCompany = str(v[VF.company]);
    if (!str(o.vendorAddr)) {
        o.vendorAddr =
            formatFullAddress(v[VF.zip], v[VF.addr], v[VF.addrDetail]) || str(v[VF.addr]);
    }
    if (!str(o.vendorZip)) o.vendorZip = str(v[VF.zip]);
    if (!str(o.vendorAddrRoad)) o.vendorAddrRoad = str(v[VF.addr]);
    if (!str(o.vendorAddrDetail)) o.vendorAddrDetail = str(v[VF.addrDetail]);
    if (!str(o.vendorPhone)) o.vendorPhone = str(v[VF.phone]);
    if (!str(o.vendorMgrName)) o.vendorMgrName = str(v[VF.mgrName]);
    if (!str(o.vendorMgrTel)) o.vendorMgrTel = str(v[VF.mgrTel]);
    if (!str(o.vendorMgrEmail)) o.vendorMgrEmail = str(v[VF.mgrEmail]);
    if (!str(o.vendorCeo)) o.vendorCeo = str(v[VF.ceo]);
    if (!str(o.vendorCeoTel)) o.vendorCeoTel = str(v[VF.ceoTel]);

    const supplierLogin =
        str(o.vendorRegisteredBy) ||
        (vendor ? await resolveSupplierStaffLoginId(vendor) : "");
    o.vendorRegisteredBy = supplierLogin;
    if (supplierLogin && (!o.supplier || !str(o.supplier.name))) {
        o.supplier = await staffSupplierFromLoginId(supplierLogin);
    }
    if (!str(o.vendorRegisteredByName)) {
        o.vendorRegisteredByName = o.supplier.name || supplierLogin;
    }

    o.items = await enrichOrderItems(db, Array.isArray(o.items) ? o.items : []);
    let sum = 0;
    o.items.forEach(function (it) {
        const qty = Number(it.quantity) || 0;
        const unit = Number(it.unitPrice) || 0;
        if (!it.lineTotal && qty && unit) {
            it.lineTotal = unit * qty;
        }
        sum += Number(it.lineTotal) || 0;
    });
    if (!o.totalAmount && sum) o.totalAmount = sum;

    return o;
}

/** 거래명세서 PDF — 발주 보강 + 담당 관리자(staff) 공급자·인감 */
async function prepareOrderForTransactionPdf(db, order) {
    const o = await prepareOrderForPdf(db, order);
    o.issuer = await resolveIssuerForOrder(db, o);
    return o;
}

module.exports = {
    staffSupplierFromLoginId,
    buildEnrichedOrder,
    prepareOrderForPdf,
    prepareOrderForTransactionPdf,
    gradeLabel
};
