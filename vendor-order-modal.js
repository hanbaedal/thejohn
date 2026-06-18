/**
 * 업체 담은 상품 — 모달에서 확인·주문하기
 */
(function (global) {
    var modalEl = null;
    var bodyEl = null;
    var vendorContact = null;
    var contactReady = false;
    /** 주문 접수 직후 clearCart → thejhon-cart-updated 시 빈 장바구니 화면으로 덮이지 않도록 */
    var orderSuccessPending = false;

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

    var ORDER_SUCCESS_SPEECH = "정상적으로 상품을 주문했습니다";
    /** TTS 미지원·onend 미호출 시 최대 대기 */
    var ORDER_SUCCESS_REDIRECT_FALLBACK_MS = 5000;
    /** 음성 종료 후 잠깐 여유 */
    var ORDER_SUCCESS_REDIRECT_BUFFER_MS = 600;

    function speakOrderSuccess(onDone) {
        var finished = false;
        function done() {
            if (finished) return;
            finished = true;
            if (typeof onDone === "function") onDone();
        }
        if (!global.speechSynthesis) {
            setTimeout(done, ORDER_SUCCESS_REDIRECT_FALLBACK_MS);
            return;
        }
        try {
            global.speechSynthesis.cancel();
            var utter = new SpeechSynthesisUtterance(ORDER_SUCCESS_SPEECH);
            utter.lang = "ko-KR";
            utter.rate = 0.95;
            utter.onend = function () {
                setTimeout(done, ORDER_SUCCESS_REDIRECT_BUFFER_MS);
            };
            utter.onerror = function () {
                setTimeout(done, ORDER_SUCCESS_REDIRECT_BUFFER_MS);
            };
            global.speechSynthesis.speak(utter);
            setTimeout(done, ORDER_SUCCESS_REDIRECT_FALLBACK_MS);
        } catch (e) {
            setTimeout(done, ORDER_SUCCESS_REDIRECT_FALLBACK_MS);
        }
    }

    function goToProductsHome() {
        global.location.href = "products.html";
    }

    function cartItemThumbHtml(it) {
        var src = String((it && it.pd_image) || "").trim();
        if (src) {
            return (
                '<div class="vom-cart-item__thumb">' +
                '<img src="' +
                escapeHtml(src) +
                '" alt="">' +
                "</div>"
            );
        }
        if (it && it.pd_has_image === false) {
            return (
                '<div class="vom-cart-item__thumb vom-cart-item__thumb--empty">' +
                '<span class="vom-cart-item__thumb-ph" aria-hidden="true"></span></div>'
            );
        }
        return (
            '<div class="vom-cart-item__thumb vom-cart-item__thumb--load" data-vom-cover="' +
            escapeHtml(it.productId) +
            '"><img alt="" hidden></div>'
        );
    }

    function loadCartThumbnails() {
        var Api = getApi();
        if (!bodyEl || !Api || !Api.get) return;
        bodyEl.querySelectorAll(".vom-cart-item__thumb--load[data-vom-cover]").forEach(function (wrap) {
            var pid = wrap.getAttribute("data-vom-cover");
            var img = wrap.querySelector("img");
            if (!pid || !img || img.src) return;
            Api.get("api/products/" + encodeURIComponent(pid) + "/cover")
                .then(function (data) {
                    if (!data || !data.pd_image) {
                        wrap.classList.remove("vom-cart-item__thumb--load");
                        wrap.classList.add("vom-cart-item__thumb--empty");
                        return;
                    }
                    img.src = data.pd_image;
                    img.hidden = false;
                    wrap.classList.remove("vom-cart-item__thumb--load");
                })
                .catch(function () {
                    wrap.classList.remove("vom-cart-item__thumb--load");
                    wrap.classList.add("vom-cart-item__thumb--empty");
                });
        });
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
                '<p class="cart-empty">이 계정은 주문할 수 없습니다. 주문 권한이 있는 관리자에게 등록된 업체만 주문할 수 있습니다.</p>';
            return;
        }

        var cart = Cart.readCart();
        if (!cart.items.length) {
            bodyEl.innerHTML =
                '<p class="cart-empty">담은 상품이 없습니다. <a href="products.html">사업부문</a> 목록에서 <strong>목록에 담기</strong>를 누르거나, 상품 카드의 <strong>주문하기</strong>를 이용해 주세요.</p>' +
                '<div class="cart-actions-row"><a href="products.html" class="btn btn-primary">사업부문으로</a></div>';
            return;
        }

        var savedForm = readFormState();

        var rows = cart.items
            .map(function (it) {
                var specText = String(it.pd_size || "").trim() || "—";
                var priceText =
                    (it.priceLabel ? it.priceLabel + " " : "") + formatWon(it.unitPrice);
                var qtyHtml =
                    window.THEJHON_QTY_STEPPER && THEJHON_QTY_STEPPER.html
                        ? THEJHON_QTY_STEPPER.html(it.quantity, {
                              className: "cart-qty-stepper vom-cart-qty-stepper"
                          })
                        : '<input type="number" class="cart-qty" min="1" step="1" inputmode="numeric" value="' +
                          escapeHtml(String(it.quantity)) +
                          '" aria-label="수량">';
                return (
                    '<div class="vom-cart-item" data-product-id="' +
                    escapeHtml(it.productId) +
                    '">' +
                    cartItemThumbHtml(it) +
                    '<div class="vom-cart-item__main">' +
                    '<div class="vom-cart-item__center">' +
                    '<div class="vom-cart-item__name">' +
                    escapeHtml(it.productName) +
                    "</div>" +
                    '<div class="vom-cart-item__qty">' +
                    qtyHtml +
                    "</div>" +
                    '<div class="vom-cart-item__total cart-line-total">' +
                    escapeHtml(formatWon(Cart.lineTotal(it))) +
                    "</div></div>" +
                    '<div class="vom-cart-item__side">' +
                    '<div class="vom-cart-item__spec">' +
                    escapeHtml(specText) +
                    "</div>" +
                    '<div class="vom-cart-item__price">' +
                    escapeHtml(priceText) +
                    "</div>" +
                    '<button type="button" class="btn-remove">삭제</button>' +
                    "</div></div></div>"
                );
            })
            .join("");

        bodyEl.innerHTML =
            '<div class="vendor-order-modal__scroll">' +
            '<div class="vom-cart-list">' +
            rows +
            "</div>" +
            contactInfoHtml(vendorContact) +
            "</div>" +
            '<div class="vendor-order-modal__footer">' +
            contactCheckHtml(vendorContact) +
            '<label class="cart-note-label" for="vom-note">주문 비고 (선택)</label>' +
            '<textarea id="vom-note" class="cart-note" rows="2" placeholder="배송·포장 요청 등" inputmode="text"></textarea>' +
            '<div class="cart-actions-row">' +
            '<button type="button" class="btn btn-primary vom-submit-order" id="vomSubmitOrder" disabled>주문하기</button>' +
            '<button type="button" class="btn vom-continue-shop" id="vomContinueShop">쇼핑 계속</button>' +
            '<span class="cart-total"><span class="cart-total__label">주문 합계 : </span><span class="cart-total__amount">' +
            escapeHtml(formatWon(Cart.cartTotal(cart))) +
            "</span></span></div>" +
            '<div id="vom-status-msg" class="cart-msg" hidden></div></div>';

        applyFormState(savedForm);

        if (window.THEJHON_QTY_STEPPER && THEJHON_QTY_STEPPER.bind) {
            bodyEl.querySelectorAll(".qty-stepper").forEach(function (el) {
                THEJHON_QTY_STEPPER.bind(el, {
                    onChange: function (q) {
                        var row = el.closest(".vom-cart-item");
                        var pid = row && row.getAttribute("data-product-id");
                        if (pid) Cart.setQuantity(pid, q);
                        renderBody();
                    },
                    onInput: function (q) {
                        var row = el.closest(".vom-cart-item");
                        var pid = row && row.getAttribute("data-product-id");
                        if (!pid) return;
                        var lineEl = row.querySelector(".cart-line-total");
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
                    var row = inp.closest(".vom-cart-item");
                    var pid = row && row.getAttribute("data-product-id");
                    if (pid) Cart.setQuantity(pid, inp.value);
                    renderBody();
                }
                inp.addEventListener("change", commitQty);
                inp.addEventListener("blur", commitQty);
            });
        }
        bodyEl.querySelectorAll(".btn-remove").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var row = btn.closest(".vom-cart-item");
                var pid = row && row.getAttribute("data-product-id");
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
        loadCartThumbnails();
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
            vendorCompany: Auth.getVendorCompanyName
                ? Auth.getVendorCompanyName()
                : Auth.getLoggedInCompanyDisplayName
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

                orderSuccessPending = true;
                Cart.clearCart();
                window.dispatchEvent(new CustomEvent("thejhon-orders-updated"));

                close();
                speakOrderSuccess(goToProductsHome);
            })
            .catch(function (err) {
                if (submitBtn) submitBtn.disabled = false;
                syncSubmitButton();
                showMsg(escapeHtml((err && err.message) || "주문에 실패했습니다."), "err");
            });
    }

    function ensureQtyStepper(cb) {
        if (global.THEJHON_QTY_STEPPER && global.THEJHON_QTY_STEPPER.html) {
            cb();
            return;
        }
        var existing = document.getElementById("script-qty-stepper");
        if (existing) {
            var n = 0;
            var wait = setInterval(function () {
                n++;
                if ((global.THEJHON_QTY_STEPPER && global.THEJHON_QTY_STEPPER.html) || n > 80) {
                    clearInterval(wait);
                    cb();
                }
            }, 50);
            return;
        }
        var s = document.createElement("script");
        s.id = "script-qty-stepper";
        s.src = "qty-stepper.js";
        s.onload = function () {
            cb();
        };
        s.onerror = function () {
            cb();
        };
        document.body.appendChild(s);
    }

    function open() {
        ensureShell();
        contactReady = false;
        modalEl.hidden = false;
        document.body.style.overflow = "hidden";
        bodyEl.innerHTML = '<p class="cart-empty">불러오는 중…</p>';
        ensureQtyStepper(function () {
            loadVendorContactThen(function () {
                renderBody();
            });
        });
    }

    function close() {
        if (!modalEl) return;
        orderSuccessPending = false;
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
            if (modalEl && !modalEl.hidden && !orderSuccessPending) {
                loadVendorContactThen(renderBody);
            }
        }
    };

    window.addEventListener("thejhon-cart-updated", function () {
        if (modalEl && !modalEl.hidden && !orderSuccessPending) {
            loadVendorContactThen(renderBody);
        }
    });
})(typeof window !== "undefined" ? window : this);
