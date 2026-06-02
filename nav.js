(function () {
    if (window.THEJHON_AUTH) {
        THEJHON_AUTH.enforceSiteLogin();
        THEJHON_AUTH.enforceRegisterPages();
        THEJHON_AUTH.applyNavRegisterVisibility();
        if (THEJHON_AUTH.trackPageViewIfNeeded) THEJHON_AUTH.trackPageViewIfNeeded();
    }

    (function ensureHeaderLayout() {
        var header = document.querySelector(".site-header");
        if (!header) return;

        var nav =
            header.querySelector(".site-header-menu-scroll-track .site-header-nav") ||
            header.querySelector(".site-header-menu-scroll .site-header-nav") ||
            header.querySelector(".site-header-start .site-header-nav") ||
            header.querySelector(".site-header-nav");
        if (!nav) return;

        var actions = header.querySelector(".site-header-actions");
        var logo =
            header.querySelector(".site-header-brand .dz-logo") ||
            header.querySelector(".site-header-brand .dz-logo--compact") ||
            header.querySelector(".site-header-start .dz-logo") ||
            header.querySelector(".site-header-start .dz-logo--compact");

        var brand = header.querySelector(".site-header-brand");
        if (!brand) {
            brand = document.createElement("div");
            brand.className = "site-header-brand";
            header.insertBefore(brand, header.firstChild);
        }
        if (logo && logo.parentNode !== brand) {
            brand.appendChild(logo);
        }

        var start = header.querySelector(".site-header-start");
        if (start) {
            if (!logo) {
                logo = start.querySelector(".dz-logo, .dz-logo--compact");
                if (logo && logo.parentNode !== brand) brand.appendChild(logo);
            }
            start.remove();
        }

        var scroll = header.querySelector(".site-header-menu-scroll");
        if (!scroll) {
            scroll = document.createElement("div");
            scroll.className = "site-header-menu-scroll";
            scroll.setAttribute("aria-label", "메뉴");
            if (brand.nextSibling) {
                header.insertBefore(scroll, brand.nextSibling);
            } else {
                header.appendChild(scroll);
            }
        }

        var track = scroll.querySelector(".site-header-menu-scroll-track");
        if (!track) {
            track = document.createElement("div");
            track.className = "site-header-menu-scroll-track";
            scroll.appendChild(track);
        }

        if (nav.parentNode !== track) {
            track.appendChild(nav);
        }
        if (actions && actions.parentNode !== track) {
            track.appendChild(actions);
        }

        header.dataset.headerShell = "2";
    })();

    var DEFAULT_SITE_LOGO = "img/logo.png";
    var DEFAULT_SITE_FAVICON = "img/icon-192.png";

    function applySiteFavicon(href) {
        var links = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
        for (var i = 0; i < links.length; i++) {
            links[i].href = href;
        }
    }

    function syncPwaManifest(logoSrc, companyName) {
        if (window.__thejhonApplyPwaManifest) {
            window.__thejhonApplyPwaManifest(logoSrc, companyName);
        }
    }

    function clearSiteBrandPending() {
        var video = document.querySelector(".home-intro-video");
        if (video) {
            var poster = video.getAttribute("poster") || "";
            if (poster.indexOf("logo.png") >= 0) {
                video.removeAttribute("poster");
            }
            document.documentElement.classList.add("site-brand-video-ready");
        }
        document.documentElement.classList.remove("site-brand-pending", "site-brand-custom");
        if (window.__THEJHON_BRAND_BOOT && window.__THEJHON_BRAND_BOOT.clearPending) {
            window.__THEJHON_BRAND_BOOT.clearPending();
        }
    }

    function markSiteBrandLogoReady() {
        document.documentElement.classList.add(
            "site-brand-active",
            "site-brand-has-logo",
            "site-brand-video-ready"
        );
        document.documentElement.classList.remove("site-brand-pending");
        if (window.__THEJHON_BRAND_BOOT && window.__THEJHON_BRAND_BOOT.markBrandHasLogo) {
            window.__THEJHON_BRAND_BOOT.markBrandHasLogo();
        }
    }

    function applySiteBrandDefaults() {
        var imgs = document.querySelectorAll(".dz-logo-img");
        for (var i = 0; i < imgs.length; i++) {
            imgs[i].src = DEFAULT_SITE_LOGO;
        }
        applySiteFavicon(DEFAULT_SITE_FAVICON);
        syncPwaManifest("", "");
        var links = document.querySelectorAll(".dz-logo, .dz-logo--compact");
        for (var j = 0; j < links.length; j++) {
            links[j].setAttribute("aria-label", "더존 홈");
        }
        clearSiteBrandPending();
        document.documentElement.classList.remove(
            "site-brand-active",
            "site-brand-has-logo",
            "site-brand-hero-ready",
            "site-brand-video-ready"
        );
        applyHomeHeroCompany("");
    }

    function applyHomeHeroCompany(companyName) {
        if (!document.body || !document.body.classList.contains("page-home")) return;
        var el = document.querySelector(".home-intro-copy .company-hero");
        if (!el) return;
        if (!el.dataset.heroDefault) {
            el.dataset.heroDefault = el.textContent.trim();
        }
        var defaultText = el.dataset.heroDefault;
        var name = String(companyName || "").trim();
        el.textContent = name ? defaultText.replace(/더존/g, name) : defaultText;
        if (name) document.documentElement.classList.add("site-brand-hero-ready");
        scheduleFitHomeHeroTitle();
    }

    function fitHomeHeroTitle() {
        var el = document.querySelector(".home-intro-copy .company-hero, #homeHeroTitle");
        if (!el) return;
        var wrap = el.closest(".company-hero-wrap");
        if (!wrap) return;

        el.style.fontSize = "";
        var maxSize = parseFloat(window.getComputedStyle(el).fontSize);
        if (!isFinite(maxSize) || maxSize <= 0) return;

        var available = wrap.clientWidth;
        if (available <= 0) return;

        if (el.scrollWidth <= available) return;

        var minSize = 12;
        var lo = minSize;
        var hi = Math.floor(maxSize);
        var best = minSize;

        while (lo <= hi) {
            var mid = Math.floor((lo + hi) / 2);
            el.style.fontSize = mid + "px";
            if (el.scrollWidth <= available) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        el.style.fontSize = best + "px";
    }

    var fitHomeHeroTitleScheduled = 0;
    function scheduleFitHomeHeroTitle() {
        if (fitHomeHeroTitleScheduled) cancelAnimationFrame(fitHomeHeroTitleScheduled);
        fitHomeHeroTitleScheduled = requestAnimationFrame(function () {
            fitHomeHeroTitleScheduled = 0;
            fitHomeHeroTitle();
        });
    }

    window.__thejhonApplyHomeHeroCompany = applyHomeHeroCompany;
    window.__thejhonFitHomeHeroTitle = fitHomeHeroTitle;

    (function bootHomeHeroTitleFit() {
        if (!document.body || !document.body.classList.contains("page-home")) return;
        var wrap = document.querySelector(".company-hero-wrap");
        if (!wrap || wrap.dataset.heroFitBound === "1") return;
        wrap.dataset.heroFitBound = "1";

        scheduleFitHomeHeroTitle();

        if (typeof ResizeObserver !== "undefined") {
            var ro = new ResizeObserver(function () {
                scheduleFitHomeHeroTitle();
            });
            ro.observe(wrap);
            var copy = document.querySelector(".home-intro-copy");
            if (copy && copy !== wrap) ro.observe(copy);
        }

        window.addEventListener("resize", scheduleFitHomeHeroTitle);
        window.addEventListener("orientationchange", function () {
            setTimeout(scheduleFitHomeHeroTitle, 120);
        });

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(scheduleFitHomeHeroTitle).catch(function () {});
        }
    })();

    (function injectCompactHomeLogo() {
        if (document.body && document.body.classList.contains("page-home")) return;
        var start =
            document.querySelector(".site-header-brand") ||
            document.querySelector(".site-header-start");
        if (!start || start.querySelector(".dz-logo")) return;
        var Auth = window.THEJHON_AUTH;
        var branded = Auth && Auth.usesStaffLogoRole && Auth.usesStaffLogoRole();
        var cached =
            branded && Auth.getCachedStaffLogo ? Auth.getCachedStaffLogo() : "";
        var link = document.createElement("a");
        link.href = "index.html";
        link.className = "dz-logo dz-logo--compact";
        link.setAttribute("aria-label", "더존 홈");
        var img = document.createElement("img");
        if (branded) {
            if (cached) img.src = cached;
            else img.src = DEFAULT_SITE_LOGO;
        } else {
            img.src = DEFAULT_SITE_LOGO;
        }
        img.alt = "";
        img.width = 32;
        img.height = 32;
        img.className = "dz-logo-img";
        link.appendChild(img);
        start.insertBefore(link, start.firstChild);
    })();

    function applyDefaultBrandedLogo(companyName) {
        var imgs = document.querySelectorAll(".dz-logo-img");
        for (var i = 0; i < imgs.length; i++) {
            imgs[i].src = DEFAULT_SITE_LOGO;
        }
        applySiteFavicon(DEFAULT_SITE_FAVICON);
        syncPwaManifest("", companyName || "");
        var label = String(companyName || "").trim()
            ? String(companyName).trim() + " 홈"
            : "더존 홈";
        var links = document.querySelectorAll(".dz-logo, .dz-logo--compact");
        for (var j = 0; j < links.length; j++) {
            links[j].setAttribute("aria-label", label);
        }
        document.documentElement.classList.add("site-brand-active", "site-brand-has-logo", "site-brand-video-ready");
        if (String(companyName || "").trim()) {
            document.documentElement.classList.add("site-brand-hero-ready");
        }
        clearSiteBrandPending();
        markSiteBrandLogoReady();
    }

    function applySiteLogo(logoSrc, companyName) {
        var Auth = window.THEJHON_AUTH;
        var branded = Auth && Auth.usesStaffLogoRole && Auth.usesStaffLogoRole();
        var loggedIn = Auth && Auth.isLoggedIn && Auth.isLoggedIn();
        var custom = String(logoSrc || "").trim();

        if (branded) {
            if (custom) {
                if (Auth.cacheStaffLogo) Auth.cacheStaffLogo(custom, companyName);
                document.documentElement.classList.add("site-brand-active");
                var imgs = document.querySelectorAll(".dz-logo-img");
                for (var i = 0; i < imgs.length; i++) {
                    imgs[i].src = custom;
                }
                applySiteFavicon(custom);
                syncPwaManifest(custom, companyName);
                var label = String(companyName || "").trim()
                    ? String(companyName).trim() + " 홈"
                    : "더존 홈";
                var links = document.querySelectorAll(".dz-logo, .dz-logo--compact");
                for (var j = 0; j < links.length; j++) {
                    links[j].setAttribute("aria-label", label);
                }
                clearSiteBrandPending();
                markSiteBrandLogoReady();
            } else {
                applyDefaultBrandedLogo(companyName);
            }
            return;
        }

        if (loggedIn) {
            applyDefaultBrandedLogo(companyName || "");
            return;
        }

        applySiteBrandDefaults();
    }

    window.__thejhonApplySiteLogo = applySiteLogo;
    window.__thejhonApplyDefaultBrandedLogo = applyDefaultBrandedLogo;

    var AUTH_ICON_HTML = {
        login:
            '<svg class="btn-auth-icon-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
        logout:
            '<svg class="btn-auth-icon-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>'
    };

    function applyAuthIconButton(el, kind) {
        if (!el || el.getAttribute("data-auth-icon") === kind) return;
        el.setAttribute("data-auth-icon", kind);
        el.className = "btn btn-auth-icon btn-" + kind;
        el.setAttribute("aria-label", kind === "login" ? "로그인" : "로그아웃");
        el.title = kind === "login" ? "로그인" : "로그아웃";
        el.innerHTML = AUTH_ICON_HTML[kind];
    }

    (function bootStaffNavMode() {
        if (!window.THEJHON_AUTH) return;
        function run() {
            if (THEJHON_AUTH.applyNavRegisterVisibility) THEJHON_AUTH.applyNavRegisterVisibility();
            else if (THEJHON_AUTH.applyStaffNavMode) THEJHON_AUTH.applyStaffNavMode();
            if (THEJHON_AUTH.syncStaffLogoToHub) THEJHON_AUTH.syncStaffLogoToHub();
        }
        run();
        window.addEventListener("pageshow", run);
        window.addEventListener("thejhon-auth-permissions-updated", run);
    })();

    (function syncHeaderAuthButtons() {
        var actions = document.querySelector(".site-header-actions");
        if (!actions) return;
        var logoutBtn = document.getElementById("btnLogout");
        var loginBtn = document.getElementById("btnLogin");
        if (!loginBtn) {
            loginBtn = document.createElement("a");
            loginBtn.id = "btnLogin";
            loginBtn.href = "login.html";
            loginBtn.className = "header-login-link";
            loginBtn.textContent = "로그인";
            actions.insertBefore(loginBtn, logoutBtn || actions.firstChild);
        }
        if (logoutBtn) applyAuthIconButton(logoutBtn, "logout");
        if (logoutBtn && logoutBtn.dataset.logoutBound !== "1") {
            logoutBtn.dataset.logoutBound = "1";
            logoutBtn.addEventListener("click", function () {
                if (window.THEJHON_AUTH && THEJHON_AUTH.logout) {
                    THEJHON_AUTH.logout();
                } else if (window.THEJHON_AUTH && THEJHON_AUTH.clearSession) {
                    THEJHON_AUTH.clearSession();
                    window.location.replace("login.html");
                }
            });
        }
        function sync() {
            var loggedIn = window.THEJHON_AUTH && THEJHON_AUTH.isLoggedIn();
            if (logoutBtn) logoutBtn.hidden = !loggedIn;
            if (loginBtn) loginBtn.hidden = !!loggedIn;
        }
        sync();
        function syncAll() {
            sync();
            if (window.__thejhonRefreshHeaderCompany) window.__thejhonRefreshHeaderCompany();
            if (window.__thejhonRefreshFooterCompany) window.__thejhonRefreshFooterCompany();
            refreshVendorCartNav();
            if (window.THEJHON_AUTH && THEJHON_AUTH.applyNavRegisterVisibility) {
                THEJHON_AUTH.applyNavRegisterVisibility();
            }
            if (window.THEJHON_AUTH && THEJHON_AUTH.syncStaffLogoToHub) {
                THEJHON_AUTH.syncStaffLogoToHub();
            }
        }
        syncAll();
        window.addEventListener("pageshow", syncAll);
    })();

    (function syncHeaderCompanyName() {
        var header = document.querySelector(".site-header");
        var actions = document.querySelector(".site-header-actions");
        if (!header || !actions) return;

        var elWide = document.getElementById("headerCompanyName");
        if (!elWide) {
            elWide = document.createElement("p");
            elWide.id = "headerCompanyName";
            elWide.className = "header-session-company header-session-company--wide";
            elWide.setAttribute("aria-live", "polite");
            var todayEl = document.getElementById("headerToday");
            if (todayEl) actions.insertBefore(elWide, todayEl);
            else actions.insertBefore(elWide, actions.firstChild);
        }

        var elMobile = document.getElementById("headerCompanyNameMobile");
        if (!elMobile) {
            elMobile = document.createElement("p");
            elMobile.id = "headerCompanyNameMobile";
            elMobile.className = "header-session-company header-session-company--mobile";
            elMobile.setAttribute("aria-live", "polite");
            header.appendChild(elMobile);
        }

        function ping() {
            var text = "";
            var loggedIn = window.THEJHON_AUTH && THEJHON_AUTH.isLoggedIn && THEJHON_AUTH.isLoggedIn();
            if (
                loggedIn &&
                window.THEJHON_AUTH &&
                typeof THEJHON_AUTH.getLoggedInCompanyDisplayName === "function"
            ) {
                text = THEJHON_AUTH.getLoggedInCompanyDisplayName() || "";
            }
            var narrow = false;
            try {
                narrow = window.matchMedia("(max-width: 720px)").matches;
            } catch (e) {
                narrow = window.innerWidth <= 720;
            }
            /* 721px 이상: 날짜 왼쪽(와이드) / 720px 이하: 메뉴 아래(모바일) */
            var wide = !narrow;

            if (text && wide) {
                elWide.textContent = text;
                elWide.classList.add("header-session-company--show");
            } else {
                elWide.textContent = "";
                elWide.classList.remove("header-session-company--show");
            }

            if (text && narrow) {
                elMobile.textContent = text;
                elMobile.classList.add("header-session-company--show");
                header.classList.add("header-has-company-mobile");
            } else {
                elMobile.textContent = "";
                elMobile.classList.remove("header-session-company--show");
                header.classList.remove("header-has-company-mobile");
            }
        }
        ping();
        window.__thejhonRefreshHeaderCompany = ping;
        window.addEventListener("pageshow", ping);
        window.addEventListener("thejhon-auth-permissions-updated", ping);
        var mq720 = window.matchMedia("(max-width: 720px)");
        if (mq720.addEventListener) {
            mq720.addEventListener("change", ping);
        } else if (mq720.addListener) {
            mq720.addListener(ping);
        }
    })();

    (function initHeaderToday() {
        var todayEl = document.getElementById("headerToday");
        if (!todayEl || todayEl.dataset.dateBound === "1") return;
        todayEl.dataset.dateBound = "1";
        var now = new Date();
        todayEl.dateTime = now.toISOString().slice(0, 10);
        todayEl.textContent = now.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long"
        });
    })();

    var SITE_FOOTER_INNER_HTML =
        '<div class="site-footer-inner">' +
        '<dl class="site-footer-grid">' +
        '<div class="site-footer-item"><dt>상호</dt><dd>(주)더존</dd></div>' +
        '<div class="site-footer-item"><dt>대표</dt><dd>이상범</dd></div>' +
        '<div class="site-footer-item"><dt>휴대폰</dt><dd><a class="footer-tel" href="tel:+821029288196">010-2928-8196</a></dd></div>' +
        '<div class="site-footer-item"><dt>이메일</dt><dd><a href="mailto:leesb0129@daum.net">leesb0129@daum.net</a></dd></div>' +
        '<div class="site-footer-item"><dt>전화</dt><dd><a class="footer-tel" href="tel:+82326665255">032-666-5255</a></dd></div>' +
        '<div class="site-footer-item"><dt>팩스</dt><dd>032-662-5246</dd></div>' +
        '<div class="site-footer-item"><dt>사업자등록번호</dt><dd>130-45-32935</dd></div>' +
        '<div class="site-footer-item site-footer-item--full"><dt>주소</dt><dd>경기도 부천시 원미구 부천로 130번길 5, 삼도빌딩 1층</dd></div>' +
        "</dl></div>";

    function ensureUnifiedSiteFooter() {
        var footer = document.querySelector("footer.site-footer");
        if (!footer) return;
        var grid = footer.querySelector(".site-footer-grid");
        if (!grid || grid.querySelectorAll("dt").length < 8) {
            footer.innerHTML = SITE_FOOTER_INNER_HTML;
        }
    }

    (function syncFooterCompanyFromDb() {
        function normalizeLabel(t) {
            return String(t || "").replace(/\s+/g, "").trim();
        }
        function setDdTextByLabel(grid, label, text) {
            if (!grid) return;
            var want = normalizeLabel(label);
            var dts = grid.querySelectorAll("dt");
            for (var i = 0; i < dts.length; i++) {
                var dt = dts[i];
                if (normalizeLabel(dt.textContent) !== want) continue;
                var dd = dt.nextElementSibling;
                if (!dd || dd.tagName !== "DD") return;
                dd.textContent = String(text || "");
                return;
            }
        }
        function setTelByLabel(grid, label, tel) {
            if (!grid) return;
            var want = normalizeLabel(label);
            var dts = grid.querySelectorAll("dt");
            for (var i = 0; i < dts.length; i++) {
                var dt = dts[i];
                if (normalizeLabel(dt.textContent) !== want) continue;
                var dd = dt.nextElementSibling;
                if (!dd || dd.tagName !== "DD") return;
                var a = dd.querySelector("a[href^=\"tel:\"]");
                var txt = String(tel || "");
                if (!txt) return;
                if (!a) {
                    dd.textContent = txt;
                    return;
                }
                a.textContent = txt;
                var digits = txt.replace(/[^0-9+]/g, "");
                if (digits && digits[0] !== "+" && digits.length >= 9) {
                    if (digits.startsWith("0")) digits = "+82" + digits.slice(1);
                }
                a.href = "tel:" + digits;
                return;
            }
        }
        function setMailByLabel(grid, label, email) {
            if (!grid) return;
            var want = normalizeLabel(label);
            var dts = grid.querySelectorAll("dt");
            for (var i = 0; i < dts.length; i++) {
                var dt = dts[i];
                if (normalizeLabel(dt.textContent) !== want) continue;
                var dd = dt.nextElementSibling;
                if (!dd || dd.tagName !== "DD") return;
                var a = dd.querySelector('a[href^="mailto:"]');
                var txt = String(email || "");
                if (!txt) return;
                if (!a) {
                    dd.textContent = txt;
                    return;
                }
                a.textContent = txt;
                a.href = "mailto:" + txt;
                return;
            }
        }

        function applyFromStaff(st) {
            if (!st) return;
            var AuthRef = window.THEJHON_AUTH;
            if (AuthRef && AuthRef.updateBrandFromStaffProfile) {
                AuthRef.updateBrandFromStaffProfile(st);
            }
            var grid = document.querySelector(".site-footer .site-footer-grid");
            if (grid) {
                setDdTextByLabel(grid, "상호", st.st_company || "");
                setDdTextByLabel(grid, "대표", st.st_ceo || "");
                setTelByLabel(grid, "휴대폰", st.st_ceo_tel || "");
                setMailByLabel(grid, "이메일", st.st_email || "");
                setTelByLabel(grid, "전화", st.st_phone || "");
                setDdTextByLabel(grid, "팩스", st.st_fax || "");
                setDdTextByLabel(grid, "사업자등록번호", st.st_biz_no || "");
                setDdTextByLabel(
                    grid,
                    "주소",
                    (window.THEJHON_ADDRESS_FIELDS && THEJHON_ADDRESS_FIELDS.formatFullAddress
                        ? THEJHON_ADDRESS_FIELDS.formatFullAddress(st.st_zip, st.st_addr, st.st_addr_detail)
                        : "") ||
                        st.st_address ||
                        ""
                );
            }
            var sign = document.querySelector(".company-greeting-sign");
            if (sign && st.st_ceo) {
                sign.textContent = "대표 " + st.st_ceo;
            }
            var orgRoot = document.querySelector(".company-org-root");
            if (orgRoot && st.st_company) {
                orgRoot.textContent = st.st_company;
            }
            if (window.THEJHON_COMPANY_GREETING && THEJHON_COMPANY_GREETING.applyForStaff(st)) {
                /* 회사별 인사문·회사소개(우일푸드·에이케이상사 등) */
            } else if (st.st_company) {
                var greetingBody = document.querySelector(".company-greeting-body");
                if (greetingBody && st.st_company) {
                    var defaultCo = "(주)더존";
                    var company = String(st.st_company);
                    var paras = greetingBody.querySelectorAll("p");
                    for (var g = 0; g < paras.length; g++) {
                        var gp = paras[g];
                        if (!gp.dataset.companyGreetingTpl) {
                            gp.dataset.companyGreetingTpl = gp.innerHTML;
                        }
                        gp.innerHTML = gp.dataset.companyGreetingTpl.split(defaultCo).join(company);
                    }
                }
            }
        }

        function run() {
            ensureUnifiedSiteFooter();
            var Auth = window.THEJHON_AUTH;
            var Api = window.THEJHON_API;
            if (!Auth || !Api || !Auth.isLoggedIn || !Auth.isLoggedIn()) {
                applySiteBrandDefaults();
                return;
            }
            var role = Auth.getRole ? Auth.getRole() : "";
            if (role === "guest") {
                applyDefaultBrandedLogo("");
                return;
            }
            if (role !== "admin" && role !== "supervisor" && role !== "vendor") {
                applySiteBrandDefaults();
                return;
            }
            applyHomeHeroCompany(
                Auth.getLoggedInCompanyDisplayName && Auth.getLoggedInCompanyDisplayName()
            );
            if (!Api.getStaffProfile) {
                if (Auth.getCachedStaffLogo && Auth.getCachedStaffLogo()) {
                    applySiteLogo(
                        Auth.getCachedStaffLogo(),
                        Auth.getLoggedInCompanyDisplayName && Auth.getLoggedInCompanyDisplayName()
                    );
                }
                return;
            }
            Api.getStaffProfile()
                .then(applyFromStaff)
                .catch(function () {
                    var brandName =
                        Auth.getLoggedInCompanyDisplayName && Auth.getLoggedInCompanyDisplayName();
                    if (!brandName && Auth.getBrandCompanyDisplayName) {
                        brandName = Auth.getBrandCompanyDisplayName();
                    }
                    applyHomeHeroCompany(brandName);
                    var logo = Auth.getCachedStaffLogo && Auth.getCachedStaffLogo();
                    if (logo) {
                        applySiteLogo(logo, brandName);
                    } else {
                        applyDefaultBrandedLogo(brandName);
                    }
                });
        }

        function bootFooter() {
            ensureUnifiedSiteFooter();
            run();
            if (window.THEJHON_FOOTER_SOCIAL && window.THEJHON_FOOTER_SOCIAL.syncSocialLinks) {
                window.THEJHON_FOOTER_SOCIAL.syncSocialLinks();
            } else if (window.__thejhonRefreshFooterSocial) {
                window.__thejhonRefreshFooterSocial();
            }
        }
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", bootFooter);
        } else {
            bootFooter();
        }
        window.addEventListener("pageshow", bootFooter);
        window.__thejhonRefreshFooterCompany = bootFooter;
    })();

    var mq = window.matchMedia("(max-width: 720px)");
    function narrow() {
        return mq.matches;
    }

    var roots = Array.prototype.slice.call(document.querySelectorAll(".nav-dropdown"));
    if (!roots.length) return;
    var navBar = document.querySelector(".site-header-nav");

    function isWideViewport() {
        return !window.matchMedia("(max-width: 720px)").matches;
    }

    function pageSegment() {
        var path = (window.location.pathname || "").replace(/\\/g, "/");
        return (path.split("/").pop() || "").split("?")[0].toLowerCase();
    }

    function isSupportSectionPage() {
        var seg = pageSegment();
        return seg === "support.html" || seg.indexOf("support-") === 0;
    }

    function isProductManageSectionPage() {
        var seg = pageSegment();
        return (
            seg === "product-manage.html" ||
            seg === "product-register.html" ||
            seg === "product-edit.html" ||
            seg === "product-list-admin.html" ||
            seg === "product-new-register.html" ||
            seg === "product-new-list.html"
        );
    }

    function isVendorManageSectionPage() {
        var seg = pageSegment();
        return (
            seg === "vendor-manage.html" ||
            seg === "vendor-register.html" ||
            seg === "vendor-edit.html" ||
            seg === "vendor-list-admin.html" ||
            seg === "vendor-detail.html" ||
            seg === "vendor-new-register.html" ||
            seg === "vendor-new-list.html" ||
            seg === "vendor-email-broadcast.html" ||
            seg === "vendor-prospect-list.html" ||
            seg === "vendor-prospect-finder.html" ||
            seg === "vendor-excel-import.html" ||
            seg === "order-list-admin.html"
        );
    }

    function syncDropdownChrome() {
        var anyOpen = roots.some(function (r) {
            return r.classList.contains("is-open");
        });
        if (navBar) navBar.classList.toggle("nav-dropdown-open", anyOpen);
        if (!anyOpen || !narrow()) {
            document.documentElement.style.removeProperty("--dz-submenu-gap");
            return;
        }
        var opened = roots.filter(function (r) {
            return r.classList.contains("is-open");
        })[0];
        if (!opened) return;
        void opened.offsetHeight;
        var panel = opened.querySelector(".nav-dropdown-panel");
        var h = panel ? Math.ceil(panel.getBoundingClientRect().height) : 0;
        document.documentElement.style.setProperty("--dz-submenu-gap", h + "px");
    }

    function setOpen(targetRoot, open) {
        var trigger = targetRoot.querySelector(".nav-dropdown-trigger");
        if (!trigger) return;

        if (open) {
            roots.forEach(function (r) {
                if (r === targetRoot) return;
                r.classList.remove("is-open");
                r.classList.remove("nav-dropdown--hover");
                var tr = r.querySelector(".nav-dropdown-trigger");
                if (tr) tr.setAttribute("aria-expanded", "false");
            });
        }

        targetRoot.classList.toggle("is-open", open);
        trigger.setAttribute("aria-expanded", open ? "true" : "false");
        syncDropdownChrome();
    }

    roots.forEach(function (root) {
        var trigger = root.querySelector(".nav-dropdown-trigger");
        if (!trigger) return;
        var kind = (root.getAttribute("data-nav-dropdown") || "").toLowerCase();

        root.addEventListener("mouseenter", function () {
            if (isWideViewport()) root.classList.add("nav-dropdown--hover");
        });
        root.addEventListener("mouseleave", function () {
            if (isWideViewport()) root.classList.remove("nav-dropdown--hover");
        });

        trigger.addEventListener("click", function (e) {
            if (!narrow()) return;
            if (kind === "product-manage" && isProductManageSectionPage()) {
                e.preventDefault();
                setOpen(root, !root.classList.contains("is-open"));
            } else if (kind === "vendor-manage" && isVendorManageSectionPage()) {
                e.preventDefault();
                setOpen(root, !root.classList.contains("is-open"));
            }
        });
    });

    document.addEventListener("click", function (e) {
        if (!narrow()) return;
        var anyOpen = roots.some(function (r) {
            return r.classList.contains("is-open");
        });
        if (!anyOpen) return;
        var inside = roots.some(function (r) {
            return r.contains(e.target);
        });
        if (inside) return;
        roots.forEach(function (r) {
            setOpen(r, false);
        });
    });

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        roots.forEach(function (r) {
            setOpen(r, false);
            r.classList.remove("nav-dropdown--hover");
        });
    });

    function onMqChange() {
        if (!narrow()) {
            roots.forEach(function (r) {
                setOpen(r, false);
            });
        } else {
            roots.forEach(function (r) {
                r.classList.remove("nav-dropdown--hover");
            });
        }
    }
    if (mq.addEventListener) {
        mq.addEventListener("change", onMqChange);
    } else if (mq.addListener) {
        mq.addListener(onMqChange);
    }

    function loadVendorOrderModalAssets(cb) {
        if (!document.getElementById("vendor-order-modal-css")) {
            var link = document.createElement("link");
            link.id = "vendor-order-modal-css";
            link.rel = "stylesheet";
            link.href = "vendor-order-modal.css";
            document.head.appendChild(link);
        }
        function loadScript(src, id, next) {
            if (document.getElementById(id)) {
                next();
                return;
            }
            var s = document.createElement("script");
            s.id = id;
            s.src = src;
            s.onload = next;
            s.onerror = next;
            document.body.appendChild(s);
        }
        loadScript("vendor-cart.js", "script-vendor-cart", function () {
            loadScript("order-ui.js", "script-order-ui", function () {
                loadScript("qty-stepper.js", "script-qty-stepper", function () {
                    loadScript("vendor-order-modal.js", "script-vendor-order-modal", function () {
                        if (cb) cb();
                    });
                });
            });
        });
    }

    window.loadVendorOrderModalAssets = loadVendorOrderModalAssets;

    function refreshVendorCartNav() {
        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;
        var legacyCart = nav.querySelector("a[data-nav-cart]");
        if (legacyCart) legacyCart.remove();
        var manageLink = nav.querySelector("[data-nav-order-manage]");
        var legacyOrderBtn = nav.querySelector("[data-nav-order-btn]");
        if (legacyOrderBtn) legacyOrderBtn.remove();
        var show =
            window.THEJHON_AUTH &&
            THEJHON_AUTH.canPlaceVendorOrders &&
            THEJHON_AUTH.canPlaceVendorOrders();
        if (!show) {
            if (manageLink) manageLink.remove();
            return;
        }

        var productsLink = nav.querySelector('a[href="products.html"]');
        var insertAfter = productsLink && productsLink.nextSibling;

        if (!manageLink) {
            manageLink = document.createElement("a");
            manageLink.href = "cart.html";
            manageLink.className = "header-nav-link";
            manageLink.setAttribute("data-nav-order-manage", "1");
            manageLink.textContent = "주문서 보기";
            if (insertAfter) nav.insertBefore(manageLink, insertAfter);
            else nav.appendChild(manageLink);
        }
        manageLink.textContent = "주문서 보기";
    }
    refreshVendorCartNav();
    window.addEventListener("thejhon-auth-permissions-updated", refreshVendorCartNav);

    (function injectSupportAdminOnlyNav() {
        var panel = document.getElementById("supportSubmenu");
        if (!panel) return;
        var Auth = window.THEJHON_AUTH;
        var admin = Auth && Auth.canManageRegisters && Auth.canManageRegisters();
        var seg = pageSegment();

        var newsEl = document.getElementById("nav-support-news-admin");

        if (!admin) {
            if (newsEl) newsEl.remove();
            return;
        }

        var libLink = panel.querySelector('a[href="support-library.html"]');
        if (!newsEl) {
            newsEl = document.createElement("a");
            newsEl.id = "nav-support-news-admin";
            newsEl.href = "support-news-admin.html";
            newsEl.className = "nav-dropdown-item";
            newsEl.setAttribute("role", "menuitem");
            newsEl.textContent = "최근소식 입력";
        }
        if (libLink) {
            panel.insertBefore(newsEl, libLink);
        } else if (!panel.contains(newsEl)) {
            panel.insertBefore(newsEl, panel.firstChild);
        }

        if (seg === "support-news-admin.html") {
            var items = panel.querySelectorAll(".nav-dropdown-item");
            for (var i = 0; i < items.length; i++) {
                items[i].classList.remove("is-current");
            }
            newsEl.classList.add("is-current");
        } else {
            newsEl.classList.remove("is-current");
        }
    })();

    (function loadFooterSocial() {
        if (!document.querySelector(".site-footer-inner")) return;
        if (document.getElementById("script-footer-social")) {
            if (window.THEJHON_FOOTER_SOCIAL) {
                THEJHON_FOOTER_SOCIAL.mount();
                if (THEJHON_FOOTER_SOCIAL.syncSocialLinks) THEJHON_FOOTER_SOCIAL.syncSocialLinks();
            }
            return;
        }
        var s = document.createElement("script");
        s.id = "script-footer-social";
        s.src = "footer-social.js";
        s.onload = function () {
            if (window.THEJHON_FOOTER_SOCIAL) {
                THEJHON_FOOTER_SOCIAL.mount();
                if (THEJHON_FOOTER_SOCIAL.syncSocialLinks) THEJHON_FOOTER_SOCIAL.syncSocialLinks();
            }
        };
        document.body.appendChild(s);
    })();

    (function loadFooterCompany() {
        if (!document.getElementById("siteFooterCompanyGrid")) return;
        if (document.getElementById("script-footer-company")) {
            if (window.THEJHON_FOOTER_COMPANY) THEJHON_FOOTER_COMPANY.mount();
            return;
        }
        var s2 = document.createElement("script");
        s2.id = "script-footer-company";
        s2.src = "footer-company.js";
        s2.onload = function () {
            if (window.THEJHON_FOOTER_COMPANY) THEJHON_FOOTER_COMPANY.mount();
        };
        document.body.appendChild(s2);
    })();
})();
