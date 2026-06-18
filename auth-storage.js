/**
 * 로그인 세션 저장 — 탭별 sessionStorage, PWA만 localStorage (head 최상단 로드)
 */
(function (global) {
    /** 탭마다 달라야 하는 권한 플래그 — localStorage·탭 간 hydrate 금지 */
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
    var AUTH_GATE_KEYS = [AUTH_KEY, ROLE_KEY, TOKEN_KEY, "thejhon_user_id"];

    var SITE_PUBLIC_PAGES = {
        "index.html": true,
        "login.html": true,
        "company.html": true,
        "company-jeongyuk.html": true,
        "company-driedfish.html": true,
        "company-frozen.html": true,
        "company-seafood.html": true,
        "company-grocery.html": true,
        "company-drink.html": true,
        "products.html": true,
        "product-detail.html": true,
        "support.html": true,
        "support-partners.html": true,
        "support-library.html": true,
        "support-qna.html": true,
        "support-inquiry.html": true
    };

    function currentPageFileEarly() {
        var path = String(global.location.pathname || "")
            .replace(/\\/g, "/")
            .toLowerCase();
        return (path.split("/").pop() || "index.html").split("?")[0];
    }

    function isLoginPageEarly() {
        return currentPageFileEarly() === "login.html";
    }

    function isSitePublicPageEarly() {
        return !!SITE_PUBLIC_PAGES[currentPageFileEarly()];
    }

    /** auth.js hasAccountSession·repairInconsistentAuthState 와 동일 기준 */
    function isLoggedInEarly() {
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

    /** head 최상단 — 비공개 페이지만 login.html로 이동 */
    function enforceSiteLoginEarly() {
        if (typeof global.location === "undefined") return;
        if (isLoginPageEarly()) return;
        if (isSitePublicPageEarly()) return;
        if (isLoggedInEarly()) return;
        var next =
            global.location.pathname + global.location.search + global.location.hash;
        if (!next || next === "/") next = "/index.html";
        global.location.replace(
            "login.html?next=" + encodeURIComponent(next)
        );
    }

    function applyLoggedInDocumentClass() {
        var on = isLoggedInEarly();
        var isPublic = !on;
        try {
            document.documentElement.classList.toggle("is-logged-in", on);
            document.documentElement.classList.toggle("is-public", isPublic);
            if (document.body) {
                document.body.classList.toggle("is-logged-in", on);
                document.body.classList.toggle("is-public", isPublic);
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
        applyLoggedInDocumentClass: applyLoggedInDocumentClass
    };

    enforceSiteLoginEarly();
    applyLoggedInDocumentClass();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", applyLoggedInDocumentClass);
    }
})(typeof window !== "undefined" ? window : this);
