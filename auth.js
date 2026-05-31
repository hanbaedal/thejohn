/**
 * 세션 + /api/auth/login (MongoDB staff · vendors)
 *
 * 로그인·권한 정책
 * - 로그아웃 → login.html
 * - 미로그인 방문 → login.html (아이디 로그인 또는 게스트 로그인 선택)
 * - 슈퍼바이저: 관리자(staff) 생성 · 전체 기능
 * - 관리자: 업체(vendors) 생성 · 주문 권한(st_order_enabled)은 슈퍼바이저 부여
 * - 업체: 담당 관리자 상품 등급가, 타 관리자 상품은 가격1 · 주문은 담당 관리자+주문권한 있을 때
 * - 게스트 로그인: 상품 열람(가격 없음) · 외부 접속 통계(guest_login·page_view)
 */
(function (global) {
    var AUTH_KEY = "thejhon_logged_in";
    var USER_ID_KEY = "thejhon_user_id";
    var ROLE_KEY = "thejhon_role";
    var COMPANY_KEY = "thejhon_company_name";
    var DISPLAY_KEY = "thejhon_display_name";
    var VENDOR_GRADE_KEY = "thejhon_vendor_grade";
    var VENDOR_REGISTERED_BY_KEY = "thejhon_vendor_registered_by";
    var VENDOR_ORDER_ENABLED_KEY = "thejhon_vendor_order_enabled";
    var VENDOR_MGR_NAME_KEY = "thejhon_vendor_mgr_name";
    var VENDOR_MGR_TEL_KEY = "thejhon_vendor_mgr_tel";
    var VENDOR_MGR_EMAIL_KEY = "thejhon_vendor_mgr_email";
    var STAFF_ORDER_ENABLED_KEY = "thejhon_staff_order_enabled";
    var STAFF_LOGO_KEY = "thejhon_staff_logo";
    var BRAND_COMPANY_KEY = "thejhon_brand_company_name";
    var LOGIN_ID_HINT_KEY = "thejhon_login_id_hint";
    var GUEST_ID_KEY = "thejhon_guest_id";

    var store = global.THEJHON_AUTH_STORAGE;

    /** 탭마다 sessionStorage(크롬 새 탭 업체별 로그인). PWA(홈 화면)만 localStorage 유지 */
    var AUTH_PERSIST_KEYS = [
        AUTH_KEY,
        USER_ID_KEY,
        ROLE_KEY,
        COMPANY_KEY,
        DISPLAY_KEY,
        "thejhon_auth_provider",
        VENDOR_GRADE_KEY,
        VENDOR_REGISTERED_BY_KEY,
        VENDOR_ORDER_ENABLED_KEY,
        VENDOR_MGR_NAME_KEY,
        VENDOR_MGR_TEL_KEY,
        VENDOR_MGR_EMAIL_KEY,
        STAFF_ORDER_ENABLED_KEY,
        STAFF_LOGO_KEY,
        BRAND_COMPANY_KEY,
        GUEST_ID_KEY
    ];

    function authGet(key) {
        return store ? store.get(key) : "";
    }

    function authSet(key, value) {
        if (store) store.set(key, value);
    }

    function authRemove(key) {
        if (store) store.remove(key);
    }

    function clearLocalAuthPersist() {
        if (!store) return;
        store.clearLocalKeys(AUTH_PERSIST_KEYS.concat(["thejhon_api_token"]));
    }

    function hydrateSessionFromLocalIfPwa() {
        if (!store) return;
        store.hydrateSessionFromLocal(AUTH_PERSIST_KEYS);
        if (global.THEJHON_API && THEJHON_API.hydrateTokenFromLocalIfPwa) {
            THEJHON_API.hydrateTokenFromLocalIfPwa();
        }
    }

    function migrateAuthStorageOnce() {
        if (!store) return;
        if (store.isPwaStandalone()) {
            hydrateSessionFromLocalIfPwa();
        } else {
            clearLocalAuthPersist();
        }
    }

    migrateAuthStorageOnce();

    function clearVendorCartIfAny() {
        try {
            if (global.THEJHON_VENDOR_CART && THEJHON_VENDOR_CART.clearCart) {
                THEJHON_VENDOR_CART.clearCart();
            }
        } catch (e) {}
    }

    /** sessionStorage·토큰만 비움 (이 탭 계정 전환) */
    function clearAuthStorageLocal() {
        var i;
        for (i = 0; i < AUTH_PERSIST_KEYS.length; i++) {
            authRemove(AUTH_PERSIST_KEYS[i]);
        }
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken("");
    }

    function clearSession() {
        try {
            if (
                global.THEJHON_API &&
                THEJHON_API.getToken &&
                THEJHON_API.getToken() &&
                THEJHON_API.logoutAsync
            ) {
                THEJHON_API.logoutAsync().catch(function () {});
            }
        } catch (e) {}
        clearAuthStorageLocal();
        clearVendorCartIfAny();
    }

    function usesStaffLogoRole(role) {
        var r = role != null ? role : authGet(ROLE_KEY) || "";
        return r === "admin" || r === "supervisor" || r === "vendor";
    }

    function cacheStaffLogo(logo, brandCompanyName) {
        var src = String(logo || "").trim();
        if (src) authSet(STAFF_LOGO_KEY, src);
        else authRemove(STAFF_LOGO_KEY);
        var brand = String(brandCompanyName || "").trim();
        if (brand && usesStaffLogoRole()) authSet(BRAND_COMPANY_KEY, brand);
    }

    function getCachedStaffLogo() {
        try {
            return String(authGet(STAFF_LOGO_KEY) || "").trim();
        } catch (e) {
            return "";
        }
    }

    function clearStaffLogoCache() {
        authRemove(STAFF_LOGO_KEY);
    }

    function normalizeId(s) {
        return String(s || "")
            .trim()
            .toLowerCase();
    }

    function isStaffRole(role) {
        return role === "admin" || role === "supervisor";
    }

    function normalizeLegacySession() {
        if (authGet(AUTH_KEY) === "1" && !authGet(ROLE_KEY)) {
            clearSession();
        }
        var role = authGet(ROLE_KEY);
        if (role === "guest") {
            var gid = String(authGet(GUEST_ID_KEY) || authGet(USER_ID_KEY) || "").trim();
            if (gid) {
                if (!authGet(GUEST_ID_KEY)) authSet(GUEST_ID_KEY, gid);
                if (!authGet(USER_ID_KEY)) authSet(USER_ID_KEY, gid);
            }
            if (!authGet(DISPLAY_KEY)) authSet(DISPLAY_KEY, "게스트");
            return;
        }
        if (role === "vendor") {
            var brand = String(authGet(BRAND_COMPANY_KEY) || "").trim();
            if (brand) authSet(DISPLAY_KEY, brand);
            else {
                var vendorCo = authGet(COMPANY_KEY);
                if (vendorCo) authSet(DISPLAY_KEY, vendorCo);
            }
        } else if (isStaffRole(role)) {
            var company = authGet(COMPANY_KEY);
            if (company) {
                authSet(DISPLAY_KEY, company);
                if (!authGet(BRAND_COMPANY_KEY)) authSet(BRAND_COMPANY_KEY, company);
            }
        } else if (role === "admin" && !authGet(DISPLAY_KEY)) {
            authSet(DISPLAY_KEY, authGet(USER_ID_KEY) || "");
        }
    }

    normalizeLegacySession();

    function mapLoginResponse(data) {
        if (!data || !data.ok) return null;
        return {
            role: data.role,
            userId: data.userId,
            token: data.token,
            companyName: data.companyName || "",
            displayName: data.companyName || data.displayName || data.userId || "",
            vendorGrade: data.vendorGrade || "",
            vendorRegisteredBy: data.vendorRegisteredBy || "",
            vendorRegisteredByName: data.vendorRegisteredByName || data.brandCompanyName || "",
            brandCompanyName: data.brandCompanyName || data.vendorRegisteredByName || "",
            vendorOrderEnabled: !!data.vendorOrderEnabled,
            staffOrderEnabled: !!data.staffOrderEnabled,
            vendorMgrName: data.vendorMgrName || "",
            vendorMgrTel: data.vendorMgrTel || "",
            vendorMgrEmail: data.vendorMgrEmail || "",
            stLogo: data.stLogo || data.st_logo || ""
        };
    }

    function storeVendorOrderContact(contact) {
        var c = contact || {};
        var name = String(c.mgrName != null ? c.mgrName : c.vn_mgr_name || "").trim();
        var tel = String(c.mgrTel != null ? c.mgrTel : c.vn_mgr_tel || "").trim();
        var email = String(c.mgrEmail != null ? c.mgrEmail : c.vn_mgr_email || "").trim();
        if (name) authSet(VENDOR_MGR_NAME_KEY, name);
        else authRemove(VENDOR_MGR_NAME_KEY);
        if (tel) authSet(VENDOR_MGR_TEL_KEY, tel);
        else authRemove(VENDOR_MGR_TEL_KEY);
        if (email) authSet(VENDOR_MGR_EMAIL_KEY, email);
        else authRemove(VENDOR_MGR_EMAIL_KEY);
    }

    function getVendorCompanyName() {
        return String(authGet(COMPANY_KEY) || "").trim();
    }

    function getBrandCompanyDisplayName() {
        if (!isLoggedIn()) return "";
        var brand = String(authGet(BRAND_COMPANY_KEY) || "").trim();
        if (brand) return brand;
        var role = getRole();
        if (role === "supervisor" || role === "admin") {
            return String(authGet(COMPANY_KEY) || "").trim() || "(주)더존";
        }
        return "";
    }

    function updateBrandFromStaffProfile(st) {
        if (!st || !isLoggedIn()) return;
        var company = String(st.st_company || "").trim();
        var logo = String(st.st_logo || "").trim();
        var role = getRole();
        if (company) {
            authSet(BRAND_COMPANY_KEY, company);
            if (role === "vendor") authSet(DISPLAY_KEY, company);
            else if (isStaffRole(role)) {
                authSet(COMPANY_KEY, company);
                authSet(DISPLAY_KEY, company);
            }
        }
        if (usesStaffLogoRole(role)) {
            cacheStaffLogo(logo, company || getBrandCompanyDisplayName());
        }
        if (typeof global.__thejhonApplyHomeHeroCompany === "function") {
            try {
                global.__thejhonApplyHomeHeroCompany(getBrandCompanyDisplayName());
            } catch (e) {}
        }
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            try {
                global.__thejhonRefreshHeaderCompany();
            } catch (e2) {}
        }
        if (typeof global.__thejhonApplySiteLogo === "function") {
            try {
                global.__thejhonApplySiteLogo(logo, company || getBrandCompanyDisplayName());
            } catch (e3) {}
        }
    }

    function getVendorOrderContact() {
        return {
            company: getRole() === "vendor" ? getVendorCompanyName() : getBrandCompanyDisplayName(),
            mgrName: String(authGet(VENDOR_MGR_NAME_KEY) || "").trim(),
            mgrTel: String(authGet(VENDOR_MGR_TEL_KEY) || "").trim(),
            mgrEmail: String(authGet(VENDOR_MGR_EMAIL_KEY) || "").trim()
        };
    }

    function fetchVendorOrderContactAsync() {
        var cached = getVendorOrderContact();
        if (cached.mgrName && cached.mgrTel) {
            return Promise.resolve(cached);
        }
        if (!global.THEJHON_API || !THEJHON_API.getVendorProfile) {
            return Promise.resolve(cached);
        }
        return THEJHON_API.getVendorProfile()
            .then(function (item) {
                if (item) {
                    storeVendorOrderContact(item);
                }
                return getVendorOrderContact();
            })
            .catch(function () {
                return getVendorOrderContact();
            });
    }

    function parseVendorGrade(g) {
        var n = parseInt(g, 10);
        if (n >= 1 && n <= 3) return String(n);
        if (n === 4) return "3";
        return "1";
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
                if (err && err.data && err.data.code === "BAD_PASSWORD") {
                    var badPw = new Error(
                        (err.data.hint && String(err.data.hint).trim()) ||
                            err.data.error ||
                            "아이디 또는 비밀번호가 올바르지 않습니다."
                    );
                    badPw.code = "BAD_PASSWORD";
                    throw badPw;
                }
                if (err && err.data && err.data.code === "VENDOR_NO_PASSWORD") {
                    var noPw = new Error(
                        (err.data.hint && String(err.data.hint).trim()) ||
                            err.data.error ||
                            "비밀번호가 설정되지 않은 업체 계정입니다."
                    );
                    noPw.code = "VENDOR_NO_PASSWORD";
                    throw noPw;
                }
                if (err && err.data && err.data.code === "ALREADY_LOGGED_IN") {
                    var dup = new Error(
                        err.data.error || "다른곳에서 로그인해서 사용중입니다!"
                    );
                    dup.code = "ALREADY_LOGGED_IN";
                    throw dup;
                }
                if (err && err.data && err.data.code === "LOGIN_DISABLED") {
                    var disabled = new Error(
                        err.data.error || "접속이 비활성화된 관리자 계정입니다."
                    );
                    disabled.code = "LOGIN_DISABLED";
                    throw disabled;
                }
                if (err && err.message) throw err;
                throw new Error("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
            });
    }

    function setFormSession(
        userId,
        role,
        token,
        companyName,
        displayName,
        vendorGrade,
        vendorRegisteredBy,
        vendorOrderEnabled,
        vendorMgrName,
        vendorMgrTel,
        vendorMgrEmail,
        staffOrderEnabled,
        staffLogo,
        brandCompanyName
    ) {
        var prevUser = authGet(USER_ID_KEY);
        var hadToken =
            global.THEJHON_API && THEJHON_API.getToken && !!THEJHON_API.getToken();
        if (hadToken && THEJHON_API.logoutAsync) {
            THEJHON_API.logoutAsync().catch(function () {});
        }
        clearAuthStorageLocal();
        if (prevUser && prevUser !== (userId || "")) {
            clearVendorCartIfAny();
        }

        authSet(AUTH_KEY, "1");
        authSet(USER_ID_KEY, userId || "");
        authSet(ROLE_KEY, role || "");
        try {
            if (userId) localStorage.setItem(LOGIN_ID_HINT_KEY, userId);
        } catch (e) {}
        authSet("thejhon_auth_provider", "form");
        if (role === "vendor") {
            authSet(VENDOR_GRADE_KEY, parseVendorGrade(vendorGrade));
            var regBy = String(vendorRegisteredBy || "").trim();
            if (regBy) authSet(VENDOR_REGISTERED_BY_KEY, regBy);
            else authRemove(VENDOR_REGISTERED_BY_KEY);
            if (vendorOrderEnabled) authSet(VENDOR_ORDER_ENABLED_KEY, "1");
            else authRemove(VENDOR_ORDER_ENABLED_KEY);
            storeVendorOrderContact({
                mgrName: vendorMgrName,
                mgrTel: vendorMgrTel,
                mgrEmail: vendorMgrEmail
            });
        } else {
            authRemove(VENDOR_GRADE_KEY);
            authRemove(VENDOR_REGISTERED_BY_KEY);
            authRemove(VENDOR_ORDER_ENABLED_KEY);
            authRemove(VENDOR_MGR_NAME_KEY);
            authRemove(VENDOR_MGR_TEL_KEY);
            authRemove(VENDOR_MGR_EMAIL_KEY);
        }
        if (role === "admin" && staffOrderEnabled) {
            authSet(STAFF_ORDER_ENABLED_KEY, "1");
        } else {
            authRemove(STAFF_ORDER_ENABLED_KEY);
        }
        var label = companyName || "";
        var brandLabel = String(brandCompanyName || "").trim();
        if (role === "vendor") {
            if (label) {
                authSet(COMPANY_KEY, label);
            } else {
                authRemove(COMPANY_KEY);
            }
            if (brandLabel) {
                authSet(BRAND_COMPANY_KEY, brandLabel);
                authSet(DISPLAY_KEY, brandLabel);
            } else {
                authRemove(BRAND_COMPANY_KEY);
                if (label) authSet(DISPLAY_KEY, label);
                else authRemove(DISPLAY_KEY);
            }
        } else if (isStaffRole(role)) {
            if (label) {
                authSet(COMPANY_KEY, label);
                authSet(DISPLAY_KEY, label);
                authSet(BRAND_COMPANY_KEY, label);
            } else {
                authRemove(COMPANY_KEY);
                authRemove(DISPLAY_KEY);
                authRemove(BRAND_COMPANY_KEY);
            }
        } else {
            if (companyName) authSet(COMPANY_KEY, companyName);
            else authRemove(COMPANY_KEY);
            if (displayName) authSet(DISPLAY_KEY, displayName);
            else authRemove(DISPLAY_KEY);
            authRemove(BRAND_COMPANY_KEY);
        }
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken(token || "");
        if (usesStaffLogoRole(role)) {
            cacheStaffLogo(staffLogo, brandLabel || label);
            if (typeof global.__thejhonApplySiteLogo === "function") {
                try {
                    global.__thejhonApplySiteLogo(staffLogo, brandLabel || label);
                } catch (eLogo) {}
            }
        } else {
            clearStaffLogoCache();
        }
        if (typeof global.__thejhonRefreshFooterCompany === "function") {
            try {
                global.__thejhonRefreshFooterCompany();
            } catch (e) {}
        }
        if (typeof global.__thejhonRefreshFooterSocial === "function") {
            try {
                global.__thejhonRefreshFooterSocial();
            } catch (e) {}
        }
    }

    function setOAuthSession(provider) {
        authSet(AUTH_KEY, "1");
        authSet(USER_ID_KEY, "oauth_" + String(provider || "sns"));
        authSet(ROLE_KEY, "oauth");
        authSet("thejhon_auth_provider", String(provider || "oauth"));
        authRemove(COMPANY_KEY);
        authRemove(DISPLAY_KEY);
        authRemove(VENDOR_GRADE_KEY);
        authRemove(VENDOR_REGISTERED_BY_KEY);
        authRemove(VENDOR_ORDER_ENABLED_KEY);
        authRemove(VENDOR_MGR_NAME_KEY);
        authRemove(VENDOR_MGR_TEL_KEY);
        authRemove(VENDOR_MGR_EMAIL_KEY);
    }

    function isGuest() {
        return getRole() === "guest";
    }

    function getGuestId() {
        if (!isGuest()) return "";
        return String(authGet(GUEST_ID_KEY) || authGet(USER_ID_KEY) || "").trim();
    }

    function newGuestId() {
        return (
            "guest_" +
            Date.now().toString(36) +
            "_" +
            Math.random().toString(36).slice(2, 8)
        );
    }

    /** 게스트 로그인 세션 — 접속 통계용 (가격·관리 메뉴 없음) */
    function setGuestSession() {
        clearAuthStorageLocal();
        clearVendorCartIfAny();
        var guestId = newGuestId();
        authSet(GUEST_ID_KEY, guestId);
        authSet(AUTH_KEY, "1");
        authSet(ROLE_KEY, "guest");
        authSet(USER_ID_KEY, guestId);
        authSet("thejhon_auth_provider", "guest");
        authSet(DISPLAY_KEY, "게스트");
        clearStaffLogoCache();
        authRemove(BRAND_COMPANY_KEY);
        authRemove(COMPANY_KEY);
        if (typeof global.__thejhonApplyDefaultBrandedLogo === "function") {
            try {
                global.__thejhonApplyDefaultBrandedLogo("");
            } catch (e) {}
        } else if (typeof global.__thejhonApplySiteLogo === "function") {
            try {
                global.__thejhonApplySiteLogo("", "");
            } catch (eLogo) {}
        }
        return guestId;
    }

    function enterGuestSessionAsync() {
        var hadToken =
            global.THEJHON_API &&
            THEJHON_API.getToken &&
            !!THEJHON_API.getToken();
        function finish() {
            var guestId = setGuestSession();
            if (!global.THEJHON_API || !THEJHON_API.logGuestLogin) {
                return Promise.resolve(guestId);
            }
            return THEJHON_API.logGuestLogin(guestId)
                .catch(function () {
                    return null;
                })
                .then(function () {
                    return guestId;
                });
        }
        if (hadToken && THEJHON_API.logoutAsync) {
            return THEJHON_API.logoutAsync()
                .catch(function () {})
                .then(finish);
        }
        return finish();
    }

    function isLoggedIn() {
        return authGet(AUTH_KEY) === "1" && !!authGet(ROLE_KEY);
    }

    function getRole() {
        return authGet(ROLE_KEY) || "";
    }

    function getUserId() {
        return authGet(USER_ID_KEY) || "";
    }

    var PRODUCT_ADMIN_PAGES = [
        "product-manage.html",
        "product-register.html",
        "product-edit.html",
        "product-list-admin.html",
        "product-new-register.html",
        "product-new-list.html"
    ];
    var VENDOR_ADMIN_PAGES = [
        "vendor-manage.html",
        "vendor-register.html",
        "vendor-edit.html",
        "vendor-list-admin.html",
        "vendor-detail.html",
        "vendor-new-register.html",
        "vendor-new-list.html",
        "vendor-email-broadcast.html",
        "vendor-prospect-list.html",
        "vendor-excel-import.html",
        "vendor-prospect-finder.html"
    ];
    var ORDER_MANAGE_PAGES = ["order-list-admin.html"];
    var STAFF_MANAGE_PAGES = [
        "staff-manage-hub.html",
        "staff-manage.html",
        "supervisor-order-list.html",
        "supervisor-access-stats.html",
        "supervisor-db-stats.html"
    ];
    var ADMIN_REGISTER_PAGES = PRODUCT_ADMIN_PAGES.concat(VENDOR_ADMIN_PAGES);

    /** 관리자(staff admin)만 상품·업체 관리 메뉴·등록 API */
    function canManageRegisters() {
        return canShowAdminNavMenus();
    }

    /** 규칙 1: 관리자만 상품관리·업체관리 메뉴 표시 */
    function canShowAdminNavMenus() {
        return isStaffRole(getRole()) && !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken());
    }

    /** 규칙 2·3: 업체·관리자만 가격 표시 가능 (미로그인·SNS 제외) */
    function canSeePrices() {
        return canSeeProductPrices();
    }

    function canSeeProductPrices() {
        if (!isLoggedIn()) return false;
        var r = getRole();
        if (r === "oauth") return false;
        return isStaffRole(r) || r === "vendor";
    }

    /** 사업부문·상품 상세 — 관리자도 가격1만 (등록 화면은 폼 필드로 1~4 입력) */
    function canSeeAllProductPrices() {
        return false;
    }

    function getVendorPriceGrade() {
        if (getRole() !== "vendor") return "";
        return parseVendorGrade(authGet(VENDOR_GRADE_KEY));
    }

    function getPriceKeyForGrade(grade) {
        var g = parseVendorGrade(grade);
        if (g === "2") return "pd_price2";
        if (g === "3") return "pd_price3";
        return "pd_price1";
    }

    function vendorGradeLabel(grade) {
        var g = parseVendorGrade(grade);
        return g + "등급";
    }

    function syncVendorGradeFromSessionApi(sess) {
        if (sess && sess.loggedIn && sess.role === "vendor") {
            if (sess.vendorGrade) {
                authSet(VENDOR_GRADE_KEY, parseVendorGrade(sess.vendorGrade));
            }
            if (sess.vendorRegisteredBy) {
                authSet(
                    VENDOR_REGISTERED_BY_KEY,
                    String(sess.vendorRegisteredBy).trim()
                );
            }
            if (sess.vendorOrderEnabled) {
                authSet(VENDOR_ORDER_ENABLED_KEY, "1");
            } else {
                authRemove(VENDOR_ORDER_ENABLED_KEY);
            }
        }
        if (sess && sess.loggedIn && sess.role === "admin") {
            if (sess.staffOrderEnabled) {
                authSet(STAFF_ORDER_ENABLED_KEY, "1");
            } else {
                authRemove(STAFF_ORDER_ENABLED_KEY);
            }
        }
    }

    function refreshSessionPermissionsAsync() {
        if (!global.THEJHON_API || !THEJHON_API.checkSession) {
            return Promise.resolve(null);
        }
        if (!THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return Promise.resolve(null);
        }
        if (!isLoggedIn()) {
            return Promise.resolve(null);
        }
        return THEJHON_API.checkSession()
            .then(function (sess) {
                if (sess && sess.code === "SESSION_INVALID") {
                    handleSessionInvalid(sess);
                    return sess;
                }
                if (sess && sess.loggedIn) {
                    syncVendorGradeFromSessionApi(sess);
                    applyNavRegisterVisibility();
                    if (typeof global.__thejhonRefreshVendorCartNav === "function") {
                        try {
                            global.__thejhonRefreshVendorCartNav();
                        } catch (e) {}
                    }
                    try {
                        global.dispatchEvent(new CustomEvent("thejhon-auth-permissions-updated"));
                    } catch (e2) {}
                }
                return sess;
            })
            .catch(function () {
                return null;
            });
    }

    function refreshBrandFromStaffProfileAsync() {
        if (!isLoggedIn() || !usesStaffLogoRole()) return Promise.resolve(null);
        if (!global.THEJHON_API || !THEJHON_API.getStaffProfile) return Promise.resolve(null);
        if (!THEJHON_API.getToken || !THEJHON_API.getToken()) return Promise.resolve(null);
        return THEJHON_API.getStaffProfile()
            .then(function (data) {
                if (data) updateBrandFromStaffProfile(data);
                return data;
            })
            .catch(function () {
                return null;
            });
    }

    (function bootSiteLoginGate() {
        if (typeof document === "undefined") return;
        function run() {
            enforceSiteLogin();
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run);
        } else {
            run();
        }
    })();

    (function bootBrandProfileRefresh() {
        if (typeof document === "undefined") return;
        function run() {
            refreshBrandFromStaffProfileAsync();
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run);
        } else {
            run();
        }
        window.addEventListener("pageshow", run);
    })();

    (function bootSessionPermissionRefresh() {
        if (typeof document === "undefined") return;
        function run() {
            refreshSessionPermissionsAsync();
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run);
        } else {
            run();
        }
        window.addEventListener("pageshow", run);
    })();

    function isStaffOrderEnabled() {
        return authGet(STAFF_ORDER_ENABLED_KEY) === "1";
    }

    function isVendorOrderEnabled() {
        return authGet(VENDOR_ORDER_ENABLED_KEY) === "1";
    }

    function staffLoginIdsEqualClient(a, b) {
        var ka = String(a || "").trim().toLowerCase();
        var kb = String(b || "").trim().toLowerCase();
        if (!ka || !kb) return ka === kb;
        return ka === kb;
    }

    function getVendorRegisteredBy() {
        if (getRole() !== "vendor") return "";
        return String(authGet(VENDOR_REGISTERED_BY_KEY) || "").trim();
    }

    /** 업체 거래처(등록 담당)와 상품 등록 담당이 같을 때만 등급가 적용 */
    function vendorProductUsesGradePrice(it) {
        if (!it || getRole() !== "vendor") return false;
        var mine = getVendorRegisteredBy();
        var productOwner = String(it.pd_registered_by || "").trim();
        if (!mine || mine.toLowerCase() === "legacy" || !productOwner || productOwner.toLowerCase() === "legacy") {
            return false;
        }
        return staffLoginIdsEqualClient(mine, productOwner);
    }

    /** 주문·장바구니 — 담당 관리자가 등록한 상품만 */
    function vendorProductCanOrder(it) {
        if (!it || getRole() !== "vendor") return false;
        if (!isVendorOrderEnabled()) return false;
        var mine = getVendorRegisteredBy();
        var owner = String(it.pd_registered_by || "").trim();
        if (!mine || !owner || owner.toLowerCase() === "legacy" || mine.toLowerCase() === "legacy") {
            return false;
        }
        return staffLoginIdsEqualClient(mine, owner);
    }

    /**
     * 상품 가격 HTML (products 목록·상세 공통)
     * options: { mode: "inline"|"detail", formatWon, escapeHtml }
     */
    /** 업체(vendor)만 상품 주문·장바구니 */
    function isSupervisorStaff() {
        return isLoggedIn() && getRole() === "supervisor";
    }

    /** 슈퍼바이저 — 엑셀 → vendor_prospects 일괄 등록 */
    function getSupervisorExcelImportAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return { allowed: false, reason: "로그인이 필요합니다. 슈퍼바이저로 로그인해 주세요." };
        }
        if (!isLoggedIn()) {
            return { allowed: false, reason: "로그인이 필요합니다." };
        }
        if (!isSupervisorStaff()) {
            return {
                allowed: false,
                reason: "엑셀 불러오기는 슈퍼바이저만 사용할 수 있습니다."
            };
        }
        return { allowed: true, reason: "" };
    }

    function getProspectFinderAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return { allowed: false, reason: "로그인이 필요합니다. 관리자 로그인 후 이용해 주세요." };
        }
        if (!isLoggedIn()) return { allowed: false, reason: "로그인이 필요합니다." };
        if (getRole() !== "admin") {
            return { allowed: false, reason: "예비 업체 찾기는 관리자만 사용할 수 있습니다." };
        }
        return { allowed: true, reason: "" };
    }

    /** 슈퍼바이저 — 관리자(staff) 등록·목록·수정 */
    function canManageStaffAccounts() {
        return (
            isSupervisorStaff() &&
            !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken())
        );
    }

    function getStaffManageAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return {
                allowed: false,
                reason: "로그인이 필요합니다. 슈퍼바이저로 로그인해 주세요."
            };
        }
        if (!isLoggedIn()) {
            return { allowed: false, reason: "로그인이 필요합니다." };
        }
        if (!canManageStaffAccounts()) {
            return {
                allowed: false,
                reason: "관리자 관리는 슈퍼바이저만 이용할 수 있습니다."
            };
        }
        return { allowed: true, role: getRole() };
    }

    function canPlaceVendorOrders() {
        return (
            isLoggedIn() &&
            getRole() === "vendor" &&
            isVendorOrderEnabled() &&
            !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken())
        );
    }

    /** 업체관리 — 주문서관리 메뉴·화면 (주문 권한 관리자만) */
    function canShowOrderManageMenu() {
        return (
            isLoggedIn() &&
            getRole() === "admin" &&
            isStaffOrderEnabled() &&
            !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken())
        );
    }

    function getOrderManageAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return {
                allowed: false,
                reason: "관리자로 로그인해야 합니다. 상단 로그인 후 다시 시도해 주세요."
            };
        }
        if (!isLoggedIn()) {
            return { allowed: false, reason: "로그인이 필요합니다." };
        }
        if (!canShowOrderManageMenu()) {
            return {
                allowed: false,
                reason: "주문서관리 권한이 있는 관리자만 이용할 수 있습니다."
            };
        }
        return { allowed: true, role: getRole() };
    }

    function getVendorUnitPriceForProduct(it) {
        if (!it || !canSeeProductPrices()) return { unitPrice: 0, priceLabel: "" };
        if (isStaffRole(getRole())) {
            var sp1 = Number(it.pd_price1);
            if (!isFinite(sp1)) sp1 = 0;
            return { unitPrice: sp1, priceLabel: DETAIL_PRICE_LABEL };
        }
        if (vendorProductUsesGradePrice(it)) {
            var grade = getVendorPriceGrade();
            var priceKey = getPriceKeyForGrade(grade);
            var priceVal = Number(it[priceKey]);
            if (!isFinite(priceVal)) priceVal = 0;
            var label = vendorGradeLabel(grade);
            return { unitPrice: priceVal, priceLabel: label };
        }
        var p1 = Number(it.pd_price1);
        if (!isFinite(p1)) p1 = 0;
        return { unitPrice: p1, priceLabel: "가격1" };
    }

    var PRICE_MASKED_TEXT = "전화 문의";
    var DETAIL_PRICE_LABEL = "가격";

    function buildProductPriceHtml(it, options) {
        options = options || {};
        var mode = options.mode || "inline";
        var formatWon =
            options.formatWon ||
            function (n) {
                var num = Number(n);
                if (!isFinite(num)) return "0";
                return num.toLocaleString("ko-KR") + "원";
            };
        var escapeHtml =
            options.escapeHtml ||
            function (s) {
                return String(s);
            };

        if (!canSeeProductPrices()) {
            if (mode === "detail") {
                return (
                    '<p class="pd-price pd-price-masked">가격: ' +
                    escapeHtml(PRICE_MASKED_TEXT) +
                    "</p>"
                );
            }
            return (
                '<span class="ps-price-masked">가격: ' + escapeHtml(PRICE_MASKED_TEXT) + "</span>"
            );
        }

        if (mode === "detail") {
            if (isStaffRole(getRole())) {
                var staffP1 = Number(it.pd_price1);
                if (!isFinite(staffP1)) staffP1 = 0;
                return (
                    '<p class="pd-price"><span class="pd-price-label">' +
                    escapeHtml(DETAIL_PRICE_LABEL) +
                    "</span> " +
                    escapeHtml(formatWon(staffP1)) +
                    "</p>"
                );
            }
            var pricedDetail = getVendorUnitPriceForProduct(it);
            var valDetail = pricedDetail.unitPrice;
            return (
                '<p class="pd-price"><span class="pd-price-label">' +
                escapeHtml(DETAIL_PRICE_LABEL) +
                "</span> " +
                escapeHtml(formatWon(valDetail)) +
                "</p>"
            );
        }

        var priced = getVendorUnitPriceForProduct(it);
        var label = priced.priceLabel || "가격1";
        var priceVal = priced.unitPrice;
        return (
            '<span class="ps-price-item">' +
            escapeHtml(label) +
            " " +
            escapeHtml(formatWon(priceVal)) +
            "</span>"
        );
    }

    /** 사업부문 목록 카드 — 미로그인: 가격 없음, 업체: 등급가, 관리자: 가격1만 */
    function buildCatalogListPriceHtml(it, options) {
        options = options || {};
        var formatWon =
            options.formatWon ||
            function (n) {
                var num = Number(n);
                if (!isFinite(num)) return "0원";
                return num.toLocaleString("ko-KR") + "원";
            };
        var escapeHtml =
            options.escapeHtml ||
            function (s) {
                return String(s);
            };

        if (!isLoggedIn() || !canSeeProductPrices()) {
            return "";
        }

        var role = getRole();
        if (isStaffRole(role)) {
            var p1 = Number(it.pd_price1);
            if (!isFinite(p1)) p1 = 0;
            return (
                '<p class="ps-card-price"><span class="ps-card-price-label">' +
                escapeHtml(DETAIL_PRICE_LABEL) +
                "</span> " +
                escapeHtml(formatWon(p1)) +
                "</p>"
            );
        }

        if (role === "vendor") {
            var priced = getVendorUnitPriceForProduct(it);
            var lbl = priced.priceLabel || vendorGradeLabel(getVendorPriceGrade());
            return (
                '<p class="ps-card-price"><span class="ps-card-price-label">' +
                escapeHtml(lbl) +
                "</span> " +
                escapeHtml(formatWon(priced.unitPrice)) +
                "</p>"
            );
        }

        return "";
    }

    function getLoggedInCompanyDisplayName() {
        if (!isLoggedIn()) return "";
        if (usesStaffLogoRole()) return getBrandCompanyDisplayName();
        return authGet(DISPLAY_KEY) || "";
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

    function redirectFromProtectedPage(showDeniedAlert) {
        window.location.replace(
            showDeniedAlert ? "index.html?denied=register" : "index.html"
        );
    }

    function trackPageViewIfNeeded() {
        try {
            if (!global.THEJHON_API || !THEJHON_API.trackPageView) return;
            if (!isLoggedIn()) return;
            var page = currentPageFile();
            if (!page || page === "login.html") return;
            THEJHON_API.trackPageView(page).catch(function () {});
        } catch (e) {}
    }

    function enforceSiteLogin() {
        normalizeLegacySession();
        var page = currentPageFile();
        if (page === "login.html") return;
        if (isLoggedIn()) return;
        var next = window.location.pathname + window.location.search + window.location.hash;
        if (!next || next === "/") next = "/index.html";
        window.location.replace(
            "login.html?next=" + encodeURIComponent(next)
        );
    }

    function enforceRegisterPages() {
        var page = currentPageFile();
        if (ORDER_MANAGE_PAGES.indexOf(page) >= 0) {
            if (!canShowOrderManageMenu()) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (STAFF_MANAGE_PAGES.indexOf(page) >= 0) {
            if (!canManageStaffAccounts()) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (page === "vendor-excel-import.html") {
            if (!getSupervisorExcelImportAccess().allowed) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (page === "vendor-prospect-finder.html") {
            if (!getProspectFinderAccess().allowed) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (ADMIN_REGISTER_PAGES.indexOf(page) < 0) return;
        if (!isLoggedIn()) {
            redirectFromProtectedPage(false);
            return;
        }
        if (canManageRegisters()) return;
        redirectFromProtectedPage(true);
    }

    /** 로그아웃 — 서버 세션 해제 후 로그인 페이지로 */
    function logout() {
        clearSession();
        window.location.replace("login.html");
    }

    var sessionInvalidHandled = false;
    function handleSessionInvalid(data) {
        if (sessionInvalidHandled) return;
        sessionInvalidHandled = true;
        clearSession();
        var msg =
            (data && data.error) ||
            "다른 곳에서 로그인되었거나 접속이 종료되었습니다. 다시 로그인해 주세요.";
        if (currentPageFile() !== "login.html" && currentPageFile() !== "index.html") {
            alert(msg);
            window.location.replace("login.html?next=" + encodeURIComponent(location.pathname + location.search));
        }
    }

    function getRegisterAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return {
                allowed: false,
                reason:
                    "관리자로 로그인해야 저장됩니다. 상단 로그인 후 다시 시도해 주세요."
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
            var showAdmin = canShowAdminNavMenus();
            if (document.body) {
                document.body.classList.toggle("nav-admin-menus", showAdmin);
            }
            var nav = document.querySelector(".site-header-nav");
            if (!nav) return;

            var sel =
                '[data-nav-dropdown="product-manage"],' +
                '[data-nav-dropdown="vendor-manage"],' +
                'a.header-nav-link[href="product-register.html"],' +
                'a.header-nav-link[href="vendor-register.html"],' +
                'a.header-nav-link[href="product-manage.html"],' +
                'a.header-nav-link[href="vendor-manage.html"]';
            var nodes = nav.querySelectorAll(sel);
            for (var i = 0; i < nodes.length; i++) {
                var el = nodes[i];
                if (el.classList.contains("nav-dropdown-item")) continue;
                if (showAdmin) {
                    el.classList.remove("header-nav-link--register-hidden");
                    el.removeAttribute("aria-hidden");
                    el.style.removeProperty("display");
                } else {
                    el.classList.add("header-nav-link--register-hidden");
                    el.setAttribute("aria-hidden", "true");
                }
            }
            if (!showAdmin) {
                var drops = nav.querySelectorAll(
                    '[data-nav-dropdown="product-manage"], [data-nav-dropdown="vendor-manage"]'
                );
                for (var d = 0; d < drops.length; d++) drops[d].remove();
            }
            var orderLinks = nav.querySelectorAll('a[href="order-list-admin.html"]');
            var showOrder = canShowOrderManageMenu();
            var excelLinks = nav.querySelectorAll(
                'a[href="vendor-excel-import.html"], [data-nav-excel-import]'
            );
            var showExcel = isSupervisorStaff();
            var finderLinks = nav.querySelectorAll(
                'a[href="vendor-prospect-finder.html"], [data-nav-prospect-finder]'
            );
            var showFinder = getRole() === "admin";
            for (var x = 0; x < excelLinks.length; x++) {
                excelLinks[x].hidden = !showExcel;
                excelLinks[x].setAttribute("aria-hidden", showExcel ? "false" : "true");
            }
            for (var f = 0; f < finderLinks.length; f++) {
                finderLinks[f].hidden = !showFinder;
                finderLinks[f].setAttribute("aria-hidden", showFinder ? "false" : "true");
            }
            for (var o = 0; o < orderLinks.length; o++) {
                if (showOrder) {
                    orderLinks[o].classList.remove("header-nav-link--register-hidden");
                    orderLinks[o].removeAttribute("aria-hidden");
                    orderLinks[o].style.removeProperty("display");
                } else {
                    orderLinks[o].remove();
                }
            }
            var staffManage = nav.querySelector(
                'a[href="staff-manage-hub.html"], a[href="staff-manage.html"]'
            );
            var showStaffManage = canManageStaffAccounts();
            if (staffManage) {
                if (showStaffManage) {
                    if (staffManage.getAttribute("href") === "staff-manage.html") {
                        staffManage.setAttribute("href", "staff-manage-hub.html");
                    }
                    staffManage.classList.remove("header-nav-link--register-hidden");
                    staffManage.removeAttribute("aria-hidden");
                    staffManage.style.removeProperty("display");
                } else {
                    staffManage.remove();
                }
            }
        } catch (e) {}
    }

    function getSavedLoginIdHint() {
        try {
            var hint = localStorage.getItem(LOGIN_ID_HINT_KEY);
            if (hint) return hint;
        } catch (e) {}
        return authGet(USER_ID_KEY) || "";
    }

    global.THEJHON_AUTH = {
        AUTH_KEY: AUTH_KEY,
        ROLE_KEY: ROLE_KEY,
        isStaffRole: isStaffRole,
        verifyFormCredentialsAsync: verifyFormCredentialsAsync,
        setFormSession: setFormSession,
        setOAuthSession: setOAuthSession,
        clearSession: clearSession,
        logout: logout,
        usesStaffLogoRole: usesStaffLogoRole,
        cacheStaffLogo: cacheStaffLogo,
        getCachedStaffLogo: getCachedStaffLogo,
        getSavedLoginIdHint: getSavedLoginIdHint,
        clearStaffLogoCache: clearStaffLogoCache,
        handleSessionInvalid: handleSessionInvalid,
        normalizeLegacySession: normalizeLegacySession,
        isLoggedIn: isLoggedIn,
        getRole: getRole,
        getUserId: getUserId,
        getRegisterAccess: getRegisterAccess,
        canManageRegisters: canManageRegisters,
        canShowAdminNavMenus: canShowAdminNavMenus,
        canSeePrices: canSeePrices,
        canSeeProductPrices: canSeeProductPrices,
        canSeeAllProductPrices: canSeeAllProductPrices,
        getVendorPriceGrade: getVendorPriceGrade,
        getVendorRegisteredBy: getVendorRegisteredBy,
        vendorProductUsesGradePrice: vendorProductUsesGradePrice,
        vendorProductCanOrder: vendorProductCanOrder,
        getPriceKeyForGrade: getPriceKeyForGrade,
        vendorGradeLabel: vendorGradeLabel,
        parseVendorGrade: parseVendorGrade,
        VENDOR_REGISTERED_BY_KEY: VENDOR_REGISTERED_BY_KEY,
        PRICE_MASKED_TEXT: PRICE_MASKED_TEXT,
        DETAIL_PRICE_LABEL: DETAIL_PRICE_LABEL,
        buildProductPriceHtml: buildProductPriceHtml,
        buildCatalogListPriceHtml: buildCatalogListPriceHtml,
        canPlaceVendorOrders: canPlaceVendorOrders,
        canShowOrderManageMenu: canShowOrderManageMenu,
        getOrderManageAccess: getOrderManageAccess,
        isVendorOrderEnabled: isVendorOrderEnabled,
        isStaffOrderEnabled: isStaffOrderEnabled,
        isSupervisorStaff: isSupervisorStaff,
        getSupervisorExcelImportAccess: getSupervisorExcelImportAccess,
        getProspectFinderAccess: getProspectFinderAccess,
        canManageStaffAccounts: canManageStaffAccounts,
        getStaffManageAccess: getStaffManageAccess,
        VENDOR_ORDER_ENABLED_KEY: VENDOR_ORDER_ENABLED_KEY,
        getVendorUnitPriceForProduct: getVendorUnitPriceForProduct,
        syncVendorGradeFromSessionApi: syncVendorGradeFromSessionApi,
        refreshSessionPermissionsAsync: refreshSessionPermissionsAsync,
        refreshBrandFromStaffProfileAsync: refreshBrandFromStaffProfileAsync,
        VENDOR_GRADE_KEY: VENDOR_GRADE_KEY,
        getLoggedInCompanyDisplayName: getLoggedInCompanyDisplayName,
        getBrandCompanyDisplayName: getBrandCompanyDisplayName,
        getVendorCompanyName: getVendorCompanyName,
        updateBrandFromStaffProfile: updateBrandFromStaffProfile,
        getVendorOrderContact: getVendorOrderContact,
        storeVendorOrderContact: storeVendorOrderContact,
        fetchVendorOrderContactAsync: fetchVendorOrderContactAsync,
        isNotebookViewport: isNotebookViewport,
        enforceRegisterPages: enforceRegisterPages,
        enforceSiteLogin: enforceSiteLogin,
        trackPageViewIfNeeded: trackPageViewIfNeeded,
        applyNavRegisterVisibility: applyNavRegisterVisibility,
        safeNextPath: safeNextPath,
        isGuest: isGuest,
        getGuestId: getGuestId,
        setGuestSession: setGuestSession,
        enterGuestSessionAsync: enterGuestSessionAsync
    };
})(typeof window !== "undefined" ? window : this);
