(function () {
    var root = document.getElementById("cart-root");
    var Cart = window.THEJHON_VENDOR_CART;
    var Auth = window.THEJHON_AUTH;
    var Api = window.THEJHON_API;
    var OrderUI = window.THEJHON_ORDER_UI;
    var vendorContact = null;
    var contactReady = false;
    var selectedHistoryId = "";
    var historyListEl = document.getElementById("cart-history-list");
    var historyDetailEl = document.getElementById("cart-history-detail");
    var historyStatusEl = document.getElementById("cart-history-status");
    var historySectionEl = document.getElementById("cart-history-section");

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
        if (digits.length === 10 && digits.indexOf("02") === 0) {
            return digits.slice(0, 2) + "-" + digits.slice(2, 6) + "-" + digits.slice(6);
        }
        return String(tel || "").trim() || "—";
    }

    function telHref(tel) {
        var digits = String(tel || "").replace(/\D/g, "");
        if (!digits) return "";
        if (digits.indexOf("82") === 0) return "tel:+" + digits;
        if (digits.indexOf("0") === 0) return "tel:+82" + digits.slice(1);
        return "tel:" + digits;
    }

    function requireVendor() {
        if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn() || Auth.getRole() !== "vendor") {
            root.innerHTML =
                '<p class="cart-empty">업체 계정으로 로그인한 후 이용할 수 있습니다. <a href="login.html?next=' +
                encodeURIComponent(window.location.href) +
                '">로그인</a></p>';
            hideOrderFooter();
            if (historySectionEl) historySectionEl.hidden = true;
            return false;
        }
        if (!Auth.canPlaceVendorOrders || !Auth.canPlaceVendorOrders()) {
            root.innerHTML =
                '<p class="cart-empty">이 계정은 주문·내역을 사용할 수 없습니다. ' +
                '<a href="products.html">사업부문</a>에서 상품 조회만 가능합니다. ' +
                "주문은 담당 거래처(aksangsa)에 등록된 업체만 이용할 수 있습니다.</p>";
            hideOrderFooter();
            if (historySectionEl) historySectionEl.hidden = true;
            return false;
        }
        if (historySectionEl) historySectionEl.hidden = false;
        return true;
    }

    function hideOrderFooter() {
        var foot = document.getElementById("cartOrderFooter");
        if (foot) foot.hidden = true;
    }

    function updateOrderFooter(contact) {
        var foot = document.getElementById("cartOrderFooter");
        if (!foot) return;
        var company = document.getElementById("footerVendorCompany");
        var mgr = document.getElementById("footerVendorMgrName");
        var tel = document.getElementById("footerVendorMgrTel");
        if (!contact || !contact.mgrName || !contact.mgrTel) {
            foot.hidden = true;
            return;
        }
        if (company) company.textContent = contact.company || "—";
        if (mgr) mgr.textContent = contact.mgrName || "—";
        if (tel) {
            var href = telHref(contact.mgrTel);
            var label = formatTelDisplay(contact.mgrTel);
            if (href) {
                tel.innerHTML =
                    '<a class="footer-tel" href="' +
                    escapeHtml(href) +
                    '">' +
                    escapeHtml(label) +
                    "</a>";
            } else {
                tel.textContent = label;
            }
        }
        foot.hidden = false;
    }

    function showMsg(html, kind) {
        var el = document.getElementById("cart-status-msg");
        if (!el) return;
        el.className = "cart-msg cart-msg--" + (kind || "ok");
        el.innerHTML = html;
        el.hidden = false;
    }

    function contactConfirmHtml(contact) {
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
            '<section class="cart-contact-confirm" aria-labelledby="cart-contact-title">' +
            '<h2 class="cart-contact-title" id="cart-contact-title">주문 담당자 확인</h2>' +
            '<p class="cart-contact-desc">아래 담당자 정보로 주문이 접수·연락됩니다. 본인이 맞는지 확인해 주세요.</p>' +
            '<dl class="cart-contact-dl">' +
            "<dt>주문 업체</dt><dd>" +
            company +
            "</dd>" +
            "<dt>주문 담당</dt><dd>" +
            mgrName +
            "</dd>" +
            "<dt>연락처</dt><dd>" +
            telCell +
            "</dd>" +
            "</dl>" +
            warn +
            '<label class="cart-contact-check">' +
            '<input type="checkbox" id="cartContactConfirm"' +
            (missing ? " disabled" : "") +
            "> " +
            "위 주문 담당자가 <strong>본인</strong>이며, 주문·연락을 담당함을 확인합니다." +
            "</label>" +
            "</section>"
        );
    }

    function syncSubmitButton() {
        var btn = document.getElementById("btnSubmitOrder");
        var box = document.getElementById("cartContactConfirm");
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
        var box = document.getElementById("cartContactConfirm");
        if (box) {
            box.addEventListener("change", syncSubmitButton);
        }
        syncSubmitButton();
    }

    function loadVendorContactThen(fn) {
        if (!Auth.fetchVendorOrderContactAsync) {
            vendorContact = Auth.getVendorOrderContact ? Auth.getVendorOrderContact() : {};
            contactReady = true;
            updateOrderFooter(vendorContact);
            fn();
            return;
        }
        Auth.fetchVendorOrderContactAsync().then(function (c) {
            vendorContact = c || {};
            contactReady = true;
            updateOrderFooter(vendorContact);
            fn();
        });
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
            OrderUI.renderOrderDetailHtml(order, { showVendor: false }) +
            '<div class="cart-actions-row" style="margin-top:0.75rem">' +
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
        historyDetailEl.innerHTML = '<p class="cart-contact-desc">불러오는 중…</p>';
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
        if (!historyListEl || !Api.listOrders) return;
        if (historyStatusEl) historyStatusEl.textContent = "접수된 주문을 불러오는 중…";
        Api.listOrders()
            .then(function (items) {
                if (!items.length) {
                    historyListEl.innerHTML =
                        '<p class="cart-empty">아직 접수된 주문이 없습니다. 위에서 상품을 담아 주문해 주세요.</p>';
                    showHistoryDetail(null);
                    if (historyStatusEl) historyStatusEl.textContent = "";
                    return;
                }
                historyListEl.innerHTML =
                    '<ul class="cart-history-list">' +
                    items
                        .map(function (it) {
                            var label = OrderUI ? OrderUI.formatDate(it.createdAt) : "";
                            var won = OrderUI ? OrderUI.formatWon(it.totalAmount) : "";
                            return (
                                '<li class="cart-history-item" data-order-id="' +
                                escapeHtml(it.id) +
                                '" role="button" tabindex="0">' +
                                '<span class="cart-history-name">' +
                                escapeHtml(it.orderNo || it.id) +
                                "</span>" +
                                '<span class="cart-history-meta">' +
                                escapeHtml(label) +
                                " · " +
                                escapeHtml(won) +
                                " · 품목 " +
                                escapeHtml(String(it.itemCount || 0)) +
                                "건</span></li>"
                            );
                        })
                        .join("") +
                    "</ul>";
                historyListEl.querySelectorAll(".cart-history-item").forEach(function (li) {
                    li.addEventListener("click", function () {
                        var id = li.getAttribute("data-order-id");
                        if (selectedHistoryId === id) {
                            selectedHistoryId = "";
                            li.classList.remove("is-selected");
                            showHistoryDetail(null);
                            return;
                        }
                        selectHistoryOrder(id);
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
                        (err && err.message) || "주문 내역을 불러오지 못했습니다.";
                }
            });
    }

    function renderCartContent() {
        var cart = Cart.readCart();
        var pendingHtml;
        if (!cart.items.length) {
            pendingHtml =
                '<h2 class="cart-section-title" style="margin-top:0">담은 상품</h2>' +
                '<p class="cart-empty">담은 상품이 없습니다. <a href="products.html">사업부문</a>에서 상품을 담아 주세요.</p>';
            root.innerHTML = pendingHtml;
            hideOrderFooter();
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
            '<h2 class="cart-section-title" style="margin-top:0">담은 상품</h2>' +
            '<div class="cart-table-wrap"><table class="cart-table"><thead><tr><th>상품</th><th>단가</th><th>수량</th><th>금액</th><th></th></tr></thead><tbody>' +
            rows +
            "</tbody></table></div>" +
            contactConfirmHtml(vendorContact) +
            '<label class="cart-note-label" for="cart-note">주문 비고 (선택)</label><textarea id="cart-note" class="cart-note" rows="2" placeholder="배송·포장 요청 등"></textarea><div class="cart-actions-row"><button type="button" class="btn btn-primary" id="btnSubmitOrder" disabled>주문하기</button><a href="products.html" class="btn">쇼핑 계속</a><span class="cart-total">합계: ' +
            escapeHtml(formatWon(Cart.cartTotal(cart))) +
            '</span></div><div id="cart-status-msg" class="cart-msg" hidden></div>';

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
        bindContactConfirm();
    }

    function render() {
        if (!root) return;
        if (!requireVendor()) return;

        contactReady = false;
        loadVendorContactThen(function () {
            renderCartContent();
            renderOrderHistory();
        });
    }

    function submitOrder() {
        var cart = Cart.readCart();
        if (!cart.items.length) return;

        var confirmBox = document.getElementById("cartContactConfirm");
        if (!confirmBox || !confirmBox.checked) {
            showMsg("주문 담당자 확인에 체크해 주세요.", "err");
            return;
        }
        if (!vendorContact || !vendorContact.mgrName || !vendorContact.mgrTel) {
            showMsg("주문 담당자 정보가 없습니다. 업체 등록 정보를 확인해 주세요.", "err");
            return;
        }

        var noteEl = document.getElementById("cart-note");
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

        var submitBtn = document.getElementById("btnSubmitOrder");
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
                    vendorMgrEmail: vendorContact.mgrEmail || "",
                    items: body.items,
                    note: note,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt,
                    orderContactConfirmed: true
                };

                Cart.clearCart();
                hideOrderFooter();

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
                        " 아래 「접수된 주문」에서 확인할 수 있습니다.",
                    sms.ok ? "ok" : "warn"
                );
                selectedHistoryId = "";
                render();
            })
            .catch(function (err) {
                if (submitBtn) submitBtn.disabled = false;
                syncSubmitButton();
                showMsg(escapeHtml((err && err.message) || "주문에 실패했습니다."), "err");
            });
    }

    render();
    window.addEventListener("thejhon-cart-updated", render);
})();
