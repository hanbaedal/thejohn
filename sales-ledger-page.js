/**
 * 매출장 조회 페이지 — 업체별·품목별·일자별 공통
 * window.SALES_LEDGER_PAGE_CONFIG = { mode: "vendor"|"product"|"date", title, hint, pdfPrefix }
 */
(function () {
    var cfg = window.SALES_LEDGER_PAGE_CONFIG || {};
    var mode = cfg.mode || "vendor";
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var SR = window.THEJHON_SALES_REPORT;
    var Catalog = window.THEJHON_PRODUCT_CATALOG;

    var preset = "today";
    var allVendors = [];
    var allProducts = [];
    var isSupervisor = false;
    var lastResult = null;

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(msg, kind) {
        SR.setStatus($("slp-status"), msg, kind);
    }

    function setPreset(next) {
        preset = next;
        document.querySelectorAll(".slp-preset").forEach(function (btn) {
            btn.classList.toggle("is-active", btn.getAttribute("data-preset") === preset);
        });
        var custom = preset === "custom";
        if ($("slp-custom-from")) $("slp-custom-from").hidden = !custom;
        if ($("slp-custom-to")) $("slp-custom-to").hidden = !custom;
        updatePeriodLabel();
    }

    function updatePeriodLabel() {
        var el = $("slp-period-label");
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
        var deptEl = $("slp-dept");
        if (!deptEl || !Catalog) return;
        var html = '<option value="">사업부문 선택</option>';
        (Catalog.DEPARTMENTS || []).forEach(function (d) {
            html += '<option value="' + SR.escapeHtml(d.id) + '">' + SR.escapeHtml(d.label) + "</option>";
        });
        deptEl.innerHTML = html;
    }

    function loadAdminOptions() {
        var adminEl = $("slp-admin");
        if (!api || !api.listStaff || !adminEl) return Promise.resolve();
        return api.listStaff().then(function (items) {
            var opts = '<option value="">전체</option>';
            (items || [])
                .filter(function (it) {
                    return it && it.role === "admin" && it.active !== false;
                })
                .sort(function (a, b) {
                    return String(a.loginId || "").localeCompare(String(b.loginId || ""), "ko");
                })
                .forEach(function (it) {
                    var id = String(it.loginId || "").trim();
                    var label = (it.st_company || id) + " (" + id + ")";
                    opts += '<option value="' + SR.escapeHtml(id) + '">' + SR.escapeHtml(label) + "</option>";
                });
            adminEl.innerHTML = opts;
        });
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
        var listEl = $("slp-vendor-list");
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
                if ($("slp-vendor-company")) $("slp-vendor-company").value = company;
                if ($("slp-vendor-display")) $("slp-vendor-display").value = company;
                SR.closeModal($("slp-vendor-modal"));
            });
        });
    }

    function loadProducts() {
        var dept = $("slp-dept") ? String($("slp-dept").value || "").trim() : "";
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
        var listEl = $("slp-product-list");
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
                if ($("slp-product-id")) $("slp-product-id").value = btn.getAttribute("data-id") || "";
                if ($("slp-product-display")) $("slp-product-display").value = btn.getAttribute("data-name") || "";
                SR.closeModal($("slp-product-modal"));
            });
        });
    }

    function queryParams() {
        var p = { mode: mode, preset: preset };
        if (preset === "custom") {
            p.dateFrom = SR.readDateInput($("slp-date-from"));
            p.dateTo = SR.readDateInput($("slp-date-to"));
        }
        if (mode === "vendor") {
            p.vendorCompany = String(($("slp-vendor-company") && $("slp-vendor-company").value) || "").trim();
        } else if (mode === "product") {
            p.dept = String(($("slp-dept") && $("slp-dept").value) || "").trim();
            p.productId = String(($("slp-product-id") && $("slp-product-id").value) || "").trim();
            p.productName = String(($("slp-product-display") && $("slp-product-display").value) || "").trim();
        }
        if (isSupervisor && $("slp-admin")) {
            var adminStaffId = String($("slp-admin").value || "").trim();
            if (adminStaffId) p.adminStaffId = adminStaffId;
        }
        return p;
    }

    function setExportEnabled(enabled) {
        if ($("slp-btn-print")) $("slp-btn-print").disabled = !enabled;
        if ($("slp-btn-pdf")) $("slp-btn-pdf").disabled = !enabled;
    }

    function updatePrintTitle(data) {
        var el = $("slp-print-title");
        if (!el || !data) {
            if (el) el.hidden = true;
            return;
        }
        var title = cfg.title || "매출장";
        if (mode === "vendor") {
            title += " — " + String(($("slp-vendor-display") && $("slp-vendor-display").value) || "");
        } else if (mode === "product") {
            title += " — " + String(($("slp-product-display") && $("slp-product-display").value) || "");
        }
        if (data.period && data.period.dateFrom && data.period.dateTo) {
            title += " · " + data.period.dateFrom + " ~ " + data.period.dateTo;
        }
        el.textContent = title;
        el.hidden = false;
    }

    function renderResults(data) {
        if (mode === "date") {
            SR.renderDateGroupsTable($("slp-tbody"), (data && data.dayGroups) || []);
            return ((data && data.dayGroups) || []).length;
        }
        SR.renderResultsTable($("slp-tbody"), (data && data.items) || []);
        return ((data && data.items) || []).length;
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
        setStatus("거래명세서 매출을 조회하는 중…");
        setExportEnabled(false);
        return api
            .getSalesLedgerInquiry(p)
            .then(function (data) {
                lastResult = data;
                SR.renderSummary($("slp-summary"), data.summary);
                if (data.period && $("slp-period-label")) {
                    $("slp-period-label").textContent =
                        "조회 기간: " +
                        data.period.dateFrom +
                        " ~ " +
                        data.period.dateTo +
                        " (" +
                        (data.period.label || "") +
                        ")";
                }
                updatePrintTitle(data);
                var n = renderResults(data);
                if (mode === "date") {
                    setStatus(
                        n ? "조회 완료 (" + n + "일)" : "조회 결과가 없습니다.",
                        n ? "ok" : ""
                    );
                } else {
                    setStatus(n ? "조회 완료 (" + n + "건)" : "조회 결과가 없습니다.", n ? "ok" : "");
                }
                setExportEnabled(n > 0);
            })
            .catch(function (e) {
                lastResult = null;
                setStatus((e && e.message) || "조회에 실패했습니다.", "err");
            });
    }

    function downloadPdf() {
        if (!lastResult || !api.fetchSalesReportPdf) return;
        var p = queryParams();
        var body = Object.assign({ reportType: "inquiry", inline: false }, p);
        setStatus("PDF 생성 중…");
        if ($("slp-btn-pdf")) $("slp-btn-pdf").disabled = true;
        api.fetchSalesReportPdf(body)
            .then(function (blob) {
                var prefix = cfg.pdfPrefix || "매출장";
                var name = prefix.replace(/[<>:"/\\|?*]/g, "_");
                if (mode === "vendor") name += "_" + (p.vendorCompany || "").replace(/[<>:"/\\|?*]/g, "_");
                if (mode === "product") name += "_" + (p.productName || "").replace(/[<>:"/\\|?*]/g, "_");
                if (lastResult.period && lastResult.period.dateFrom) {
                    name += "_" + String(lastResult.period.dateFrom).replace(/-/g, "");
                }
                SR.downloadPdfBlob(blob, name + ".pdf");
                setStatus("PDF를 저장했습니다.", "ok");
            })
            .catch(function (e) {
                setStatus((e && e.message) || "PDF 생성에 실패했습니다.", "err");
            })
            .finally(function () {
                var ok =
                    mode === "date"
                        ? lastResult && lastResult.dayGroups && lastResult.dayGroups.length
                        : lastResult && lastResult.items && lastResult.items.length;
                setExportEnabled(!!ok);
            });
    }

    function init() {
        if (!Auth || !Auth.getOrderManageHubAccess || !Auth.getOrderManageHubAccess().allowed) {
            setStatus("권한이 없습니다.", "err");
            return;
        }
        if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
        if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

        isSupervisor = !!(Auth.isSupervisorStaff && Auth.isSupervisorStaff());
        if ($("slp-admin-wrap")) $("slp-admin-wrap").hidden = !isSupervisor;

        if (mode === "product") fillDeptOptions();
        setPreset("today");

        document.querySelectorAll(".slp-preset").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setPreset(btn.getAttribute("data-preset") || "today");
            });
        });

        if ($("slp-btn-vendor-pick")) {
            $("slp-btn-vendor-pick").addEventListener("click", function () {
                loadVendors().then(function () {
                    if ($("slp-vendor-search")) $("slp-vendor-search").value = "";
                    renderVendorList("");
                    SR.openModal($("slp-vendor-modal"));
                });
            });
        }
        if ($("slp-vendor-search")) {
            $("slp-vendor-search").addEventListener("input", function () {
                renderVendorList($("slp-vendor-search").value);
            });
        }
        SR.wireModalClose($("slp-vendor-modal"), $("slp-vendor-modal-close"));

        if ($("slp-btn-product-pick")) {
            $("slp-btn-product-pick").addEventListener("click", function () {
                loadProducts().then(function () {
                    if ($("slp-product-search")) $("slp-product-search").value = "";
                    renderProductList("");
                    SR.openModal($("slp-product-modal"));
                });
            });
        }
        if ($("slp-product-search")) {
            $("slp-product-search").addEventListener("input", function () {
                renderProductList($("slp-product-search").value);
            });
        }
        SR.wireModalClose($("slp-product-modal"), $("slp-product-modal-close"));

        if ($("slp-dept")) {
            $("slp-dept").addEventListener("change", function () {
                if ($("slp-product-id")) $("slp-product-id").value = "";
                if ($("slp-product-display")) $("slp-product-display").value = "";
                allProducts = [];
            });
        }

        if ($("slp-btn-search")) $("slp-btn-search").addEventListener("click", runSearch);
        if ($("slp-btn-print")) $("slp-btn-print").addEventListener("click", function () {
            SR.printResults();
        });
        if ($("slp-btn-pdf")) $("slp-btn-pdf").addEventListener("click", downloadPdf);
        if ($("slp-admin")) {
            $("slp-admin").addEventListener("change", function () {
                lastResult = null;
                setExportEnabled(false);
            });
        }

        var initPromise = isSupervisor ? loadAdminOptions() : Promise.resolve();
        initPromise.then(function () {});
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
