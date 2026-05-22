(function () {
    var api = window.THEJHON_API;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("ps-root");
    var deptNav = document.getElementById("ps-dept-nav");
    var groupNav = document.getElementById("ps-group-nav");

    var cachedItems = [];
    var activeDept = "";
    var activeGroup = "";

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
        if (window.THEJHON_AUTH && THEJHON_AUTH.buildProductPriceHtml) {
            return THEJHON_AUTH.buildProductPriceHtml(it, {
                mode: "inline",
                formatWon: formatWon,
                escapeHtml: escapeHtml
            });
        }
        return '<span class="ps-price-masked">가격: 비공개</span>';
    }

    function itemDept(it) {
        return catalog ? catalog.normalizeDept(it.pd_dept) : "";
    }

    function itemGroup(it) {
        var d = itemDept(it);
        return catalog && d ? catalog.normalizeGroup(d, it.pd_group) : "";
    }

    function itemsForDept(deptId) {
        return cachedItems.filter(function (it) {
            return itemDept(it) === deptId;
        });
    }

    function itemsForDeptGroup(deptId, groupId) {
        if (groupId === "_all") {
            return itemsForDept(deptId);
        }
        if (groupId === "_uncategorized") {
            return cachedItems.filter(function (it) {
                var d = itemDept(it);
                var g = itemGroup(it);
                if (!d) return true;
                return d === deptId && !g;
            });
        }
        return cachedItems.filter(function (it) {
            return itemDept(it) === deptId && itemGroup(it) === groupId;
        });
    }

    function coverImageForGroup(deptId, groupId) {
        var list = itemsForDeptGroup(deptId, groupId);
        for (var i = 0; i < list.length; i++) {
            if (list[i].pd_image && String(list[i].pd_image).trim()) {
                return list[i].pd_image;
            }
        }
        return "";
    }

    function syncUrl() {
        try {
            var params = new URLSearchParams();
            if (activeDept) params.set("dept", activeDept);
            if (activeGroup) params.set("group", activeGroup);
            var q = params.toString();
            var url = window.location.pathname + (q ? "?" + q : "");
            history.replaceState({}, "", url);
        } catch (ignore) {}
    }

    function readUrlState() {
        try {
            var params = new URLSearchParams(window.location.search);
            var dept = catalog ? catalog.normalizeDept(params.get("dept")) : "";
            var group = params.get("group") || "";
            if (dept) {
                activeDept = dept;
                if (group === "_all" || group === "_uncategorized") {
                    activeGroup = group;
                } else if (catalog.normalizeGroup(dept, group)) {
                    activeGroup = catalog.normalizeGroup(dept, group);
                } else {
                    activeGroup = "";
                }
            }
        } catch (ignore) {}
    }

    function renderDeptNav() {
        if (!deptNav || !catalog) return;
        deptNav.innerHTML = catalog.DEPARTMENTS.map(function (d) {
            var active = d.id === activeDept ? " is-active" : "";
            return (
                '<li role="presentation">' +
                '<button type="button" class="ps-dept-btn' +
                active +
                '" role="tab" aria-selected="' +
                (active ? "true" : "false") +
                '" data-dept="' +
                escapeHtml(d.id) +
                '">' +
                '<span class="ps-dept-icon" aria-hidden="true">' +
                escapeHtml(d.icon || "📦") +
                "</span>" +
                '<span class="ps-dept-label">' +
                escapeHtml(d.label) +
                "</span></button></li>"
            );
        }).join("");
    }

    function renderGroupNav() {
        if (!groupNav || !catalog || !activeDept) {
            if (groupNav) groupNav.innerHTML = "";
            return;
        }
        var dept = catalog.getDept(activeDept);
        var chips = [
            { id: "_all", label: "전체" },
            { id: "_uncategorized", label: "미분류" }
        ].concat(catalog.getGroups(activeDept));
        groupNav.innerHTML = chips
            .map(function (g) {
                var active = g.id === activeGroup ? " is-active" : "";
                return (
                    '<li role="presentation">' +
                    '<button type="button" class="ps-group-chip' +
                    active +
                    '" role="tab" aria-selected="' +
                    (active ? "true" : "false") +
                    '" data-group="' +
                    escapeHtml(g.id) +
                    '">' +
                    escapeHtml(g.label) +
                    "</button></li>"
                );
            })
            .join("");
    }

    function renderGroupGrid() {
        var groups = catalog.getGroups(activeDept);
        var deptLabel = catalog.getDept(activeDept).label;
        var cards = groups
            .map(function (g) {
                var cover = coverImageForGroup(activeDept, g.id);
                var visual = cover
                    ? '<img src="' + escapeHtml(cover) + '" alt="">'
                    : '<span class="ps-group-card-emoji" aria-hidden="true">' + escapeHtml(catalog.getDept(activeDept).icon || "📦") + "</span>";
                var count = itemsForDeptGroup(activeDept, g.id).length;
                return (
                    '<li><button type="button" class="ps-group-card" data-group="' +
                    escapeHtml(g.id) +
                    '">' +
                    '<div class="ps-group-card-visual">' +
                    visual +
                    "</div>" +
                    '<div class="ps-group-card-text">' +
                    '<p class="ps-group-card-title">' +
                    escapeHtml(g.label) +
                    "</p>" +
                    '<p class="ps-group-card-desc">' +
                    escapeHtml(g.desc || "") +
                    (count ? " · " + count + "개" : "") +
                    "</p></div></button></li>"
                );
            })
            .join("");
        return (
            '<h2 class="ps-section-title">' +
            escapeHtml(deptLabel) +
            " 메뉴 그룹</h2>" +
            '<ul class="ps-group-grid" role="list">' +
            cards +
            "</ul>"
        );
    }

    function renderProductList(items) {
        if (!items.length) {
            return '<p class="ps-empty">이 그룹에 등록된 상품이 없습니다. <a href="product-register.html">상품 내용 등록</a>에서 사업부문을 지정해 추가해 주세요.</p>';
        }
        var sorted = items.slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        return (
            '<ul class="ps-grid" role="list">' +
            sorted
                .map(function (it) {
                    var href = "product-detail.html?id=" + encodeURIComponent(it.id);
                    var imgBlock;
                    if (it.pd_image) {
                        imgBlock =
                            '<img class="ps-card-img" src="' +
                            escapeHtml(it.pd_image) +
                            '" alt="">';
                    } else {
                        imgBlock =
                            '<div class="ps-card-img ps-card-img--empty" role="img" aria-label="사진 없음">사진<br>없음</div>';
                    }
                    var specHtml = "";
                    if (it.pd_size && String(it.pd_size).trim()) {
                        specHtml =
                            '<span class="ps-card-spec">규격: ' + escapeHtml(String(it.pd_size).trim()) + "</span>";
                    }
                    var excerpt = String(it.pd_explain || "").trim();
                    if (excerpt.length > 120) excerpt = excerpt.slice(0, 117) + "…";
                    return (
                        '<li class="ps-card-wrap"><article class="ps-card">' +
                        '<a class="ps-card-link" href="' +
                        escapeHtml(href) +
                        '">' +
                        imgBlock +
                        '<div class="ps-card-body"><h2 class="ps-card-title">' +
                        escapeHtml(it.pd_name || "") +
                        '</h2><p class="ps-card-price">' +
                        priceHtml(it) +
                        specHtml +
                        '</p><p class="ps-card-content ps-hide-scrollbar">' +
                        escapeHtml(excerpt) +
                        "</p></div></a></article></li>"
                    );
                })
                .join("") +
            "</ul>"
        );
    }

    function renderContent() {
        if (!root) return;
        if (!catalog) {
            root.innerHTML = '<p class="ps-empty">메뉴 정보를 불러오지 못했습니다.</p>';
            return;
        }
        if (!cachedItems.length) {
            root.innerHTML =
                '<p class="ps-empty">등록된 상품이 없습니다. <a href="product-register.html">상품 내용 등록</a>에서 상품을 추가해 보세요.</p>';
            return;
        }
        if (!activeDept) {
            activeDept = catalog.DEPARTMENTS[0].id;
        }
        if (!activeGroup) {
            root.innerHTML = renderGroupGrid();
            return;
        }
        var groupLabel = activeGroup;
        if (activeGroup === "_all") groupLabel = "전체";
        else if (activeGroup === "_uncategorized") groupLabel = "미분류";
        else {
            var g = catalog.getGroup(activeDept, activeGroup);
            if (g) groupLabel = g.label;
        }
        var items = itemsForDeptGroup(activeDept, activeGroup);
        root.innerHTML =
            '<h2 class="ps-section-title">' +
            escapeHtml(catalog.getDept(activeDept).label) +
            " · " +
            escapeHtml(groupLabel) +
            "</h2>" +
            renderProductList(items);
    }

    function renderAll() {
        renderDeptNav();
        renderGroupNav();
        renderContent();
        syncUrl();
    }

    function setDept(deptId) {
        if (!catalog.normalizeDept(deptId)) return;
        activeDept = deptId;
        activeGroup = "";
        renderAll();
    }

    function setGroup(groupId) {
        if (!activeDept) return;
        activeGroup = groupId;
        renderAll();
    }

    function loadAndRender() {
        if (!api || !root) return;
        readUrlState();
        if (!activeDept && catalog && catalog.DEPARTMENTS.length) {
            activeDept = catalog.DEPARTMENTS[0].id;
        }
        root.innerHTML = '<p class="ps-empty">상품을 불러오는 중…</p>';
        api.listProducts()
            .then(function (items) {
                cachedItems = items;
                renderAll();
            })
            .catch(function () {
                root.innerHTML =
                    '<p class="ps-empty">상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
            });
    }

    if (deptNav) {
        deptNav.addEventListener("click", function (e) {
            var btn = e.target.closest(".ps-dept-btn");
            if (!btn || !deptNav.contains(btn)) return;
            setDept(btn.getAttribute("data-dept"));
        });
    }

    if (groupNav) {
        groupNav.addEventListener("click", function (e) {
            var btn = e.target.closest(".ps-group-chip");
            if (!btn || !groupNav.contains(btn)) return;
            setGroup(btn.getAttribute("data-group"));
        });
    }

    if (root) {
        root.addEventListener("click", function (e) {
            var card = e.target.closest(".ps-group-card");
            if (!card || !root.contains(card)) return;
            setGroup(card.getAttribute("data-group"));
        });
    }

    loadAndRender();
})();
