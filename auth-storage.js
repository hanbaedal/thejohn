/**
 * 로그인 세션 저장 — 탭별 sessionStorage, PWA만 localStorage
 * 공개 페이지·로그인 게이트는 public-site-config.js 와 동일 규칙
 */
(function (global) {
    var SESSION_ONLY_KEYS = {
        thejhon_vendor_order_enabled: true,
        thejhon_staff_order_enabled: true
    };

    function isSessionOnlyKey(key) {
        return !!SESSION_ONLY_KEYS[key];
    }

    function isPwaStandalone() {
        try {
            if (global.matchMedia && global.matchMedia("(display-mode: standalone)").matches) {
                return true;
            }
        } catch (e) {}
        try {
            if (global.navigator && global.navigator.standalone === true) return true;
        } catch (e2) {}
        return false;
    }

    function get(key) {
        try {
            var s = sessionStorage.getItem(key);
            if (s != null && s !== "") return s;
        } catch (e) {}
        if (isSessionOnlyKey(key)) return "";
        if (isPwaStandalone()) {
            try {
                var v = localStorage.getItem(key);
                if (v != null && v !== "") return v;
            } catch (e2) {}
        }
        return "";
    }

    function set(key, value) {
        try {
            if (value == null || value === "") sessionStorage.removeItem(key);
            else sessionStorage.setItem(key, String(value));
        } catch (e) {}
        if (isSessionOnlyKey(key)) {
            try {
                localStorage.removeItem(key);
            } catch (eSo) {}
            return;
        }
        if (isPwaStandalone()) {
            try {
                if (value == null || value === "") localStorage.removeItem(key);
                else localStorage.setItem(key, String(value));
            } catch (e2) {}
        } else {
            try {
                localStorage.removeItem(key);
            } catch (e3) {}
        }
    }

    function remove(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {}
        try {
            localStorage.removeItem(key);
        } catch (e2) {}
    }

    function clearLocalKeys(keys) {
        var i;
        for (i = 0; i < keys.length; i++) {
            try {
                localStorage.removeItem(keys[i]);
            } catch (e) {}
        }
    }

    function hydrateSessionFromLocal(keys) {
        if (!isPwaStandalone()) return;
        var i;
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (isSessionOnlyKey(key)) continue;
            try {
                if (!sessionStorage.getItem(key)) {
                    var v = localStorage.getItem(key);
                    if (v != null && v !== "") sessionStorage.setItem(key, v);
                }
            } catch (e) {}
        }
    }

    var AUTH_KEY = "thejhon_logged_in";
    var ROLE_KEY = "thejhon_role";
    var TOKEN_KEY = "thejhon_api_token";
    var LEGACY_GUEST_KEYS = [
        "thejhon_guest_id",
        "thejhon_logged_in",
        "thejhon_role",
        "thejhon_user_id",
        "thejhon_api_token",
        "thejhon_display_name",
        "thejhon_auth_provider"
    ];
    var AUTH_GATE_KEYS = [AUTH_KEY, ROLE_KEY, TOKEN_KEY, "thejhon_user_id"];

    function publicSite() {
        return global.THEJHON_PUBLIC_SITE || null;
    }

    function purgeLegacyGuestSession() {
        if (get(ROLE_KEY) !== "guest") return;
        var i;
        for (i = 0; i < LEGACY_GUEST_KEYS.length; i++) {
            remove(LEGACY_GUEST_KEYS[i]);
        }
        try {
            localStorage.removeItem("thejhon_guest_id");
        } catch (e) {}
    }

    function isLoggedInEarly() {
        purgeLegacyGuestSession();
        if (isPwaStandalone()) {
            hydrateSessionFromLocal(AUTH_GATE_KEYS);
        }
        if (get(AUTH_KEY) !== "1" || !get(ROLE_KEY)) return false;
        var role = String(get(ROLE_KEY) || "")
            .trim()
            .toLowerCase();
        if (role === "guest" || role === "oauth") return false;
        return !!get(TOKEN_KEY);
    }

    function enforceSiteLoginEarly() {
        if (typeof global.location === "undefined") return;
        var PS = publicSite();
        var page = PS && PS.currentPageFile ? PS.currentPageFile() : "";
        if (page === "support-partner-detail.html") {
            if (!isLoggedInEarly()) {
                global.location.replace("support-partners.html?membersOnly=1");
            }
            return;
        }
        if (PS && PS.isPublicPage && PS.isPublicPage()) return;
        if (PS && PS.isLoginPage && PS.isLoginPage()) return;
        if (isLoggedInEarly()) return;
        var next =
            global.location.pathname + global.location.search + global.location.hash;
        if (!next || next === "/") next = "/index.html";
        global.location.replace("login.html?next=" + encodeURIComponent(next));
    }

    function applyLoggedInDocumentClass() {
        var on = isLoggedInEarly();
        try {
            document.documentElement.classList.toggle("is-logged-in", on);
            document.documentElement.classList.toggle("is-public", !on);
            if (document.body) {
                document.body.classList.toggle("is-logged-in", on);
                document.body.classList.toggle("is-public", !on);
            }
        } catch (e) {}
    }

    global.THEJHON_AUTH_STORAGE = {
        isPwaStandalone: isPwaStandalone,
        get: get,
        set: set,
        remove: remove,
        clearLocalKeys: clearLocalKeys,
        hydrateSessionFromLocal: hydrateSessionFromLocal,
        enforceSiteLoginEarly: enforceSiteLoginEarly,
        applyLoggedInDocumentClass: applyLoggedInDocumentClass,
        purgeLegacyGuestSession: purgeLegacyGuestSession
    };

    purgeLegacyGuestSession();
    enforceSiteLoginEarly();
    applyLoggedInDocumentClass();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyLoggedInDocumentClass);
    }
})(typeof window !== "undefined" ? window : this);
