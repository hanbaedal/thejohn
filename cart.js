/**
 * 주문서 관리 — 접수된 주문만 조회 (담은 상품·주문하기는 모달)
 */
(function () {
    var Auth = window.THEJHON_AUTH;
    var Api = window.THEJHON_API;
    var OrderUI = window.THEJHON_ORDER_UI;
    var accessMsgEl = document.getElementById("cart-access-msg");
    var historyListEl = document.getElementById("cart-history-list");
    var historyDetailEl = document.getElementById("cart-history-detail");
    var historyStatusEl = document.getElementById("cart-history-status");
    var selectedHistoryId = "";

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function showAccessMsg(html) {
        if (!accessMsgEl) return;
        accessMsgEl.innerHTML = html;
        if (historyListEl) historyListEl.innerHTML = "";
        if (historyDetailEl) historyDetailEl.hidden = true;
        if (historyStatusEl) historyStatusEl.textContent = "";
    }

    function requireVendor() {
        if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn() || Auth.getRole() !== "vendor") {
            showAccessMsg(
                '<p class="cart-empty">업체 계정으로 로그인한 후 이용할 수 있습니다. <a href="login.html?next=' +
                    encodeURIComponent(window.location.href) +
                    '">로그인</a></p>'
            );
            return false;
        }
        if (!Auth.canPlaceVendorOrders || !Auth.canPlaceVendorOrders()) {
            showAccessMsg(
                '<p class="cart-empty">이 계정은 주문서 관리를 사용할 수 없습니다. ' +
                    '<a href="products.html">사업부문</a>에서 상품 조회만 가능합니다.</p>'
            );
            return false;
        }
        if (accessMsgEl) accessMsgEl.innerHTML = "";
        return true;
    }

    function showHistoryDetail(order) {
        if (!historyDetailEl || !OrderUI) return;
        if (!order) {
            historyDetailEl.hidden = true;
            historyDetailEl.innerHTML = "";
            return;
        }
        historyDetailEl.hidden = false;
        historyDetailEl.innerHTML =
            '<h2 class="cart-section-title" style="margin:0 0 0.75rem;font-size:1.05rem">주문 상세</h2>' +
            OrderUI.renderOrderDetailHtml(order, { showVendor: false }) +
            '<div class="cart-actions-row">' +
            '<button type="button" class="btn btn-primary" id="cart-history-pdf">PDF 저장</button>' +
            "</div>";
        var pdfBtn = document.getElementById("cart-history-pdf");
        if (pdfBtn) {
            pdfBtn.addEventListener("click", function () {
                pdfBtn.disabled = true;
                OrderUI.downloadOrderPdfWithAuth(Api, order.id, order.orderNo)
                    .catch(function (err) {
                        alert((err && err.message) || "PDF 저장에 실패했습니다.");
                    })
                    .finally(function () {
                        pdfBtn.disabled = false;
                    });
            });
        }
    }

    function selectHistoryOrder(id) {
        selectedHistoryId = id;
        if (historyListEl) {
            historyListEl.querySelectorAll(".cart-history-item").forEach(function (li) {
                li.classList.toggle("is-selected", li.getAttribute("data-order-id") === id);
            });
        }
        if (!historyDetailEl) return;
        historyDetailEl.hidden = false;
        historyDetailEl.innerHTML = '<p class="cart-empty">불러오는 중…</p>';
        Api.getOrder(id)
            .then(function (order) {
                showHistoryDetail(order);
            })
            .catch(function (err) {
                historyDetailEl.innerHTML =
                    '<p class="cart-empty">' +
                    escapeHtml((err && err.message) || "주문을 불러오지 못했습니다.") +
                    "</p>";
            });
    }

    function renderOrderHistory() {
        if (!requireVendor()) return;
        if (!historyListEl || !Api.listOrders) return;
        if (historyStatusEl) historyStatusEl.textContent = "접수된 주문을 불러오는 중…";

        Api.listOrders()
            .then(function (items) {
                if (!items.length) {
                    historyListEl.innerHTML =
                        '<p class="cart-empty">접수된 주문이 없습니다. <a href="products.html">사업부문</a>에서 상품을 담은 뒤 <strong>주문하기</strong>로 주문해 주세요.</p>';
                    showHistoryDetail(null);
                    if (historyStatusEl) historyStatusEl.textContent = "0건";
                    return;
                }
                historyListEl.innerHTML =
                    '<ul class="cart-history-list">' +
                    items
                        .map(function (it) {
                            return (
                                '<li class="cart-history-item" data-order-id="' +
                                escapeHtml(it.id) +
                                '" role="button" tabindex="0">' +
                                '<span class="cart-history-name">' +
                                escapeHtml(it.orderNo || it.id) +
                                "</span>" +
                                '<span class="cart-history-meta">' +
                                escapeHtml(OrderUI.formatDate(it.createdAt)) +
                                " · " +
                                escapeHtml(OrderUI.formatWon(it.totalAmount)) +
                                " · 품목 " +
                                escapeHtml(String(it.itemCount || 0)) +
                                "건</span></li>"
                            );
                        })
                        .join("") +
                    "</ul>";
                historyListEl.querySelectorAll(".cart-history-item").forEach(function (li) {
                    li.addEventListener("click", function () {
                        var oid = li.getAttribute("data-order-id");
                        if (selectedHistoryId === oid) {
                            selectedHistoryId = "";
                            li.classList.remove("is-selected");
                            showHistoryDetail(null);
                            return;
                        }
                        selectHistoryOrder(oid);
                    });
                });
                if (historyStatusEl) {
                    historyStatusEl.textContent =
                        items.length + "건 — 항목을 클릭하면 품목·금액을 확인할 수 있습니다.";
                }
            })
            .catch(function (err) {
                historyListEl.innerHTML = "";
                if (historyStatusEl) {
                    historyStatusEl.textContent =
                        (err && err.message) || "주문 목록을 불러오지 못했습니다.";
                }
            });
    }

    renderOrderHistory();
    window.addEventListener("thejhon-orders-updated", renderOrderHistory);
})();
