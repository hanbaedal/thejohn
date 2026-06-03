/**
 * 그룹 마케팅 관리(work-hub)
 * 메뉴 표시: auth.getWorkHubVisibleMenuKeys() 단일 기준
 * 슈퍼바이저 6 · 관리자(주문) 5 · 관리자(비주문) 4
 */
(function (global) {
    "use strict";

    var Auth = global.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");
    var gridEl = document.getElementById("whMenuGrid");

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

    function visibleKeys() {
        if (!Auth || !Auth.getWorkHubVisibleMenuKeys) return [];
        return Auth.getWorkHubVisibleMenuKeys();
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

    function applyMenus() {
        if (!gridEl) return;

        var show = {};
        visibleKeys().forEach(function (key) {
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

    function boot() {
        if (!Auth) {
            setStatus("인증 스크립트를 불러오지 못했습니다.", "err");
            return;
        }
        if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

        var hub = Auth.getWorkHubAccess ? Auth.getWorkHubAccess() : { allowed: false };
        if (!hub.allowed) {
            setStatus(hub.reason || "이용할 수 없습니다.", "err");
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
                .catch(applyMenus);
        }
    }

    initHubBgm();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }

    global.addEventListener("thejhon-auth-permissions-updated", function () {
        applyMenus();
        refreshHeaderCompany();
    });
    global.addEventListener("pageshow", function (ev) {
        if (ev.persisted) boot();
    });
})();
