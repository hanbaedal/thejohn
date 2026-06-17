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
        return '<p class="pd-price pd-price-masked">가격: 전화 문의</p>';
    }

    function strField(v) {
        return String(v || "").trim();
    }

    function contactName(it) {
        return strField(it.per_name) || strField(it.pd_registered_by_name);
    }

    function contactPhone(it) {
        return strField(it["per-number"]);
    }

    function contactBlock(it) {
        var name = contactName(it);
        var phone = contactPhone(it);
        var email = strField(it["per-email"]);
        var nameDd = name ? escapeHtml(name) : '<span class="pd-contact-empty">—</span>';
        var phoneDd;
        if (phone) {
            phoneDd =
                '<a class="footer-tel" href="tel:' +
                escapeHtml(phone.replace(/\s/g, "")) +
                '">' +
                escapeHtml(phone) +
                "</a>";
        } else {
            phoneDd = '<span class="pd-contact-empty">—</span>';
        }
        var emailRow = "";
        if (email) {
            emailRow =
                "<dt>이메일</dt><dd><a href=\"mailto:" +
                escapeHtml(email) +
                '">' +
                escapeHtml(email) +
                "</a></dd>";
        }
        return (
            '<dl class="pd-contact">' +
            "<dt>담당자</dt><dd>" +
            nameDd +
            "</dd>" +
            "<dt>연락처</dt><dd>" +
            phoneDd +
            "</dd>" +
            emailRow +
            "</dl>"
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

    function backLinkHtml(listHref) {
        return (
            '<a class="pd-back-link" href="' +
            escapeHtml(listHref) +
            '" aria-label="사업부문 목록으로 돌아가기">' +
            '<span class="pd-back-link__icon" aria-hidden="true">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' +
            "<path d=\"M15 6l-6 6 6 6\"/>" +
            "</svg></span>" +
            '<span class="pd-back-link__text">사업부문</span></a>'
        );
    }

    function orderSectionHtml(it) {
        var cat = window.THEJHON_CATALOG_ORDER;
        if (!cat || !cat.renderSection) return "";
        return cat.renderSection(it);
    }

    function bindDetailOrders(items) {
        var cat = window.THEJHON_CATALOG_ORDER;
        if (!root || !cat || !cat.bind) return;
        (items || []).forEach(function (it) {
            if (!it || !it.id) return;
            var el = document.getElementById("pd-item-" + it.id);
            if (el) cat.bind(el, it);
        });
    }

    function productHasPhoto(it) {
        if (!it) return false;
        return !!(it.pd_has_image || (it.pd_image_count && it.pd_image_count > 0));
    }

    function productCoverSrc(productId, dataUrl) {
        var id = "";
        var raw = "";
        if (productId && typeof productId === "object") {
            id = String(productId.id || "").trim();
            raw = String(
                dataUrl || productId.pd_thumb || productId.pd_image || ""
            ).trim();
        } else {
            id = String(productId || "").trim();
            raw = String(dataUrl || "").trim();
        }
        if (!raw) return "";
        var cache = window.THEJHON_PRODUCT_COVER;
        if (cache && cache.getCoverSrc) {
            return cache.getCoverSrc(id, raw);
        }
        return raw;
    }

    function imageCount(it) {
        if (!it) return 0;
        var n = Number(it.pd_image_count);
        if (isFinite(n) && n > 1) return n;
        if (n === 1) return 1;
        if (Array.isArray(it.pd_images)) {
            var c = it.pd_images.filter(function (u) {
                return String(u || "").trim();
            }).length;
            if (c > 1) return c;
            if (c === 1) return 1;
        }
        return productHasPhoto(it) ? 1 : 0;
    }

    function bindHeroDotIndicators(container) {
        if (!container) return;
        container.querySelectorAll(".pd-hero-gallery").forEach(function (gallery) {
            var scroller = gallery.querySelector(".pd-hero-scroll");
            var dots = gallery.querySelectorAll(".pd-hero-dot");
            if (!scroller || !dots.length) return;
            function sync() {
                var w = scroller.clientWidth || 1;
                var idx = Math.round(scroller.scrollLeft / w);
                if (idx < 0) idx = 0;
                if (idx >= dots.length) idx = dots.length - 1;
                for (var i = 0; i < dots.length; i++) {
                    dots[i].classList.toggle("is-active", i === idx);
                }
            }
            scroller.addEventListener("scroll", sync, { passive: true });
            sync();
        });
    }

    function heroThumbSrc(it, index) {
        if (!it || !productHasPhoto(it)) return "";
        var idx = index || 0;
        if (it.pd_image_cdn && idx === 0) {
            return String(it.pd_image_cdn).trim();
        }
        if (api && api.productImageCdnUrl) {
            var cdnThumb = api.productImageCdnUrl(it.id, "thumb", idx);
            if (cdnThumb) return cdnThumb;
        }
        if (api && api.productThumbUrl) {
            return api.productThumbUrl(it.id, idx);
        }
        if (idx === 0) {
            var thumb = String(it.pd_thumb || "").trim();
            if (thumb && !/^data:/i.test(thumb)) {
                return productCoverSrc(it.id, thumb);
            }
        }
        return "";
    }

    /** 상세 첫 장 — cover.jpg 직접(썸네일→교체 시 좁았다 넓어지는 깜빡임 방지) */
    function heroCoverUrl(it, index) {
        if (!it || !productHasPhoto(it)) return "";
        var idx = index || 0;
        if (api && api.productImageCdnUrl) {
            var cdnCover = api.productImageCdnUrl(it.id, "cover", idx);
            if (cdnCover) return cdnCover;
        }
        if (api && api.productCoverUrl) {
            return api.productCoverUrl(it.id, idx);
        }
        if (idx === 0) {
            return productCoverSrc(it.id, it.pd_image);
        }
        return "";
    }

    function heroSlideHtml(it, index, isCurrent) {
        var eager = isCurrent && index === 0 ? ' fetchpriority="high"' : "";
        if (isCurrent) {
            var coverDirect = heroCoverUrl(it, index);
            if (coverDirect) {
                return (
                    '<div class="pd-hero-slide">' +
                    '<img class="pd-hero-img" src="' +
                    escapeHtml(coverDirect) +
                    '" alt="상품 사진 ' +
                    (index + 1) +
                    '" decoding="async"' +
                    eager +
                    "></div>"
                );
            }
        }
        var thumbSrc = heroThumbSrc(it, index);
        if (thumbSrc) {
            return (
                '<div class="pd-hero-slide">' +
                '<img class="pd-hero-img" src="' +
                escapeHtml(thumbSrc) +
                '" data-pd-full-cover="' +
                escapeHtml(it.id) +
                '" data-pd-cover-index="' +
                String(index) +
                '" alt="상품 사진 ' +
                (index + 1) +
                '" decoding="async"' +
                eager +
                "></div>"
            );
        }
        var cover = index === 0 ? productCoverSrc(it.id, it.pd_image) : "";
        if (cover) {
            return (
                '<div class="pd-hero-slide">' +
                '<img class="pd-hero-img" src="' +
                escapeHtml(cover) +
                '" alt="상품 사진" decoding="async"></div>'
            );
        }
        if (api && api.productCoverUrl) {
            return (
                '<div class="pd-hero-slide">' +
                '<img class="pd-hero-img" src="' +
                escapeHtml(api.productCoverUrl(it.id, index)) +
                '" alt="상품 사진 ' +
                (index + 1) +
                '" decoding="async"></div>'
            );
        }
        return (
            '<div class="pd-hero-slide">' +
            '<div class="pd-hero-img pd-hero-img--empty" role="img" aria-label="사진 로딩">사진 불러오는 중…</div>' +
            "</div>"
        );
    }

    /** 현재 상품: cover.jpg 직접 / 피드 다른 상품: 썸네일(아래·스크롤 시 cover 교체) */
    function heroHtml(it, isCurrent) {
        var count = imageCount(it);
        if (!count) {
            var legacy = String(it.pd_image || "").trim();
            if (legacy && !/^data:/i.test(legacy)) {
                return (
                    '<img class="pd-hero-img" src="' +
                    escapeHtml(legacy) +
                    '" alt="" decoding="async">'
                );
            }
            return (
                '<div class="pd-hero-img pd-hero-img--empty" role="img" aria-label="사진 없음">사진 없음</div>'
            );
        }
        var slides = [];
        for (var i = 0; i < count; i++) {
            slides.push(heroSlideHtml(it, i, isCurrent));
        }
        return (
            '<div class="pd-hero-gallery">' +
            '<div class="pd-hero-scroll" role="region" aria-label="상품 사진" tabindex="0">' +
            slides.join("") +
            "</div>" +
            (count > 1 ? heroDotsHtml(count) : "") +
            "</div>"
        );
    }

    function heroDotsHtml(count) {
        var dots = [];
        for (var i = 0; i < count; i++) {
            dots.push(
                '<span class="pd-hero-dot' + (i === 0 ? " is-active" : "") + '"></span>'
            );
        }
        return '<div class="pd-hero-dots" aria-hidden="true">' + dots.join("") + "</div>";
    }

    function articleHtml(it, isCurrent) {
        var specTxt = String(it.pd_size || "").trim();
        var specHtml =
            '<p class="pd-spec">규격: <strong>' +
            escapeHtml(specTxt || "—") +
            "</strong></p>";
        var curClass = isCurrent ? "pd-article is-current" : "pd-article";
        return (
            '<article class="' +
            curClass +
            '" id="pd-item-' +
            escapeHtml(it.id) +
            '" data-product-id="' +
            escapeHtml(it.id) +
            '">' +
            '<div class="pd-main">' +
            '<div class="pd-hero-wrap">' +
            heroHtml(it, isCurrent) +
            "</div>" +
            '<div class="pd-summary">' +
            '<h2 class="pd-title">' +
            escapeHtml(it.pd_name || "") +
            "</h2>" +
            '<div class="pd-prices">' +
            priceBlock(it) +
            "</div>" +
            specHtml +
            contactBlock(it) +
            orderSectionHtml(it) +
            '<div class="pd-content">' +
            escapeHtml(it.pd_explain || "") +
            "</div>" +
            '<div class="pd-actions">' +
            '<button type="button" class="pd-pinfo-row" data-pd-pinfo="' +
            escapeHtml(it.id) +
            '" data-pd-name="' +
            escapeHtml(it.pd_name || "") +
            '">' +
            '<span class="pd-pinfo-row__text">상품 필수 정보</span>' +
            "</button></div>" +
            "</div></div></article>"
        );
    }

    function bindProductInfoButtons(container) {
        var PInfo = window.THEJHON_PRODUCT_INFO;
        if (!PInfo || !PInfo.openReadOnly || !container) return;
        container.querySelectorAll("[data-pd-pinfo]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pid = btn.getAttribute("data-pd-pinfo");
                if (pid) {
                    PInfo.openReadOnly(api, pid, {
                        productName: btn.getAttribute("data-pd-name") || ""
                    });
                }
            });
        });
    }

    function upgradeHeroToCover(img) {
        if (!api || !api.productCoverUrl || !img) return;
        var id = img.getAttribute("data-pd-full-cover");
        if (!id || img.dataset.pdFullLoading === "1") return;
        var idx = parseInt(img.getAttribute("data-pd-cover-index") || "0", 10);
        if (!isFinite(idx) || idx < 0) idx = 0;
        var fullUrl = api.productCoverUrl(id, idx);
        if (!fullUrl) return;
        img.dataset.pdFullLoading = "1";
        var preload = new Image();
        preload.decoding = "async";
        preload.onload = function () {
            if (!document.body.contains(img)) return;
            img.src = fullUrl;
            img.removeAttribute("data-pd-full-cover");
            img.removeAttribute("data-pd-full-loading");
        };
        preload.onerror = function () {
            if (!document.body.contains(img)) return;
            img.removeAttribute("data-pd-full-cover");
            img.removeAttribute("data-pd-full-loading");
        };
        preload.src = fullUrl;
    }

    /** 다중 사진 — 1장은 즉시 cover, 나머지는 스크롤 시 고해상도 교체 */
    function loadFullHeroImages(container) {
        if (!container) return;
        var imgs = container.querySelectorAll("img.pd-hero-img[data-pd-full-cover]");
        if (!imgs.length) return;
        upgradeHeroToCover(imgs[0]);
        if (imgs.length < 2 || typeof IntersectionObserver === "undefined") {
            for (var i = 1; i < imgs.length; i++) {
                upgradeHeroToCover(imgs[i]);
            }
            return;
        }
        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    upgradeHeroToCover(entry.target);
                    observer.unobserve(entry.target);
                });
            },
            { rootMargin: "80px 0px", threshold: 0.01 }
        );
        for (var j = 1; j < imgs.length; j++) {
            observer.observe(imgs[j]);
        }
    }

    function normalizeItem(it) {
        if (!it) return it;
        if (it.pd_thumb && !it.pd_has_image) {
            it.pd_has_image = true;
        }
        if (it.pd_has_image == null && it.pd_image_count == null && (it.pd_image || it.pd_thumb)) {
            it.pd_has_image = true;
            it.pd_image_count = imageCount(it) || 1;
        }
        return it;
    }

    function isCatalogProduct(it) {
        return String((it && it.pd_record_type) || "catalog")
            .trim()
            .toLowerCase() !== "new";
    }

    function mergeFocusIntoList(items, focus) {
        var list = (items || []).slice();
        var idx = -1;
        for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === focus.id) {
                idx = i;
                break;
            }
        }
        if (idx >= 0) {
            list[idx] = Object.assign({}, list[idx], focus);
        } else {
            list.push(focus);
            list.sort(function (a, b) {
                return (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0);
            });
        }
        return list;
    }

    function feedHintHtml() {
        return "";
    }
    function scrollToProduct(id) {
        if (!id) return;
        var el = document.getElementById("pd-item-" + id);
        if (!el) return;
        try {
            el.scrollIntoView({ behavior: "auto", block: "start" });
        } catch (e) {
            el.scrollIntoView(true);
        }
    }

    function bindFeedFocusTracking(focusId) {
        if (!root || typeof IntersectionObserver === "undefined") return;
        var articles = root.querySelectorAll(".pd-article[data-product-id]");
        if (articles.length < 2) return;
        var ratios = new Map();
        var observer = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
                });
                var bestId = focusId;
                var bestRatio = 0;
                articles.forEach(function (article) {
                    var r = ratios.get(article) || 0;
                    if (r > bestRatio) {
                        bestRatio = r;
                        bestId = article.getAttribute("data-product-id");
                    }
                });
                if (!bestId) return;
                articles.forEach(function (article) {
                    article.classList.toggle(
                        "is-current",
                        article.getAttribute("data-product-id") === bestId
                    );
                });
            },
            { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-10% 0px -10% 0px" }
        );
        articles.forEach(function (article) {
            observer.observe(article);
        });
    }

    function renderFeed(items, focusId, listHref) {
        var focus = items.find(function (it) {
            return it.id === focusId;
        });
        var titlePlain = focus ? String(focus.pd_name || "상품") : "상품";
        document.title =
            titlePlain.length > 60
                ? titlePlain.slice(0, 57) + "… — 더존"
                : titlePlain + " — 더존";

        root.innerHTML =
            '<div class="pd-feed">' +
            '<div class="pd-feed-toolbar">' +
            backLinkHtml(listHref) +
            feedHintHtml() +
            "</div>" +
            '<div class="pd-feed-list" role="feed">' +
            items
                .map(function (it) {
                    return articleHtml(it, it.id === focusId);
                })
                .join("") +
            "</div></div>";

        loadFullHeroImages(root);
        bindHeroDotIndicators(root);
        bindProductInfoButtons(root);
        bindDetailOrders(items);
        bindFeedFocusTracking(focusId);
        requestAnimationFrame(function () {
            scrollToProduct(focusId);
        });
    }

    function renderDeptFeed(focus) {
        var listHref = productsListHref(focus);
        var dept = String(focus.pd_dept || "").trim();
        var focusItem = normalizeItem(focus);

        if (!dept || !api) {
            renderFeed([focusItem], focus.id, listHref);
            return Promise.resolve();
        }

        return api
            .listProducts({ dept: dept })
            .then(function (items) {
                items = (items || []).filter(isCatalogProduct).map(normalizeItem);
                items = mergeFocusIntoList(items, focusItem);
                if (!items.length) items = [focusItem];
                renderFeed(items, focus.id, listHref);
            })
            .catch(function () {
                renderFeed([focusItem], focus.id, listHref);
            });
    }

    function initDeptNavForProduct(it) {
        if (!window.THEJHON_PRODUCTS_DEPT_NAV) return;
        if (it && it.pd_dept && THEJHON_PRODUCTS_DEPT_NAV.setActive) {
            THEJHON_PRODUCTS_DEPT_NAV.setActive(it.pd_dept);
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
                normalizeItem(it);
                initDeptNavForProduct(it);
                return renderDeptFeed(it);
            })
            .catch(function (err) {
                showMissing((err && err.message) || "상품 정보를 불러오지 못했습니다.");
            });
    }

    if (window.THEJHON_PRODUCT_INFO && THEJHON_PRODUCT_INFO.ensureModal) {
        THEJHON_PRODUCT_INFO.ensureModal();
    }

    if (window.THEJHON_PRODUCTS_DEPT_NAV && THEJHON_PRODUCTS_DEPT_NAV.init) {
        THEJHON_PRODUCTS_DEPT_NAV.init({
            onSelect: function (dept) {
                window.location.href =
                    "products.html?dept=" + encodeURIComponent(dept);
            }
        });
    }

    render();
})();
