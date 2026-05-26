/**
 * 업체 담은 상품 — 모달에서 확인·주문하기
 */
(function (global) {
    var modalEl = null;
    var bodyEl = null;
    var vendorContact = null;
    var contactReady = false;

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

    function formatTelDisplay(tel) {
        var digits = String(tel || "").replace(/\D/g, "");
        if (digits.length === 11 && digits.indexOf("010") === 0) {
            return digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
        }
        return String(tel || "").trim() || "—";
    }

    function telHref(tel) {
        var digits = String(tel || "").replace(/\D/g, "");
        if (!digits) return "";
        if (digits.indexOf("0") === 0) return "tel:+82" + digits.slice(1);
        return "tel:" + digits;
    }

    function getAuth() {
        return global.THEJHON_AUTH;
    }

    function getCart() {
        return global.THEJHON_VENDOR_CART;
    }

    function getApi() {
        return global.THEJHON_API;
    }

    function ensureShell() {
        if (modalEl) return;
        modalEl = document.createElement("div");
        modalEl.id = "vendorOrderModal";
        modalEl.className = "vendor-order-modal";
        modalEl.hidden = true;
        modalEl.setAttribute("role", "dialog");
        modalEl.setAttribute("aria-modal", "true");
        modalEl.setAttribute("aria-labelledby", "vendorOrderModalTitle");
        modalEl.innerHTML =
            '<div class="vendor-order-modal__panel">' +
            '<div class="vendor-order-modal__head">' +
            '<h2 class="vendor-order-modal__title" id="vendorOrderModalTitle">주문하기</h2>' +
            '<button type="button" class="vendor-order-modal__close" id="vendorOrderModalClose" aria-label="닫기">&times;</button>' +
            "</div>" +
            '<div id="vendorOrderModalBody" class="vendor-order-modal__body"></div>' +
            "</div>";
        document.body.appendChild(modalEl);
        bodyEl = document.getElementById("vendorOrderModalBody");

        var panelEl = modalEl.querySelector(".vendor-order-modal__panel");
        if (panelEl) {
            panelEl.addEventListener("click", function (e) {
                e.stopPropagation();
            });
        }
        modalEl.addEventListener("click", function (e) {
            if (e.target === modalEl) close();
        });
        document.getElementById("vendorOrderModalClose").addEventListener("click", close);
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && modalEl && !modalEl.hidden) close();
        });
    }

    function showMsg(html, kind) {
        var el = document.getElementById("vom-status-msg");
        if (!el) return;
        el.className = "cart-msg cart-msg--" + (kind || "ok");
        el.innerHTML = html;
        el.hidden = false;
    }

    function readFormState() {
        var box = document.getElementById("vomContactConfirm");
        var noteEl = document.getElementById("vom-note");
        return {
            confirmed: !!(box && box.checked),
            note: noteEl ? String(noteEl.value || "") : ""
        };
    }

    function applyFormState(state) {
        if (!state) return;
        var box = document.getElementById("vomContactConfirm");
        var noteEl = document.getElementById("vom-note");
        if (box && state.confirmed) box.checked = true;
        if (noteEl) noteEl.value = state.note || "";
    }

    function contactInfoHtml(contact) {
        var company = escapeHtml((contact && contact.company) || "—");
        var mgrName = escapeHtml((contact && contact.mgrName) || "—");
        var mgrTel = (contact && contact.mgrTel) || "";
        var telLabel = escapeHtml(formatTelDisplay(mgrTel));
        var telLink = telHref(mgrTel);
        var telCell = telLink
            ? '<a href="' + escapeHtml(telLink) + '">' + telLabel + "</a>"
            : telLabel;
        var missing =
            !contact || !String(contact.mgrName || "").trim() || !String(contact.mgrTel || "").trim();
        var warn = missing
            ? '<p class="cart-contact-warn">업체 등록에 주문 담당자 이름·연락처가 없습니다. 관리자에게 업체 정보 수정을 요청해 주세요.</p>'
            : "";

        return (
            '<section class="cart-contact-confirm" aria-labelledby="vom-contact-title">' +
            '<h3 class="cart-contact-title" id="vom-contact-title">주문 담당자 확인</h3>' +
            '<p class="cart-contact-desc">아래 담당자 정보로 주문이 접수·연락됩니다.</p>' +
            '<dl class="cart-contact-dl">' +
            "<dt>주문 업체</dt><dd>" +
            company +
            "</dd><dt>주문 담당</dt><dd>" +
            mgrName +
            "</dd><dt>연락처</dt><dd>" +
            telCell +
            "</dd></dl>" +
            warn +
            "</section>"
        );
    }

    function contactCheckHtml(contact) {
        var missing =
            !contact || !String(contact.mgrName || "").trim() || !String(contact.mgrTel || "").trim();
        return (
            '<label class="cart-contact-check">' +
            '<input type="checkbox" id="vomContactConfirm"' +
            (missing ? " disabled" : "") +
            '> <span class="cart-contact-check-text">위 주문 담당자가 <strong>본인</strong>이며, 주문·연락을 담당함을 확인합니다.</span></label>'
        );
    }

    function syncSubmitButton() {
        var btn = document.getElementById("vomSubmitOrder");
        var box = document.getElementById("vomContactConfirm");
        if (!btn) return;
        var ok =
            contactReady &&
            vendorContact &&
            vendorContact.mgrName &&
            vendorContact.mgrTel &&
            box &&
            box.checked;
        btn.disabled = !ok;
    }

    function bindContactConfirm() {
        var box = document.getElementById("vomContactConfirm");
        if (box) box.addEventListener("change", syncSubmitButton);
        syncSubmitButton();
    }

    function loadVendorContactThen(fn) {
        var Auth = getAuth();
        if (!Auth || !Auth.fetchVendorOrderContactAsync) {
            vendorContact = Auth && Auth.getVendorOrderContact ? Auth.getVendorOrderContact() : {};
            contactReady = true;
            fn();
            return;
        }
        Auth.fetchVendorOrderContactAsync().then(function (c) {
            vendorContact = c || {};
            contactReady = true;
            fn();
        });
    }

    function renderBody() {
        var Cart = getCart();
        var Auth = getAuth();
        if (!bodyEl || !Cart) return;

        if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn() || Auth.getRole() !== "vendor") {
            bodyEl.innerHTML =
                '<p class="cart-empty">업체 계정으로 <a href="login.html">로그인</a> 후 이용해 주세요.</p>';
            return;
        }
        if (!Auth.canPlaceVendorOrders || !Auth.canPlaceVendorOrders()) {
            bodyEl.innerHTML =
                '<p class="cart-empty">이 계정은 주문할 수 없습니다. 담당 거래처(aksangsa)에 등록된 업체만 주문할 수 있습니다.</p>';
            return;
        }

        var cart = Cart.readCart();
        if (!cart.items.length) {
            bodyEl.innerHTML =
                '<p class="cart-empty">담은 상품이 없습니다. <a href="products.html">사업부문</a>에서 상품을 담아 주세요.</p>' +
                '<div class="cart-actions-row"><a href="products.html" class="btn btn-primary">사업부문으로</a></div>';
            return;
        }

        var savedForm = readFormState();

        var rows = cart.items
            .map(function (it) {
                return (
                    "<tr data-product-id=\"" +
                    escapeHtml(it.productId) +
                    '"><td data-label="">' +
                    escapeHtml(it.productName) +
                    (it.pd_size ? "<br><small>" + escapeHtml(it.pd_size) + "</small>" : "") +
                    '</td><td data-label="단가">' +
                    escapeHtml(it.priceLabel || "") +
                    " " +
                    escapeHtml(formatWon(it.unitPrice)) +
                    '</td><td data-label="수량">' +
                    (window.THEJHON_QTY_STEPPER && THEJHON_QTY_STEPPER.html
                        ? THEJHON_QTY_STEPPER.html(it.quantity, { className: "cart-qty-stepper" })
                        : '<input type="number" class="cart-qty" min="1" step="1" inputmode="numeric" value="' +
                          escapeHtml(String(it.quantity)) +
                          '" aria-label="수량">') +
                    '</td><td class="cart-line-total" data-label="금액">' +
                    escapeHtml(formatWon(Cart.lineTotal(it))) +
                    '</td><td data-label=""><button type="button" class="btn-remove">삭제</button></td></tr>'
                );
            })
            .join("");

        bodyEl.innerHTML =
            '<div class="vendor-order-modal__scroll">' +
            '<div class="cart-table-wrap"><table class="cart-table"><thead><tr><th>상품</th><th>단가</th><th>수량</th><th>금액</th><th></th></tr></thead><tbody>' +
            rows +
            "</tbody></table></div>" +
            contactInfoHtml(vendorContact) +
            "</div>" +
            '<div class="vendor-order-modal__footer">' +
            contactCheckHtml(vendorContact) +
            '<label class="cart-note-label" for="vom-note">주문 비고 (선택)</label>' +
            '<textarea id="vom-note" class="cart-note" rows="2" placeholder="배송·포장 요청 등" inputmode="text"></textarea>' +
            '<div class="cart-actions-row">' +
            '<button type="button" class="btn btn-primary vom-submit-order" id="vomSubmitOrder" disabled>주문하기</button>' +
            '<button type="button" class="btn vom-continue-shop" id="vomContinueShop">쇼핑 계속</button>' +
            '<span class="cart-total">합계: ' +
            escapeHtml(formatWon(Cart.cartTotal(cart))) +
            "</span></div>" +
            '<div id="vom-status-msg" class="cart-msg" hidden></div></div>';

        applyFormState(savedForm);

        if (window.THEJHON_QTY_STEPPER && THEJHON_QTY_STEPPER.bind) {
            bodyEl.querySelectorAll(".qty-stepper").forEach(function (el) {
                THEJHON_QTY_STEPPER.bind(el, {
                    onChange: function (q) {
                        var tr = el.closest("tr");
                        var pid = tr && tr.getAttribute("data-product-id");
                        if (pid) Cart.setQuantity(pid, q);
                        renderBody();
                    },
                    onInput: function (q) {
                        var tr = el.closest("tr");
                        var pid = tr && tr.getAttribute("data-product-id");
                        if (!pid) return;
                        var lineEl = tr.querySelector(".cart-line-total");
                        var item = null;
                        var items = Cart.readCart().items;
                        for (var i = 0; i < items.length; i++) {
                            if (items[i].productId === pid) {
                                item = items[i];
                                break;
                            }
                        }
                        if (item && lineEl) {
                            lineEl.textContent = formatWon(
                                Cart.lineTotal(Object.assign({}, item, { quantity: q }))
                            );
                        }
                    }
                });
            });
        } else {
            bodyEl.querySelectorAll(".cart-qty").forEach(function (inp) {
                function commitQty() {
                    var tr = inp.closest("tr");
                    var pid = tr && tr.getAttribute("data-product-id");
                    if (pid) Cart.setQuantity(pid, inp.value);
                    renderBody();
                }
                inp.addEventListener("change", commitQty);
                inp.addEventListener("blur", commitQty);
            });
        }
        bodyEl.querySelectorAll(".btn-remove").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var tr = btn.closest("tr");
                var pid = tr && tr.getAttribute("data-product-id");
                if (pid) Cart.removeItem(pid);
                renderBody();
            });
        });

        var submitBtn = document.getElementById("vomSubmitOrder");
        if (submitBtn) {
            submitBtn.addEventListener("click", function () {
                if (submitBtn.disabled) {
                    showMsg("주문 담당자 확인에 체크해 주세요.", "err");
                    var box = document.getElementById("vomContactConfirm");
                    if (box) {
                        try {
                            box.focus({ preventScroll: false });
                        } catch (ignore) {}
                        box.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                    return;
                }
                submitOrder();
            });
        }

        var shopBtn = document.getElementById("vomContinueShop");
        if (shopBtn) {
            shopBtn.addEventListener("click", function () {
                close();
                window.location.href = "products.html";
            });
        }
        bindContactConfirm();
    }

    function submitOrder() {
        var Cart = getCart();
        var Auth = getAuth();
        var Api = getApi();
        if (!Cart || !Auth || !Api) return;

        var cart = Cart.readCart();
        if (!cart.items.length) return;

        var confirmBox = document.getElementById("vomContactConfirm");
        if (!confirmBox || !confirmBox.checked) {
            showMsg("주문 담당자 확인에 체크해 주세요.", "err");
            return;
        }

        var noteEl = document.getElementById("vom-note");
        var note = noteEl ? String(noteEl.value || "").trim() : "";
        var body = {
            vendorCompany: Auth.getLoggedInCompanyDisplayName
                ? Auth.getLoggedInCompanyDisplayName()
                : "",
            vendorGrade: Auth.getVendorPriceGrade ? Auth.getVendorPriceGrade() : "",
            note: note,
            orderContactConfirmed: true,
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

        var submitBtn = document.getElementById("vomSubmitOrder");
        if (submitBtn) submitBtn.disabled = true;
        showMsg("주문 전송 중…", "ok");

        Api.submitOrder(body)
            .then(function (res) {
                var order = res.order || {};
                var fullOrder = res.orderDetail || {
                    id: order.id,
                    orderNo: order.orderNo,
                    vendorCompany: body.vendorCompany,
                    vendorUserId: Auth.getUserId ? Auth.getUserId() : "",
                    vendorMgrName: vendorContact.mgrName,
                    vendorMgrTel: vendorContact.mgrTel,
                    items: body.items,
                    note: note,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt
                };

                Cart.clearCart();
                window.dispatchEvent(new CustomEvent("thejhon-cart-updated"));
                window.dispatchEvent(new CustomEvent("thejhon-orders-updated"));

                var savedId = order.id || fullOrder.id;
                if (
                    savedId &&
                    global.THEJHON_ORDER_UI &&
                    THEJHON_ORDER_UI.downloadOrderPdfWithAuth &&
                    global.THEJHON_API
                ) {
                    // PDF 저장 파일명(주문회사_주문일자.pdf) 생성에 사용
                    THEJHON_ORDER_UI._lastOrderForPdf = fullOrder;
                    THEJHON_ORDER_UI.downloadOrderPdfWithAuth(
                        THEJHON_API,
                        savedId,
                        order.orderNo || fullOrder.orderNo
                    ).catch(function () {});
                }

                showMsg(
                    "주문이 접수되었습니다. 주문번호: <strong>" +
                        escapeHtml(order.orderNo || order.id) +
                        "</strong>. " +
                        '<a href="cart.html">주문서 보기</a>에서 확인할 수 있습니다.',
                    "ok"
                );

                setTimeout(function () {
                    close();
                }, 2200);
            })
            .catch(function (err) {
                if (submitBtn) submitBtn.disabled = false;
                syncSubmitButton();
                showMsg(escapeHtml((err && err.message) || "주문에 실패했습니다."), "err");
            });
    }

    function open() {
        ensureShell();
        contactReady = false;
        modalEl.hidden = false;
        document.body.style.overflow = "hidden";
        bodyEl.innerHTML = '<p class="cart-empty">불러오는 중…</p>';
        loadVendorContactThen(function () {
            renderBody();
        });
    }

    function close() {
        if (!modalEl) return;
        modalEl.hidden = true;
        document.body.style.overflow = "";
    }

    function toggle() {
        if (modalEl && !modalEl.hidden) close();
        else open();
    }

    global.THEJHON_VENDOR_ORDER_MODAL = {
        open: open,
        close: close,
        toggle: toggle,
        refresh: function () {
            if (modalEl && !modalEl.hidden) {
                loadVendorContactThen(renderBody);
            }
        }
    };

    window.addEventListener("thejhon-cart-updated", function () {
        if (modalEl && !modalEl.hidden) {
            loadVendorContactThen(renderBody);
        }
    });
})(typeof window !== "undefined" ? window : this);
