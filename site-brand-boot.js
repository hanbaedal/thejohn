/**
 * head 최상단 — 로그인 사용자는 기본 로고·파비콘 없이, 캐시된 관리자 로고만 즉시 표시
 */
(function (global) {
    var AUTH_KEY = "thejhon_logged_in";
    var ROLE_KEY = "thejhon_role";
    var LOGO_KEY = "thejhon_staff_logo";
    var DEFAULT_FAVICON = "img/icon-192.png";

    function usesStaffLogoRole() {
        try {
            if (sessionStorage.getItem(AUTH_KEY) !== "1") return false;
            var role = sessionStorage.getItem(ROLE_KEY) || "";
            return role === "admin" || role === "supervisor" || role === "vendor";
        } catch (e) {
            return false;
        }
    }

    function escAttr(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
    }

    var branded = usesStaffLogoRole();
    var customLogo = branded ? String(sessionStorage.getItem(LOGO_KEY) || "").trim() : "";
    var faviconHref = customLogo || (branded ? "" : DEFAULT_FAVICON);

    if (branded) {
        document.documentElement.className += " site-brand-pending";
    }

    if (faviconHref) {
        document.write(
            '<link rel="icon" href="' +
                escAttr(faviconHref) +
                '" sizes="192x192" type="image/png">\n' +
                '<link rel="apple-touch-icon" sizes="192x192" href="' +
                escAttr(faviconHref) +
                '">\n'
        );
    }

    function clearPending() {
        document.documentElement.classList.remove("site-brand-pending");
    }

    function applyEarlyHeaderLogo() {
        if (!customLogo) return;
        var imgs = document.querySelectorAll(".dz-logo-img");
        for (var i = 0; i < imgs.length; i++) {
            imgs[i].src = customLogo;
        }
        clearPending();
    }

    global.__THEJHON_BRAND_BOOT = {
        branded: branded,
        customLogo: customLogo,
        clearPending: clearPending
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyEarlyHeaderLogo);
    } else {
        applyEarlyHeaderLogo();
    }
})(typeof window !== "undefined" ? window : this);
