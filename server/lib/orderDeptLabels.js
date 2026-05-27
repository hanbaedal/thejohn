const LEGACY_DEPT_MAP = {
    livestock: "jeongyuk",
    meals: "frozen",
    banchan: "grocery"
};

const DEPT_LABELS = {
    jeongyuk: "정육/건어물",
    driedfish: "정육/건어물",
    frozen: "냉동식품/음료수",
    seafood: "냉동수산물/공산품",
    grocery: "냉동수산물/공산품",
    drink: "냉동식품/음료수"
};

function normalizeDeptId(deptId) {
    var id = String(deptId || "")
        .trim()
        .toLowerCase();
    if (LEGACY_DEPT_MAP[id]) return LEGACY_DEPT_MAP[id];
    return id;
}

function deptLabel(deptId) {
    var id = normalizeDeptId(deptId);
    return DEPT_LABELS[id] || id || "미지정";
}

module.exports = { deptLabel, normalizeDeptId };
