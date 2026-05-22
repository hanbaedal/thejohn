(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var filterRoot = document.getElementById("vl-dept-filter");
    var listEl = document.getElementById("vl-list");
    var statusEl = document.getElementById("vl-status");
    var cachedItems = [];
    var filterDept = "";

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function vendorDeptIds(it) {
        var raw = it.vn_depts;
        if (!Array.isArray(raw)) return [];
        return raw.map(function (id) {
            return catalog ? catalog.normalizeDept(id) : String(id || "").trim().toLowerCase();
        });
    }

    function vendorMatchesDept(it, deptId) {
        if (!deptId) return true;
        var ids = vendorDeptIds(it);
        for (var i = 0; i < ids.length; i++) {
            if (ids[i] === deptId) return true;
        }
        return false;
    }

    function vendorDeptLabels(it) {
        var ids = vendorDeptIds(it);
        var labels = [];
        for (var i = 0; i < ids.length; i++) {
            if (!ids[i]) continue;
            var lbl = PF.deptLabel(catalog, ids[i]);
            if (lbl && labels.indexOf(lbl) < 0) labels.push(lbl);
        }
        return labels.join(", ");
    }

    function filteredItems() {
        if (!filterDept) return cachedItems.slice();
        return cachedItems.filter(function (it) {
            return vendorMatchesDept(it, filterDept);
        });
    }

    function renderList() {
        var items = filteredItems().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="am-list-empty">표시할 업체가 없습니다. 사업부문을 바꾸거나 <a href="vendor-register.html">업체 등록</a>에서 추가해 주세요.</p>';
            return;
        }
        listEl.innerHTML =
            '<ul class="vl-admin-list">' +
            items
                .map(function (it) {
                    var href = "vendor-detail.html?id=" + encodeURIComponent(it.id);
                    var deptTxt = vendorDeptLabels(it) || "미지정";
                    var grade = it.vn_grade || "1";
                    return (
                        '<li><a class="vl-admin-item" href="' +
                        PF.escapeHtml(href) +
                        '"><span class="vl-admin-name">' +
                        PF.escapeHtml(it.vn_company || "(이름 없음)") +
                        '</span><span class="vl-admin-meta">' +
                        PF.escapeHtml(deptTxt) +
                        " · 등급 " +
                        PF.escapeHtml(String(grade)) +
                        (it.loginId ? " · " + PF.escapeHtml(String(it.loginId)) : "") +
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
            hiddenInput: document.getElementById("vl-filter-dept"),
            showAll: true,
            onSelect: function (deptId) {
                filterDept = deptId;
                renderList();
                var n = filteredItems().length;
                setStatus(
                    filterDept
                        ? PF.deptLabel(catalog, filterDept) + " · " + n + "건"
                        : "전체 · " + cachedItems.length + "건 (사업부문을 선택하면 필터됩니다)"
                );
            }
        });
    }

    var access =
        window.THEJHON_AUTH && THEJHON_AUTH.getRegisterAccess
            ? THEJHON_AUTH.getRegisterAccess()
            : { allowed: false, reason: "관리자 로그인이 필요합니다." };
    if (!access.allowed) {
        setStatus(access.reason, true);
        return;
    }
    setStatus("불러오는 중…");
    api.listVendors()
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
