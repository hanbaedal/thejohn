/**
 * 세션 + /api/auth/login (MongoDB staff · vendors)
 *
 * 권한 정의
 * 1. 관리자(staff: admin) — 상품관리·업체관리 메뉴, 사업부문·상세는 가격1만 표시
 * 2. 업체(vendor) — 담당 관리자가 등록한 상품만 등급별 가격, 타 관리자 상품은 가격1
 * 3. 미로그인 — 관리 메뉴 숨김, 사업부문 가격 비표시
 * (비활성화 = 헤더에서 해당 메뉴가 보이지 않음)
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
    /** 주문·장바구니 허용 업체 등록 담당 (서버 ORDER_VENDOR_STAFF_ID 와 동일, 기본 aksangsa) */
    var ORDER_VENDOR_STAFF_ID = "aksangsa";

    function normalizeId(s) {
        return String(s || "")
            .trim()
            .toLowerCase();
    }

    function isStaffRole(role) {
        return role === "admin" || role === "supervisor";
    }

    function clearSession() {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(USER_ID_KEY);
        sessionStorage.removeItem(ROLE_KEY);
        sessionStorage.removeItem(COMPANY_KEY);
        sessionStorage.removeItem(DISPLAY_KEY);
        sessionStorage.removeItem("thejhon_auth_provider");
        sessionStorage.removeItem("thejhon_google_credential");
        sessionStorage.removeItem(VENDOR_GRADE_KEY);
        sessionStorage.removeItem(VENDOR_REGISTERED_BY_KEY);
        sessionStorage.removeItem(VENDOR_ORDER_ENABLED_KEY);
        sessionStorage.removeItem(VENDOR_MGR_NAME_KEY);
        sessionStorage.removeItem(VENDOR_MGR_TEL_KEY);
        sessionStorage.removeItem(VENDOR_MGR_EMAIL_KEY);
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken("");
    }

    function normalizeLegacySession() {
        if (sessionStorage.getItem(AUTH_KEY) === "1" && !sessionStorage.getItem(ROLE_KEY)) {
            clearSession();
        }
        var role = sessionStorage.getItem(ROLE_KEY);
        if (role === "guest") {
            clearSession();
            return;
        }
        if (isStaffRole(role) || role === "vendor") {
            var company = sessionStorage.getItem(COMPANY_KEY);
            if (company) sessionStorage.setItem(DISPLAY_KEY, company);
        } else if (role === "admin" && !sessionStorage.getItem(DISPLAY_KEY)) {
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
            displayName: data.companyName || data.displayName || data.userId || "",
            vendorGrade: data.vendorGrade || "",
            vendorRegisteredBy: data.vendorRegisteredBy || "",
            vendorOrderEnabled: !!data.vendorOrderEnabled,
            vendorMgrName: data.vendorMgrName || "",
            vendorMgrTel: data.vendorMgrTel || "",
            vendorMgrEmail: data.vendorMgrEmail || ""
        };
    }

    function storeVendorOrderContact(contact) {
        var c = contact || {};
        var name = String(c.mgrName != null ? c.mgrName : c.vn_mgr_name || "").trim();
        var tel = String(c.mgrTel != null ? c.mgrTel : c.vn_mgr_tel || "").trim();
        var email = String(c.mgrEmail != null ? c.mgrEmail : c.vn_mgr_email || "").trim();
        if (name) sessionStorage.setItem(VENDOR_MGR_NAME_KEY, name);
        else sessionStorage.removeItem(VENDOR_MGR_NAME_KEY);
        if (tel) sessionStorage.setItem(VENDOR_MGR_TEL_KEY, tel);
        else sessionStorage.removeItem(VENDOR_MGR_TEL_KEY);
        if (email) sessionStorage.setItem(VENDOR_MGR_EMAIL_KEY, email);
        else sessionStorage.removeItem(VENDOR_MGR_EMAIL_KEY);
    }

    function getVendorOrderContact() {
        return {
            company: getLoggedInCompanyDisplayName(),
            mgrName: String(sessionStorage.getItem(VENDOR_MGR_NAME_KEY) || "").trim(),
            mgrTel: String(sessionStorage.getItem(VENDOR_MGR_TEL_KEY) || "").trim(),
            mgrEmail: String(sessionStorage.getItem(VENDOR_MGR_EMAIL_KEY) || "").trim()
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
        vendorMgrEmail
    ) {
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(USER_ID_KEY, userId || "");
        sessionStorage.setItem(ROLE_KEY, role || "");
        sessionStorage.setItem("thejhon_auth_provider", "form");
        if (role === "vendor") {
            sessionStorage.setItem(VENDOR_GRADE_KEY, parseVendorGrade(vendorGrade));
            var regBy = String(vendorRegisteredBy || "").trim().toLowerCase();
            if (regBy) sessionStorage.setItem(VENDOR_REGISTERED_BY_KEY, regBy);
            else sessionStorage.removeItem(VENDOR_REGISTERED_BY_KEY);
            if (vendorOrderEnabled) sessionStorage.setItem(VENDOR_ORDER_ENABLED_KEY, "1");
            else sessionStorage.removeItem(VENDOR_ORDER_ENABLED_KEY);
            storeVendorOrderContact({
                mgrName: vendorMgrName,
                mgrTel: vendorMgrTel,
                mgrEmail: vendorMgrEmail
            });
        } else {
            sessionStorage.removeItem(VENDOR_GRADE_KEY);
            sessionStorage.removeItem(VENDOR_REGISTERED_BY_KEY);
            sessionStorage.removeItem(VENDOR_ORDER_ENABLED_KEY);
            sessionStorage.removeItem(VENDOR_MGR_NAME_KEY);
            sessionStorage.removeItem(VENDOR_MGR_TEL_KEY);
            sessionStorage.removeItem(VENDOR_MGR_EMAIL_KEY);
        }
        var label = companyName || "";
        if (isStaffRole(role) || role === "vendor") {
            if (label) {
                sessionStorage.setItem(COMPANY_KEY, label);
                sessionStorage.setItem(DISPLAY_KEY, label);
            } else {
                sessionStorage.removeItem(COMPANY_KEY);
                sessionStorage.removeItem(DISPLAY_KEY);
            }
        } else {
            if (companyName) sessionStorage.setItem(COMPANY_KEY, companyName);
            else sessionStorage.removeItem(COMPANY_KEY);
            if (displayName) sessionStorage.setItem(DISPLAY_KEY, displayName);
            else sessionStorage.removeItem(DISPLAY_KEY);
        }
        if (global.THEJHON_API && THEJHON_API.setToken) THEJHON_API.setToken(token || "");
    }

    function setOAuthSession(provider) {
        sessionStorage.setItem(AUTH_KEY, "1");
        sessionStorage.setItem(USER_ID_KEY, "oauth_" + String(provider || "sns"));
        sessionStorage.setItem(ROLE_KEY, "oauth");
        sessionStorage.setItem("thejhon_auth_provider", String(provider || "oauth"));
        sessionStorage.removeItem(COMPANY_KEY);
        sessionStorage.removeItem(DISPLAY_KEY);
        sessionStorage.removeItem(VENDOR_GRADE_KEY);
        sessionStorage.removeItem(VENDOR_REGISTERED_BY_KEY);
        sessionStorage.removeItem(VENDOR_ORDER_ENABLED_KEY);
        sessionStorage.removeItem(VENDOR_MGR_NAME_KEY);
        sessionStorage.removeItem(VENDOR_MGR_TEL_KEY);
        sessionStorage.removeItem(VENDOR_MGR_EMAIL_KEY);
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
        "vendor-new-list.html"
    ];
    var ORDER_MANAGE_PAGES = ["order-list-admin.html"];
    var DATA_MIGRATE_PAGES = ["data-migrate-admin.html"];
    var STAFF_MANAGE_PAGES = ["staff-manage.html"];
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
        return parseVendorGrade(sessionStorage.getItem(VENDOR_GRADE_KEY));
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
                sessionStorage.setItem(VENDOR_GRADE_KEY, parseVendorGrade(sess.vendorGrade));
            }
            if (sess.vendorRegisteredBy) {
                sessionStorage.setItem(
                    VENDOR_REGISTERED_BY_KEY,
                    String(sess.vendorRegisteredBy).trim().toLowerCase()
                );
            }
            if (sess.vendorOrderEnabled) {
                sessionStorage.setItem(VENDOR_ORDER_ENABLED_KEY, "1");
            } else {
                sessionStorage.removeItem(VENDOR_ORDER_ENABLED_KEY);
            }
        }
    }

    function isVendorOrderEnabled() {
        return sessionStorage.getItem(VENDOR_ORDER_ENABLED_KEY) === "1";
    }

    function getVendorRegisteredBy() {
        if (getRole() !== "vendor") return "";
        return String(sessionStorage.getItem(VENDOR_REGISTERED_BY_KEY) || "")
            .trim()
            .toLowerCase();
    }

    /** 업체 거래처(등록 담당)와 상품 등록 담당이 같을 때만 등급가 적용 */
    function vendorProductUsesGradePrice(it) {
        if (!it || getRole() !== "vendor") return false;
        var mine = getVendorRegisteredBy();
        var productOwner = String(it.pd_registered_by || "")
            .trim()
            .toLowerCase();
        if (!mine || mine === "legacy" || !productOwner || productOwner === "legacy") {
            return false;
        }
        return mine === productOwner;
    }

    /**
     * 상품 가격 HTML (products 목록·상세 공통)
     * options: { mode: "inline"|"detail", formatWon, escapeHtml }
     */
    /** 업체(vendor)만 상품 주문·장바구니 */
    function isSupervisorStaff() {
        return isLoggedIn() && getRole() === "supervisor";
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

    /** 업체관리 — 주문서관리 메뉴·화면 (aksangsa 관리자만) */
    function canShowOrderManageMenu() {
        return (
            isLoggedIn() &&
            getRole() === "admin" &&
            normalizeId(getUserId()) === normalizeId(ORDER_VENDOR_STAFF_ID) &&
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
                reason:
                    "주문서관리는 aksangsa 관리자만 이용할 수 있습니다."
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
        var role = getRole();
        var company = sessionStorage.getItem(COMPANY_KEY);
        if (company) return company;
        if (role === "supervisor" || role === "admin") return "(주)더존";
        if (role === "vendor") return getUserId();
        return sessionStorage.getItem(DISPLAY_KEY) || "";
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

    function enforceRegisterPages() {
        var page = currentPageFile();
        if (DATA_MIGRATE_PAGES.indexOf(page) >= 0) {
            if (!canManageRegisters()) {
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
        if (STAFF_MANAGE_PAGES.indexOf(page) >= 0) {
            if (!canManageStaffAccounts()) {
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

    /** 로그아웃 — 세션 삭제 후 홈으로 (관리 페이지에서 reload 시 권한 알림이 뜨지 않음) */
    function logout() {
        clearSession();
        window.location.replace("index.html");
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
            for (var o = 0; o < orderLinks.length; o++) {
                if (showOrder) {
                    orderLinks[o].classList.remove("header-nav-link--register-hidden");
                    orderLinks[o].removeAttribute("aria-hidden");
                    orderLinks[o].style.removeProperty("display");
                } else {
                    orderLinks[o].remove();
                }
            }
            var staffManage = nav.querySelector('a[href="staff-manage.html"]');
            var showStaffManage = canManageStaffAccounts();
            if (staffManage) {
                if (showStaffManage) {
                    staffManage.classList.remove("header-nav-link--register-hidden");
                    staffManage.removeAttribute("aria-hidden");
                    staffManage.style.removeProperty("display");
                } else {
                    staffManage.remove();
                }
            }
        } catch (e) {}
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
        ORDER_VENDOR_STAFF_ID: ORDER_VENDOR_STAFF_ID,
        isSupervisorStaff: isSupervisorStaff,
        canManageStaffAccounts: canManageStaffAccounts,
        getStaffManageAccess: getStaffManageAccess,
        VENDOR_ORDER_ENABLED_KEY: VENDOR_ORDER_ENABLED_KEY,
        getVendorUnitPriceForProduct: getVendorUnitPriceForProduct,
        syncVendorGradeFromSessionApi: syncVendorGradeFromSessionApi,
        VENDOR_GRADE_KEY: VENDOR_GRADE_KEY,
        getLoggedInCompanyDisplayName: getLoggedInCompanyDisplayName,
        getVendorOrderContact: getVendorOrderContact,
        storeVendorOrderContact: storeVendorOrderContact,
        fetchVendorOrderContactAsync: fetchVendorOrderContactAsync,
        isNotebookViewport: isNotebookViewport,
        enforceRegisterPages: enforceRegisterPages,
        applyNavRegisterVisibility: applyNavRegisterVisibility,
        safeNextPath: safeNextPath
    };
})(typeof window !== "undefined" ? window : this);
