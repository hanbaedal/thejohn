(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var SR = window.THEJHON_SALES_REPORT;
    var Catalog = window.THEJHON_PRODUCT_CATALOG;

    var statusEl = document.getElementById("srp-status");
    var deptEl = document.getElementById("srp-dept");
    var productDisplayEl = document.getElementById("srp-product-display");
    var productIdEl = document.getElementById("srp-product-id");
    var dateFromEl = document.getElementById("srp-date-from");
    var dateToEl = document.getElementById("srp-date-to");
    var summaryEl = document.getElementById("srp-summary");
    var tbodyEl = document.getElementById("srp-tbody");
    var btnSearch = document.getElementById("srp-btn-search");
    var btnPdf = document.getElementById("srp-btn-pdf");
    var btnPrint = document.getElementById("srp-btn-print");
    var btnProductPick = document.getElementById("srp-btn-product-pick");
    var productModal = document.getElementById("srp-product-modal");
    var productModalClose = document.getElementById("srp-product-modal-close");
    var productSearchEl = document.getElementById("srp-product-search");
    var productListEl = document.getElementById("srp-product-list");

    var allProducts = [];
    var lastResult = null;
    var issuerLoginId = "";

    function setStatus(msg, kind) {
        SR.setStatus(statusEl, msg, kind);
    }

    function fillDeptOptions() {
        if (!deptEl || !Catalog) return;
        var depts = Catalog.DEPARTMENTS || [];
        var html = '<option value="">사업부문 선택</option>';
        depts.forEach(function (d) {
            html += '<option value="' + SR.escapeHtml(d.id) + '">' + SR.escapeHtml(d.label) + "</option>";
        });
        deptEl.innerHTML = html;
    }

    function clearProduct() {
        if (productIdEl) productIdEl.value = "";
        if (productDisplayEl) productDisplayEl.value = "";
        allProducts = [];
    }

    function loadProducts() {
        var dept = deptEl ? String(deptEl.value || "").trim() : "";
        if (!dept) {
            setStatus("사업부문을 먼저 선택해 주세요.", "err");
            return Promise.resolve([]);
        }
        setStatus("상품 목록을 불러오는 중…");
        var opts = { dept: dept };
        if (issuerLoginId) opts.registeredBy = issuerLoginId;
        return api.listProducts(opts).then(function (items) {
            allProducts = items || [];
            setStatus("");
            return allProducts;
        }).catch(function (e) {
            setStatus(e.message || "상품 목록을 불러오지 못했습니다.", "err");
            return [];
        });
    }

    function renderProductList(filter) {
        if (!productListEl) return;
        var q = String(filter || "").trim().toLowerCase();
        var list = allProducts.filter(function (p) {
            if (!q) return true;
            var name = String(p.pd_name || p.name || "").toLowerCase();
            var code = String(p.pd_code || "").toLowerCase();
            return name.indexOf(q) >= 0 || code.indexOf(q) >= 0;
        });
        if (!list.length) {
            productListEl.innerHTML = '<li><span style="display:block;padding:1rem;color:#6a7d8e">표시할 상품이 없습니다.</span></li>';
            return;
        }
        var html = "";
        list.forEach(function (p) {
            var id = String(p.id || "");
            var name = String(p.pd_name || p.name || "(이름 없음)");
            var code = String(p.pd_code || "");
            html +=
                '<li><button type="button" data-id="' +
                SR.escapeHtml(id) +
                '" data-name="' +
                SR.escapeHtml(name) +
                '">' +
                SR.escapeHtml(name) +
                (code ? '<span class="srp-modal-meta">' + SR.escapeHtml(code) + "</span>" : "") +
                "</button></li>";
        });
        productListEl.innerHTML = html;
    }

    function openProductModal() {
        var dept = deptEl ? String(deptEl.value || "").trim() : "";
        if (!dept) {
            setStatus("사업부문을 먼저 선택해 주세요.", "err");
            return;
        }
        loadProducts().then(function () {
            if (productSearchEl) productSearchEl.value = "";
            renderProductList("");
            SR.openModal(productModal);
            if (productSearchEl) productSearchEl.focus();
        });
    }

    function queryParams() {
        return {
            dept: String(deptEl.value || "").trim(),
            productId: String(productIdEl.value || "").trim(),
            dateFrom: SR.readDateInput(dateFromEl),
            dateTo: SR.readDateInput(dateToEl)
        };
    }

    function runSearch() {
        var p = queryParams();
        if (!p.dept) return setStatus("사업부문을 선택해 주세요.", "err");
        if (!p.productId) return setStatus("품목을 선택해 주세요.", "err");
        setStatus("조회 중…");
        btnPdf.disabled = true;
        btnPrint.disabled = true;
        return api.getSalesReportByProduct(p).then(function (data) {
            lastResult = data;
            SR.renderSummary(summaryEl, data.summary);
            SR.renderResultsTable(tbodyEl, data.items);
            var n = (data.items && data.items.length) || 0;
            setStatus(n ? "조회 완료 (" + n + "건)" : "조회 결과가 없습니다.", n ? "ok" : "");
            btnPdf.disabled = !n;
            btnPrint.disabled = !n;
        }).catch(function (e) {
            lastResult = null;
            SR.renderResultsTable(tbodyEl, []);
            if (summaryEl) summaryEl.hidden = true;
            setStatus(e.message || "조회에 실패했습니다.", "err");
        });
    }

    function savePdf() {
        var p = queryParams();
        if (!p.productId) return;
        setStatus("PDF 생성 중…");
        api.fetchSalesReportPdf(Object.assign({ reportType: "by-product", inline: false }, p))
            .then(function (blob) {
                var name = "품목별매출_" + (productDisplayEl.value || "집계") + ".pdf";
                SR.downloadPdfBlob(blob, name.replace(/[<>:"/\\|?*]/g, "_"));
                setStatus("PDF를 저장했습니다.", "ok");
            })
            .catch(function (e) {
                setStatus(e.message || "PDF 생성에 실패했습니다.", "err");
            });
    }

    if (!Auth || !Auth.getOrderManageHubAccess) {
        setStatus("인증 스크립트 오류", "err");
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();
    var access = Auth.getOrderManageHubAccess();
    if (!access.allowed) {
        setStatus(access.reason || "이용할 수 없습니다.", "err");
        return;
    }
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    if (access.role === "admin" && Auth.getUserId) {
        issuerLoginId = Auth.getUserId() || "";
    }

    fillDeptOptions();
    SR.defaultDateRange(dateFromEl, dateToEl);
    SR.wireModalClose(productModal, productModalClose);

    if (deptEl) {
        deptEl.addEventListener("change", function () {
            clearProduct();
        });
    }
    if (btnProductPick) btnProductPick.addEventListener("click", openProductModal);
    if (productDisplayEl) productDisplayEl.addEventListener("click", openProductModal);
    if (productSearchEl) {
        productSearchEl.addEventListener("input", function () {
            renderProductList(productSearchEl.value);
        });
    }
    if (productListEl) {
        productListEl.addEventListener("click", function (e) {
            var btn = e.target.closest("button[data-id]");
            if (!btn) return;
            if (productIdEl) productIdEl.value = btn.getAttribute("data-id") || "";
            if (productDisplayEl) productDisplayEl.value = btn.getAttribute("data-name") || "";
            SR.closeModal(productModal);
            setStatus("품목을 선택했습니다. 기간을 확인한 뒤 [확인]을 눌러 주세요.", "ok");
        });
    }
    if (btnSearch) btnSearch.addEventListener("click", runSearch);
    if (btnPdf) btnPdf.addEventListener("click", savePdf);
    if (btnPrint) btnPrint.addEventListener("click", SR.printResults);
})();
