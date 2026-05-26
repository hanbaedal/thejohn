const { F } = require("./productFields");
const {
    normalizeStaffLoginId,
    isStaffAuth,
    isSupervisorAuth,
    LEGACY_REGISTERED_BY,
    staffDisplayName
} = require("./vendorAccess");
const { F: VF, fromLegacyDoc: vendorFromLegacy } = require("./vendorFields");

function vendorRegistrarFromDoc(vendorDoc, auth) {
    var reg = "";
    if (vendorDoc) {
        var v = vendorFromLegacy(vendorDoc) || vendorDoc;
        reg = normalizeStaffLoginId(v[VF.registeredBy]);
    }
    if (!reg && auth && auth.vendorRegisteredBy) {
        reg = normalizeStaffLoginId(auth.vendorRegisteredBy);
    }
    return reg;
}

/** 업체 카탈로그 — 사업부문(?dept=)만 필터, 등록 관리자(pd_registered_by)로는 제한하지 않음 */
function buildVendorCatalogProductQuery(_vendorDoc, _auth) {
    return {};
}

/** 업체 상품 조회(목록·상세·썸네일) — 전체 허용. 가격은 vendorPricing, 주문은 별도 검증 */
function vendorCanAccessProduct(_vendorDoc, _productDoc, _auth) {
    return true;
}

function isSharedLegacyProduct(doc) {
    if (!doc) return false;
    const by = normalizeStaffLoginId(doc[F.registeredBy]);
    return !by || by === LEGACY_REGISTERED_BY;
}

function productOwnedBy(doc, staffLoginId) {
    if (!doc) return false;
    return normalizeStaffLoginId(doc[F.registeredBy]) === normalizeStaffLoginId(staffLoginId);
}

/** 사업부문·상세 조회는 공개. 수정·삭제만 담당 관리자 제한(canWriteProduct) */
function canReadProduct() {
    return true;
}

function canWriteProduct(auth, doc) {
    if (!auth || !isStaffAuth(auth)) return false;
    if (isSupervisorAuth(auth)) return true;
    if (!doc) return true;
    if (isSharedLegacyProduct(doc)) return true;
    return productOwnedBy(doc, auth.userId);
}

/** 슈퍼바이저: 전체, 관리자: 본인 등록 + legacy */
function buildProductListQuery(auth) {
    if (!auth || !isStaffAuth(auth)) return {};
    if (isSupervisorAuth(auth)) return {};
    const me = normalizeStaffLoginId(auth.userId);
    return {
        $or: [
            { [F.registeredBy]: me },
            { [F.registeredBy]: LEGACY_REGISTERED_BY },
            { [F.registeredBy]: { $exists: false } },
            { [F.registeredBy]: "" }
        ]
    };
}

async function stampNewProductRegistration(doc, auth) {
    const me = normalizeStaffLoginId(auth && auth.userId);
    doc[F.registeredBy] = me;
    doc[F.registeredByName] = await staffDisplayName(me);
    doc[F.registeredAt] = Date.now();
    return doc;
}

async function applyProductRegistrationOnUpdate(doc, existing, auth, body) {
    if (!existing) return stampNewProductRegistration(doc, auth);
    doc[F.registeredBy] = existing[F.registeredBy] || LEGACY_REGISTERED_BY;
    doc[F.registeredByName] = existing[F.registeredByName] || "";
    if (existing[F.registeredAt]) doc[F.registeredAt] = existing[F.registeredAt];
    return doc;
}

module.exports = {
    canReadProduct,
    canWriteProduct,
    buildProductListQuery,
    buildVendorCatalogProductQuery,
    vendorCanAccessProduct,
    vendorRegistrarFromDoc,
    stampNewProductRegistration,
    applyProductRegistrationOnUpdate,
    isStaffAuth
};
