(function () {
    var api = window.THEJHON_API;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("ps-root");
    var deptNav = document.getElementById("ps-dept-nav");

    var activeDept = "jeongyuk";
    var loadToken = 0;
    var lastItems = [];
    var lastItemsById = {};
    var lastOrderCardMode = null;
    var coverLoadToken = 0;
    var metaPhaseToken = 0;
    var COVER_BATCH_SIZE = 5;
    var deptItemsCache = Object.create(null);

    function coverCache() {
        return window.THEJHON_PRODUCT_COVER;
    }

    function productCoverSrc(it) {
        if (!it) return "";
        var cache = coverCache();
        if (cache && cache.getCoverSrc) {
            return cache.getCoverSrc(it.id, it.pd_image);
        }
        return String((it && it.pd_image) || "").trim();
    }

    function useOrderCardMode() {
        return !!(
            window.THEJHON_CATALOG_ORDER &&
            THEJHON_CATALOG_ORDER.canShow &&
            THEJHON_CATALOG_ORDER.canShow()
        );
    }

    function needsCoverFetch(items) {
        return (items || []).some(function (it) {
            return it && it.pd_has_image && !String(it.pd_image || "").trim();
        });
    }

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

    function catalogPriceHtml(it) {
        try {
            if (window.THEJHON_AUTH && THEJHON_AUTH.buildCatalogListPriceHtml) {
                return THEJHON_AUTH.buildCatalogListPriceHtml(it, {
                    formatWon: formatWon,
                    escapeHtml: escapeHtml
                });
            }
        } catch (ignore) {}
        return "";
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

    function cardPhotoHtml(it) {
        var stored = it && it.id && lastItemsById[it.id];
        if (stored && stored.pd_image && !it.pd_image) {
            it = Object.assign({}, it, { pd_image: stored.pd_image });
        }
        var cover = productCoverSrc(it);
        if (cover && String(it.pd_image || "").trim()) {
            return (
                '<div class="ps-card-photo-wrap">' +
                '<img class="ps-card-photo" alt="" loading="lazy" decoding="async" src="' +
                escapeHtml(cover) +
                '">' +
                "</div>"
            );
        }
        if (it.pd_has_image) {
            return (
                '<div class="ps-card-photo-wrap">' +
                '<img class="ps-card-photo ps-card-photo--loading" alt="" loading="lazy" decoding="async" data-ps-cover="' +
                escapeHtml(it.id) +
                '">' +
                "</div>"
            );
        }
        return (
            '<span class="ps-card-photo ps-card-photo--empty" aria-hidden="true">사진<br>없음</span>'
        );
    }

    function cardSpecHtml(it) {
        if (it.pd_size && String(it.pd_size).trim()) {
            return escapeHtml(String(it.pd_size).trim());
        }
        return '<span class="ps-card-spec--none">—</span>';
    }

    /** 1단계: 사진·이름·규격만 — 가격·주문은 scheduleListMetaPhase에서 채움 */
    function renderProductCardPhase1(it) {
        var href = "product-detail.html?id=" + encodeURIComponent(it.id);
        var photo = cardPhotoHtml(it);
        var specText = cardSpecHtml(it);
        var useOrderCard = useOrderCardMode();

        if (useOrderCard) {
            return (
                '<li class="ps-card-wrap ps-card-wrap--order">' +
                '<article class="ps-card" data-product-id="' +
                escapeHtml(it.id) +
                '">' +
                '<a class="ps-card-detail-link" href="' +
                escapeHtml(href) +
                '">' +
                '<div class="ps-card-visual">' +
                photo +
                "</div>" +
                '<div class="ps-card-body ps-card-body--top">' +
                '<h2 class="ps-card-title">' +
                escapeHtml(it.pd_name || "") +
                "</h2>" +
                '<p class="ps-card-spec">' +
                specText +
                "</p>" +
                "</div></a>" +
                '<div class="ps-card-body ps-card-body--meta" data-ps-meta-pending></div>' +
                "</article></li>"
            );
        }

        return (
            '<li class="ps-card-wrap"><a class="ps-card-link" href="' +
            escapeHtml(href) +
            '">' +
            '<div class="ps-card-visual">' +
            photo +
            "</div>" +
            '<div class="ps-card-body" data-ps-meta-pending>' +
            '<h2 class="ps-card-title">' +
            escapeHtml(it.pd_name || "") +
            "</h2>" +
            '<p class="ps-card-spec">' +
            specText +
            "</p>" +
            "</div></a></li>"
        );
    }

    function skeletonListHtml() {
        var cards = [];
        for (var i = 0; i < 6; i++) {
            cards.push(
                '<li class="ps-card-wrap"><div class="ps-card-skeleton" aria-hidden="true">' +
                '<div class="ps-card-skeleton__visual"></div>' +
                '<div class="ps-card-skeleton__body"><span></span><span></span></div>' +
                "</div></li>"
            );
        }
        return '<ul class="ps-grid ps-grid--skeleton" role="list">' + cards.join("") + "</ul>";
    }

    function renderProductListPhase1(items) {
        if (!items.length) {
            return '<p class="ps-empty">이 분야에 등록된 상품이 없습니다.</p>';
        }
        return (
            '<ul class="ps-grid" role="list">' +
            items.map(renderProductCardPhase1).join("") +
            "</ul>"
        );
    }

    function scheduleListMetaPhase(phaseToken) {
        function run() {
            if (phaseToken !== metaPhaseToken) return;
            refreshListPricesAndOrders();
        }
        if (typeof requestIdleCallback === "function") {
            requestIdleCallback(run, { timeout: 150 });
        } else {
            setTimeout(run, 0);
        }
    }

    function showCachedDeptIfAny(deptId) {
        if (!Object.prototype.hasOwnProperty.call(deptItemsCache, deptId)) return false;
        showList(deptItemsCache[deptId] || []);
        return true;
    }

    function indexItems(items) {
        lastItems = (items || []).map(function (it) {
            if (!it || !it.id) return it;
            var prev = lastItemsById[it.id];
            if (prev && prev.pd_image && !it.pd_image) {
                return Object.assign({}, it, { pd_image: prev.pd_image });
            }
            return it;
        });
        lastItemsById = {};
        lastItems.forEach(function (it) {
            if (it && it.id) lastItemsById[it.id] = it;
        });
    }

    function bindCatalogOrders() {
        if (!root || !window.THEJHON_CATALOG_ORDER || !THEJHON_CATALOG_ORDER.bind) return;
        root.querySelectorAll(".ps-card[data-product-id]").forEach(function (card) {
            var id = card.getAttribute("data-product-id");
            var it = id && lastItemsById[id];
            if (it) THEJHON_CATALOG_ORDER.bind(card, it);
        });
    }

    function showList(items) {
        if (!root) return;
        try {
            indexItems(items);
            metaPhaseToken += 1;
            var phaseToken = metaPhaseToken;
            root.innerHTML = renderProductListPhase1(items || []);
            lastOrderCardMode = useOrderCardMode();
            if (needsCoverFetch(items)) bindCoverImages();
            scheduleListMetaPhase(phaseToken);
        } catch (e) {
            root.innerHTML =
                '<p class="ps-empty">목록을 표시하는 중 오류가 났습니다. 새로고침해 주세요.</p>';
        }
    }

    function findCardForItem(it) {
        if (!root || !it || !it.id) return null;
        var orderCard = root.querySelector('.ps-card[data-product-id="' + it.id + '"]');
        if (orderCard) return { el: orderCard, mode: "order" };
        var links = root.querySelectorAll(".ps-card-link");
        var want = "product-detail.html?id=" + encodeURIComponent(it.id);
        for (var i = 0; i < links.length; i++) {
            var href = links[i].getAttribute("href") || "";
            if (href === want || href.indexOf("id=" + encodeURIComponent(it.id)) >= 0) {
                return { el: links[i], mode: "link" };
            }
        }
        return null;
    }

    function refreshListPricesAndOrders() {
        if (!root || !lastItems.length) return;
        var orderMode = useOrderCardMode();
        lastItems.forEach(function (it) {
            var hit = findCardForItem(it);
            if (!hit) return;
            var priceHtml = catalogPriceHtml(it);
            if (hit.mode === "order") {
                var meta = hit.el.querySelector(".ps-card-body--meta");
                if (!meta) return;
                var orderHtml =
                    orderMode && window.THEJHON_CATALOG_ORDER
                        ? THEJHON_CATALOG_ORDER.renderSection(it)
                        : "";
                meta.removeAttribute("data-ps-meta-pending");
                meta.innerHTML = priceHtml + orderHtml;
                if (orderHtml && THEJHON_CATALOG_ORDER.bind) {
                    THEJHON_CATALOG_ORDER.bind(hit.el, it);
                }
                return;
            }
            var body = hit.el.querySelector(".ps-card-body");
            if (!body) return;
            var title = body.querySelector(".ps-card-title");
            var spec = body.querySelector(".ps-card-spec");
            body.removeAttribute("data-ps-meta-pending");
            body.innerHTML =
                (title ? title.outerHTML : "") +
                (spec ? spec.outerHTML : "") +
                priceHtml;
        });
        bindCatalogOrders();
    }

    function refreshAfterAuth() {
        if (!lastItems.length) return;
        var mode = useOrderCardMode();
        if (lastOrderCardMode === mode) {
            refreshListPricesAndOrders();
            return;
        }
        showList(lastItems);
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

    function replaceCoverWithEmpty(img) {
        var span = document.createElement("span");
        span.className = "ps-card-photo ps-card-photo--empty";
        span.setAttribute("aria-hidden", "true");
        span.innerHTML = "사진<br>없음";
        img.replaceWith(span);
    }

    function applyCoverToImg(id, src, img) {
        if (!img || !id) return;
        if (src) {
            if (lastItemsById[id]) lastItemsById[id].pd_image = src;
            var cache = coverCache();
            img.src =
                cache && cache.getCoverSrc ? cache.getCoverSrc(id, src) : src;
            img.removeAttribute("data-ps-cover");
            img.classList.remove("ps-card-photo--loading");
        } else {
            replaceCoverWithEmpty(img);
        }
    }

    function bindCoverImages() {
        if (!root || !api) return;
        var ids = [];
        root.querySelectorAll("img[data-ps-cover]").forEach(function (img) {
            var id = img.getAttribute("data-ps-cover");
            if (id) ids.push(id);
        });
        if (!ids.length) return;

        var token = ++coverLoadToken;
        var batchLoader = coverCache();
        if (batchLoader && batchLoader.loadCoversBatched) {
            batchLoader.loadCoversBatched(api, ids, {
                batchSize: COVER_BATCH_SIZE,
                isCancelled: function () {
                    return token !== coverLoadToken;
                },
                onBatch: function (covers, chunk) {
                    if (token !== coverLoadToken) return;
                    chunk.forEach(function (id) {
                        var img = root.querySelector('img[data-ps-cover="' + id + '"]');
                        if (!img) return;
                        var src = covers[id] ? String(covers[id]) : "";
                        applyCoverToImg(id, src, img);
                    });
                }
            });
            return;
        }

        api.getProductCovers(ids)
            .then(function (covers) {
                if (token !== coverLoadToken) return;
                ids.forEach(function (id) {
                    var img = root.querySelector('img[data-ps-cover="' + id + '"]');
                    if (!img) return;
                    var src = covers && covers[id] ? String(covers[id]) : "";
                    applyCoverToImg(id, src, img);
                });
            })
            .catch(function () {});
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
        coverLoadToken += 1;
        var hasListOnScreen = !!root.querySelector(".ps-grid");
        if (!hasListOnScreen) {
            root.innerHTML = skeletonListHtml();
        } else {
            root.classList.add("ps-root--refreshing");
        }

        api.listProducts({ dept: activeDept })
            .then(function (items) {
                if (token !== loadToken) return;
                items = Array.isArray(items) ? items : [];
                deptItemsCache[activeDept] = items;
                root.classList.remove("ps-root--refreshing");
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
                root.classList.remove("ps-root--refreshing");
                root.innerHTML = loadErrorHtml((err && err.message) || "");
                bindRetry();
            });
    }

    function setDept(deptId) {
        if (!catalog || !catalog.normalizeDept(deptId)) return;
        if (deptId === activeDept && lastItems.length) return;
        activeDept = deptId;
        syncDeptActive();
        syncUrl();
        if (!showCachedDeptIfAny(activeDept)) {
            root.innerHTML = skeletonListHtml();
        }
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
    if (!showCachedDeptIfAny(activeDept)) {
        root.innerHTML = skeletonListHtml();
    }
    loadDeptProducts(0);

    window.addEventListener("thejhon-auth-permissions-updated", refreshAfterAuth);
})();
