/**
 * 그룹 마케팅 관리(work-hub)
 * 기본 4메뉴는 HTML에 항상 표시 · 주문/업무는 JS로 역할에 맞게 표시
 */
(function (global) {
    "use strict";

    var Auth = global.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");
    var gridEl = document.getElementById("whMenuGrid");

    var BASE_KEYS = [
        "view-home",
        "manage-home",
        "product-manage",
        "vendor-manage"
    ];

    var NAV_MODE = {
        "view-home": "public",
        "manage-home": "manage-home",
        "product-manage": "manage-home",
        "vendor-manage": "manage-home",
        "order-manage": "order",
        "work-manage": "work"
    };

    var HREFS = {
        "view-home": "index.html",
        "manage-home": "homepage-manage-hub.html",
        "product-manage": "product-manage.html",
        "vendor-manage": "vendor-manage.html",
        "order-manage": "order-manage-hub.html",
        "work-manage": "staff-manage-hub.html"
    };

    function roleNorm() {
        return String(Auth && Auth.getRole ? Auth.getRole() : "")
            .trim()
            .toLowerCase();
    }

    function orderOn() {
        return !!(Auth && Auth.isStaffOrderEnabled && Auth.isStaffOrderEnabled());
    }

    function staffHubOk() {
        if (!Auth) return false;
        if (Auth.getWorkHubAccess) {
            return Auth.getWorkHubAccess().allowed;
        }
        var r = roleNorm();
        return (
            Auth.isLoggedIn &&
            Auth.isLoggedIn() &&
            (r === "admin" || r === "supervisor")
        );
    }

    /** 슈퍼바이저 6 · 관리자(주문) 5 · 관리자(비주문) 4 */
    function menuKeys() {
        if (!staffHubOk()) return [];

        if (Auth.getWorkHubVisibleMenuKeys) {
            var fromAuth = Auth.getWorkHubVisibleMenuKeys();
            if (fromAuth && fromAuth.length) return fromAuth;
        }

        var role = roleNorm();
        if (role === "supervisor") {
            return BASE_KEYS.concat(["order-manage", "work-manage"]);
        }
        if (role === "admin") {
            return orderOn()
                ? BASE_KEYS.concat(["order-manage"])
                : BASE_KEYS.slice();
        }
        return BASE_KEYS.slice();
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

    function cardHref(key) {
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
            if (card.classList.contains("wh-card--off") || !mode || !Auth || !Auth.setStaffNavMode) {
                return;
            }
            Auth.setStaffNavMode(mode);
        });
    }

    function setCardOn(card, on) {
        if (on) {
            card.classList.remove("wh-card--off");
            card.removeAttribute("hidden");
            card.removeAttribute("aria-hidden");
        } else {
            card.classList.add("wh-card--off");
            card.setAttribute("aria-hidden", "true");
        }
    }

    function applyMenus() {
        if (!gridEl) return;

        var allowed = {};
        menuKeys().forEach(function (k) {
            allowed[k] = true;
        });

        gridEl.querySelectorAll("[data-wh-menu]").forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var on = !!allowed[key];
            setCardOn(card, on);
            if (on) {
                card.href = cardHref(key);
                bindCard(card, key);
            }
        });
    }

    function refreshHeaderCompany() {
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            global.__thejhonRefreshHeaderCompany();
        }
    }

    function boot() {
        if (!Auth) {
            setStatus("인증 스크립트를 불러오지 못했습니다.", "err");
            return;
        }
        if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

        if (!staffHubOk()) {
            var reason =
                Auth.getWorkHubAccess && Auth.getWorkHubAccess().reason
                    ? Auth.getWorkHubAccess().reason
                    : "로그인이 필요합니다.";
            setStatus(reason, "err");
            BASE_KEYS.forEach(function (k) {
                var card = gridEl && gridEl.querySelector('[data-wh-menu="' + k + '"]');
                if (card) setCardOn(card, false);
            });
            return;
        }

        setStatus("");
        if (Auth.setStaffNavMode) Auth.setStaffNavMode("hub");

        applyMenus();
        refreshHeaderCompany();

        if (Auth.refreshSessionPermissionsAsync) {
            Auth.refreshSessionPermissionsAsync()
                .then(function () {
                    applyMenus();
                    refreshHeaderCompany();
                })
                .catch(applyMenus);
        }
    }

    initHubBgm();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }

    global.addEventListener("thejhon-auth-permissions-updated", applyMenus);
    global.addEventListener("pageshow", function (ev) {
        if (ev.persisted) boot();
    });
})();
