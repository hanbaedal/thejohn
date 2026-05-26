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
        return '<p class="pd-price pd-price-masked">가격: 전화 문의</p>';
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

    function vendorDetailNote(it) {
        if (!window.THEJHON_AUTH || !THEJHON_AUTH.getRole || THEJHON_AUTH.getRole() !== "vendor") {
            return "";
        }
        var listHref = productsListHref(it || currentProduct || {});
        return (
            '<p class="pd-vendor-list-hint">주문은 <a href="' +
            escapeHtml(listHref) +
            '">사업부문 목록</a>에서 <strong>주문 목록에 담기</strong>·<strong>주문하기</strong>를 이용해 주세요.</p>'
        );
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
                var wrap = el.closest(".pd-hero-wrap");
                var img = document.createElement("img");
                img.id = "pd-hero-img";
                img.className = "pd-hero-img";
                img.alt = "";
                img.src = data.pd_image;
                if (wrap) {
                    wrap.innerHTML = "";
                    wrap.appendChild(img);
                } else {
                    el.replaceWith(img);
                }
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

        var listHref = productsListHref(it);

        var imgInner;
        if (it.pd_image) {
            imgInner =
                '<img id="pd-hero-img" class="pd-hero-img" src="' +
                escapeHtml(it.pd_image) +
                '" alt="">';
        } else if (it.pd_has_image) {
            imgInner =
                '<div id="pd-hero-img" class="pd-hero-img pd-hero-img--empty" role="img" aria-label="사진 로딩">사진 불러오는 중…</div>';
        } else {
            imgInner =
                '<div id="pd-hero-img" class="pd-hero-img pd-hero-img--empty" role="img" aria-label="사진 없음">사진 없음</div>';
        }
        var imgBlock = '<div class="pd-hero-wrap">' + imgInner + "</div>";

        var specTxt = String(it.pd_size || "").trim();
        var specHtml =
            '<p class="pd-spec">규격: <strong>' +
            escapeHtml(specTxt || "—") +
            "</strong></p>";

        root.innerHTML =
            '<article class="pd-article">' +
            '<div class="pd-toolbar"><a class="pd-back-link" href="' +
            escapeHtml(listHref) +
            '">← 사업부문 목록</a></div>' +
            '<div class="pd-main">' +
            imgBlock +
            '<div class="pd-summary">' +
            '<h1 class="pd-title">' +
            escapeHtml(it.pd_name || "") +
            "</h1>" +
            '<div class="pd-prices">' +
            priceBlock(it) +
            "</div>" +
            specHtml +
            '<div class="pd-content">' +
            escapeHtml(it.pd_explain || "") +
            "</div>" +
            "</div></div>" +
            '<div class="pd-below">' +
            vendorDetailNote(it) +
            contactBlock(it) +
            "</div></article>";

        if (it.pd_has_image && !it.pd_image) {
            loadCoverImage(it.id);
        }
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
