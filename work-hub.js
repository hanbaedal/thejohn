/**
 * 그룹 마케팅 관리 — 역할별 메뉴만 표시·링크 이동
 * 슈퍼바이저 6 · 주문 관리자 5 · 일반 관리자 4
 */
(function () {
    "use strict";

    var LOGIN_PAGE = "login.html";
    var HUB_PAGE = "work-hub.html";

    var BASE = [
        { id: "view-home", label: "홈페이지", href: "index.html" },
        { id: "manage-home", label: "홈페이지 관리하기", href: "homepage-manage-hub.html" },
        { id: "product-manage", label: "상품관리", href: "product-manage.html" },
        { id: "vendor-manage", label: "업체관리", href: "vendor-manage.html" }
    ];

    var EXTRA = {
        order: { id: "order-manage", label: "주문서 관리", href: "order-manage-hub.html" },
        work: { id: "work-manage", label: "업무관리", href: "staff-manage-hub.html" }
    };

    var statusEl = document.getElementById("whStatus");
    var menuEl = document.getElementById("whMenu");

    function normRole(role) {
        return String(role || "")
            .trim()
            .toLowerCase();
    }

    function menusFor(role, orderEnabled) {
        var r = normRole(role);
        if (r === "supervisor") {
            return BASE.concat([EXTRA.order, EXTRA.work]);
        }
        if (r === "admin") {
            return orderEnabled ? BASE.concat([EXTRA.order]) : BASE.slice();
        }
        return [];
    }

    function setStatus(text, isError) {
        if (!statusEl) return;
        statusEl.textContent = text || "";
        statusEl.className = "wh-status" + (isError ? " wh-status--err" : "");
    }

    function goLogin() {
        var next = HUB_PAGE;
        window.location.replace(LOGIN_PAGE + "?next=" + encodeURIComponent(next));
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

    /** sessionStorage·토큰 — API 대기 없이 메뉴 표시 */
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

    function itemMap() {
        var map = {};
        BASE.forEach(function (it) {
            map[it.id] = it;
        });
        map[EXTRA.order.id] = EXTRA.order;
        map[EXTRA.work.id] = EXTRA.work;
        return map;
    }

    function menuGroupsFor(role, orderEnabled) {
        var groups = [
            { ids: ["view-home", "manage-home"] },
            { ids: ["product-manage", "vendor-manage"] }
        ];
        var r = normRole(role);
        if (r === "supervisor") {
            groups.push({ ids: ["order-manage", "work-manage"] });
        } else if (r === "admin" && orderEnabled) {
            groups.push({ ids: ["order-manage"] });
        }
        return groups;
    }

    function renderMenu(role, orderEnabled) {
        if (!menuEl) return;
        menuEl.innerHTML = "";
        var map = itemMap();
        menuGroupsFor(role, orderEnabled).forEach(function (group) {
            var wrap = document.createElement("div");
            wrap.className = "wh-group";
            group.ids.forEach(function (id) {
                var item = map[id];
                if (!item) return;
                var a = document.createElement("a");
                a.className = "wh-link";
                a.href = item.href;
                a.textContent = item.label;
                wrap.appendChild(a);
            });
            if (wrap.childElementCount) menuEl.appendChild(wrap);
        });
    }

    function appendSelfEditLink() {
        if (!menuEl) return;
        var spacer = document.createElement("div");
        spacer.className = "wh-menu-spacer";
        spacer.setAttribute("aria-hidden", "true");
        menuEl.appendChild(spacer);
        var a = document.createElement("a");
        a.className = "wh-link wh-link--self";
        a.href = "staff-self-edit.html";
        a.textContent = "관리자 정보 수정";
        menuEl.appendChild(a);
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

        var orderOn = !!sess.staffOrderEnabled;
        var items = menusFor(role, orderOn);
        renderMenu(role, orderOn);
        appendSelfEditLink();

        var hint = roleLabel(role) + " · 메뉴 " + items.length + "개";
        if (role === "admin") {
            hint += orderOn ? " (주문 권한 있음)" : " (주문 권한 없음)";
        }
        setStatus(hint, false);
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
