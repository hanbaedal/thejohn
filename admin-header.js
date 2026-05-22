/** 관리 메뉴 드롭다운 · 현재 페이지 표시 (nav.js보다 먼저 로드하지 않음) */
(function () {
    function pageFile() {
        var path = (location.pathname || "").replace(/\\/g, "/");
        return (path.split("/").pop() || "").split("?")[0].toLowerCase();
    }

    function productManageHtml() {
        return (
            '<div class="nav-dropdown" data-nav-dropdown="product-manage">' +
            '<a href="product-manage.html" class="header-nav-link nav-dropdown-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="productManageSubmenu">상품관리</a>' +
            '<div id="productManageSubmenu" class="nav-dropdown-panel" role="menu" aria-label="상품관리 하위 메뉴">' +
            '<a href="product-register.html" class="nav-dropdown-item" role="menuitem">상품 내용 등록</a>' +
            '<a href="product-edit.html" class="nav-dropdown-item" role="menuitem">상품 등록 수정</a>' +
            '<a href="product-list-admin.html" class="nav-dropdown-item" role="menuitem">상품 리스트</a>' +
            "</div></div>"
        );
    }

    function vendorManageHtml() {
        return (
            '<div class="nav-dropdown" data-nav-dropdown="vendor-manage">' +
            '<a href="vendor-manage.html" class="header-nav-link nav-dropdown-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="vendorManageSubmenu">업체관리</a>' +
            '<div id="vendorManageSubmenu" class="nav-dropdown-panel" role="menu" aria-label="업체관리 하위 메뉴">' +
            '<a href="vendor-register.html" class="nav-dropdown-item" role="menuitem">업체 등록</a>' +
            '<a href="vendor-edit.html" class="nav-dropdown-item" role="menuitem">업체 수정</a>' +
            "</div></div>"
        );
    }

    function markCurrent(nav) {
        var file = pageFile();
        var productPages = {
            "product-manage.html": true,
            "product-register.html": true,
            "product-edit.html": true,
            "product-list-admin.html": true
        };
        var vendorPages = {
            "vendor-manage.html": true,
            "vendor-register.html": true,
            "vendor-edit.html": true
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

    function inject() {
        var nav = document.querySelector(".site-header-nav");
        if (!nav) return;
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
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inject);
    } else {
        inject();
    }
})();
