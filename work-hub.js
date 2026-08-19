/**
 * 그룹 마케팅 관리 — 섹션 + 아코디언 하위 메뉴
 * 슈퍼바이저 6 · 주문 관리자 5 · 일반 관리자 4
 */
(function () {
    "use strict";

    var LOGIN_PAGE = "login.html";
    var HUB_PAGE = "work-hub.html";

    var TREE = [
        {
            id: "main",
            title: "기본",
            items: [
                { id: "view-home", label: "홈페이지", href: "index.html" },
                {
                    id: "manage-home",
                    label: "홈페이지 관리하기",
                    href: "homepage-manage-hub.html",
                    children: [
                        { id: "support-news", label: "최근소식 입력", href: "support-news-admin.html" },
                        { id: "support-qna", label: "자유게시판", href: "support-qna-admin.html" },
                        { id: "support-inquiry", label: "문의사항 답변", href: "support-inquiry.html" }
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
                    href: "product-manage.html",
                    children: [
                        { id: "product-register", label: "상품 등록", href: "product-register.html" },
                        { id: "product-list", label: "상품 리스트", href: "product-list-admin.html" }
                    ]
                },
                {
                    id: "vendor-manage",
                    label: "업체관리",
                    href: "vendor-manage.html",
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
                    href: "order-manage-hub.html",
                    children: [
                        { id: "order-list", label: "주문서", href: "supervisor-order-list.html" },
                        { id: "transaction-list", label: "거래명세서", href: "transaction-list.html" },
                        { id: "sales-ledger", label: "매출장", href: "sales-ledger-hub.html" },
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
                    href: "staff-manage-hub.html",
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
            items: [
                { id: "self-edit", label: "관리자 정보 수정", href: "staff-self-edit.html" }
            ]
        }
    ];

    var statusEl = document.getElementById("whStatus");
    var menuEl = document.getElementById("whMenu");
    var homeEl = document.getElementById("whHome");
    var sidebarEl = document.getElementById("whSidebar");
    var toggleEl = document.getElementById("whMenuToggle");
    var backdropEl = document.getElementById("whSidebarBackdrop");

    function normRole(role) {
        return String(role || "")
            .trim()
            .toLowerCase();
    }

    function canManageRegisters() {
        var Auth = window.THEJHON_AUTH;
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
        var out = [];
        TREE.forEach(function (section) {
            if (!sectionAllowed(section, role)) return;
            var items = [];
            (section.items || []).forEach(function (item) {
                var copy = {
                    id: item.id,
                    label: item.label,
                    href: item.href,
                    children: filterChildren(item.children)
                };
                items.push(copy);
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

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text || "";
        statusEl.className = "wh-status" + (isError ? " wh-status--err" : "");
    }

    function goLogin() {
        window.location.replace(LOGIN_PAGE + "?next=" + encodeURIComponent(HUB_PAGE));
    }

    function refreshHeaderChrome() {
        if (typeof window.__thejhonRefreshHeaderCompany === "function") {
            try {
                window.__thejhonRefreshHeaderCompany();
            } catch (e) {}
        }
    }

    function syncAuthFromSession(sess) {
        var Auth = window.THEJHON_AUTH;
        if (!Auth || !sess || !sess.loggedIn) return;
        if (Auth.syncRoleFromSession) Auth.syncRoleFromSession(sess);
        if (Auth.syncStaffOrderEnabledFromSession) Auth.syncStaffOrderEnabledFromSession(sess);
        if (Auth.syncSessionCompanyFromApi) Auth.syncSessionCompanyFromApi(sess);
    }

    function buildSessionFromAuth() {
        var Auth = window.THEJHON_AUTH;
        if (!Auth || !Auth.getWorkHubAccess) return null;
        var access = Auth.getWorkHubAccess();
        if (!access || !access.allowed) return null;
        return {
            loggedIn: true,
            role: Auth.getRole ? Auth.getRole() : access.role,
            staffOrderEnabled: Auth.isStaffOrderEnabled ? Auth.isStaffOrderEnabled() : false
        };
    }

    function closeMobileSidebar() {
        document.body.classList.remove("wh-sidebar-open");
        if (toggleEl) toggleEl.setAttribute("aria-expanded", "false");
        if (backdropEl) backdropEl.hidden = true;
    }

    function openMobileSidebar() {
        document.body.classList.add("wh-sidebar-open");
        if (toggleEl) toggleEl.setAttribute("aria-expanded", "true");
        if (backdropEl) backdropEl.hidden = false;
    }

    function bindSidebarChrome() {
        if (toggleEl && !toggleEl._whBound) {
            toggleEl._whBound = true;
            toggleEl.addEventListener("click", function () {
                if (document.body.classList.contains("wh-sidebar-open")) closeMobileSidebar();
                else openMobileSidebar();
            });
        }
        if (backdropEl && !backdropEl._whBound) {
            backdropEl._whBound = true;
            backdropEl.addEventListener("click", closeMobileSidebar);
        }
    }

    function renderMenu(role) {
        if (!menuEl) return;
        menuEl.innerHTML = "";
        var tree = visibleTree(role);
        tree.forEach(function (section) {
            var sec = document.createElement("div");
            sec.className = "wh-section";
            var title = document.createElement("p");
            title.className = "wh-section-title";
            title.textContent = section.title;
            sec.appendChild(title);

            section.items.forEach(function (item) {
                var wrap = document.createElement("div");
                wrap.className = "wh-item";
                if (item.children && item.children.length) {
                    var btn = document.createElement("button");
                    btn.type = "button";
                    btn.className = "wh-parent";
                    btn.setAttribute("aria-expanded", "false");
                    var label = document.createElement("span");
                    label.textContent = item.label;
                    var chevron = document.createElement("span");
                    chevron.className = "wh-chevron";
                    chevron.setAttribute("aria-hidden", "true");
                    btn.appendChild(label);
                    btn.appendChild(chevron);
                    btn.addEventListener("click", function () {
                        var open = !btn.classList.contains("is-open");
                        btn.classList.toggle("is-open", open);
                        btn.setAttribute("aria-expanded", open ? "true" : "false");
                    });
                    wrap.appendChild(btn);
                    var kids = document.createElement("div");
                    kids.className = "wh-children";
                    item.children.forEach(function (ch) {
                        var a = document.createElement("a");
                        a.className = "wh-child";
                        a.href = ch.href;
                        a.textContent = ch.label;
                        kids.appendChild(a);
                    });
                    wrap.appendChild(kids);
                } else {
                    var leaf = document.createElement("a");
                    leaf.className = "wh-leaf";
                    leaf.href = item.href;
                    leaf.textContent = item.label;
                    wrap.appendChild(leaf);
                }
                sec.appendChild(wrap);
            });
            menuEl.appendChild(sec);
        });
        renderHome(tree);
    }

    function renderHome(tree) {
        if (!homeEl) return;
        homeEl.innerHTML = "";
        tree.forEach(function (section) {
            section.items.forEach(function (item) {
                var a = document.createElement("a");
                a.className = "wh-card";
                a.href = item.href || (item.children && item.children[0] ? item.children[0].href : HUB_PAGE);
                var h = document.createElement("h2");
                h.textContent = item.label;
                var p = document.createElement("p");
                if (item.children && item.children.length) {
                    p.textContent = item.children
                        .map(function (ch) {
                            return ch.label;
                        })
                        .join(" · ");
                } else {
                    p.textContent = section.title;
                }
                a.appendChild(h);
                a.appendChild(p);
                homeEl.appendChild(a);
            });
        });
    }

    function roleLabel(role) {
        if (normRole(role) === "supervisor") return "슈퍼바이저";
        if (normRole(role) === "admin") return "관리자";
        return role || "";
    }

    function applySession(sess) {
        if (!sess || !sess.loggedIn) {
            setStatus("로그인이 필요합니다.", true);
            goLogin();
            return;
        }

        var role = normRole(sess.role);
        if (role !== "supervisor" && role !== "admin") {
            setStatus("관리자·슈퍼바이저만 이용할 수 있습니다.", true);
            window.location.replace("index.html");
            return;
        }

        syncAuthFromSession(sess);
        renderMenu(role);

        var tree = visibleTree(role);
        setStatus(roleLabel(role) + " · 메뉴 " + countLeaves(tree) + "개", false);
        refreshHeaderChrome();
    }

    function onRemoteSession(sess) {
        if (sess && sess.code === "SESSION_INVALID") {
            setStatus(sess.error || "세션이 만료되었습니다.", true);
            goLogin();
            return;
        }
        if (sess && sess.loggedIn) {
            applySession(sess);
        }
    }

    function load() {
        var Api = window.THEJHON_API;
        var Auth = window.THEJHON_AUTH;
        bindSidebarChrome();

        if (!Api || !Api.getToken || !Api.getToken()) {
            setStatus("로그인이 필요합니다.", true);
            goLogin();
            return;
        }

        var access = Auth && Auth.getWorkHubAccess ? Auth.getWorkHubAccess() : { allowed: false };
        if (!access.allowed) {
            setStatus(access.reason || "로그인이 필요합니다.", true);
            goLogin();
            return;
        }

        var cached = buildSessionFromAuth();
        if (cached) {
            applySession(cached);
        } else {
            setStatus("메뉴 불러오는 중…", false);
        }

        window.addEventListener("thejhon-auth-permissions-updated", function () {
            var local = buildSessionFromAuth();
            if (local) applySession(local);
        });

        if (Auth && Auth.refreshSessionPermissionsAsync) {
            Auth.refreshSessionPermissionsAsync()
                .then(onRemoteSession)
                .catch(function (err) {
                    if (!cached) {
                        setStatus((err && err.message) || "권한 확인에 실패했습니다.", true);
                    }
                });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", load, { once: true });
    } else {
        load();
    }
})();
