(function () {
    if (window.THEJHON_AUTH) {
        THEJHON_AUTH.normalizeLegacySession();
        THEJHON_AUTH.enforceRegisterPages();
        THEJHON_AUTH.applyNavRegisterVisibility();
    }

    (function injectCompactHomeLogo() {
        if (document.body && document.body.classList.contains("page-home")) return;
        var start = document.querySelector(".site-header-start");
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
            if (window.THEJHON_AUTH && THEJHON_AUTH.applyNavRegisterVisibility) {
                THEJHON_AUTH.applyNavRegisterVisibility();
            }
        }
        window.addEventListener("pageshow", syncAll);
    })();

    (function syncHeaderCompanyName() {
        var start = document.querySelector(".site-header-start");
        if (!start) return;
        var el = document.getElementById("headerCompanyName");
        if (!el) {
            el = document.createElement("p");
            el.id = "headerCompanyName";
            el.className = "header-session-company";
            el.setAttribute("aria-live", "polite");
            start.appendChild(el);
        }
        function ping() {
            var text = "";
            if (window.THEJHON_AUTH && typeof THEJHON_AUTH.getLoggedInCompanyDisplayName === "function") {
                text = THEJHON_AUTH.getLoggedInCompanyDisplayName() || "";
            }
            var wide =
                window.THEJHON_AUTH &&
                typeof THEJHON_AUTH.isNotebookViewport === "function" &&
                THEJHON_AUTH.isNotebookViewport();
            if (text && wide) {
                el.textContent = text;
                el.classList.add("header-session-company--show");
            } else {
                el.textContent = "";
                el.classList.remove("header-session-company--show");
            }
        }
        ping();
        var mq1024 = window.matchMedia("(min-width: 1024px)");
        if (mq1024.addEventListener) {
            mq1024.addEventListener("change", ping);
        } else if (mq1024.addListener) {
            mq1024.addListener(ping);
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
            seg === "product-list-admin.html"
        );
    }

    function isVendorManageSectionPage() {
        var seg = pageSegment();
        return (
            seg === "vendor-manage.html" ||
            seg === "vendor-register.html" ||
            seg === "vendor-edit.html"
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
