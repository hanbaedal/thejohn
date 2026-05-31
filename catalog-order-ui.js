/**
 * 사업부문 목록 카드 — 목록에 담기 · 주문하기 (담당 관리자 등록 상품)
 */
(function (global) {
    function canShowCatalogOrder() {
        if (!global.THEJHON_AUTH) return false;
        if (!global.THEJHON_AUTH.canPlaceVendorOrders) return false;
        return !!global.THEJHON_AUTH.canPlaceVendorOrders();
    }

    function canOrderProduct(it) {
        if (!canShowCatalogOrder()) return false;
        if (!global.THEJHON_AUTH || !global.THEJHON_AUTH.vendorProductCanOrder) return false;
        return !!global.THEJHON_AUTH.vendorProductCanOrder(it);
    }

    function renderOrderSection(it) {
        if (!canOrderProduct(it)) {
            return "";
        }
        return (
            '<section class="ps-order" aria-label="주문" data-ps-order>' +
            '<div class="ps-order-actions">' +
            '<button type="button" class="btn btn-primary ps-add-cart" data-ps-add>목록에 담기</button>' +
            '<button type="button" class="btn ps-open-order" data-ps-order-open>주문하기</button>' +
            "</div>" +
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
        if (!cardEl || !it || !canOrderProduct(it)) return;
        if (!global.THEJHON_VENDOR_CART) return;

        var orderSec = cardEl.querySelector("[data-ps-order]");
        if (!orderSec) return;

        var addBtn = orderSec.querySelector("[data-ps-add]");
        var openBtn = orderSec.querySelector("[data-ps-order-open]");
        if (!addBtn) return;

        function unitInfo() {
            if (global.THEJHON_AUTH && global.THEJHON_AUTH.getVendorUnitPriceForProduct) {
                return global.THEJHON_AUTH.getVendorUnitPriceForProduct(it);
            }
            return { unitPrice: 0, priceLabel: "" };
        }

        if (openBtn) {
            openBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation();
                var info = unitInfo();
                var res = global.THEJHON_VENDOR_CART.ensureItem({
                    productId: it.id,
                    productName: it.pd_name,
                    pd_dept: it.pd_dept,
                    pd_size: it.pd_size,
                    unitPrice: info.unitPrice,
                    priceLabel: info.priceLabel,
                    quantity: 1
                });
                if (!res.ok && res.error) {
                    window.alert(res.error);
                    return;
                }
                openOrderModal();
            });
        }

        addBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            var info = unitInfo();
            var res = global.THEJHON_VENDOR_CART.addItem({
                productId: it.id,
                productName: it.pd_name,
                pd_dept: it.pd_dept,
                pd_size: it.pd_size,
                unitPrice: info.unitPrice,
                priceLabel: info.priceLabel,
                quantity: 1
            });
            if (!res.ok && res.error) {
                window.alert(res.error);
            }
        });
    }

    global.THEJHON_CATALOG_ORDER = {
        canShow: canShowCatalogOrder,
        canOrderProduct: canOrderProduct,
        renderSection: renderOrderSection,
        bind: bindOrderSection,
        openOrderModal: openOrderModal
    };
})(typeof window !== "undefined" ? window : this);
