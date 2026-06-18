/**
 * 사업부문 목록 카드 — 목록에 담기 · 주문하기 (담당 관리자 등록 상품)
 */
(function (global) {
    var ADD_LABEL = "목록에 담기";
    var ADDED_LABEL = "목록에 담음";

    function canShowCatalogOrder() {
        if (!global.THEJHON_AUTH) return false;
        if (
            global.THEJHON_AUTH &&
            global.THEJHON_AUTH.hasAccountSession &&
            !THEJHON_AUTH.hasAccountSession()
        ) {
            return false;
        }
        if (!global.THEJHON_AUTH.getVendorCartAccess) return false;
        return !!global.THEJHON_AUTH.getVendorCartAccess().allowed;
    }

    function canOrderProduct(it) {
        if (!canShowCatalogOrder()) return false;
        if (!global.THEJHON_AUTH || !global.THEJHON_AUTH.vendorProductCanOrder) return false;
        return !!global.THEJHON_AUTH.vendorProductCanOrder(it);
    }

    function escapeAttr(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
    }

    function speakAdded() {
        if (!global.speechSynthesis) return;
        try {
            global.speechSynthesis.cancel();
            var utter = new SpeechSynthesisUtterance("목록에 담았습니다");
            utter.lang = "ko-KR";
            utter.rate = 0.95;
            global.speechSynthesis.speak(utter);
        } catch (e) {}
    }

    function productInCart(productId) {
        var Cart = global.THEJHON_VENDOR_CART;
        if (!Cart || !productId) return false;
        if (Cart.hasProduct) return Cart.hasProduct(productId);
        var cart = Cart.readCart();
        var items = (cart && cart.items) || [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].productId === productId) return true;
        }
        return false;
    }

    function updateAddButton(btn, productId) {
        if (!btn || !productId) return;
        var inCart = productInCart(productId);
        btn.classList.toggle("ps-add-cart--added", inCart);
        btn.setAttribute("aria-pressed", inCart ? "true" : "false");
        btn.textContent = inCart ? ADDED_LABEL : ADD_LABEL;
    }

    function refreshAllAddButtons() {
        if (!canShowCatalogOrder()) return;
        document.querySelectorAll(".ps-add-cart[data-product-id]").forEach(function (btn) {
            updateAddButton(btn, btn.getAttribute("data-product-id"));
        });
    }

    function renderOrderSection(it) {
        if (!canOrderProduct(it)) {
            return "";
        }
        return (
            '<section class="ps-order" aria-label="주문" data-ps-order>' +
            '<div class="ps-order-actions">' +
            '<button type="button" class="btn btn-primary ps-add-cart" data-ps-add data-product-id="' +
            escapeAttr(it.id) +
            '">' +
            ADD_LABEL +
            '</button><button type="button" class="btn ps-open-order" data-ps-order-open>주문하기</button>' +
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

        if (orderSec.dataset.psBound === "1") {
            var existingBtn = orderSec.querySelector("[data-ps-add]");
            if (existingBtn) updateAddButton(existingBtn, it.id);
            return;
        }
        orderSec.dataset.psBound = "1";

        var addBtn = orderSec.querySelector("[data-ps-add]");
        var openBtn = orderSec.querySelector("[data-ps-order-open]");
        if (!addBtn) return;

        addBtn.setAttribute("data-product-id", it.id);

        function unitInfo() {
            if (global.THEJHON_AUTH && global.THEJHON_AUTH.getVendorUnitPriceForProduct) {
                return global.THEJHON_AUTH.getVendorUnitPriceForProduct(it);
            }
            return { unitPrice: 0, priceLabel: "" };
        }

        updateAddButton(addBtn, it.id);

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
                    quantity: 1,
                    pd_image: it.pd_image || "",
                    pd_has_image: !!it.pd_has_image || !!it.pd_image
                });
                if (!res.ok && res.error) {
                    window.alert(res.error);
                    return;
                }
                updateAddButton(addBtn, it.id);
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
                quantity: 1,
                pd_image: it.pd_image || "",
                pd_has_image: !!it.pd_has_image || !!it.pd_image
            });
            if (!res.ok && res.error) {
                window.alert(res.error);
                return;
            }
            speakAdded();
            updateAddButton(addBtn, it.id);
        });
    }

    global.THEJHON_CATALOG_ORDER = {
        canShow: canShowCatalogOrder,
        canOrderProduct: canOrderProduct,
        renderSection: renderOrderSection,
        bind: bindOrderSection,
        openOrderModal: openOrderModal,
        refreshAddButtons: refreshAllAddButtons
    };

    if (typeof global.addEventListener === "function") {
        global.addEventListener("thejhon-cart-updated", refreshAllAddButtons);
        global.addEventListener("DOMContentLoaded", refreshAllAddButtons);
    }
})(typeof window !== "undefined" ? window : this);
