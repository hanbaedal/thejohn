(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var SR = window.THEJHON_SALES_REPORT;

    var statusEl = document.getElementById("srv-status");
    var vendorDisplayEl = document.getElementById("srv-vendor-display");
    var vendorCompanyEl = document.getElementById("srv-vendor-company");
    var dateFromEl = document.getElementById("srv-date-from");
    var dateToEl = document.getElementById("srv-date-to");
    var summaryEl = document.getElementById("srv-summary");
    var tbodyEl = document.getElementById("srv-tbody");
    var btnSearch = document.getElementById("srv-btn-search");
    var btnPdf = document.getElementById("srv-btn-pdf");
    var btnPrint = document.getElementById("srv-btn-print");
    var btnVendorPick = document.getElementById("srv-btn-vendor-pick");
    var vendorModal = document.getElementById("srv-vendor-modal");
    var vendorModalClose = document.getElementById("srv-vendor-modal-close");
    var vendorSearchEl = document.getElementById("srv-vendor-search");
    var vendorListEl = document.getElementById("srv-vendor-list");

    var allVendors = [];
    var issuerLoginId = "";

    function setStatus(msg, kind) {
        SR.setStatus(statusEl, msg, kind);
    }

    function vendorCompanyName(v) {
        return String(v.company || v.vendorCompany || v.pd_company || v.name || "").trim();
    }

    function loadVendors() {
        setStatus("업체 목록을 불러오는 중…");
        var opts = {};
        if (issuerLoginId) opts.registeredBy = issuerLoginId;
        return api.listVendors(opts).then(function (items) {
            allVendors = items || [];
            setStatus("");
            return allVendors;
        }).catch(function (e) {
            setStatus(e.message || "업체 목록을 불러오지 못했습니다.", "err");
            return [];
        });
    }

    function renderVendorList(filter) {
        if (!vendorListEl) return;
        var q = String(filter || "").trim().toLowerCase();
        var list = allVendors.filter(function (v) {
            var name = vendorCompanyName(v).toLowerCase();
            if (!name) return false;
            return !q || name.indexOf(q) >= 0;
        });
        if (!list.length) {
            vendorListEl.innerHTML = '<li><span style="display:block;padding:1rem;color:#6a7d8e">표시할 업체가 없습니다.</span></li>';
            return;
        }
        var html = "";
        list.forEach(function (v) {
            var company = vendorCompanyName(v);
            if (!company) return;
            html +=
                '<li><button type="button" data-company="' +
                SR.escapeHtml(company) +
                '">' +
                SR.escapeHtml(company) +
                "</button></li>";
        });
        vendorListEl.innerHTML = html;
    }

    function openVendorModal() {
        loadVendors().then(function () {
            if (vendorSearchEl) vendorSearchEl.value = "";
            renderVendorList("");
            SR.openModal(vendorModal);
            if (vendorSearchEl) vendorSearchEl.focus();
        });
    }

    function queryParams() {
        return {
            vendorCompany: String(vendorCompanyEl.value || "").trim(),
            dateFrom: SR.readDateInput(dateFromEl),
            dateTo: SR.readDateInput(dateToEl)
        };
    }

    function runSearch() {
        var p = queryParams();
        if (!p.vendorCompany) return setStatus("업체를 선택해 주세요.", "err");
        setStatus("조회 중…");
        btnPdf.disabled = true;
        btnPrint.disabled = true;
        return api.getSalesReportByVendor(p).then(function (data) {
            SR.renderSummary(summaryEl, data.summary);
            SR.renderResultsTable(tbodyEl, data.items);
            var n = (data.items && data.items.length) || 0;
            setStatus(n ? "조회 완료 (" + n + "건)" : "조회 결과가 없습니다.", n ? "ok" : "");
            btnPdf.disabled = !n;
            btnPrint.disabled = !n;
        }).catch(function (e) {
            SR.renderResultsTable(tbodyEl, []);
            if (summaryEl) summaryEl.hidden = true;
            setStatus(e.message || "조회에 실패했습니다.", "err");
        });
    }

    function savePdf() {
        var p = queryParams();
        if (!p.vendorCompany) return;
        setStatus("PDF 생성 중…");
        api.fetchSalesReportPdf(Object.assign({ reportType: "by-vendor", inline: false }, p))
            .then(function (blob) {
                var name = "업체별매출_" + p.vendorCompany + ".pdf";
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

    SR.defaultDateRange(dateFromEl, dateToEl);
    SR.wireModalClose(vendorModal, vendorModalClose);

    if (btnVendorPick) btnVendorPick.addEventListener("click", openVendorModal);
    if (vendorDisplayEl) vendorDisplayEl.addEventListener("click", openVendorModal);
    if (vendorSearchEl) {
        vendorSearchEl.addEventListener("input", function () {
            renderVendorList(vendorSearchEl.value);
        });
    }
    if (vendorListEl) {
        vendorListEl.addEventListener("click", function (e) {
            var btn = e.target.closest("button[data-company]");
            if (!btn) return;
            var company = btn.getAttribute("data-company") || "";
            if (vendorCompanyEl) vendorCompanyEl.value = company;
            if (vendorDisplayEl) vendorDisplayEl.value = company;
            SR.closeModal(vendorModal);
            setStatus("업체를 선택했습니다. 기간을 확인한 뒤 [확인]을 눌러 주세요.", "ok");
        });
    }
    if (btnSearch) btnSearch.addEventListener("click", runSearch);
    if (btnPdf) btnPdf.addEventListener("click", savePdf);
    if (btnPrint) btnPrint.addEventListener("click", SR.printResults);
})();
