/**
 * 상품 리스트(관리) — 사업부문(products.js)과 동일하게 THEJHON_API.listProducts 사용
 */
(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var VA = window.THEJHON_VENDOR_ADMIN;
    var catalog = window.THEJHON_PRODUCT_CATALOG;

    var filterRoot = document.getElementById("pl-dept-filter");
    var listEl = document.getElementById("pl-list");
    var statusEl = document.getElementById("pl-status");
    var staffFilterWrap = document.getElementById("pl-staff-filter-wrap");
    var staffFilterEl = document.getElementById("pl-staff-filter");
    var cachedItems = [];
    var filterDept = "";
    var filterStaff = "all";
    var loadToken = 0;

    function productRecordType(it) {
        return String((it && it.pd_record_type) || "catalog")
            .trim()
            .toLowerCase();
    }

    function isCatalogProduct(it) {
        return productRecordType(it) !== "new";
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        var text = msg || "";
        statusEl.textContent = text;
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
        statusEl.hidden = !text;
    }

    function itemDept(it) {
        return catalog ? catalog.normalizeDept(it.pd_dept) : String(it.pd_dept || "").trim().toLowerCase();
    }

    /** 사업부문(products.js)과 동일 — API 쿼리(부문); 담당 상품은 서버에서 로그인 관리자 기준 */
    function listOpts() {
        var opts = {};
        if (filterDept && catalog && catalog.normalizeDept(filterDept)) {
            opts.dept = catalog.normalizeDept(filterDept);
        }
        return opts;
    }

    function filteredItems() {
        var base = (cachedItems || []).filter(isCatalogProduct);
        base = VA && VA.filterByRegistrar ? VA.filterByRegistrar(base, filterStaff, "pd_registered_by") : base;
        if (!filterDept) return base;
        return base.filter(function (it) {
            return itemDept(it) === filterDept;
        });
    }

    function registrarSuffix(it) {
        if (!VA || !VA.registeredByMeta) return "";
        var meta = VA.registeredByMeta(it);
        return meta ? " · " + meta : "";
    }

    function escapeHtml(s) {
        if (PF && PF.escapeHtml) return PF.escapeHtml(s);
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function deptLabel(deptId) {
        if (PF && catalog) return PF.deptLabel(catalog, deptId);
        return deptId || "";
    }

    function editHref(it) {
        return (
            "product-edit.html?id=" + encodeURIComponent(it.id) + "&from=catalog"
        );
    }

    function photoCountLabel(it) {
        var n = Number(it.pd_image_count);
        if (!it.pd_has_image || !isFinite(n) || n < 1) return "";
        return (
            '<span class="pl-photo-count">' +
            (n > 1 ? n + "장" : "1장") +
            "</span>"
        );
    }

    function thumbHtml(it) {
        if (it.pd_has_image) {
            return (
                '<div class="pl-admin-thumb">' +
                '<img alt="" loading="lazy" data-pl-cover="' +
                escapeHtml(it.id) +
                '">' +
                photoCountLabel(it) +
                "</div>"
            );
        }
        return (
            '<div class="pl-admin-thumb pl-admin-thumb--empty" aria-hidden="true">사진<br>없음</div>'
        );
    }

    function bindCoverImages() {
        if (!listEl || !api || !api.get) return;
        listEl.querySelectorAll("img[data-pl-cover]").forEach(function (img) {
            var id = img.getAttribute("data-pl-cover");
            if (!id) return;
            api
                .get("api/products/" + encodeURIComponent(id) + "/cover")
                .then(function (data) {
                    if (data && data.pd_image) {
                        img.src = data.pd_image;
                    }
                })
                .catch(function () {
                    var box = img.parentElement;
                    if (box) {
                        box.className = "pl-admin-thumb pl-admin-thumb--empty";
                        box.innerHTML = "사진<br>없음";
                    }
                });
        });
    }

    function bindDeleteButtons() {
        if (!listEl || !api || !api.deleteProduct) return;
        listEl.querySelectorAll("[data-pl-delete]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-pl-delete");
                if (!id) return;
                var name = btn.getAttribute("data-pl-name") || "이 상품";
                if (
                    !window.confirm(
                        "「" + name + "」을(를) 삭제할까요?\n\n삭제 후에는 복구할 수 없습니다."
                    )
                ) {
                    return;
                }
                btn.disabled = true;
                api.deleteProduct(id)
                    .then(function () {
                        cachedItems = (cachedItems || []).filter(function (row) {
                            return row.id !== id;
                        });
                        renderList();
                    })
                    .catch(function (err) {
                        btn.disabled = false;
                        window.alert(
                            (err && err.message) || "상품을 삭제하지 못했습니다."
                        );
                    });
            });
        });
    }

    function canWriteItem(it) {
        return VA && VA.canWriteRegisteredItem
            ? VA.canWriteRegisteredItem(it, "pd_registered_by")
            : true;
    }

    function renderList() {
        if (!listEl) return;
        var items = filteredItems().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!items.length) {
            listEl.innerHTML =
                '<p class="am-list-empty">표시할 상품이 없습니다. 사업부문을 바꾸거나 <a href="product-register.html">상품 내용 등록</a>에서 추가해 주세요.</p>';
            setStatus("");
            return;
        }
        listEl.innerHTML =
            '<ul class="vl-admin-list">' +
            items
                .map(function (it) {
                    var deptTxt = deptLabel(itemDept(it)) || "미지정";
                    var namePlain = String(it.pd_name || "(이름 없음)");
                    var metaHtml =
                        escapeHtml(deptTxt) +
                        (it.pd_size ? " · " + escapeHtml(String(it.pd_size)) : "") +
                        escapeHtml(registrarSuffix(it));
                    if (!canWriteItem(it)) {
                        return (
                            '<li class="pl-admin-row pl-admin-row--readonly">' +
                            thumbHtml(it) +
                            '<div class="pl-admin-row__main pl-admin-row__main--readonly">' +
                            '<span class="vl-admin-name">' +
                            escapeHtml(namePlain) +
                            '</span><span class="vl-admin-meta">' +
                            metaHtml +
                            "</span></div>" +
                            '<span class="pl-admin-readonly-tag">조회만</span></li>'
                        );
                    }
                    var href = editHref(it);
                    return (
                        '<li class="pl-admin-row">' +
                        thumbHtml(it) +
                        '<a class="pl-admin-row__main" href="' +
                        escapeHtml(href) +
                        '"><span class="vl-admin-name">' +
                        escapeHtml(namePlain) +
                        '</span><span class="vl-admin-meta">' +
                        metaHtml +
                        "</span></a>" +
                        '<div class="pl-admin-row__actions">' +
                        '<a class="btn pl-admin-act pl-admin-edit" href="' +
                        escapeHtml(href) +
                        '">수정</a>' +
                        '<button type="button" class="btn pl-admin-act pl-admin-del" data-pl-delete="' +
                        escapeHtml(it.id) +
                        '" data-pl-name="' +
                        escapeHtml(namePlain) +
                        '">삭제</button>' +
                        "</div></li>"
                    );
                })
                .join("") +
            "</ul>";
        bindDeleteButtons();
        bindCoverImages();
        setStatus("");
    }

    function loadErrorHtml(msg) {
        var detail = msg ? escapeHtml(msg) : "";
        return (
            '<p class="am-list-empty">상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' +
            (detail ? "<br><small>" + detail + "</small>" : "") +
            '</p><p class="am-list-empty"><button type="button" class="btn btn-primary" id="pl-retry">다시 시도</button></p>'
        );
    }

    function bindRetry() {
        var btn = document.getElementById("pl-retry");
        if (btn) {
            btn.addEventListener("click", function () {
                loadProducts(0);
            });
        }
    }

    /** products.js loadDeptProducts 와 동일 패턴 */
    function loadProducts(attempt) {
        if (!listEl) return;
        if (!api || !api.listProducts) {
            listEl.innerHTML = loadErrorHtml("API(thejhon-api.js)를 불러오지 못했습니다.");
            bindRetry();
            return;
        }

        var token = ++loadToken;
        setStatus(attempt ? "다시 불러오는 중…" : "불러오는 중…");
        listEl.innerHTML = '<p class="am-list-empty">불러오는 중…</p>';

        return api
            .listProducts(listOpts())
            .then(function (items) {
                if (token !== loadToken) return;
                cachedItems = Array.isArray(items) ? items : [];
                renderList();
            })
            .catch(function (err) {
                if (token !== loadToken) return;
                var status = err && err.status;
                var retry = (attempt || 0) < 3 && (status === 503 || status === 502 || !status);
                if (retry) {
                    setTimeout(function () {
                        loadProducts((attempt || 0) + 1);
                    }, status === 503 ? 2500 : 1000);
                    return;
                }
                var msg = (err && err.message) || "";
                if (status) msg += (msg ? " " : "") + "(HTTP " + status + ")";
                listEl.innerHTML = loadErrorHtml(msg);
                bindRetry();
                setStatus(msg || "목록을 불러오지 못했습니다.", true);
            });
    }

    if (!window.THEJHON_AUTH || !THEJHON_AUTH.getRegisterAccess) {
        setStatus("인증 스크립트를 불러오지 못했습니다.", true);
        return;
    }

    if (THEJHON_AUTH.normalizeLegacySession) {
        THEJHON_AUTH.normalizeLegacySession();
    }

    var access = THEJHON_AUTH.getRegisterAccess();
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

    if (PF && filterRoot && catalog) {
        var deptPicker = PF.initDeptPicker({
            catalog: catalog,
            root: filterRoot,
            hiddenInput: document.getElementById("pl-filter-dept"),
            showAll: true,
            onSelect: function (deptId) {
                filterDept = deptId;
                loadProducts(0);
            }
        });
        if (deptPicker && deptPicker.setValue) deptPicker.setValue("");
    }

    loadProducts(0);
})();
