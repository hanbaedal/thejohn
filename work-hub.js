(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");

    function initHubMedia() {
        if (!global.THEJHON_HOME_INTRO_MEDIA || !THEJHON_HOME_INTRO_MEDIA.init) return;
        THEJHON_HOME_INTRO_MEDIA.init({
            videoSelector: ".wh-hub-backdrop-video",
            videoPlaybackRate: 0.1,
            introSelector: ".wh-hub-stage",
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
        if (document.readyState === "complete") {
            initHubMedia();
        } else {
            window.addEventListener("load", initHubMedia, { once: true });
        }
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

    function applyMenus() {
        if (!Auth || !Auth.canAccessWorkHubMenu) return;
        var role = Auth.getRole ? Auth.getRole() : "";
        var staff = Auth.isStaffRole && Auth.isStaffRole(role);
        var access = Auth.getWorkHubAccess ? Auth.getWorkHubAccess() : { allowed: false };

        var cards = document.querySelectorAll("[data-wh-menu]");
        cards.forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var allowed = false;
            if (staff && (key === "view-home" || key === "manage-home")) {
                allowed = true;
            } else if (access.allowed) {
                allowed = Auth.canAccessWorkHubMenu(key);
            }
            card.hidden = !allowed;
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
                card.addEventListener("click", function (e) {
                    if (card.hidden) {
                        e.preventDefault();
                        return;
                    }
                    if (navMode && Auth.setStaffNavMode) {
                        Auth.setStaffNavMode(navMode);
                    }
                });
            }
        });
        syncHubRows();
    }

    function layoutWorkHubHeaderCompany() {
        var brand = document.querySelector(".site-header-brand");
        if (!brand) return;

        var elHub = document.getElementById("headerCompanyNameHub");
        if (!elHub) {
            elHub = document.createElement("p");
            elHub.id = "headerCompanyNameHub";
            elHub.className = "header-session-company header-session-company--hub";
            elHub.setAttribute("aria-live", "polite");
            brand.appendChild(elHub);
        }

        function pingHubCompany() {
            var text = "";
            if (
                Auth &&
                Auth.isLoggedIn &&
                Auth.isLoggedIn() &&
                Auth.getLoggedInCompanyDisplayName
            ) {
                text = String(Auth.getLoggedInCompanyDisplayName() || "").trim();
            }
            if (text) {
                elHub.textContent = text;
                elHub.hidden = false;
            } else {
                elHub.textContent = "";
                elHub.hidden = true;
            }
            var elWide = document.getElementById("headerCompanyName");
            var elMobile = document.getElementById("headerCompanyNameMobile");
            if (elWide) {
                elWide.textContent = "";
                elWide.classList.remove("header-session-company--show");
            }
            if (elMobile) {
                elMobile.textContent = "";
                elMobile.classList.remove("header-session-company--show");
            }
            var header = document.querySelector(".site-header");
            if (header) header.classList.remove("header-has-company-mobile");
        }

        pingHubCompany();
        var prev = window.__thejhonRefreshHeaderCompany;
        window.__thejhonRefreshHeaderCompany = function () {
            if (typeof prev === "function") prev();
            pingHubCompany();
        };
        window.addEventListener("pageshow", pingHubCompany);
        try {
            window.addEventListener("thejhon-auth-permissions-updated", pingHubCompany);
        } catch (e) {}
    }

    bootHubMediaWhenReady();
    layoutWorkHubHeaderCompany();

    if (!Auth || !Auth.getWorkHubAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

    var access = Auth.getWorkHubAccess();
    if (!access.allowed) {
        setStatus(access.reason || "이용할 수 없습니다.", "err");
        return;
    }

    applyMenus();
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("hub");

    if (Auth.refreshSessionPermissionsAsync) {
        Auth.refreshSessionPermissionsAsync().then(function () {
            applyMenus();
        });
    }

    try {
        window.addEventListener("thejhon-auth-permissions-updated", applyMenus);
    } catch (e2) {}
})();
