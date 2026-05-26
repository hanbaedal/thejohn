/**
 * 사업부문 목록 카드 — 수량·담기·주문하기 (상세 페이지 주문 UI와 동일 동작)
 */
(function (global) {
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatWon(n) {
        var num = Number(n);
        if (!isFinite(num)) return "0원";
        return num.toLocaleString("ko-KR") + "원";
    }

    function domSuffix(productId) {
        return String(productId || "x").replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    function canShowCatalogOrder() {
        if (!global.THEJHON_AUTH) return false;
        if (!global.THEJHON_AUTH.canPlaceVendorOrders) return false;
        return !!global.THEJHON_AUTH.canPlaceVendorOrders();
    }

    function browseOnlyHtml() {
        if (!global.THEJHON_AUTH || global.THEJHON_AUTH.getRole() !== "vendor") return "";
        return (
            '<p class="ps-order-browse-only">이 계정은 <strong>상품 조회</strong>만 가능합니다. ' +
            "주문·장바구니는 담당 거래처에 등록된 업체만 이용할 수 있습니다.</p>"
        );
    }

    function renderOrderSection(it) {
        if (!canShowCatalogOrder()) {
            return browseOnlyHtml();
        }
        var suf = domSuffix(it.id);
        var qtyField =
            global.THEJHON_QTY_STEPPER && global.THEJHON_QTY_STEPPER.html
                ? global.THEJHON_QTY_STEPPER.html(1, {
                      inputId: "ps-qty-" + suf,
                      className: "ps-qty-stepper"
                  })
                : '<input type="number" class="ps-qty-input" min="1" value="1" inputmode="numeric" id="ps-qty-' +
                  escapeHtml(suf) +
                  '">';

        return (
            '<section class="ps-order" aria-label="주문" data-ps-order>' +
            '<p class="ps-order-hint">수량을 입력한 뒤 목록에 담고, 아래 <strong>주문하기</strong>에서 확인·주문하세요.</p>' +
            '<div class="ps-order-row">' +
            '<label for="ps-qty-' +
            escapeHtml(suf) +
            '">수량</label>' +
            qtyField +
            '<button type="button" class="btn btn-primary ps-add-cart" data-ps-add>주문 목록에 담기</button>' +
            '<button type="button" class="btn ps-open-order" data-ps-order-open>주문하기</button>' +
            "</div>" +
            '<p class="ps-order-price" data-ps-order-price></p>' +
            '<p class="ps-order-msg" data-ps-order-msg role="status" hidden></p>' +
            "</section>"
        );
    }

    function openOrderModal() {
        function run() {
            if (global.THEJHON_VENDOR_ORDER_MODAL && global.THEJHON_VENDOR_ORDER_MODAL.open) {
                global.THEJHON_VENDOR_ORDER_MODAL.open();
            }
        }
        if (global.THEJHON_VENDOR_ORDER_MODAL) run();
        else if (global.loadVendorOrderModalAssets) global.loadVendorOrderModalAssets(run);
    }

    function bindOrderSection(cardEl, it) {
        if (!cardEl || !it || !canShowCatalogOrder()) return;
        if (!global.THEJHON_VENDOR_CART) return;

        var orderSec = cardEl.querySelector("[data-ps-order]");
        if (!orderSec) return;

        var qtyEl = orderSec.querySelector(".ps-qty-input, .ps-qty-stepper input");
        var stepperEl = orderSec.querySelector(".ps-qty-stepper");
        var addBtn = orderSec.querySelector("[data-ps-add]");
        var openBtn = orderSec.querySelector("[data-ps-order-open]");
        var msgEl = orderSec.querySelector("[data-ps-order-msg]");
        var priceEl = orderSec.querySelector("[data-ps-order-price]");
        if (!addBtn) return;

        var qtyCtl = null;

        function readQty() {
            if (qtyCtl) return qtyCtl.read();
            if (qtyEl) return Math.max(1, parseInt(qtyEl.value, 10) || 1);
            return 1;
        }

        function unitInfo() {
            if (global.THEJHON_AUTH && global.THEJHON_AUTH.getVendorUnitPriceForProduct) {
                return global.THEJHON_AUTH.getVendorUnitPriceForProduct(it);
            }
            return { unitPrice: 0, priceLabel: "" };
        }

        function updateLinePreview() {
            if (!priceEl) return;
            var info = unitInfo();
            var q = readQty();
            var lineLabel =
                global.THEJHON_AUTH && global.THEJHON_AUTH.DETAIL_PRICE_LABEL
                    ? global.THEJHON_AUTH.DETAIL_PRICE_LABEL
                    : "가격";
            priceEl.textContent =
                lineLabel +
                " " +
                formatWon(info.unitPrice) +
                " × " +
                q +
                " = " +
                formatWon((Number(info.unitPrice) || 0) * q);
        }

        if (openBtn) {
            openBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                openOrderModal();
            });
        }

        if (stepperEl && global.THEJHON_QTY_STEPPER && global.THEJHON_QTY_STEPPER.bind) {
            qtyCtl = global.THEJHON_QTY_STEPPER.bind(stepperEl, {
                onInput: updateLinePreview,
                onChange: updateLinePreview
            });
        } else if (qtyEl) {
            qtyEl.addEventListener("input", updateLinePreview);
        }
        updateLinePreview();

        addBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var info = unitInfo();
            var qty = readQty();
            var res = global.THEJHON_VENDOR_CART.addItem({
                productId: it.id,
                productName: it.pd_name,
                pd_dept: it.pd_dept,
                pd_size: it.pd_size,
                unitPrice: info.unitPrice,
                priceLabel: info.priceLabel,
                quantity: qty
            });
            if (msgEl) {
                msgEl.hidden = false;
                if (res.ok) {
                    msgEl.className = "ps-order-msg ps-order-msg--ok";
                    msgEl.textContent = "주문 목록에 담았습니다. 아래 주문하기로 확인하세요.";
                } else {
                    msgEl.className = "ps-order-msg ps-order-msg--err";
                    msgEl.textContent = res.error || "담기 실패";
                }
            }
        });
    }

    global.THEJHON_CATALOG_ORDER = {
        canShow: canShowCatalogOrder,
        renderSection: renderOrderSection,
        bind: bindOrderSection,
        openOrderModal: openOrderModal,
        escapeHtml: escapeHtml,
        formatWon: formatWon
    };
})(typeof window !== "undefined" ? window : this);
