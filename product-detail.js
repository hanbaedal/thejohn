(function () {
    var api = window.THEJHON_API;
    var root = document.getElementById("pd-root");
    var currentProduct = null;

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

    function priceBlock(it) {
        if (window.THEJHON_AUTH && THEJHON_AUTH.buildProductPriceHtml) {
            return THEJHON_AUTH.buildProductPriceHtml(it, {
                mode: "detail",
                formatWon: formatWon,
                escapeHtml: escapeHtml
            });
        }
        return '<p class="pd-price pd-price-masked">가격: 비공개</p>';
    }

    function contactBlock(it) {
        var rows = [];
        if (it.per_name) rows.push("<dt>담당자</dt><dd>" + escapeHtml(it.per_name) + "</dd>");
        if (it["per-number"]) {
            rows.push(
                '<dt>전화</dt><dd><a class="footer-tel" href="tel:' +
                    escapeHtml(String(it["per-number"]).replace(/\s/g, "")) +
                    '">' +
                    escapeHtml(it["per-number"]) +
                    "</a></dd>"
            );
        }
        if (it["per-email"]) {
            rows.push(
                '<dt>이메일</dt><dd><a href="mailto:' +
                    escapeHtml(it["per-email"]) +
                    '">' +
                    escapeHtml(it["per-email"]) +
                    "</a></dd>"
            );
        }
        if (!rows.length) return "";
        return '<dl class="pd-contact">' + rows.join("") + "</dl>";
    }

    function orderBlock(it) {
        if (!window.THEJHON_AUTH) return "";
        if (THEJHON_AUTH.getRole && THEJHON_AUTH.getRole() === "vendor") {
            if (!THEJHON_AUTH.canPlaceVendorOrders || !THEJHON_AUTH.canPlaceVendorOrders()) {
                return (
                    '<p class="pd-order-browse-only">이 계정은 <strong>상품 조회</strong>만 가능합니다. ' +
                    "주문·장바구니는 담당 거래처(aksangsa)에 등록된 업체만 이용할 수 있습니다.</p>"
                );
            }
        } else if (!THEJHON_AUTH.canPlaceVendorOrders || !THEJHON_AUTH.canPlaceVendorOrders()) {
            return "";
        }
        var price = THEJHON_AUTH.getVendorUnitPriceForProduct(it);
        return (
            '<section class="pd-order" aria-label="주문">' +
            '<p class="pd-order-hint">수량을 입력한 뒤 장바구니에 담거나 바로 주문할 수 있습니다.</p>' +
            '<div class="pd-order-row">' +
            '<label for="pd-qty">수량</label>' +
            '<input type="number" id="pd-qty" class="pd-qty-input" min="1" value="1" inputmode="numeric">' +
            '<button type="button" class="btn btn-primary" id="pd-add-cart">장바구니 담기</button>' +
            '<a class="btn" href="cart.html" id="pd-go-cart">장바구니 보기</a>' +
            "</div>" +
            '<p class="pd-order-price" id="pd-order-price" data-unit="' +
            escapeHtml(String(price.unitPrice)) +
            '" data-label="' +
            escapeHtml(price.priceLabel) +
            '"></p>' +
            '<p class="pd-order-msg" id="pd-order-msg" role="status" hidden></p>' +
            "</section>"
        );
    }

    function bindOrderHandlers(it) {
        var qtyEl = document.getElementById("pd-qty");
        var addBtn = document.getElementById("pd-add-cart");
        var msgEl = document.getElementById("pd-order-msg");
        var priceEl = document.getElementById("pd-order-price");
        if (!qtyEl || !addBtn || !window.THEJHON_VENDOR_CART) return;

        function unitInfo() {
            if (THEJHON_AUTH.getVendorUnitPriceForProduct) {
                return THEJHON_AUTH.getVendorUnitPriceForProduct(it);
            }
            return { unitPrice: 0, priceLabel: "" };
        }

        function updateLinePreview() {
            if (!priceEl) return;
            var info = unitInfo();
            var q = Math.max(1, parseInt(qtyEl.value, 10) || 1);
            priceEl.textContent =
                (info.priceLabel || "단가") +
                " " +
                formatWon(info.unitPrice) +
                " × " +
                q +
                " = " +
                formatWon((Number(info.unitPrice) || 0) * q);
        }

        qtyEl.addEventListener("input", updateLinePreview);
        updateLinePreview();

        addBtn.addEventListener("click", function () {
            var info = unitInfo();
            var qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
            var res = THEJHON_VENDOR_CART.addItem({
                productId: it.id,
                productName: it.pd_name,
                pd_dept: it.pd_dept,
                pd_size: it.pd_size,
                unitPrice: info.unitPrice,
                priceLabel: info.priceLabel,
                quantity: qty
            });
            if (msgEl) {
                msgEl.hidden = false;
                if (res.ok) {
                    msgEl.className = "pd-order-msg pd-order-msg--ok";
                    msgEl.textContent = "장바구니에 담았습니다.";
                } else {
                    msgEl.className = "pd-order-msg pd-order-msg--err";
                    msgEl.textContent = res.error || "담기 실패";
                }
            }
        });
    }

    function getIdFromQuery() {
        try {
            return new URLSearchParams(window.location.search).get("id") || "";
        } catch (e) {
            return "";
        }
    }

    function showMissing(msg) {
        document.title = "상품 상세 — 더존";
        root.innerHTML =
            '<p class="pd-missing">' +
            escapeHtml(msg || "상품을 찾을 수 없습니다.") +
            ' <a href="products.html">사업부문</a>으로 돌아가 주세요.</p>';
    }

    function productsListHref(it) {
        var dept = it.pd_dept && String(it.pd_dept).trim();
        if (!dept) return "products.html";
        return "products.html?dept=" + encodeURIComponent(dept);
    }

    function loadCoverImage(productId) {
        if (!api || !api.get) return;
        api.get("api/products/" + encodeURIComponent(productId) + "/cover")
            .then(function (data) {
                if (!data || !data.pd_image) return;
                var el = document.getElementById("pd-hero-img");
                if (!el) return;
                if (el.tagName === "IMG") {
                    el.src = data.pd_image;
                    el.classList.remove("pd-hero-img--empty");
                    return;
                }
                var img = document.createElement("img");
                img.id = "pd-hero-img";
                img.className = "pd-hero-img";
                img.alt = "";
                img.src = data.pd_image;
                el.replaceWith(img);
            })
            .catch(function () {
                var el = document.getElementById("pd-hero-img");
                if (el && el.classList) el.textContent = "사진 없음";
            });
    }

    function renderItem(it) {
        currentProduct = it;
        var titlePlain = String(it.pd_name || "상품");
        document.title =
            titlePlain.length > 60 ? titlePlain.slice(0, 57) + "… — 더존" : titlePlain + " — 더존";

        var backEl = document.querySelector(".pd-back a");
        if (backEl) backEl.setAttribute("href", productsListHref(it));

        var imgBlock;
        if (it.pd_image) {
            imgBlock =
                '<img id="pd-hero-img" class="pd-hero-img" src="' +
                escapeHtml(it.pd_image) +
                '" alt="">';
        } else if (it.pd_has_image) {
            imgBlock =
                '<div id="pd-hero-img" class="pd-hero-img pd-hero-img--empty" role="img" aria-label="사진 로딩">사진 불러오는 중…</div>';
        } else {
            imgBlock =
                '<div id="pd-hero-img" class="pd-hero-img pd-hero-img--empty" role="img" aria-label="사진 없음">사진 없음</div>';
        }

        var specHtml = "";
        if (it.pd_size && String(it.pd_size).trim()) {
            specHtml =
                '<p class="pd-spec">규격: <strong>' +
                escapeHtml(String(it.pd_size).trim()) +
                "</strong></p>";
        }

        root.innerHTML =
            '<article class="pd-article">' +
            imgBlock +
            '<div class="pd-text"><h1 class="pd-title">' +
            escapeHtml(it.pd_name || "") +
            "</h1>" +
            priceBlock(it) +
            specHtml +
            orderBlock(it) +
            '<div class="pd-content">' +
            escapeHtml(it.pd_explain || "") +
            "</div>" +
            contactBlock(it) +
            "</div></article>";

        if (it.pd_has_image && !it.pd_image) {
            loadCoverImage(it.id);
        }

        bindOrderHandlers(it);
    }

    function render() {
        if (!root) return;
        var id = getIdFromQuery();
        if (!id) {
            showMissing("상품 ID가 없습니다.");
            return;
        }
        if (!api) {
            showMissing("API를 사용할 수 없습니다.");
            return;
        }
        root.innerHTML = '<p class="pd-missing">불러오는 중…</p>';
        api.getProduct(id)
            .then(function (it) {
                if (!it || !it.id) {
                    showMissing("해당 상품이 없거나 삭제되었습니다.");
                    return;
                }
                renderItem(it);
            })
            .catch(function (err) {
                showMissing((err && err.message) || "상품 정보를 불러오지 못했습니다.");
            });
    }

    render();
})();
