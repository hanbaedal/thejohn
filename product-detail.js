(function () {
    var api = window.THEJHON_API;
    var root = document.getElementById("pd-root");

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

    function getIdFromQuery() {
        try {
            var params = new URLSearchParams(window.location.search);
            return params.get("id") || "";
        } catch (e) {
            return "";
        }
    }

    function showMissing() {
        document.title = "상품 상세 — 더존";
        root.innerHTML =
            '<p class="pd-missing">상품을 찾을 수 없습니다. <a href="products.html">사업부문</a>로 돌아가 주세요.</p>';
    }

    function productsListHref(it) {
        var href = "products.html";
        var dept = it.pd_dept && String(it.pd_dept).trim();
        var group = it.pd_group && String(it.pd_group).trim();
        if (dept) {
            href += "?dept=" + encodeURIComponent(dept);
            if (group) href += "&group=" + encodeURIComponent(group);
        }
        return href;
    }

    function renderItem(it) {
        var titlePlain = String(it.pd_name || "상품");
        document.title =
            titlePlain.length > 60 ? titlePlain.slice(0, 57) + "… — 더존" : titlePlain + " — 더존";

        var backEl = document.querySelector(".pd-back a");
        if (backEl) backEl.setAttribute("href", productsListHref(it));

        var imgBlock = it.pd_image
            ? "<img class=\"pd-hero-img\" src=" + JSON.stringify(it.pd_image) + ' alt="">'
            : '<div class="pd-hero-img pd-hero-img--empty" role="img" aria-label="사진 없음">사진 없음</div>';

        var specHtml = "";
        if (it.pd_size && String(it.pd_size).trim()) {
            specHtml =
                '<p class="pd-spec">규격: <strong>' + escapeHtml(String(it.pd_size).trim()) + "</strong></p>";
        }

        root.innerHTML =
            '<article class="pd-article">' +
            imgBlock +
            '<div class="pd-text"><h1 class="pd-title">' +
            escapeHtml(it.pd_name || "") +
            "</h1>" +
            priceBlock(it) +
            specHtml +
            '<div class="pd-content">' +
            escapeHtml(it.pd_explain || "") +
            "</div>" +
            contactBlock(it) +
            "</div></article>";
    }

    function render() {
        if (!root) return;
        var id = getIdFromQuery();
        if (!id) {
            showMissing();
            return;
        }
        if (!api) {
            root.innerHTML = '<p class="pd-missing">API를 사용할 수 없습니다.</p>';
            return;
        }
        root.innerHTML = '<p class="pd-missing">불러오는 중…</p>';
        api.getProduct(id)
            .then(function (it) {
                if (!it) {
                    document.title = "상품 상세 — 더존";
                    root.innerHTML =
                        '<p class="pd-missing">해당 상품이 없거나 삭제되었습니다. <a href="products.html">사업부문</a>로 돌아가 주세요.</p>';
                    return;
                }
                renderItem(it);
            })
            .catch(function () {
                document.title = "상품 상세 — 더존";
                root.innerHTML =
                    '<p class="pd-missing">해당 상품이 없거나 삭제되었습니다. <a href="products.html">사업부문</a>로 돌아가 주세요.</p>';
            });
    }

    render();
})();
