/**
 * 그룹 마케팅 관리 — 사이드바 + 환영 화면
 */
(function () {
    "use strict";

    var LOGIN_PAGE = "login.html";
    var HUB_PAGE = "work-hub.html";
    var Tree = window.THEJHON_WORK_HUB_TREE;

    var statusEl = document.getElementById("whStatus");
    var menuEl = document.getElementById("whMenu");
    var homeEl = document.getElementById("whHome");
    var toggleEl = document.getElementById("whMenuToggle");
    var backdropEl = document.getElementById("whSidebarBackdrop");

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

    function renderHome(tree) {
        if (!homeEl) return;
        homeEl.className = "wh-home";
        homeEl.innerHTML = "";
        var tone = 0;
        tree.forEach(function (section) {
            section.items.forEach(function (item) {
                var card = document.createElement("article");
                card.className = "wh-card wh-card--tone-" + (tone % 8);
                tone += 1;

                var h = document.createElement("h2");
                if (item.href) {
                    var titleLink = document.createElement("a");
                    titleLink.className = "wh-card-title";
                    titleLink.href = item.href;
                    titleLink.textContent = item.label;
                    h.appendChild(titleLink);
                } else {
                    h.textContent = item.label;
                }
                card.appendChild(h);

                var list = document.createElement("ul");
                list.className = "wh-card-subs";
                if (item.children && item.children.length) {
                    item.children.forEach(function (ch) {
                        var li = document.createElement("li");
                        var a = document.createElement("a");
                        a.href = ch.href;
                        a.textContent = ch.label;
                        li.appendChild(a);
                        list.appendChild(li);
                    });
                } else if (item.href) {
                    var only = document.createElement("li");
                    var onlyA = document.createElement("a");
                    onlyA.href = item.href;
                    onlyA.textContent = section.title;
                    only.appendChild(onlyA);
                    list.appendChild(only);
                }
                card.appendChild(list);
                homeEl.appendChild(card);
            });
        });
    }

    function roleLabel(role) {
        if (!Tree) return role || "";
        if (Tree.normRole(role) === "supervisor") return "슈퍼바이저";
        if (Tree.normRole(role) === "admin") return "관리자";
        return role || "";
    }

    function applySession(sess) {
        if (!sess || !sess.loggedIn) {
            setStatus("로그인이 필요합니다.", true);
            goLogin();
            return;
        }

        var role = Tree ? Tree.normRole(sess.role) : String(sess.role || "").toLowerCase();
        if (role !== "supervisor" && role !== "admin") {
            setStatus("관리자·슈퍼바이저만 이용할 수 있습니다.", true);
            window.location.replace("index.html");
            return;
        }

        syncAuthFromSession(sess);
        if (window.THEJHON_ADMIN_SHELL && menuEl) {
            window.THEJHON_ADMIN_SHELL.renderMenu(menuEl, sess.role);
        }
        renderHome(Tree ? Tree.treeForRole(sess.role) : []);

        var tree = Tree ? Tree.treeForRole(sess.role) : [];
        setStatus(roleLabel(sess.role) + " · 메뉴 " + (Tree ? Tree.countLeaves(tree) : 0) + "개", false);
        refreshHeaderChrome();
    }

    function onRemoteSession(sess) {
        if (sess && sess.code === "SESSION_INVALID") {
            setStatus(sess.error || "세션이 만료되었습니다.", true);
            goLogin();
            return;
        }
        if (sess && sess.loggedIn) applySession(sess);
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
        if (cached) applySession(cached);
        else setStatus("메뉴 불러오는 중…", false);

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
