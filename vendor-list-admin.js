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

    function vendorRecordType(it) {
        return String((it && it.vn_record_type) || "partner")
            .trim()
            .toLowerCase();
    }

    function isPartnerVendor(it) {
        return vendorRecordType(it) !== "new";
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        var text = msg || "";
        statusEl.textContent = text;
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
        statusEl.hidden = !text;
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
        var base = cachedItems.filter(isPartnerVendor);
        base = VA && VA.filterByRegistrar ? VA.filterByRegistrar(base, filterStaff, "vn_registered_by") : base;
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
        return "vendor-edit.html?id=" + encodeURIComponent(it.id) + "&from=partner";
    }

    function canWriteItem(it) {
        return VA && VA.canWriteRegisteredItem
            ? VA.canWriteRegisteredItem(it, "vn_registered_by")
            : true;
    }

    function bindDeleteButtons() {
        if (!listEl || !api || !api.deleteVendor) return;
        listEl.querySelectorAll("[data-vl-delete]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-vl-delete");
                if (!id) return;
                var name = btn.getAttribute("data-vl-name") || "이 업체";
                if (
                    !window.confirm(
                        "「" + name + "」을(를) 삭제할까요?\n\n삭제 후에는 복구할 수 없습니다."
                    )
                ) {
                    return;
                }
                btn.disabled = true;
                api.deleteVendor(id)
                    .then(function () {
                        cachedItems = (cachedItems || []).filter(function (row) {
                            return row.id !== id;
                        });
                        renderList();
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        window.alert(
                            (err && err.message) || "업체를 삭제하지 못했습니다."
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
            layout: "prospectBrowse",
            gridClass: "vpr-grid vpr-grid--cols3",
            emptyHtml:
                '<p class="vpr-loading">표시할 업체가 없습니다. 사업부문을 바꾸거나 <a href="vendor-register.html">업체 등록</a>에서 추가해 주세요.</p>',
            hoverPanelOptions: function (it) {
                return {
                    deptLabel: vendorDeptLabels(it) || "미지정",
                    gradeLabel: gradeLabel(it),
                    registrar: registrarText(it)
                };
            },
            cardOptions: function (it) {
                return {
                    cardId: it.id,
                    editHref: editHref(it),
                    showActions: true,
                    canWrite: canWriteItem(it),
                    deleteId: it.id
                };
            },
            onBind: bindDeleteButtons
        });
        setStatus(items.length ? "전체 · " + items.length + "건" : "");
    }

    function loadVendors() {
        setStatus("불러오는 중…");
        return api.listVendors().then(function (items) {
            cachedItems = items;
            renderList();
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
                renderList();
            }
        });
    }

    loadVendors().catch(function (err) {
        setStatus(err.message || "목록을 불러오지 못했습니다.", true);
    });
})();
