const { F: VF, fromLegacyDoc, toDbDoc, RECORD_PARTNER, PARTNER_DEPT_IDS, normalizeDeptId } = require("./vendorFields");
const { F: PF } = require("./productFields");
const { findVendorByLoginAndRegistrar } = require("./vendorLookup");
const { stampNewVendorRegistration } = require("./vendorAccess");
const { trimStaffLoginId, isLegacyRegisteredBy } = require("./staffLoginId");
const { getVendorStoredPassword } = require("./loginAccount");

const AUTO_REGISTER_NOTE = "주문 시 자동 등록(Silver)";

function newVendorId() {
    return "vr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

async function deriveDeptsFromClientItems(db, clientItems) {
    const depts = new Set();
    for (let i = 0; i < (clientItems || []).length; i++) {
        const it = clientItems[i] || {};
        const productId = String(it.productId || "").trim();
        if (!productId) continue;
        const product = await db.collection("products").findOne({ id: productId });
        if (!product) continue;
        const dept = normalizeDeptId(product[PF.dept] || product.pd_dept);
        if (dept && PARTNER_DEPT_IDS.includes(dept)) depts.add(dept);
    }
    return Array.from(depts);
}

function cloneVendorDocForAdmin(templateDoc, deptsFallback) {
    const v = fromLegacyDoc(templateDoc) || {};
    const loginId = String(templateDoc.loginId || "").trim();
    let depts = Array.isArray(v[VF.depts]) ? v[VF.depts].slice() : [];
    if (!depts.length && deptsFallback && deptsFallback.length) {
        depts = deptsFallback.slice();
    }
    const built = {
        loginId: loginId,
        loginIdNorm: templateDoc.loginIdNorm,
        passwordPlain: getVendorStoredPassword(templateDoc) || String(templateDoc.password || ""),
        vn_company: v[VF.company],
        vn_depts: depts,
        vn_ceo: v[VF.ceo],
        vn_ceo_tel: v[VF.ceoTel],
        vn_grade: "1",
        vn_room_count: v[VF.roomCount],
        vn_web: v[VF.web],
        vn_email: v[VF.email],
        vn_phone: v[VF.phone],
        vn_biz_no: v[VF.bizNo],
        vn_biz_item: v[VF.bizItem],
        vn_biz_type: v[VF.bizType],
        vn_zip: v[VF.zip],
        vn_addr: v[VF.addr],
        vn_addr_detail: v[VF.addrDetail],
        vn_mgr_name: v[VF.mgrName],
        vn_mgr_tel: v[VF.mgrTel],
        vn_mgr_email: v[VF.mgrEmail],
        vn_logo: v[VF.logo],
        vn_note: (v[VF.note] ? String(v[VF.note]).trim() + " " : "") + AUTO_REGISTER_NOTE,
        vn_record_type: RECORD_PARTNER
    };
    return built;
}

async function ensureVendorRegisteredForAdmin(db, vendorLoginId, adminLoginId, templateVendor, deptsFallback) {
    const loginId = trimStaffLoginId(vendorLoginId);
    const admin = trimStaffLoginId(adminLoginId);
    if (!loginId || !admin || isLegacyRegisteredBy(admin)) {
        return { created: false };
    }

    const existing = await findVendorByLoginAndRegistrar(loginId, admin);
    if (existing) return { created: false, vendor: existing };

    if (!templateVendor) return { created: false };

    const built = cloneVendorDocForAdmin(templateVendor, deptsFallback);
    if (!built.vn_company) return { created: false };

    let doc = toDbDoc(newVendorId(), built, null);
    doc = await stampNewVendorRegistration(doc, { userId: admin, role: "admin" });

    try {
        await db.collection("vendors").insertOne(doc);
        console.log("[vendor_auto_register]", loginId, "→", admin, "(Silver)");
        return { created: true, vendor: doc };
    } catch (e) {
        if (e && e.code === 11000) {
            const again = await findVendorByLoginAndRegistrar(loginId, admin);
            if (again) return { created: false, vendor: again };
        }
        throw e;
    }
}

async function collectProductAdminIdsFromClientItems(db, clientItems) {
    const admins = new Set();
    for (let i = 0; i < (clientItems || []).length; i++) {
        const it = clientItems[i] || {};
        const productId = String(it.productId || "").trim();
        if (!productId) continue;
        const product = await db.collection("products").findOne({ id: productId });
        if (!product) continue;
        const reg = trimStaffLoginId(product[PF.registeredBy] || product.pd_registered_by);
        if (reg && !isLegacyRegisteredBy(reg)) admins.add(reg);
    }
    return Array.from(admins);
}

async function ensureVendorRegistrationsForOrder(db, vendorLoginId, templateVendor, clientItems) {
    const adminIds = await collectProductAdminIdsFromClientItems(db, clientItems);
    const deptsFallback = await deriveDeptsFromClientItems(db, clientItems);
    const created = [];
    for (let i = 0; i < adminIds.length; i++) {
        const result = await ensureVendorRegisteredForAdmin(
            db,
            vendorLoginId,
            adminIds[i],
            templateVendor,
            deptsFallback
        );
        if (result.created) created.push(adminIds[i]);
    }
    return { adminIds: adminIds, created: created };
}

module.exports = {
    ensureVendorRegistrationsForOrder,
    ensureVendorRegisteredForAdmin,
    collectProductAdminIdsFromClientItems,
    AUTO_REGISTER_NOTE
};
