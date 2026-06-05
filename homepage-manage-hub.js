(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("hmh-status");
    var panelsRoot = document.getElementById("hmhPanels");
    var headerNav = document.getElementById("hmhHeaderNav");

    var SECTIONS = ["home", "product"];

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    function currentSection() {
        var hash = String(window.location.hash || "")
            .replace(/^#/, "")
            .toLowerCase();
        if (hash === "vendor") {
            window.location.replace("vendor-manage.html");
            return "home";
        }
        if (hash === "support") return "home";
        if (SECTIONS.indexOf(hash) >= 0) return hash;
        return "home";
    }

    function showSection(section) {
        if (SECTIONS.indexOf(section) < 0) section = "home";
        if (panelsRoot) {
            var panels = panelsRoot.querySelectorAll(".hmh-panel");
            for (var i = 0; i < panels.length; i++) {
                var p = panels[i];
                var on = p.getAttribute("data-hmh-section") === section;
                p.hidden = !on;
            }
        }
        if (headerNav && Auth.applyStaffNavManageHomeTabs) {
            Auth.applyStaffNavManageHomeTabs(headerNav);
        }
        try {
            if (history.replaceState) {
                history.replaceState(null, "", "#" + section);
            } else {
                window.location.hash = section;
            }
        } catch (e) {
            window.location.hash = section;
        }
    }

    function canShowCard(cardKey) {
        if (!Auth || !Auth.canAccessHomepageManageCard) return true;
        return Auth.canAccessHomepageManageCard(cardKey);
    }

    function applyCardPermissions() {
        var cards = document.querySelectorAll("[data-hmh-card]");
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            var key = card.getAttribute("data-hmh-card");
            var ok = canShowCard(key);
            card.hidden = !ok;
            if (!ok) {
                card.setAttribute("aria-hidden", "true");
                card.setAttribute("tabindex", "-1");
            } else {
                card.removeAttribute("aria-hidden");
                card.removeAttribute("tabindex");
            }
        }
    }

    function bindCards() {
        document.querySelectorAll(".hmh-card[href]").forEach(function (card) {
            card.addEventListener("click", function () {
                if (!Auth) return;
                var key = card.getAttribute("data-hmh-card") || "";
                if (
                    key === "product-register" ||
                    key === "product-list"
                ) {
                    if (Auth.setStaffNavMode) Auth.setStaffNavMode("product");
                    if (Auth.refreshProductHeader) Auth.refreshProductHeader();
                } else {
                    if (Auth.setStaffNavMode) Auth.setStaffNavMode("manage-home");
                    if (Auth.refreshManageHomeHeader) Auth.refreshManageHomeHeader();
                }
            });
        });
    }

    function init() {
        if (!Auth || !Auth.getHomepageManageHubAccess) {
            setStatus("인증 스크립트 오류", "err");
            return;
        }
        if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

        var access = Auth.getHomepageManageHubAccess();
        if (!access.allowed) {
            setStatus(access.reason || "이용할 수 없습니다.", "err");
            return;
        }

        if (Auth.setStaffNavMode) Auth.setStaffNavMode("manage-home");

        function refreshHeader() {
            if (Auth.applyStaffNavMode) Auth.applyStaffNavMode("manage-home");
        }

        applyCardPermissions();
        bindCards();
        showSection(currentSection());
        refreshHeader();

        if (Auth.refreshSessionPermissionsAsync) {
            Auth.refreshSessionPermissionsAsync().then(function () {
                applyCardPermissions();
                refreshHeader();
            });
        }

        window.addEventListener("hashchange", function () {
            showSection(currentSection());
        });
        window.addEventListener("thejhon-auth-permissions-updated", function () {
            applyCardPermissions();
            refreshHeader();
        });
    }

    init();
})();
