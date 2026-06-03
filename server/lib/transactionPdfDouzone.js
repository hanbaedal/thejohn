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
const SUPPLIER_ROWS = 5;
const HEADER_BLOCK_H = HEADER_ROW_H * SUPPLIER_ROWS;
const MAX_ITEM_ROWS = 10;
const FONT_BODY = 8;
const FONT_TITLE = 17;
const FONT_SMALL = 7;
const TOTAL_LABEL_W = 52;

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

/** 품목 표 열 너비 — 합이 slipW와 일치 */
function tableColumnWidths(slipW) {
    var base = [32, 48, 128, 52, 36, 52, 58, 48];
    var sum = base.reduce(function (a, b) {
        return a + b;
    }, 0);
    var cols = base.map(function (w) {
        return Math.round((w * slipW) / sum);
    });
    var drift = slipW - cols.reduce(function (a, b) {
        return a + b;
    }, 0);
    cols[cols.length - 1] += drift;
    return cols;
}

/** 하단 총합계·입금액·총잔액·인수자 행 — 합이 slipW와 일치 */
function bottomSummarySegments(slipW) {
    var inW = 26;
    var totLbl = 46;
    var totVal = 58;
    var depLbl = 34;
    var depVal = 52;
    var balLbl = 40;
    var balVal = 58;
    var fixed = totLbl + totVal + depLbl + depVal + balLbl + balVal + inW;
    var remain = slipW - fixed;
    var recvLbl = Math.max(36, Math.round(remain * 0.32));
    var recvVal = remain - recvLbl;
    return [
        { kind: "label", text: "총합계", w: totLbl },
        { kind: "value", w: totVal },
        { kind: "label", text: "입금액", w: depLbl },
        { kind: "value", w: depVal },
        { kind: "label", text: "총잔액", w: balLbl },
        { kind: "value", w: balVal },
        { kind: "label", text: "인수자", w: recvLbl },
        { kind: "value", w: recvVal },
        { kind: "value", text: "인", w: inW, align: "center" }
    ];
}

/** 공급자(우측) 칸 너비 — 합이 supplierW와 정확히 일치 */
function supplierColumnWidths(supplierW) {
    var lbl = 36;
    var nameLbl = 30;
    var inLbl = 22;
    var seal = 32;
    var halfLbl = 30;
    var inner = supplierW - lbl;
    var row2Mid = inner - nameLbl - inLbl - seal;
    var companyW = Math.max(48, Math.floor(row2Mid * 0.58));
    var ceoW = row2Mid - companyW;
    var halfVal = Math.max(40, Math.floor((inner - halfLbl * 2) / 2));
    return {
        lbl: lbl,
        nameLbl: nameLbl,
        companyW: companyW,
        ceoLbl: nameLbl,
        ceoW: ceoW,
        inLbl: inLbl,
        seal: seal,
        halfLbl: halfLbl,
        halfVal: halfVal,
        halfVal2: inner - halfLbl * 2 - halfVal
    };
}

function drawSlip(doc, slipY, order, issuer, theme, pageLabel) {
    var x0 = MARGIN_X;
    var slipW = PAGE_W - MARGIN_X * 2;
    var slipTop = slipY + 4;
    var y = slipTop + 2;

    var leftW = 118;
    var titleW = 148;
    var supplierW = slipW - leftW - titleW;
    var leftRowH = HEADER_ROW_H;
    var leftH = leftRowH * 3;
    var headerH = HEADER_BLOCK_H;
    var leftLabelW = 44;
    var leftValues = [pageLabel, formatIssueDate(order.createdAt), order.vendorCompany || ""];
    var leftLabels = ["Page", "발행일자", "거래처"];
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
    strokeRect(doc, tx, y, titleW, headerH, null);
    doc.fontSize(FONT_TITLE).fillColor("#000000");
    doc.text("거래명세서", tx, y + 10, { width: titleW, align: "center" });
    doc.fontSize(FONT_SMALL).text(theme.subtitle, tx, y + 32, { width: titleW, align: "center" });

    var sx = tx + titleW;
    var sy = y;
    var sc = supplierColumnWidths(supplierW);
    var cx;
    var sealX = sx + supplierW - sc.seal;

    drawLabel(doc, "등록번호", sx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.bizNo, sx + sc.lbl, sy, supplierW - sc.lbl, HEADER_ROW_H, "center");
    sy += HEADER_ROW_H;

    cx = sx;
    drawLabel(doc, "상호", cx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.lbl;
    drawValue(doc, issuer.company, cx, sy, sc.companyW, HEADER_ROW_H);
    cx += sc.companyW;
    drawLabel(doc, "성명", cx, sy, sc.nameLbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.nameLbl;
    drawValue(doc, issuer.ceo, cx, sy, sc.ceoW, HEADER_ROW_H, "center");
    cx += sc.ceoW;
    drawLabel(doc, "인", cx, sy, sc.inLbl, HEADER_ROW_H, theme.labelBg);
    strokeRect(doc, sealX, sy, sc.seal, HEADER_ROW_H, null);
    if (issuer.sealPath && fs.existsSync(issuer.sealPath)) {
        try {
            var sealPad = 1;
            var sealBox = Math.min(sc.seal, HEADER_ROW_H) - sealPad * 2;
            doc.image(
                issuer.sealPath,
                sealX + (sc.seal - sealBox) / 2,
                sy + (HEADER_ROW_H - sealBox) / 2,
                { width: sealBox, height: sealBox, fit: [sealBox, sealBox] }
            );
        } catch (e) {
            /* ignore */
        }
    }
    sy += HEADER_ROW_H;

    drawLabel(doc, "주소", sx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.address, sx + sc.lbl, sy, supplierW - sc.lbl, HEADER_ROW_H);
    sy += HEADER_ROW_H;

    cx = sx;
    drawLabel(doc, "업태", cx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.lbl;
    drawValue(doc, issuer.bizType, cx, sy, sc.halfVal, HEADER_ROW_H);
    cx += sc.halfVal;
    drawLabel(doc, "종목", cx, sy, sc.halfLbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.halfLbl;
    drawValue(doc, issuer.bizItem, cx, sy, sc.halfVal2, HEADER_ROW_H);
    sy += HEADER_ROW_H;

    cx = sx;
    drawLabel(doc, "전화번호", cx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.lbl;
    drawValue(doc, issuer.phone, cx, sy, sc.halfVal, HEADER_ROW_H);
    cx += sc.halfVal;
    drawLabel(doc, "팩스", cx, sy, sc.halfLbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.halfLbl;
    drawValue(doc, issuer.fax, cx, sy, sc.halfVal2, HEADER_ROW_H);

    y += headerH + 4;

    var totalRowH = ROW_H + 2;
    strokeRect(doc, x0, y, slipW, totalRowH, theme.labelBg);
    drawTextInCell(doc, "합계금액", x0, y, TOTAL_LABEL_W, totalRowH, { align: "center" });
    doc
        .strokeColor("#333333")
        .moveTo(x0 + TOTAL_LABEL_W, y)
        .lineTo(x0 + TOTAL_LABEL_W, y + totalRowH)
        .stroke();
    drawTextInCell(
        doc,
        "₩  " + formatNum(order.totalAmount),
        x0 + TOTAL_LABEL_W,
        y,
        slipW - TOTAL_LABEL_W,
        totalRowH,
        { align: "right" }
    );
    y += totalRowH + 4;

    var cols = tableColumnWidths(slipW);
    var headers = ["월일", "품목코드", "품명", "규격", "수량", "단가", "공급가액", "세액"];
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
    drawValue(doc, "₩ 0", cx + footLabelW, y, cols[2], ROW_H, "right");
    drawLabel(doc, "합계", cx + footLabelW + cols[2], y, cols[3] + cols[4] + cols[5], ROW_H, theme.labelBg);
    drawValue(doc, formatNum(totalSupply), cx + footLabelW + cols[2] + cols[3] + cols[4] + cols[5], y, cols[6], ROW_H, "right");
    drawValue(doc, formatNum(totalTax), cx + footLabelW + cols[2] + cols[3] + cols[4] + cols[5] + cols[6], y, cols[7], ROW_H, "right");
    y += ROW_H;

    var segments = bottomSummarySegments(slipW);
    cx = x0;
    var totalAmt = "₩ " + formatNum(order.totalAmount);
    var bottomVals = [totalAmt, "₩ 0", totalAmt, ""];
    var bottomValIdx = 0;
    segments.forEach(function (seg) {
        if (seg.kind === "label") {
            drawLabel(doc, seg.text, cx, y, seg.w, ROW_H, theme.labelBg);
        } else if (seg.text === "인") {
            drawValue(doc, seg.text, cx, y, seg.w, ROW_H, seg.align || "center");
        } else {
            drawValue(doc, bottomVals[bottomValIdx++] || "", cx, y, seg.w, ROW_H, "right");
        }
        cx += seg.w;
    });
    y += ROW_H + 5;

    var deliveryAddr = str(order.vendorAddr);
    var deliveryPhone = str(order.vendorPhone) || str(issuer.phone);
    var bankLine = str(issuer.bankAccount);
    var extParts = [];
    if (deliveryAddr) extParts.push("*배송지 " + deliveryAddr);
    if (deliveryPhone) extParts.push("*전화 " + deliveryPhone);
    if (bankLine) extParts.push("*계좌번호 " + bankLine);
    if (extParts.length) {
        doc.fontSize(FONT_SMALL).fillColor("#000000");
        doc.text(extParts.join("   "), x0, y, { width: slipW, lineBreak: false });
        y += 10;
    }

    var slipBottom = Math.min(slipY + SLIP_H - 4, y + 2);
    doc.strokeColor("#333333").lineWidth(0.5).rect(x0, slipTop, slipW, slipBottom - slipTop).stroke();
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
            var pageLabel = pageIdx + 1 + " / " + pages.length;
            doc.addPage({ size: "A4", margin: 0 });
            drawSlip(doc, 0, pageOrder, issuer, THEME_RECIPIENT, pageLabel);
            drawSlip(doc, SLIP_H + SLIP_GAP, pageOrder, issuer, THEME_SUPPLIER, pageLabel);
        });

        doc.end();
    });
}

module.exports = { buildDouzoneTransactionPdfBuffer, splitVat, MAX_ITEM_ROWS };
