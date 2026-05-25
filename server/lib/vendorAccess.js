const { F } = require("./vendorFields");
const { findStaffByLoginId } = require("./loginResolve");
const { getCompanyName: getStaffCompanyName } = require("./staffFields");
const { SUPERVISOR_LOGIN } = require("./staffFields");

const LEGACY_REGISTERED_BY = "legacy";

function normalizeStaffLoginId(loginId) {
    return String(loginId || "")
        .trim()
        .toLowerCase();
}

function isSupervisorAuth(auth) {
    if (!auth) return false;
    if (auth.role === "supervisor") return true;
    return normalizeStaffLoginId(auth.userId) === normalizeStaffLoginId(SUPERVISOR_LOGIN);
}

function isStaffAuth(auth) {
    if (!auth) return false;
    return auth.role === "supervisor" || auth.role === "admin";
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

/**
 * MongoDB find 쿼리 — supervisor는 전체(또는 registeredBy 필터), admin은 본인+legacy
 */
function buildVendorListQuery(auth, queryRegisteredBy) {
    if (!auth || !isStaffAuth(auth)) return {};
    if (isSupervisorAuth(auth)) {
        const filterId = normalizeStaffLoginId(queryRegisteredBy);
        if (filterId && filterId !== "all") {
            if (filterId === LEGACY_REGISTERED_BY) {
                return {
                    $or: [
                        { [F.registeredBy]: LEGACY_REGISTERED_BY },
                        { [F.registeredBy]: { $exists: false } },
                        { [F.registeredBy]: "" }
                    ]
                };
            }
            return { [F.registeredBy]: filterId };
        }
        return {};
    }
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
    if (isSupervisorAuth(auth) && body && body.vn_registered_by != null) {
        const next = normalizeStaffLoginId(body.vn_registered_by);
        doc[F.registeredBy] = next;
        doc[F.registeredByName] = await staffDisplayName(next);
        doc[F.registeredAt] = existing[F.registeredAt] || Date.now();
        return doc;
    }
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
