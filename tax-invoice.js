(function () {
    var Auth = window.THEJHON_AUTH;
    var statusEl = document.getElementById("tax-inv-status");

    if (!Auth || !Auth.getOrderManageHubAccess) {
        if (statusEl) statusEl.textContent = "인증 스크립트 오류";
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();
    var access = Auth.getOrderManageHubAccess();
    if (!access.allowed) {
        if (statusEl) statusEl.textContent = access.reason || "이용할 수 없습니다.";
        return;
    }
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();
})();
