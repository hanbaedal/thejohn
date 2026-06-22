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

    function renderPartyTable(caption, party) {
        party = party || {};
        function row(label, value) {
            var v = String(value || "").trim();
            if (!v) return "";
            return (
                "<tr><th scope=\"row\">" +
                SR.escapeHtml(label) +
                "</th><td>" +
                SR.escapeHtml(v) +
                "</td></tr>"
            );
        }
        var body =
            row("상호", party.company) +
            row("사업자번호", party.bizNo) +
            row("대표자", party.ceo) +
            row("업태", party.bizType) +
            row("종목", party.bizItem) +
            row("주소", party.address) +
            row("연락처", party.phone);
        if (!body) {
            body = '<tr><td colspan="2">—</td></tr>';
        }
        return (
            '<table class="tax-party-table"><caption>' +
            SR.escapeHtml(caption) +
            "</caption><tbody>" +
            body +
            "</tbody></table>"
        );
    }

    function renderPreviewBody(preview) {
        if (!preview) return "";
        var items = preview.items || [];
        var totalSupply = 0;
        var totalTax = 0;
        var totalAmount = 0;
        var rows = items
            .map(function (it) {
                var vat = splitVat(it.lineTotal);
                var lineTotal = Number(it.lineTotal) || 0;
                totalSupply += vat.supply;
                totalTax += vat.tax;
                totalAmount += lineTotal;
                return (
                    "<tr>" +
                    '<td class="name">' +
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
                    '<td class="num">' +
                    SR.escapeHtml(SR.formatWon(lineTotal).replace("원", "")) +
                    "</td>" +
                    "</tr>"
                );
            })
            .join("");
        if (!rows) {
            rows = '<tr><td colspan="6">품목이 없습니다.</td></tr>';
        } else {
            rows +=
                '<tr class="tax-items-total">' +
                '<td colspan="3"><strong>합계</strong></td>' +
                '<td class="num"><strong>' +
                SR.escapeHtml(SR.formatWon(totalSupply).replace("원", "")) +
                "</strong></td>" +
                '<td class="num"><strong>' +
                SR.escapeHtml(SR.formatWon(totalTax).replace("원", "")) +
                "</strong></td>" +
                '<td class="num"><strong>' +
                SR.escapeHtml(SR.formatWon(totalAmount).replace("원", "")) +
                "</strong></td>" +
                "</tr>";
        }

        var periodText =
            preview.period && preview.period.dateFrom && preview.period.dateTo
                ? preview.period.dateFrom + " ~ " + preview.period.dateTo
                : "";
        var issueDate = String(preview.issueDate || "").trim();

        return (
            '<div class="tax-invoice-detail">' +
            '<div class="tax-invoice-detail__meta">' +
            (periodText
                ? '<p class="tax-invoice-detail__period"><span class="tax-invoice-detail__label">발부 기간</span> ' +
                  SR.escapeHtml(periodText) +
                  "</p>"
                : "") +
            (issueDate
                ? '<p class="tax-invoice-detail__issue"><span class="tax-invoice-detail__label">작성일자</span> ' +
                  SR.escapeHtml(issueDate) +
                  "</p>"
                : "") +
            "</div>" +
            '<div class="tax-invoice-detail__parties">' +
            renderPartyTable("공급자", preview.issuer) +
            renderPartyTable("공급받는자", preview.buyer) +
            "</div>" +
            '<div class="tax-invoice-detail__items-wrap">' +
            '<table class="tax-invoice-items-table" aria-label="세금계산서 품목">' +
            "<colgroup>" +
            '<col class="col-name">' +
            '<col class="col-qty">' +
            '<col class="col-price">' +
            '<col class="col-supply">' +
            '<col class="col-tax">' +
            '<col class="col-amount">' +
            "</colgroup>" +
            "<thead><tr>" +
            "<th scope=\"col\">품목</th>" +
            '<th scope="col" class="num">수량</th>' +
            '<th scope="col" class="num">단가</th>' +
            '<th scope="col" class="num">공급가액</th>' +
            '<th scope="col" class="num">세액</th>' +
            '<th scope="col" class="num">합계금액</th>' +
            "</tr></thead>" +
            "<tbody>" +
            rows +
            "</tbody></table></div>" +
            '<table class="tax-invoice-summary-table" aria-label="세금계산서 합계">' +
            "<tbody>" +
            "<tr><th scope=\"row\">공급가액 합계</th><td class=\"num\">" +
            SR.escapeHtml(SR.formatWon(totalSupply)) +
            "</td></tr>" +
            "<tr><th scope=\"row\">세액 합계</th><td class=\"num\">" +
            SR.escapeHtml(SR.formatWon(totalTax)) +
            "</td></tr>" +
            '<tr class="tax-invoice-summary-table__total"><th scope="row">합계금액</th><td class="num"><strong>' +
            SR.escapeHtml(SR.formatWon(totalAmount)) +
            "</strong></td></tr>" +
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
