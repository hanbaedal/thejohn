(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var SR = window.THEJHON_SALES_REPORT;
    var OrderUI = window.THEJHON_ORDER_UI;

    var statusEl = document.getElementById("tax-status");
    var preset = "today";
    var isSupervisor = false;
    var allVendors = [];
    var lastPreview = null;
    var lastPdfBlob = null;

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

    function setExportEnabled(enabled) {
        ["tax-btn-pdf-view", "tax-btn-pdf-save", "tax-btn-print"].forEach(function (id) {
            var el = $(id);
            if (el) el.disabled = !enabled;
        });
    }

    function setPreset(next) {
        preset = next;
        document.querySelectorAll(".tax-preset").forEach(function (btn) {
            btn.classList.toggle("is-active", btn.getAttribute("data-preset") === preset);
        });
        var custom = preset === "custom";
        if ($("tax-custom-from")) $("tax-custom-from").hidden = !custom;
        if ($("tax-custom-to")) $("tax-custom-to").hidden = !custom;
        updatePeriodLabel();
    }

    function updatePeriodLabel() {
        var el = $("tax-period-label");
        if (!el) return;
        var labels = {
            today: "발부 기간: 오늘 (1일)",
            lastMonth: "발부 기간: 지난달 1개월",
            last3Months: "발부 기간: 지난달 포함 최근 3개월",
            custom: "발부 기간: 직접 선택"
        };
        el.textContent = labels[preset] || "";
    }

    function queryParams() {
        var p = {
            mode: "vendor",
            preset: preset,
            vendorCompany: String(($("tax-vendor-company") && $("tax-vendor-company").value) || "").trim(),
            vendorLoginId: String(($("tax-vendor-login") && $("tax-vendor-login").value) || "").trim()
        };
        if (preset === "custom") {
            p.dateFrom = SR.readDateInput($("tax-date-from"));
            p.dateTo = SR.readDateInput($("tax-date-to"));
        }
        if (isSupervisor && $("tax-admin")) {
            p.adminStaffId = String($("tax-admin").value || "").trim();
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
        var listEl = $("tax-vendor-list");
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
                var loginId = String(v.loginId || "");
                return (
                    '<li><button type="button" data-company="' +
                    SR.escapeHtml(company) +
                    '" data-login="' +
                    SR.escapeHtml(loginId) +
                    '">' +
                    SR.escapeHtml(company) +
                    "</button></li>"
                );
            })
            .join("");
        listEl.querySelectorAll("button[data-company]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                if ($("tax-vendor-company")) $("tax-vendor-company").value = btn.getAttribute("data-company") || "";
                if ($("tax-vendor-login")) $("tax-vendor-login").value = btn.getAttribute("data-login") || "";
                if ($("tax-vendor-display")) $("tax-vendor-display").value = btn.getAttribute("data-company") || "";
                SR.closeModal($("tax-vendor-modal"));
            });
        });
    }

    function renderPreviewTable(preview) {
        var tbody = $("tax-tbody");
        if (!tbody) return;
        var items = (preview && preview.items) || [];
        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="5">품목이 없습니다.</td></tr>';
            return;
        }
        var totalSupply = 0;
        var totalTax = 0;
        tbody.innerHTML = items
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
        tbody.innerHTML +=
            '<tr class="srp-total-row"><td colspan="3"><strong>합계</strong></td>' +
            '<td class="num"><strong>' +
            SR.escapeHtml(SR.formatWon(totalSupply).replace("원", "")) +
            "</strong></td>" +
            '<td class="num"><strong>' +
            SR.escapeHtml(SR.formatWon(totalTax).replace("원", "")) +
            "</strong></td></tr>";
    }

    function renderSummary(preview) {
        var el = $("tax-summary");
        if (!el || !preview || !preview.summary) {
            if (el) el.hidden = true;
            return;
        }
        var s = preview.summary;
        var vat = splitVat(s.totalAmount);
        el.textContent =
            "공급자: " +
            (preview.issuer && preview.issuer.company ? preview.issuer.company : "") +
            " · 공급받는자: " +
            (preview.buyer && preview.buyer.company ? preview.buyer.company : "") +
            " · 품목 " +
            (s.count || 0) +
            " · 공급가액 " +
            SR.formatWon(vat.supply) +
            " · 세액 " +
            SR.formatWon(vat.tax);
        el.hidden = false;
    }

    function validateQuery() {
        var p = queryParams();
        if (isSupervisor && !p.adminStaffId) {
            setStatus("공급 관리자를 선택해 주세요.", "err");
            return null;
        }
        if (!p.vendorCompany) {
            setStatus("공급받는 업체를 선택해 주세요.", "err");
            return null;
        }
        return p;
    }

    function runPreview() {
        var p = validateQuery();
        if (!p) return Promise.resolve();
        setStatus("매출장을 조회하는 중…");
        setExportEnabled(false);
        lastPdfBlob = null;
        return api
            .previewTaxInvoice(p)
            .then(function (data) {
                lastPreview = data && data.preview;
                if (!lastPreview) throw new Error("미리보기 데이터가 없습니다.");
                renderSummary(lastPreview);
                renderPreviewTable(lastPreview);
                if (lastPreview.period && $("tax-period-label")) {
                    $("tax-period-label").textContent =
                        "발부 기간: " +
                        lastPreview.period.dateFrom +
                        " ~ " +
                        lastPreview.period.dateTo;
                }
                setStatus("미리보기 완료 — PDF를 발부할 수 있습니다.", "ok");
                setExportEnabled(true);
            })
            .catch(function (e) {
                lastPreview = null;
                renderPreviewTable(null);
                if ($("tax-summary")) $("tax-summary").hidden = true;
                setStatus((e && e.message) || "미리보기에 실패했습니다.", "err");
            });
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
        var p = validateQuery();
        if (!p) return Promise.reject(new Error("조건을 확인해 주세요."));
        return api.fetchTaxInvoicePdf(Object.assign({}, p, { inline: inline !== false }));
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

        setPreset("today");

        document.querySelectorAll(".tax-preset").forEach(function (btn) {
            btn.addEventListener("click", function () {
                setPreset(btn.getAttribute("data-preset") || "today");
            });
        });

        if ($("tax-btn-vendor-pick")) {
            $("tax-btn-vendor-pick").addEventListener("click", function () {
                loadVendors().then(function () {
                    if ($("tax-vendor-search")) $("tax-vendor-search").value = "";
                    renderVendorList("");
                    SR.openModal($("tax-vendor-modal"));
                });
            });
        }
        if ($("tax-vendor-search")) {
            $("tax-vendor-search").addEventListener("input", function () {
                renderVendorList($("tax-vendor-search").value);
            });
        }
        SR.wireModalClose($("tax-vendor-modal"), $("tax-vendor-modal-close"));

        if ($("tax-btn-preview")) $("tax-btn-preview").addEventListener("click", runPreview);

        if ($("tax-btn-pdf-view")) {
            $("tax-btn-pdf-view").addEventListener("click", function () {
                setStatus("PDF 생성 중…");
                fetchPdf(true)
                    .then(function (blob) {
                        lastPdfBlob = blob;
                        if (OrderUI && OrderUI.openPdfBlobInModal) {
                            return OrderUI.openPdfBlobInModal(blob, pdfFilename());
                        }
                    })
                    .then(function () {
                        setStatus("PDF를 열었습니다.", "ok");
                    })
                    .catch(function (e) {
                        setStatus((e && e.message) || "PDF를 열지 못했습니다.", "err");
                    });
            });
        }

        if ($("tax-btn-pdf-save")) {
            $("tax-btn-pdf-save").addEventListener("click", function () {
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
                    });
            });
        }

        if ($("tax-btn-print")) {
            $("tax-btn-print").addEventListener("click", function () {
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
                    });
            });
        }

        if ($("tax-admin")) {
            $("tax-admin").addEventListener("change", function () {
                lastPreview = null;
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
