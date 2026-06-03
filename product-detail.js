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

    function heroHtml(it) {
        if (it.pd_image) {
            return (
                '<img class="pd-hero-img" src="' +
                escapeHtml(it.pd_image) +
                '" alt="">'
            );
        }
        if (it.pd_has_image || (it.pd_image_count && it.pd_image_count > 0)) {
            return (
                '<div class="pd-hero-img pd-hero-img--empty" data-pd-gallery="' +
                escapeHtml(it.id) +
                '" role="img" aria-label="사진 로딩">사진 불러오는 중…</div>'
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
            '<button type="button" class="btn btn-secondary pd-btn-pinfo" data-pd-pinfo="' +
            escapeHtml(it.id) +
            '">상품 필수 정보</button>' +
            "</div>" +
            "</div></div></article>"
        );
    }

    function bindProductInfoButtons(container) {
        var PInfo = window.THEJHON_PRODUCT_INFO;
        if (!PInfo || !PInfo.openReadOnly || !container) return;
        container.querySelectorAll("[data-pd-pinfo]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pid = btn.getAttribute("data-pd-pinfo");
                if (pid) PInfo.openReadOnly(api, pid);
            });
        });
    }

    function loadProductGalleries(container) {
        if (!api || !api.get || !container) return;
        container.querySelectorAll("[data-pd-gallery]").forEach(function (el) {
            var id = el.getAttribute("data-pd-gallery");
            if (!id) return;
            api.get("api/products/" + encodeURIComponent(id) + "/images")
                .then(function (data) {
                    var imgs = (data && data.images) || [];
                    if (!imgs.length) {
                        el.textContent = "사진 없음";
                        return;
                    }
                    var wrap = el.closest(".pd-hero-wrap");
                    if (!wrap) return;
                    wrap.innerHTML = "";
                    var scroll = document.createElement("div");
                    scroll.className = "pd-hero-scroll";
                    scroll.setAttribute("role", "region");
                    scroll.setAttribute("aria-label", "상품 사진");
                    imgs.forEach(function (src, i) {
                        var slide = document.createElement("div");
                        slide.className = "pd-hero-slide";
                        var img = document.createElement("img");
                        img.className = "pd-hero-img";
                        img.alt = "상품 사진 " + (i + 1);
                        img.src = src;
                        slide.appendChild(img);
                        scroll.appendChild(slide);
                    });
                    wrap.appendChild(scroll);
                    if (imgs.length > 1) {
                        var hint = document.createElement("p");
                        hint.className = "pd-hero-scroll-hint";
                        hint.textContent = "좌우로 밀어 사진을 넘겨 보세요";
                        wrap.appendChild(hint);
                    }
                })
                .catch(function () {
                    el.textContent = "사진 없음";
                });
        });
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

        requestAnimationFrame(function () {
            scrollToProduct(focusId);
        });
    }

    function renderSingle(it) {
        renderFeed([it], it.id, productsListHref(it));
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
                var dept = it.pd_dept && String(it.pd_dept).trim();
                var listHref = productsListHref(it);
                if (!dept || !api.listProducts) {
                    renderSingle(it);
                    return;
                }
                return api.listProducts({ dept: dept }).then(function (items) {
                    var list = (items || []).filter(function (row) {
                        return row && row.id;
                    });
                    if (!list.length) {
                        renderSingle(it);
                        return;
                    }
                    var found = list.some(function (row) {
                        return row.id === it.id;
                    });
                    if (!found) list.unshift(it);
                    list = list.map(function (row) {
                        if (row.id !== it.id) return row;
                        return Object.assign({}, row, {
                            per_name: it.per_name || row.per_name,
                            "per-number": it["per-number"] || row["per-number"],
                            "per-email": it["per-email"] || row["per-email"],
                            pd_registered_by_name:
                                it.pd_registered_by_name || row.pd_registered_by_name,
                            pd_registered_by: it.pd_registered_by || row.pd_registered_by
                        });
                    });
                    renderFeed(list, it.id, listHref);
                });
            })
            .catch(function (err) {
                showMissing((err && err.message) || "상품 정보를 불러오지 못했습니다.");
            });
    }

    render();
})();
