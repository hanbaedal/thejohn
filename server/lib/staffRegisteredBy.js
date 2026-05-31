const { getDb } = require("../db");
const { findStaffByLoginId } = require("./loginResolve");
const {
    LEGACY_PROTECTED_STAFF_DOC_IDS,
    normalizeStaffLoginId,
    getCompanyName
} = require("./staffFields");
const {
    loginIdValues,
    loginIdsEquivalent,
    propagateStaffLoginIdChange
} = require("./staffLoginIdMigration");

async function findLegacyStaffByRegisteredBy(db, vals) {
    for (let i = 0; i < LEGACY_PROTECTED_STAFF_DOC_IDS.length; i++) {
        const legacyId = LEGACY_PROTECTED_STAFF_DOC_IDS[i];
        const doc = await db.collection("staff").findOne({
            id: legacyId,
            active: { $ne: false }
        });
        if (!doc) continue;
        const aliases = [normalizeStaffLoginId(doc.loginId)]
            .concat((doc.previousLoginIds || []).map(normalizeStaffLoginId))
            .filter(Boolean);
        for (let j = 0; j < vals.length; j++) {
            if (aliases.indexOf(vals[j]) >= 0) return doc;
        }
    }
    return null;
}

/** 업체·상품 vn/pd_registered_by → staff(admin) 조회 (아이디 변경·이전 loginId 포함) */
async function findStaffByRegisteredBy(registeredBy) {
    const reg = String(registeredBy || "").trim();
    if (!reg || normalizeStaffLoginId(reg) === "legacy") return null;

    let staff = await findStaffByLoginId(reg);
    if (staff && (staff.role === "admin" || staff.role === "supervisor")) return staff;

    const db = getDb();
    const vals = loginIdValues(reg)
        .map(normalizeStaffLoginId)
        .filter(Boolean);

    staff = await db.collection("staff").findOne({
        role: "admin",
        active: { $ne: false },
        previousLoginIds: { $in: vals }
    });
    if (staff) return staff;

    return findLegacyStaffByRegisteredBy(db, vals);
}

async function registeredByResolvesToStaffLoginId(registeredBy) {
    const staff = await findStaffByRegisteredBy(registeredBy);
    if (!staff) return normalizeStaffLoginId(registeredBy);
    return normalizeStaffLoginId(staff.loginId);
}

function appendPreviousLoginIds(existing, oldLoginId) {
    const prevIds = Array.isArray(existing.previousLoginIds)
        ? existing.previousLoginIds.slice()
        : [];
    loginIdValues(oldLoginId).forEach(function (v) {
        const n = normalizeStaffLoginId(v);
        if (n && prevIds.indexOf(n) < 0) prevIds.push(n);
    });
    return prevIds;
}

/** 서버 기동 — 관리자 loginId 변경 후 남은 옛 registered_by 일괄 갱신 */
async function reconcileStaleRegisteredByReferences(db) {
    const col = db.collection("staff");
    const admins = await col.find({ role: "admin", active: { $ne: false } }).toArray();
    let total = 0;

    for (let a = 0; a < admins.length; a++) {
        const staff = admins[a];
        const currentLogin = String(staff.loginId || "").trim();
        if (!currentLogin) continue;

        const aliasMap = {};
        function addAlias(id) {
            const n = normalizeStaffLoginId(id);
            if (!n || loginIdsEquivalent(n, currentLogin)) return;
            aliasMap[n] = String(id).trim() || n;
        }

        (staff.previousLoginIds || []).forEach(addAlias);

        const aliasKeys = Object.keys(aliasMap);
        for (let i = 0; i < aliasKeys.length; i++) {
            const oldId = aliasMap[aliasKeys[i]];
            const result = await propagateStaffLoginIdChange(
                db,
                oldId,
                currentLogin,
                getCompanyName(staff) || staff.st_company || ""
            );
            const updated = (result && result.updated) || {};
            Object.keys(updated).forEach(function (k) {
                total += updated[k] || 0;
            });
        }
    }

    if (total) console.log("[staff] reconciled stale registered_by refs:", total);
    return total;
}

module.exports = {
    findStaffByRegisteredBy,
    registeredByResolvesToStaffLoginId,
    appendPreviousLoginIds,
    reconcileStaleRegisteredByReferences
};
