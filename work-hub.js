/**
 * 그룹 마케팅 관리(work-hub)
 * 메뉴: 슈퍼바이저 6 · 관리자(주문) 5 · 관리자(비주문) 4 — auth.getWorkHubVisibleMenuKeys()
 */
(function (global) {
    "use strict";

    var Auth = global.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");
    var gridEl = document.getElementById("whMenuGrid");

    var NAV_MODE = {
        "view-home": "public",
        "manage-home": "manage-home",
        "product-manage": "manage-home",
        "vendor-manage": "manage-home",
        "order-manage": "order",
        "work-manage": "work"
    };

    function initHubMedia() {
        var media = global.THEJHON_HOME_INTRO_MEDIA;
        if (!media || !media.init) return;
        media.init({
            videoSelector: ".wh-hub-video",
            videoPlaybackRate: 0.55,
            bgmId: "whHubBgm",
            bgmBtnId: "whBgmToggle",
            bgmHintId: "whBgmHint",
            volume: 0.28,
            autoplayBgm: false,
            prominentBgmHint: false,
            unlockOnAnyClick: false,
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

    function visibleMenuSet() {
        var keys =
            Auth && Auth.getWorkHubVisibleMenuKeys
                ? Auth.getWorkHubVisibleMenuKeys()
                : [];
        var map = {};
        keys.forEach(function (k) {
            map[k] = true;
        });
        return map;
    }

    function cardHref(key) {
        if (key === "order-manage" && Auth && Auth.getWorkHubOrderManageHref) {
            return Auth.getWorkHubOrderManageHref();
        }
        var card = gridEl && gridEl.querySelector('[data-wh-menu="' + key + '"]');
        if (!card) return "#";
        var defaults = {
            "view-home": "index.html",
            "manage-home": "homepage-manage-hub.html",
            "product-manage": "product-manage.html",
            "vendor-manage": "vendor-manage.html",
            "order-manage": "order-manage-hub.html",
            "work-manage": "staff-manage-hub.html"
        };
        return defaults[key] || card.getAttribute("href") || "#";
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
        var show = visibleMenuSet();
        var cards = gridEl.querySelectorAll("[data-wh-menu]");
        cards.forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var on = !!show[key];
            card.hidden = !on;
            if (!on) {
                card.style.display = "none";
                return;
            }
            card.style.removeProperty("display");
            card.href = cardHref(key);
            bindCard(card, key);
        });
    }

    function refreshHeaderCompany() {
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            global.__thejhonRefreshHeaderCompany();
        }
    }

    function boot() {
        if (!Auth.getWorkHubAccess) {
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

        function done() {
            applyMenus();
            refreshHeaderCompany();
        }

        var sync = Auth.refreshSessionPermissionsAsync
            ? Auth.refreshSessionPermissionsAsync()
            : null;
        if (sync && typeof sync.then === "function") {
            sync.then(done).catch(done);
        } else {
            done();
        }
    }

    function onReady() {
        initHubMedia();
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
