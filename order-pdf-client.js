/**
 * @deprecated 한글 미지원. 주문 PDF는 서버 API(THEJHON_ORDER_UI.downloadOrderPdfWithAuth) 사용.
 * 브라우저 jsPDF — 레거시 (Helvetica, 한글 깨짐)
 */
(function (global) {
    function formatWon(n) {
        var num = Number(n);
        if (!isFinite(num)) return "0원";
        return num.toLocaleString("ko-KR") + "원";
    }

    function addLines(doc, lines, x, yRef, maxY, lineH) {
        var y = yRef.value;
        lineH = lineH || 5.5;
        for (var i = 0; i < lines.length; i++) {
            if (!lines[i]) continue;
            if (y > maxY) {
                doc.addPage();
                y = 18;
            }
            var split = doc.splitTextToSize(String(lines[i]), 182);
            doc.text(split, x, y);
            y += split.length * lineH + 1;
        }
        yRef.value = y;
    }

    function downloadOrderPdf(order) {
        if (!global.jspdf || !global.jspdf.jsPDF) {
            return Promise.reject(new Error("PDF 라이브러리를 불러오지 못했습니다."));
        }
        var doc = new global.jspdf.jsPDF({ unit: "mm", format: "a4" });
        var yRef = { value: 16 };
        var supplier = order.supplier || {};
        var titleCo = supplier.name || "업체 주문서";

        doc.setFontSize(16);
        doc.text(titleCo + " — 업체 주문서", 105, yRef.value, { align: "center" });
        yRef.value += 8;
        doc.setFontSize(10);
        doc.text("주문 접수 · 납품 요청서", 105, yRef.value, { align: "center" });
        yRef.value += 9;

        doc.setFontSize(11);
        addLines(
            doc,
            [
                "주문번호: " + (order.orderNo || order.id || ""),
                "주문일시: " +
                    new Date(order.createdAt || Date.now()).toLocaleString("ko-KR")
            ],
            14,
            yRef,
            270
        );
        yRef.value += 3;

        doc.setFontSize(11);
        doc.text("■ 공급처 (주문 접수)", 14, yRef.value);
        yRef.value += 6;
        doc.setFontSize(10);
        addLines(
            doc,
            [
                "상호: " + (supplier.name || ""),
                supplier.ceo ? "대표: " + supplier.ceo : "",
                supplier.addr ? "주소: " + supplier.addr : "",
                supplier.tel ? "접수 연락처: " + supplier.tel : ""
            ],
            14,
            yRef,
            270
        );
        yRef.value += 3;

        doc.setFontSize(11);
        doc.text("■ 주문 업체 (납품 받는 곳)", 14, yRef.value);
        yRef.value += 6;
        doc.setFontSize(10);
        addLines(
            doc,
            [
                "업체명: " + (order.vendorCompany || ""),
                order.vendorUserId ? "주문 아이디: " + order.vendorUserId : "",
                order.vendorGradeLabel ? "업체 등급: " + order.vendorGradeLabel : "",
                order.vendorMgrName ? "담당자: " + order.vendorMgrName : "",
                order.vendorMgrTel ? "담당자 연락처: " + order.vendorMgrTel : "",
                order.vendorMgrEmail ? "담당자 이메일: " + order.vendorMgrEmail : "",
                order.vendorCeo ? "대표: " + order.vendorCeo : "",
                order.vendorCeoTel ? "대표 연락처: " + order.vendorCeoTel : "",
                order.vendorPhone ? "업체 연락처: " + order.vendorPhone : "",
                order.vendorAddr ? "납품 주소: " + order.vendorAddr : ""
            ],
            14,
            yRef,
            270
        );
        yRef.value += 3;

        if (order.note) {
            doc.setFontSize(11);
            doc.text("■ 비고", 14, yRef.value);
            yRef.value += 6;
            doc.setFontSize(10);
            addLines(doc, [order.note], 14, yRef, 270);
            yRef.value += 3;
        }

        doc.setFontSize(11);
        doc.text("■ 주문 품목", 14, yRef.value);
        yRef.value += 7;
        doc.setFontSize(9);

        (order.items || []).forEach(function (it, idx) {
            var block = [
                "─ ─ ─",
                idx +
                    1 +
                    ". [" +
                    (it.pd_dept_label || it.pd_dept || "미지정") +
                    "] " +
                    (it.productName || ""),
                it.pd_size ? "   규격: " + it.pd_size : "",
                it.productRegisteredByName || it.productRegisteredBy
                    ? "   상품 등록: " +
                      (it.productRegisteredByName || it.productRegisteredBy)
                    : "",
                "   " +
                    (it.priceLabel || "단가") +
                    " " +
                    formatWon(it.unitPrice) +
                    " × " +
                    (it.quantity || 0) +
                    " = " +
                    formatWon(it.lineTotal)
            ];
            addLines(doc, block, 14, yRef, 270, 4.8);
        });

        yRef.value += 4;
        doc.setFontSize(12);
        doc.text("합계: " + formatWon(order.totalAmount), 196, yRef.value, { align: "right" });
        yRef.value += 8;
        doc.setFontSize(11);
        doc.text("■ 주문 담당자 (본인 확인)", 14, yRef.value);
        yRef.value += 6;
        doc.setFontSize(10);
        addLines(
            doc,
            [
                order.vendorMgrName ? "담당자: " + order.vendorMgrName : "",
                order.vendorMgrTel ? "연락처: " + order.vendorMgrTel : "",
                order.orderContactConfirmed
                    ? "확인: 주문 담당자 본인 확인 완료 (" +
                      new Date(
                          order.orderContactConfirmedAt || order.createdAt || Date.now()
                      ).toLocaleString("ko-KR") +
                      ")"
                    : ""
            ],
            14,
            yRef,
            270
        );
        yRef.value += 4;
        doc.setFontSize(8);
        doc.text(
            "본 주문서는 주문 시스템에서 자동 생성되었습니다.",
            105,
            yRef.value,
            { align: "center" }
        );

        var fname = "order-" + (order.orderNo || order.id || "sheet") + ".pdf";
        doc.save(fname);
        return Promise.resolve();
    }

    global.THEJHON_ORDER_PDF = { downloadOrderPdf: downloadOrderPdf };
})(typeof window !== "undefined" ? window : this);
