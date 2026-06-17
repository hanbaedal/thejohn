/**
 * 사업부문 6개 버튼 — 목록(products.html)·상세(product-detail.html) 공통
 * 헤더 + 부문 버튼을 상단 고정(스크롤되지 않음)
 */
(function (global) {
    var catalog = global.THEJHON_PRODUCT_CATALOG;
    var layoutBound = false;

    function normalizeDept(deptId) {
        if (catalog && catalog.normalizeDept) {
            return catalog.normalizeDept(deptId) || "";
        }
        return String(deptId || "").trim();
    }

    function readDeptFromUrl() {
        try {
            var params = new URLSearchParams(global.location.search);
            return normalizeDept(params.get("dept")) || "jeongyuk";
        } catch (ignore) {
            return "jeongyuk";
        }
    }

    function syncActive(nav, deptId) {
        if (!nav) return;
        var active = normalizeDept(deptId) || "jeongyuk";
        var buttons = nav.querySelectorAll(".ps-icon-btn[data-dept]");
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            var on = btn.getAttribute("data-dept") === active;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
        }
    }

    function isCatalogPage() {
        var body = document.body;
        return (
            body &&
            (body.classList.contains("page-products") ||
                body.classList.contains("page-product-detail"))
        );
    }

    function ensureChromeWrap() {
        if (!isCatalogPage()) return null;
        var header = document.querySelector(".site-header");
        var sticky = document.getElementById("ps-catalog-sticky");
        if (!header || !sticky) return null;

        var chrome = document.getElementById("ps-catalog-chrome");
        if (!chrome) {
            chrome = document.createElement("div");
            chrome.id = "ps-catalog-chrome";
            chrome.className = "ps-catalog-chrome";
            header.parentNode.insertBefore(chrome, header);
            chrome.appendChild(header);
            chrome.appendChild(sticky);
        }
        return chrome;
    }

    function measureChromeHeight(chrome) {
        if (!chrome) return 0;
        var h = chrome.offsetHeight;
        if (!h) {
            h = Math.ceil(chrome.getBoundingClientRect().height);
        }
        return h;
    }

    function updateChromeHeight() {
        var chrome = ensureChromeWrap();
        if (!chrome) return;
        var h = measureChromeHeight(chrome);
        if (h > 0) {
            /* 그림자·서브픽셀·폰트 로드 여유 */
            document.documentElement.style.setProperty(
                "--ps-catalog-chrome-h",
                h + 8 + "px"
            );
        }
    }

    function observeChromeResize(chrome, refresh) {
        if (!chrome || typeof ResizeObserver === "undefined") return;
        var ro = new ResizeObserver(refresh);
        ro.observe(chrome);
        var header = chrome.querySelector(".site-header");
        var sticky = chrome.querySelector(".ps-catalog-sticky");
        if (header) ro.observe(header);
        if (sticky) ro.observe(sticky);
    }

    function bindCatalogChromeLayout() {
        if (layoutBound) {
            updateChromeHeight();
            return;
        }
        layoutBound = true;

        function refresh() {
            ensureChromeWrap();
            updateChromeHeight();
        }

        refresh();

        var chrome = document.getElementById("ps-catalog-chrome");
        observeChromeResize(chrome, refresh);

        if (global.document.fonts && global.document.fonts.ready) {
            global.document.fonts.ready.then(refresh).catch(function () {});
        }

        global.addEventListener("resize", refresh);
        global.addEventListener("orientationchange", function () {
            setTimeout(refresh, 120);
        });
        global.addEventListener("pageshow", refresh);
        global.addEventListener("thejhon-auth-permissions-updated", refresh);
        global.addEventListener("load", function () {
            setTimeout(refresh, 0);
            setTimeout(refresh, 150);
            setTimeout(refresh, 400);
        });
    }

    function init(opts) {
        opts = opts || {};
        if (!isCatalogPage()) return;

        bindCatalogChromeLayout();

        var nav = document.getElementById("ps-dept-nav");
        if (!nav) return;

        syncActive(nav, opts.activeDept != null ? opts.activeDept : readDeptFromUrl());

        if (nav.dataset.deptNavBound === "1") return;
        nav.dataset.deptNavBound = "1";

        nav.addEventListener("click", function (e) {
            var btn = e.target.closest(".ps-icon-btn[data-dept]");
            if (!btn || !nav.contains(btn)) return;
            var dept = normalizeDept(btn.getAttribute("data-dept"));
            if (!dept) return;
            if (typeof opts.onSelect === "function") {
                opts.onSelect(dept);
                return;
            }
            global.location.href =
                "products.html?dept=" + encodeURIComponent(dept);
        });
    }

    global.THEJHON_PRODUCTS_DEPT_NAV = {
        init: init,
        setActive: function (deptId) {
            syncActive(document.getElementById("ps-dept-nav"), deptId);
        },
        readDeptFromUrl: readDeptFromUrl,
        normalizeDept: normalizeDept,
        refreshLayout: updateChromeHeight
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            if (isCatalogPage()) bindCatalogChromeLayout();
        });
    } else if (isCatalogPage()) {
        bindCatalogChromeLayout();
    }
})(typeof window !== "undefined" ? window : this);
