const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

function resolveFontPath() {
    var fromEnv = String(process.env.PDF_FONT_PATH || "").trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
    var candidates = [
        path.join(__dirname, "..", "fonts", "NotoSansKR-Regular.otf"),
        path.join(__dirname, "..", "fonts", "NanumGothic.ttf"),
        "C:\\Windows\\Fonts\\malgun.ttf",
        "C:\\Windows\\Fonts\\malgun.ttc",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
    ];
    for (var i = 0; i < candidates.length; i++) {
        if (fs.existsSync(candidates[i])) return candidates[i];
    }
    return "";
}

function formatWon(n) {
    var num = Number(n);
    if (!isFinite(num)) return "0원";
    return num.toLocaleString("ko-KR") + "원";
}

function line(doc, text, opts) {
    var t = String(text || "").trim();
    if (!t) return;
    doc.text(t, opts || {});
}

function buildOrderPdfBuffer(order) {
    return new Promise(function (resolve, reject) {
        var fontPath = resolveFontPath();
        var doc = new PDFDocument({ margin: 48, size: "A4" });
        var chunks = [];
        doc.on("data", function (c) {
            chunks.push(c);
        });
        doc.on("end", function () {
            resolve(Buffer.concat(chunks));
        });
        doc.on("error", reject);

        if (fontPath) {
            try {
                doc.registerFont("KR", fontPath);
                doc.font("KR");
            } catch (e) {
                doc.font("Helvetica");
            }
        } else {
            doc.font("Helvetica");
        }

        var supplier = order.supplier || {};
        var supplierTitle = supplier.name || "업체 주문서";

        doc.fontSize(18).text(supplierTitle + " — 업체 주문서", { align: "center" });
        doc.moveDown(0.35);
        doc.fontSize(10).text("주문 접수 · 납품 요청서", { align: "center" });
        doc.moveDown(0.75);

        doc.fontSize(11);
        line(doc, "주문번호: " + (order.orderNo || order.id));
        line(
            doc,
            "주문일시: " +
                new Date(order.createdAt || Date.now()).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul"
                })
        );
        doc.moveDown(0.5);

        doc.fontSize(12).text("■ 공급처 (주문 접수)", { underline: true });
        doc.fontSize(10);
        line(doc, "상호: " + supplier.name);
        line(doc, "대표: " + supplier.ceo);
        if (supplier.addr) line(doc, "주소: " + supplier.addr);
        if (supplier.tel) line(doc, "접수 연락처: " + supplier.tel);
        doc.moveDown(0.45);

        doc.fontSize(12).text("■ 주문 업체 (납품 받는 곳)", { underline: true });
        doc.fontSize(10);
        line(doc, "업체명: " + (order.vendorCompany || ""));
        if (order.vendorUserId) line(doc, "주문 아이디: " + order.vendorUserId);
        if (order.vendorGradeLabel) line(doc, "업체 등급: " + order.vendorGradeLabel);
        if (order.vendorMgrName) line(doc, "담당자: " + order.vendorMgrName);
        if (order.vendorMgrTel) line(doc, "담당자 연락처: " + order.vendorMgrTel);
        if (order.vendorMgrEmail) line(doc, "담당자 이메일: " + order.vendorMgrEmail);
        if (order.vendorCeo) line(doc, "대표: " + order.vendorCeo);
        if (order.vendorCeoTel) line(doc, "대표 연락처: " + order.vendorCeoTel);
        if (order.vendorPhone) line(doc, "업체 연락처: " + order.vendorPhone);
        if (order.vendorAddr) line(doc, "납품 주소: " + order.vendorAddr);
        doc.moveDown(0.45);

        if (order.note) {
            doc.fontSize(12).text("■ 비고", { underline: true });
            doc.fontSize(10).text(order.note);
            doc.moveDown(0.45);
        }

        doc.fontSize(12).text("■ 주문 품목", { underline: true });
        doc.moveDown(0.25);
        doc.fontSize(9);
        (order.items || []).forEach(function (it, idx) {
            line(doc, "─ ─ ─");
            line(
                doc,
                idx +
                    1 +
                    ". [" +
                    (it.pd_dept_label || it.pd_dept || "미지정") +
                    "] " +
                    (it.productName || "")
            );
            if (it.pd_size) line(doc, "   규격: " + it.pd_size);
            if (it.productRegisteredByName || it.productRegisteredBy) {
                line(
                    doc,
                    "   상품 등록: " +
                        (it.productRegisteredByName || it.productRegisteredBy)
                );
            }
            line(
                doc,
                "   " +
                    (it.priceLabel || "단가") +
                    " " +
                    formatWon(it.unitPrice) +
                    " × " +
                    (it.quantity || 0) +
                    " = " +
                    formatWon(it.lineTotal)
            );
        });

        doc.moveDown(0.6);
        doc.fontSize(13).text("합계: " + formatWon(order.totalAmount), { align: "right" });
        doc.moveDown(0.5);
        doc.fontSize(11).text("■ 주문 담당자 (본인 확인)", { underline: true });
        doc.fontSize(10);
        line(doc, "담당자: " + (order.vendorMgrName || ""));
        line(doc, "연락처: " + (order.vendorMgrTel || ""));
        if (order.orderContactConfirmed) {
            line(
                doc,
                "확인: 주문 담당자 본인 확인 완료 (" +
                    new Date(order.orderContactConfirmedAt || order.createdAt || Date.now()).toLocaleString(
                        "ko-KR",
                        { timeZone: "Asia/Seoul" }
                    ) +
                    ")"
            );
        }
        doc.moveDown(0.45);
        doc.fontSize(8).fillColor("#555555").text(
            "본 주문서는 주문 시스템에서 자동 생성되었습니다.",
            { align: "center" }
        );
        doc.fillColor("#000000");
        doc.end();
    });
}

module.exports = { buildOrderPdfBuffer, resolveFontPath };
