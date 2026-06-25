(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var OrderUI = window.THEJHON_ORDER_UI;
    var DetailModal = window.THEJHON_ORDER_DETAIL_MODAL;

    var statusEl = document.getElementById("txn-status");
    var tabOrderBtn = document.getElementById("txn-tab-order");
    var tabManualBtn = document.getElementById("txn-tab-manual");
    var panelOrder = document.getElementById("txn-panel-order");
    var panelManual = document.getElementById("txn-panel-manual");

    var orderListEl = document.getElementById("txn-order-list");
    var orderStepEl = document.getElementById("txn-order-step");
    var orderDateFromEl = document.getElementById("txn-date-from");
    var orderDateToEl = document.getElementById("txn-date-to");
    var orderSearchBtn = document.getElementById("txn-order-search");
    var orderAdminWrap = document.getElementById("txn-admin-filter-wrap");
    var orderAdminEl = document.getElementById("txn-admin");

    var manualBodyEl = document.getElementById("txn-manual-body");
    var manualEmptyEl = document.getElementById("txn-manual-empty");
    var manualFilterWrap = document.getElementById("txn-manual-filter-wrap");
    var manualAdminEl = document.getElementById("txn-manual-admin");
    var manualSearchBtn = document.getElementById("txn-manual-search");

    var isSupervisor = false;
    var activeTab = "order";
    var orderSelectedId = "";
    var orderViewMode = "vendors";
    var orderSelectedVendor = "";
    var orderCached = [];
    var orderVendorGroups = [];
    var manualCached = [];
    var detailModal = null;

    function escapeHtml(s) {
        return OrderUI ? OrderUI.escapeHtml(s) : String(s);
    }

    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, "&#39;");
    }

    function formatWon(n) {
        return OrderUI ? OrderUI.formatWon(n) : String(n);
    }

    function formatDate(ts) {
        return OrderUI ? OrderUI.formatDate(ts) : "";
    }

    function formatDateOnly(ts) {
        return OrderUI && OrderUI.formatDateOnly ? OrderUI.formatDateOnly(ts) : "";
    }

    function formatDateYmd(ms) {
        var d = new Date(ms || Date.now());
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
    }

    function displaySheetNo(order) {
        return OrderUI && OrderUI.displayOrderSheetNo
            ? OrderUI.displayOrderSheetNo(order)
            : order.orderNo || order.id || "";
    }

    function setStatus(msg, isError) {
        if (!statusEl) return;
        statusEl.textContent = msg || "";
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function localYmd(d) {
        d = d || new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return y + "-" + m + "-" + day;
    }

    function defaultOrderDates() {
        var today = localYmd();
        if (orderDateFromEl && !orderDateFromEl.value) orderDateFromEl.value = today;
        if (orderDateToEl && !orderDateToEl.value) orderDateToEl.value = today;
    }

    function bindDatePickerOpen(el) {
        if (!el) return;
        function openPicker() {
            try {
                if (typeof el.showPicker === "function") el.showPicker();
            } catch (e) {}
        }
        el.addEventListener("click", openPicker);
        el.addEventListener("focus", openPicker);
    }

    function readTabFromUrl() {
        try {
            var tab = new URLSearchParams(window.location.search).get("tab");
            if (tab === "manual" || tab === "order") return tab;
        } catch (e) {}
        return "order";
    }

    function setActiveTab(tab) {
        activeTab = tab === "manual" ? "manual" : "order";
        if (tabOrderBtn) {
            tabOrderBtn.classList.toggle("is-active", activeTab === "order");
            tabOrderBtn.setAttribute("aria-selected", activeTab === "order" ? "true" : "false");
        }
        if (tabManualBtn) {
            tabManualBtn.classList.toggle("is-active", activeTab === "manual");
            tabManualBtn.setAttribute("aria-selected", activeTab === "manual" ? "true" : "false");
        }
        if (panelOrder) panelOrder.hidden = activeTab !== "order";
        if (panelManual) panelManual.hidden = activeTab !== "manual";
        if (activeTab === "manual") {
            loadManualList();
        }
    }

    function loadAdminOptions(selectEl) {
        if (!api || !api.listStaff || !selectEl) return Promise.resolve();
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
                    opts += '<option value="' + escapeHtml(id) + '">' + escapeHtml(label) + "</option>";
                });
            selectEl.innerHTML = opts;
        });
    }

    function transactionPdfActions() {
        return [
            {
                id: "txn-detail-pdf-view",
                label: "PDF 보기",
                primary: true,
                onClick: function (ord, btn) {
                    btn.disabled = true;
                    OrderUI.viewTransactionPdfWithAuth(api, ord.id)
                        .catch(function (err) {
                            alert((err && err.message) || "PDF를 열지 못했습니다.");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                }
            },
            {
                id: "txn-detail-pdf-save",
                label: "PDF 저장",
                onClick: function (ord, btn) {
                    btn.disabled = true;
                    OrderUI.downloadTransactionPdfWithAuth(api, ord.id, ord)
                        .catch(function (err) {
                            alert((err && err.message) || "PDF 저장에 실패했습니다.");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                }
            },
            {
                id: "txn-detail-pdf-print",
                label: "출력",
                onClick: function (ord, btn) {
                    btn.disabled = true;
                    OrderUI.printTransactionPdfWithAuth(api, ord.id)
                        .catch(function (err) {
                            alert((err && err.message) || "출력에 실패했습니다.");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                }
            }
        ];
    }

    function showOrderDetail(order) {
        if (!detailModal) return;
        if (!order) {
            detailModal.dismiss();
            return;
        }
        detailModal.show(order, {
            title: "거래명세서",
            showVendor: true,
            actions: transactionPdfActions()
        });
    }

    function groupOrdersByVendor(items) {
        var map = {};
        (items || []).forEach(function (it) {
            var name = String((it && it.vendorCompany) || "(회사명 없음)").trim() || "(회사명 없음)";
            if (!map[name]) {
                map[name] = { name: name, count: 0, totalAmount: 0, orders: [] };
            }
            map[name].count += 1;
            map[name].totalAmount += Number(it.totalAmount) || 0;
            map[name].orders.push(it);
        });
        return Object.keys(map)
            .sort(function (a, b) {
                return a.localeCompare(b, "ko");
            })
            .map(function (k) {
                return map[k];
            });
    }

    function selectOrder(id) {
        orderSelectedId = id;
        if (orderListEl) {
            orderListEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
                li.classList.toggle("is-selected", li.getAttribute("data-order-id") === id);
            });
        }
        if (!detailModal) return;
        detailModal.showLoading("거래명세서를 불러오는 중…");
        api.getOrder(id)
            .then(showOrderDetail)
            .catch(function (err) {
                detailModal.showError((err && err.message) || "주문서를 불러오지 못했습니다.");
            });
    }

    function bindOrderListEvents() {
        if (!orderListEl) return;
        orderListEl.querySelectorAll(".ol-admin-item[data-order-id]").forEach(function (li) {
            var id = li.getAttribute("data-order-id");
            li.addEventListener("click", function (e) {
                if (e.target.closest(".ol-admin-actions")) return;
                if (orderSelectedId === id) {
                    orderSelectedId = "";
                    li.classList.remove("is-selected");
                    showOrderDetail(null);
                    return;
                }
                selectOrder(id);
            });
            var pdfBtn = li.querySelector(".txn-btn-pdf");
            if (pdfBtn) {
                pdfBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    OrderUI.viewTransactionPdfWithAuth(api, id).catch(function (err) {
                        alert((err && err.message) || "PDF를 열지 못했습니다.");
                    });
                });
            }
        });
    }

    function setVendorListHeading() {
        if (!orderStepEl) return;
        orderStepEl.textContent = "구매업체 목록";
    }

    function setOrderListHeading(vendorCompany) {
        if (!orderStepEl) return;
        orderStepEl.textContent = "";
        orderStepEl.appendChild(document.createTextNode("주문서 목록 — "));
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "txn-vendor-back";
        btn.textContent = vendorCompany;
        btn.setAttribute("aria-label", vendorCompany + " — 구매업체 목록으로 돌아가기");
        btn.addEventListener("click", function () {
            renderVendorList(groupOrdersByVendor(orderCached));
        });
        orderStepEl.appendChild(btn);
    }

    function renderVendorList(groups) {
        orderViewMode = "vendors";
        orderSelectedVendor = "";
        orderSelectedId = "";
        showOrderDetail(null);
        setVendorListHeading();
        orderVendorGroups = groups;

        if (!orderListEl) return;
        if (!groups.length) {
            orderListEl.innerHTML = '<p class="am-list-empty">해당 기간에 주문한 구매업체가 없습니다.</p>';
            setStatus("0개 업체");
            return;
        }

        orderListEl.innerHTML =
            '<ul class="ol-admin-list">' +
            groups
                .map(function (g, idx) {
                    return (
                        '<li class="ol-admin-item ol-admin-item--vendor" data-vendor-idx="' +
                        String(idx) +
                        '" role="button" tabindex="0">' +
                        '<div class="ol-admin-main">' +
                        '<span class="ol-admin-name">' +
                        escapeHtml(g.name) +
                        "</span>" +
                        '<span class="ol-admin-meta">주문서 ' +
                        escapeHtml(String(g.count)) +
                        "건 · " +
                        escapeHtml(formatWon(g.totalAmount)) +
                        "</span></div></li>"
                    );
                })
                .join("") +
            "</ul>";

        orderListEl.querySelectorAll(".ol-admin-item--vendor").forEach(function (li) {
            li.addEventListener("click", function () {
                var idx = parseInt(li.getAttribute("data-vendor-idx") || "", 10);
                var g = orderVendorGroups[idx];
                if (g) renderOrderListForVendor(g.name);
            });
        });
        setStatus(groups.length + "개 구매업체 — 업체를 클릭하면 주문서 목록을 봅니다.");
    }

    function renderOrderListForVendor(vendorCompany) {
        orderViewMode = "orders";
        orderSelectedVendor = vendorCompany;
        orderSelectedId = "";
        showOrderDetail(null);
        setOrderListHeading(vendorCompany);

        var orders = orderCached.filter(function (it) {
            var name = String((it && it.vendorCompany) || "(회사명 없음)").trim() || "(회사명 없음)";
            return name === vendorCompany;
        });

        if (!orderListEl) return;
        if (!orders.length) {
            orderListEl.innerHTML = '<p class="am-list-empty">주문서가 없습니다.</p>';
            setStatus("0건");
            return;
        }

        orderListEl.innerHTML =
            '<ul class="ol-admin-list">' +
            orders
                .map(function (it) {
                    var sheetNo = displaySheetNo(it);
                    return (
                        '<li class="ol-admin-item" data-order-id="' +
                        escapeHtml(it.id) +
                        '" role="button" tabindex="0">' +
                        '<div class="ol-admin-main">' +
                        '<span class="ol-admin-name">' +
                        escapeHtml(sheetNo) +
                        "</span>" +
                        '<span class="ol-admin-meta">' +
                        escapeHtml(formatDateOnly(it.createdAt)) +
                        " · " +
                        escapeHtml(formatWon(it.totalAmount)) +
                        " · 품목 " +
                        escapeHtml(String(it.itemCount || 0)) +
                        "건</span></div>" +
                        '<div class="ol-admin-actions">' +
                        '<button type="button" class="btn btn-primary txn-btn-pdf">PDF 보기</button>' +
                        "</div></li>"
                    );
                })
                .join("") +
            "</ul>";
        bindOrderListEvents();
        setStatus(orders.length + "건 — 항목을 클릭하면 거래명세서 상세를 봅니다.");
    }

    function loadOrderList() {
        var dateFrom = String((orderDateFromEl && orderDateFromEl.value) || "").trim();
        var dateTo = String((orderDateToEl && orderDateToEl.value) || "").trim();
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setStatus("기간 선택이 올바르지 않습니다. (시작일 <= 종료일)", true);
            return;
        }
        setStatus("불러오는 중…");
        var opts = { dateFrom: dateFrom, dateTo: dateTo };
        if (isSupervisor && orderAdminEl) {
            var adminStaffId = String(orderAdminEl.value || "").trim();
            if (adminStaffId) opts.adminStaffId = adminStaffId;
        }

        api.listOrders(opts)
            .then(function (items) {
                orderCached = items || [];
                if (!orderCached.length) {
                    if (orderListEl) {
                        orderListEl.innerHTML = '<p class="am-list-empty">접수된 주문서가 없습니다.</p>';
                    }
                    showOrderDetail(null);
                    setStatus("0건");
                    setVendorListHeading();
                    orderViewMode = "vendors";
                    return;
                }
                if (orderViewMode === "orders" && orderSelectedVendor) {
                    renderOrderListForVendor(orderSelectedVendor);
                    return;
                }
                renderVendorList(groupOrdersByVendor(orderCached));
            })
            .catch(function (err) {
                setStatus((err && err.message) || "목록을 불러오지 못했습니다.", true);
            });
    }

    function manualPdfFilename(row) {
        var company = (row && row.vendorCompany) || "거래명세서";
        var date = formatDateYmd(row && row.issueDate).replace(/-/g, "");
        return "거래명세서_" + company.replace(/[<>:"/\\|?*]/g, "_") + "_" + date + ".pdf";
    }

    function bindManualRowActions() {
        if (!manualBodyEl) return;
        manualBodyEl.querySelectorAll("[data-txn-edit]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var id = btn.getAttribute("data-id");
                if (!id) return;
                window.location.href =
                    "transaction-manual-register.html?id=" + encodeURIComponent(id);
            });
        });
        manualBodyEl.querySelectorAll("[data-txn-pdf-view]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var id = btn.getAttribute("data-id");
                if (!id || !OrderUI.viewTransactionManualPdfWithAuth) return;
                btn.disabled = true;
                var row = manualCached.find(function (it) {
                    return it.id === id;
                });
                OrderUI.viewTransactionManualPdfWithAuth(api, id, manualPdfFilename(row))
                    .catch(function (err) {
                        alert((err && err.message) || "PDF를 열지 못했습니다.");
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        });
        manualBodyEl.querySelectorAll("[data-txn-pdf-save]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var id = btn.getAttribute("data-id");
                if (!id || !OrderUI.downloadTransactionManualPdfWithAuth) return;
                btn.disabled = true;
                var row = manualCached.find(function (it) {
                    return it.id === id;
                });
                OrderUI.downloadTransactionManualPdfWithAuth(api, id, manualPdfFilename(row))
                    .catch(function (err) {
                        alert((err && err.message) || "PDF 저장에 실패했습니다.");
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        });
        manualBodyEl.querySelectorAll("[data-txn-pdf-print]").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.preventDefault();
                var id = btn.getAttribute("data-id");
                if (!id || !OrderUI.printTransactionManualPdfWithAuth) return;
                btn.disabled = true;
                OrderUI.printTransactionManualPdfWithAuth(api, id)
                    .catch(function (err) {
                        alert((err && err.message) || "출력에 실패했습니다.");
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        });
    }

    function renderManualList(items) {
        manualCached = items || [];
        if (!manualBodyEl) return;
        if (!manualCached.length) {
            manualBodyEl.innerHTML = "";
            if (manualEmptyEl) manualEmptyEl.hidden = false;
            setStatus("수기 거래명세서 0건");
            return;
        }
        if (manualEmptyEl) manualEmptyEl.hidden = true;
        manualBodyEl.innerHTML = manualCached
            .map(function (it) {
                var itemCount = Array.isArray(it.items) ? it.items.length : 0;
                var title = it.title || it.vendorCompany || "";
                var issuer = it.issuerStaffName || it.issuerStaffLoginId || "";
                return (
                    "<tr>" +
                    "<td>" +
                    escapeHtml(formatDateYmd(it.issueDate)) +
                    "</td>" +
                    "<td>" +
                    escapeHtml(it.vendorCompany || "") +
                    "</td>" +
                    "<td>" +
                    escapeHtml(title) +
                    "</td>" +
                    "<td>" +
                    escapeHtml(issuer) +
                    "</td>" +
                    "<td>" +
                    escapeHtml(String(itemCount)) +
                    "건</td>" +
                    "<td>" +
                    escapeHtml(formatWon(it.totalAmount)) +
                    "</td>" +
                    '<td class="tml-col-act"><div class="tml-actions">' +
                    '<button type="button" class="btn btn-secondary" data-txn-edit data-id="' +
                    escapeAttr(it.id) +
                    '">수정</button>' +
                    '<button type="button" class="btn btn-primary" data-txn-pdf-view data-id="' +
                    escapeAttr(it.id) +
                    '">PDF 보기</button>' +
                    '<button type="button" class="btn btn-secondary" data-txn-pdf-save data-id="' +
                    escapeAttr(it.id) +
                    '">PDF 저장</button>' +
                    '<button type="button" class="btn btn-secondary" data-txn-pdf-print data-id="' +
                    escapeAttr(it.id) +
                    '">출력</button>' +
                    "</div></td>" +
                    "</tr>"
                );
            })
            .join("");
        bindManualRowActions();
        setStatus("수기 거래명세서 " + manualCached.length + "건");
    }

    function manualListOpts() {
        if (!isSupervisor || !manualAdminEl) return {};
        var id = String(manualAdminEl.value || "").trim();
        if (!id) return {};
        return { issuerStaffId: id };
    }

    function loadManualList() {
        if (activeTab !== "manual") return;
        if (!api || !api.listTransactionManual) {
            setStatus("API 오류", true);
            return;
        }
        setStatus("수기 목록 불러오는 중…");
        api
            .listTransactionManual(manualListOpts())
            .then(renderManualList)
            .catch(function (e) {
                renderManualList([]);
                setStatus((e && e.message) || "목록을 불러오지 못했습니다.", true);
            });
    }

    if (!Auth || !Auth.getOrderManageHubAccess) {
        setStatus("인증 스크립트 오류", true);
        return;
    }
    if (Auth.normalizeLegacySession) Auth.normalizeLegacySession();

    var access = Auth.getOrderManageHubAccess();
    if (!access.allowed) {
        setStatus(access.reason || "이용할 수 없습니다.", true);
        return;
    }

    isSupervisor = !!(Auth.isSupervisorStaff && Auth.isSupervisorStaff());
    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    if (orderAdminWrap) orderAdminWrap.hidden = !isSupervisor;
    if (manualFilterWrap) manualFilterWrap.hidden = !isSupervisor;

    if (DetailModal && DetailModal.create) {
        detailModal = DetailModal.create({
            modalId: "txn-detail-modal",
            panelId: "txn-detail-panel",
            listEl: orderListEl,
            itemSelector: ".ol-admin-item[data-order-id]",
            onDismiss: function () {
                orderSelectedId = "";
            }
        });
    }

    function switchTab(tab) {
        setActiveTab(tab);
        try {
            var url = new URL(window.location.href);
            url.searchParams.set("tab", tab);
            window.history.replaceState({}, "", url.pathname + url.search);
        } catch (e) {}
    }

    if (tabOrderBtn) {
        tabOrderBtn.addEventListener("click", function () {
            switchTab("order");
        });
    }
    if (tabManualBtn) {
        tabManualBtn.addEventListener("click", function () {
            switchTab("manual");
        });
    }

    defaultOrderDates();
    bindDatePickerOpen(orderDateFromEl);
    bindDatePickerOpen(orderDateToEl);

    if (orderSearchBtn) {
        orderSearchBtn.addEventListener("click", function () {
            orderViewMode = "vendors";
            orderSelectedVendor = "";
            loadOrderList();
        });
    }
    if (orderDateFromEl) {
        orderDateFromEl.addEventListener("change", function () {
            orderViewMode = "vendors";
            orderSelectedVendor = "";
            loadOrderList();
        });
    }
    if (orderDateToEl) {
        orderDateToEl.addEventListener("change", function () {
            orderViewMode = "vendors";
            orderSelectedVendor = "";
            loadOrderList();
        });
    }
    if (orderAdminEl) {
        orderAdminEl.addEventListener("change", function () {
            orderViewMode = "vendors";
            orderSelectedVendor = "";
            loadOrderList();
        });
    }
    if (manualSearchBtn) manualSearchBtn.addEventListener("click", loadManualList);
    if (manualAdminEl) manualAdminEl.addEventListener("change", loadManualList);

    var init = Promise.resolve();
    if (isSupervisor) {
        init = Promise.all([
            loadAdminOptions(orderAdminEl),
            loadAdminOptions(manualAdminEl)
        ]);
    }

    init.then(function () {
        setActiveTab(readTabFromUrl());
        if (activeTab === "order") {
            loadOrderList();
        }
    });
})();
