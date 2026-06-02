(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("wh-status");

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

    function applyMenus() {
        if (!Auth || !Auth.canAccessWorkHubMenu) return;
        var cards = document.querySelectorAll("[data-wh-menu]");
        cards.forEach(function (card) {
            var key = card.getAttribute("data-wh-menu");
            var allowed = Auth.canAccessWorkHubMenu(key);
            card.hidden = !allowed;
            if (!allowed) {
                card.setAttribute("aria-hidden", "true");
                card.setAttribute("tabindex", "-1");
                card.addEventListener("click", function (e) {
                    e.preventDefault();
                });
                return;
            }
            card.removeAttribute("aria-hidden");
            card.removeAttribute("tabindex");
            if (key === "order-manage" && Auth.getWorkHubOrderManageHref) {
                card.setAttribute("href", Auth.getWorkHubOrderManageHref());
            }
        });
    }

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

    if (Auth.refreshSessionPermissionsAsync) {
        Auth.refreshSessionPermissionsAsync().then(function () {
            applyMenus();
        });
    }

    try {
        window.addEventListener("thejhon-auth-permissions-updated", applyMenus);
    } catch (e) {}
})();
