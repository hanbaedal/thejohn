(function () {
    var api = window.THEJHON_API;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("ps-root");
    var deptNav = document.getElementById("ps-dept-nav");

    var activeDept = "jeongyuk";
    var loadToken = 0;

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
        try {
            if (window.THEJHON_AUTH && THEJHON_AUTH.buildProductPriceHtml) {
                return THEJHON_AUTH.buildProductPriceHtml(it, {
                    mode: "inline",
                    formatWon: formatWon,
                    escapeHtml: escapeHtml
                });
            }
        } catch (ignore) {}
        return '<span class="ps-price-masked">가격: 비공개</span>';
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
        return (
            '<ul class="ps-grid" role="list">' +
            items
                .map(function (it) {
                    var href = "product-detail.html?id=" + encodeURIComponent(it.id);
                    var thumb;
                    if (it.pd_has_image) {
                        thumb =
                            '<img class="ps-thumb ps-thumb--loading" alt="" loading="lazy" data-ps-cover="' +
                            escapeHtml(it.id) +
                            '">';
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
                        '<li class="ps-card-wrap"><a class="ps-card-link" href="' +
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

    function showList(items) {
        if (!root) return;
        try {
            root.innerHTML = renderProductList(items || []);
        } catch (e) {
            root.innerHTML =
                '<p class="ps-empty">목록을 표시하는 중 오류가 났습니다. 새로고침해 주세요.</p>';
        }
    }

    function loadErrorHtml(msg) {
        var detail = msg ? escapeHtml(msg) : "";
        return (
            '<p class="ps-empty">상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' +
            (detail ? "<br><small>" + detail + "</small>" : "") +
            '</p><p class="ps-empty"><button type="button" class="btn btn-primary" id="ps-retry">다시 시도</button></p>'
        );
    }

    function bindRetry() {
        var btn = document.getElementById("ps-retry");
        if (btn) {
            btn.addEventListener("click", function () {
                loadDeptProducts(0);
            });
        }
    }

    function loadDeptProducts(attempt) {
        if (!root) return;
        if (!api) {
            root.innerHTML = loadErrorHtml("API 설정(thejhon-api.js)을 불러오지 못했습니다.");
            return;
        }
        if (!catalog || !catalog.normalizeDept(activeDept)) {
            activeDept = "jeongyuk";
        }

        var token = ++loadToken;
        root.innerHTML = '<p class="ps-empty">상품을 불러오는 중…</p>';

        api.listProducts({ dept: activeDept })
            .then(function (items) {
                if (token !== loadToken) return;
                showList(items);
            })
            .catch(function (err) {
                if (token !== loadToken) return;
                var status = err && err.status;
                var retry = (attempt || 0) < 3 && (status === 503 || status === 502 || !status);
                if (retry) {
                    setTimeout(function () {
                        loadDeptProducts((attempt || 0) + 1);
                    }, status === 503 ? 2500 : 1000);
                    return;
                }
                root.innerHTML = loadErrorHtml((err && err.message) || "");
                bindRetry();
            });
    }

    function setDept(deptId) {
        if (!catalog || !catalog.normalizeDept(deptId)) return;
        activeDept = deptId;
        syncDeptActive();
        syncUrl();
        loadDeptProducts(0);
    }

    if (deptNav) {
        deptNav.addEventListener("click", function (e) {
            var btn = e.target.closest(".ps-icon-btn");
            if (!btn || !deptNav.contains(btn)) return;
            setDept(btn.getAttribute("data-dept"));
        });
    }

    readUrlState();
    syncDeptActive();
    syncUrl();
    function bindCoverImages() {
        if (!root || !api) return;
        root.querySelectorAll("img[data-ps-cover]").forEach(function (img) {
            var id = img.getAttribute("data-ps-cover");
            if (!id) return;
            api.get("api/products/" + encodeURIComponent(id) + "/cover")
                .then(function (data) {
                    if (data && data.pd_image) img.src = data.pd_image;
                })
                .catch(function () {
                    img.replaceWith(
                        (function () {
                            var s = document.createElement("span");
                            s.className = "ps-thumb ps-thumb--empty";
                            s.setAttribute("aria-hidden", "true");
                            s.textContent = "사진";
                            return s;
                        })()
                    );
                });
        });
    }

    var _showList = showList;
    showList = function (items) {
        _showList(items);
        bindCoverImages();
    };

    loadDeptProducts(0);
})();
