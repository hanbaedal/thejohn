/**
 * 그룹 마케팅 관리(work-hub)
 * 메뉴: 슈퍼바이저 6 · 관리자(주문) 5 · 관리자(비주문) 4
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

    /** 표시할 메뉴 id 목록 */
    function menuKeys() {
        if (Auth && Auth.getWorkHubVisibleMenuKeys) {
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
        return [];
    }

    function initHubBgm() {
        var media = global.THEJHON_HOME_INTRO_MEDIA;
        if (!media || !media.init || !document.getElementById("whHubBgm")) return;
        media.init({
            bgmId: "whHubBgm",
            bgmBtnId: "whBgmToggle",
            bgmHintId: "whBgmHint",
            volume: 0.28,
            autoplayBgm: false,
            bgmButtonOnly: true
        });
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
            if (card.hidden || !mode || !Auth || !Auth.setStaffNavMode) return;
            Auth.setStaffNavMode(mode);
        });
    }

    function applyMenus() {
        if (!gridEl || !Auth) return;

        var allowed = {};
        menuKeys().forEach(function (k) {
            allowed[k] = true;
        });

        var cards = gridEl.querySelectorAll("[data-wh-menu]");
        cards.forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var on = !!allowed[key];
            if (on) {
                card.hidden = false;
                card.removeAttribute("hidden");
                card.removeAttribute("aria-hidden");
                card.style.removeProperty("display");
                card.href = cardHref(key);
                bindCard(card, key);
            } else {
                card.hidden = true;
                card.setAttribute("aria-hidden", "true");
                card.style.display = "none";
            }
        });
    }

    function refreshHeaderCompany() {
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            global.__thejhonRefreshHeaderCompany();
        }
    }

    function boot() {
        if (!Auth || !Auth.getWorkHubAccess) {
            setStatus("인증 스크립트를 불러오지 못했습니다.", "err");
            return;
        }
        if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

        var access = Auth.getWorkHubAccess();
        if (!access.allowed) {
            setStatus(access.reason || "이용할 수 없습니다.", "err");
            applyMenus();
            return;
        }

        setStatus("");
        if (Auth.setStaffNavMode) Auth.setStaffNavMode("hub");

        applyMenus();
        refreshHeaderCompany();

        var sync = Auth.refreshSessionPermissionsAsync
            ? Auth.refreshSessionPermissionsAsync()
            : null;
        if (sync && typeof sync.then === "function") {
            sync
                .then(function () {
                    applyMenus();
                    refreshHeaderCompany();
                })
                .catch(function () {
                    applyMenus();
                });
        }
    }

    function onReady() {
        initHubBgm();
        boot();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", onReady, { once: true });
    } else {
        onReady();
    }

    global.addEventListener("thejhon-auth-permissions-updated", applyMenus);
    global.addEventListener("pageshow", function (ev) {
        if (ev.persisted) boot();
    });
})();
