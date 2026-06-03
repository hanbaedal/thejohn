(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var OrderUI = window.THEJHON_ORDER_UI;
    var DetailModal = window.THEJHON_ORDER_DETAIL_MODAL;
    var listEl = document.getElementById("ol-list");
    var statusEl = document.getElementById("ol-status");
    var dateFromEl = document.getElementById("ol-date-from");
    var dateToEl = document.getElementById("ol-date-to");
    var vendorNameEl = document.getElementById("ol-vendor-name");
    var searchBtn = document.getElementById("ol-search-btn");
    var vendorModal = document.getElementById("ol-vendor-modal");
    var vendorModalCloseBtn = document.getElementById("ol-vendor-modal-close");
    var vendorSearchEl = document.getElementById("ol-vendor-search");
    var vendorListEl = document.getElementById("ol-vendor-list");
    var selectedId = "";
    var selectedVendorName = "";
    var allVendors = [];
    var detailModal = null;

    function escapeHtml(s) {
        return OrderUI ? OrderUI.escapeHtml(s) : String(s);
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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
        statusEl.style.color = isError ? "#a12c2c" : "#3d5166";
    }

    function renderVendorList(query) {
        if (!vendorListEl) return;
        var q = String(query || "").trim().toLowerCase();
        var items = allVendors.filter(function (v) {
            var name = String((v && v.companyName) || "").toLowerCase();
            return !q || name.indexOf(q) >= 0;
        });
        var listHtml =
            '<li><button type="button" class="ol-picker-item-btn ol-picker-item-btn--all" data-vendor-name="">전체</button></li>';
        if (!items.length) {
            vendorListEl.innerHTML =
                listHtml +
                '<li><p class="am-list-empty" style="margin:0;padding:0.7rem">표시할 업체가 없습니다.</p></li>';
            bindVendorPickerButtons();
            return;
        }
        vendorListEl.innerHTML =
            listHtml +
            items
            .map(function (v) {
                var name = escapeHtml(v.companyName || "");
                return (
                    '<li><button type="button" class="ol-picker-item-btn" data-vendor-name="' +
                    escapeAttr(v.companyName || "") +
                    '">' +
                    name +
                    "</button></li>"
                );
            })
            .join("");
        bindVendorPickerButtons();
    }

    function bindVendorPickerButtons() {
        if (!vendorListEl) return;
        vendorListEl.querySelectorAll("[data-vendor-name]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                selectedVendorName = String(btn.getAttribute("data-vendor-name") || "").trim();
                if (vendorNameEl) {
                    vendorNameEl.value = selectedVendorName || "";
                    vendorNameEl.placeholder = selectedVendorName ? "" : "업체 선택";
                }
                if (vendorModal) vendorModal.hidden = true;
            });
        });
    }

    function openVendorModal() {
        if (!api || !api.listVendors || !vendorModal) return;
        vendorModal.hidden = false;
        if (vendorSearchEl) vendorSearchEl.value = "";
        if (allVendors.length) {
            renderVendorList("");
            if (vendorSearchEl) vendorSearchEl.focus();
            return;
        }
        api.listVendors()
            .then(function (items) {
                allVendors = (items || [])
                    .map(function (it) {
                        return { companyName: String((it && it.vn_company) || "").trim() };
                    })
                    .filter(function (it) {
                        return !!it.companyName;
                    });
                renderVendorList("");
                if (vendorSearchEl) vendorSearchEl.focus();
            })
            .catch(function () {
                renderVendorList("");
            });
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

    function showDetail(order) {
        if (!detailModal) return;
        if (!order) {
            detailModal.dismiss();
            return;
        }
        detailModal.show(order, {
            title: "주문 상세",
            showVendor: true,
            actions: [
                {
                    id: "ol-detail-pdf",
                    label: "PDF 저장",
                    primary: true,
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
                }
            ]
        });
    }

    function selectOrder(id) {
        selectedId = id;
        listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
            li.classList.toggle("is-selected", li.getAttribute("data-order-id") === id);
        });
        if (!detailModal) return;
        detailModal.showLoading("주문 내용을 불러오는 중…");
        api.getOrder(id)
            .then(function (order) {
                showDetail(order);
            })
            .catch(function (err) {
                detailModal.showError((err && err.message) || "주문을 불러오지 못했습니다.");
            });
    }

    function bindListEvents(items) {
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
                    var row = items.find(function (it) {
                        return it.id === id;
                    });
                    OrderUI.downloadOrderPdfWithAuth(api, id, row && row.orderNo, row).catch(function (err) {
                        alert((err && err.message) || "PDF 저장에 실패했습니다.");
                    });
                });
            }
        });
    }

    var access =
        Auth && Auth.getOrderManageAccess
            ? Auth.getOrderManageAccess()
            : { allowed: false };
    if (!access.allowed) {
        setStatus(access.reason || "주문 권한이 있는 관리자 로그인이 필요합니다.", true);
        return;
    }

    if (Auth.setStaffNavMode) Auth.setStaffNavMode("order");

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

    function loadOrders() {
        var dateFrom = String((dateFromEl && dateFromEl.value) || "").trim();
        var dateTo = String((dateToEl && dateToEl.value) || "").trim();
        var vendorName = String(selectedVendorName || "").trim();
        if (dateFrom && dateTo && dateFrom > dateTo) {
            setStatus("기간 선택이 올바르지 않습니다. (시작일 <= 종료일)", true);
            return;
        }
        setStatus("불러오는 중…");
        api.listOrders({ dateFrom: dateFrom, dateTo: dateTo, vendorName: vendorName })
            .then(function (items) {
                if (!items.length) {
                    listEl.innerHTML = '<p class="am-list-empty">접수된 주문이 없습니다.</p>';
                    showDetail(null);
                    setStatus("0건");
                    return;
                }
                listEl.innerHTML =
                    '<ul class="ol-admin-list">' +
                    items
                        .map(function (it) {
                            return (
                                '<li class="ol-admin-item" data-order-id="' +
                                escapeHtml(it.id) +
                                '" role="button" tabindex="0">' +
                                '<div class="ol-admin-main">' +
                                '<span class="ol-admin-name">' +
                                escapeHtml(it.orderNo || it.id) +
                                " · " +
                                escapeHtml(it.vendorCompany || "(회사명 없음)") +
                                "</span>" +
                                '<span class="ol-admin-meta">' +
                                escapeHtml(formatDate(it.createdAt)) +
                                " · " +
                                escapeHtml(formatWon(it.totalAmount)) +
                                " · 품목 " +
                                escapeHtml(String(it.itemCount || 0)) +
                                "건" +
                                (it.vendorRegisteredByName
                                    ? " · 담당 " + escapeHtml(it.vendorRegisteredByName)
                                    : "") +
                                "</span></div>" +
                                '<div class="ol-admin-actions">' +
                                '<button type="button" class="btn btn-primary ol-btn-pdf">PDF</button>' +
                                "</div></li>"
                            );
                        })
                        .join("") +
                    "</ul>";
                bindListEvents(items);
                setStatus(items.length + "건 — 항목을 클릭해 상세를 확인하세요.");
            })
            .catch(function (err) {
                setStatus(err.message || "목록을 불러오지 못했습니다.", true);
            });
    }

    if (searchBtn) searchBtn.addEventListener("click", loadOrders);
    if (dateFromEl) dateFromEl.addEventListener("change", loadOrders);
    if (dateToEl) dateToEl.addEventListener("change", loadOrders);
    bindDatePickerOpen(dateFromEl);
    bindDatePickerOpen(dateToEl);
    if (vendorNameEl) vendorNameEl.addEventListener("click", openVendorModal);
    if (vendorModalCloseBtn) {
        vendorModalCloseBtn.addEventListener("click", function () {
            if (vendorModal) vendorModal.hidden = true;
        });
    }
    if (vendorModal) {
        vendorModal.addEventListener("click", function (e) {
            if (e.target === vendorModal) vendorModal.hidden = true;
        });
    }
    if (vendorSearchEl) {
        vendorSearchEl.addEventListener("input", function () {
            renderVendorList(vendorSearchEl.value);
        });
    }
    loadOrders();
})();
