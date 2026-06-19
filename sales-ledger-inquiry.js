(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var SR = window.THEJHON_SALES_REPORT;
    var Catalog = window.THEJHON_PRODUCT_CATALOG;

    var statusEl = document.getElementById("sli-status");
    var mode = "vendor";
    var preset = "today";
    var allVendors = [];
    var allProducts = [];

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(msg, kind) {
        SR.setStatus(statusEl, msg, kind);
    }

    function readModeFromUrl() {
        try {
            var m = new URLSearchParams(window.location.search).get("mode");
            if (m === "product" || m === "vendor") mode = m;
        } catch (e) {}
    }

    function applyModeUi() {
        var vendorRow = $("sli-vendor-row");
        var productSection = $("sli-product-section");
        var tabVendor = $("sli-tab-vendor");
        var tabProduct = $("sli-tab-product");
        if (mode === "product") {
            if (vendorRow) vendorRow.hidden = true;
            if (productSection) productSection.hidden = false;
            if (tabVendor) {
                tabVendor.classList.remove("is-active");
                tabVendor.setAttribute("aria-selected", "false");
            }
            if (tabProduct) {
                tabProduct.classList.add("is-active");
                tabProduct.setAttribute("aria-selected", "true");
            }
        } else {
            if (vendorRow) vendorRow.hidden = false;
            if (productSection) productSection.hidden = true;
            if (tabVendor) {
                tabVendor.classList.add("is-active");
                tabVendor.setAttribute("aria-selected", "true");
            }
            if (tabProduct) {
                tabProduct.classList.remove("is-active");
                tabProduct.setAttribute("aria-selected", "false");
            }
        }
    }

    function setPreset(next) {
        preset = next;
        document.querySelectorAll(".sli-preset").forEach(function (btn) {
            btn.classList.toggle("is-active", btn.getAttribute("data-preset") === preset);
        });
        var custom = preset === "custom";
        if ($("sli-custom-range")) $("sli-custom-range").hidden = !custom;
        if ($("sli-custom-range-to")) $("sli-custom-range-to").hidden = !custom;
        updatePeriodLabel();
    }

    function updatePeriodLabel() {
        var el = $("sli-period-label");
        if (!el) return;
        var labels = {
            today: "조회 기간: 오늘 (1일)",
            lastMonth: "조회 기간: 지난달 1개월",
            last3Months: "조회 기간: 지난달 포함 최근 3개월",
            custom: "조회 기간: 직접 선택"
        };
        el.textContent = labels[preset] || "";
    }

    function fillDeptOptions() {
        var deptEl = $("sli-dept");
        if (!deptEl || !Catalog) return;
        var html = '<option value="">사업부문 선택</option>';
        (Catalog.DEPARTMENTS || []).forEach(function (d) {
            html += '<option value="' + SR.escapeHtml(d.id) + '">' + SR.escapeHtml(d.label) + "</option>";
        });
        deptEl.innerHTML = html;
    }

    function vendorCompanyName(v) {
        return String(v.vn_company || v.company || v.vendorCompany || v.name || "").trim();
    }

    function loadVendors() {
        setStatus("업체 목록을 불러오는 중…");
        return api
            .listVendors()
            .then(function (items) {
                allVendors = items || [];
                setStatus("");
                return allVendors;
            })
            .catch(function (e) {
                setStatus((e && e.message) || "업체 목록을 불러오지 못했습니다.", "err");
                return [];
            });
    }

    function renderVendorList(filter) {
        var listEl = $("sli-vendor-list");
        if (!listEl) return;
        var q = String(filter || "")
            .trim()
            .toLowerCase();
        var list = allVendors.filter(function (v) {
            var name = vendorCompanyName(v).toLowerCase();
            return name && (!q || name.indexOf(q) >= 0);
        });
        if (!list.length) {
            listEl.innerHTML =
                '<li><span style="display:block;padding:1rem;color:#6a7d8e">표시할 업체가 없습니다.</span></li>';
            return;
        }
        listEl.innerHTML = list
            .map(function (v) {
                var company = vendorCompanyName(v);
                return (
                    '<li><button type="button" data-company="' +
                    SR.escapeHtml(company) +
                    '">' +
                    SR.escapeHtml(company) +
                    "</button></li>"
                );
            })
            .join("");
        listEl.querySelectorAll("button[data-company]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var company = btn.getAttribute("data-company") || "";
                if ($("sli-vendor-company")) $("sli-vendor-company").value = company;
                if ($("sli-vendor-display")) $("sli-vendor-display").value = company;
                SR.closeModal($("sli-vendor-modal"));
            });
        });
    }

    function loadProducts() {
        var dept = $("sli-dept") ? String($("sli-dept").value || "").trim() : "";
        if (!dept) {
            setStatus("사업부문을 먼저 선택해 주세요.", "err");
            return Promise.resolve([]);
        }
        setStatus("상품 목록을 불러오는 중…");
        return api
            .listProducts({ dept: dept })
            .then(function (items) {
                allProducts = items || [];
                setStatus("");
                return allProducts;
            })
            .catch(function (e) {
                setStatus((e && e.message) || "상품 목록을 불러오지 못했습니다.", "err");
                return [];
            });
    }

    function renderProductList(filter) {
        var listEl = $("sli-product-list");
        if (!listEl) return;
        var q = String(filter || "")
            .trim()
            .toLowerCase();
        var list = allProducts.filter(function (p) {
            if (!q) return true;
            var name = String(p.pd_name || p.name || "").toLowerCase();
            var code = String(p.pd_code || "").toLowerCase();
            return name.indexOf(q) >= 0 || code.indexOf(q) >= 0;
        });
        if (!list.length) {
            listEl.innerHTML =
                '<li><span style="display:block;padding:1rem;color:#6a7d8e">표시할 상품이 없습니다.</span></li>';
            return;
        }
        listEl.innerHTML = list
            .map(function (p) {
                var id = String(p.id || "");
                var name = String(p.pd_name || p.name || "(이름 없음)");
                var code = String(p.pd_code || "");
                return (
                    '<li><button type="button" data-id="' +
                    SR.escapeHtml(id) +
                    '" data-name="' +
                    SR.escapeHtml(name) +
                    '">' +
                    SR.escapeHtml(name) +
                    (code ? '<span class="srp-modal-meta">' + SR.escapeHtml(code) + "</span>" : "") +
                    "</button></li>"
                );
            })
            .join("");
        listEl.querySelectorAll("button[data-id]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                if ($("sli-product-id")) $("sli-product-id").value = btn.getAttribute("data-id") || "";
                if ($("sli-product-display")) $("sli-product-display").value = btn.getAttribute("data-name") || "";
                SR.closeModal($("sli-product-modal"));
            });
        });
    }

    function queryParams() {
        var p = {
            mode: mode,
            preset: preset
        };
        if (preset === "custom") {
            p.dateFrom = SR.readDateInput($("sli-date-from"));
            p.dateTo = SR.readDateInput($("sli-date-to"));
        }
        if (mode === "vendor") {
            p.vendorCompany = String($("sli-vendor-company").value || "").trim();
        } else {
            p.dept = String($("sli-dept").value || "").trim();
            p.productId = String($("sli-product-id").value || "").trim();
        }
        return p;
    }

    function runSearch() {
        var p = queryParams();
        if (mode === "vendor" && !p.vendorCompany) {
            return setStatus("업체를 선택해 주세요.", "err");
        }
        if (mode === "product") {
            if (!p.dept) return setStatus("사업부문을 선택해 주세요.", "err");
            if (!p.productId) return setStatus("품목을 선택해 주세요.", "err");
        }
        setStatus("조회 중…");
        $("sli-btn-print").disabled = true;
        return api
            .getSalesLedgerInquiry(p)
            .then(function (data) {
                SR.renderSummary($("sli-summary"), data.summary);
                if (data.period) {
                    var pl = $("sli-period-label");
                    if (pl && data.period.dateFrom && data.period.dateTo) {
                        pl.textContent =
                            "조회 기간: " +
                            data.period.dateFrom +
                            " ~ " +
                            data.period.dateTo +
                            " (" +
                            (data.period.label || "") +
                            ")";
                    }
                }
                SR.renderResultsTable($("sli-tbody"), data.items || []);
                var n = (data.items && data.items.length) || 0;
                setStatus(n ? "조회 완료 (" + n + "건)" : "조회 결과가 없습니다.", n ? "ok" : "");
                $("sli-btn-print").disabled = n === 0;
            })
            .catch(function (e) {
                setStatus((e && e.message) || "조회에 실패했습니다.", "err");
            });
    }

    function init() {
        if (!Auth || !Auth.getOrderManageHubAccess || !Auth.getOrderManageHubAccess().allowed) {
            setStatus("권한이 없습니다.", "err");
            return;
        }
        if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");

        readModeFromUrl();
        applyModeUi();
        fillDeptOptions();
        setPreset("today");

        document.querySelectorAll(".srp-mode-tab").forEach(function (tab) {
            tab.addEventListener("click", function () {
                mode = tab.getAttribute("data-mode") || "vendor";
                applyModeUi();
            });
        });

        document.querySelectorAll(".sli-preset").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setPreset(btn.getAttribute("data-preset") || "today");
            });
        });

        if ($("sli-btn-vendor-pick")) {
            $("sli-btn-vendor-pick").addEventListener("click", function () {
                loadVendors().then(function () {
                    if ($("sli-vendor-search")) $("sli-vendor-search").value = "";
                    renderVendorList("");
                    SR.openModal($("sli-vendor-modal"));
                });
            });
        }
        if ($("sli-vendor-search")) {
            $("sli-vendor-search").addEventListener("input", function () {
                renderVendorList($("sli-vendor-search").value);
            });
        }
        SR.wireModalClose($("sli-vendor-modal"), $("sli-vendor-modal-close"));

        if ($("sli-btn-product-pick")) {
            $("sli-btn-product-pick").addEventListener("click", function () {
                loadProducts().then(function () {
                    if ($("sli-product-search")) $("sli-product-search").value = "";
                    renderProductList("");
                    SR.openModal($("sli-product-modal"));
                });
            });
        }
        if ($("sli-product-search")) {
            $("sli-product-search").addEventListener("input", function () {
                renderProductList($("sli-product-search").value);
            });
        }
        SR.wireModalClose($("sli-product-modal"), $("sli-product-modal-close"));

        if ($("sli-dept")) {
            $("sli-dept").addEventListener("change", function () {
                if ($("sli-product-id")) $("sli-product-id").value = "";
                if ($("sli-product-display")) $("sli-product-display").value = "";
                allProducts = [];
            });
        }

        if ($("sli-btn-search")) $("sli-btn-search").addEventListener("click", runSearch);
        if ($("sli-btn-print")) {
            $("sli-btn-print").addEventListener("click", function () {
                SR.printResults();
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
