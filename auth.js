/**
 * 세션 + /api/auth/login (MongoDB staff · vendors 컬렉션 조회)
 * 역할: supervisor | admin | guest | vendor | oauth
 */
(function (global) {
    var AUTH_KEY = "thejhon_logged_in";
    var USER_ID_KEY = "thejhon_user_id";
    var ROLE_KEY = "thejhon_role";
    var COMPANY_KEY = "thejhon_company_name";
    var DISPLAY_KEY = "thejhon_display_name";

    var SUPERVISOR_ID = "thejohn";
    var GUEST_ID = "guest";

    function normalizeId(s) {
        return String(s || "")
            .trim()
            .toLowerCase();
    }

    function isStaffRole(role) {
        return role === "supervisor" || role === "admin";
    }

    function clearSession() {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(USER_ID_KEY);
        sessionStorage.removeItem(ROLE_KEY);
        sessionStorage.removeItem(COMPANY_KEY);
        sessionStorage.removeItem(DISPLAY_KEY);
        sessionStorage.removeItem("thejhon_auth_provider");
        sessionStorage.removeItem("thejhon_google_credential");
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken("");
    }

    function normalizeLegacySession() {
        if (sessionStorage.getItem(AUTH_KEY) === "1" && !sessionStorage.getItem(ROLE_KEY)) {
            clearSession();
        }
        var role = sessionStorage.getItem(ROLE_KEY);
        if (role === "admin" && !sessionStorage.getItem(DISPLAY_KEY)) {
            sessionStorage.setItem(DISPLAY_KEY, sessionStorage.getItem(USER_ID_KEY) || "");
        }
    }

    function mapLoginResponse(data) {
        if (!data || !data.ok) return null;
        return {
            role: data.role,
            userId: data.userId,
            token: data.token,
            companyName: data.companyName || "",
            displayName: data.displayName || data.companyName || data.userId || ""
        };
    }

    function verifyFormCredentialsAsync(id, pw) {
        if (!global.THEJHON_API || !THEJHON_API.login) {
            return Promise.reject(new Error("API를 불러오지 못했습니다. 페이지를 새로고침해 주세요."));
        }
        return THEJHON_API.login(id, pw)
            .then(mapLoginResponse)
            .catch(function (err) {
                if (err && err.data && err.data.code === "NOT_REGISTERED") {
                    var notReg = new Error(
                        err.data.error || "더존 관리자에게 회원 등록을 요청해야 합니다."
                    );
                    notReg.code = "NOT_REGISTERED";
                    throw notReg;
                }
                if (err && err.message) throw err;
                throw new Error("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
            });
    }

    function loginAsGuestAsync() {
        return verifyFormCredentialsAsync(GUEST_ID, "guest");
    }

    function setFormSession(userId, role, token, companyName, displayName) {
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(USER_ID_KEY, userId || "");
        sessionStorage.setItem(ROLE_KEY, role || "");
        sessionStorage.setItem("thejhon_auth_provider", "form");
        if (companyName) sessionStorage.setItem(COMPANY_KEY, companyName);
        else sessionStorage.removeItem(COMPANY_KEY);
        if (displayName) sessionStorage.setItem(DISPLAY_KEY, displayName);
        else sessionStorage.removeItem(DISPLAY_KEY);
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken(token || "");
    }

    function setOAuthSession(provider) {
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(USER_ID_KEY, "oauth_" + String(provider || "sns"));
        sessionStorage.setItem(ROLE_KEY, "oauth");
        sessionStorage.setItem("thejhon_auth_provider", String(provider || "oauth"));
        sessionStorage.removeItem(COMPANY_KEY);
        sessionStorage.removeItem(DISPLAY_KEY);
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

    /** 미로그인·게스트 로그인 — 상품 가격 비공개, 등록 메뉴 비표시 */
    function isGuestMode() {
        if (!isLoggedIn()) return true;
        return getRole() === "guest";
    }

    var PRODUCT_ADMIN_PAGES = [
        "product-manage.html",
        "product-register.html",
        "product-edit.html",
        "product-list-admin.html"
    ];
    var VENDOR_ADMIN_PAGES = ["vendor-manage.html", "vendor-register.html", "vendor-edit.html"];
    var ADMIN_REGISTER_PAGES = PRODUCT_ADMIN_PAGES.concat(VENDOR_ADMIN_PAGES);

    /** 슈퍼바이저·관리자만 상품·업체 관리 */
    function canManageRegisters() {
        return isStaffRole(getRole()) && !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken());
    }

    /** 업체·스테프만 상품 가격 표시 */
    function canSeePrices() {
        var r = getRole();
        return isStaffRole(r) || r === "vendor";
    }

    function getLoggedInCompanyDisplayName() {
        if (!isLoggedIn()) return "";
        var role = getRole();
        if (role === "guest") return "";
        var display = sessionStorage.getItem(DISPLAY_KEY);
        if (display) return display;
        if (role === "supervisor") return "슈퍼바이저";
        if (role === "admin") return "(주)더존";
        if (role === "vendor") {
            var stored = sessionStorage.getItem(COMPANY_KEY);
            return stored || getUserId();
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

    function enforceRegisterPages() {
        var page = currentPageFile();
        if (ADMIN_REGISTER_PAGES.indexOf(page) < 0) return;
        if (!isLoggedIn()) {
            window.location.replace("index.html?denied=register");
            return;
        }
        if (canManageRegisters()) return;
        window.location.replace("index.html?denied=register");
    }

    function getRegisterAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return {
                allowed: false,
                reason:
                    "관리자(thejohn, aksangsa 등)로 로그인해야 저장됩니다. 상단 로그인 → 저장 시 MongoDB에 기록됩니다."
            };
        }
        if (!isLoggedIn()) {
            return { allowed: false, reason: "로그인이 필요합니다." };
        }
        if (!canManageRegisters()) {
            return {
                allowed: false,
                reason: "관리자(스테프)만 등록·수정·삭제할 수 있습니다. 업체 계정으로는 이 메뉴를 사용할 수 없습니다."
            };
        }
        return { allowed: true, role: getRole() };
    }

    function applyNavRegisterVisibility() {
        try {
            normalizeLegacySession();
            var sel =
                '.site-header-nav [data-nav-dropdown="product-manage"], .site-header-nav [data-nav-dropdown="vendor-manage"]';
            var nodes = document.querySelectorAll(sel);
            var show = canManageRegisters();
            for (var i = 0; i < nodes.length; i++) {
                if (show) {
                    nodes[i].classList.remove("header-nav-link--register-hidden");
                    nodes[i].removeAttribute("aria-hidden");
                } else {
                    nodes[i].classList.add("header-nav-link--register-hidden");
                    nodes[i].setAttribute("aria-hidden", "true");
                }
            }
        } catch (e) {}
    }

    global.THEJHON_AUTH = {
        AUTH_KEY: AUTH_KEY,
        ROLE_KEY: ROLE_KEY,
        SUPERVISOR_ID: SUPERVISOR_ID,
        ADMIN_ID: SUPERVISOR_ID,
        isStaffRole: isStaffRole,
        verifyFormCredentialsAsync: verifyFormCredentialsAsync,
        loginAsGuestAsync: loginAsGuestAsync,
        setFormSession: setFormSession,
        setOAuthSession: setOAuthSession,
        clearSession: clearSession,
        normalizeLegacySession: normalizeLegacySession,
        isLoggedIn: isLoggedIn,
        getRole: getRole,
        getUserId: getUserId,
        isGuestMode: isGuestMode,
        getRegisterAccess: getRegisterAccess,
        canManageRegisters: canManageRegisters,
        canSeePrices: canSeePrices,
        getLoggedInCompanyDisplayName: getLoggedInCompanyDisplayName,
        isNotebookViewport: isNotebookViewport,
        enforceRegisterPages: enforceRegisterPages,
        applyNavRegisterVisibility: applyNavRegisterVisibility,
        safeNextPath: safeNextPath
    };
})(typeof window !== "undefined" ? window : this);
