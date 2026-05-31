const { normalizeLoginId } = require("./loginAccount");
const { F: VF } = require("./vendorFields");
const { F: PF } = require("./productFields");
const { normalizeStaffLoginId } = require("./staffFields");

function loginIdValues(oldLoginId) {
    const raw = String(oldLoginId || "").trim();
    const norm = normalizeStaffLoginId(raw);
    const vals = [];
    if (raw) vals.push(raw);
    if (norm && vals.indexOf(norm) < 0) vals.push(norm);
    if (norm === "thejohn") vals.push("thejhon");
    if (norm === "thejhon") vals.push("thejohn");
    return vals;
}

function fieldInFilter(field, oldLoginId) {
    const vals = loginIdValues(oldLoginId);
    if (!vals.length) return null;
    return { [field]: { $in: vals } };
}

/**
 * 관리자 loginId 변경 시 loginId 문자열을 참조하는 컬렉션 일괄 갱신
 */
async function propagateStaffLoginIdChange(db, oldLoginId, newLoginId, newDisplayName) {
    const newReg = normalizeStaffLoginId(newLoginId);
    const newUser = String(newLoginId || "").trim();
    if (!newReg || !newUser) return { updated: {} };

    const now = Date.now();
    const counts = {};

    async function bump(colName, filter, set) {
        if (!filter) return;
        const r = await db.collection(colName).updateMany(filter, { $set: set });
        if (r.modifiedCount) counts[colName] = (counts[colName] || 0) + r.modifiedCount;
    }

    const vendorFilter = fieldInFilter(VF.registeredBy, oldLoginId);
    const vendorSet = { [VF.registeredBy]: newReg, updatedAt: now };
    if (newDisplayName) vendorSet[VF.registeredByName] = String(newDisplayName).trim();

    for (const col of ["vendors", "vendor_new", "vendor_prospects"]) {
        await bump(col, vendorFilter, vendorSet);
    }

    const productFilter = fieldInFilter(PF.registeredBy, oldLoginId);
    const productSet = {
        [PF.registeredBy]: newReg,
        updatedAt: now
    };
    if (newDisplayName) productSet[PF.registeredByName] = String(newDisplayName).trim();
    await bump("products", productFilter, productSet);

    await bump(
        "orders",
        fieldInFilter("vendorRegisteredBy", oldLoginId),
        {
            vendorRegisteredBy: newReg,
            updatedAt: now,
            ...(newDisplayName ? { vendorRegisteredByName: String(newDisplayName).trim() } : {})
        }
    );

    await bump(
        "vendor_email_history",
        fieldInFilter("senderId", oldLoginId),
        { senderId: newUser }
    );

    await bump(
        "access_logs",
        fieldInFilter("userId", oldLoginId),
        { userId: newUser }
    );
    await bump(
        "access_logs",
        fieldInFilter("vendorRegisteredBy", oldLoginId),
        { vendorRegisteredBy: newReg }
    );

    await bump(
        "support_news",
        fieldInFilter("sn_created_by", oldLoginId),
        { sn_created_by: newUser, updatedAt: now }
    );
    await bump(
        "support_news_comments",
        fieldInFilter("snc_author_user_id", oldLoginId),
        { snc_author_user_id: newUser, updatedAt: now }
    );
    await bump(
        "support_board",
        fieldInFilter("sb_author_user_id", oldLoginId),
        { sb_author_user_id: newUser, updatedAt: now }
    );
    await bump(
        "support_inquiry",
        fieldInFilter("si_from_user_id", oldLoginId),
        { si_from_user_id: newUser, updatedAt: now }
    );
    await bump(
        "support_inquiry",
        fieldInFilter("si_reply_by", oldLoginId),
        { si_reply_by: newUser, updatedAt: now }
    );

    return { updated: counts, newLoginId: newUser, newRegisteredBy: newReg };
}

function loginIdsEquivalent(a, b) {
    return normalizeLoginId(a) === normalizeLoginId(b);
}

module.exports = {
    propagateStaffLoginIdChange,
    loginIdsEquivalent,
    loginIdValues
};
