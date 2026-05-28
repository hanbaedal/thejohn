const { F } = require("./vendorFields");
const { findStaffByLoginId } = require("./loginResolve");
const { getCompanyName: getStaffCompanyName } = require("./staffFields");
const LEGACY_REGISTERED_BY = "legacy";

function normalizeStaffLoginId(loginId) {
    return String(loginId || "")
        .trim()
        .toLowerCase();
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
    const by = normalizeStaffLoginId(doc[F.registeredBy]);
    return !by || by === LEGACY_REGISTERED_BY;
}

function vendorOwnedBy(doc, staffLoginId) {
    if (!doc) return false;
    return normalizeStaffLoginId(doc[F.registeredBy]) === normalizeStaffLoginId(staffLoginId);
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

/** 예비거래처 선택 모달 — 관리자·슈퍼바이저 모두 전체 목록 조회 */
function canReadProspectForPicker(auth) {
    return isStaffAuth(auth);
}

/** 신규업체 등록 완료 — 로그인 미설정(엑셀 등) 예비거래처는 관리자도 저장 가능 */
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
    canReadProspectForPicker,
    canWriteProspectForRegistration,
    buildVendorListQuery,
    staffDisplayName,
    stampNewVendorRegistration,
    applyRegistrationOnUpdate
};
