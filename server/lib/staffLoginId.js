/**
 * staff loginId — 저장은 원문(대소문자 유지), 비교·조회는 staffLoginIdKey(소문자) 사용
 */

function str(v) {
    return String(v ?? "").trim();
}

function trimStaffLoginId(loginId) {
    return str(loginId);
}

function staffLoginIdKey(loginId) {
    const t = str(loginId);
    return t ? t.toLowerCase() : "";
}

function staffLoginIdsEqual(a, b) {
    const ka = staffLoginIdKey(a);
    const kb = staffLoginIdKey(b);
    if (!ka || !kb) return ka === kb;
    return ka === kb;
}

function isLegacyRegisteredBy(loginId) {
    return staffLoginIdKey(loginId) === "legacy";
}

/** MongoDB $in — 저장값·레거시 소문자 등 동일 아이디 조회 */
function loginIdValues(loginId) {
    const raw = str(loginId);
    const key = staffLoginIdKey(raw);
    const vals = [];
    if (raw) vals.push(raw);
    if (key && vals.indexOf(key) < 0) vals.push(key);
    if (key === "thejohn" || key === "thejhon") {
        if (vals.indexOf("thejohn") < 0) vals.push("thejohn");
        if (vals.indexOf("thejhon") < 0) vals.push("thejhon");
    }
    return vals;
}

function registeredByInFilter(loginId) {
    const vals = loginIdValues(loginId);
    return vals.length ? { $in: vals } : { $in: ["__none__"] };
}

module.exports = {
    trimStaffLoginId,
    staffLoginIdKey,
    staffLoginIdsEqual,
    isLegacyRegisteredBy,
    loginIdValues,
    registeredByInFilter
};
