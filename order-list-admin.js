(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var OrderUI = window.THEJHON_ORDER_UI;
    var DetailModal = window.THEJHON_ORDER_DETAIL_MODAL;
    var listEl = document.getElementById("ol-list");
    var statusEl = document.getElementById("ol-status");
    var stepHeadingEl = document.getElementById("ol-step-heading");
    var backBtnEl = document.getElementById("ol-back-btn");
    var dateFromEl = document.getElementById("ol-date-from");
    var dateToEl = document.getElementById("ol-date-to");
    var searchBtn = document.getElementById("ol-search-btn");
    var selectedId = "";
    var viewMode = "vendors";
    var selectedVendorCompany = "";
    var cachedOrders = [];
    var vendorGroups = [];
    var detailModal = null;

    function escapeHtml(s) {
        return OrderUI ? OrderUI.escapeHtml(s) : String(s);
    }

    function formatWon(n) {
        return OrderUI ? OrderUI.formatWon(n) : String(n);
    }

    function formatDateOnly(ts) {
        return OrderUI && OrderUI.formatDateOnly ? OrderUI.formatDateOnly(ts) : "";
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

    function defaultDatesToday() {
        var today = localYmd();
        if (dateFromEl && !dateFromEl.value) dateFromEl.value = today;
        if (dateToEl && !dateToEl.value) dateToEl.value = today;
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

    function pdfActions() {
        return [
            {
                id: "ol-detail-pdf-view",
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
                id: "ol-detail-pdf-save",
                label: "PDF 저장",
                onClick: function (ord, btn) {
                    btn.disabled = true;
                    OrderUI.downloadOrderPdfWithAuth(api, ord.id, ord.orderNo, ord)
                        .catch(function (err) {
                            alert((err && err.message) || "PDF 저장에 실패했습니다.");
                        })
                        .finally(function () {
                            btn.disabled = false;
                        });
                }
            },
            {
                id: "ol-detail-pdf-print",
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
        ];
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
            actions: pdfActions()
        });
    }

    function selectOrder(id) {
        selectedId = id;
        listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
            li.classList.toggle("is-selected", li.getAttribute("data-order-id") === id);
        });
        if (!detailModal) return;
        detailModal.showLoading("주문서를 불러오는 중…");
        api.getOrder(id)
            .then(function (order) {
                showDetail(order);
            })
            .catch(function (err) {
                detailModal.showError((err && err.message) || "주문서를 불러오지 못했습니다.");
            });
    }

    function bindOrderListEvents(orders) {
        listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
            var id = li.getAttribute("data-order-id");
            li.addEventListener("click", function (e) {
                if (e.target.closest(".ol-admin-actions")) return;
                if (selectedId === id) {
                    selectedId = "";
                    li.classList.remove("is-selected");
                    showDetail(null);
                    return;
                }
                selectOrder(id);
            });
            var pdfBtn = li.querySelector(".ol-btn-pdf");
            if (pdfBtn) {
                pdfBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    OrderUI.viewOrderPdfWithAuth(api, id).catch(function (err) {
                        alert((err && err.message) || "PDF를 열지 못했습니다.");
                    });
                });
            }
        });
    }

    function renderVendorList(groups) {
        viewMode = "vendors";
        selectedVendorCompany = "";
        selectedId = "";
        showDetail(null);
        if (backBtnEl) backBtnEl.hidden = true;
        if (stepHeadingEl) stepHeadingEl.textContent = "구매업체 목록";

        vendorGroups = groups;
        if (!groups.length) {
            listEl.innerHTML = '<p class="am-list-empty">해당 기간에 주문한 구매업체가 없습니다.</p>';
            setStatus("0개 업체");
            return;
        }

        listEl.innerHTML =
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

        listEl.querySelectorAll(".ol-admin-item--vendor").forEach(function (li) {
            li.addEventListener("click", function () {
                var idx = parseInt(li.getAttribute("data-vendor-idx") || "", 10);
                var g = vendorGroups[idx];
                if (g) renderOrderListForVendor(g.name);
            });
        });
        setStatus(groups.length + "개 구매업체 — 업체를 클릭하면 주문서 목록을 봅니다.");
    }

    function renderOrderListForVendor(vendorCompany) {
        viewMode = "orders";
        selectedVendorCompany = vendorCompany;
        selectedId = "";
        showDetail(null);
        if (backBtnEl) backBtnEl.hidden = false;
        if (stepHeadingEl) {
            stepHeadingEl.textContent = "주문서 목록 — " + vendorCompany;
        }

        var orders = cachedOrders.filter(function (it) {
            var name = String((it && it.vendorCompany) || "(회사명 없음)").trim() || "(회사명 없음)";
            return name === vendorCompany;
        });

        if (!orders.length) {
            listEl.innerHTML = '<p class="am-list-empty">주문서가 없습니다.</p>';
            setStatus("0건");
            return;
        }

        listEl.innerHTML =
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
                        '<button type="button" class="btn btn-primary ol-btn-pdf">PDF 보기</button>' +
                        "</div></li>"
                    );
                })
                .join("") +
            "</ul>";
        bindOrderListEvents(orders);
        setStatus(orders.length + "건 — 항목을 클릭하면 주문서 상세를 봅니다.");
    }

    function loadOrders() {
        var dateFrom = String((dateFromEl && dateFromEl.value) || "").trim();
        var dateTo = String((dateToEl && dateToEl.value) || "").trim();
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setStatus("기간 선택이 올바르지 않습니다. (시작일 <= 종료일)", true);
            return;
        }
        setStatus("불러오는 중…");
        api.listOrders({ dateFrom: dateFrom, dateTo: dateTo })
            .then(function (items) {
                cachedOrders = items || [];
                if (!cachedOrders.length) {
                    listEl.innerHTML = '<p class="am-list-empty">접수된 주문서가 없습니다.</p>';
                    showDetail(null);
                    setStatus("0건");
                    if (backBtnEl) backBtnEl.hidden = true;
                    if (stepHeadingEl) stepHeadingEl.textContent = "구매업체 목록";
                    viewMode = "vendors";
                    return;
                }
                if (viewMode === "orders" && selectedVendorCompany) {
                    renderOrderListForVendor(selectedVendorCompany);
                    return;
                }
                renderVendorList(groupOrdersByVendor(cachedOrders));
            })
            .catch(function (err) {
                setStatus(err.message || "목록을 불러오지 못했습니다.", true);
            });
    }

    var access =
        Auth && Auth.getOrderManageAccess
            ? Auth.getOrderManageAccess()
            : { allowed: false };
    if (!access.allowed) {
        setStatus(access.reason || "관리자 로그인이 필요합니다.", true);
        return;
    }

    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");
    if (Auth.refreshOrderHeader) Auth.refreshOrderHeader();

    if (DetailModal && DetailModal.create) {
        detailModal = DetailModal.create({
            modalId: "ol-detail-modal",
            panelId: "ol-detail-panel",
            listEl: listEl,
            itemSelector: ".ol-admin-item",
            onDismiss: function () {
                selectedId = "";
            }
        });
    }

    defaultDatesToday();
    if (searchBtn) searchBtn.addEventListener("click", function () {
        viewMode = "vendors";
        selectedVendorCompany = "";
        loadOrders();
    });
    if (dateFromEl) dateFromEl.addEventListener("change", function () {
        viewMode = "vendors";
        selectedVendorCompany = "";
        loadOrders();
    });
    if (dateToEl) dateToEl.addEventListener("change", function () {
        viewMode = "vendors";
        selectedVendorCompany = "";
        loadOrders();
    });
    bindDatePickerOpen(dateFromEl);
    bindDatePickerOpen(dateToEl);
    if (backBtnEl) {
        backBtnEl.addEventListener("click", function () {
            renderVendorList(groupOrdersByVendor(cachedOrders));
        });
    }
    loadOrders();
})();
