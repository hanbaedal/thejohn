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

function formatSourceKind(row) {
    var src = String((row && row.source) || "").toLowerCase();
    var label = String((row && row.sourceLabel) || "");
    if (src === "order" || label.indexOf("주문") >= 0) return "주문";
    if (src === "manual" || src === "ledger" || label.indexOf("수기") >= 0) return "수기";
    return label || "";
}

function groupItemsByDate(items) {
    var map = {};
    (items || []).forEach(function (row) {
        var ymd = formatYmd(row.issueDate);
        if (!map[ymd]) {
            map[ymd] = { issueDate: ymd, items: [] };
        }
        map[ymd].items.push(row);
    });
    return Object.keys(map)
        .sort(function (a, b) {
            return b.localeCompare(a);
        })
        .map(function (k) {
            return map[k];
        });
}

function expandLedgerRowsForPdf(items, layout) {
    var groups = groupItemsByDate(items);
    var dedupeVendor = layout === "date-ledger" || layout === "product-ledger";
    var out = [];
    groups.forEach(function (group) {
        var firstInDay = true;
        var lastVendor = null;
        (group.items || []).forEach(function (row) {
            var dateCell = firstInDay ? group.issueDate : "";
            firstInDay = false;
            var vendorName = String(row.vendorCompany || "");
            var vendorCell = "";
            if (dedupeVendor) {
                if (vendorName !== lastVendor) {
                    vendorCell = vendorName;
                    lastVendor = vendorName;
                }
            }
            var kind = formatSourceKind(row);
            if (layout === "vendor-ledger") {
                out.push([
                    dateCell,
                    kind,
                    row.pd_code || "",
                    row.productName || "",
                    formatNum(row.quantity),
                    formatNum(row.unitPrice),
                    formatNum(row.lineTotal)
                ]);
            } else if (layout === "product-ledger") {
                out.push([
                    dateCell,
                    kind,
                    vendorCell,
                    formatNum(row.quantity),
                    formatNum(row.unitPrice),
                    formatNum(row.lineTotal)
                ]);
            } else if (layout === "date-ledger") {
                out.push([
                    dateCell,
                    kind,
                    vendorCell,
                    row.pd_code || "",
                    row.productName || "",
                    formatNum(row.quantity),
                    formatNum(row.unitPrice),
                    formatNum(row.lineTotal)
                ]);
            }
        });
    });
    return out;
}

function ledgerTableCols(layout) {
    if (layout === "vendor-ledger") {
        return [
            { label: "일자", w: 40 },
            { label: "구분", w: 28 },
            { label: "제품코드", w: 44 },
            { label: "품명", w: 92 },
            { label: "수량", w: 28, align: "right" },
            { label: "단가", w: 42, align: "right" },
            { label: "금액", w: 46, align: "right" }
        ];
    }
    if (layout === "product-ledger") {
        return [
            { label: "일자", w: 40 },
            { label: "구분", w: 28 },
            { label: "업체명", w: 100 },
            { label: "수량", w: 28, align: "right" },
            { label: "단가", w: 42, align: "right" },
            { label: "금액", w: 46, align: "right" }
        ];
    }
    if (layout === "date-ledger") {
        return [
            { label: "일자", w: 40 },
            { label: "구분", w: 28 },
            { label: "업체명", w: 76 },
            { label: "제품코드", w: 42 },
            { label: "품명", w: 72 },
            { label: "수량", w: 28, align: "right" },
            { label: "단가", w: 42, align: "right" },
            { label: "금액", w: 46, align: "right" }
        ];
    }
    return [
        { label: "일자", w: 62 },
        { label: "구분", w: 32 },
        { label: "업체", w: 88 },
        { label: "품목", w: 100 },
        { label: "수량", w: 36, align: "right" },
        { label: "단가", w: 52, align: "right" },
        { label: "금액", w: 58, align: "right" }
    ];
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

        var layout = String(opts.layout || "");
        var cols = ledgerTableCols(layout);
        var isLedgerLayout =
            layout === "date-ledger" || layout === "vendor-ledger" || layout === "product-ledger";
        var tableRows = isLedgerLayout
            ? expandLedgerRowsForPdf(items, layout)
            : items.map(function (row) {
                  return [
                      formatYmd(row.issueDate),
                      formatSourceKind(row) || row.sourceLabel || row.source || "",
                      row.vendorCompany || "",
                      row.productName || "",
                      formatNum(row.quantity),
                      formatNum(row.unitPrice),
                      formatNum(row.lineTotal)
                  ];
              });

        drawTableHeader(doc, cols, y);
        y += ROW_H;

        tableRows.forEach(function (values) {
            if (y > doc.page.height - PAGE_MARGIN - ROW_H * 2) {
                doc.addPage();
                y = PAGE_MARGIN;
                drawTableHeader(doc, cols, y);
                y += ROW_H;
            }
            drawTableRow(doc, cols, values, y);
            y += ROW_H;
        });

        doc.end();
    });
}

module.exports = { buildSalesReportPdfBuffer, formatYmd };
