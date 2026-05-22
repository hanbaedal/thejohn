/**
 * 상품소개 분야(1줄) · 메뉴 그룹(2줄) 정의.
 * 그룹 추가·수정은 이 파일에서 하면 됩니다.
 */
(function (global) {
    var DEPARTMENTS = [
        {
            id: "livestock",
            label: "축산",
            icon: "🥩",
            groups: [
                { id: "hanwoo", label: "한우·육우", desc: "한우·육우 부위별 상품" },
                { id: "pork", label: "돼지고기", desc: "국내산 돼지고기" },
                { id: "poultry", label: "닭·오리", desc: "가금류·오리고기" },
                { id: "processed-meat", label: "가공육", desc: "햄·소시지·양념육" }
            ]
        },
        {
            id: "seafood",
            label: "수산물",
            icon: "🐟",
            groups: [
                { id: "fish", label: "생선", desc: "생선·회용어류" },
                { id: "shellfish", label: "조개·굴", desc: "조개류·갑각류" },
                { id: "dried-fish", label: "건어물", desc: "말린·건조 수산물" },
                { id: "processed-sea", label: "수산가공", desc: "어묵·젓갈·반찬용 수산" }
            ]
        },
        {
            id: "meals",
            label: "식사",
            icon: "🍱",
            groups: [
                { id: "lunchbox", label: "도시락", desc: "도시락·한끼 식사" },
                { id: "ready-meal", label: "간편식", desc: "데우기만 하면 되는 식사" },
                { id: "rice-noodle", label: "면·밥", desc: "면류·밥류" },
                { id: "meal-set", label: "세트", desc: "패밀리·행사용 세트" }
            ]
        },
        {
            id: "banchan",
            label: "반찬",
            icon: "🥗",
            groups: [
                { id: "basic-banchan", label: "밑반찬", desc: "기본 반찬" },
                { id: "namul", label: "나물", desc: "나물·무침" },
                { id: "pickle", label: "절임·장아찌", desc: "절임류" },
                { id: "kimchi", label: "김치", desc: "김치·포기김치" }
            ]
        },
        {
            id: "drink",
            label: "음료",
            icon: "🥤",
            groups: [
                { id: "water-soda", label: "생수·탄산", desc: "생수·탄산음료" },
                { id: "juice", label: "주스", desc: "과일·야채 주스" },
                { id: "tea-coffee", label: "차·커피", desc: "차·커피·음료" },
                { id: "traditional-drink", label: "전통주·음료", desc: "전통 음료" }
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

    global.THEJHON_PRODUCT_CATALOG = {
        DEPARTMENTS: DEPARTMENTS,
        getDept: getDept,
        getGroups: getGroups,
        getGroup: getGroup,
        normalizeDept: normalizeDept,
        normalizeGroup: normalizeGroup,
        allDeptIds: allDeptIds
    };
})(typeof window !== "undefined" ? window : global);
