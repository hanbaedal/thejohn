const { getDb } = require("../db");
const { loginLookupFilter, getVendorStoredPassword } = require("./loginAccount");
const { STAFF_PROJECTION_LOGIN, STAFF_PROJECTION_NO_INTRO } = require("./staffFields");

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

/** 옛 아이디 thejhon → thejohn (staff 시드는 thejohn) */
function resolveLoginIdForLookup(loginId) {
    const trimmed = String(loginId || "").trim();
    if (normalizeId(trimmed) === "thejhon") return "thejohn";
    return trimmed;
}

function vendorLoginFilter(loginId) {
    const resolved = resolveLoginIdForLookup(loginId);
    const trimmed = String(resolved || "").trim();
    const idn = normalizeId(resolved);
    if (!trimmed) return null;

    const clauses = [{ loginIdNorm: idn }];
    const lf = loginLookupFilter(resolved);
    if (lf.$or) clauses.push.apply(clauses, lf.$or);
    else if (lf.loginId) clauses.push({ loginId: lf.loginId });

    return { $or: clauses };
}

function vendorHasLoginCredentials(doc) {
    if (!doc) return false;
    if (getVendorStoredPassword(doc)) return true;
    return !!(doc.passwordHash && String(doc.passwordHash).length);
}

function rankVendorLoginDoc(doc) {
    if (!doc) return 0;
    if (vendorHasLoginCredentials(doc)) return 2;
    if (doc.loginId) return 1;
    return 0;
}

/**
 * staff 컬렉션 — loginId로 1건 조회
 * @param {object} [opts] — login: 로그인 검증(대용량 제외), light: 소개 이미지만 제외, full: 전체
 */
async function findStaffByLoginId(loginId, opts) {
    opts = opts || {};
    const resolved = resolveLoginIdForLookup(loginId);
    const lf = loginLookupFilter(resolved);
    const filter = lf.$or ? { active: { $ne: false }, $or: lf.$or } : { active: { $ne: false }, ...lf };
    let projection = null;
    if (opts.login) projection = STAFF_PROJECTION_LOGIN;
    else if (opts.light !== false && !opts.full) projection = STAFF_PROJECTION_NO_INTRO;
    if (projection) {
        return getDb().collection("staff").findOne(filter, { projection: projection });
    }
    return getDb().collection("staff").findOne(filter);
}

/** vendors · vendor_new · (비밀번호 있는) vendor_prospects — 동일 loginId 전체 조회 */
async function findVendorDocsByLoginId(loginId) {
    const filter = vendorLoginFilter(loginId);
    if (!filter) return [];

    const db = getDb();
    const out = [];
    const seen = new Set();

    for (const colName of ["vendors", "vendor_new"]) {
        const doc = await db.collection(colName).findOne(filter);
        if (doc && doc.id && !seen.has(doc.id)) {
            seen.add(doc.id);
            out.push(doc);
        }
    }

    const prospect = await db.collection("vendor_prospects").findOne(filter);
    if (prospect && prospect.id && !seen.has(prospect.id) && vendorHasLoginCredentials(prospect)) {
        seen.add(prospect.id);
        out.push(prospect);
    }

    out.sort(function (a, b) {
        return rankVendorLoginDoc(b) - rankVendorLoginDoc(a);
    });
    return out;
}

/** 로그인·프로필용 — 비밀번호가 있는 문서 우선 */
async function findVendorByLoginId(loginId) {
    const docs = await findVendorDocsByLoginId(loginId);
    return docs.length ? docs[0] : null;
}

async function vendorAccountsHaveCredentials(loginId) {
    const docs = await findVendorDocsByLoginId(loginId);
    return docs.some(vendorHasLoginCredentials);
}

module.exports = {
    normalizeId,
    resolveLoginIdForLookup,
    vendorLoginFilter,
    vendorHasLoginCredentials,
    findStaffByLoginId,
    findVendorDocsByLoginId,
    findVendorByLoginId,
    vendorAccountsHaveCredentials
};
