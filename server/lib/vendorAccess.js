const { F } = require("./vendorFields");
const { findStaffByLoginId } = require("./loginResolve");
const { getCompanyName: getStaffCompanyName } = require("./staffFields");
const LEGACY_REGISTERED_BY = "legacy";

function normalizeStaffLoginId(loginId) {
    return String(loginId || "")
        .trim()
        .toLowerCase();
}

/** 슈퍼바이저 역할 없음 — 항상 false (레거시 호환) */
function isSupervisorAuth() {
    return false;
}

function isStaffAuth(auth) {
    if (!auth) return false;
    return auth.role === "admin" || auth.role === "supervisor";
}

/** 기존 28건 등 담당 미기록 — 모든 관리자가 조회·수정 가능 */
function isSharedLegacyVendor(doc) {
    if (!doc) return false;
    const by = normalizeStaffLoginId(doc[F.registeredBy]);
    return !by || by === LEGACY_REGISTERED_BY;
}

function vendorOwnedBy(doc, staffLoginId) {
    if (!doc) return false;
    return normalizeStaffLoginId(doc[F.registeredBy]) === normalizeStaffLoginId(staffLoginId);
}

function canReadVendor(auth, doc) {
    if (!auth || !isStaffAuth(auth)) return true;
    if (isSharedLegacyVendor(doc)) return true;
    return vendorOwnedBy(doc, auth.userId);
}

function canWriteVendor(auth, doc) {
    if (!auth || !isStaffAuth(auth)) return false;
    if (!doc) return true;
    if (isSharedLegacyVendor(doc)) return true;
    return vendorOwnedBy(doc, auth.userId);
}

/** MongoDB find 쿼리 — 관리자별 본인 등록 + legacy(담당 미지정) */
function buildVendorListQuery(auth) {
    if (!auth || !isStaffAuth(auth)) return {};
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

async function staffDisplayName(loginId) {
    const staff = await findStaffByLoginId(loginId);
    if (!staff) return String(loginId || "").trim();
    return getStaffCompanyName(staff) || staff.loginId || loginId;
}

async function stampNewVendorRegistration(doc, auth) {
    const me = normalizeStaffLoginId(auth && auth.userId);
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
    isSupervisorAuth,
    isStaffAuth,
    isSharedLegacyVendor,
    canReadVendor,
    canWriteVendor,
    buildVendorListQuery,
    staffDisplayName,
    stampNewVendorRegistration,
    applyRegistrationOnUpdate
};
