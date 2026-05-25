(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var VA = window.THEJHON_VENDOR_ADMIN;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var filterRoot = document.getElementById("vl-dept-filter");
    var listEl = document.getElementById("vl-list");
    var statusEl = document.getElementById("vl-status");
    var staffFilterWrap = document.getElementById("vl-staff-filter-wrap");
    var staffFilterEl = document.getElementById("vl-staff-filter");
    var cachedItems = [];
    var filterDept = "";
    var filterStaff = "all";

    function vendorRecordType(it) {
        return String((it && it.vn_record_type) || "partner")
            .trim()
            .toLowerCase();
    }

    function isNewVendor(it) {
        return vendorRecordType(it) === "new";
    }

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
        var base = cachedItems.filter(isNewVendor);
        if (!filterDept) return base;
        return base.filter(function (it) {
            return vendorMatchesDept(it, filterDept);
        });
    }

    function registrarSuffix(it) {
        if (!VA || !VA.registeredByMeta) return "";
        var meta = VA.registeredByMeta(it);
        return meta ? " · " + meta : "";
    }

    function renderList() {
        var items = filteredItems().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="am-list-empty">신규 업체가 없습니다. <a href="vendor-new-register.html">신규업체 등록</a>에서 추가해 주세요.</p>';
            return;
        }
        listEl.innerHTML =
            '<ul class="vl-admin-list">' +
            items
                .map(function (it) {
                    var href =
                        "vendor-edit.html?id=" +
                        encodeURIComponent(it.id) +
                        "&from=new";
                    var deptTxt = vendorDeptLabels(it) || "미지정";
                    var gradeTxt =
                        VA && VA.vendorGradeLabel
                            ? VA.vendorGradeLabel(it.vn_grade)
                            : String(it.vn_grade || "1") + "등급";
                    return (
                        '<li><a class="vl-admin-item" href="' +
                        PF.escapeHtml(href) +
                        '"><span class="vl-admin-name">' +
                        PF.escapeHtml(it.vn_company || "(이름 없음)") +
                        '</span><span class="vl-admin-meta">' +
                        PF.escapeHtml(deptTxt) +
                        " · " +
                        PF.escapeHtml(gradeTxt) +
                        (it.loginId ? " · " + PF.escapeHtml(String(it.loginId)) : "") +
                        PF.escapeHtml(registrarSuffix(it)) +
                        "</span></a></li>"
                    );
                })
                .join("") +
            "</ul>";
    }

    function loadVendors() {
        var opts = {};
        if (filterStaff && filterStaff !== "all" && VA && VA.isSupervisorView && VA.isSupervisorView()) {
            opts.registeredBy = filterStaff;
        }
        setStatus("불러오는 중…");
        return api.listVendors(opts).then(function (items) {
            cachedItems = items;
            renderList();
            var n = filteredItems().length;
            setStatus((filterDept ? PF.deptLabel(catalog, filterDept) + " · " : "전체 · ") + n + "건");
        });
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

    if (VA && staffFilterWrap && staffFilterEl) {
        VA.initStaffFilter({
            wrapEl: staffFilterWrap,
            selectEl: staffFilterEl,
            onChange: function (val) {
                filterStaff = val || "all";
                loadVendors().catch(function (err) {
                    setStatus(err.message || "목록을 불러오지 못했습니다.", true);
                });
            }
        });
    }

    loadVendors().catch(function (err) {
        setStatus(err.message || "목록을 불러오지 못했습니다.", true);
    });
})();
