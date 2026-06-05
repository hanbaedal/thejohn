/** 관리 메뉴 드롭다운 · 현재 페이지 표시 (스태프만 상품·업체 관리 노출) */
(function () {
    function pageFile() {
        var path = (location.pathname || "").replace(/\\/g, "/");
        return (path.split("/").pop() || "").split("?")[0].toLowerCase();
    }

    function canShowAdminMenus() {
        var Auth = window.THEJHON_AUTH;
        if (!Auth) return false;
        return !!(Auth.canManageRegisters && Auth.canManageRegisters());
    }

    function productManageHtml() {
        return (
            '<div class="nav-dropdown" data-nav-dropdown="product-manage">' +
            '<a href="product-manage.html" class="header-nav-link nav-dropdown-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="productManageSubmenu">상품관리</a>' +
            '<div id="productManageSubmenu" class="nav-dropdown-panel" role="menu" aria-label="상품관리 하위 메뉴">' +
            '<a href="product-register.html" class="nav-dropdown-item" role="menuitem">상품 등록</a>' +
            '<a href="product-list-admin.html" class="nav-dropdown-item" role="menuitem">상품 리스트</a>' +
            "</div></div>"
        );
    }

    function vendorManageHtml() {
        var orderItem = "";
        var Auth = window.THEJHON_AUTH;
        if (Auth) {
            if (Auth.canShowOrderManageMenu && Auth.canShowOrderManageMenu()) {
                orderItem =
                    '<a href="order-list-admin.html" class="nav-dropdown-item" role="menuitem">주문서관리</a>';
            }
        }
        return (
            '<div class="nav-dropdown" data-nav-dropdown="vendor-manage">' +
            '<a href="vendor-manage.html" class="header-nav-link nav-dropdown-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="vendorManageSubmenu">업체관리</a>' +
            '<div id="vendorManageSubmenu" class="nav-dropdown-panel" role="menu" aria-label="업체관리 하위 메뉴">' +
            '<a href="vendor-register.html" class="nav-dropdown-item" role="menuitem">업체등록</a>' +
            '<a href="vendor-list-admin.html" class="nav-dropdown-item" role="menuitem">업체 리스트</a>' +
            orderItem +
            '<a href="vendor-email-broadcast.html" class="nav-dropdown-item" role="menuitem">이메일 보내기</a>' +
            '<a href="vendor-new-register.html" class="nav-dropdown-item" role="menuitem">신규업체 등록</a>' +
            '<a href="vendor-new-list.html" class="nav-dropdown-item" role="menuitem">신규업체 리스트</a>' +
            '<a href="vendor-prospect-finder.html" class="nav-dropdown-item" data-nav-prospect-finder role="menuitem" hidden>예비 업체 찾기</a>' +
            '<a href="vendor-prospect-list.html" class="nav-dropdown-item" role="menuitem">예비업체 리스트</a>' +
            "</div></div>"
        );
    }

    function markCurrent(nav) {
        var file = pageFile();
        var productPages = {
            "product-manage.html": true,
            "product-register.html": true,
            "product-edit.html": true,
            "product-list-admin.html": true,
            "product-new-register.html": true,
            "product-new-list.html": true
        };
        var vendorPages = {
            "vendor-manage.html": true,
            "vendor-register.html": true,
            "vendor-edit.html": true,
            "vendor-list-admin.html": true,
            "vendor-detail.html": true,
            "vendor-new-register.html": true,
            "vendor-new-list.html": true,
            "vendor-email-broadcast.html": true,
            "vendor-email-history.html": true,
            "vendor-prospect-list.html": true,
            "vendor-prospect-finder.html": true,
            "vendor-excel-import.html": true,
            "order-list-admin.html": true
        };
        var productDrop = nav.querySelector('[data-nav-dropdown="product-manage"]');
        var vendorDrop = nav.querySelector('[data-nav-dropdown="vendor-manage"]');
        if (productDrop && productPages[file]) {
            var tr = productDrop.querySelector(".nav-dropdown-trigger");
            if (tr) tr.classList.add("is-current");
            var item = productDrop.querySelector('a[href="' + file + '"]');
            if (item) item.classList.add("is-current");
        }
        if (vendorDrop && vendorPages[file]) {
            var tr2 = vendorDrop.querySelector(".nav-dropdown-trigger");
            if (tr2) tr2.classList.add("is-current");
            var item2 = vendorDrop.querySelector('a[href="' + file + '"]');
            if (item2) item2.classList.add("is-current");
        }
    }

    function removeAdminNavFromNav(nav) {
        var drops = nav.querySelectorAll(
            '[data-nav-dropdown="product-manage"], [data-nav-dropdown="vendor-manage"]'
        );
        for (var i = 0; i < drops.length; i++) drops[i].remove();

        var links = nav.querySelectorAll(
            'a.header-nav-link[href="product-register.html"],' +
                'a.header-nav-link[href="vendor-register.html"],' +
                'a.header-nav-link[href="product-manage.html"],' +
                'a.header-nav-link[href="vendor-manage.html"]'
        );
        for (var j = 0; j < links.length; j++) {
            if (!links[j].classList.contains("nav-dropdown-item")) links[j].remove();
        }
    }

    function staffManageLinkHtml() {
        var Auth = window.THEJHON_AUTH;
        if (!Auth || !Auth.canManageStaffAccounts || !Auth.canManageStaffAccounts()) {
            return "";
        }
        return '<a href="staff-manage-hub.html" class="header-nav-link">관리자관리</a>';
    }

    function injectStaffManageLink(nav) {
        if (!nav || nav.querySelector('a[href="staff-manage-hub.html"], a[href="staff-manage.html"]')) return;
        var html = staffManageLinkHtml();
        if (!html) return;
        var wrap = document.createElement("div");
        wrap.innerHTML = html;
        var link = wrap.firstChild;
        var support = nav.querySelector('[data-nav-dropdown="support"]');
        if (support) {
            nav.insertBefore(link, support);
        } else {
            nav.appendChild(link);
        }
    }

    function inject() {
        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;

        var Auth = window.THEJHON_AUTH;
        if (Auth && Auth.isStaffRole && Auth.isStaffRole(Auth.getRole && Auth.getRole())) {
            if (Auth.getStaffNavMode && Auth.getStaffNavMode() === "manage-home") {
                if (Auth.applyStaffNavManageHomeTabs) Auth.applyStaffNavManageHomeTabs(nav);
                else if (Auth.applyStaffNavMode) Auth.applyStaffNavMode("manage-home");
                return;
            }
            if (Auth.getStaffNavMode && Auth.getStaffNavMode() === "order") {
                removeAdminNavFromNav(nav);
                if (Auth.applyStaffNavOrderTabs) Auth.applyStaffNavOrderTabs(nav);
                else if (Auth.applyStaffNavMode) Auth.applyStaffNavMode("order");
                return;
            }
            if (Auth.getStaffNavMode && Auth.getStaffNavMode() === "product") {
                removeAdminNavFromNav(nav);
                if (Auth.applyStaffNavProductTabs) Auth.applyStaffNavProductTabs(nav);
                else if (Auth.applyStaffNavMode) Auth.applyStaffNavMode("product");
                return;
            }
            if (Auth.getStaffNavMode && Auth.getStaffNavMode() !== "manage-home") {
                removeAdminNavFromNav(nav);
                if (Auth.applyStaffNavMode) Auth.applyStaffNavMode();
                return;
            }
        }

        injectStaffManageLink(nav);

        var showAdmin = canShowAdminMenus();

        if (!showAdmin) {
            removeAdminNavFromNav(nav);
            if (window.THEJHON_AUTH && THEJHON_AUTH.applyNavRegisterVisibility) {
                THEJHON_AUTH.applyNavRegisterVisibility();
            }
            return;
        }

        if (!nav.querySelector('[data-nav-dropdown="product-manage"]')) {
            var productA = nav.querySelector('a.header-nav-link[href="product-register.html"]');
            if (productA && !productA.classList.contains("nav-dropdown-item")) {
                var wrap = document.createElement("div");
                wrap.innerHTML = productManageHtml();
                productA.replaceWith(wrap.firstChild);
            }
        }
        if (!nav.querySelector('[data-nav-dropdown="vendor-manage"]')) {
            var vendorA = nav.querySelector('a.header-nav-link[href="vendor-register.html"]');
            if (vendorA && !vendorA.classList.contains("nav-dropdown-item")) {
                var wrap2 = document.createElement("div");
                wrap2.innerHTML = vendorManageHtml();
                vendorA.replaceWith(wrap2.firstChild);
            }
        }
        markCurrent(nav);
        if (window.THEJHON_AUTH && THEJHON_AUTH.applyNavRegisterVisibility) {
            THEJHON_AUTH.applyNavRegisterVisibility();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inject);
    } else {
        inject();
    }
})();
