const { F } = require("./productFields");
const {
    normalizeStaffLoginId,
    isStaffAuth,
    isSupervisorAuth,
    LEGACY_REGISTERED_BY,
    staffDisplayName
} = require("./vendorAccess");

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
    stampNewProductRegistration,
    applyProductRegistrationOnUpdate,
    isStaffAuth
};
