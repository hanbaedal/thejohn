(function () {
    var api = window.THEJHON_API;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
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

    function deptLabel(deptId) {
        if (catalog && catalog.getDept) {
            var d = catalog.getDept(deptId);
            if (d && d.label) return d.label;
        }
        return deptId || "사업부문";
    }

    function heroHtml(it) {
        if (it.pd_image) {
            return (
                '<img class="pd-hero-img" src="' +
                escapeHtml(it.pd_image) +
                '" alt="">'
            );
        }
        if (it.pd_has_image) {
            return (
                '<div class="pd-hero-img pd-hero-img--empty" data-pd-cover="' +
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
            '<div class="pd-content">' +
            escapeHtml(it.pd_explain || "") +
            "</div>" +
            "</div></div>" +
            '<div class="pd-below">' +
            contactBlock(it) +
            "</div></article>"
        );
    }

    function loadCoverImages(container) {
        if (!api || !api.get || !container) return;
        container.querySelectorAll("[data-pd-cover]").forEach(function (el) {
            var id = el.getAttribute("data-pd-cover");
            if (!id) return;
            api.get("api/products/" + encodeURIComponent(id) + "/cover")
                .then(function (data) {
                    if (!data || !data.pd_image) {
                        el.textContent = "사진 없음";
                        return;
                    }
                    var wrap = el.closest(".pd-hero-wrap");
                    var img = document.createElement("img");
                    img.className = "pd-hero-img";
                    img.alt = "";
                    img.src = data.pd_image;
                    if (wrap) {
                        wrap.innerHTML = "";
                        wrap.appendChild(img);
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

    function renderFeed(items, focusId, listHref, deptName) {
        var focus = items.find(function (it) {
            return it.id === focusId;
        });
        var titlePlain = focus ? String(focus.pd_name || "상품") : "상품";
        document.title =
            titlePlain.length > 60
                ? titlePlain.slice(0, 57) + "… — 더존"
                : titlePlain + " — 더존";

        var hint =
            items.length > 1
                ? deptName +
                  " 상품 " +
                  items.length +
                  "건 · 위·아래로 스크롤해 다른 상품을 볼 수 있습니다."
                : "";

        root.innerHTML =
            '<div class="pd-feed">' +
            '<div class="pd-feed-toolbar">' +
            '<a class="pd-back-link" href="' +
            escapeHtml(listHref) +
            '">← 사업부문 목록</a>' +
            (hint ? '<p class="pd-feed-hint">' + escapeHtml(hint) + "</p>" : "") +
            "</div>" +
            '<div class="pd-feed-list" role="feed">' +
            items
                .map(function (it) {
                    return articleHtml(it, it.id === focusId);
                })
                .join("") +
            "</div></div>";

        loadCoverImages(root);

        requestAnimationFrame(function () {
            scrollToProduct(focusId);
        });
    }

    function renderSingle(it) {
        renderFeed([it], it.id, productsListHref(it), deptLabel(it.pd_dept));
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
                    renderFeed(list, it.id, listHref, deptLabel(dept));
                });
            })
            .catch(function (err) {
                showMissing((err && err.message) || "상품 정보를 불러오지 못했습니다.");
            });
    }

    render();
})();
