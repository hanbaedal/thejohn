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

    function productCoverSrc(it) {
        if (!it) return "";
        var cache = window.THEJHON_PRODUCT_COVER;
        if (cache && cache.getCoverSrc) {
            return cache.getCoverSrc(it.id, it.pd_image);
        }
        return String((it && it.pd_image) || "").trim();
    }

    /** 사진 1장 — 목록·상세 응답의 pd_image 우선, 없으면 일괄 cover API */
    function heroHtml(it) {
        var cover = productCoverSrc(it);
        if (cover) {
            return (
                '<img class="pd-hero-img" src="' +
                escapeHtml(cover) +
                '" alt="상품 사진" decoding="async">'
            );
        }
        if (productHasPhoto(it)) {
            return (
                '<div class="pd-hero-img pd-hero-img--empty" data-pd-gallery="' +
                escapeHtml(it.id) +
                '" role="img" aria-label="사진 로딩">사진 불러오는 중…</div>'
            );
        }
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
            heroHtml(it) +
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

    function applyGalleryCover(article, el, wrap, src) {
        if (!document.body.contains(article)) return;
        var liveWrap = el.closest(".pd-hero-wrap");
        if (!liveWrap || liveWrap !== wrap) return;
        if (!src) {
            el.textContent = "사진 없음";
            el.classList.add("pd-hero-img--empty");
            return;
        }
        var img = document.createElement("img");
        img.className = "pd-hero-img";
        img.alt = "상품 사진";
        img.decoding = "async";
        var cache = window.THEJHON_PRODUCT_COVER;
        var id = article.getAttribute("data-product-id") || "";
        img.src =
            cache && cache.getCoverSrc ? cache.getCoverSrc(id, src) : src;
        liveWrap.innerHTML = "";
        liveWrap.appendChild(img);
    }

    function loadProductGalleries(container) {
        if (!api || !container) return;
        var pending = [];
        container.querySelectorAll("article[data-product-id]").forEach(function (article) {
            var el = article.querySelector("[data-pd-gallery]");
            if (!el) return;
            var id = article.getAttribute("data-product-id") || el.getAttribute("data-pd-gallery");
            if (!id) return;
            var wrap = el.closest(".pd-hero-wrap");
            if (!wrap || !wrap.contains(el)) return;
            pending.push({ article: article, el: el, wrap: wrap, id: id });
        });
        if (!pending.length) return;
        function applyMap(covers) {
            covers = covers || {};
            pending.forEach(function (row) {
                applyGalleryCover(row.article, row.el, row.wrap, covers[row.id] ? String(covers[row.id]) : "");
            });
        }
        if (api.getProductCovers) {
            api.getProductCovers(
                pending.map(function (row) {
                    return row.id;
                })
            )
                .then(applyMap)
                .catch(function () {
                    applyMap({});
                });
            return;
        }
        pending.forEach(function (row) {
            api.get("api/products/" + encodeURIComponent(row.id) + "/cover")
                .then(function (data) {
                    applyGalleryCover(
                        row.article,
                        row.el,
                        row.wrap,
                        data && data.pd_image ? String(data.pd_image) : ""
                    );
                })
                .catch(function () {
                    applyGalleryCover(row.article, row.el, row.wrap, "");
                });
        });
    }

    function normalizeItem(it) {
        if (!it) return it;
        if (it.pd_has_image == null && it.pd_image_count == null && it.pd_image) {
            it.pd_has_image = true;
            it.pd_image_count = 1;
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

    function feedHintHtml(count) {
        if (!count || count < 2) return "";
        return (
            '<p class="pd-feed-hint">위·아래로 스크롤해 같은 분야의 다른 상품을 볼 수 있습니다.</p>'
        );
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
            feedHintHtml(items.length) +
            "</div>" +
            '<div class="pd-feed-list" role="feed">' +
            items
                .map(function (it) {
                    return articleHtml(it, it.id === focusId);
                })
                .join("") +
            "</div></div>";

        loadProductGalleries(root);
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
        if (!dept) {
            renderFeed([focus], focus.id, listHref);
            return Promise.resolve();
        }
        return api
            .listProducts({ dept: dept, fullExplain: true })
            .then(function (items) {
                items = (items || []).filter(isCatalogProduct).map(normalizeItem);
                items = mergeFocusIntoList(items, focus);
                if (!items.length) items = [focus];
                renderFeed(items, focus.id, listHref);
            })
            .catch(function () {
                renderFeed([focus], focus.id, listHref);
            });
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
                return renderDeptFeed(it);
            })
            .catch(function (err) {
                showMissing((err && err.message) || "상품 정보를 불러오지 못했습니다.");
            });
    }

    if (window.THEJHON_PRODUCT_INFO && THEJHON_PRODUCT_INFO.ensureModal) {
        THEJHON_PRODUCT_INFO.ensureModal();
    }

    render();
})();
