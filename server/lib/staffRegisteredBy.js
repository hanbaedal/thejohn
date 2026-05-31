const { getDb } = require("../db");
const { findStaffByLoginId } = require("./loginLookup");
const {
    LEGACY_PROTECTED_STAFF_DOC_IDS,
    getCompanyName
} = require("./staffFields");
const { F: VF } = require("./vendorFields");
const { F: PF } = require("./productFields");
const {
    trimStaffLoginId,
    staffLoginIdKey,
    staffLoginIdsEqual,
    isLegacyRegisteredBy,
    loginIdValues
} = require("./staffLoginId");
const {
    propagateStaffLoginIdChange
} = require("./staffLoginIdMigration");

function aliasKeysForStaffDoc(doc) {
    const keys = loginIdValues(doc.loginId);
    (doc.previousLoginIds || []).forEach(function (id) {
        loginIdValues(id).forEach(function (v) {
            if (keys.indexOf(v) < 0) keys.push(v);
        });
    });
    return keys;
}

async function findLegacyStaffByRegisteredBy(db, vals) {
    for (let i = 0; i < LEGACY_PROTECTED_STAFF_DOC_IDS.length; i++) {
        const legacyId = LEGACY_PROTECTED_STAFF_DOC_IDS[i];
        const doc = await db.collection("staff").findOne({
            id: legacyId,
            active: { $ne: false }
        });
        if (!doc) continue;
        const aliases = aliasKeysForStaffDoc(doc);
        for (let j = 0; j < vals.length; j++) {
            for (let k = 0; k < aliases.length; k++) {
                if (staffLoginIdsEqual(vals[j], aliases[k])) return doc;
            }
        }
    }
    return null;
}

/** 업체·상품 vn/pd_registered_by → staff(admin) 조회 (아이디 변경·이전 loginId 포함) */
async function findStaffByRegisteredBy(registeredBy) {
    const reg = trimStaffLoginId(registeredBy);
    if (!reg || isLegacyRegisteredBy(reg)) return null;

    let staff = await findStaffByLoginId(reg);
    if (staff && (staff.role === "admin" || staff.role === "supervisor")) return staff;

    const db = getDb();
    const vals = loginIdValues(reg);

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
    if (!staff) return trimStaffLoginId(registeredBy);
    return trimStaffLoginId(staff.loginId);
}

function appendPreviousLoginIds(existing, oldLoginId) {
    const prevIds = Array.isArray(existing.previousLoginIds)
        ? existing.previousLoginIds.slice()
        : [];
    loginIdValues(oldLoginId).forEach(function (v) {
        const stored = trimStaffLoginId(v);
        if (!stored) return;
        if (prevIds.some(function (p) { return staffLoginIdsEqual(p, stored); })) return;
        prevIds.push(stored);
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
        const currentLogin = trimStaffLoginId(staff.loginId);
        if (!currentLogin) continue;

        const aliasMap = {};
        function addAlias(id) {
            const stored = trimStaffLoginId(id);
            if (!stored || staffLoginIdsEqual(stored, currentLogin)) return;
            aliasMap[staffLoginIdKey(stored)] = stored;
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

/** 서버 기동 — vn/pd_registered_by 등이 소문자로 저장된 레거시 데이터를 staff.loginId 원문으로 정규화 */
async function reconcileRegisteredByCase(db) {
    const admins = await db
        .collection("staff")
        .find({ role: { $in: ["admin", "supervisor"] }, active: { $ne: false } })
        .toArray();
    let total = 0;
    const now = Date.now();

    const targets = [
        { col: "vendors", field: VF.registeredBy, nameField: VF.registeredByName },
        { col: "vendor_new", field: VF.registeredBy, nameField: VF.registeredByName },
        { col: "vendor_prospects", field: VF.registeredBy, nameField: VF.registeredByName },
        { col: "products", field: PF.registeredBy, nameField: PF.registeredByName },
        { col: "orders", field: "vendorRegisteredBy", nameField: "vendorRegisteredByName" }
    ];

    for (let a = 0; a < admins.length; a++) {
        const staff = admins[a];
        const canonical = trimStaffLoginId(staff.loginId);
        if (!canonical || isLegacyRegisteredBy(canonical)) continue;
        const vals = loginIdValues(canonical);
        const displayName = getCompanyName(staff) || trimStaffLoginId(staff.st_company) || "";

        for (let t = 0; t < targets.length; t++) {
            const target = targets[t];
            const docs = await db
                .collection(target.col)
                .find({ [target.field]: { $in: vals } })
                .toArray();

            for (let d = 0; d < docs.length; d++) {
                const doc = docs[d];
                const current = trimStaffLoginId(doc[target.field]);
                if (!current || !staffLoginIdsEqual(current, canonical) || current === canonical) {
                    continue;
                }
                const set = { [target.field]: canonical, updatedAt: now };
                if (displayName && target.nameField) set[target.nameField] = displayName;
                const r = await db.collection(target.col).updateOne({ _id: doc._id }, { $set: set });
                if (r.modifiedCount) total += r.modifiedCount;
            }
        }
    }

    if (total) console.log("[staff] reconciled registered_by case:", total);
    return total;
}

module.exports = {
    findStaffByRegisteredBy,
    registeredByResolvesToStaffLoginId,
    appendPreviousLoginIds,
    reconcileStaleRegisteredByReferences,
    reconcileRegisteredByCase
};
