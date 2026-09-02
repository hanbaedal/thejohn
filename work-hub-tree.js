/**
 * 그룹 마케팅 관리 — 사이드바 메뉴 트리 (단일 출처)
 */
(function (global) {
    "use strict";

    var TREE = [
        {
            id: "main",
            title: "기본",
            items: [
                { id: "view-home", label: "홈페이지", href: "index.html" },
                {
                    id: "manage-home",
                    label: "홈페이지 관리하기",
                    href: "support-news-admin.html",
                    children: [
                        { id: "support-news", label: "최근소식 입력", href: "support-news-admin.html" },
                        { id: "support-qna", label: "자유게시판", href: "support-qna-admin.html" },
                        { id: "support-inquiry", label: "문의사항 답변", href: "support-inquiry.html?manage=1" }
                    ]
                }
            ]
        },
        {
            id: "catalog",
            title: "상품 · 업체",
            items: [
                {
                    id: "product-manage",
                    label: "상품관리",
                    href: "product-register.html",
                    children: [
                        { id: "product-register", label: "상품 등록", href: "product-register.html" },
                        { id: "product-list", label: "상품 리스트", href: "product-list-admin.html" }
                    ]
                },
                {
                    id: "vendor-manage",
                    label: "업체관리",
                    href: "vendor-register.html",
                    children: [
                        { id: "vendor-register", label: "업체 등록", href: "vendor-register.html" },
                        { id: "vendor-list", label: "업체 리스트", href: "vendor-list-admin.html" },
                        { id: "vendor-dm", label: "업체별 DM 출력", href: "vendor-dm-print.html" },
                        { id: "vendor-email", label: "이메일 보내기", href: "vendor-email-broadcast.html" },
                        { id: "vendor-email-history", label: "이메일 발송 내역", href: "vendor-email-history.html" },
                        { id: "vendor-new-register", label: "신규업체 등록", href: "vendor-new-register.html" },
                        { id: "vendor-new-list", label: "신규업체 리스트", href: "vendor-new-list.html" },
                        {
                            id: "vendor-prospect-finder",
                            label: "예비 업체 찾기",
                            href: "vendor-prospect-finder.html",
                            adminOnly: true
                        },
                        { id: "vendor-prospect-list", label: "예비업체 리스트", href: "vendor-prospect-list.html" }
                    ]
                }
            ]
        },
        {
            id: "sales",
            title: "영업",
            roles: ["admin", "supervisor"],
            items: [
                {
                    id: "order-manage",
                    label: "영업관리",
                    href: "supervisor-order-list.html",
                    children: [
                        { id: "order-list", label: "주문서", href: "supervisor-order-list.html" },
                        { id: "transaction-list", label: "거래명세서", href: "transaction-list.html" },
                        { id: "sales-ledger", label: "매출장", href: "sales-ledger-by-vendor.html" },
                        { id: "tax-invoice", label: "세금계산서 발부", href: "tax-invoice.html" },
                        {
                            id: "marketing-register",
                            label: "마케팅 자료 등록하기",
                            href: "marketing-material-register.html"
                        },
                        { id: "marketing-list", label: "마케팅 자료 리스트", href: "marketing-material-list.html" }
                    ]
                }
            ]
        },
        {
            id: "supervisor",
            title: "슈퍼바이저",
            roles: ["supervisor"],
            items: [
                {
                    id: "work-manage",
                    label: "업무관리",
                    href: "staff-manage.html",
                    children: [
                        { id: "staff-register", label: "관리자 등록", href: "staff-manage.html" },
                        { id: "staff-list", label: "관리자 리스트", href: "staff-list-admin.html" },
                        { id: "usage-stats", label: "접속·이용 통계", href: "supervisor-usage-stats.html" },
                        { id: "db-stats", label: "디비사용 통계", href: "supervisor-db-stats.html" },
                        { id: "solapi-stats", label: "SOLAPI 이용 현황", href: "supervisor-solapi-stats.html" },
                        { id: "docs", label: "문서 다운로드", href: "system-structure-docs.html" }
                    ]
                }
            ]
        },
        {
            id: "account",
            title: "계정",
            items: [{ id: "self-edit", label: "관리자 정보 수정", href: "staff-self-edit.html" }]
        }
    ];

    function normRole(role) {
        return String(role || "")
            .trim()
            .toLowerCase();
    }

    function canManageRegisters() {
        var Auth = global.THEJHON_AUTH;
        return !!(Auth && Auth.canManageRegisters && Auth.canManageRegisters());
    }

    function sectionAllowed(section, role) {
        if (!section.roles || !section.roles.length) return true;
        return section.roles.indexOf(role) >= 0;
    }

    function filterChildren(children) {
        if (!children || !children.length) return [];
        var allowAdmin = canManageRegisters();
        return children.filter(function (ch) {
            if (ch.adminOnly && !allowAdmin) return false;
            return true;
        });
    }

    function visibleTree(role) {
        var r = normRole(role);
        var out = [];
        TREE.forEach(function (section) {
            if (!sectionAllowed(section, r)) return;
            var items = [];
            (section.items || []).forEach(function (item) {
                items.push({
                    id: item.id,
                    label: item.label,
                    href: item.href,
                    children: filterChildren(item.children)
                });
            });
            if (items.length) {
                out.push({ id: section.id, title: section.title, items: items });
            }
        });
        return out;
    }

    function countLeaves(tree) {
        var n = 0;
        tree.forEach(function (section) {
            section.items.forEach(function (item) {
                if (item.children && item.children.length) n += item.children.length;
                else n += 1;
            });
        });
        return n;
    }

    function resolveOrderListHref(role) {
        var Auth = global.THEJHON_AUTH;
        if (Auth && Auth.getOrderManageHubLinks) {
            var links = Auth.getOrderManageHubLinks();
            if (links && links.list) return links.list;
        }
        return normRole(role) === "supervisor"
            ? "supervisor-order-list.html"
            : "order-list-admin.html";
    }

    function treeForRole(role) {
        var tree = visibleTree(role);
        var orderHref = resolveOrderListHref(role);
        tree.forEach(function (section) {
            section.items.forEach(function (item) {
                if (item.id === "order-manage") {
                    item.href = orderHref;
                    if (item.children && item.children.length) {
                        item.children.forEach(function (ch) {
                            if (ch.id === "order-list") ch.href = orderHref;
                        });
                    }
                }
            });
        });
        return tree;
    }

    global.THEJHON_WORK_HUB_TREE = {
        TREE: TREE,
        visibleTree: visibleTree,
        treeForRole: treeForRole,
        countLeaves: countLeaves,
        normRole: normRole
    };
})(typeof window !== "undefined" ? window : this);
