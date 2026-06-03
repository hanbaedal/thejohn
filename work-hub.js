(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");

    var hubMediaInited = false;

    function initHubMedia() {
        if (hubMediaInited) return;
        var g = typeof window !== "undefined" ? window : this;
        if (!g.THEJHON_HOME_INTRO_MEDIA || !g.THEJHON_HOME_INTRO_MEDIA.init) return;
        var THEJHON_HOME_INTRO_MEDIA = g.THEJHON_HOME_INTRO_MEDIA;
        if (!document.getElementById("whHubMusic") || !document.getElementById("whBgmToggle")) return;
        hubMediaInited = true;
        THEJHON_HOME_INTRO_MEDIA.init({
            videoSelector: ".wh-hub-backdrop-video",
            videoPlaybackRate: 0.55,
            bgmId: "whHubMusic",
            bgmBtnId: "whBgmToggle",
            bgmHintId: "whBgmHint",
            volume: 0.28,
            autoplayBgm: false,
            prominentBgmHint: false,
            unlockOnAnyClick: false,
            bgmButtonOnly: true
        });
    }

    function bootHubMediaWhenReady() {
        function run() {
            initHubMedia();
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run, { once: true });
        } else {
            run();
        }
        window.addEventListener("load", run, { once: true });
    }

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    var NAV_MODE_BY_MENU = {
        "view-home": "public",
        "manage-home": "manage-home",
        "product-manage": "manage-home",
        "vendor-manage": "manage-home",
        "order-manage": "order",
        "work-manage": "work"
    };

    function rowHasVisibleMenu(row) {
        var cards = row.querySelectorAll("[data-wh-menu]");
        for (var i = 0; i < cards.length; i++) {
            if (!cards[i].hidden) return true;
        }
        return false;
    }

    function syncHubRows() {
        var rows = document.querySelectorAll(".wh-hub-row");
        rows.forEach(function (row) {
            row.hidden = !rowHasVisibleMenu(row);
        });
    }

    function normalizeHubRole() {
        return String(Auth && Auth.getRole ? Auth.getRole() : "")
            .trim()
            .toLowerCase();
    }

    function hubMenuAllowed(menuKey) {
        if (!Auth || !Auth.getWorkHubAccess) return false;
        if (!Auth.getWorkHubAccess().allowed) return false;
        var role = normalizeHubRole();
        var staff = role === "admin" || role === "supervisor";
        if (!staff) return false;
        if (menuKey === "view-home" || menuKey === "manage-home") return true;
        if (menuKey === "product-manage" || menuKey === "vendor-manage") return true;
        if (menuKey === "work-manage") return role === "supervisor";
        if (menuKey === "order-manage") {
            if (role === "supervisor") return true;
            return role === "admin" && Auth.isStaffOrderEnabled && Auth.isStaffOrderEnabled();
        }
        return false;
    }

    function applyMenus() {
        if (!Auth || !Auth.getWorkHubAccess) return;
        var access = Auth.getWorkHubAccess();
        var cards = document.querySelectorAll("[data-wh-menu]");
        if (!access.allowed) {
            cards.forEach(function (card) {
                card.hidden = true;
                card.style.display = "none";
            });
            syncHubRows();
            return;
        }

        cards.forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var allowed = hubMenuAllowed(key);
            card.hidden = !allowed;
            card.style.display = allowed ? "" : "none";
            if (!allowed) {
                card.setAttribute("aria-hidden", "true");
                card.setAttribute("tabindex", "-1");
            } else {
                card.removeAttribute("aria-hidden");
                card.removeAttribute("tabindex");
            }
            if (key === "order-manage" && Auth.getWorkHubOrderManageHref) {
                card.setAttribute("href", Auth.getWorkHubOrderManageHref());
            }
            if (card.dataset.whMenuBound !== "1") {
                card.dataset.whMenuBound = "1";
                var navMode = NAV_MODE_BY_MENU[key];
                (function (link, mode) {
                    link.addEventListener("click", function (e) {
                        var el = e.currentTarget || link;
                        if (el.hidden || el.getAttribute("aria-hidden") === "true") {
                            e.preventDefault();
                            return;
                        }
                        if (mode && Auth.setStaffNavMode) {
                            Auth.setStaffNavMode(mode);
                        }
                    });
                })(card, navMode);
            }
        });
        syncHubRows();
    }

    function resolveWorkHubBrand() {
        var header = document.querySelector(".site-header");
        if (!header) return null;
        var brand = header.querySelector(".site-header-brand");
        if (brand) return brand;
        var logo =
            header.querySelector(".site-header-start .dz-logo") ||
            header.querySelector(".site-header-start .dz-logo--compact") ||
            header.querySelector(".dz-logo--compact") ||
            header.querySelector(".dz-logo");
        if (!logo) return null;
        brand = document.createElement("div");
        brand.className = "site-header-brand";
        if (logo.parentNode) {
            logo.parentNode.insertBefore(brand, logo);
            brand.appendChild(logo);
        } else {
            header.insertBefore(brand, header.firstChild);
        }
        return brand;
    }

    function refreshWorkHubHeaderCompany() {
        resolveWorkHubBrand();
        if (typeof window.__thejhonRefreshHeaderCompany === "function") {
            window.__thejhonRefreshHeaderCompany();
        }
    }

    function initWorkHubHeaderCompany() {
        refreshWorkHubHeaderCompany();
        if (Auth && Auth.refreshBrandFromStaffProfileAsync) {
            Auth.refreshBrandFromStaffProfileAsync().then(refreshWorkHubHeaderCompany);
        }
    }

    function scheduleWorkHubHeaderCompany() {
        function run() {
            initWorkHubHeaderCompany();
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run, { once: true });
        } else {
            run();
        }
        window.addEventListener("load", run, { once: true });
        try {
            var header = document.querySelector(".site-header");
            if (header && typeof MutationObserver !== "undefined") {
                var obs = new MutationObserver(function () {
                    if (header.dataset.headerShell === "2") {
                        initWorkHubHeaderCompany();
                    }
                });
                obs.observe(header, { attributes: true, attributeFilter: ["data-header-shell"], childList: true, subtree: true });
            }
        } catch (eObs) {}
    }

    function syncWorkHubAuthUi() {
        var logoutBtn = document.getElementById("btnLogout");
        var loginBtn = document.getElementById("btnLogin");
        var loggedIn = Auth && Auth.isLoggedIn && Auth.isLoggedIn();
        if (logoutBtn) logoutBtn.hidden = !loggedIn;
        if (loginBtn) loginBtn.hidden = !!loggedIn;
    }

    function bootWorkHub() {
        syncWorkHubAuthUi();
        if (!Auth || !Auth.getWorkHubAccess) {
            setStatus("인증 스크립트 오류", "err");
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

        setStatus("", "");
        applyMenus();
        if (Auth.setStaffNavMode) Auth.setStaffNavMode("hub");
        syncWorkHubAuthUi();

        if (Auth.refreshSessionPermissionsAsync) {
            Auth.refreshSessionPermissionsAsync().then(function () {
                applyMenus();
                initWorkHubHeaderCompany();
            });
        }
    }

    function scheduleApplyMenus() {
        bootWorkHub();
        window.setTimeout(applyMenus, 0);
        window.setTimeout(applyMenus, 350);
    }

    bootHubMediaWhenReady();
    scheduleWorkHubHeaderCompany();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleApplyMenus, { once: true });
    } else {
        scheduleApplyMenus();
    }
    window.addEventListener("load", scheduleApplyMenus);
    window.addEventListener("pageshow", scheduleApplyMenus);

    try {
        window.addEventListener("thejhon-auth-permissions-updated", function () {
            applyMenus();
            refreshWorkHubHeaderCompany();
        });
    } catch (e2) {}
})();
