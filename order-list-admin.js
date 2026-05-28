(function () {
    var api = window.THEJHON_API;
    var Auth = window.THEJHON_AUTH;
    var OrderUI = window.THEJHON_ORDER_UI;
    var listEl = document.getElementById("ol-list");
    var detailEl = document.getElementById("ol-detail");
    var statusEl = document.getElementById("ol-status");
    var hintEl = document.getElementById("ol-hint");
    var dateFromEl = document.getElementById("ol-date-from");
    var dateToEl = document.getElementById("ol-date-to");
    var vendorNameEl = document.getElementById("ol-vendor-name");
    var vendorPickBtn = document.getElementById("ol-vendor-pick-btn");
    var vendorClearBtn = document.getElementById("ol-vendor-clear-btn");
    var vendorModal = document.getElementById("ol-vendor-modal");
    var vendorModalCloseBtn = document.getElementById("ol-vendor-modal-close");
    var vendorSearchEl = document.getElementById("ol-vendor-search");
    var vendorListEl = document.getElementById("ol-vendor-list");
    var selectedId = "";
    var selectedVendorName = "";
    var allVendors = [];

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
        if (!items.length) {
            vendorListEl.innerHTML = '<li><p class="am-list-empty" style="margin:0;padding:0.7rem">표시할 업체가 없습니다.</p></li>';
            return;
        }
        vendorListEl.innerHTML = items
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
        vendorListEl.querySelectorAll("[data-vendor-name]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                selectedVendorName = String(btn.getAttribute("data-vendor-name") || "");
                if (vendorNameEl) vendorNameEl.value = selectedVendorName;
                if (vendorModal) vendorModal.hidden = true;
                loadOrders();
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
                allVendors = (items || []).map(function (it) {
                    return { companyName: String((it && it.vn_company) || "").trim() };
                }).filter(function (it) {
                    return !!it.companyName;
                });
                renderVendorList("");
                if (vendorSearchEl) vendorSearchEl.focus();
            })
            .catch(function () {
                renderVendorList("");
            });
    }

    function showDetail(order) {
        if (!detailEl || !OrderUI) return;
        if (!order) {
            detailEl.hidden = true;
            detailEl.innerHTML = "";
            return;
        }
        detailEl.hidden = false;
        detailEl.innerHTML =
            '<h2 class="ol-detail-title">주문 상세</h2>' +
            OrderUI.renderOrderDetailHtml(order, { showVendor: true }) +
            '<div class="ol-detail-actions">' +
            '<button type="button" class="btn btn-primary" id="ol-detail-pdf">PDF 저장</button>' +
            '<button type="button" class="btn" id="ol-detail-close">닫기</button>' +
            "</div>";

        var closeBtn = document.getElementById("ol-detail-close");
        if (closeBtn) {
            closeBtn.addEventListener("click", function () {
                selectedId = "";
                listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
                    li.classList.remove("is-selected");
                });
                showDetail(null);
            });
        }
        var pdfBtn = document.getElementById("ol-detail-pdf");
        if (pdfBtn) {
            pdfBtn.addEventListener("click", function () {
                pdfBtn.disabled = true;
                OrderUI.downloadOrderPdfWithAuth(api, order.id, order.orderNo, order)
                    .catch(function (err) {
                        alert((err && err.message) || "PDF 저장에 실패했습니다.");
                    })
                    .finally(function () {
                        pdfBtn.disabled = false;
                    });
            });
        }
    }

    function selectOrder(id) {
        selectedId = id;
        listEl.querySelectorAll(".ol-admin-item").forEach(function (li) {
            li.classList.toggle("is-selected", li.getAttribute("data-order-id") === id);
        });
        if (!detailEl) return;
        detailEl.hidden = false;
        detailEl.innerHTML = '<p class="ol-detail-loading">주문 내용을 불러오는 중…</p>';
        api.getOrder(id)
            .then(function (order) {
                showDetail(order);
            })
            .catch(function (err) {
                detailEl.innerHTML =
                    '<p class="order-detail-empty">' +
                    escapeHtml((err && err.message) || "주문을 불러오지 못했습니다.") +
                    "</p>";
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
        setStatus(access.reason || "aksangsa 관리자 로그인이 필요합니다.", true);
        return;
    }

    if (hintEl) {
        hintEl.textContent =
            "목록을 클릭하면 주문 품목·금액이 아래에 표시됩니다. 담당 거래처의 회사명 기준으로 주문 목록이 표시됩니다.";
        hintEl.hidden = false;
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

    if (dateFromEl) dateFromEl.addEventListener("change", loadOrders);
    if (dateToEl) dateToEl.addEventListener("change", loadOrders);
    if (vendorNameEl) vendorNameEl.addEventListener("click", openVendorModal);
    if (vendorPickBtn) vendorPickBtn.addEventListener("click", openVendorModal);
    if (vendorClearBtn) {
        vendorClearBtn.addEventListener("click", function () {
            selectedVendorName = "";
            if (vendorNameEl) vendorNameEl.value = "";
            loadOrders();
        });
    }
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
