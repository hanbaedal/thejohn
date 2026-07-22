/**
 * 세션 + /api/auth/login (MongoDB staff · vendors)
 *
 * 로그인·권한 정책
 * - 미로그인: 공개 페이지(홈·회사소개·사업부문·고객센터) 자유 열람 · thejohn 푸터 SNS
 * - 헤더 로그인: 슈퍼바이저·관리자·등록업체만
 * - 로그아웃 → index.html (공개 홈)
 * - 로그인 후 기본 이동: 업체 → index, 슈퍼바이저·관리자 → work-hub (login.js)
 * - 슈퍼바이저: 관리자(staff) 생성 · 전체 기능
 * - 관리자: 업체(vendors) 생성 · 모든 관리자 주문서관리 이용
 * - 업체: 관리자별 등록·등급(vendorProfiles) · 등록 업체는 모든 상품 주문(등급가는 담당 관리자 상품만)
 * - 미로그인 방문: 상품 가격 숨김 · 공개 페이지 방문 횟수(page_view)만 기록
 */
(function (global) {
    var AUTH_KEY = "thejhon_logged_in";
    var USER_ID_KEY = "thejhon_user_id";
    var ROLE_KEY = "thejhon_role";
    var COMPANY_KEY = "thejhon_company_name";
    var DISPLAY_KEY = "thejhon_display_name";
    var VENDOR_GRADE_KEY = "thejhon_vendor_grade";
    var VENDOR_REGISTERED_BY_KEY = "thejhon_vendor_registered_by";
    var VENDOR_PROFILES_KEY = "thejhon_vendor_profiles";
    var VENDOR_MGR_NAME_KEY = "thejhon_vendor_mgr_name";
    var VENDOR_MGR_TEL_KEY = "thejhon_vendor_mgr_tel";
    var VENDOR_MGR_EMAIL_KEY = "thejhon_vendor_mgr_email";
    var VENDOR_ORDER_ENABLED_KEY = "thejhon_vendor_order_enabled";
    var STAFF_ORDER_ENABLED_KEY = "thejhon_staff_order_enabled";
    var STAFF_LOGO_KEY = "thejhon_staff_logo";
    var BRAND_COMPANY_KEY = "thejhon_brand_company_name";
    var LOGIN_ID_HINT_KEY = "thejhon_login_id_hint";
    var store = global.THEJHON_AUTH_STORAGE;

    /** setFormSession·로그아웃마다 증가 — 늦게 도착한 checkSession 응답 무시 */
    var authSessionEpoch = 0;
    /** 업체 주문 권한 — 로그인·세션 API 확인 후에만 true (로컬 캐시만으로 주문 불가) */
    var vendorPermsSynced = false;
    /** checkSession 권한 동기화 — nav·cart 등에서 중복 호출 방지 */
    var sessionPermRefreshPromise = null;

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
        VENDOR_PROFILES_KEY,
        VENDOR_ORDER_ENABLED_KEY,
        VENDOR_MGR_NAME_KEY,
        VENDOR_MGR_TEL_KEY,
        VENDOR_MGR_EMAIL_KEY,
        STAFF_ORDER_ENABLED_KEY,
        STAFF_LOGO_KEY,
        BRAND_COMPANY_KEY
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

    function bumpAuthSessionEpoch() {
        authSessionEpoch += 1;
        return authSessionEpoch;
    }

    function resetVendorOrderPermissionLocal() {
        vendorPermsSynced = false;
        authRemove(VENDOR_ORDER_ENABLED_KEY);
    }

    /** PWA·이전 탭 로그인 잔여값 제거 — 세션 API 확인 전까지 주문 비활성 */
    (function pessimisticVendorOrderOnLoad() {
        if (authGet(AUTH_KEY) === "1" && authGet(ROLE_KEY) === "vendor") {
            resetVendorOrderPermissionLocal();
        }
    })();

    /** 같은 로그인 아이디 — 역할은 서버(DB)가 맞으면 로컬과 달라도 동기화 */
    function sessionMatchesCurrentAccount(sess) {
        if (!sess || !sess.loggedIn) return false;
        var uid = String(authGet(USER_ID_KEY) || "").trim();
        var sid = String(sess.userId || "").trim();
        if (!uid || !sid) return uid === sid;
        return staffLoginIdsEqualClient(uid, sid);
    }

    function clearVendorCartIfAny() {
        try {
            if (global.THEJHON_VENDOR_CART && THEJHON_VENDOR_CART.clearCart) {
                THEJHON_VENDOR_CART.clearCart();
            }
        } catch (e) {}
    }

    /** sessionStorage·토큰만 비움 (이 탭 계정 전환) */
    function clearAuthStorageLocal() {
        vendorPermsSynced = false;
        staffNavClear();
        var i;
        for (i = 0; i < AUTH_PERSIST_KEYS.length; i++) {
            authRemove(AUTH_PERSIST_KEYS[i]);
        }
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken("");
    }

    function captureApiToken() {
        try {
            return global.THEJHON_API && THEJHON_API.getToken
                ? String(THEJHON_API.getToken() || "").trim()
                : "";
        } catch (e) {
            return "";
        }
    }

    function revokeApiTokenAsync(token) {
        if (!token || !global.THEJHON_API || !THEJHON_API.logoutAsync) {
            return Promise.resolve();
        }
        return THEJHON_API.logoutAsync(token).catch(function () {});
    }

    /** 로컬 로그인 표시는 있는데 JWT가 없을 때(로그아웃·탭 전환 직후 등) */
    function repairInconsistentAuthState() {
        if (authGet(AUTH_KEY) === "1" && !authGet(ROLE_KEY)) {
            clearSession();
            return true;
        }
        if (authGet(AUTH_KEY) !== "1" || !authGet(ROLE_KEY)) return false;
        var role = authGet(ROLE_KEY);
        if (role === "guest") {
            clearSession();
            return true;
        }
        if (role === "oauth") return false;
        if (captureApiToken()) return false;
        clearSession();
        return true;
    }

    function clearSession() {
        var token = captureApiToken();
        bumpAuthSessionEpoch();
        sessionInvalidHandled = false;
        clearAuthStorageLocal();
        clearLocalAuthPersist();
        clearVendorCartIfAny();
        revokeApiTokenAsync(token);
        if (global.THEJHON_AUTH_STORAGE && global.THEJHON_AUTH_STORAGE.applyLoggedInDocumentClass) {
            global.THEJHON_AUTH_STORAGE.applyLoggedInDocumentClass();
        }
    }

    function clearSessionAsync() {
        var token = captureApiToken();
        bumpAuthSessionEpoch();
        sessionInvalidHandled = false;
        clearAuthStorageLocal();
        clearLocalAuthPersist();
        clearVendorCartIfAny();
        return revokeApiTokenAsync(token);
    }

    function usesStaffLogoRole(role) {
        var r = role != null ? role : authGet(ROLE_KEY) || "";
        return r === "admin" || r === "supervisor" || r === "vendor";
    }

    function cacheStaffLogo(logo, brandCompanyName) {
        var src = String(logo || "").trim();
        if (src) authSet(STAFF_LOGO_KEY, src);
        else authRemove(STAFF_LOGO_KEY);
        var role = authGet(ROLE_KEY) || "";
        if (role === "vendor") return;
        var brand = String(brandCompanyName || "").trim();
        if (brand && usesStaffLogoRole(role)) authSet(BRAND_COMPANY_KEY, brand);
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
        var r = String(role != null ? role : getRole() || "")
            .trim()
            .toLowerCase();
        return r === "admin" || r === "supervisor";
    }

    function normalizeLegacySession() {
        repairInconsistentAuthState();
        if (authGet(AUTH_KEY) === "1" && !authGet(ROLE_KEY)) {
            clearSession();
        }
        if (authGet(ROLE_KEY) === "guest") {
            clearSession();
            return;
        }
        var role = authGet(ROLE_KEY);
        if (role === "vendor") {
            var vendorCo = String(authGet(COMPANY_KEY) || "").trim();
            if (vendorCo) authSet(DISPLAY_KEY, vendorCo);
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
        if (!name) name = String(c.vn_ceo || c.ceo || "").trim();
        if (!tel) {
            tel = String(c.vn_ceo_tel || c.vn_phone || c.ceoPhone || c.phone || "").trim();
        }
        if (!email) email = String(c.vn_email || c.email || "").trim();
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
        var headerName =
            role === "vendor" ? getVendorCompanyName() : company;

        if (isStaffRole(role)) {
            if (company) {
                authSet(BRAND_COMPANY_KEY, company);
                authSet(COMPANY_KEY, company);
                authSet(DISPLAY_KEY, company);
            }
        }

        if (usesStaffLogoRole(role)) {
            cacheStaffLogo(logo, headerName || company || getBrandCompanyDisplayName());
        }

        if (typeof global.__thejhonApplyHomeHeroCompany === "function") {
            try {
                global.__thejhonApplyHomeHeroCompany(
                    headerName || company || getBrandCompanyDisplayName()
                );
            } catch (e) {}
        }
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            try {
                global.__thejhonRefreshHeaderCompany();
            } catch (e2) {}
        }
        if (usesStaffLogoRole(role) && typeof global.__thejhonApplySiteLogo === "function") {
            try {
                global.__thejhonApplySiteLogo(logo, headerName || company || "");
            } catch (e3) {}
        }
        if (typeof global.__thejhonSyncBrandFromSession === "function") {
            try {
                global.__thejhonSyncBrandFromSession();
            } catch (eSync) {}
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
        if (!global.THEJHON_API || !THEJHON_API.getVendorProfile) {
            return Promise.resolve(getVendorOrderContact());
        }
        if (!THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return Promise.resolve(getVendorOrderContact());
        }
        return THEJHON_API.getVendorProfile()
            .then(function (item) {
                if (item) {
                    storeVendorOrderContact(item);
                    syncVendorCompanyFromProfile(item);
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
        var loginPromise = THEJHON_API.login(id, pw).then(mapLoginResponse);
        var timeoutMs = 60000;
        var timed = new Promise(function (_, reject) {
            setTimeout(function () {
                reject(
                    new Error(
                        "로그인 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."
                    )
                );
            }, timeoutMs);
        });
        return Promise.race([loginPromise, timed])
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

    function applyFormSessionState(
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
        authSet(AUTH_KEY, "1");
        authSet(USER_ID_KEY, userId || "");
        var roleNorm = normalizeLoginRole(role) || String(role || "").trim();
        authSet(ROLE_KEY, roleNorm);
        try {
            if (userId) localStorage.setItem(LOGIN_ID_HINT_KEY, userId);
        } catch (e) {}
        authSet("thejhon_auth_provider", "form");
        if (roleNorm === "vendor") {
            authSet(VENDOR_GRADE_KEY, parseVendorGrade(vendorGrade));
            var regBy = String(vendorRegisteredBy || "").trim();
            if (regBy) authSet(VENDOR_REGISTERED_BY_KEY, regBy);
            else authRemove(VENDOR_REGISTERED_BY_KEY);
            if (vendorOrderEnabled) authSet(VENDOR_ORDER_ENABLED_KEY, "1");
            else authRemove(VENDOR_ORDER_ENABLED_KEY);
            vendorPermsSynced = true;
            storeVendorOrderContact({
                mgrName: vendorMgrName,
                mgrTel: vendorMgrTel,
                mgrEmail: vendorMgrEmail
            });
        } else {
            vendorPermsSynced = false;
            authRemove(VENDOR_GRADE_KEY);
            authRemove(VENDOR_REGISTERED_BY_KEY);
            authRemove(VENDOR_ORDER_ENABLED_KEY);
            authRemove(VENDOR_MGR_NAME_KEY);
            authRemove(VENDOR_MGR_TEL_KEY);
            authRemove(VENDOR_MGR_EMAIL_KEY);
        }
        if (roleNorm === "admin") {
            authSet(STAFF_ORDER_ENABLED_KEY, "1");
        } else {
            authRemove(STAFF_ORDER_ENABLED_KEY);
        }
        if (isStaffRole(roleNorm)) {
            staffNavSet("hub");
        } else {
            staffNavClear();
        }
        var label = companyName || "";
        var brandLabel = String(brandCompanyName || "").trim();
        if (roleNorm === "vendor") {
            if (label) {
                authSet(COMPANY_KEY, label);
                authSet(DISPLAY_KEY, label);
            } else {
                authRemove(COMPANY_KEY);
                authRemove(DISPLAY_KEY);
            }
            if (brandLabel) {
                authSet(BRAND_COMPANY_KEY, brandLabel);
            } else {
                authRemove(BRAND_COMPANY_KEY);
            }
        } else if (isStaffRole(roleNorm)) {
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
        if (usesStaffLogoRole(roleNorm)) {
            var headerLabel = roleNorm === "vendor" ? label || brandLabel : brandLabel || label;
            cacheStaffLogo(staffLogo, headerLabel);
            if (typeof global.__thejhonApplySiteLogo === "function") {
                try {
                    global.__thejhonApplySiteLogo(staffLogo, headerLabel);
                } catch (eLogo) {}
            }
            if (typeof global.__thejhonSyncBrandFromSession === "function") {
                try {
                    global.__thejhonSyncBrandFromSession();
                } catch (eLogoSync) {}
            }
        } else {
            clearStaffLogoCache();
        }
        if (global.THEJHON_AUTH_STORAGE && global.THEJHON_AUTH_STORAGE.applyLoggedInDocumentClass) {
            global.THEJHON_AUTH_STORAGE.applyLoggedInDocumentClass();
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
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            try {
                global.__thejhonRefreshHeaderCompany();
            } catch (eHdr) {}
        }
        if (role === "vendor" && !label) {
            refreshVendorCompanyFromProfileAsync();
        }
        sessionInvalidHandled = false;
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
        var oldToken = captureApiToken();
        bumpAuthSessionEpoch();
        clearAuthStorageLocal();
        if (prevUser && prevUser !== (userId || "")) {
            clearVendorCartIfAny();
        }
        applyFormSessionState(
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
        );
        if (oldToken && oldToken !== String(token || "").trim()) {
            revokeApiTokenAsync(oldToken);
        }
    }

    function setFormSessionAsync(
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
        var oldToken = captureApiToken();
        bumpAuthSessionEpoch();
        clearAuthStorageLocal();
        if (prevUser && prevUser !== (userId || "")) {
            clearVendorCartIfAny();
        }
        applyFormSessionState(
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
        );
        revokeApiTokenAsync(oldToken);
        return Promise.resolve();
    }

    function syncVendorCompanyFromProfile(item) {
        if (!item || getRole() !== "vendor") return;
        var company = String(item.vn_company || item.companyName || "").trim();
        if (!company) return;
        authSet(COMPANY_KEY, company);
        authSet(DISPLAY_KEY, company);
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            try {
                global.__thejhonRefreshHeaderCompany();
            } catch (e) {}
        }
    }

    function syncSessionCompanyFromApi(sess) {
        if (!sess || !sess.loggedIn || !sessionMatchesCurrentAccount(sess)) return;
        var role = sess.role || getRole();
        if (role === "vendor") {
            var company = String(sess.companyName || "").trim();
            if (company) {
                authSet(COMPANY_KEY, company);
                authSet(DISPLAY_KEY, company);
            }
            var brand = String(
                sess.brandCompanyName || sess.vendorRegisteredByName || ""
            ).trim();
            if (brand) authSet(BRAND_COMPANY_KEY, brand);
        } else if (isStaffRole(role)) {
            var staffCo = String(sess.companyName || "").trim();
            if (staffCo) {
                authSet(COMPANY_KEY, staffCo);
                authSet(DISPLAY_KEY, staffCo);
                authSet(BRAND_COMPANY_KEY, staffCo);
            }
        }
        if (typeof global.__thejhonRefreshHeaderCompany === "function") {
            try {
                global.__thejhonRefreshHeaderCompany();
            } catch (e2) {}
        }
    }

    function refreshVendorCompanyFromProfileAsync() {
        if (!isLoggedIn() || getRole() !== "vendor") return Promise.resolve(null);
        if (!global.THEJHON_API || !THEJHON_API.getVendorProfile) return Promise.resolve(null);
        if (!THEJHON_API.getToken || !THEJHON_API.getToken()) return Promise.resolve(null);
        return THEJHON_API.getVendorProfile()
            .then(function (item) {
                if (item) {
                    syncVendorCompanyFromProfile(item);
                    storeVendorOrderContact(item);
                    var brand = String(item.vn_registered_by_name || "").trim();
                    if (brand) authSet(BRAND_COMPANY_KEY, brand);
                }
                return item;
            })
            .catch(function () {
                return null;
            });
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

    /** 아이디 로그인(관리자·슈퍼바이저·업체) + 유효 JWT */
    function hasAccountSession() {
        normalizeLegacySession();
        if (authGet(AUTH_KEY) !== "1" || !authGet(ROLE_KEY)) return false;
        var role = String(getRole() || "")
            .trim()
            .toLowerCase();
        if (role === "guest" || role === "oauth") return false;
        if (role !== "admin" && role !== "supervisor" && role !== "vendor") return false;
        return !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken());
    }

    function isLoggedIn() {
        return hasAccountSession();
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
        "vendor-email-history.html",
        "vendor-dm-print.html",
        "vendor-prospect-list.html",
        "vendor-excel-import.html",
        "vendor-prospect-finder.html",
        "vendor-prospect-region.html"
    ];
    var ORDER_MANAGE_HUB_PAGE = "order-manage-hub.html";
    var ORDER_MANAGE_PAGES = ["order-list-admin.html"];
    var ORDER_MANAGE_HUB_PAGES = [
        ORDER_MANAGE_HUB_PAGE,
        "transaction-list.html",
        "supervisor-order-list.html",
        "supervisor-order-pdf.html",
        "supervisor-transaction-pdf.html",
        "supervisor-transaction-list.html",
        "transaction-manual-register.html",
        "transaction-manual-list.html",
        "sales-ledger-inquiry.html",
        "sales-ledger-hub.html",
        "sales-ledger-by-vendor.html",
        "sales-ledger-by-product.html",
        "sales-ledger-by-date.html",
        "sales-ledger-list.html",
        "sales-ledger-register.html",
        "sales-by-product.html",
        "sales-by-vendor.html",
        "tax-invoice.html",
        "marketing-material-register.html",
        "marketing-material-list.html",
        "order-list-admin.html"
    ];
    var WORK_HUB_PAGE = "work-hub.html";
    var WORK_HUB_LABEL = "그룹 마케팅 관리";
    var HOMEPAGE_MANAGE_HUB_PAGE = "homepage-manage-hub.html";
    var STAFF_NAV_MODE_KEY = "thejhon_staff_nav_mode";
    var MANAGE_HOME_SUBNAV_KEY_PREFIX = "thejhon_manage_home_subnav_";
    var ORDER_SUBNAV_STORAGE_KEY = "thejhon_order_subnav";
    var PRODUCT_MANAGE_HUB_PAGE = "product-manage.html";
    var PRODUCT_SUBNAV_STORAGE_KEY = "thejhon_product_subnav";
    var VENDOR_MANAGE_HUB_PAGE = "vendor-manage.html";
    var VENDOR_SUBNAV_STORAGE_KEY = "thejhon_vendor_subnav_v2";
    var VENDOR_SUBNAV_CORE = [
        { href: VENDOR_MANAGE_HUB_PAGE, label: "업체관리" },
        { href: "vendor-register.html", label: "업체등록" },
        { href: "vendor-list-admin.html", label: "업체 리스트" }
    ];
    function isSitePublicPage(file) {
        var PS = global.THEJHON_PUBLIC_SITE;
        if (PS && PS.isPublicPage) return PS.isPublicPage(file);
        if (!file) file = currentPageFile();
        return file === "login.html" || file === "index.html";
    }

    function isStaffNavPublicPage(file) {
        if (!file) file = currentPageFile();
        if (file === "login.html") return false;
        return isSitePublicPage(file);
    }

    var STAFF_NAV_MANAGE_HOME_PAGES = {
        "homepage-manage-hub.html": true,
        "support-news-admin.html": true,
        "support-qna-admin.html": true,
        "support-inquiry.html": true
    };
    var STAFF_NAV_ORDER_PAGES = {
        "order-manage-hub.html": true,
        "order-list-admin.html": true,
        "transaction-list.html": true,
        "supervisor-order-list.html": true,
        "supervisor-order-pdf.html": true,
        "supervisor-transaction-pdf.html": true,
        "supervisor-transaction-list.html": true,
        "transaction-manual-register.html": true,
        "transaction-manual-list.html": true,
        "sales-ledger-inquiry.html": true,
        "sales-ledger-hub.html": true,
        "sales-ledger-by-vendor.html": true,
        "sales-ledger-by-product.html": true,
        "sales-ledger-by-date.html": true,
        "sales-ledger-list.html": true,
        "sales-ledger-register.html": true,
        "sales-by-product.html": true,
        "sales-by-vendor.html": true,
        "tax-invoice.html": true
    };
    var STAFF_NAV_PRODUCT_PAGES = {};
    var STAFF_NAV_VENDOR_PAGES = {};
    var STAFF_NAV_WORK_PAGES = {
        "staff-manage-hub.html": true,
        "staff-manage.html": true,
        "staff-list-admin.html": true,
        "system-structure-docs.html": true,
        "supervisor-access-stats.html": true,
        "supervisor-usage-stats.html": true,
        "supervisor-db-stats.html": true,
        "supervisor-solapi-stats.html": true
    };
    var SYSTEM_STRUCTURE_DOCS_PAGE = "system-structure-docs.html";
    var STAFF_MANAGE_PAGES = [
        "staff-manage-hub.html",
        "staff-manage.html",
        "staff-list-admin.html",
        "supervisor-order-list.html",
        "supervisor-transaction-list.html",
        "supervisor-access-stats.html",
        "supervisor-usage-stats.html",
        "supervisor-db-stats.html",
        "supervisor-solapi-stats.html"
    ];
    var ADMIN_REGISTER_PAGES = PRODUCT_ADMIN_PAGES.concat(VENDOR_ADMIN_PAGES);

    PRODUCT_ADMIN_PAGES.forEach(function (f) {
        STAFF_NAV_PRODUCT_PAGES[f] = true;
    });
    VENDOR_ADMIN_PAGES.forEach(function (f) {
        STAFF_NAV_VENDOR_PAGES[f] = true;
    });

    function staffNavGet() {
        try {
            return String(sessionStorage.getItem(STAFF_NAV_MODE_KEY) || "").trim();
        } catch (e) {
            return "";
        }
    }

    function staffNavSet(mode) {
        try {
            if (!mode) sessionStorage.removeItem(STAFF_NAV_MODE_KEY);
            else sessionStorage.setItem(STAFF_NAV_MODE_KEY, String(mode));
        } catch (e2) {}
    }

    function staffNavClear() {
        staffNavSet("");
    }

    function inferStaffNavModeFromPage(file) {
        if (!file) return "";
        if (file === WORK_HUB_PAGE) return "hub";
        if (STAFF_NAV_PRODUCT_PAGES[file]) return "product";
        if (STAFF_NAV_ORDER_PAGES[file]) return "order";
        if (STAFF_NAV_VENDOR_PAGES[file]) return "vendor-manage";
        if (file === "support-inquiry.html") {
            var inquiryStored = staffNavGet();
            if (inquiryStored === "manage-home") return "manage-home";
            return "public";
        }
        if (STAFF_NAV_MANAGE_HOME_PAGES[file]) return "manage-home";
        if (STAFF_NAV_WORK_PAGES[file]) return "work";
        if (isStaffNavPublicPage(file)) return "public";
        return "";
    }

    function resolveStaffNavMode() {
        if (!isStaffRole(getRole())) return "";
        var file = currentPageFile();
        if (file === WORK_HUB_PAGE) {
            staffNavSet("hub");
            return "hub";
        }
        var inferred = inferStaffNavModeFromPage(file);
        if (inferred) {
            staffNavSet(inferred);
            return inferred;
        }
        var stored = staffNavGet();
        if (
            stored === "hub" ||
            stored === "public" ||
            stored === "manage-home" ||
            stored === "product" ||
            stored === "vendor-manage" ||
            stored === "order" ||
            stored === "work"
        ) {
            return stored;
        }
        staffNavSet("hub");
        return "hub";
    }

    function getStaffNavMode() {
        return resolveStaffNavMode();
    }

    function setStaffNavMode(mode) {
        if (!isStaffRole(getRole())) return;
        staffNavSet(mode);
        applyStaffNavMode(mode);
        applySiteFooterVisibility();
    }

    function staffNavSetVisible(el, show) {
        if (!el) return;
        if (show) {
            el.classList.remove("header-nav-link--staff-hidden");
            el.hidden = false;
            el.removeAttribute("aria-hidden");
            el.style.removeProperty("display");
        } else {
            el.classList.add("header-nav-link--staff-hidden");
            el.hidden = true;
            el.setAttribute("aria-hidden", "true");
        }
    }

    function staffNavHrefFile(href) {
        var h = String(href || "")
            .split("?")[0]
            .split("#")[0]
            .toLowerCase();
        return (h.split("/").pop() || "").trim();
    }

    function staffNavZoneForEl(el) {
        if (!el) return "";
        var file = staffNavHrefFile(el.getAttribute("href"));
        var drop = el.getAttribute("data-nav-dropdown") || "";
        if (drop === "support") return "public";
        if (drop === "product-manage") return "product";
        if (drop === "vendor-manage") return "vendor-manage";
        if (file === "homepage-manage-hub.html") return "manage-home";
        if (file.indexOf("company") === 0 || file === "company.html") return "public";
        if (file === "products.html" || file === "product-detail.html" || file === "index.html") {
            return "public";
        }
        if (file === "support-news-admin.html" || file === "support-qna-admin.html") {
            return "manage-home";
        }
        if (STAFF_NAV_ORDER_PAGES[file]) return "order";
        if (STAFF_NAV_PRODUCT_PAGES[file]) return "product";
        if (STAFF_NAV_VENDOR_PAGES[file]) return "vendor-manage";
        if (STAFF_NAV_WORK_PAGES[file]) return "work";
        if (STAFF_NAV_MANAGE_HOME_PAGES[file]) return "manage-home";
        if (isStaffNavPublicPage(file)) return "public";
        if (file === "work-hub.html") return "hub";
        return "";
    }

    function staffNavShouldShow(el, mode) {
        if (mode === "manage-home") {
            return el.getAttribute("data-staff-nav-injected") === "manage-home";
        }
        var zone = staffNavZoneForEl(el);
        if (!zone) return false;
        if (mode === "hub") return false;
        if (mode === "public") return zone === "public";
        if (mode === "product") {
            return zone === "product" && canManageRegisters();
        }
        if (mode === "vendor-manage") {
            return zone === "vendor-manage" && canManageRegisters();
        }
        if (mode === "order") {
            if (zone !== "order") return false;
            var file = staffNavHrefFile(el.getAttribute("href"));
            if (ORDER_MANAGE_HUB_PAGES.indexOf(file) >= 0) {
                return getOrderManageHubAccess().allowed;
            }
            if (file === "order-list-admin.html") return canShowOrderManageMenu();
            return isSupervisorStaff();
        }
        if (mode === "work") return zone === "work" && isSupervisorStaff();
        return false;
    }

    function staffNavRemoveInjected(nav, keepMode) {
        var injected = nav.querySelectorAll("[data-staff-nav-injected]");
        for (var i = 0; i < injected.length; i++) {
            var el = injected[i];
            if (keepMode && el.getAttribute("data-staff-nav-injected") === keepMode) continue;
            el.remove();
        }
    }

    function staffNavClearInjected(nav, onlyDynamic) {
        var sel = onlyDynamic
            ? '[data-staff-nav-injected][data-hmh-dynamic="1"]'
            : "[data-staff-nav-injected]";
        var injected = nav.querySelectorAll(sel);
        for (var i = 0; i < injected.length; i++) {
            injected[i].remove();
        }
    }

    function manageHomeSubnavStorageKey(section) {
        return MANAGE_HOME_SUBNAV_KEY_PREFIX + String(section || "home");
    }

    function saveManageHomeSubnav(section, items) {
        try {
            sessionStorage.setItem(
                manageHomeSubnavStorageKey(section),
                JSON.stringify(items || [])
            );
        } catch (e) {}
    }

    function getManageHomeSubnavDefaults(section) {
        if (section === "product") {
            return [
                { href: "product-register.html", label: "상품 등록" },
                { href: "product-list-admin.html", label: "상품 리스트" }
            ];
        }
        if (section === "vendor") {
            return [
                { href: "vendor-register.html", label: "업체 등록" },
                { href: "vendor-list-admin.html", label: "업체 리스트" },
                { href: "vendor-manage.html", label: "업체관리 허브" }
            ];
        }
        return [
            { href: "support-news-admin.html", label: "최근소식 입력" },
            { href: "support-qna-admin.html", label: "자유게시판" },
            { href: "support-inquiry.html", label: "문의사항 답변" }
        ];
    }

    function loadManageHomeSubnav(section) {
        if (section === "product") {
            var saved = [];
            try {
                var rawP = sessionStorage.getItem(manageHomeSubnavStorageKey("product"));
                saved = JSON.parse(rawP || "[]");
            } catch (eP) {
                saved = [];
            }
            var canonical = getManageHomeSubnavDefaults("product");
            if (!Array.isArray(saved) || !saved.length) return canonical;
            var canonFiles = {};
            for (var c = 0; c < canonical.length; c++) {
                canonFiles[staffNavHrefFile(canonical[c].href)] = true;
            }
            var filtered = saved.filter(function (it) {
                return canonFiles[staffNavHrefFile(it.href)];
            });
            return filtered.length ? filtered : canonical;
        }
        try {
            var raw = sessionStorage.getItem(manageHomeSubnavStorageKey(section));
            var data = JSON.parse(raw || "[]");
            if (Array.isArray(data) && data.length) return data;
        } catch (e2) {
            /* ignore */
        }
        return getManageHomeSubnavDefaults(section);
    }

    function clearManageHomeSubnavLinks(nav) {
        if (!nav) return;
        var links = nav.querySelectorAll(
            "a[data-hmh-subnav], a.is-hmh-subnav[data-staff-nav-injected='manage-home']"
        );
        for (var i = 0; i < links.length; i++) links[i].remove();
    }

    function saveOrderSubnav(items) {
        try {
            sessionStorage.setItem(ORDER_SUBNAV_STORAGE_KEY, JSON.stringify(items || []));
        } catch (e) {}
    }

    function getDefaultOrderSubnavItems() {
        if (!getOrderManageHubAccess().allowed) return [];
        var links = getOrderManageHubLinks();
        var items = [{ href: ORDER_MANAGE_HUB_PAGE, label: "영업관리" }];
        if (links.list && staffNavHrefFile(links.list) !== ORDER_MANAGE_HUB_PAGE) {
            items.push({
                href: links.list,
                label: "주문서"
            });
        }
        if (links.transactionList || links.transactionManualList) {
            items.push({
                href: links.transactionList || links.transactionManualList,
                label: "거래명세서"
            });
        }
        if (links.salesLedgerHub) {
            items.push({ href: links.salesLedgerHub, label: "매출장" });
        } else if (links.salesLedgerInquiry) {
            items.push({ href: links.salesLedgerInquiry, label: "매출장" });
        }
        if (links.taxInvoice) {
            items.push({ href: links.taxInvoice, label: "세금계산서 발부" });
        }
        if (links.marketingList) {
            items.push({ href: links.marketingList, label: "마케팅 자료" });
        }
        return items;
    }

    /** 영업관리 헤더 탭 — 하위 페이지를 상위 메뉴와 묶어 is-current 판정 */
    var ORDER_SUBNAV_RELATED_PAGES = {
        "order-manage-hub.html": ["order-manage-hub.html"],
        "supervisor-order-list.html": [
            "supervisor-order-list.html",
            "order-list-admin.html",
            "supervisor-order-pdf.html"
        ],
        "order-list-admin.html": [
            "supervisor-order-list.html",
            "order-list-admin.html",
            "supervisor-order-pdf.html"
        ],
        "supervisor-order-pdf.html": [
            "supervisor-order-list.html",
            "order-list-admin.html",
            "supervisor-order-pdf.html"
        ],
        "transaction-list.html": [
            "transaction-list.html",
            "transaction-manual-register.html",
            "transaction-manual-list.html",
            "supervisor-transaction-list.html",
            "supervisor-transaction-pdf.html"
        ],
        "transaction-manual-register.html": [
            "transaction-list.html",
            "transaction-manual-register.html",
            "transaction-manual-list.html",
            "supervisor-transaction-list.html",
            "supervisor-transaction-pdf.html"
        ],
        "sales-ledger-hub.html": [
            "sales-ledger-hub.html",
            "sales-ledger-by-vendor.html",
            "sales-ledger-by-product.html",
            "sales-ledger-by-date.html",
            "sales-ledger-inquiry.html",
            "sales-ledger-list.html",
            "sales-ledger-register.html",
            "sales-by-product.html",
            "sales-by-vendor.html"
        ],
        "tax-invoice.html": ["tax-invoice.html"],
        "marketing-material-list.html": ["marketing-material-list.html", "marketing-material-register.html"],
        "marketing-material-register.html": ["marketing-material-list.html", "marketing-material-register.html"]
    };

    function orderSubnavLinkMatchesPage(linkHref, curFile) {
        var linkFile = staffNavHrefFile(linkHref);
        if (!linkFile || !curFile) return false;
        if (linkFile === curFile) return true;
        var related = ORDER_SUBNAV_RELATED_PAGES[linkFile];
        if (related) return related.indexOf(curFile) >= 0;
        return false;
    }

    function isValidOrderSubnavItems(items) {
        if (!items || !items.length) return false;
        var files = {};
        for (var i = 0; i < items.length; i++) {
            files[staffNavHrefFile(items[i].href)] = true;
        }
        if (!files[ORDER_MANAGE_HUB_PAGE]) return false;
        if (
            files["sales-ledger-by-vendor.html"] ||
            files["sales-ledger-by-product.html"] ||
            files["sales-ledger-by-date.html"]
        ) {
            return false;
        }
        return true;
    }

    function loadOrderSubnav() {
        try {
            var data = JSON.parse(sessionStorage.getItem(ORDER_SUBNAV_STORAGE_KEY) || "[]");
            if (Array.isArray(data) && data.length && isValidOrderSubnavItems(data)) return data;
        } catch (e2) {}
        return getDefaultOrderSubnavItems();
    }

    function collectOrderSubnavFromBody() {
        var file = currentPageFile();
        if (file === ORDER_MANAGE_HUB_PAGE) {
            var fromBody = collectBodyNavCards(document);
            var items = [{ href: ORDER_MANAGE_HUB_PAGE, label: "영업관리" }];
            var seen = {};
            seen[ORDER_MANAGE_HUB_PAGE] = true;
            for (var i = 0; i < fromBody.length; i++) {
                var f = staffNavHrefFile(fromBody[i].href);
                if (!f || seen[f]) continue;
                seen[f] = true;
                items.push(fromBody[i]);
            }
            saveOrderSubnav(items);
            return items;
        }
        var cached = loadOrderSubnav();
        if (!cached.length) cached = getDefaultOrderSubnavItems();
        saveOrderSubnav(cached);
        return cached;
    }

    function clearOrderSubnavLinks(nav) {
        if (!nav) return;
        var links = nav.querySelectorAll(
            "a[data-order-subnav], a.is-order-subnav[data-staff-nav-injected='order']"
        );
        for (var i = 0; i < links.length; i++) links[i].remove();
    }

    function syncOrderSubnavCurrent(nav, items) {
        if (!nav || !items || !items.length) return;
        var cur = currentPageFile();
        var links = nav.querySelectorAll("a[data-order-subnav]");
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var on = orderSubnavLinkMatchesPage(link.getAttribute("href"), cur);
            link.classList.toggle("is-current", on);
            if (on) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
    }

    function syncStaffNavOrderSubnav(nav) {
        if (!nav) return;
        var items = collectOrderSubnavFromBody();
        if (!items.length) items = getDefaultOrderSubnavItems();
        clearOrderSubnavLinks(nav);
        if (!items.length) return;

        var cur = currentPageFile();
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var file = staffNavHrefFile(it.href);
            if (!file) continue;
            if (nav.querySelector('a[data-order-subnav][href*="' + file + '"]')) continue;

            var a = document.createElement("a");
            a.href = it.href;
            a.className = "header-nav-link is-order-subnav";
            a.textContent = it.label;
            a.setAttribute("data-staff-nav-injected", "order");
            a.setAttribute("data-order-subnav", "1");
            if (orderSubnavLinkMatchesPage(it.href, cur)) {
                a.classList.add("is-current");
                a.setAttribute("aria-current", "page");
            }
            a.addEventListener("click", function () {
                staffNavSet("order");
            });
            nav.appendChild(a);
        }
        syncOrderSubnavCurrent(nav, items);
    }

    function applyStaffNavOrderTabs(nav) {
        if (!nav || !getOrderManageHubAccess().allowed) return;
        document.body.classList.toggle("nav-admin-menus", false);

        var plain = nav.querySelectorAll(
            ':scope > a.header-nav-link:not([data-staff-nav-injected]), :scope > .nav-dropdown'
        );
        for (var h = 0; h < plain.length; h++) {
            plain[h].remove();
        }

        nav.classList.remove("site-header-nav--hmh", "site-header-nav--product");
        nav.classList.add("site-header-nav--order");
        syncStaffNavOrderSubnav(nav);
    }

    function refreshOrderHeader() {
        if (!isStaffRole(getRole())) return;
        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;
        if (resolveStaffNavMode() !== "order") return;
        applyStaffNavOrderTabs(nav);
    }

    function saveProductSubnav(items) {
        try {
            sessionStorage.setItem(PRODUCT_SUBNAV_STORAGE_KEY, JSON.stringify(items || []));
        } catch (e) {}
    }

    function loadProductSubnav() {
        try {
            var data = JSON.parse(sessionStorage.getItem(PRODUCT_SUBNAV_STORAGE_KEY) || "[]");
            if (Array.isArray(data) && data.length) return data;
        } catch (e2) {}
        return getDefaultProductSubnavItems();
    }

    function getDefaultProductSubnavItems() {
        if (!canManageRegisters()) return [];
        return [
            { href: PRODUCT_MANAGE_HUB_PAGE, label: "상품관리" },
            { href: "product-register.html", label: "상품 등록" },
            { href: "product-list-admin.html", label: "상품 리스트" }
        ];
    }

    function collectProductSubnavFromBody() {
        var file = currentPageFile();
        if (file === PRODUCT_MANAGE_HUB_PAGE) {
            var fromBody = collectBodyNavCards(document);
            var items = [{ href: PRODUCT_MANAGE_HUB_PAGE, label: "상품관리" }];
            var seen = {};
            seen[PRODUCT_MANAGE_HUB_PAGE] = true;
            for (var i = 0; i < fromBody.length; i++) {
                var f = staffNavHrefFile(fromBody[i].href);
                if (!f || seen[f]) continue;
                seen[f] = true;
                items.push(fromBody[i]);
            }
            saveProductSubnav(items);
            return items;
        }
        var bodyItems = collectBodyNavCards(document);
        if (bodyItems.length) {
            var merged = [{ href: PRODUCT_MANAGE_HUB_PAGE, label: "상품관리" }];
            var seen2 = {};
            seen2[PRODUCT_MANAGE_HUB_PAGE] = true;
            for (var j = 0; j < bodyItems.length; j++) {
                var f2 = staffNavHrefFile(bodyItems[j].href);
                if (!f2 || seen2[f2]) continue;
                seen2[f2] = true;
                merged.push(bodyItems[j]);
            }
            saveProductSubnav(merged);
            return merged;
        }
        var cached = loadProductSubnav();
        saveProductSubnav(cached);
        return cached;
    }

    function clearProductSubnavLinks(nav) {
        if (!nav) return;
        var links = nav.querySelectorAll(
            "a[data-product-subnav], a.is-product-subnav[data-staff-nav-injected='product']"
        );
        for (var i = 0; i < links.length; i++) links[i].remove();
    }

    function syncProductSubnavCurrent(nav, items) {
        if (!nav || !items || !items.length) return;
        var cur = currentPageFile();
        var links = nav.querySelectorAll("a[data-product-subnav]");
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var on = staffNavHrefFile(link.getAttribute("href")) === cur;
            link.classList.toggle("is-current", on);
            if (on) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
    }

    function syncStaffNavProductSubnav(nav) {
        if (!nav) return;
        var items = collectProductSubnavFromBody();
        if (!items.length) items = getDefaultProductSubnavItems();
        clearProductSubnavLinks(nav);
        if (!items.length) return;

        var cur = currentPageFile();
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var file = staffNavHrefFile(it.href);
            if (!file) continue;
            if (nav.querySelector('a[data-product-subnav][href*="' + file + '"]')) continue;

            var a = document.createElement("a");
            a.href = it.href;
            a.className = "header-nav-link is-product-subnav";
            a.textContent = it.label;
            a.setAttribute("data-staff-nav-injected", "product");
            a.setAttribute("data-product-subnav", "1");
            if (file === cur) {
                a.classList.add("is-current");
                a.setAttribute("aria-current", "page");
            }
            a.addEventListener("click", function () {
                staffNavSet("product");
            });
            nav.appendChild(a);
        }
        syncProductSubnavCurrent(nav, items);
    }

    function applyStaffNavProductTabs(nav) {
        if (!nav || !canManageRegisters()) return;
        document.body.classList.toggle("nav-admin-menus", false);

        var plain = nav.querySelectorAll(
            ':scope > a.header-nav-link:not([data-staff-nav-injected]), :scope > .nav-dropdown'
        );
        for (var h = 0; h < plain.length; h++) {
            plain[h].remove();
        }

        nav.classList.remove("site-header-nav--hmh");
        nav.classList.add("site-header-nav--product");
        syncStaffNavProductSubnav(nav);
    }

    function refreshProductHeader() {
        if (!isStaffRole(getRole())) return;
        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;
        if (resolveStaffNavMode() !== "product") return;
        applyStaffNavProductTabs(nav);
    }

    function saveVendorSubnav(items) {
        try {
            sessionStorage.setItem(VENDOR_SUBNAV_STORAGE_KEY, JSON.stringify(items || []));
        } catch (e) {}
    }

    function loadVendorSubnav() {
        var cached = [];
        try {
            cached = JSON.parse(sessionStorage.getItem(VENDOR_SUBNAV_STORAGE_KEY) || "[]");
        } catch (e2) {
            cached = [];
        }
        if (!Array.isArray(cached)) cached = [];
        return normalizeVendorSubnavItems(cached);
    }

    function vendorSubnavItemAllowed(href) {
        var file = staffNavHrefFile(href);
        if (file === "order-list-admin.html") return canShowOrderManageMenu();
        if (file === "vendor-prospect-finder.html") return getRole() === "admin";
        if (file === "vendor-prospect-region.html") return getRole() === "admin";
        return true;
    }

    function getDefaultVendorSubnavItems() {
        if (!canManageRegisters()) return [];
        return [
            { href: VENDOR_MANAGE_HUB_PAGE, label: "업체관리" },
            { href: "vendor-register.html", label: "업체등록" },
            { href: "vendor-list-admin.html", label: "업체 리스트" },
            { href: "vendor-dm-print.html", label: "업체별 DM 출력" },
            { href: "vendor-email-broadcast.html", label: "이메일 보내기" },
            { href: "vendor-email-history.html", label: "이메일 발송 내역" },
            { href: "vendor-new-register.html", label: "신규업체 등록" },
            { href: "vendor-new-list.html", label: "신규업체 리스트" },
            { href: "vendor-prospect-list.html", label: "예비업체 리스트" }
        ];
    }

    function mergeVendorSubnavWithDefaults(items) {
        var primary = Array.isArray(items) ? items : [];
        var defaults = getDefaultVendorSubnavItems();
        var merged = [];
        var seen = {};
        var lists = [primary, defaults];
        for (var s = 0; s < lists.length; s++) {
            var list = lists[s];
            for (var i = 0; i < list.length; i++) {
                var it = list[i] || {};
                var file = staffNavHrefFile(it.href);
                if (!file || seen[file] || !vendorSubnavItemAllowed(it.href)) continue;
                seen[file] = true;
                var label = String(it.label || "").trim() || file;
                if (file === "vendor-register.html") label = "업체등록";
                merged.push({ href: it.href, label: label });
            }
        }
        return merged;
    }

    /** 업체관리 · 업체등록 · 업체 리스트는 항상 헤더 앞쪽에 포함 */
    function normalizeVendorSubnavItems(items) {
        var merged = mergeVendorSubnavWithDefaults(items);
        if (!merged.length) return merged;
        var core = [];
        var rest = [];
        var coreSeen = {};
        for (var c = 0; c < VENDOR_SUBNAV_CORE.length; c++) {
            var coreIt = VENDOR_SUBNAV_CORE[c];
            var coreFile = staffNavHrefFile(coreIt.href);
            if (!coreFile || !vendorSubnavItemAllowed(coreIt.href)) continue;
            coreSeen[coreFile] = true;
            var picked = null;
            for (var i = 0; i < merged.length; i++) {
                if (staffNavHrefFile(merged[i].href) === coreFile) {
                    picked = merged[i];
                    break;
                }
            }
            core.push({
                href: coreIt.href,
                label:
                    coreFile === "vendor-register.html"
                        ? "업체등록"
                        : picked && picked.label
                          ? picked.label
                          : coreIt.label
            });
        }
        for (var j = 0; j < merged.length; j++) {
            var file = staffNavHrefFile(merged[j].href);
            if (!file || coreSeen[file]) continue;
            rest.push(merged[j]);
        }
        return core.concat(rest);
    }

    function collectVendorSubnavFromBody() {
        var file = currentPageFile();
        if (file === VENDOR_MANAGE_HUB_PAGE) {
            var fromBody = collectBodyNavCards(document);
            var items = [{ href: VENDOR_MANAGE_HUB_PAGE, label: "업체관리" }];
            var seen = {};
            seen[VENDOR_MANAGE_HUB_PAGE] = true;
            for (var i = 0; i < fromBody.length; i++) {
                var f = staffNavHrefFile(fromBody[i].href);
                if (!f || seen[f] || !vendorSubnavItemAllowed(fromBody[i].href)) continue;
                seen[f] = true;
                var label = fromBody[i].label;
                if (f === "vendor-register.html") label = "업체등록";
                items.push({ href: fromBody[i].href, label: label });
            }
            items = normalizeVendorSubnavItems(items);
            saveVendorSubnav(items);
            return items;
        }
        var bodyItems = collectBodyNavCards(document);
        if (bodyItems.length) {
            var mergedBody = [{ href: VENDOR_MANAGE_HUB_PAGE, label: "업체관리" }];
            var seen2 = {};
            seen2[VENDOR_MANAGE_HUB_PAGE] = true;
            for (var j = 0; j < bodyItems.length; j++) {
                var f2 = staffNavHrefFile(bodyItems[j].href);
                if (!f2 || seen2[f2] || !vendorSubnavItemAllowed(bodyItems[j].href)) continue;
                seen2[f2] = true;
                var label2 = bodyItems[j].label;
                if (f2 === "vendor-register.html") label2 = "업체등록";
                mergedBody.push({ href: bodyItems[j].href, label: label2 });
            }
            mergedBody = normalizeVendorSubnavItems(mergedBody);
            saveVendorSubnav(mergedBody);
            return mergedBody;
        }
        var cached = loadVendorSubnav();
        saveVendorSubnav(cached);
        return cached;
    }

    function clearVendorSubnavLinks(nav) {
        if (!nav) return;
        var links = nav.querySelectorAll(
            "a[data-vendor-subnav], a.is-vendor-subnav[data-staff-nav-injected='vendor-manage']"
        );
        for (var i = 0; i < links.length; i++) links[i].remove();
    }

    function syncVendorSubnavCurrent(nav, items) {
        if (!nav || !items || !items.length) return;
        var cur = currentPageFile();
        var links = nav.querySelectorAll("a[data-vendor-subnav]");
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var on = staffNavHrefFile(link.getAttribute("href")) === cur;
            link.classList.toggle("is-current", on);
            if (on) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
    }

    function syncStaffNavVendorSubnav(nav) {
        if (!nav) return;
        var items = normalizeVendorSubnavItems(collectVendorSubnavFromBody());
        if (!items.length) items = normalizeVendorSubnavItems(getDefaultVendorSubnavItems());
        clearVendorSubnavLinks(nav);
        if (!items.length) return;

        var cur = currentPageFile();
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!vendorSubnavItemAllowed(it.href)) continue;
            var file = staffNavHrefFile(it.href);
            if (!file) continue;
            if (nav.querySelector('a[data-vendor-subnav][href*="' + file + '"]')) continue;

            var a = document.createElement("a");
            a.href = it.href;
            a.className = "header-nav-link is-vendor-subnav";
            a.textContent = it.label;
            a.setAttribute("data-staff-nav-injected", "vendor-manage");
            a.setAttribute("data-vendor-subnav", "1");
            if (file === cur) {
                a.classList.add("is-current");
                a.setAttribute("aria-current", "page");
            }
            a.addEventListener("click", function () {
                staffNavSet("vendor-manage");
            });
            nav.appendChild(a);
        }
        syncVendorSubnavCurrent(nav, items);
    }

    function applyStaffNavVendorTabs(nav) {
        if (!nav || !canManageRegisters()) return;
        document.body.classList.toggle("nav-admin-menus", false);

        var plain = nav.querySelectorAll(
            ':scope > a.header-nav-link:not([data-staff-nav-injected]), :scope > .nav-dropdown'
        );
        for (var h = 0; h < plain.length; h++) {
            plain[h].remove();
        }

        nav.classList.remove("site-header-nav--hmh", "site-header-nav--product", "site-header-nav--order");
        nav.classList.add("site-header-nav--vendor");
        syncStaffNavVendorSubnav(nav);
    }

    function refreshVendorHeader() {
        if (!isStaffRole(getRole())) return;
        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;
        if (resolveStaffNavMode() !== "vendor-manage") return;
        applyStaffNavVendorTabs(nav);
    }

    function cardNavVisible(el) {
        if (!el) return false;
        if (el.hidden) return false;
        if (el.getAttribute("aria-hidden") === "true") return false;
        var st = global.getComputedStyle ? global.getComputedStyle(el) : null;
        if (st && st.display === "none") return false;
        return true;
    }

    function collectBodyNavCards(scope) {
        var root = scope || document;
        var items = [];
        var seen = {};

        function pushItem(href, label) {
            var file = staffNavHrefFile(href);
            if (!file || !label) return;
            var key = file + "\t" + label;
            if (seen[key]) return;
            seen[key] = true;
            items.push({ href: href, label: label });
        }

        var hmhCards = root.querySelectorAll(".hmh-panel:not([hidden]) .hmh-card[href]");
        if (hmhCards.length) {
            for (var h = 0; h < hmhCards.length; h++) {
                var hc = hmhCards[h];
                if (!cardNavVisible(hc)) continue;
                var hHref = hc.getAttribute("href");
                var hTitle = hc.querySelector("h3, h2");
                pushItem(hHref, hTitle ? hTitle.textContent.trim() : "");
            }
            return items;
        }

        var main =
            root.querySelector("main.page-main") ||
            root.querySelector("main.company-main");
        if (!main) return items;

        var cards = main.querySelectorAll("a.company-division-card[href]");
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (!cardNavVisible(card)) continue;
            var href = card.getAttribute("href");
            var title = card.querySelector("h2, h3");
            pushItem(href, title ? title.textContent.trim() : "");
        }
        return items;
    }

    function syncHmhManageHomeTabCurrent(nav, activeSection) {
        if (!nav) return;
        var tabs = nav.querySelectorAll("[data-hmh-tab]");
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            var on = tab.getAttribute("data-hmh-tab") === activeSection;
            tab.classList.toggle("is-current", on);
            if (on) tab.setAttribute("aria-current", "page");
            else tab.removeAttribute("aria-current");
        }
    }

    function staffNavEnsureLink(nav, href, label, mode) {
        var file = staffNavHrefFile(href);
        var existing = nav.querySelector('a[href*="' + file + '"]');
        if (existing) {
            staffNavSetVisible(existing, true);
            return existing;
        }
        var a = document.createElement("a");
        a.href = href;
        a.className = "header-nav-link";
        a.textContent = label;
        a.setAttribute("data-staff-nav-injected", mode);
        nav.insertBefore(a, nav.firstChild);
        return a;
    }

    function syncStaffLogoToHub() {
        if (!isStaffRole(getRole())) return;
        var hub = WORK_HUB_PAGE;
        var logos = document.querySelectorAll(".dz-logo, .dz-logo--compact");
        for (var i = 0; i < logos.length; i++) {
            logos[i].setAttribute("href", hub);
            logos[i].setAttribute("aria-label", WORK_HUB_LABEL);
        }
    }

    function getHomepageManageNavSectionForPage(file) {
        if (!file) file = currentPageFile();
        if (file === HOMEPAGE_MANAGE_HUB_PAGE) {
            try {
                var hash = String(global.location.hash || "")
                    .replace(/^#/, "")
                    .toLowerCase();
                if (hash === "support") return "home";
                if (hash === "vendor") return "home";
                if (hash === "home") {
                    return hash;
                }
                if (hash === "product") return "home";
            } catch (e) {}
            return "home";
        }
        if (
            file === "support-news-admin.html" ||
            file === "support-qna-admin.html" ||
            file === "support-inquiry.html"
        ) {
            return "home";
        }
        if (VENDOR_ADMIN_PAGES.indexOf(file) >= 0) return "vendor";
        return "home";
    }

    /** 허브 본문 메뉴를 저장하고, 하위 페이지에서는 저장된 메뉴를 헤더에 표시 (업무관리 허브와 동일 패턴) */
    function collectManageHomeSubnavFromBody() {
        var file = currentPageFile();
        var section = getHomepageManageNavSectionForPage(file);

        if (file === HOMEPAGE_MANAGE_HUB_PAGE) {
            var hubItems = collectBodyNavCards(document);
            if (hubItems.length) saveManageHomeSubnav(section, hubItems);
            return hubItems;
        }

        var bodyItems = collectBodyNavCards(document);
        if (bodyItems.length) {
            saveManageHomeSubnav(section, bodyItems);
            return bodyItems;
        }

        var fallback = loadManageHomeSubnav(section);
        saveManageHomeSubnav(section, fallback);
        return fallback;
    }

    function syncManageHomeSubnavCurrent(nav, items) {
        if (!nav || !items || !items.length) return;
        var cur = currentPageFile();
        var links = nav.querySelectorAll("[data-hmh-subnav]");
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var on = staffNavHrefFile(link.getAttribute("href")) === cur;
            link.classList.toggle("is-current", on);
            if (on) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        }
    }

    function findManageHomeSubnavLink(nav, href) {
        if (!nav) return null;
        var target = staffNavHrefFile(href);
        var links = nav.querySelectorAll("a[data-hmh-subnav]");
        for (var i = 0; i < links.length; i++) {
            if (staffNavHrefFile(links[i].getAttribute("href")) === target) return links[i];
        }
        return null;
    }

    function syncStaffNavManageHomeSubnav(nav) {
        if (!nav) return;

        var section = getHomepageManageNavSectionForPage(currentPageFile());
        var items = collectManageHomeSubnavFromBody();
        if (!items.length) items = loadManageHomeSubnav(section);

        clearManageHomeSubnavLinks(nav);
        if (!items.length) return;

        var cur = currentPageFile();
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var file = staffNavHrefFile(it.href);
            if (findManageHomeSubnavLink(nav, it.href)) continue;

            var a = document.createElement("a");
            a.href = it.href;
            a.className = "header-nav-link is-hmh-subnav";
            a.textContent = it.label;
            a.setAttribute("data-staff-nav-injected", "manage-home");
            a.setAttribute("data-hmh-subnav", section);
            a.setAttribute("data-hmh-dynamic", "1");
            if (file === cur) {
                a.classList.add("is-current");
                a.setAttribute("aria-current", "page");
            }
            a.addEventListener("click", function () {
                staffNavSet("manage-home");
            });
            nav.appendChild(a);
        }
        syncManageHomeSubnavCurrent(nav, items);
    }

    function canAccessHomepageManageCard(cardKey) {
        if (!getHomepageManageHubAccess().allowed) return false;
        if (!canManageRegisters()) return false;
        var key = String(cardKey || "").trim();
        if (
            key === "support-news" ||
            key === "support-qna-admin" ||
            key === "support-inquiry"
        ) {
            return true;
        }
        return false;
    }

    function applyStaffNavManageHomeTabs(nav) {
        if (!nav) return;
        document.body.classList.toggle("nav-admin-menus", false);

        var drops = nav.querySelectorAll(
            '[data-nav-dropdown="product-manage"], [data-nav-dropdown="vendor-manage"]'
        );
        for (var d = 0; d < drops.length; d++) drops[d].remove();

        var plain = nav.querySelectorAll(
            ':scope > a.header-nav-link:not([data-staff-nav-injected]), :scope > .nav-dropdown'
        );
        for (var h = 0; h < plain.length; h++) {
            plain[h].remove();
        }

        nav.classList.remove("site-header-nav--order", "site-header-nav--product");
        nav.classList.add("site-header-nav--hmh");
        syncStaffNavManageHomeSubnav(nav);
    }

    function refreshManageHomeHeader() {
        if (!isStaffRole(getRole())) return;
        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;
        if (resolveStaffNavMode() !== "manage-home") return;
        applyStaffNavManageHomeTabs(nav);
    }

    function applyStaffNavMode(forceMode) {
        syncStaffLogoToHub();
        if (!isStaffRole(getRole())) {
            document.body.classList.remove(
                "staff-nav-hub",
                "staff-nav-public",
                "staff-nav-manage-home",
                "staff-nav-order",
                "staff-nav-product",
                "staff-nav-vendor-manage",
                "staff-nav-work"
            );
            return;
        }
        var mode =
            forceMode === "hub" ||
            forceMode === "public" ||
            forceMode === "manage-home" ||
            forceMode === "product" ||
            forceMode === "vendor-manage" ||
            forceMode === "order" ||
            forceMode === "work"
                ? forceMode
                : resolveStaffNavMode();
        document.body.classList.remove(
            "staff-nav-hub",
            "staff-nav-public",
            "staff-nav-manage-home",
            "staff-nav-order",
            "staff-nav-product",
            "staff-nav-vendor-manage",
            "staff-nav-work"
        );
        document.body.classList.add("staff-nav-" + mode);

        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;

        if (mode !== "manage-home") {
            staffNavClearInjected(nav);
        }

        var workHub = nav.querySelector('a[href="work-hub.html"]');
        if (workHub) workHub.remove();
        var staffManage = nav.querySelector(
            'a[href="staff-manage-hub.html"]:not([data-staff-nav-injected])'
        );
        if (staffManage && mode !== "work") staffManage.remove();

        var top = nav.querySelectorAll(":scope > a.header-nav-link, :scope > .nav-dropdown");
        for (var i = 0; i < top.length; i++) {
            staffNavSetVisible(top[i], staffNavShouldShow(top[i], mode));
        }

        if (mode === "manage-home") {
            applyStaffNavManageHomeTabs(nav);
        } else if (mode === "product") {
            applyStaffNavProductTabs(nav);
        } else if (mode === "vendor-manage") {
            applyStaffNavVendorTabs(nav);
        } else if (mode === "order") {
            applyStaffNavOrderTabs(nav);
        } else if (mode === "work" && isSupervisorStaff()) {
            staffNavEnsureLink(nav, "staff-manage-hub.html", "업무관리", "work");
        }

        var top2 = nav.querySelectorAll(":scope > a.header-nav-link, :scope > .nav-dropdown");
        for (var j = 0; j < top2.length; j++) {
            if (top2[j].getAttribute("data-staff-nav-injected") === mode) continue;
            staffNavSetVisible(top2[j], staffNavShouldShow(top2[j], mode));
        }
    }

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

    var VENDOR_GRADE_NAMES = { 1: "Silver", 2: "Gold", 3: "Diamond" };

    function vendorGradeLabel(grade) {
        var g = parseVendorGrade(grade);
        return VENDOR_GRADE_NAMES[g] || VENDOR_GRADE_NAMES[1];
    }

    function syncVendorGradeFromSessionApi(sess) {
        if (!sessionMatchesCurrentAccount(sess)) return;
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
            if (Array.isArray(sess.vendorProfiles) && sess.vendorProfiles.length) {
                writeVendorProfiles(sess.vendorProfiles);
                authSet(VENDOR_ORDER_ENABLED_KEY, "1");
            } else if (sess.vendorOrderEnabled) {
                authSet(VENDOR_ORDER_ENABLED_KEY, "1");
            } else {
                authRemove(VENDOR_ORDER_ENABLED_KEY);
            }
            if (sess.vendorMgrName || sess.vendorMgrTel || sess.vendorMgrEmail) {
                storeVendorOrderContact({
                    mgrName: sess.vendorMgrName,
                    mgrTel: sess.vendorMgrTel,
                    mgrEmail: sess.vendorMgrEmail
                });
            } else if (!getVendorOrderContact().mgrName || !getVendorOrderContact().mgrTel) {
                fetchVendorOrderContactAsync();
            }
            vendorPermsSynced = true;
        }
        syncStaffOrderEnabledFromSession(sess);
    }

    /** 세션 API — DB 역할·주문 권한을 클라이언트에 반영 */
    function syncRoleFromSession(sess) {
        if (!sessionMatchesCurrentAccount(sess)) return;
        var r = normalizeLoginRole(sess.role);
        if (r === "admin" || r === "supervisor" || r === "vendor" || r === "guest") {
            authSet(ROLE_KEY, r);
        }
    }

    /** 관리자 — 세션 API → 주문서관리 메뉴 */
    function syncStaffOrderEnabledFromSession(sess) {
        if (!sess || !sess.loggedIn) return;
        var r = normalizeLoginRole(sess.role);
        if (r === "supervisor") {
            authRemove(STAFF_ORDER_ENABLED_KEY);
            return;
        }
        if (r === "admin") {
            authSet(STAFF_ORDER_ENABLED_KEY, "1");
            return;
        }
        authRemove(STAFF_ORDER_ENABLED_KEY);
    }

    function refreshStaffOrderEnabledFromProfileAsync() {
        if (normalizeLoginRole(getRole()) !== "admin") {
            return Promise.resolve(null);
        }
        authSet(STAFF_ORDER_ENABLED_KEY, "1");
        return Promise.resolve(null);
    }

    function refreshSessionPermissionsAsync() {
        if (sessionPermRefreshPromise) return sessionPermRefreshPromise;
        if (!global.THEJHON_API || !THEJHON_API.checkSession) {
            return Promise.resolve(null);
        }
        if (!THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return Promise.resolve(null);
        }
        if (!isLoggedIn()) {
            return Promise.resolve(null);
        }
        var epoch = authSessionEpoch;
        sessionPermRefreshPromise = THEJHON_API.checkSession()
            .then(function (sess) {
                if (epoch !== authSessionEpoch) return sess;
                if (sess && sess.code === "SESSION_INVALID") {
                    handleSessionInvalid(sess);
                    return sess;
                }
                if (sess && sess.loggedIn && sessionMatchesCurrentAccount(sess)) {
                    syncRoleFromSession(sess);
                    syncVendorGradeFromSessionApi(sess);
                    syncStaffOrderEnabledFromSession(sess);
                    syncSessionCompanyFromApi(sess);
                    var role = sess.role || getRole();
                    if (
                        role === "vendor" &&
                        !getVendorCompanyName() &&
                        refreshVendorCompanyFromProfileAsync
                    ) {
                        refreshVendorCompanyFromProfileAsync();
                    } else if (
                        isStaffRole(role) &&
                        !String(authGet(COMPANY_KEY) || "").trim() &&
                        !String(authGet(BRAND_COMPANY_KEY) || "").trim() &&
                        refreshBrandFromStaffProfileAsync
                    ) {
                        refreshBrandFromStaffProfileAsync();
                    }
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
                if (epoch === authSessionEpoch && getRole() === "vendor" && isLoggedIn()) {
                    resetVendorOrderPermissionLocal();
                    try {
                        global.dispatchEvent(new CustomEvent("thejhon-auth-permissions-updated"));
                    } catch (e4) {}
                }
                return null;
            })
            .finally(function () {
                sessionPermRefreshPromise = null;
            });
        return sessionPermRefreshPromise;
    }

    function refreshBrandFromStaffProfileAsync() {
        if (!isLoggedIn() || !usesStaffLogoRole()) return Promise.resolve(null);
        if (!global.THEJHON_API || !THEJHON_API.getStaffProfile) return Promise.resolve(null);
        if (!THEJHON_API.getToken || !THEJHON_API.getToken()) return Promise.resolve(null);

        if (currentPageFile() === WORK_HUB_PAGE) {
            var hubLabel =
                String(getLoggedInCompanyDisplayName() || "").trim() ||
                String(getBrandCompanyDisplayName() || "").trim();
            var hubLogo = String(authGet(STAFF_LOGO_KEY) || "").trim();
            if (hubLabel && hubLogo) {
                if (typeof global.__thejhonApplySiteLogo === "function") {
                    try {
                        global.__thejhonApplySiteLogo(hubLogo, hubLabel);
                    } catch (eHubLogo) {}
                }
                if (typeof global.__thejhonRefreshHeaderCompany === "function") {
                    try {
                        global.__thejhonRefreshHeaderCompany();
                    } catch (eHubCo) {}
                }
                return Promise.resolve(null);
            }
        }

        var role = getRole();
        var chain = Promise.resolve(null);
        if (role === "vendor" && refreshVendorCompanyFromProfileAsync) {
            chain = refreshVendorCompanyFromProfileAsync();
        }
        return chain
            .then(function () {
                return THEJHON_API.getStaffProfile();
            })
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
            trackPageViewIfNeeded();
        }
        run();
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", run);
        }
        window.addEventListener("pageshow", run);
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
        return isAdminStaff();
    }

    function readVendorProfiles() {
        try {
            var raw = authGet(VENDOR_PROFILES_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writeVendorProfiles(list) {
        try {
            authSet(VENDOR_PROFILES_KEY, JSON.stringify(list || []));
        } catch (e2) {
            authRemove(VENDOR_PROFILES_KEY);
        }
    }

    function findVendorProfileForOwner(productOwner) {
        var owner = String(productOwner || "").trim();
        if (!owner || owner.toLowerCase() === "legacy") return null;
        var profiles = readVendorProfiles();
        for (var i = 0; i < profiles.length; i++) {
            var p = profiles[i] || {};
            if (staffLoginIdsEqualClient(p.registeredBy, owner)) return p;
        }
        return null;
    }

    function isVendorOrderEnabled() {
        if (getRole() !== "vendor") return false;
        if (!vendorPermsSynced) return false;
        if (readVendorProfiles().length > 0) return true;
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

    /** 상품 등록 관리자에게 업체 등록·등급이 있으면 등급가 */
    function vendorProductUsesGradePrice(it) {
        if (!it || getRole() !== "vendor") return false;
        var productOwner = String(it.pd_registered_by || "").trim();
        return !!findVendorProfileForOwner(productOwner);
    }

    /** 주문·장바구니 — vendors에 등록된 업체는 모든 관리자 상품 주문 가능 */
    function vendorProductCanOrder(it) {
        if (!it || getRole() !== "vendor") return false;
        if (!isVendorOrderEnabled()) return false;
        var owner = String(it.pd_registered_by || "").trim();
        if (!owner || owner.toLowerCase() === "legacy") return false;
        return true;
    }

    /**
     * 상품 가격 HTML (products 목록·상세 공통)
     * options: { mode: "inline"|"detail", formatWon, escapeHtml }
     */
    /** 업체(vendor)만 상품 주문·장바구니 */
    function isSupervisorStaff() {
        return isLoggedIn() && normalizeLoginRole(getRole()) === "supervisor";
    }

    function isAdminStaff() {
        return isLoggedIn() && normalizeLoginRole(getRole()) === "admin";
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
            vendorPermsSynced &&
            isVendorOrderEnabled() &&
            !!(global.THEJHON_API && THEJHON_API.getToken && THEJHON_API.getToken())
        );
    }

    /** 업체 주문·장바구니·주문서 보기 — 관리자 등록 업체(vendor) 전용 */
    function getVendorCartAccess() {
        normalizeLegacySession();
        if (!isLoggedIn()) {
            return { allowed: false, reason: "로그인이 필요합니다." };
        }
        if (getRole() !== "vendor") {
            return {
                allowed: false,
                reason: "관리자가 등록한 업체 계정만 주문·장바구니를 이용할 수 있습니다."
            };
        }
        if (!canPlaceVendorOrders()) {
            return {
                allowed: false,
                reason: "등록된 업체 계정으로 로그인한 뒤 주문할 수 있습니다."
            };
        }
        return { allowed: true, reason: "" };
    }

    /** 업체관리 — 주문서관리 메뉴·화면 (모든 관리자) */
    function canShowOrderManageMenu() {
        return (
            isLoggedIn() &&
            isAdminStaff() &&
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
                reason: "관리자만 이용할 수 있습니다."
            };
        }
        return { allowed: true, role: getRole() };
    }

    /** 그룹 마케팅 — 영업관리 허브 (슈퍼바이저·관리자) */
    function getOrderManageHubAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return {
                allowed: false,
                reason: "로그인이 필요합니다."
            };
        }
        if (!isLoggedIn()) {
            return { allowed: false, reason: "로그인이 필요합니다." };
        }
        if (isSupervisorStaff()) {
            return { allowed: true, role: "supervisor" };
        }
        if (canShowOrderManageMenu()) {
            return { allowed: true, role: "admin" };
        }
        return {
            allowed: false,
            reason: "영업관리는 관리자·슈퍼바이저만 이용할 수 있습니다."
        };
    }

    function getOrderManageHubLinks() {
        if (isSupervisorStaff()) {
            return {
                list: "supervisor-order-list.html",
                orderPdf: "supervisor-order-pdf.html",
                transactionPdf: "supervisor-transaction-pdf.html",
                transactionList: "transaction-list.html",
                transactionManual: "transaction-manual-register.html",
                transactionManualList: "transaction-list.html?tab=manual",
                salesLedgerHub: "sales-ledger-hub.html",
                salesLedgerByVendor: "sales-ledger-by-vendor.html",
                salesLedgerByProduct: "sales-ledger-by-product.html",
                salesLedgerByDate: "sales-ledger-by-date.html",
                salesLedgerInquiry: "sales-ledger-hub.html",
                taxInvoice: "tax-invoice.html",
                marketingRegister: "marketing-material-register.html",
                marketingList: "marketing-material-list.html"
            };
        }
        if (canShowOrderManageMenu()) {
            return {
                list: "order-list-admin.html",
                orderPdf: "supervisor-order-pdf.html",
                transactionPdf: "supervisor-transaction-pdf.html",
                transactionList: "transaction-list.html",
                transactionManual: "transaction-manual-register.html",
                transactionManualList: "transaction-list.html?tab=manual",
                salesLedgerHub: "sales-ledger-hub.html",
                salesLedgerByVendor: "sales-ledger-by-vendor.html",
                salesLedgerByProduct: "sales-ledger-by-product.html",
                salesLedgerByDate: "sales-ledger-by-date.html",
                salesLedgerInquiry: "sales-ledger-hub.html",
                taxInvoice: "tax-invoice.html",
                marketingRegister: "marketing-material-register.html",
                marketingList: "marketing-material-list.html"
            };
        }
        return {
            list: ORDER_MANAGE_HUB_PAGE,
            orderPdf: ORDER_MANAGE_HUB_PAGE,
            transactionPdf: "",
            transactionManual: "",
            transactionManualList: "",
            salesLedgerHub: "",
            salesLedgerInquiry: "",
            taxInvoice: ""
        };
    }

    /** 관리자·슈퍼바이저 — 그룹 마케팅 관리 허브 */
    function getWorkHubAccess() {
        normalizeLegacySession();
        if (!global.THEJHON_API || !THEJHON_API.getToken || !THEJHON_API.getToken()) {
            return {
                allowed: false,
                reason: "로그인이 필요합니다. 관리자·슈퍼바이저 계정으로 로그인해 주세요."
            };
        }
        if (!isLoggedIn()) {
            return { allowed: false, reason: "로그인이 필요합니다." };
        }
        if (!isStaffRole(getRole())) {
            return {
                allowed: false,
                reason: "관리자·슈퍼바이저만 " + WORK_HUB_LABEL + "을(를) 이용할 수 있습니다."
            };
        }
        return { allowed: true, role: getRole() };
    }

    var WORK_HUB_BASE_MENUS = [
        "view-home",
        "manage-home",
        "product-manage",
        "vendor-manage"
    ];

    /**
     * work-hub 메뉴 id 목록 (페이지 입장 권한과 분리 — 표시만 역할)
     * 슈퍼바이저 6 · 관리자 5
     */
    function getWorkHubVisibleMenuKeys() {
        normalizeLegacySession();
        if (!isLoggedIn()) return [];
        var role = normalizeLoginRole(getRole());
        if (role === "supervisor") {
            return WORK_HUB_BASE_MENUS.concat(["order-manage", "work-manage"]);
        }
        if (role === "admin") {
            return WORK_HUB_BASE_MENUS.concat(["order-manage"]);
        }
        return [];
    }

    function canAccessWorkHubMenu(menuKey) {
        var key = String(menuKey || "").trim();
        return getWorkHubVisibleMenuKeys().indexOf(key) >= 0;
    }

    /** 홈페이지 관리하기 허브 — 상품·업체·고객센터 운영 */
    function getHomepageManageHubAccess() {
        return getWorkHubAccess();
    }

    function getWorkHubOrderManageHref() {
        if (getOrderManageHubAccess().allowed) return ORDER_MANAGE_HUB_PAGE;
        return "work-hub.html";
    }

    function getStaffLandingPath() {
        return WORK_HUB_PAGE;
    }

    function normalizeLoginRole(role) {
        return String(role || "")
            .trim()
            .toLowerCase();
    }

    function isStaffLandingRole(role) {
        var r = normalizeLoginRole(role);
        return r === "admin" || r === "supervisor";
    }

    function isPublicHomeLandingRole(role) {
        return normalizeLoginRole(role) === "vendor";
    }

    /** next가 홈(index)·루트·빈 경로인지 */
    function isHomeLandingPath(path) {
        if (!path || path === "/") return true;
        var seg = "";
        try {
            var u = new URL(path, window.location.href);
            seg = (u.pathname || "").replace(/\\/g, "/").split("/").pop().toLowerCase();
        } catch (e) {
            seg = String(path).split("?")[0].split("/").pop().toLowerCase();
        }
        return !seg || seg === "index.html";
    }

    /**
     * 로그인 완료 후 이동 경로
     * - 등록 업체 → index (홈)
     * - 슈퍼바이저·관리자 → work-hub (단, next가 홈이면 허브로 보정)
     */
    function getPostLoginLandingPath(role, nextRaw) {
        var r = normalizeLoginRole(role);
        if (nextRaw) {
            var dest = safeNextPath(nextRaw);
            if (isStaffLandingRole(r) && isHomeLandingPath(dest)) {
                return getStaffLandingPath();
            }
            if (isPublicHomeLandingRole(r)) {
                var hubSeg = "work-hub.html";
                if (String(dest).toLowerCase().indexOf(hubSeg) >= 0) {
                    return "index.html";
                }
            }
            return dest;
        }
        if (isStaffLandingRole(r)) return getStaffLandingPath();
        return "index.html";
    }

    function getVendorUnitPriceForProduct(it) {
        if (!it || !canSeeProductPrices()) return { unitPrice: 0, priceLabel: "" };
        if (isStaffRole(getRole())) {
            var sp1 = Number(it.pd_price1);
            if (!isFinite(sp1)) sp1 = 0;
            return { unitPrice: sp1, priceLabel: DETAIL_PRICE_LABEL };
        }
        var profile = findVendorProfileForOwner(it.pd_registered_by);
        if (profile) {
            var grade = parseVendorGrade(profile.grade);
            var priceKey = getPriceKeyForGrade(grade);
            var priceVal = Number(it[priceKey]);
            if (!isFinite(priceVal) || priceVal <= 0) {
                priceVal = Number(it.pd_price1);
                if (!isFinite(priceVal)) priceVal = 0;
            }
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
        var role = getRole();
        if (role === "vendor") {
            var co = getVendorCompanyName();
            if (co) return co;
            var disp = String(authGet(DISPLAY_KEY) || "").trim();
            var brand = String(authGet(BRAND_COMPANY_KEY) || "").trim();
            if (disp && (!brand || disp !== brand)) return disp;
            return "";
        }
        if (isStaffRole(role)) {
            var staffLabel = getBrandCompanyDisplayName();
            if (staffLabel) return staffLabel;
            return String(authGet(DISPLAY_KEY) || authGet(USER_ID_KEY) || "").trim();
        }
        return String(authGet(DISPLAY_KEY) || "").trim();
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
        var seg = (path.split("/").pop() || "").split("?")[0].toLowerCase();
        return seg || "index.html";
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

    function redirectFromProtectedPage(showDeniedAlert, deniedKind) {
        var url = "index.html";
        if (showDeniedAlert) {
            url += deniedKind === "cart" ? "?denied=cart" : "?denied=register";
        }
        window.location.replace(url);
    }

    function trackPageViewIfNeeded() {
        try {
            if (!global.THEJHON_API || !THEJHON_API.trackPageView) return;
            var page = currentPageFile();
            if (!page || page === "login.html") return;
            if (!isSitePublicPage(page) && !isLoggedIn()) return;
            THEJHON_API.trackPageView(page).catch(function () {});
        } catch (e) {}
    }

    function enforceSiteLogin() {
        normalizeLegacySession();
        var page = currentPageFile();
        if (page === "login.html") return;
        if (page === "support-partner-detail.html") {
            if (!isLoggedIn()) {
                window.location.replace("support-partners.html?membersOnly=1");
            }
            return;
        }
        if (isSitePublicPage(page)) return;
        if (isLoggedIn()) return;
        var next = window.location.pathname + window.location.search + window.location.hash;
        if (!next || next === "/") next = "/index.html";
        window.location.replace(
            "login.html?next=" + encodeURIComponent(next)
        );
    }

    function enforceRegisterPages() {
        var page = currentPageFile();
        if (page === WORK_HUB_PAGE || page === SYSTEM_STRUCTURE_DOCS_PAGE) {
            if (!getWorkHubAccess().allowed) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (page === HOMEPAGE_MANAGE_HUB_PAGE) {
            if (!getHomepageManageHubAccess().allowed) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (ORDER_MANAGE_HUB_PAGES.indexOf(page) >= 0) {
            if (!getOrderManageHubAccess().allowed) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (ORDER_MANAGE_PAGES.indexOf(page) >= 0) {
            if (!canShowOrderManageMenu()) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (page === "staff-self-edit.html" || page === "staff-company-intro.html") {
            if (!isLoggedIn() || (!isAdminStaff() && !isSupervisorStaff())) {
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
        if (page === "vendor-prospect-region.html") {
            if (!getProspectFinderAccess().allowed) {
                redirectFromProtectedPage(isLoggedIn());
            }
            return;
        }
        if (page === "cart.html") {
            if (getVendorCartAccess().allowed) return;
            if (
                isLoggedIn() &&
                getRole() === "vendor" &&
                global.THEJHON_API &&
                THEJHON_API.getToken &&
                THEJHON_API.getToken()
            ) {
                return;
            }
            redirectFromProtectedPage(isLoggedIn(), "cart");
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

    /** 로그아웃 — 서버 세션 해제 후 공개 홈으로 */
    function logout() {
        clearSessionAsync().finally(function () {
            window.location.replace("index.html");
        });
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

    /** 그룹 마케팅 관리 허브 메뉴(홈페이지·index 제외) 및 하위 관리 페이지에서만 푸터 숨김 */
    function shouldHideSiteFooter(file) {
        if (!file) file = currentPageFile();
        if (file === "index.html") return false;
        if (file === WORK_HUB_PAGE || file === HOMEPAGE_MANAGE_HUB_PAGE) return true;
        if (STAFF_NAV_ORDER_PAGES[file]) return true;
        if (STAFF_NAV_PRODUCT_PAGES[file]) return true;
        if (STAFF_NAV_VENDOR_PAGES[file]) return true;
        if (STAFF_NAV_WORK_PAGES[file]) return true;
        if (!STAFF_NAV_MANAGE_HOME_PAGES[file]) return false;
        if (file === "support-inquiry.html") {
            return isStaffRole(getRole()) && resolveStaffNavMode() === "manage-home";
        }
        return true;
    }

    function applySiteFooterVisibility() {
        if (!document.body) return;
        document.body.classList.toggle("site-footer-hidden", shouldHideSiteFooter());
    }

    function applyNavRegisterVisibility() {
        try {
            normalizeLegacySession();
            applySiteFooterVisibility();
            if (isStaffRole(getRole())) {
                applyStaffNavMode();
                applySiteFooterVisibility();
                return;
            }
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
            var vendorCartLinks = nav.querySelectorAll(
                '[data-nav-order-manage], a[href="cart.html"]'
            );
            var showVendorCart = getVendorCartAccess().allowed;
            for (var vc = 0; vc < vendorCartLinks.length; vc++) {
                if (showVendorCart) continue;
                vendorCartLinks[vc].remove();
            }
            var staffManage = nav.querySelector(
                'a[href="staff-manage-hub.html"], a[href="staff-manage.html"]'
            );
            var workHub = nav.querySelector('a[href="work-hub.html"]');
            var showWorkHub = getWorkHubAccess().allowed;
            if (staffManage) {
                staffManage.remove();
            }
            if (showWorkHub) {
                if (!workHub) {
                    workHub = document.createElement("a");
                    workHub.href = "work-hub.html";
                    workHub.className = "header-nav-link";
                    workHub.textContent = WORK_HUB_LABEL;
                    var supportDrop = nav.querySelector('[data-nav-dropdown="support"]');
                    if (supportDrop && supportDrop.parentNode === nav) {
                        nav.insertBefore(workHub, supportDrop);
                    } else {
                        nav.appendChild(workHub);
                    }
                }
                workHub.classList.remove("header-nav-link--register-hidden");
                workHub.removeAttribute("aria-hidden");
                workHub.hidden = false;
                workHub.style.removeProperty("display");
            } else if (workHub) {
                workHub.remove();
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
        setFormSessionAsync: setFormSessionAsync,
        setOAuthSession: setOAuthSession,
        clearSession: clearSession,
        clearSessionAsync: clearSessionAsync,
        repairInconsistentAuthState: repairInconsistentAuthState,
        logout: logout,
        usesStaffLogoRole: usesStaffLogoRole,
        cacheStaffLogo: cacheStaffLogo,
        getCachedStaffLogo: getCachedStaffLogo,
        getSavedLoginIdHint: getSavedLoginIdHint,
        clearStaffLogoCache: clearStaffLogoCache,
        handleSessionInvalid: handleSessionInvalid,
        normalizeLegacySession: normalizeLegacySession,
        isLoggedIn: isLoggedIn,
        hasAccountSession: hasAccountSession,
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
        getVendorCartAccess: getVendorCartAccess,
        canShowOrderManageMenu: canShowOrderManageMenu,
        getOrderManageAccess: getOrderManageAccess,
        getOrderManageHubAccess: getOrderManageHubAccess,
        getOrderManageHubLinks: getOrderManageHubLinks,
        getWorkHubLabel: function () {
            return WORK_HUB_LABEL;
        },
        getWorkHubAccess: getWorkHubAccess,
        canAccessWorkHubMenu: canAccessWorkHubMenu,
        getWorkHubVisibleMenuKeys: getWorkHubVisibleMenuKeys,
        refreshStaffOrderEnabledFromProfileAsync: refreshStaffOrderEnabledFromProfileAsync,
        getHomepageManageHubAccess: getHomepageManageHubAccess,
        canAccessHomepageManageCard: canAccessHomepageManageCard,
        getHomepageManageNavSectionForPage: getHomepageManageNavSectionForPage,
        applyStaffNavManageHomeTabs: applyStaffNavManageHomeTabs,
        applyStaffNavOrderTabs: applyStaffNavOrderTabs,
        applyStaffNavProductTabs: applyStaffNavProductTabs,
        refreshManageHomeHeader: refreshManageHomeHeader,
        refreshOrderHeader: refreshOrderHeader,
        refreshProductHeader: refreshProductHeader,
        refreshVendorHeader: refreshVendorHeader,
        saveManageHomeSubnav: saveManageHomeSubnav,
        syncHmhManageHomeTabCurrent: syncHmhManageHomeTabCurrent,
        staffNavClearInjected: staffNavClearInjected,
        getWorkHubOrderManageHref: getWorkHubOrderManageHref,
        getStaffLandingPath: getStaffLandingPath,
        getPostLoginLandingPath: getPostLoginLandingPath,
        getStaffNavMode: getStaffNavMode,
        setStaffNavMode: setStaffNavMode,
        applyStaffNavMode: applyStaffNavMode,
        syncStaffLogoToHub: syncStaffLogoToHub,
        isVendorOrderEnabled: isVendorOrderEnabled,
        isVendorPermsSynced: function () {
            return vendorPermsSynced;
        },
        isStaffOrderEnabled: isStaffOrderEnabled,
        isSupervisorStaff: isSupervisorStaff,
        getSupervisorExcelImportAccess: getSupervisorExcelImportAccess,
        getProspectFinderAccess: getProspectFinderAccess,
        canManageStaffAccounts: canManageStaffAccounts,
        getStaffManageAccess: getStaffManageAccess,
        VENDOR_ORDER_ENABLED_KEY: VENDOR_ORDER_ENABLED_KEY,
        getVendorUnitPriceForProduct: getVendorUnitPriceForProduct,
        syncVendorGradeFromSessionApi: syncVendorGradeFromSessionApi,
        syncSessionCompanyFromApi: syncSessionCompanyFromApi,
        syncVendorCompanyFromProfile: syncVendorCompanyFromProfile,
        refreshVendorCompanyFromProfileAsync: refreshVendorCompanyFromProfileAsync,
        refreshSessionPermissionsAsync: refreshSessionPermissionsAsync,
        refreshBrandFromStaffProfileAsync: refreshBrandFromStaffProfileAsync,
        VENDOR_GRADE_KEY: VENDOR_GRADE_KEY,
        getLoggedInCompanyDisplayName: getLoggedInCompanyDisplayName,
        getBrandCompanyDisplayName: getBrandCompanyDisplayName,
        getVendorCompanyName: getVendorCompanyName,
        updateBrandFromStaffProfile: updateBrandFromStaffProfile,
        getVendorOrderContact: getVendorOrderContact,
        storeVendorOrderContact: storeVendorOrderContact,
        writeVendorProfiles: writeVendorProfiles,
        readVendorProfiles: readVendorProfiles,
        fetchVendorOrderContactAsync: fetchVendorOrderContactAsync,
        isNotebookViewport: isNotebookViewport,
        enforceRegisterPages: enforceRegisterPages,
        enforceSiteLogin: enforceSiteLogin,
        trackPageViewIfNeeded: trackPageViewIfNeeded,
        applyNavRegisterVisibility: applyNavRegisterVisibility,
        safeNextPath: safeNextPath,
        hasAccountSession: hasAccountSession,
        isSitePublicPage: isSitePublicPage,
        isStaffNavPublicPage: isStaffNavPublicPage
    };
})(typeof window !== "undefined" ? window : this);
