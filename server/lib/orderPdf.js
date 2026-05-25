const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const PAGE_MARGIN = 42;
const HEADER_BG = "#F2D4BC";
const ROW_H = 20;
const FONT_TITLE = 22;
const FONT_BODY = 9;
const FONT_SMALL = 8;
const MAX_ITEM_ROWS = 15;

function resolveFontPath() {
    var fromEnv = String(process.env.PDF_FONT_PATH || "").trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
    var candidates = [
        path.join(__dirname, "..", "fonts", "NotoSansKR-Regular.ttf"),
        path.join(__dirname, "..", "fonts", "NotoSansCJKkr-Regular.otf"),
        path.join(__dirname, "..", "fonts", "NanumGothic.ttf"),
        path.join(__dirname, "..", "fonts", "NotoSansKR-Regular.otf"),
        "C:\\Windows\\Fonts\\malgun.ttf",
        "C:\\Windows\\Fonts\\malgun.ttc",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
    ];
    for (var i = 0; i < candidates.length; i++) {
        if (fs.existsSync(candidates[i])) return candidates[i];
    }
    return "";
}

function formatNum(n) {
    var num = Number(n);
    if (!isFinite(num)) return "0";
    return num.toLocaleString("ko-KR");
}

function formatWon(n) {
    return formatNum(n) + "원";
}

function formatOrderDate(ts) {
    var d = new Date(ts || Date.now());
    return (
        d.getFullYear() +
        " 년 " +
        String(d.getMonth() + 1).padStart(2, "0") +
        " 월 " +
        String(d.getDate()).padStart(2, "0") +
        " 일"
    );
}

function formatConfirmTime(ts) {
    return new Date(ts || Date.now()).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul"
    });
}

function str(v) {
    return String(v ?? "").trim();
}

function drawRect(doc, x, y, w, h, fill) {
    if (fill) {
        doc.save();
        doc.fillColor(fill).rect(x, y, w, h).fill();
        doc.restore();
    }
    doc.strokeColor("#000000").lineWidth(0.6).rect(x, y, w, h).stroke();
}

function drawLabelCell(doc, x, y, w, h, text, align) {
    drawRect(doc, x, y, w, h, HEADER_BG);
    doc.fillColor("#000000").fontSize(FONT_BODY);
    doc.text(text, x + 3, y + 6, {
        width: w - 6,
        height: h - 4,
        align: align || "center"
    });
}

function drawValueCell(doc, x, y, w, h, text, align) {
    drawRect(doc, x, y, w, h, null);
    doc.fillColor("#000000").fontSize(FONT_BODY);
    var t = str(text);
    if (t) {
        doc.text(t, x + 4, y + 6, {
            width: w - 8,
            height: h - 4,
            align: align || "left"
        });
    }
}

function drawHeaderTable(doc, order, x, y, tableW) {
    var c1 = 72;
    var c2 = (tableW - 72 - 72 - 72) / 2;
    var c3 = 72;
    var c4 = tableW - c1 - c2 - c3;
    var cols = [c1, c2, c3, c4];
    var supplier = order.supplier || {};
    var recipient =
        str(order.vendorRegisteredByName || supplier.name) +
        (supplier.ceo ? " " + supplier.ceo : "");
    var orderContent =
        str(order.note) ||
        (order.vendorCompany ? order.vendorCompany + " 상품 발주" : "상품 발주");

    var row = 0;
    function cellX(col) {
        var sum = x;
        for (var i = 0; i < col; i++) sum += cols[i];
        return sum;
    }

    drawLabelCell(doc, cellX(0), y + row * ROW_H, cols[0], ROW_H, "발주일자");
    drawValueCell(doc, cellX(1), y + row * ROW_H, cols[1], ROW_H, formatOrderDate(order.createdAt));
    drawLabelCell(doc, cellX(2), y + row * ROW_H, cols[2], ROW_H, "발주번호");
    drawValueCell(doc, cellX(3), y + row * ROW_H, cols[3], ROW_H, order.orderNo || order.id || "", "center");
    row++;

    drawLabelCell(doc, cellX(0), y + row * ROW_H, cols[0], ROW_H, "수신(참조)");
    drawValueCell(doc, cellX(1), y + row * ROW_H, cols[1], ROW_H, recipient || "관리자 담당자명");
    drawLabelCell(doc, cellX(2), y + row * ROW_H, cols[2], ROW_H, "발주금액");
    drawValueCell(
        doc,
        cellX(3),
        y + row * ROW_H,
        cols[3],
        ROW_H,
        formatWon(order.totalAmount),
        "right"
    );
    row++;

    drawLabelCell(doc, cellX(0), y + row * ROW_H, cols[0], ROW_H, "발주내용");
    drawValueCell(
        doc,
        cellX(1),
        y + row * ROW_H,
        cols[1] + cols[2] + cols[3],
        ROW_H,
        orderContent
    );
    row++;

    return y + row * ROW_H;
}

function itemUnit(it) {
    var size = str(it.pd_size);
    if (/kg|g|L|ml|박스|팩|봉/i.test(size)) return "";
    return "식";
}

function itemRemark(it) {
    var parts = [];
    if (it.pd_dept_label || it.pd_dept) parts.push(it.pd_dept_label || it.pd_dept);
    if (it.priceLabel && it.priceLabel !== "단가") parts.push(it.priceLabel);
    return parts.join(" ");
}

function drawItemsTable(doc, order, x, y, tableW, pageItems, rowOffset) {
    var colW = {
        no: 28,
        name: 118,
        spec: 62,
        unit: 36,
        qty: 44,
        price: 68,
        amount: 72,
        note: tableW - 28 - 118 - 62 - 36 - 44 - 68 - 72
    };
    var cols = [
        colW.no,
        colW.name,
        colW.spec,
        colW.unit,
        colW.qty,
        colW.price,
        colW.amount,
        colW.note
    ];
    var headers = ["No.", "품명", "규격", "단위", "수량", "단가", "금액", "비고"];

    function cellX(col) {
        var sum = x;
        for (var i = 0; i < col; i++) sum += cols[i];
        return sum;
    }

    var cy = y;
    for (var h = 0; h < headers.length; h++) {
        drawLabelCell(doc, cellX(h), cy, cols[h], ROW_H, headers[h]);
    }
    cy += ROW_H;

    for (var r = 0; r < MAX_ITEM_ROWS; r++) {
        var it = pageItems[r];
        var no = rowOffset + r + 1;
        drawValueCell(doc, cellX(0), cy, cols[0], ROW_H, it ? String(no) : String(no), "center");
        if (it) {
            drawValueCell(doc, cellX(1), cy, cols[1], ROW_H, it.productName || "");
            drawValueCell(doc, cellX(2), cy, cols[2], ROW_H, it.pd_size || "");
            drawValueCell(doc, cellX(3), cy, cols[3], ROW_H, itemUnit(it), "center");
            drawValueCell(doc, cellX(4), cy, cols[4], ROW_H, formatNum(it.quantity), "right");
            drawValueCell(doc, cellX(5), cy, cols[5], ROW_H, formatNum(it.unitPrice), "right");
            drawValueCell(doc, cellX(6), cy, cols[6], ROW_H, formatNum(it.lineTotal), "right");
            drawValueCell(doc, cellX(7), cy, cols[7], ROW_H, itemRemark(it));
        } else {
            for (var c = 1; c < cols.length; c++) {
                drawValueCell(doc, cellX(c), cy, cols[c], ROW_H, "");
            }
        }
        cy += ROW_H;
    }

    var mergeLabelW = cols[0] + cols[1];
    var valueX = cellX(2);
    var valueW = tableW - mergeLabelW;

    drawLabelCell(doc, cellX(0), cy, mergeLabelW, ROW_H, "합 계");
    for (var ec = 2; ec <= 5; ec++) {
        drawValueCell(doc, cellX(ec), cy, cols[ec], ROW_H, "");
    }
    drawValueCell(
        doc,
        cellX(6),
        cy,
        cols[6],
        ROW_H,
        rowOffset === 0 ? formatNum(order.totalAmount) : "",
        "right"
    );
    drawValueCell(doc, cellX(7), cy, cols[7], ROW_H, "");
    cy += ROW_H;

    var footerRows = [
        ["납품장소", str(order.vendorAddr) || ""],
        ["납 기", ""],
        ["지불조건", ""]
    ];
    for (var f = 0; f < footerRows.length; f++) {
        drawLabelCell(doc, cellX(0), cy, mergeLabelW, ROW_H, footerRows[f][0]);
        drawValueCell(doc, valueX, cy, valueW, ROW_H, footerRows[f][1]);
        cy += ROW_H;
    }

    return cy;
}

function drawConfirmBlock(doc, order, pageW) {
    var lines = ["주문 담당자(본인 확인)"];
    if (order.vendorMgrName) lines.push("담당자 : " + order.vendorMgrName);
    if (order.vendorMgrTel) lines.push("연락처 : " + order.vendorMgrTel);
    if (order.orderContactConfirmed) {
        lines.push("확 인 : 주문 담당자 본인 확인 완료");
        lines.push(
            "(" +
                formatConfirmTime(
                    order.orderContactConfirmedAt || order.createdAt
                ) +
                ")"
        );
    }
    var blockW = 220;
    var blockH = lines.length * 14 + 8;
    var bx = pageW - PAGE_MARGIN - blockW;
    var by = doc.page.height - PAGE_MARGIN - blockH - 8;
    doc.fontSize(FONT_SMALL).fillColor("#000000");
    for (var i = 0; i < lines.length; i++) {
        doc.text(lines[i], bx, by + i * 14, { width: blockW, align: "left" });
    }
}

function renderOrderPage(doc, order, pageItems, rowOffset, isFirstPage) {
    var pageW = doc.page.width;
    var contentW = pageW - PAGE_MARGIN * 2;
    var y = PAGE_MARGIN;

    if (isFirstPage) {
        doc.fontSize(FONT_TITLE).fillColor("#000000");
        doc.text("발  주  서", PAGE_MARGIN, y, { width: contentW, align: "center" });
        y += 36;

        y = drawHeaderTable(doc, order, PAGE_MARGIN, y, contentW) + 10;
        doc.fontSize(FONT_BODY);
        doc.text(
            "다음과 같이 상품을 주문하오니 기일 내 납품하여 주시기 바랍니다.",
            PAGE_MARGIN,
            y,
            { width: contentW, align: "center" }
        );
        y += 22;
        doc.text("내    용", PAGE_MARGIN, y);
        y += 14;
    } else {
        doc.fontSize(12).text("발  주  서 (계속)", PAGE_MARGIN, y, {
            width: contentW,
            align: "center"
        });
        y += 28;
    }

    drawItemsTable(doc, order, PAGE_MARGIN, y, contentW, pageItems, rowOffset);
    if (isFirstPage) {
        drawConfirmBlock(doc, order, pageW);
    }
}

function buildOrderPdfBuffer(order) {
    return new Promise(function (resolve, reject) {
        var fontPath = resolveFontPath();
        var doc = new PDFDocument({ margin: 0, size: "A4", autoFirstPage: false });
        var chunks = [];
        doc.on("data", function (c) {
            chunks.push(c);
        });
        doc.on("end", function () {
            resolve(Buffer.concat(chunks));
        });
        doc.on("error", reject);

        if (!fontPath) {
            return reject(
                new Error(
                    "한글 PDF 폰트가 없습니다. server에서 npm run postinstall 또는 node scripts/ensure-pdf-font.js 를 실행하세요."
                )
            );
        }
        try {
            doc.registerFont("KR", fontPath);
            doc.font("KR");
        } catch (e) {
            return reject(new Error("PDF 한글 폰트 등록 실패: " + e.message));
        }

        var items = order.items || [];
        var pages = [];
        for (var i = 0; i < items.length; i += MAX_ITEM_ROWS) {
            pages.push(items.slice(i, i + MAX_ITEM_ROWS));
        }
        if (!pages.length) pages.push([]);

        pages.forEach(function (pageItems, pageIdx) {
            doc.addPage({ margin: 0, size: "A4" });
            renderOrderPage(doc, order, pageItems, pageIdx * MAX_ITEM_ROWS, pageIdx === 0);
        });

        doc.end();
    });
}

module.exports = { buildOrderPdfBuffer, resolveFontPath };
