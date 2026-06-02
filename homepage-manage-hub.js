(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("hmh-status");

    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }

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

    document.querySelectorAll(".company-division-card[href]").forEach(function (card) {
        card.addEventListener("click", function () {
            if (Auth.setStaffNavMode) Auth.setStaffNavMode("manage-home");
        });
    });
})();
