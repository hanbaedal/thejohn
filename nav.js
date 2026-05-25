(function () {
    if (window.THEJHON_AUTH) {
        THEJHON_AUTH.normalizeLegacySession();
        THEJHON_AUTH.enforceRegisterPages();
        THEJHON_AUTH.applyNavRegisterVisibility();
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

    (function injectCompactHomeLogo() {
        if (document.body && document.body.classList.contains("page-home")) return;
        var start =
            document.querySelector(".site-header-brand") ||
            document.querySelector(".site-header-start");
        if (!start || start.querySelector(".dz-logo")) return;
        var link = document.createElement("a");
        link.href = "index.html";
        link.className = "dz-logo dz-logo--compact";
        link.setAttribute("aria-label", "더존 홈");
        var img = document.createElement("img");
        img.src = "img/logo.png";
        img.alt = "";
        img.width = 32;
        img.height = 32;
        img.className = "dz-logo-img";
        link.appendChild(img);
        start.insertBefore(link, start.firstChild);
    })();

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

    (function syncHeaderAuthButtons() {
        var actions = document.querySelector(".site-header-actions");
        if (!actions) return;
        var loginBtn = document.getElementById("btnLogin");
        var logoutBtn = document.getElementById("btnLogout");
        if (logoutBtn) applyAuthIconButton(logoutBtn, "logout");
        if (!loginBtn) {
            loginBtn = document.createElement("a");
            loginBtn.href = "login.html?next=" + encodeURIComponent(window.location.href);
            loginBtn.id = "btnLogin";
            applyAuthIconButton(loginBtn, "login");
            if (logoutBtn) actions.insertBefore(loginBtn, logoutBtn);
            else actions.appendChild(loginBtn);
        } else {
            applyAuthIconButton(loginBtn, "login");
        }
        function sync() {
            var loggedIn = window.THEJHON_AUTH && THEJHON_AUTH.isLoggedIn();
            if (loginBtn) loginBtn.hidden = !!loggedIn;
            if (logoutBtn) logoutBtn.hidden = !loggedIn;
            if (!loggedIn && loginBtn) {
                loginBtn.href = "login.html?next=" + encodeURIComponent(window.location.href);
            }
        }
        sync();
        function syncAll() {
            sync();
            if (window.__thejhonRefreshHeaderCompany) window.__thejhonRefreshHeaderCompany();
            refreshVendorCartNav();
            if (window.THEJHON_AUTH && THEJHON_AUTH.applyNavRegisterVisibility) {
                THEJHON_AUTH.applyNavRegisterVisibility();
            }
            if (
                window.THEJHON_API &&
                THEJHON_API.checkSession &&
                window.THEJHON_AUTH &&
                THEJHON_AUTH.syncVendorGradeFromSessionApi
            ) {
                THEJHON_API.checkSession()
                    .then(function (sess) {
                        THEJHON_AUTH.syncVendorGradeFromSessionApi(sess);
                    })
                    .catch(function () {});
            }
        }
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
            var wide =
                window.THEJHON_AUTH &&
                typeof THEJHON_AUTH.isNotebookViewport === "function" &&
                THEJHON_AUTH.isNotebookViewport();
            var narrow = false;
            try {
                narrow = window.matchMedia("(max-width: 720px)").matches;
            } catch (e) {
                narrow = window.innerWidth <= 720;
            }

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
        var mq1024 = window.matchMedia("(min-width: 1024px)");
        var mq720 = window.matchMedia("(max-width: 720px)");
        if (mq1024.addEventListener) {
            mq1024.addEventListener("change", ping);
            mq720.addEventListener("change", ping);
        } else if (mq1024.addListener) {
            mq1024.addListener(ping);
            mq720.addListener(ping);
        }
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
            if (kind === "support" && isSupportSectionPage()) {
                e.preventDefault();
                setOpen(root, !root.classList.contains("is-open"));
            } else if (kind === "product-manage" && isProductManageSectionPage()) {
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
            loadScript("vendor-order-modal.js", "script-vendor-order-modal", function () {
                if (cb) cb();
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
        var orderBtn = nav.querySelector("[data-nav-order-btn]");
        var show =
            window.THEJHON_AUTH &&
            THEJHON_AUTH.canPlaceVendorOrders &&
            THEJHON_AUTH.canPlaceVendorOrders();
        if (!show) {
            if (manageLink) manageLink.remove();
            if (orderBtn) orderBtn.remove();
            return;
        }

        var productsLink = nav.querySelector('a[href="products.html"]');
        var insertAfter = productsLink && productsLink.nextSibling;

        if (!manageLink) {
            manageLink = document.createElement("a");
            manageLink.href = "cart.html";
            manageLink.className = "header-nav-link";
            manageLink.setAttribute("data-nav-order-manage", "1");
            manageLink.textContent = "주문서 관리";
            if (insertAfter) nav.insertBefore(manageLink, insertAfter);
            else nav.appendChild(manageLink);
            insertAfter = manageLink.nextSibling;
        }
        manageLink.textContent = "주문서 관리";

        if (!orderBtn) {
            orderBtn = document.createElement("button");
            orderBtn.type = "button";
            orderBtn.className = "header-nav-order-btn";
            orderBtn.setAttribute("data-nav-order-btn", "1");
            orderBtn.setAttribute("aria-label", "담은 상품 주문하기");
            if (insertAfter) nav.insertBefore(orderBtn, insertAfter);
            else nav.appendChild(orderBtn);
            orderBtn.addEventListener("click", function () {
                function openModal() {
                    if (
                        window.THEJHON_VENDOR_ORDER_MODAL &&
                        THEJHON_VENDOR_ORDER_MODAL.open
                    ) {
                        THEJHON_VENDOR_ORDER_MODAL.open();
                    }
                }
                if (window.THEJHON_VENDOR_ORDER_MODAL) openModal();
                else loadVendorOrderModalAssets(openModal);
            });
        }

        var Cart = window.THEJHON_VENDOR_CART;
        var n = Cart && Cart.itemCount ? Cart.itemCount(Cart.readCart()) : 0;
        orderBtn.textContent = n > 0 ? "주문하기 (" + n + ")" : "주문하기";
        orderBtn.hidden = false;
    }
    refreshVendorCartNav();
    window.addEventListener("thejhon-cart-updated", refreshVendorCartNav);

    (function injectSupportAdminOnlyNav() {
        var panel = document.getElementById("supportSubmenu");
        if (!panel) return;
        var Auth = window.THEJHON_AUTH;
        var admin = Auth && Auth.canManageRegisters && Auth.canManageRegisters();
        var seg = pageSegment();

        var newsEl = document.getElementById("nav-support-news-admin");
        var inqEl = document.getElementById("nav-support-inquiry-reply");

        if (!admin) {
            if (newsEl) newsEl.remove();
            if (inqEl) inqEl.remove();
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

        if (!inqEl) {
            inqEl = document.createElement("a");
            inqEl.id = "nav-support-inquiry-reply";
            inqEl.href = "support-inquiry-reply.html";
            inqEl.className = "nav-dropdown-item";
            inqEl.setAttribute("role", "menuitem");
            inqEl.textContent = "문의사항 답변";
            panel.appendChild(inqEl);
        }

        if (seg === "support-news-admin.html") {
            var items = panel.querySelectorAll(".nav-dropdown-item");
            for (var i = 0; i < items.length; i++) {
                items[i].classList.remove("is-current");
            }
            newsEl.classList.add("is-current");
        } else if (seg === "support-inquiry-reply.html") {
            var items2 = panel.querySelectorAll(".nav-dropdown-item");
            for (var j = 0; j < items2.length; j++) {
                items2[j].classList.remove("is-current");
            }
            inqEl.classList.add("is-current");
        } else {
            newsEl.classList.remove("is-current");
            inqEl.classList.remove("is-current");
        }
    })();
})();
