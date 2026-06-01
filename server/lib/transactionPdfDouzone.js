const fs = require("fs");
const PDFDocument = require("pdfkit");
const { resolveFontPath, resolveBoldFontPath } = require("./orderPdf");

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 24;
const SLIP_GAP = 8;
const SLIP_H = (PAGE_H - SLIP_GAP) / 2;
const ROW_H = 15;
const HEADER_ROW_H = 16;
const MAX_ITEM_ROWS = 10;
const FONT_BODY = 8;
const FONT_TITLE = 17;
const FONT_SMALL = 7;

const THEME_RECIPIENT = {
    subtitle: "(공급받는자 보관용)",
    labelBg: "#C5E1A5",
    stripeA: "#FFFFFF",
    stripeB: "#E8F5E9"
};
const THEME_SUPPLIER = {
    subtitle: "(공급자 보관용)",
    labelBg: "#FFCCBC",
    stripeA: "#FFFFFF",
    stripeB: "#FFF3E0"
};

function str(v) {
    return String(v ?? "").trim();
}

function formatNum(n) {
    var num = Number(n);
    if (!isFinite(num)) return "0";
    return num.toLocaleString("ko-KR");
}

function splitVat(lineTotal) {
    var total = Math.round(Number(lineTotal) || 0);
    if (total <= 0) return { supply: 0, tax: 0 };
    var supply = Math.round(total / 1.1);
    var tax = total - supply;
    return { supply: supply, tax: tax };
}

function formatMd(ts) {
    var d = new Date(ts || Date.now());
    return String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0");
}

function formatIssueDate(ts) {
    var d = new Date(ts || Date.now());
    return (
        d.getFullYear() +
        "." +
        String(d.getMonth() + 1).padStart(2, "0") +
        "." +
        String(d.getDate()).padStart(2, "0")
    );
}

function strokeRect(doc, x, y, w, h, fill) {
    if (fill) {
        doc.save();
        doc.fillColor(fill).rect(x, y, w, h).fill();
        doc.restore();
    }
    doc.strokeColor("#333333").lineWidth(0.5).rect(x, y, w, h).stroke();
}

function drawTextInCell(doc, text, x, y, w, h, opts) {
    opts = opts || {};
    doc.fillColor("#000000").fontSize(opts.size || FONT_BODY);
    var t = str(text);
    if (!t) return;
    doc.text(t, x + 2, y + (h - (opts.size || FONT_BODY)) / 2 - 1, {
        width: w - 4,
        height: h,
        align: opts.align || "left",
        lineBreak: false,
        ellipsis: true
    });
}

function drawLabel(doc, text, x, y, w, h, bg) {
    strokeRect(doc, x, y, w, h, bg);
    drawTextInCell(doc, text, x, y, w, h, { align: "center", size: FONT_BODY });
}

function drawValue(doc, text, x, y, w, h, align) {
    strokeRect(doc, x, y, w, h, null);
    drawTextInCell(doc, text, x, y, w, h, { align: align || "left" });
}

function drawSlip(doc, slipY, order, issuer, theme, pageLabel) {
    var x0 = MARGIN_X;
    var slipW = PAGE_W - MARGIN_X * 2;
    var y = slipY + 6;

    var leftW = 118;
    var titleW = 148;
    var supplierW = slipW - leftW - titleW;
    var leftRowH = HEADER_ROW_H;
    var leftH = leftRowH * 3;
    var leftLabelW = 44;
    var leftValues = [pageLabel, formatIssueDate(order.createdAt), order.vendorCompany || ""];
    var leftLabels = ["Page", "발행일자", "거래처명"];
    for (var lr = 0; lr < 3; lr++) {
        drawLabel(doc, leftLabels[lr], x0, y + lr * leftRowH, leftLabelW, leftRowH, "#EEEEEE");
        drawValue(
            doc,
            leftValues[lr],
            x0 + leftLabelW,
            y + lr * leftRowH,
            leftW - leftLabelW,
            leftRowH,
            "center"
        );
    }

    var tx = x0 + leftW;
    strokeRect(doc, tx, y, titleW, leftH, null);
    doc.fontSize(FONT_TITLE).fillColor("#000000");
    doc.text("거래명세서", tx, y + 10, { width: titleW, align: "center" });
    doc.fontSize(FONT_SMALL).text(theme.subtitle, tx, y + 32, { width: titleW, align: "center" });

    var sx = tx + titleW;
    var sy = y;
    var sLbl = 40;
    var sMid = Math.max(60, Math.floor((supplierW - sLbl * 2 - 44 - 40) / 2));
    var sName = 44;
    var sSeal = 40;

    drawLabel(doc, "등록번호", sx, sy, supplierW, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.bizNo, sx, sy + HEADER_ROW_H, supplierW, HEADER_ROW_H, "center");
    sy += HEADER_ROW_H * 2;

    drawLabel(doc, "상호", sx, sy, sLbl, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.company, sx + sLbl, sy, sMid, HEADER_ROW_H);
    drawLabel(doc, "성명", sx + sLbl + sMid, sy, sName, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.ceo, sx + sLbl + sMid + sName, sy, sSeal - 10, HEADER_ROW_H, "center");
    drawLabel(doc, "인", sx + supplierW - 28, sy, 28, HEADER_ROW_H, theme.labelBg);
    if (issuer.sealPath && fs.existsSync(issuer.sealPath)) {
        try {
            doc.image(issuer.sealPath, sx + supplierW - 34, sy - 2, { width: 34, height: 34 });
        } catch (e) {
            /* ignore */
        }
    }
    sy += HEADER_ROW_H;

    drawLabel(doc, "주소", sx, sy, sLbl, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.address, sx + sLbl, sy, supplierW - sLbl, HEADER_ROW_H);
    sy += HEADER_ROW_H;

    drawLabel(doc, "업태", sx, sy, sLbl, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.bizType, sx + sLbl, sy, sMid, HEADER_ROW_H);
    drawLabel(doc, "종목", sx + sLbl + sMid, sy, sName, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.bizItem, sx + sLbl + sMid + sName, sy, sSeal + 28, HEADER_ROW_H);
    sy += HEADER_ROW_H;

    drawLabel(doc, "전화번호", sx, sy, sLbl, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.phone, sx + sLbl, sy, sMid, HEADER_ROW_H);
    drawLabel(doc, "팩스", sx + sLbl + sMid, sy, sName, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.fax, sx + sLbl + sMid + sName, sy, sSeal + 28, HEADER_ROW_H);

    y += leftH + 4;

    drawLabel(doc, "합계금액", x0, y, 56, ROW_H + 2, theme.labelBg);
    drawValue(doc, "₩  " + formatNum(order.totalAmount), x0 + 56, y, slipW - 56, ROW_H + 2, "right");
    y += ROW_H + 6;

    var cols = [32, 48, 118, 52, 36, 52, 58, 48];
    var headers = ["월일", "품목코드", "품목", "규격", "수량", "단가", "공급가액", "세액"];
    var cx = x0;
    for (var h = 0; h < headers.length; h++) {
        drawLabel(doc, headers[h], cx, y, cols[h], ROW_H, theme.labelBg);
        cx += cols[h];
    }
    y += ROW_H;

    var items = order.items || [];
    var totalSupply = 0;
    var totalTax = 0;
    for (var r = 0; r < MAX_ITEM_ROWS; r++) {
        var bg = r % 2 === 0 ? theme.stripeA : theme.stripeB;
        var it = items[r];
        var vat = it ? splitVat(it.lineTotal) : { supply: 0, tax: 0 };
        if (it) {
            totalSupply += vat.supply;
            totalTax += vat.tax;
        }
        cx = x0;
        var cells = it
            ? [
                  formatMd(order.createdAt),
                  str(it.productId || "").slice(-8),
                  it.productName || "",
                  it.pd_size || "",
                  formatNum(it.quantity),
                  formatNum(it.unitPrice),
                  formatNum(vat.supply),
                  formatNum(vat.tax)
              ]
            : ["", "", "", "", "", "", "", ""];
        for (var c = 0; c < cols.length; c++) {
            strokeRect(doc, cx, y, cols[c], ROW_H, bg);
            drawTextInCell(doc, cells[c], cx, y, cols[c], ROW_H, {
                align: c >= 4 ? "right" : "left"
            });
            cx += cols[c];
        }
        y += ROW_H;
    }

    var footLabelW = cols[0] + cols[1];
    cx = x0;
    drawLabel(doc, "전잔금", cx, y, footLabelW, ROW_H, theme.labelBg);
    drawValue(doc, "₩", cx + footLabelW, y, cols[2], ROW_H);
    drawLabel(doc, "합계", cx + footLabelW + cols[2], y, cols[3] + cols[4] + cols[5], ROW_H, theme.labelBg);
    drawValue(doc, formatNum(totalSupply), cx + footLabelW + cols[2] + cols[3] + cols[4] + cols[5], y, cols[6], ROW_H, "right");
    drawValue(doc, formatNum(totalTax), cx + footLabelW + cols[2] + cols[3] + cols[4] + cols[5] + cols[6], y, cols[7], ROW_H, "right");
    y += ROW_H;

    var f1 = 54;
    var f2 = 62;
    var f3 = 62;
    var rest = slipW - f1 - f2 - f3;
    cx = x0;
    drawLabel(doc, "총합계", cx, y, f1, ROW_H, theme.labelBg);
    drawValue(doc, "₩ " + formatNum(order.totalAmount), cx + f1, y, f2, ROW_H, "right");
    drawLabel(doc, "입금", cx + f1 + f2, y, 38, ROW_H, theme.labelBg);
    drawValue(doc, "₩", cx + f1 + f2 + 38, y, f2 - 38, ROW_H);
    drawLabel(doc, "총잔액", cx + f1 + f2 * 2, y, 44, ROW_H, theme.labelBg);
    drawValue(doc, "₩ " + formatNum(order.totalAmount), cx + f1 + f2 * 2 + 44, y, f3, ROW_H, "right");
    drawLabel(doc, "인수자", cx + f1 + f2 * 2 + 44 + f3, y, rest - 30, ROW_H, theme.labelBg);
    drawValue(doc, "인", cx + slipW - 28, y, 28, ROW_H, "center");
}

function buildDouzoneTransactionPdfBuffer(order) {
    return new Promise(function (resolve, reject) {
        var fontPath = resolveFontPath();
        if (!fontPath) {
            return reject(
                new Error(
                    "한글 PDF 폰트가 없습니다. server에서 npm run postinstall 또는 node scripts/ensure-pdf-font.js 를 실행하세요."
                )
            );
        }
        var issuer = order.issuer || {};
        var items = order.items || [];
        var pages = [];
        for (var i = 0; i < items.length; i += MAX_ITEM_ROWS) {
            pages.push(items.slice(i, i + MAX_ITEM_ROWS));
        }
        if (!pages.length) pages.push([]);

        var doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: false });
        var chunks = [];
        doc.on("data", function (c) {
            chunks.push(c);
        });
        doc.on("end", function () {
            resolve(Buffer.concat(chunks));
        });
        doc.on("error", reject);

        try {
            doc.registerFont("KR", fontPath);
            doc.font("KR");
            var boldPath = resolveBoldFontPath();
            if (boldPath) doc.registerFont("KR-Bold", boldPath);
        } catch (e) {
            return reject(new Error("PDF 한글 폰트 등록 실패: " + e.message));
        }

        pages.forEach(function (pageItems, pageIdx) {
            var pageOrder = Object.assign({}, order, { items: pageItems });
            var pageLabel =
                pages.length > 1 ? pageIdx + 1 + " / " + pages.length : String(pageIdx + 1);
            doc.addPage({ size: "A4", margin: 0 });
            drawSlip(doc, 0, pageOrder, issuer, THEME_RECIPIENT, pageLabel);
            drawSlip(doc, SLIP_H + SLIP_GAP, pageOrder, issuer, THEME_SUPPLIER, pageLabel);
        });

        doc.end();
    });
}

module.exports = { buildDouzoneTransactionPdfBuffer, splitVat, MAX_ITEM_ROWS };
