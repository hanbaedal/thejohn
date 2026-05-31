const { F } = require("./vendorFields");
const { findStaffByLoginId } = require("./loginLookup");
const { getCompanyName: getStaffCompanyName } = require("./staffFields");
const {
    trimStaffLoginId,
    staffLoginIdKey,
    staffLoginIdsEqual,
    isLegacyRegisteredBy,
    registeredByInFilter
} = require("./staffLoginId");

const LEGACY_REGISTERED_BY = "legacy";

/** @deprecated — trimStaffLoginId / staffLoginIdsEqual 사용 */
function normalizeStaffLoginId(loginId) {
    return trimStaffLoginId(loginId);
}

function isSupervisorAuth(auth) {
    if (!auth) return false;
    return auth.role === "supervisor";
}

function isStaffAuth(auth) {
    if (!auth) return false;
    return auth.role === "admin" || auth.role === "supervisor";
}

/** 기존 28건 등 담당 미기록 — 모든 관리자가 조회·수정 가능 */
function isSharedLegacyVendor(doc) {
    if (!doc) return false;
    return isLegacyRegisteredBy(doc[F.registeredBy]);
}

function vendorOwnedBy(doc, staffLoginId) {
    if (!doc) return false;
    return staffLoginIdsEqual(doc[F.registeredBy], staffLoginId);
}

function canReadVendor(auth, doc) {
    if (!auth || !isStaffAuth(auth)) return true;
    if (isSupervisorAuth(auth)) return true;
    if (isSharedLegacyVendor(doc)) return true;
    return vendorOwnedBy(doc, auth.userId);
}

function canWriteVendor(auth, doc) {
    if (!auth || !isStaffAuth(auth)) return false;
    if (isSupervisorAuth(auth)) return true;
    if (!doc) return true;
    if (isSharedLegacyVendor(doc)) return true;
    return vendorOwnedBy(doc, auth.userId);
}

function canReadProspectForPicker(auth) {
    return isStaffAuth(auth);
}

function canWriteProspectForRegistration(auth, doc) {
    if (!isStaffAuth(auth)) return false;
    if (isSupervisorAuth(auth)) return true;
    if (!doc) return true;
    if (canWriteVendor(auth, doc)) return true;
    if (!String(doc.loginId || "").trim()) return true;
    return false;
}

/** MongoDB find 쿼리 — 슈퍼바이저: 전체, 관리자: 본인 등록 + legacy */
function buildVendorListQuery(auth) {
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

async function staffDisplayName(loginId) {
    const staff = await findStaffByLoginId(loginId);
    if (!staff) return trimStaffLoginId(loginId);
    return getStaffCompanyName(staff) || staff.loginId || loginId;
}

async function stampNewVendorRegistration(doc, auth) {
    const me = trimStaffLoginId(auth && auth.userId);
    doc[F.registeredBy] = me;
    doc[F.registeredByName] = await staffDisplayName(me);
    doc[F.registeredAt] = Date.now();
    return doc;
}

async function applyRegistrationOnUpdate(doc, existing, auth, body) {
    if (!existing) return stampNewVendorRegistration(doc, auth);
    doc[F.registeredBy] = existing[F.registeredBy] || LEGACY_REGISTERED_BY;
    doc[F.registeredByName] = existing[F.registeredByName] || "";
    if (existing[F.registeredAt]) doc[F.registeredAt] = existing[F.registeredAt];
    return doc;
}

module.exports = {
    LEGACY_REGISTERED_BY,
    normalizeStaffLoginId,
    trimStaffLoginId,
    staffLoginIdKey,
    staffLoginIdsEqual,
    isSupervisorAuth,
    isStaffAuth,
    isSharedLegacyVendor,
    canReadVendor,
    canWriteVendor,
    canReadProspectForPicker,
    canWriteProspectForRegistration,
    buildVendorListQuery,
    staffDisplayName,
    stampNewVendorRegistration,
    applyRegistrationOnUpdate
};
