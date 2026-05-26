/**
 * 주문서 목록·상세 표시, PDF 다운로드(인증 헤더)
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

    function formatDate(ts) {
        if (!ts) return "";
        return new Date(ts).toLocaleString("ko-KR");
    }

    function renderOrderDetailHtml(order, opts) {
        opts = opts || {};
        if (!order) return '<p class="order-detail-empty">주문 정보가 없습니다.</p>';

        var rows = (order.items || [])
            .map(function (it, idx) {
                return (
                    "<tr><td>" +
                    escapeHtml(String(idx + 1)) +
                    "</td><td>" +
                    escapeHtml(it.productName || "") +
                    (it.pd_size ? "<br><small>" + escapeHtml(it.pd_size) + "</small>" : "") +
                    "</td><td>" +
                    escapeHtml(it.pd_dept_label || it.pd_dept || "") +
                    "</td><td>" +
                    escapeHtml(it.priceLabel || "") +
                    " " +
                    escapeHtml(formatWon(it.unitPrice)) +
                    "</td><td>" +
                    escapeHtml(String(it.quantity || 0)) +
                    "</td><td>" +
                    escapeHtml(formatWon(it.lineTotal)) +
                    "</td></tr>"
                );
            })
            .join("");

        var meta = [];
        meta.push("<dt>주문번호</dt><dd>" + escapeHtml(order.orderNo || order.id || "") + "</dd>");
        meta.push("<dt>주문일시</dt><dd>" + escapeHtml(formatDate(order.createdAt)) + "</dd>");
        if (opts.showVendor !== false) {
            meta.push(
                "<dt>주문 업체</dt><dd>" +
                    escapeHtml(order.vendorCompany || order.vendorUserId || "") +
                    "</dd>"
            );
        }
        if (order.vendorMgrName) {
            meta.push("<dt>주문 담당</dt><dd>" + escapeHtml(order.vendorMgrName) + "</dd>");
        }
        if (order.vendorMgrTel) {
            meta.push("<dt>담당 연락처</dt><dd>" + escapeHtml(order.vendorMgrTel) + "</dd>");
        }
        if (order.vendorRegisteredByName) {
            meta.push(
                "<dt>등록 담당</dt><dd>" + escapeHtml(order.vendorRegisteredByName) + "</dd>"
            );
        }
        if (order.note) {
            meta.push("<dt>비고</dt><dd>" + escapeHtml(order.note) + "</dd>");
        }

        return (
            '<div class="order-detail-panel">' +
            '<dl class="order-detail-meta">' +
            meta.join("") +
            "</dl>" +
            '<div class="order-detail-table-wrap"><table class="order-detail-table"><thead><tr>' +
            "<th>#</th><th>상품</th><th>부문</th><th>단가</th><th>수량</th><th>금액</th>" +
            "</tr></thead><tbody>" +
            (rows || '<tr><td colspan="6">품목 없음</td></tr>') +
            "</tbody></table></div>" +
            '<p class="order-detail-total">합계: <strong>' +
            escapeHtml(formatWon(order.totalAmount)) +
            "</strong></p>" +
            "</div>"
        );
    }

    function downloadOrderPdfWithAuth(api, orderId, orderNo, orderMeta) {
        if (!api || !api.fetchOrderPdfBlob) {
            return Promise.reject(new Error("PDF API를 사용할 수 없습니다."));
        }
        return api.fetchOrderPdfBlob(orderId).then(function (blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            function safeFilePart(s) {
                return String(s || "")
                    .trim()
                    .replace(/[\\/:*?"<>|]/g, "_")
                    .replace(/\s+/g, " ")
                    .slice(0, 60);
            }
            function ymd(ts) {
                var d = new Date(ts || Date.now());
                var y = d.getFullYear();
                var m = String(d.getMonth() + 1).padStart(2, "0");
                var day = String(d.getDate()).padStart(2, "0");
                return "" + y + m + day;
            }
            // 서버 파일명도 동일 규칙(주문회사_주문일자.pdf)을 사용하지만,
            // 브라우저 저장명은 여기서 한번 더 보장합니다.
            var meta = orderMeta || null;
            if (!meta && window.THEJHON_ORDER_UI) meta = THEJHON_ORDER_UI._lastOrderForPdf;
            var company = meta && meta.vendorCompany ? meta.vendorCompany : "";
            var createdAt = meta && meta.createdAt ? meta.createdAt : null;
            var base = safeFilePart(company || "주문서") + "_" + ymd(createdAt);
            a.download = base + ".pdf";
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () {
                URL.revokeObjectURL(url);
            }, 2000);
        });
    }

    global.THEJHON_ORDER_UI = {
        escapeHtml: escapeHtml,
        formatWon: formatWon,
        formatDate: formatDate,
        renderOrderDetailHtml: renderOrderDetailHtml,
        // 내부 상태: downloadOrderPdfWithAuth 저장명 생성에 사용
        _lastOrderForPdf: null,
        downloadOrderPdfWithAuth: downloadOrderPdfWithAuth
    };
})(typeof window !== "undefined" ? window : this);
