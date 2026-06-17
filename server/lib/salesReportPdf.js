const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const PAGE_MARGIN = 42;
const FONT_BODY = 9;
const FONT_TITLE = 16;
const ROW_H = 18;

function resolveFontPath() {
    var fromEnv = String(process.env.PDF_FONT_PATH || "").trim();
    if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
    var candidates = [
        path.join(__dirname, "..", "fonts", "NotoSansKR-Regular.ttf"),
        path.join(__dirname, "..", "fonts", "NanumGothic.ttf"),
        "C:\\Windows\\Fonts\\malgun.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf"
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

function formatYmd(ts) {
    var d = new Date(ts || Date.now());
    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}

function drawTableHeader(doc, cols, y) {
    var x = PAGE_MARGIN;
    doc.fontSize(FONT_BODY).fillColor("#333");
    cols.forEach(function (col) {
        doc.text(col.label, x, y, { width: col.w, align: col.align || "left" });
        x += col.w;
    });
    doc
        .moveTo(PAGE_MARGIN, y + ROW_H - 4)
        .lineTo(doc.page.width - PAGE_MARGIN, y + ROW_H - 4)
        .strokeColor("#999")
        .stroke();
}

function drawTableRow(doc, cols, values, y) {
    var x = PAGE_MARGIN;
    values.forEach(function (val, i) {
        var col = cols[i];
        doc.text(String(val == null ? "" : val), x, y, { width: col.w, align: col.align || "left" });
        x += col.w;
    });
}

function buildSalesReportPdfBuffer(opts) {
    opts = opts || {};
    var title = String(opts.title || "매출 집계");
    var subtitle = String(opts.subtitle || "");
    var period = String(opts.period || "");
    var items = Array.isArray(opts.items) ? opts.items : [];
    var summary = opts.summary || {};

    return new Promise(function (resolve, reject) {
        var doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
        var chunks = [];
        doc.on("data", function (c) {
            chunks.push(c);
        });
        doc.on("end", function () {
            resolve(Buffer.concat(chunks));
        });
        doc.on("error", reject);

        var fontPath = resolveFontPath();
        if (fontPath) doc.font(fontPath);

        var y = PAGE_MARGIN;
        doc.fontSize(FONT_TITLE).text(title, PAGE_MARGIN, y, { align: "center" });
        y += 28;
        if (subtitle) {
            doc.fontSize(FONT_BODY).text(subtitle, PAGE_MARGIN, y, { align: "center" });
            y += 16;
        }
        if (period) {
            doc.fontSize(FONT_BODY).text("기간: " + period, PAGE_MARGIN, y);
            y += 18;
        }
        doc.fontSize(FONT_BODY).text(
            "건수 " +
                formatNum(summary.count) +
                " · 수량 " +
                formatNum(summary.totalQuantity) +
                " · 합계 " +
                formatWon(summary.totalAmount),
            PAGE_MARGIN,
            y
        );
        y += 22;

        var cols = [
            { label: "일자", w: 62 },
            { label: "구분", w: 32 },
            { label: "업체", w: 88 },
            { label: "품목", w: 100 },
            { label: "수량", w: 36, align: "right" },
            { label: "단가", w: 52, align: "right" },
            { label: "금액", w: 58, align: "right" }
        ];

        drawTableHeader(doc, cols, y);
        y += ROW_H;

        items.forEach(function (row) {
            if (y > doc.page.height - PAGE_MARGIN - ROW_H * 2) {
                doc.addPage();
                y = PAGE_MARGIN;
                drawTableHeader(doc, cols, y);
                y += ROW_H;
            }
            drawTableRow(
                doc,
                cols,
                [
                    formatYmd(row.issueDate),
                    row.sourceLabel || row.source || "",
                    row.vendorCompany || "",
                    row.productName || "",
                    formatNum(row.quantity),
                    formatNum(row.unitPrice),
                    formatNum(row.lineTotal)
                ],
                y
            );
            y += ROW_H;
        });

        doc.end();
    });
}

module.exports = { buildSalesReportPdfBuffer, formatYmd };
