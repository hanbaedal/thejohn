/**
 * 사업부문 분야(1줄) · 메뉴 그룹(2줄) 정의.
 * 그룹 추가·수정은 이 파일에서 하면 됩니다.
 */
(function (global) {
    /** 예전 부문 ID → 현재 ID (DB·URL 호환) */
    var LEGACY_DEPT_MAP = {
        livestock: "jeongyuk",
        meals: "frozen",
        banchan: "grocery"
    };

    var DEPARTMENTS = [
        {
            id: "jeongyuk",
            label: "정육",
            icon: "🥩",
            groups: [
                { id: "hanwoo", label: "한우·육우", desc: "한우·육우 부위별 상품" },
                { id: "pork", label: "돼지고기", desc: "국내산 돼지고기" },
                { id: "poultry", label: "닭·오리", desc: "가금류·오리고기" },
                { id: "processed-meat", label: "가공육", desc: "햄·소시지·양념육" }
            ]
        },
        {
            id: "driedfish",
            label: "건어물",
            icon: "🐟",
            groups: [
                { id: "anchovy-broth", label: "멸치·다시", desc: "멸치·다시용 건어물" },
                { id: "dried-shrimp", label: "건새우·건오징어", desc: "건새우·건오징어류" },
                { id: "dried-sea", label: "기타 건어물", desc: "건조 수산물" },
                { id: "dried-gift", label: "선물·세트", desc: "건어물 세트" }
            ]
        },
        {
            id: "frozen",
            label: "냉동식품",
            icon: "🧊",
            groups: [
                { id: "frozen-meat", label: "냉동육", desc: "냉동 육류" },
                { id: "frozen-sea", label: "냉동수산", desc: "냉동 수산물" },
                { id: "frozen-meal", label: "냉동간편식", desc: "냉동 간편식" },
                { id: "frozen-other", label: "기타 냉동", desc: "기타 냉동식품" }
            ]
        },
        {
            id: "seafood",
            label: "수산물",
            icon: "🦐",
            groups: [
                { id: "fish", label: "생선", desc: "생선·회용어류" },
                { id: "shellfish", label: "조개·굴", desc: "조개류·갑각류" },
                { id: "processed-sea", label: "수산가공", desc: "어묵·젓갈 등" },
                { id: "sea-other", label: "기타 수산", desc: "기타 수산물" }
            ]
        },
        {
            id: "grocery",
            label: "공산품",
            icon: "🛒",
            groups: [
                { id: "seasoning", label: "조미료·양념", desc: "조미료·양념류" },
                { id: "grain-noodle", label: "면·곡물", desc: "면·쌀·곡물" },
                { id: "daily", label: "일용·주방", desc: "일용·주방 공산품" },
                { id: "grocery-other", label: "기타 공산", desc: "기타 공산품" }
            ]
        },
        {
            id: "drink",
            label: "음료수",
            icon: "🥤",
            groups: [
                { id: "water-soda", label: "생수·탄산", desc: "생수·탄산음료" },
                { id: "juice", label: "주스", desc: "과일·야채 주스" },
                { id: "tea-coffee", label: "차·커피", desc: "차·커피·음료" },
                { id: "drink-other", label: "기타 음료", desc: "기타 음료수" }
            ]
        }
    ];

    var deptById = {};
    var groupByDept = {};

    DEPARTMENTS.forEach(function (d) {
        deptById[d.id] = d;
        groupByDept[d.id] = {};
        (d.groups || []).forEach(function (g) {
            groupByDept[d.id][g.id] = g;
        });
    });

    function normalizeDept(v) {
        var id = String(v || "").trim().toLowerCase();
        if (LEGACY_DEPT_MAP[id]) id = LEGACY_DEPT_MAP[id];
        return deptById[id] ? id : "";
    }

    function normalizeGroup(deptId, v) {
        var d = normalizeDept(deptId);
        if (!d) return "";
        var gid = String(v || "").trim().toLowerCase();
        return groupByDept[d] && groupByDept[d][gid] ? gid : "";
    }

    function getDept(id) {
        return deptById[normalizeDept(id)] || null;
    }

    function getGroups(deptId) {
        var d = getDept(deptId);
        return d && d.groups ? d.groups.slice() : [];
    }

    function getGroup(deptId, groupId) {
        var d = normalizeDept(deptId);
        var g = normalizeGroup(d, groupId);
        return g && groupByDept[d] ? groupByDept[d][g] : null;
    }

    function allDeptIds() {
        return DEPARTMENTS.map(function (d) {
            return d.id;
        });
    }

    function companyPageForDept(deptId) {
        var id = normalizeDept(deptId);
        return id ? "company-" + id + ".html" : "company.html";
    }

    global.THEJHON_PRODUCT_CATALOG = {
        DEPARTMENTS: DEPARTMENTS,
        LEGACY_DEPT_MAP: LEGACY_DEPT_MAP,
        getDept: getDept,
        getGroups: getGroups,
        getGroup: getGroup,
        normalizeDept: normalizeDept,
        normalizeGroup: normalizeGroup,
        allDeptIds: allDeptIds,
        companyPageForDept: companyPageForDept
    };
})(typeof window !== "undefined" ? window : global);
