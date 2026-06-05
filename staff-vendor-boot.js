/** 업체관리 — 헤더 하위 메뉴 (업체관리 · 등록 · 리스트 등) */
(function () {
    var A = window.THEJHON_AUTH;
    if (!A || !A.isStaffRole || !A.isStaffRole(A.getRole && A.getRole())) return;

    function boot() {
        if (A.setStaffNavMode) A.setStaffNavMode("vendor-manage");
        if (A.applyStaffNavMode) A.applyStaffNavMode("vendor-manage");
        else if (A.refreshVendorHeader) A.refreshVendorHeader();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
    try {
        window.addEventListener("pageshow", boot);
        window.addEventListener("thejhon-auth-permissions-updated", boot);
    } catch (e) {}
})();
