/**
 * 업체(vendor) 로그인 전용 장바구니 (localStorage)
 */
(function (global) {
    var CART_KEY = "thejhon_vendor_cart_v1";

    function canUseCart() {
        return (
            global.THEJHON_AUTH &&
            THEJHON_AUTH.isLoggedIn &&
            THEJHON_AUTH.isLoggedIn() &&
            THEJHON_AUTH.getRole &&
            THEJHON_AUTH.getRole() === "vendor"
        );
    }

    function readCart() {
        try {
            var raw = localStorage.getItem(CART_KEY);
            if (!raw) return { items: [], updatedAt: 0 };
            var data = JSON.parse(raw);
            if (!data || !Array.isArray(data.items)) return { items: [], updatedAt: 0 };
            return data;
        } catch (e) {
            return { items: [], updatedAt: 0 };
        }
    }

    function writeCart(data) {
        data.updatedAt = Date.now();
        localStorage.setItem(CART_KEY, JSON.stringify(data));
        try {
            global.dispatchEvent(new CustomEvent("thejhon-cart-updated"));
        } catch (e) {}
    }

    function findIndex(items, productId) {
        for (var i = 0; i < items.length; i++) {
            if (items[i].productId === productId) return i;
        }
        return -1;
    }

    /** 목록에 없을 때만 1개 담기 (카드 「주문하기」용 — 이미 있으면 수량 유지) */
    function ensureItem(item) {
        if (!canUseCart()) return { ok: false, error: "업체 로그인 후 이용할 수 있습니다." };
        var cart = readCart();
        if (findIndex(cart.items, item.productId) >= 0) {
            return { ok: true, cart: cart };
        }
        return addItem(item);
    }

    function addItem(item) {
        if (!canUseCart()) return { ok: false, error: "업체 로그인 후 이용할 수 있습니다." };
        var cart = readCart();
        var qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        var idx = findIndex(cart.items, item.productId);
        var row = {
            productId: item.productId,
            productName: item.productName || "",
            pd_dept: item.pd_dept || "",
            pd_size: item.pd_size || "",
            unitPrice: Number(item.unitPrice) || 0,
            priceLabel: item.priceLabel || "",
            quantity: qty
        };
        if (idx >= 0) {
            cart.items[idx].quantity += qty;
            cart.items[idx].unitPrice = row.unitPrice;
            cart.items[idx].priceLabel = row.priceLabel;
        } else {
            cart.items.push(row);
        }
        writeCart(cart);
        return { ok: true, cart: cart };
    }

    function setQuantity(productId, quantity) {
        var cart = readCart();
        var idx = findIndex(cart.items, productId);
        if (idx < 0) return { ok: false };
        var q = parseInt(quantity, 10);
        if (!isFinite(q) || q < 1) {
            cart.items.splice(idx, 1);
        } else {
            cart.items[idx].quantity = q;
        }
        writeCart(cart);
        return { ok: true, cart: cart };
    }

    function removeItem(productId) {
        var cart = readCart();
        var idx = findIndex(cart.items, productId);
        if (idx >= 0) cart.items.splice(idx, 1);
        writeCart(cart);
        return { ok: true, cart: cart };
    }

    function clearCart() {
        writeCart({ items: [] });
    }

    function lineTotal(row) {
        return (Number(row.unitPrice) || 0) * (Number(row.quantity) || 0);
    }

    function cartTotal(cart) {
        var sum = 0;
        var items = (cart && cart.items) || [];
        for (var i = 0; i < items.length; i++) sum += lineTotal(items[i]);
        return sum;
    }

    function itemCount(cart) {
        var n = 0;
        var items = (cart && cart.items) || [];
        for (var i = 0; i < items.length; i++) n += Number(items[i].quantity) || 0;
        return n;
    }

    global.THEJHON_VENDOR_CART = {
        CART_KEY: CART_KEY,
        canUseCart: canUseCart,
        readCart: readCart,
        addItem: addItem,
        ensureItem: ensureItem,
        setQuantity: setQuantity,
        removeItem: removeItem,
        clearCart: clearCart,
        lineTotal: lineTotal,
        cartTotal: cartTotal,
        itemCount: itemCount
    };
})(typeof window !== "undefined" ? window : this);
