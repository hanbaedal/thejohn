(function () {
    var api = window.THEJHON_API;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("ps-root");
    var deptNav = document.getElementById("ps-dept-nav");

    var cachedItems = [];
    var activeDept = "jeongyuk";
    var loaded = false;

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatWon(n) {
        var num = Number(n);
        if (!isFinite(num)) return "0";
        return num.toLocaleString("ko-KR") + "원";
    }

    function priceHtml(it) {
        if (window.THEJHON_AUTH && THEJHON_AUTH.buildProductPriceHtml) {
            return THEJHON_AUTH.buildProductPriceHtml(it, {
                mode: "inline",
                formatWon: formatWon,
                escapeHtml: escapeHtml
            });
        }
        return '<span class="ps-price-masked">가격: 비공개</span>';
    }

    function itemDept(it) {
        return catalog ? catalog.normalizeDept(it.pd_dept) : "";
    }

    function itemsForDept(deptId) {
        return cachedItems.filter(function (it) {
            return itemDept(it) === deptId;
        });
    }

    function syncUrl() {
        try {
            var params = new URLSearchParams();
            if (activeDept) params.set("dept", activeDept);
            var q = params.toString();
            history.replaceState({}, "", window.location.pathname + (q ? "?" + q : ""));
        } catch (ignore) {}
    }

    function readUrlState() {
        try {
            var params = new URLSearchParams(window.location.search);
            var dept = catalog ? catalog.normalizeDept(params.get("dept")) : "";
            if (dept) activeDept = dept;
        } catch (ignore) {}
    }

    function syncDeptActive() {
        if (!deptNav) return;
        var buttons = deptNav.querySelectorAll(".ps-icon-btn[data-dept]");
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            var on = btn.getAttribute("data-dept") === activeDept;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
        }
    }

    function renderProductList(items) {
        if (!items.length) {
            return '<p class="ps-empty">이 분야에 등록된 상품이 없습니다.</p>';
        }
        var sorted = items.slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        return (
            '<ul class="ps-grid" role="list">' +
            sorted
                .map(function (it) {
                    var href = "product-detail.html?id=" + encodeURIComponent(it.id);
                    var thumb;
                    if (it.pd_image) {
                        thumb =
                            '<img class="ps-thumb" src="' +
                            escapeHtml(it.pd_image) +
                            '" alt="">';
                    } else if (it.pd_has_image) {
                        thumb =
                            '<span class="ps-thumb ps-thumb--empty" aria-hidden="true">사진</span>';
                    } else {
                        thumb =
                            '<span class="ps-thumb ps-thumb--empty" aria-hidden="true">없음</span>';
                    }
                    var spec = "";
                    if (it.pd_size && String(it.pd_size).trim()) {
                        spec =
                            '<span class="ps-card-spec">규격: ' +
                            escapeHtml(String(it.pd_size).trim()) +
                            "</span>";
                    }
                    return (
                        '<li><a class="ps-card-link" href="' +
                        escapeHtml(href) +
                        '">' +
                        thumb +
                        '<div class="ps-card-text"><h2 class="ps-card-title">' +
                        escapeHtml(it.pd_name || "") +
                        '</h2><p class="ps-card-meta">' +
                        priceHtml(it) +
                        spec +
                        "</p></div></a></li>"
                    );
                })
                .join("") +
            "</ul>"
        );
    }

    function renderContent() {
        if (!root) return;
        if (!loaded) return;
        var items = itemsForDept(activeDept);
        root.innerHTML = renderProductList(items);
    }

    function renderAll() {
        syncDeptActive();
        renderContent();
        syncUrl();
    }

    function setDept(deptId) {
        if (!catalog || !catalog.normalizeDept(deptId)) return;
        activeDept = deptId;
        renderAll();
    }

    function loadErrorHtml(msg) {
        var detail = msg ? escapeHtml(msg) : "";
        return (
            '<p class="ps-empty">상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' +
            (detail ? "<br><small>" + detail + "</small>" : "") +
            "</p>"
        );
    }

    function loadAndRender(attempt) {
        if (!root) return;
        if (!api) {
            root.innerHTML = loadErrorHtml("API 설정(thejhon-api.js)을 불러오지 못했습니다.");
            return;
        }
        readUrlState();
        syncDeptActive();
        if (!loaded) {
            root.innerHTML = '<p class="ps-empty">상품을 불러오는 중…</p>';
        }
        api.listProducts()
            .then(function (items) {
                cachedItems = items || [];
                loaded = true;
                renderAll();
            })
            .catch(function (err) {
                var status = err && err.status;
                var retry = (attempt || 0) < 2 && (status === 503 || !status);
                if (retry) {
                    setTimeout(function () {
                        loadAndRender((attempt || 0) + 1);
                    }, status === 503 ? 2000 : 800);
                    return;
                }
                loaded = false;
                root.innerHTML = loadErrorHtml((err && err.message) || "");
            });
    }

    if (deptNav) {
        deptNav.addEventListener("click", function (e) {
            var btn = e.target.closest(".ps-icon-btn");
            if (!btn || !deptNav.contains(btn)) return;
            setDept(btn.getAttribute("data-dept"));
        });
    }

    loadAndRender();
})();
