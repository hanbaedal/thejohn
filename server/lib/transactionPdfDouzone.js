const fs = require("fs");
const PDFDocument = require("pdfkit");
const { resolveFontPath, resolveBoldFontPath } = require("./orderPdf");

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 24;
const PAGE_HALF_H = PAGE_H / 2;
const CUT_LINE_Y = PAGE_HALF_H;
const DOC_TOP_LINES = 2;
const ROW_H = 15;
const HEADER_ROW_H = 16;
const SEAL_DRAW_SIZE = 56;
const SUPPLIER_ROWS = 5;
const HEADER_BLOCK_H = HEADER_ROW_H * SUPPLIER_ROWS;
const MAX_ITEM_ROWS = 10;
const FONT_BODY = 8;
const FONT_BIZ_NO = 10;
const FONT_TOTAL_LABEL = 9;
const FONT_TOTAL_AMOUNT = 11;
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

function cellFont(doc, opts) {
    if (opts.bold && doc._krBold) return "KR-Bold";
    return "KR";
}

function drawTextInCell(doc, text, x, y, w, h, opts) {
    opts = opts || {};
    var size = opts.size || FONT_BODY;
    doc.font(cellFont(doc, opts));
    doc.fillColor("#000000").fontSize(size);
    var t = str(text);
    if (!t) return;
    doc.text(t, x + 2, y + (h - size) / 2 - 1, {
        width: w - 4,
        height: h,
        align: opts.align || "left",
        lineBreak: false,
        ellipsis: true
    });
    doc.font("KR");
}

/** 합계금액 — 왼쪽 표 4행째, 열 폭 = 거래명세서(titleW) */
function drawTotalAmountRow(doc, x0, y, blockW, lblW, totalAmount, theme) {
    strokeRect(doc, x0, y, lblW, HEADER_ROW_H, theme.labelBg);
    drawTextInCell(doc, "합계금액", x0, y, lblW, HEADER_ROW_H, {
        align: "center",
        size: FONT_TOTAL_LABEL,
        bold: true
    });
    strokeRect(doc, x0 + lblW, y, blockW - lblW, HEADER_ROW_H, null);
    drawTextInCell(doc, "₩  " + formatNum(totalAmount), x0 + lblW, y, blockW - lblW, HEADER_ROW_H, {
        align: "right",
        size: FONT_TOTAL_AMOUNT,
        bold: true
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
    var pairLbl = 30;
    var inner = supplierW - lbl;
    var row2Mid = inner - nameLbl - inLbl - seal;
    var companyW = Math.max(48, Math.floor(row2Mid * 0.58));
    var ceoW = row2Mid - companyW;
    var pairVal = Math.max(40, Math.floor((inner - pairLbl) / 2));
    var pairVal2 = inner - pairLbl - pairVal;
    return {
        lbl: lbl,
        nameLbl: nameLbl,
        companyW: companyW,
        ceoLbl: nameLbl,
        ceoW: ceoW,
        inLbl: inLbl,
        seal: seal,
        pairLbl: pairLbl,
        pairVal: pairVal,
        pairVal2: pairVal2,
        valueW: inner
    };
}

/** 명세서 한 장 높이(대략) — 상·하 반쪽 세로 중앙 배치용 */
function estimateSlipHeight(order, issuer) {
    var ext = 0;
    if (str(order.vendorAddr)) ext++;
    if (str(order.vendorPhone) || str(issuer && issuer.phone)) ext++;
    if (issuer && str(issuer.bankAccount)) ext++;
    var extH = ext > 0 ? 15 : 0;
    return 6 + HEADER_BLOCK_H + 4 + ROW_H + MAX_ITEM_ROWS * ROW_H + ROW_H * 2 + 5 + extH + 4;
}

function slipVerticalPositions(slipH) {
    var topInset = ROW_H * DOC_TOP_LINES;
    var topY = topInset + Math.max(6, (PAGE_HALF_H - topInset - slipH) / 2);
    var bottomY = PAGE_HALF_H + Math.max(6, (PAGE_HALF_H - slipH) / 2);
    return { topY: topY, bottomY: bottomY };
}

/** 공급받는자 / 공급자 절취선 (페이지 세로 중앙) */
function drawPerforationLine(doc) {
    var x1 = MARGIN_X;
    var x2 = PAGE_W - MARGIN_X;
    var cy = CUT_LINE_Y;
    doc.save();
    doc.strokeColor("#666666").lineWidth(0.5).dash(6, { space: 4 });
    doc.moveTo(x1, cy).lineTo(x2, cy).stroke();
    doc.undash();
    doc.restore();
    doc.font("KR").fontSize(7).fillColor("#555555");
    doc.text("절  취  선", (PAGE_W - 56) / 2, cy - 8, { width: 56, align: "center", lineBreak: false });
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
    var titleTextH = 36;
    var titleY = y + (headerH - titleTextH) / 2;
    doc.fontSize(FONT_TITLE).fillColor("#000000");
    doc.text("거래명세서", tx, titleY, { width: titleW, align: "center" });
    doc.fontSize(FONT_SMALL).text(theme.subtitle, tx, titleY + 20, { width: titleW, align: "center" });

    var totalRowY = y + 3 * HEADER_ROW_H;
    drawTotalAmountRow(doc, x0, totalRowY, titleW, leftLabelW, order.totalAmount, theme);

    var sx = tx + titleW;
    var sy = y;
    var sc = supplierColumnWidths(supplierW);
    var cx;
    var sealX = sx + supplierW - sc.seal;

    drawLabel(doc, "등록번호", sx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    strokeRect(doc, sx + sc.lbl, sy, supplierW - sc.lbl, HEADER_ROW_H, null);
    drawTextInCell(doc, issuer.bizNo, sx + sc.lbl, sy, supplierW - sc.lbl, HEADER_ROW_H, {
        align: "center",
        size: FONT_BIZ_NO,
        bold: true
    });
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
            var sealLeft = sx + supplierW - SEAL_DRAW_SIZE;
            var sealTop = sy + (HEADER_ROW_H - SEAL_DRAW_SIZE) / 2;
            doc.image(issuer.sealPath, sealLeft, sealTop, {
                width: SEAL_DRAW_SIZE,
                height: SEAL_DRAW_SIZE,
                fit: [SEAL_DRAW_SIZE, SEAL_DRAW_SIZE]
            });
        } catch (e) {
            /* ignore */
        }
    }
    sy += HEADER_ROW_H;

    drawLabel(doc, "주소", sx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    drawValue(doc, issuer.address, sx + sc.lbl, sy, sc.valueW, HEADER_ROW_H);
    sy += HEADER_ROW_H;

    cx = sx;
    drawLabel(doc, "업태", cx, totalRowY, sc.lbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.lbl;
    drawValue(doc, issuer.bizType, cx, totalRowY, sc.pairVal, HEADER_ROW_H);
    cx += sc.pairVal;
    drawLabel(doc, "종목", cx, totalRowY, sc.pairLbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.pairLbl;
    drawValue(doc, issuer.bizItem, cx, totalRowY, sc.pairVal2, HEADER_ROW_H);
    sy = totalRowY + HEADER_ROW_H;

    cx = sx;
    drawLabel(doc, "전화번호", cx, sy, sc.lbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.lbl;
    drawValue(doc, issuer.phone, cx, sy, sc.pairVal, HEADER_ROW_H);
    cx += sc.pairVal;
    drawLabel(doc, "팩스", cx, sy, sc.pairLbl, HEADER_ROW_H, theme.labelBg);
    cx += sc.pairLbl;
    drawValue(doc, issuer.fax, cx, sy, sc.pairVal2, HEADER_ROW_H);

    y += headerH + 4;

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

    var slipBottom = y + 2;
    doc.strokeColor("#333333").lineWidth(0.5).rect(x0, slipTop, slipW, slipBottom - slipTop).stroke();
    return slipBottom - slipY;
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
            doc._krBold = false;
            if (boldPath) {
                doc.registerFont("KR-Bold", boldPath);
                doc._krBold = true;
            }
        } catch (e) {
            return reject(new Error("PDF 한글 폰트 등록 실패: " + e.message));
        }

        pages.forEach(function (pageItems, pageIdx) {
            var pageOrder = Object.assign({}, order, { items: pageItems });
            var pageLabel = pageIdx + 1 + " / " + pages.length;
            doc.addPage({ size: "A4", margin: 0 });
            var slipH = estimateSlipHeight(pageOrder, issuer);
            var pos = slipVerticalPositions(slipH);
            drawSlip(doc, pos.topY, pageOrder, issuer, THEME_RECIPIENT, pageLabel);
            drawSlip(doc, pos.bottomY, pageOrder, issuer, THEME_SUPPLIER, pageLabel);
            drawPerforationLine(doc);
        });

        doc.end();
    });
}

module.exports = { buildDouzoneTransactionPdfBuffer, splitVat, MAX_ITEM_ROWS };
