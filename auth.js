/**
 * 세션: thejhon_logged_in, thejhon_user_id, thejhon_role, thejhon_api_token
 * 역할: admin | guest | vendor | oauth
 * 로그인 검증은 서버 /api/auth/login (비밀번호는 .env에만 저장)
 */
(function (global) {
    var AUTH_KEY = "thejhon_logged_in";
    var USER_ID_KEY = "thejhon_user_id";
    var ROLE_KEY = "thejhon_role";
    var COMPANY_KEY = "thejhon_company_name";

    var ADMIN_ID = "thejohn";
    var GUEST_ID = "guest";

    function normalizeId(s) {
        return String(s || "")
            .trim()
            .toLowerCase();
    }

    function isReservedAdminLoginId(idn) {
        return idn === normalizeId(ADMIN_ID) || idn === "thejhon";
    }

    function clearSession() {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(USER_ID_KEY);
        sessionStorage.removeItem(ROLE_KEY);
        sessionStorage.removeItem(COMPANY_KEY);
        sessionStorage.removeItem("thejhon_auth_provider");
        sessionStorage.removeItem("thejhon_google_credential");
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken("");
    }

    function normalizeLegacySession() {
        if (sessionStorage.getItem(AUTH_KEY) === "1" && !sessionStorage.getItem(ROLE_KEY)) {
            clearSession();
        }
    }

    function verifyFormCredentialsAsync(id, pw) {
        if (!global.THEJHON_API || !THEJHON_API.login) {
            return Promise.resolve(null);
        }
        return THEJHON_API.login(id, pw)
            .then(function (data) {
                if (!data || !data.ok) return null;
                return {
                    role: data.role,
                    userId: data.userId,
                    token: data.token,
                    companyName: data.companyName || ""
                };
            })
            .catch(function () {
                return null;
            });
    }

    function setFormSession(userId, role, token, companyName) {
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(USER_ID_KEY, userId || "");
        sessionStorage.setItem(ROLE_KEY, role || "");
        sessionStorage.setItem("thejhon_auth_provider", "form");
        if (companyName) sessionStorage.setItem(COMPANY_KEY, companyName);
        else sessionStorage.removeItem(COMPANY_KEY);
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken(token || "");
    }

    function setOAuthSession(provider) {
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(USER_ID_KEY, "oauth_" + String(provider || "sns"));
        sessionStorage.setItem(ROLE_KEY, "oauth");
        sessionStorage.setItem("thejhon_auth_provider", String(provider || "oauth"));
        sessionStorage.removeItem(COMPANY_KEY);
    }

    function isLoggedIn() {
        return sessionStorage.getItem(AUTH_KEY) === "1" && !!sessionStorage.getItem(ROLE_KEY);
    }

    function getRole() {
        return sessionStorage.getItem(ROLE_KEY) || "";
    }

    function getUserId() {
        return sessionStorage.getItem(USER_ID_KEY) || "";
    }

    function canManageRegisters() {
        return getRole() === "admin" && !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken());
    }

    function canSeePrices() {
        var r = getRole();
        return r === "admin" || r === "vendor" || r === "oauth";
    }

    function getLoggedInCompanyDisplayName() {
        if (!isLoggedIn()) return "";
        var role = getRole();
        if (role === "guest") return "";
        if (role === "admin") return "(주)더존";
        if (role === "vendor") {
            var stored = sessionStorage.getItem(COMPANY_KEY);
            if (stored) return stored;
            return getUserId();
        }
        return "";
    }

    function isNotebookViewport() {
        try {
            return window.matchMedia("(min-width: 1024px)").matches;
        } catch (e) {
            return window.innerWidth >= 1024;
        }
    }

    function currentPageFile() {
        var path = (window.location.pathname || "").replace(/\\/g, "/");
        return (path.split("/").pop() || "").split("?")[0].toLowerCase();
    }

    function safeNextPath(next) {
        if (!next || typeof next !== "string") return "index.html";
        try {
            var u = new URL(next, window.location.href);
            if (u.origin !== window.location.origin) return "index.html";
            var seg = (u.pathname || "").replace(/\\/g, "/").split("/").pop().toLowerCase();
            if (seg === "login.html") return "index.html";
            return u.pathname + u.search + u.hash;
        } catch (e) {
            return "index.html";
        }
    }

    function enforceNotebookLogin() {
        normalizeLegacySession();
        if (!isNotebookViewport()) return;
        var page = currentPageFile();
        if (page === "login.html") return;
        if (isLoggedIn()) return;
        var next = window.location.href;
        window.location.replace("login.html?next=" + encodeURIComponent(next));
    }

    function enforceRegisterPages() {
        var page = currentPageFile();
        if (page !== "product-register.html" && page !== "vendor-register.html") return;
        if (!isLoggedIn()) {
            window.location.replace("index.html?denied=register");
            return;
        }
        if (canManageRegisters()) return;
        window.location.replace("index.html?denied=register");
    }

    function applyNavRegisterVisibility() {
        try {
            var sel =
                '.site-header-nav a[href="product-register.html"], .site-header-nav a[href="vendor-register.html"]';
            var nodes = document.querySelectorAll(sel);
            var hide = isLoggedIn() && !canManageRegisters();
            for (var i = 0; i < nodes.length; i++) {
                if (hide) {
                    nodes[i].classList.add("header-nav-link--register-hidden");
                    nodes[i].setAttribute("aria-hidden", "true");
                } else {
                    nodes[i].classList.remove("header-nav-link--register-hidden");
                    nodes[i].removeAttribute("aria-hidden");
                }
            }
        } catch (e) {}
    }

    global.THEJHON_AUTH = {
        AUTH_KEY: AUTH_KEY,
        ROLE_KEY: ROLE_KEY,
        ADMIN_ID: ADMIN_ID,
        verifyFormCredentialsAsync: verifyFormCredentialsAsync,
        setFormSession: setFormSession,
        setOAuthSession: setOAuthSession,
        clearSession: clearSession,
        normalizeLegacySession: normalizeLegacySession,
        isLoggedIn: isLoggedIn,
        getRole: getRole,
        getUserId: getUserId,
        canManageRegisters: canManageRegisters,
        canSeePrices: canSeePrices,
        getLoggedInCompanyDisplayName: getLoggedInCompanyDisplayName,
        isNotebookViewport: isNotebookViewport,
        enforceNotebookLogin: enforceNotebookLogin,
        enforceRegisterPages: enforceRegisterPages,
        applyNavRegisterVisibility: applyNavRegisterVisibility,
        safeNextPath: safeNextPath
    };
})(typeof window !== "undefined" ? window : this);
