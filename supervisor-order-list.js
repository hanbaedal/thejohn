(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var OrderUI = window.THEJHON_ORDER_UI;
    var DetailModal = window.THEJHON_ORDER_DETAIL_MODAL;
    var statusEl = document.getElementById("sol-status");
    var summaryEl = document.getElementById("sol-summary");
    var byAdminEl = document.getElementById("sol-by-admin");
    var listEl = document.getElementById("sol-list");
    var dateFromEl = document.getElementById("sol-date-from");
    var dateToEl = document.getElementById("sol-date-to");
    var adminEl = document.getElementById("sol-admin");
    var searchBtn = document.getElementById("sol-search");
    var selectedId = "";
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

    function renderByAdmin(rows) {
        if (!byAdminEl) return;
        if (!rows || !rows.length) {
            byAdminEl.hidden = true;
            return;
        }
        byAdminEl.hidden = false;
        byAdminEl.innerHTML =
            '<table class="shub-table"><thead><tr><th>담당</th><th>건수</th><th>금액</th></tr></thead><tbody>' +
            rows
                .map(function (r) {
                    return (
                        "<tr><td>" +
                        escapeHtml(r.name || r.loginId) +
                        "</td><td>" +
                        escapeHtml(String(r.count)) +
                        "</td><td>" +
                        escapeHtml(formatWon(r.totalAmount)) +
                        "</td></tr>"
                    );
                })
                .join("") +
            "</tbody></table>";
    }

    function showDetail(order) {
        if (!detailModal) return;
        if (!order) {
            detailModal.dismiss();
            return;
        }
        detailModal.show(order, {
            title: "주문서",
            renderBody: function (ord, OU) {
                return OU.renderStaffOrderSheetHtml(ord);
            },
            actions: [
                {
                    id: "sol-detail-pdf-view",
                    label: "PDF 보기",
                    primary: true,
                    onClick: function (ord, btn) {
                        btn.disabled = true;
                        OrderUI.viewOrderPdfWithAuth(api, ord.id)
                            .catch(function (err) {
                                alert((err && err.message) || "PDF를 열지 못했습니다.");
                            })
                            .finally(function () {
                                btn.disabled = false;
                            });
                    }
                },
                {
                    id: "sol-detail-pdf-save",
                    label: "PDF 저장",
                    onClick: function (ord, btn) {
                        btn.disabled = true;
                        OrderUI.downloadOrderPdfWithAuth(api, ord.id, ord.orderNo, ord)
                            .catch(function (err) {
                                alert((err && err.message) || "PDF 저장 실패");
                            })
                            .finally(function () {
                                btn.disabled = false;
                            });
                    }
                },
                {
                    id: "sol-detail-pdf-print",
                    label: "출력",
                    onClick: function (ord, btn) {
                        btn.disabled = true;
                        OrderUI.printOrderPdfWithAuth(api, ord.id)
                            .catch(function (err) {
                                alert((err && err.message) || "출력에 실패했습니다.");
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
        if (!listEl) return;
        if (!items.length) {
            listEl.innerHTML = '<p class="am-list-empty">조회된 주문서가 없습니다.</p>';
            showDetail(null);
            return;
        }
        listEl.innerHTML =
            '<ul class="ol-admin-list">' +
            items
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
                        (it.vendorRegisteredByName
                            ? " · 담당 " + escapeHtml(it.vendorRegisteredByName)
                            : "") +
                        "</span></div></li>"
                    );
                })
                .join("") +
            "</ul>";
        listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
            li.addEventListener("click", function () {
                var id = li.getAttribute("data-order-id");
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
                        "<span><strong>총 발주금액</strong> " +
                        escapeHtml(formatWon((stats.summary && stats.summary.totalAmount) || 0)) +
                        "</span>";
                }
                renderByAdmin(stats.byAdmin || []);
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

    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");

    if (DetailModal && DetailModal.create) {
        detailModal = DetailModal.create({
            modalId: "sol-detail-modal",
            panelId: "sol-detail-panel",
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
