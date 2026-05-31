const { F } = require("./productFields");
const {
    trimStaffLoginId,
    staffLoginIdsEqual,
    registeredByInFilter,
    normalizeStaffLoginId,
    isStaffAuth,
    isSupervisorAuth,
    LEGACY_REGISTERED_BY,
    staffDisplayName
} = require("./vendorAccess");
const { F: VF, fromLegacyDoc: vendorFromLegacy } = require("./vendorFields");
const { findStaffByRegisteredBy } = require("./staffRegisteredBy");
const { loginIdValues, staffLoginIdKey, isLegacyRegisteredBy } = require("./staffLoginId");

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

/** 관리자 소유 loginId 집합(현재·previousLoginIds) — 목록 canWrite 판정용 */
function buildProductWriteChecker(auth, staffDoc) {
    if (!auth || !isStaffAuth(auth)) {
        return function () {
            return false;
        };
    }
    if (isSupervisorAuth(auth)) {
        return function () {
            return true;
        };
    }
    const ownedKeys = new Set();

    function addLoginId(id) {
        loginIdValues(id).forEach(function (v) {
            const k = staffLoginIdKey(v);
            if (k) ownedKeys.add(k);
        });
    }

    addLoginId(trimStaffLoginId(auth.userId));
    if (staffDoc && Array.isArray(staffDoc.previousLoginIds)) {
        staffDoc.previousLoginIds.forEach(addLoginId);
    }

    return function canWriteDoc(doc) {
        if (!doc) return true;
        if (isSharedLegacyProduct(doc)) return true;
        const k = staffLoginIdKey(doc[F.registeredBy]);
        return !!k && ownedKeys.has(k);
    };
}

async function createProductWriteChecker(auth) {
    if (!auth || !isStaffAuth(auth)) {
        return buildProductWriteChecker(auth, null);
    }
    if (isSupervisorAuth(auth)) {
        return buildProductWriteChecker(auth, null);
    }
    const staff = await findStaffByRegisteredBy(trimStaffLoginId(auth.userId));
    return buildProductWriteChecker(auth, staff);
}

async function canWriteProductAsync(auth, doc) {
    const checker = await createProductWriteChecker(auth);
    return checker(doc);
}

function canWriteProduct(auth, doc) {
    if (!auth || !isStaffAuth(auth)) return false;
    if (isSupervisorAuth(auth)) return true;
    if (!doc) return true;
    if (isSharedLegacyProduct(doc)) return true;
    return productOwnedBy(doc, auth.userId);
}

function canReadProduct() {
    return true;
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

/** 관리자 — loginId 변경·이전 아이디(previousLoginIds)까지 담당 상품 조회 */
async function buildProductListQueryAsync(auth) {
    if (!auth || !isStaffAuth(auth)) return {};
    if (isSupervisorAuth(auth)) return {};
    const me = trimStaffLoginId(auth.userId);
    const inVals = [];

    function addLoginId(id) {
        loginIdValues(id).forEach(function (v) {
            if (inVals.indexOf(v) < 0) inVals.push(v);
        });
    }

    addLoginId(me);
    const staff = await findStaffByRegisteredBy(me);
    if (staff && Array.isArray(staff.previousLoginIds)) {
        staff.previousLoginIds.forEach(addLoginId);
    }

    return {
        $or: [
            { [F.registeredBy]: { $in: inVals.length ? inVals : ["__none__"] } },
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
    canWriteProductAsync,
    createProductWriteChecker,
    buildProductListQuery,
    buildProductListQueryAsync,
    buildVendorCatalogProductQuery,
    vendorCanAccessProduct,
    vendorRegistrarFromDoc,
    stampNewProductRegistration,
    applyProductRegistrationOnUpdate,
    isStaffAuth
};
