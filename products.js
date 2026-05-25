(function () {
    var api = window.THEJHON_API;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("ps-root");
    var deptNav = document.getElementById("ps-dept-nav");

    var cachedItems = [];
    var activeDept = "jeongyuk";

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
            var d = itemDept(it);
            if (!deptId) return !d;
            return d === deptId;
        });
    }

    function syncUrl() {
        try {
            var params = new URLSearchParams();
            if (activeDept) params.set("dept", activeDept);
            var q = params.toString();
            var url = window.location.pathname + (q ? "?" + q : "");
            history.replaceState({}, "", url);
        } catch (ignore) {}
    }

    function readUrlState() {
        try {
            var params = new URLSearchParams(window.location.search);
            var dept = catalog ? catalog.normalizeDept(params.get("dept")) : "";
            if (dept) activeDept = dept;
        } catch (ignore) {}
    }

    function renderDeptNav() {
        if (!deptNav || !catalog) return;
        deptNav.innerHTML = catalog.DEPARTMENTS.map(function (d) {
            var active = d.id === activeDept ? " is-active" : "";
            return (
                '<li role="presentation">' +
                '<button type="button" class="ps-dept-btn' +
                active +
                '" role="tab" aria-selected="' +
                (active ? "true" : "false") +
                '" data-dept="' +
                escapeHtml(d.id) +
                '">' +
                '<span class="ps-dept-icon" aria-hidden="true">' +
                escapeHtml(d.icon || "📦") +
                "</span>" +
                '<span class="ps-dept-label">' +
                escapeHtml(d.label) +
                "</span></button></li>"
            );
        }).join("");
    }

    function renderProductList(items) {
        if (!items.length) {
            return '<p class="ps-empty">이 사업부문에 등록된 상품이 없습니다.</p>';
        }
        var sorted = items.slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        return (
            '<ul class="ps-grid" role="list">' +
            sorted
                .map(function (it) {
                    var href = "product-detail.html?id=" + encodeURIComponent(it.id);
                    var imgBlock;
                    if (it.pd_image) {
                        imgBlock =
                            '<img class="ps-card-img" src="' +
                            escapeHtml(it.pd_image) +
                            '" alt="">';
                    } else if (it.pd_has_image) {
                        imgBlock =
                            '<div class="ps-card-img ps-card-img--empty" role="img" aria-label="사진 있음">사진<br>있음</div>';
                    } else {
                        imgBlock =
                            '<div class="ps-card-img ps-card-img--empty" role="img" aria-label="사진 없음">사진<br>없음</div>';
                    }
                    var specHtml = "";
                    if (it.pd_size && String(it.pd_size).trim()) {
                        specHtml =
                            '<span class="ps-card-spec">규격: ' +
                            escapeHtml(String(it.pd_size).trim()) +
                            "</span>";
                    }
                    var excerpt = String(it.pd_explain || "").trim();
                    if (excerpt.length > 120) excerpt = excerpt.slice(0, 117) + "…";
                    return (
                        '<li class="ps-card-wrap"><article class="ps-card">' +
                        '<a class="ps-card-link" href="' +
                        escapeHtml(href) +
                        '">' +
                        imgBlock +
                        '<div class="ps-card-body"><h2 class="ps-card-title">' +
                        escapeHtml(it.pd_name || "") +
                        '</h2><p class="ps-card-price">' +
                        priceHtml(it) +
                        specHtml +
                        '</p><p class="ps-card-content ps-hide-scrollbar">' +
                        escapeHtml(excerpt) +
                        "</p></div></a></article></li>"
                    );
                })
                .join("") +
            "</ul>"
        );
    }

    function renderContent() {
        if (!root) return;
        if (!catalog) {
            root.innerHTML = '<p class="ps-empty">메뉴 정보를 불러오지 못했습니다.</p>';
            return;
        }
        if (!cachedItems.length) {
            root.innerHTML =
                '<p class="ps-empty">등록된 상품이 없습니다. <a href="product-register.html">상품 내용 등록</a>에서 상품을 추가해 보세요.</p>';
            return;
        }
        if (!activeDept && catalog.DEPARTMENTS.length) {
            activeDept = catalog.DEPARTMENTS[0].id;
        }
        var dept = catalog.getDept(activeDept);
        var items = itemsForDept(activeDept);
        root.innerHTML =
            '<h2 class="ps-section-title">' +
            escapeHtml(dept ? dept.label : "사업부문") +
            " 상품</h2>" +
            renderProductList(items);
    }

    function renderAll() {
        renderDeptNav();
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
        if (!activeDept && catalog && catalog.DEPARTMENTS.length) {
            activeDept = catalog.DEPARTMENTS[0].id;
        }
        root.innerHTML = '<p class="ps-empty">상품을 불러오는 중…</p>';
        api.listProducts()
            .then(function (items) {
                cachedItems = items;
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
                root.innerHTML = loadErrorHtml((err && err.message) || "");
            });
    }

    if (deptNav) {
        deptNav.addEventListener("click", function (e) {
            var btn = e.target.closest(".ps-dept-btn");
            if (!btn || !deptNav.contains(btn)) return;
            setDept(btn.getAttribute("data-dept"));
        });
    }

    loadAndRender();
})();
