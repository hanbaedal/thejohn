(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var SR = window.THEJHON_SALES_REPORT;
    var OrderUI = window.THEJHON_ORDER_UI;
    var DetailModal = window.THEJHON_ORDER_DETAIL_MODAL;

    var statusEl = document.getElementById("tax-status");
    var isSupervisor = false;
    var vendorGroups = [];
    var selectedVendorKey = "";
    var lastPeriod = null;
    var lastPreview = null;
    var lastVendor = null;
    var detailModal = null;

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(msg, kind) {
        SR.setStatus(statusEl, msg, kind);
    }

    function splitVat(lineTotal) {
        var total = Math.round(Number(lineTotal) || 0);
        if (total <= 0) return { supply: 0, tax: 0 };
        var supply = Math.round(total / 1.1);
        return { supply: supply, tax: total - supply };
    }

    function queryParams(vendor) {
        var p = {
            dateFrom: SR.readDateInput($("tax-date-from")),
            dateTo: SR.readDateInput($("tax-date-to"))
        };
        if (isSupervisor && $("tax-admin")) {
            p.adminStaffId = String($("tax-admin").value || "").trim();
        }
        if (vendor) {
            p.vendorCompany = String(vendor.vendorCompany || "").trim();
            if (vendor.vendorLoginId) p.vendorLoginId = String(vendor.vendorLoginId).trim();
        }
        return p;
    }

    function validatePeriod() {
        var p = queryParams();
        if (isSupervisor && !p.adminStaffId) {
            setStatus("공급 관리자를 선택해 주세요.", "err");
            return null;
        }
        if (!p.dateFrom || !p.dateTo) {
            setStatus("조회 기간(시작일·종료일)을 선택해 주세요.", "err");
            return null;
        }
        if (p.dateFrom > p.dateTo) {
            setStatus("기간 선택이 올바르지 않습니다. (시작일 ≤ 종료일)", "err");
            return null;
        }
        return p;
    }

    function loadAdminOptions() {
        if (!api || !api.listStaff || !$("tax-admin")) return Promise.resolve();
        return api.listStaff().then(function (items) {
            var opts = '<option value="">선택</option>';
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
            $("tax-admin").innerHTML = opts;
        });
    }

    function renderVendorList(vendors) {
        var listEl = $("tax-vendor-list");
        if (!listEl) return;
        vendorGroups = vendors || [];
        selectedVendorKey = "";
        if (detailModal) detailModal.dismiss();

        if (!vendorGroups.length) {
            listEl.innerHTML = '<p class="am-list-empty">해당 기간에 매출이 있는 업체가 없습니다.</p>';
            setStatus("0개 업체");
            return;
        }

        listEl.innerHTML =
            '<ul class="ol-admin-list">' +
            vendorGroups
                .map(function (v, idx) {
                    return (
                        '<li class="ol-admin-item ol-admin-item--vendor" data-vendor-idx="' +
                        String(idx) +
                        '" role="button" tabindex="0">' +
                        '<div class="ol-admin-main">' +
                        '<span class="ol-admin-name">' +
                        SR.escapeHtml(v.vendorCompany || "") +
                        "</span>" +
                        '<span class="ol-admin-meta">품목 ' +
                        SR.escapeHtml(String(v.lineCount || 0)) +
                        "건 · " +
                        SR.escapeHtml(SR.formatWon(v.totalAmount)) +
                        "</span></div></li>"
                    );
                })
                .join("") +
            "</ul>";

        listEl.querySelectorAll(".ol-admin-item--vendor").forEach(function (li) {
            function open() {
                var idx = parseInt(li.getAttribute("data-vendor-idx") || "", 10);
                var v = vendorGroups[idx];
                if (!v) return;
                var key = v.vendorCompany || "";
                if (selectedVendorKey === key) {
                    selectedVendorKey = "";
                    li.classList.remove("is-selected");
                    if (detailModal) detailModal.dismiss();
                    return;
                }
                selectedVendorKey = key;
                listEl.querySelectorAll(".ol-admin-item").forEach(function (el) {
                    el.classList.toggle("is-selected", el === li);
                });
                openVendorDetail(v);
            }
            li.addEventListener("click", open);
            li.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                }
            });
        });
        setStatus(vendorGroups.length + "개 업체 — 업체를 클릭하면 세금계산서를 발부할 수 있습니다.", "ok");
    }

    function renderPreviewBody(preview) {
        if (!preview) return "";
        var items = preview.items || [];
        var totalSupply = 0;
        var totalTax = 0;
        var rows = items
            .map(function (it) {
                var vat = splitVat(it.lineTotal);
                totalSupply += vat.supply;
                totalTax += vat.tax;
                return (
                    "<tr>" +
                    "<td>" +
                    SR.escapeHtml(it.productName || "") +
                    "</td>" +
                    '<td class="num">' +
                    SR.escapeHtml(String(it.quantity || 0)) +
                    "</td>" +
                    '<td class="num">' +
                    SR.escapeHtml(SR.formatWon(it.unitPrice).replace("원", "")) +
                    "</td>" +
                    '<td class="num">' +
                    SR.escapeHtml(SR.formatWon(vat.supply).replace("원", "")) +
                    "</td>" +
                    '<td class="num">' +
                    SR.escapeHtml(SR.formatWon(vat.tax).replace("원", "")) +
                    "</td>" +
                    "</tr>"
                );
            })
            .join("");
        rows +=
            '<tr class="tax-total-row"><td colspan="3"><strong>합계</strong></td>' +
            '<td class="num"><strong>' +
            SR.escapeHtml(SR.formatWon(totalSupply).replace("원", "")) +
            "</strong></td>" +
            '<td class="num"><strong>' +
            SR.escapeHtml(SR.formatWon(totalTax).replace("원", "")) +
            "</strong></td></tr>";

        var periodText =
            preview.period && preview.period.dateFrom && preview.period.dateTo
                ? preview.period.dateFrom + " ~ " + preview.period.dateTo
                : "";

        return (
            '<div class="tax-detail-meta">' +
            (periodText ? "<p>발부 기간: " + SR.escapeHtml(periodText) + "</p>" : "") +
            "<p>공급자: " +
            SR.escapeHtml((preview.issuer && preview.issuer.company) || "") +
            "</p>" +
            "<p>공급받는자: " +
            SR.escapeHtml((preview.buyer && preview.buyer.company) || "") +
            "</p>" +
            "</div>" +
            '<div class="tax-detail-table-wrap" tabindex="0" aria-label="세금계산서 품목">' +
            '<table class="tax-detail-table"><thead><tr>' +
            "<th>품목</th><th>수량</th><th>단가</th><th>공급가액</th><th>세액</th>" +
            "</tr></thead><tbody>" +
            (rows || '<tr><td colspan="5">품목이 없습니다.</td></tr>') +
            "</tbody></table></div>"
        );
    }

    function pdfFilename() {
        var company = (lastPreview && lastPreview.buyer && lastPreview.buyer.company) || "세금계산서";
        var date =
            lastPreview && lastPreview.period && lastPreview.period.dateTo
                ? String(lastPreview.period.dateTo).replace(/-/g, "")
                : "";
        return "세금계산서_" + company.replace(/[<>:"/\\|?*]/g, "_") + (date ? "_" + date : "") + ".pdf";
    }

    function fetchPdf(inline) {
        if (!lastPreview || !lastVendor) {
            return Promise.reject(new Error("미리보기 정보가 없습니다."));
        }
        return api.fetchTaxInvoicePdf(Object.assign({}, queryParams(lastVendor), { inline: inline !== false }));
    }

    function taxPdfActions() {
        return [
            {
                id: "tax-detail-pdf-view",
                label: "PDF 보기",
                primary: true,
                onClick: function (_ctx, btn) {
                    btn.disabled = true;
                    setStatus("PDF 생성 중…");
                    fetchPdf(true)
                        .then(function (blob) {
                            if (OrderUI && OrderUI.openPdfBlobInModal) {
                                return OrderUI.openPdfBlobInModal(blob, pdfFilename());
                            }
                        })
                        .then(function () {
                            setStatus("PDF를 열었습니다.", "ok");
                        })
                        .catch(function (e) {
                            setStatus((e && e.message) || "PDF를 열지 못했습니다.", "err");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                }
            },
            {
                id: "tax-detail-pdf-save",
                label: "PDF 저장",
                onClick: function (_ctx, btn) {
                    btn.disabled = true;
                    setStatus("PDF 생성 중…");
                    fetchPdf(false)
                        .then(function (blob) {
                            if (OrderUI && OrderUI.triggerPdfDownload) {
                                OrderUI.triggerPdfDownload(blob, pdfFilename());
                            } else if (SR.downloadPdfBlob) {
                                SR.downloadPdfBlob(blob, pdfFilename());
                            }
                            setStatus("PDF를 저장했습니다.", "ok");
                        })
                        .catch(function (e) {
                            setStatus((e && e.message) || "PDF 저장에 실패했습니다.", "err");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                }
            },
            {
                id: "tax-detail-pdf-print",
                label: "출력",
                onClick: function (_ctx, btn) {
                    btn.disabled = true;
                    setStatus("PDF 생성 중…");
                    fetchPdf(true)
                        .then(function (blob) {
                            var url = URL.createObjectURL(blob);
                            var w = window.open(url, "_blank");
                            if (!w) throw new Error("팝업이 차단되었습니다.");
                            w.addEventListener("load", function () {
                                try {
                                    w.focus();
                                    w.print();
                                } catch (e) {}
                            });
                            setStatus("인쇄 창을 열었습니다.", "ok");
                        })
                        .catch(function (e) {
                            setStatus((e && e.message) || "출력에 실패했습니다.", "err");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                }
            }
        ];
    }

    function openVendorDetail(vendor) {
        if (!detailModal) return;
        var p = validatePeriod();
        if (!p) return;

        detailModal.showLoading("세금계산서를 불러오는 중…");
        lastVendor = vendor;
        api
            .previewTaxInvoice(queryParams(vendor))
            .then(function (data) {
                lastPreview = data && data.preview;
                if (!lastPreview) throw new Error("미리보기 데이터가 없습니다.");
                if (lastPreview.period) lastPeriod = lastPreview.period;
                detailModal.show(lastPreview, {
                    title: "세금계산서 — " + (lastPreview.buyer && lastPreview.buyer.company ? lastPreview.buyer.company : ""),
                    showVendor: false,
                    renderBody: function (preview) {
                        return renderPreviewBody(preview);
                    },
                    actions: taxPdfActions()
                });
            })
            .catch(function (e) {
                lastPreview = null;
                detailModal.showError((e && e.message) || "세금계산서를 불러오지 못했습니다.");
            });
    }

    function runSearch() {
        var p = validatePeriod();
        if (!p) return Promise.resolve();
        setStatus("매출 업체를 조회하는 중…");
        return api
            .listTaxInvoiceVendors(p)
            .then(function (data) {
                lastPeriod = data.period || null;
                renderVendorList(data.vendors || []);
            })
            .catch(function (e) {
                vendorGroups = [];
                renderVendorList([]);
                setStatus((e && e.message) || "조회에 실패했습니다.", "err");
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
        if ($("tax-admin-wrap")) $("tax-admin-wrap").hidden = !isSupervisor;

        SR.defaultDateRange($("tax-date-from"), $("tax-date-to"));

        if (DetailModal && DetailModal.create) {
            detailModal = DetailModal.create({
                modalId: "tax-detail-modal",
                panelId: "tax-detail-panel",
                listEl: $("tax-vendor-list"),
                itemSelector: ".ol-admin-item--vendor",
                onDismiss: function () {
                    selectedVendorKey = "";
                }
            });
        }

        if ($("tax-btn-search")) $("tax-btn-search").addEventListener("click", runSearch);

        if ($("tax-admin")) {
            $("tax-admin").addEventListener("change", function () {
                vendorGroups = [];
                selectedVendorKey = "";
                if (detailModal) detailModal.dismiss();
                if ($("tax-vendor-list")) $("tax-vendor-list").innerHTML = "";
            });
        }

        var initPromise = isSupervisor ? loadAdminOptions() : Promise.resolve();
        initPromise.then(function () {
            if ($("tax-vendor-list")) {
                $("tax-vendor-list").innerHTML = '<p class="am-list-empty">조회 기간을 선택한 뒤 조회해 주세요.</p>';
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
