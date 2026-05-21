(function () {
    var api = window.THEJHON_API;
    var root = document.getElementById("ps-root");
    var lightbox = document.getElementById("ps-lightbox");
    var lightboxImg = document.getElementById("ps-lightbox-img");
    var lightboxClose = document.getElementById("ps-lightbox-close");
    var pageMain = document.getElementById("ps-page-main");

    var cachedItems = [];

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
        if (window.THEJHON_AUTH && THEJHON_AUTH.canSeePrices && !THEJHON_AUTH.canSeePrices()) {
            return '<span class="ps-price-masked">가격: 비공개 (업체 로그인 시 표시)</span>';
        }
        return "<span>" + escapeHtml(formatWon(it.pd_price)) + "</span>";
    }

    function getItemById(id) {
        return cachedItems.filter(function (x) {
            return x.id === id;
        })[0];
    }

    function closeLightbox() {
        if (!lightbox || !lightboxImg) return;
        lightbox.hidden = true;
        lightboxImg.removeAttribute("src");
        lightboxImg.alt = "";
        if (pageMain) pageMain.style.overflow = "";
        document.removeEventListener("keydown", onDocKeydown);
    }

    function onDocKeydown(e) {
        if (e.key === "Escape") {
            e.preventDefault();
            closeLightbox();
        }
    }

    function openLightbox(imageSrc, altText) {
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = imageSrc;
        lightboxImg.alt = altText || "상품 사진";
        lightbox.hidden = false;
        if (pageMain) pageMain.style.overflow = "hidden";
        document.addEventListener("keydown", onDocKeydown);
        if (lightboxClose) lightboxClose.focus();
    }

    function render() {
        if (!root) return;
        var items = cachedItems.slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            root.innerHTML =
                '<p class="ps-empty">등록된 상품이 없습니다. <a href="product-register.html">상품등록</a> 페이지에서 상품을 추가해 보세요.</p>';
            return;
        }
        root.innerHTML =
            '<ul class="ps-grid" role="list">' +
            items
                .map(function (it) {
                    var imgBlock;
                    if (it.pd_image) {
                        imgBlock =
                            '<button type="button" class="ps-card-img-btn" data-ps-zoom=' +
                            JSON.stringify(it.id) +
                            " aria-label=" +
                            JSON.stringify("사진 크게: " + (it.pd_name || "상품")) +
                            "><img class=\"ps-card-img\" src=" +
                            JSON.stringify(it.pd_image) +
                            ' alt=""></button>';
                    } else {
                        imgBlock =
                            '<div class="ps-card-img ps-card-img--empty" role="img" aria-label="사진 없음">사진<br>없음</div>';
                    }
                    var specHtml = "";
                    if (it.pd_size && String(it.pd_size).trim()) {
                        specHtml =
                            '<span class="ps-card-spec">규격: ' + escapeHtml(String(it.pd_size).trim()) + "</span>";
                    }
                    return (
                        '<li class="ps-card-wrap"><article class="ps-card">' +
                        imgBlock +
                        '<div class="ps-card-body"><h2 class="ps-card-title">' +
                        escapeHtml(it.pd_name || "") +
                        '</h2><p class="ps-card-price">' +
                        priceHtml(it) +
                        specHtml +
                        '</p><p class="ps-card-content ps-hide-scrollbar">' +
                        escapeHtml(it.pd_explain || "") +
                        "</p></div></article></li>"
                    );
                })
                .join("") +
            "</ul>";
    }

    function loadAndRender() {
        if (!api || !root) return;
        root.innerHTML = '<p class="ps-empty">상품을 불러오는 중…</p>';
        api.listProducts()
            .then(function (items) {
                cachedItems = items;
                render();
            })
            .catch(function () {
                root.innerHTML =
                    '<p class="ps-empty">상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
            });
    }

    if (root) {
        root.addEventListener("click", function (e) {
            var t = e.target;
            if (!(t instanceof Element)) return;
            var btn = t.closest(".ps-card-img-btn");
            if (!btn || !root.contains(btn)) return;
            var id = btn.getAttribute("data-ps-zoom");
            if (!id) return;
            var it = getItemById(id);
            if (!it || !it.pd_image) return;
            e.preventDefault();
            openLightbox(it.pd_image, String(it.pd_name || ""));
        });
    }

    if (lightbox) {
        lightbox.addEventListener("click", function (e) {
            if (e.target === lightbox) closeLightbox();
        });
    }
    if (lightboxClose) {
        lightboxClose.addEventListener("click", function (e) {
            e.stopPropagation();
            closeLightbox();
        });
    }

    loadAndRender();
})();
