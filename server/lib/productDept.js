/** 사업부문 ID (클라이언트 product-catalog.js 와 동일) */
const LEGACY_DEPT_MAP = {
    livestock: "jeongyuk",
    meals: "frozen",
    banchan: "grocery"
};

const VALID_DEPT_IDS = new Set([
    "jeongyuk",
    "driedfish",
    "frozen",
    "seafood",
    "grocery",
    "drink"
]);

function normalizeDept(v) {
    let id = String(v || "")
        .trim()
        .toLowerCase();
    if (LEGACY_DEPT_MAP[id]) id = LEGACY_DEPT_MAP[id];
    return VALID_DEPT_IDS.has(id) ? id : "";
}

/** DB pd_dept 가 예전 ID 인 경우 포함 */
function deptQuery(deptId) {
    const norm = normalizeDept(deptId);
    if (!norm) return null;
    const ids = new Set([norm]);
    Object.keys(LEGACY_DEPT_MAP).forEach(function (legacy) {
        if (LEGACY_DEPT_MAP[legacy] === norm) ids.add(legacy);
    });
    return { pd_dept: { $in: Array.from(ids) } };
}

module.exports = {
    LEGACY_DEPT_MAP,
    normalizeDept,
    deptQuery
};
