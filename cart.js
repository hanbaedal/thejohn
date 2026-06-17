/**
 * 주문서 보기 — 접수된 주문만 조회 (담은 상품·주문하기는 사업부문 목록·주문 모달)
 */
(function () {
    var Auth = window.THEJHON_AUTH;
    var Api = window.THEJHON_API;
    var OrderUI = window.THEJHON_ORDER_UI;
    var accessMsgEl = document.getElementById("cart-access-msg");
    var historyListEl = document.getElementById("cart-history-list");
    var historyModalEl = document.getElementById("cart-history-detail-modal");
    var historyDetailEl = document.getElementById("cart-history-detail");
    var historyStatusEl = document.getElementById("cart-history-status");
    var selectedHistoryId = "";

    function openDetailModal() {
        if (!historyModalEl) return;
        historyModalEl.hidden = false;
        historyModalEl.classList.add("is-open");
        document.body.classList.add("cart-detail-modal-open");
        document.body.style.overflow = "hidden";
    }

    function closeDetailModal() {
        if (historyModalEl) {
            historyModalEl.hidden = true;
            historyModalEl.classList.remove("is-open");
        }
        if (historyDetailEl) historyDetailEl.innerHTML = "";
        document.body.classList.remove("cart-detail-modal-open");
        document.body.style.overflow = "";
    }

    function dismissHistoryDetail() {
        selectedHistoryId = "";
        if (historyListEl) {
            historyListEl.querySelectorAll(".cart-history-item").forEach(function (li) {
                li.classList.remove("is-selected");
            });
        }
        closeDetailModal();
    }

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
        dismissHistoryDetail();
        if (historyStatusEl) historyStatusEl.textContent = "";
    }

    function requireVendor() {
        if (Auth && Auth.isGuest && Auth.isGuest()) {
            showAccessMsg(
                '<p class="cart-empty">게스트는 주문·장바구니를 이용할 수 없습니다. ' +
                    '<a href="products.html">사업부문</a>에서 상품만 열람할 수 있습니다.</p>'
            );
            return false;
        }
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
                '<p class="cart-empty">이 계정은 주문서 보기를 사용할 수 없습니다. ' +
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
            closeDetailModal();
            return;
        }
        openDetailModal();
        historyDetailEl.innerHTML =
            '<div class="cart-detail-head">' +
            '<h2 id="cart-detail-title" class="cart-detail-title">주문 상세</h2>' +
            '<button type="button" class="cart-detail-modal__close" id="cart-history-head-close" aria-label="닫기">×</button>' +
            "</div>" +
            '<div class="cart-detail-layout">' +
            '<div class="cart-detail-meta-wrap">' +
            OrderUI.renderOrderDetailMetaHtml(order, { showVendor: false }) +
            "</div>" +
            '<div class="cart-detail-items-scroll" tabindex="0" aria-label="주문 품목 목록">' +
            OrderUI.renderOrderDetailItemsHtml(order) +
            "</div>" +
            '<div class="cart-detail-foot">' +
            OrderUI.renderOrderDetailTotalHtml(order) +
            '<div class="cart-actions-row">' +
            '<button type="button" class="btn btn-primary" id="cart-history-pdf">PDF 저장</button>' +
            '<button type="button" class="btn" id="cart-history-delete">삭제</button>' +
            '<button type="button" class="btn" id="cart-history-close-btn">닫기</button>' +
            "</div></div></div>";
        var closeBtn = document.getElementById("cart-history-close-btn");
        if (closeBtn) closeBtn.addEventListener("click", dismissHistoryDetail);
        var headCloseBtn = document.getElementById("cart-history-head-close");
        if (headCloseBtn) headCloseBtn.addEventListener("click", dismissHistoryDetail);
        var pdfBtn = document.getElementById("cart-history-pdf");
        if (pdfBtn) {
            pdfBtn.addEventListener("click", function () {
                pdfBtn.disabled = true;
                OrderUI.downloadOrderPdfWithAuth(Api, order.id, order.orderNo, order)
                    .catch(function (err) {
                        alert((err && err.message) || "PDF 저장에 실패했습니다.");
                    })
                    .finally(function () {
                        pdfBtn.disabled = false;
                    });
            });
        }
        var delBtn = document.getElementById("cart-history-delete");
        if (delBtn) {
            delBtn.addEventListener("click", function () {
                if (!Api || !Api.deleteOrder) {
                    alert("삭제 API를 사용할 수 없습니다.");
                    return;
                }
                var ok = confirm("이 주문서를 삭제할까요? 삭제 후 복구할 수 없습니다.");
                if (!ok) return;
                delBtn.disabled = true;
                Api.deleteOrder(order.id)
                    .then(function () {
                        dismissHistoryDetail();
                        renderOrderHistory();
                    })
                    .catch(function (err) {
                        alert((err && err.message) || "주문서 삭제에 실패했습니다.");
                    })
                    .finally(function () {
                        delBtn.disabled = false;
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
        openDetailModal();
        historyDetailEl.innerHTML = '<p class="cart-empty" style="padding:1rem">불러오는 중…</p>';
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
                        '<p class="cart-empty">접수된 주문이 없습니다. <a href="products.html">사업부문</a> 목록에서 담은 뒤 <strong>주문하기</strong>로 주문해 주세요.</p>';
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
                            dismissHistoryDetail();
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

    if (historyDetailEl) {
        historyDetailEl.addEventListener("click", function (e) {
            e.stopPropagation();
        });
    }
    if (historyModalEl) {
        historyModalEl.addEventListener("click", function (e) {
            if (e.target === historyModalEl) dismissHistoryDetail();
        });
    }
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && historyModalEl && !historyModalEl.hidden) {
            dismissHistoryDetail();
        }
    });

    renderOrderHistory();
    window.addEventListener("thejhon-orders-updated", renderOrderHistory);
})();
