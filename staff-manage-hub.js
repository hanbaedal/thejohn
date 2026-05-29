(function () {
    var statusEl = document.getElementById("shub-status");
    function setStatus(msg, kind) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className =
            "shub-status" +
            (kind === "err" ? " shub-status--err" : kind === "ok" ? " shub-status--ok" : "");
    }
    if (!window.THEJHON_AUTH || !THEJHON_AUTH.getStaffManageAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (THEJHON_AUTH.normalizeLegacySession) THEJHON_AUTH.normalizeLegacySession();
    var access = THEJHON_AUTH.getStaffManageAccess();
    if (!access.allowed) {
        setStatus(access.reason, "err");
    }
})();
