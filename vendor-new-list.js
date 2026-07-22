(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var VA = window.THEJHON_VENDOR_ADMIN;
    var CARDS = window.THEJHON_VENDOR_LIST_CARDS;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var filterRoot = document.getElementById("vl-dept-filter");
    var listEl = document.getElementById("vl-list");
    var statusEl = document.getElementById("vl-status");
    var staffFilterWrap = document.getElementById("vl-staff-filter-wrap");
    var staffFilterEl = document.getElementById("vl-staff-filter");
    var cachedItems = [];
    var filterDept = "";
    var filterStaff = "all";

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function normalizeVendorDeptId(id) {
        var n = String(id || "").trim().toLowerCase();
        if (n === "uncontracted" || n === "미계약") return "uncontracted";
        return catalog ? catalog.normalizeDept(id) : n;
    }

    function vendorDeptIds(it) {
        var raw = it.vn_depts;
        if (!Array.isArray(raw)) return [];
        return raw.map(function (id) {
            return normalizeVendorDeptId(id);
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
        var base =
            VA && VA.filterByRegistrar
                ? VA.filterByRegistrar(cachedItems, filterStaff, "vn_registered_by")
                : cachedItems;
        if (!filterDept) return base;
        return base.filter(function (it) {
            return vendorMatchesDept(it, filterDept);
        });
    }

    function registrarText(it) {
        if (!VA || !VA.registeredByMeta) return "";
        var meta = VA.registeredByMeta(it);
        if (!meta) return "";
        return meta.replace(/^담당:\s*/, "");
    }

    function gradeLabel(it) {
        return VA && VA.vendorGradeLabel
            ? VA.vendorGradeLabel(it.vn_grade)
            : ({ 1: "Silver", 2: "Gold", 3: "Diamond" }[parseInt(it.vn_grade, 10)] || "Silver");
    }

    function editHref(it) {
        return "vendor-edit.html?id=" + encodeURIComponent(it.id) + "&from=new";
    }

    function canWriteItem(it) {
        return VA && VA.canWriteRegisteredItem
            ? VA.canWriteRegisteredItem(it, "vn_registered_by")
            : true;
    }

    function bindDeleteButtons() {
        if (!listEl || !api || !api.deleteVendorNew) return;
        listEl.querySelectorAll("[data-vl-delete]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-vl-delete");
                if (!id) return;
                var name = btn.getAttribute("data-vl-name") || "이 신규업체";
                if (
                    !window.confirm(
                        "「" + name + "」을(를) 삭제할까요?\n\n삭제 후에는 복구할 수 없습니다."
                    )
                ) {
                    return;
                }
                btn.disabled = true;
                api.deleteVendorNew(id)
                    .then(function () {
                        cachedItems = (cachedItems || []).filter(function (row) {
                            return row.id !== id;
                        });
                        renderList();
                        var n = filteredItems().length;
                        setStatus(
                            (filterDept ? PF.deptLabel(catalog, filterDept) + " · " : "전체 · ") +
                                n +
                                "건"
                        );
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        window.alert(
                            (err && err.message) || "신규업체를 삭제하지 못했습니다."
                        );
                    });
            });
        });
    }

    function renderList() {
        if (!CARDS || !listEl) return;
        var items = filteredItems().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        CARDS.renderGrid(listEl, items, {
            emptyHtml:
                '<p class="vpr-loading">신규 업체가 없습니다. <a href="vendor-new-register.html">신규업체 등록</a>에서 추가해 주세요.</p>',
            cardOptions: function (it) {
                return {
                    mode: "new",
                    badge: "신규",
                    gradeLabel: gradeLabel(it),
                    deptLabel: vendorDeptLabels(it) || "미지정",
                    registrar: registrarText(it),
                    editHref: editHref(it),
                    showActions: true,
                    canWrite: canWriteItem(it),
                    deleteId: it.id
                };
            },
            onBind: bindDeleteButtons
        });
        if (!items.length) {
            setStatus(
                (filterDept ? PF.deptLabel(catalog, filterDept) + " · " : "전체 · ") + "0건"
            );
        }
    }

    function loadVendors() {
        setStatus("불러오는 중…");
        if (!api || !api.listVendorNew) {
            setStatus("API를 사용할 수 없습니다.", true);
            return Promise.resolve();
        }
        return api.listVendorNew().then(function (items) {
            cachedItems = items || [];
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
                var n = filteredItems().length;
                setStatus(
                    (filterDept ? PF.deptLabel(catalog, filterDept) + " · " : "전체 · ") + n + "건"
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

    if (VA && staffFilterWrap && staffFilterEl) {
        VA.initStaffFilter({
            wrapEl: staffFilterWrap,
            selectEl: staffFilterEl,
            onChange: function (val) {
                filterStaff = val || "all";
                renderList();
                var n = filteredItems().length;
                setStatus(
                    (filterDept ? PF.deptLabel(catalog, filterDept) + " · " : "전체 · ") + n + "건"
                );
            }
        });
    }

    loadVendors().catch(function (err) {
        setStatus(err.message || "목록을 불러오지 못했습니다.", true);
    });
})();
