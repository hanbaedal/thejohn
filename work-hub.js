/**
 * 그룹 마케팅 관리(work-hub)
 * 메뉴: 슈퍼바이저 6 · 관리자(주문) 5 · 관리자(비주문) 4
 * 표시는 세션 API(DB 역할·주문권한) 우선, 로컬 Auth 보조
 */
(function (global) {
    "use strict";

    var Auth = global.THEJHON_AUTH;
    var Api = global.THEJHON_API;
    var statusEl = document.getElementById("wh-status");
    var gridEl = document.getElementById("whMenuGrid");

    var BASE_MENUS = [
        "view-home",
        "manage-home",
        "product-manage",
        "vendor-manage"
    ];

    var HREFS = {
        "view-home": "index.html",
        "manage-home": "homepage-manage-hub.html",
        "product-manage": "product-manage.html",
        "vendor-manage": "vendor-manage.html",
        "order-manage": "order-manage-hub.html",
        "work-manage": "staff-manage-hub.html"
    };

    var NAV_MODE = {
        "view-home": "public",
        "manage-home": "manage-home",
        "product-manage": "manage-home",
        "vendor-manage": "manage-home",
        "order-manage": "order",
        "work-manage": "work"
    };

    var ROLE_LABEL = {
        supervisor: "슈퍼바이저",
        admin: "관리자"
    };

    function normRole(role) {
        return String(role || "")
            .trim()
            .toLowerCase();
    }

    function menuKeysForStaff(role, orderEnabled) {
        var r = normRole(role);
        if (r === "supervisor") {
            return BASE_MENUS.concat(["order-manage", "work-manage"]);
        }
        if (r === "admin") {
            return orderEnabled ? BASE_MENUS.concat(["order-manage"]) : BASE_MENUS.slice();
        }
        return [];
    }

    function menuKeysFromAuth() {
        if (Auth && Auth.getWorkHubVisibleMenuKeys) {
            return Auth.getWorkHubVisibleMenuKeys();
        }
        if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn()) return [];
        var orderOn = Auth.isStaffOrderEnabled && Auth.isStaffOrderEnabled();
        return menuKeysForStaff(Auth.getRole ? Auth.getRole() : "", orderOn);
    }

    function menuKeysFromSession(sess) {
        if (!sess || !sess.loggedIn) return null;
        return menuKeysForStaff(sess.role, !!sess.staffOrderEnabled);
    }

    function initHubBgm() {
        var media = global.THEJHON_HOME_INTRO_MEDIA;
        if (!media || !media.init || !document.getElementById("whHubBgm")) return;
        try {
            media.init({
                bgmId: "whHubBgm",
                bgmBtnId: "whBgmToggle",
                bgmHintId: "whBgmHint",
                volume: 0.28,
                autoplayBgm: false,
                bgmButtonOnly: true
            });
        } catch (e) {}
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "wh-status" +
            (kind === "err" ? " wh-status--err" : kind === "ok" ? " wh-status--ok" : "");
    }

    function setMenuHint(keys, sess) {
        if (!statusEl || !keys || !keys.length) return;
        var hub = Auth && Auth.getWorkHubAccess ? Auth.getWorkHubAccess() : { allowed: false };
        if (!hub.allowed) return;
        var role = normRole((sess && sess.role) || (Auth.getRole && Auth.getRole()));
        var label = ROLE_LABEL[role] || role || "스태프";
        var orderNote =
            role === "admin"
                ? keys.indexOf("order-manage") >= 0
                    ? " · 주문 권한 있음"
                    : " · 주문 권한 없음"
                : "";
        setStatus(label + " · 메뉴 " + keys.length + "개" + orderNote, "ok");
    }

    function hrefFor(key) {
        if (key === "order-manage" && Auth && Auth.getWorkHubOrderManageHref) {
            return Auth.getWorkHubOrderManageHref();
        }
        return HREFS[key] || "#";
    }

    function bindCard(card, key) {
        if (card.dataset.whBound === "1") return;
        card.dataset.whBound = "1";
        var mode = NAV_MODE[key];
        card.addEventListener("click", function () {
            if (card.classList.contains("wh-card--off")) return;
            if (mode && Auth && Auth.setStaffNavMode) Auth.setStaffNavMode(mode);
        });
    }

    function applyMenus(keys) {
        if (!gridEl || !keys) return;

        var show = {};
        keys.forEach(function (key) {
            show[key] = true;
        });

        gridEl.querySelectorAll("[data-wh-menu]").forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var on = !!show[key];
            card.classList.toggle("wh-card--off", !on);
            if (on) {
                card.removeAttribute("hidden");
                card.removeAttribute("aria-hidden");
                card.href = hrefFor(key);
                bindCard(card, key);
            } else {
                card.setAttribute("aria-hidden", "true");
            }
        });
    }

    function refreshHeaderCompany() {
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            global.__thejhonRefreshHeaderCompany();
        }
    }

    function refreshMenusAndHint(sess) {
        var keys = menuKeysFromSession(sess);
        if (!keys || !keys.length) keys = menuKeysFromAuth();
        applyMenus(keys);
        setMenuHint(keys, sess);
        refreshHeaderCompany();
    }

    function fetchSessionThenApply() {
        if (!Api || !Api.checkSession || !Api.getToken || !Api.getToken()) {
            return Promise.resolve(null);
        }
        return Api.checkSession()
            .then(function (sess) {
                if (sess && sess.code === "SESSION_INVALID") return sess;
                if (sess && sess.loggedIn) {
                    refreshMenusAndHint(sess);
                }
                if (Auth && Auth.refreshSessionPermissionsAsync) {
                    return Auth.refreshSessionPermissionsAsync().then(function () {
                        refreshMenusAndHint(sess);
                        return sess;
                    });
                }
                return sess;
            })
            .catch(function () {
                refreshMenusAndHint(null);
                return null;
            });
    }

    function boot() {
        if (!Auth) {
            setStatus("인증 스크립트를 불러오지 못했습니다.", "err");
            return;
        }
        if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

        var hub = Auth.getWorkHubAccess ? Auth.getWorkHubAccess() : { allowed: false };
        if (!hub.allowed) {
            setStatus(hub.reason || "이용할 수 없습니다.", "err");
            applyMenus([]);
            return;
        }

        if (Auth.setStaffNavMode) Auth.setStaffNavMode("hub");

        refreshMenusAndHint(null);
        fetchSessionThenApply();
    }

    initHubBgm();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }

    global.addEventListener("thejhon-auth-permissions-updated", function () {
        refreshMenusAndHint(null);
    });
    global.addEventListener("pageshow", function (ev) {
        if (ev.persisted) boot();
    });
})();
