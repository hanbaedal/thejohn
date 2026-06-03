/**
 * 그룹 마케팅 관리(work-hub) — 메뉴 표시·권한은 auth.js(canAccessWorkHubMenu)에 위임
 */
(function (global) {
    "use strict";

    var Auth = global.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");
    var gridEl = document.getElementById("whMenuGrid");

    var MENUS = [
        { key: "view-home", href: "index.html", navMode: "public" },
        { key: "manage-home", href: "homepage-manage-hub.html", navMode: "manage-home" },
        { key: "product-manage", href: "product-manage.html", navMode: "manage-home" },
        { key: "vendor-manage", href: "vendor-manage.html", navMode: "manage-home" },
        { key: "order-manage", href: "order-manage-hub.html", navMode: "order", dynamicHref: true },
        { key: "work-manage", href: "staff-manage-hub.html", navMode: "work" }
    ];

    var menuByKey = {};
    MENUS.forEach(function (item) {
        menuByKey[item.key] = item;
    });

    function initHubMedia() {
        var media = global.THEJHON_HOME_INTRO_MEDIA;
        if (!media || !media.init) return;
        if (!document.querySelector(".wh-hub-video") && !document.getElementById("whHubBgm")) {
            return;
        }
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

    function menuHref(item) {
        if (item.dynamicHref && Auth && Auth.getWorkHubOrderManageHref) {
            return Auth.getWorkHubOrderManageHref();
        }
        return item.href;
    }

    function menuAllowed(key) {
        return !!(Auth && Auth.canAccessWorkHubMenu && Auth.canAccessWorkHubMenu(key));
    }

    function refreshHeaderCompany() {
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            global.__thejhonRefreshHeaderCompany();
        }
    }

    function bindCard(card, navMode) {
        if (card.dataset.whBound === "1") return;
        card.dataset.whBound = "1";
        card.addEventListener("click", function (e) {
            if (card.hidden) {
                e.preventDefault();
                return;
            }
            if (navMode && Auth && Auth.setStaffNavMode) {
                Auth.setStaffNavMode(navMode);
            }
        });
    }

    function setCardVisible(card, allowed) {
        card.hidden = !allowed;
        if (allowed) {
            card.style.removeProperty("display");
            card.removeAttribute("aria-hidden");
            card.removeAttribute("tabindex");
        } else {
            card.style.display = "none";
            card.setAttribute("aria-hidden", "true");
            card.setAttribute("tabindex", "-1");
        }
    }

    function applyMenus() {
        if (!gridEl) return;
        var hubOk = Auth && Auth.getWorkHubAccess && Auth.getWorkHubAccess().allowed;
        var cards = gridEl.querySelectorAll("[data-wh-menu]");
        cards.forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var item = menuByKey[key];
            var allowed = hubOk && menuAllowed(key);
            setCardVisible(card, allowed);
            if (!allowed || !item) return;
            card.href = menuHref(item);
            bindCard(card, item.navMode);
        });
    }

    function boot() {
        if (!Auth || !Auth.getWorkHubAccess) {
            setStatus("인증 스크립트를 불러오지 못했습니다.", "err");
            applyMenus();
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

        var tasks = [];
        if (Auth.refreshSessionPermissionsAsync) {
            tasks.push(Auth.refreshSessionPermissionsAsync());
        }
        if (Auth.refreshStaffOrderEnabledFromProfileAsync) {
            tasks.push(Auth.refreshStaffOrderEnabledFromProfileAsync());
        }
        if (Auth.refreshBrandFromStaffProfileAsync) {
            tasks.push(Auth.refreshBrandFromStaffProfileAsync());
        }
        if (tasks.length) {
            Promise.all(tasks).then(function () {
                applyMenus();
                refreshHeaderCompany();
            });
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
        if (ev.persisted) {
            initHubMedia();
            boot();
        }
    });
})();
