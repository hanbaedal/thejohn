(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var OrderUI = window.THEJHON_ORDER_UI;
    var DetailModal = window.THEJHON_ORDER_DETAIL_MODAL;
    var statusEl = document.getElementById("stl-status");
    var summaryEl = document.getElementById("stl-summary");
    var listEl = document.getElementById("stl-list");
    var dateFromEl = document.getElementById("stl-date-from");
    var dateToEl = document.getElementById("stl-date-to");
    var adminEl = document.getElementById("stl-admin");
    var searchBtn = document.getElementById("stl-search");
    var selectedId = "";
    var listItems = [];
    var detailModal = null;

    function escapeHtml(s) {
        return OrderUI ? OrderUI.escapeHtml(s) : String(s);
    }
    function formatWon(n) {
        return OrderUI ? OrderUI.formatWon(n) : String(n);
    }
    function formatDate(ts) {
        return OrderUI ? OrderUI.formatDate(ts) : "";
    }
    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.className = "shub-status" + (isError ? " shub-status--err" : "");
    }

    function defaultDates() {
        var now = new Date();
        var to = now.toISOString().slice(0, 10);
        var fromD = new Date(now);
        fromD.setDate(fromD.getDate() - 30);
        var from = fromD.toISOString().slice(0, 10);
        if (dateFromEl && !dateFromEl.value) dateFromEl.value = from;
        if (dateToEl && !dateToEl.value) dateToEl.value = to;
    }

    function loadAdminOptions() {
        if (!api || !api.listStaff) return Promise.resolve();
        return api.listStaff().then(function (items) {
            if (!adminEl) return;
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
                    opts += '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + "</option>";
                });
            adminEl.innerHTML = opts;
        });
    }

    function showDetail(order) {
        if (!detailModal) return;
        if (!order) {
            detailModal.dismiss();
            return;
        }
        detailModal.show(order, {
            title: "거래명세서 상세",
            showVendor: true,
            actions: [
                {
                    id: "stl-detail-print",
                    label: "인쇄",
                    primary: true,
                    onClick: function (ord, btn) {
                        btn.disabled = true;
                        OrderUI.printTransactionPdfWithAuth(api, ord.id)
                            .catch(function (err) {
                                alert((err && err.message) || "인쇄 준비 실패");
                            })
                            .finally(function () {
                                btn.disabled = false;
                            });
                    }
                },
                {
                    id: "stl-detail-pdf",
                    label: "PDF 저장",
                    primary: false,
                    onClick: function (ord, btn) {
                        btn.disabled = true;
                        OrderUI.downloadTransactionPdfWithAuth(api, ord.id, ord)
                            .catch(function (err) {
                                alert((err && err.message) || "PDF 저장 실패");
                            })
                            .finally(function () {
                                btn.disabled = false;
                            });
                    }
                }
            ]
        });
    }

    function renderList(items) {
        listItems = items || [];
        if (!listEl) return;
        if (!listItems.length) {
            listEl.innerHTML = '<p class="am-list-empty">조회된 주문이 없습니다.</p>';
            showDetail(null);
            return;
        }
        listEl.innerHTML =
            '<ul class="ol-admin-list">' +
            listItems
                .map(function (it) {
                    return (
                        '<li class="ol-admin-item" data-order-id="' +
                        escapeHtml(it.id) +
                        '"><div class="ol-admin-main"><span class="ol-admin-name">' +
                        escapeHtml(it.orderNo || it.id) +
                        " · " +
                        escapeHtml(it.vendorCompany || "") +
                        '</span><span class="ol-admin-meta">' +
                        escapeHtml(formatDate(it.createdAt)) +
                        " · " +
                        escapeHtml(formatWon(it.totalAmount)) +
                        "</span></div>" +
                        '<div class="ol-admin-actions">' +
                        '<button type="button" class="btn btn-primary stl-btn-print">인쇄</button>' +
                        '<button type="button" class="btn stl-btn-pdf">PDF</button>' +
                        "</div></li>"
                    );
                })
                .join("") +
            "</ul>";

        listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
            var id = li.getAttribute("data-order-id");
            li.addEventListener("click", function (e) {
                if (e.target.closest(".ol-admin-actions")) return;
                if (selectedId === id) {
                    selectedId = "";
                    showDetail(null);
                    return;
                }
                selectedId = id;
                listEl.querySelectorAll(".ol-admin-item").forEach(function (x) {
                    x.classList.toggle("is-selected", x.getAttribute("data-order-id") === id);
                });
                if (!detailModal) return;
                detailModal.showLoading("불러오는 중…");
                api.getOrder(id)
                    .then(showDetail)
                    .catch(function (err) {
                        detailModal.showError((err && err.message) || "오류");
                    });
            });
            var row = listItems.find(function (it) {
                return it.id === id;
            });
            var printBtn = li.querySelector(".stl-btn-print");
            if (printBtn) {
                printBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    printBtn.disabled = true;
                    OrderUI.printTransactionPdfWithAuth(api, id)
                        .catch(function (err) {
                            alert((err && err.message) || "인쇄 준비 실패");
                        })
                        .finally(function () {
                            printBtn.disabled = false;
                        });
                });
            }
            var pdfBtn = li.querySelector(".stl-btn-pdf");
            if (pdfBtn) {
                pdfBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    OrderUI.downloadTransactionPdfWithAuth(api, id, row).catch(function (err) {
                        alert((err && err.message) || "PDF 저장 실패");
                    });
                });
            }
        });
    }

    function loadData() {
        var dateFrom = String((dateFromEl && dateFromEl.value) || "").trim();
        var dateTo = String((dateToEl && dateToEl.value) || "").trim();
        var adminStaffId = String((adminEl && adminEl.value) || "").trim();
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setStatus("시작일이 종료일보다 늦을 수 없습니다.", true);
            return;
        }
        setStatus("조회 중…");
        var opts = { dateFrom: dateFrom, dateTo: dateTo };
        if (adminStaffId) opts.adminStaffId = adminStaffId;

        Promise.all([api.getSupervisorOrderStats(opts), api.listOrders(opts)])
            .then(function (results) {
                var stats = results[0] || {};
                var items = results[1] || [];
                if (summaryEl) {
                    summaryEl.hidden = false;
                    summaryEl.innerHTML =
                        "<span><strong>건수</strong> " +
                        escapeHtml(String((stats.summary && stats.summary.count) || items.length)) +
                        "건</span>" +
                        "<span><strong>총 금액</strong> " +
                        escapeHtml(formatWon((stats.summary && stats.summary.totalAmount) || 0)) +
                        "</span>";
                }
                renderList(items);
                setStatus(items.length + "건");
            })
            .catch(function (err) {
                setStatus((err && err.message) || "조회 실패", true);
            });
    }

    if (!Auth || !Auth.getStaffManageAccess) {
        setStatus("인증 오류", true);
        return;
    }
    Auth.normalizeLegacySession();
    if (!Auth.getStaffManageAccess().allowed) {
        setStatus("슈퍼바이저만 이용할 수 있습니다.", true);
        return;
    }

    if (DetailModal && DetailModal.create) {
        detailModal = DetailModal.create({
            modalId: "stl-detail-modal",
            panelId: "stl-detail-panel",
            listEl: listEl,
            itemSelector: ".ol-admin-item",
            onDismiss: function () {
                selectedId = "";
            }
        });
    }

    defaultDates();
    loadAdminOptions().then(loadData);
    if (searchBtn) searchBtn.addEventListener("click", loadData);
    if (dateFromEl) dateFromEl.addEventListener("change", loadData);
    if (dateToEl) dateToEl.addEventListener("change", loadData);
    if (adminEl) adminEl.addEventListener("change", loadData);
})();
