(function () {
    var root = document.getElementById("cart-root");
    var Cart = window.THEJHON_VENDOR_CART;
    var Auth = window.THEJHON_AUTH;
    var Api = window.THEJHON_API;

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

    function requireVendor() {
        if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn() || Auth.getRole() !== "vendor") {
            root.innerHTML =
                '<p class="cart-empty">업체 계정으로 로그인한 후 이용할 수 있습니다. <a href="login.html?next=' +
                encodeURIComponent(window.location.href) +
                '">로그인</a></p>';
            return false;
        }
        if (!Auth.canPlaceVendorOrders || !Auth.canPlaceVendorOrders()) {
            root.innerHTML =
                '<p class="cart-empty">이 계정은 주문·장바구니를 사용할 수 없습니다. ' +
                '<a href="products.html">사업부문</a>에서 상품 조회만 가능합니다. ' +
                "주문은 담당 거래처(aksangsa)에 등록된 업체만 이용할 수 있습니다.</p>";
            return false;
        }
        return true;
    }

    function showMsg(html, kind) {
        var el = document.getElementById("cart-status-msg");
        if (!el) return;
        el.className = "cart-msg cart-msg--" + (kind || "ok");
        el.innerHTML = html;
    }

    function render() {
        if (!root) return;
        if (!requireVendor()) return;

        var cart = Cart.readCart();
        if (!cart.items.length) {
            root.innerHTML =
                '<p class="cart-empty">장바구니가 비어 있습니다. <a href="products.html">사업부문</a>에서 상품을 담아 주세요.</p>';
            return;
        }

        var rows = cart.items
            .map(function (it) {
                return (
                    "<tr data-product-id=\"" +
                    escapeHtml(it.productId) +
                    "\"><td>" +
                    escapeHtml(it.productName) +
                    (it.pd_size ? "<br><small>" + escapeHtml(it.pd_size) + "</small>" : "") +
                    "</td><td>" +
                    escapeHtml(it.priceLabel || "") +
                    " " +
                    escapeHtml(formatWon(it.unitPrice)) +
                    '</td><td><input type="number" class="cart-qty" min="1" value="' +
                    escapeHtml(String(it.quantity)) +
                    '" aria-label="수량"></td><td>' +
                    escapeHtml(formatWon(Cart.lineTotal(it))) +
                    '</td><td><button type="button" class="btn-remove">삭제</button></td></tr>'
                );
            })
            .join("");

        root.innerHTML =
            '<div class="cart-table-wrap"><table class="cart-table"><thead><tr><th>상품</th><th>단가</th><th>수량</th><th>금액</th><th></th></tr></thead><tbody>' +
            rows +
            '</tbody></table></div><label class="cart-note-label" for="cart-note">주문 비고 (선택)</label><textarea id="cart-note" class="cart-note" rows="2" placeholder="배송·포장 요청 등"></textarea><div class="cart-actions-row"><button type="button" class="btn btn-primary" id="btnSubmitOrder">주문하기</button><a href="products.html" class="btn">쇼핑 계속</a><span class="cart-total">합계: ' +
            escapeHtml(formatWon(Cart.cartTotal(cart))) +
            '</span></div><div id="cart-status-msg" class="cart-msg" hidden></div>';

        var statusEl = document.getElementById("cart-status-msg");
        if (statusEl) statusEl.hidden = true;

        root.querySelectorAll(".cart-qty").forEach(function (inp) {
            inp.addEventListener("change", function () {
                var tr = inp.closest("tr");
                var pid = tr && tr.getAttribute("data-product-id");
                if (pid) Cart.setQuantity(pid, inp.value);
                render();
            });
        });
        root.querySelectorAll(".btn-remove").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var tr = btn.closest("tr");
                var pid = tr && tr.getAttribute("data-product-id");
                if (pid) Cart.removeItem(pid);
                render();
            });
        });

        var submitBtn = document.getElementById("btnSubmitOrder");
        if (submitBtn) {
            submitBtn.addEventListener("click", submitOrder);
        }
    }

    function submitOrder() {
        var cart = Cart.readCart();
        if (!cart.items.length) return;
        var noteEl = document.getElementById("cart-note");
        var note = noteEl ? String(noteEl.value || "").trim() : "";
        var body = {
            vendorCompany: Auth.getLoggedInCompanyDisplayName
                ? Auth.getLoggedInCompanyDisplayName()
                : "",
            vendorGrade: Auth.getVendorPriceGrade ? Auth.getVendorPriceGrade() : "",
            note: note,
            items: cart.items.map(function (it) {
                return {
                    productId: it.productId,
                    productName: it.productName,
                    pd_dept: it.pd_dept,
                    pd_size: it.pd_size,
                    unitPrice: it.unitPrice,
                    priceLabel: it.priceLabel,
                    quantity: it.quantity,
                    lineTotal: Cart.lineTotal(it)
                };
            })
        };

        var statusEl = document.getElementById("cart-status-msg");
        if (statusEl) {
            statusEl.hidden = false;
            statusEl.className = "cart-msg";
            statusEl.textContent = "주문 전송 중…";
        }

        Api.submitOrder(body)
            .then(function (res) {
                var order = res.order || {};
                var fullOrder = res.orderDetail || {
                    id: order.id,
                    orderNo: order.orderNo,
                    vendorCompany: body.vendorCompany,
                    vendorUserId: Auth.getUserId ? Auth.getUserId() : "",
                    items: body.items,
                    note: note,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt
                };

                Cart.clearCart();

                var sms = res.sms || {};
                var smsNote = "";
                if (sms.ok) {
                    smsNote = " 담당자 휴대폰으로 주문 문자가 전송되었습니다.";
                } else if (sms.skipped) {
                    smsNote =
                        " 문자(SMS)는 서버 Twilio 설정 후 자동 전송됩니다. 주문 내용은 PDF로 확인해 주세요.";
                } else if (sms.error) {
                    smsNote = " 문자 전송: " + sms.error;
                }

                if (window.THEJHON_ORDER_PDF && THEJHON_ORDER_PDF.downloadOrderPdf) {
                    THEJHON_ORDER_PDF.downloadOrderPdf(fullOrder).catch(function () {});
                }

                if (res.pdfUrl && Api.getToken && Api.getToken()) {
                    var a = document.createElement("a");
                    a.href = Api.orderPdfUrl(order.id);
                    a.target = "_blank";
                    a.rel = "noopener";
                    a.style.display = "none";
                    document.body.appendChild(a);
                }

                showMsg(
                    "주문이 접수되었습니다. 주문번호: <strong>" +
                        escapeHtml(order.orderNo || order.id) +
                        "</strong>." +
                        smsNote +
                        ' <a href="products.html">사업부문</a>으로 이동',
                    sms.ok ? "ok" : "warn"
                );
                render();
            })
            .catch(function (err) {
                showMsg(escapeHtml((err && err.message) || "주문에 실패했습니다."), "err");
            });
    }

    render();
    window.addEventListener("thejhon-cart-updated", render);
})();
