const { F } = require("./productFields");
const {
    trimStaffLoginId,
    staffLoginIdsEqual,
    isLegacyRegisteredBy,
    registeredByInFilter,
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
        reg = trimStaffLoginId(v[VF.registeredBy]);
    }
    if (!reg && auth && auth.vendorRegisteredBy) {
        reg = trimStaffLoginId(auth.vendorRegisteredBy);
    }
    return reg;
}

function buildVendorCatalogProductQuery(_vendorDoc, _auth) {
    return {};
}

function vendorCanAccessProduct(_vendorDoc, _productDoc, _auth) {
    return true;
}

function isSharedLegacyProduct(doc) {
    if (!doc) return false;
    return isLegacyRegisteredBy(doc[F.registeredBy]);
}

function productOwnedBy(doc, staffLoginId) {
    if (!doc) return false;
    return staffLoginIdsEqual(doc[F.registeredBy], staffLoginId);
}

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

function buildProductListQuery(auth) {
    if (!auth || !isStaffAuth(auth)) return {};
    if (isSupervisorAuth(auth)) return {};
    const me = trimStaffLoginId(auth.userId);
    return {
        $or: [
            { [F.registeredBy]: registeredByInFilter(me) },
            { [F.registeredBy]: LEGACY_REGISTERED_BY },
            { [F.registeredBy]: { $exists: false } },
            { [F.registeredBy]: "" }
        ]
    };
}

async function stampNewProductRegistration(doc, auth) {
    const me = trimStaffLoginId(auth && auth.userId);
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
