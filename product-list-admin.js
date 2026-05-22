(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var filterRoot = document.getElementById("pl-dept-filter");
    var listEl = document.getElementById("pl-list");
    var statusEl = document.getElementById("pl-status");
    var cachedItems = [];
    var filterDept = "";

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function itemDept(it) {
        return catalog ? catalog.normalizeDept(it.pd_dept) : "";
    }

    function filteredItems() {
        if (!filterDept) return cachedItems.slice();
        return cachedItems.filter(function (it) {
            return itemDept(it) === filterDept;
        });
    }

    function renderList() {
        var items = filteredItems().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="am-list-empty">표시할 상품이 없습니다. 사업부문을 바꾸거나 <a href="product-register.html">상품 내용 등록</a>에서 추가해 주세요.</p>';
            return;
        }
        listEl.innerHTML =
            '<ul class="pl-admin-list">' +
            items
                .map(function (it) {
                    var href = "product-detail.html?id=" + encodeURIComponent(it.id);
                    var deptTxt = PF.deptLabel(catalog, itemDept(it));
                    return (
                        '<li><a class="pl-admin-item" href="' +
                        PF.escapeHtml(href) +
                        '"><span class="pl-admin-name">' +
                        PF.escapeHtml(it.pd_name || "(이름 없음)") +
                        '</span><span class="pl-admin-meta">' +
                        PF.escapeHtml(deptTxt || "미지정") +
                        (it.pd_size ? " · " + PF.escapeHtml(String(it.pd_size)) : "") +
                        "</span></a></li>"
                    );
                })
                .join("") +
            "</ul>";
    }

    if (PF && filterRoot && catalog) {
        PF.initDeptPicker({
            catalog: catalog,
            root: filterRoot,
            hiddenInput: document.getElementById("pl-filter-dept"),
            showAll: true,
            onSelect: function (deptId) {
                filterDept = deptId;
                renderList();
            }
        });
    }

    var access = THEJHON_AUTH.getRegisterAccess();
    if (!access.allowed) {
        setStatus(access.reason, true);
        return;
    }
    setStatus("불러오는 중…");
    api.listProducts()
        .then(function (items) {
            cachedItems = items;
            renderList();
            setStatus(
                filterDept
                    ? PF.deptLabel(catalog, filterDept) + " · " + filteredItems().length + "건"
                    : "전체 · " + items.length + "건 (사업부문을 선택하면 필터됩니다)"
            );
        })
        .catch(function (err) {
            setStatus(err.message || "목록을 불러오지 못했습니다.", true);
        });
})();
