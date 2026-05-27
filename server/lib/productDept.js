/** 사업부문 ID (클라이언트 product-catalog.js 와 동일) */
const LEGACY_DEPT_MAP = {
    livestock: "jeongyuk",
    meals: "frozen",
    banchan: "grocery"
};

/** 예전 DB·UI 에 한글·영문 혼용 저장된 경우 */
const DEPT_LABEL_TO_ID = {
    정육/건어물: "jeongyuk",
    "정육/건어물관련": "jeongyuk",
    정육/건어물: "driedfish",
    냉동식품/음료수: "frozen",
    냉동: "frozen",
    냉동수산물/공산품: "seafood",
    냉동수산물/공산품: "grocery",
    냉동식품/음료수: "drink",
    음료: "drink"
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
    let id = String(v ?? "")
        .trim()
        .toLowerCase();
    if (!id) return "";
    if (DEPT_LABEL_TO_ID[id]) return DEPT_LABEL_TO_ID[id];
    const raw = String(v).trim();
    if (DEPT_LABEL_TO_ID[raw]) return DEPT_LABEL_TO_ID[raw];
    if (LEGACY_DEPT_MAP[id]) id = LEGACY_DEPT_MAP[id];
    return VALID_DEPT_IDS.has(id) ? id : "";
}

/** DB 저장·목록 응답용 표준 부문 ID */
function normalizeDeptForStorage(v) {
    return normalizeDept(v) || "";
}

/** 목록 조회 $match — 표준 ID + 예전 ID + 한글 라벨 */
function deptQuery(deptId) {
    const norm = normalizeDept(deptId);
    if (!norm) return null;
    const ids = new Set([norm]);
    Object.keys(LEGACY_DEPT_MAP).forEach(function (legacy) {
        if (LEGACY_DEPT_MAP[legacy] === norm) ids.add(legacy);
    });
    Object.keys(DEPT_LABEL_TO_ID).forEach(function (label) {
        if (DEPT_LABEL_TO_ID[label] === norm) ids.add(label);
    });
    return { pd_dept: { $in: Array.from(ids) } };
}

function readDeptFromDoc(doc) {
    if (!doc) return "";
    const candidates = [
        doc.pd_dept,
        doc.dept,
        doc.division,
        doc.category,
        doc.business_dept,
        doc.pd_division
    ];
    for (let i = 0; i < candidates.length; i++) {
        const n = normalizeDeptForStorage(candidates[i]);
        if (n) return n;
    }
    return "";
}

module.exports = {
    LEGACY_DEPT_MAP,
    DEPT_LABEL_TO_ID,
    normalizeDept,
    normalizeDeptForStorage,
    deptQuery,
    readDeptFromDoc
};
