/** 그룹 마케팅 관리(홈페이지·상품·업체) — 헤더에 저장된 하위 메뉴 표시 */
(function () {
    var A = window.THEJHON_AUTH;
    if (!A || !A.isStaffRole || !A.isStaffRole(A.getRole && A.getRole())) return;

    function boot() {
        if (A.setStaffNavMode) A.setStaffNavMode("manage-home");
        if (A.applyStaffNavMode) A.applyStaffNavMode("manage-home");
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
