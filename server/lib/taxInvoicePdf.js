const fs = require("fs");
const PDFDocument = require("pdfkit");
const { resolveFontPath, resolveBoldFontPath } = require("./orderPdf");
const { splitVat } = require("./transactionPdfDouzone");

const MARGIN = 36;
const ROW_H = 18;
const FONT_BODY = 9;
const FONT_TITLE = 16;
const FONT_SMALL = 7;

function str(v) {
    return String(v ?? "").trim();
}

function formatNum(n) {
    const num = Number(n);
    if (!isFinite(num)) return "0";
    return num.toLocaleString("ko-KR");
}

function strokeBox(doc, x, y, w, h, fill) {
    if (fill) {
        doc.save();
        doc.fillColor(fill).rect(x, y, w, h).fill();
        doc.restore();
    }
    doc.strokeColor("#333").lineWidth(0.5).rect(x, y, w, h).stroke();
}

function drawCell(doc, text, x, y, w, h, opts) {
    opts = opts || {};
    doc.font(opts.bold && doc._krBold ? "KR-Bold" : "KR");
    doc.fillColor("#000").fontSize(opts.size || FONT_BODY);
    doc.text(str(text), x + 3, y + (h - (opts.size || FONT_BODY)) / 2 - 1, {
        width: w - 6,
        height: h,
        align: opts.align || "left",
        lineBreak: false,
        ellipsis: true
    });
    doc.font("KR");
}

function drawPartyBlock(doc, title, party, x, y, w) {
    const labelW = 52;
    const rowH = 16;
    strokeBox(doc, x, y, w, rowH * 5);
    drawCell(doc, title, x, y, w, rowH, { align: "center", bold: true, size: 10 });
    const rows = [
        ["등록번호", party.bizNo || ""],
        ["상호", party.company || ""],
        ["성명", party.ceo || ""],
        ["사업장", party.address || ""]
    ];
    let ry = y + rowH;
    rows.forEach(function (row) {
        strokeBox(doc, x, ry, labelW, rowH, "#f5f5f5");
        drawCell(doc, row[0], x, ry, labelW, rowH, { align: "center", size: FONT_SMALL });
        drawCell(doc, row[1], x + labelW, ry, w - labelW, rowH);
        ry += rowH;
    });
    return y + rowH * 5;
}

function buildTaxInvoicePdfBuffer(payload) {
    payload = payload || {};
    return new Promise(function (resolve, reject) {
        const fontPath = resolveFontPath();
        if (!fontPath) {
            return reject(new Error("한글 PDF 폰트가 없습니다."));
        }

        const doc = new PDFDocument({ size: "A4", margin: MARGIN });
        const chunks = [];
        doc.on("data", function (c) {
            chunks.push(c);
        });
        doc.on("end", function () {
            resolve(Buffer.concat(chunks));
        });
        doc.on("error", reject);

        doc.registerFont("KR", fontPath);
        doc.font("KR");
        const boldPath = resolveBoldFontPath();
        doc._krBold = false;
        if (boldPath) {
            doc.registerFont("KR-Bold", boldPath);
            doc._krBold = true;
        }

        const pageW = doc.page.width - MARGIN * 2;
        let y = MARGIN;

        doc.font(doc._krBold ? "KR-Bold" : "KR").fontSize(FONT_TITLE);
        doc.text("세 금 계 산 서", MARGIN, y, { width: pageW, align: "center" });
        y += 26;
        doc.font("KR").fontSize(FONT_BODY);
        doc.text("(공급받는자 보관용)", MARGIN, y, { width: pageW, align: "center" });
        y += 18;
        doc.text("작성일자: " + str(payload.issueDate), MARGIN, y);
        if (payload.period && payload.period.dateFrom && payload.period.dateTo) {
            doc.text(
                "매출 기간: " + payload.period.dateFrom + " ~ " + payload.period.dateTo,
                MARGIN,
                y,
                { width: pageW, align: "right" }
            );
        }
        y += 20;

        const halfW = (pageW - 8) / 2;
        const issuer = payload.issuer || {};
        const buyer = payload.buyer || {};
        const blockBottom = Math.max(
            drawPartyBlock(doc, "공급자", issuer, MARGIN, y, halfW),
            drawPartyBlock(doc, "공급받는자", buyer, MARGIN + halfW + 8, y, halfW)
        );
        y = blockBottom + 12;

        const cols = [
            { label: "품목", w: pageW * 0.34 },
            { label: "수량", w: pageW * 0.1 },
            { label: "단가", w: pageW * 0.14 },
            { label: "공급가액", w: pageW * 0.2 },
            { label: "세액", w: pageW * 0.22 }
        ];

        let cx = MARGIN;
        cols.forEach(function (col) {
            strokeBox(doc, cx, y, col.w, ROW_H, "#eef2f6");
            drawCell(doc, col.label, cx, y, col.w, ROW_H, { align: "center", bold: true });
            cx += col.w;
        });
        y += ROW_H;

        let totalSupply = 0;
        let totalTax = 0;
        (payload.items || []).forEach(function (it) {
            const vat = splitVat(it.lineTotal);
            totalSupply += vat.supply;
            totalTax += vat.tax;
            cx = MARGIN;
            const vals = [
                it.productName,
                formatNum(it.quantity),
                formatNum(it.unitPrice),
                formatNum(vat.supply),
                formatNum(vat.tax)
            ];
            for (let i = 0; i < cols.length; i++) {
                strokeBox(doc, cx, y, cols[i].w, ROW_H);
                drawCell(doc, vals[i], cx, y, cols[i].w, ROW_H, {
                    align: i >= 1 ? "right" : "left"
                });
                cx += cols[i].w;
            }
            y += ROW_H;
            if (y > doc.page.height - MARGIN - ROW_H * 4) {
                doc.addPage();
                y = MARGIN;
            }
        });

        cx = MARGIN;
        strokeBox(doc, cx, y, cols[0].w + cols[1].w + cols[2].w, ROW_H, "#eef2f6");
        drawCell(doc, "합계", cx, y, cols[0].w + cols[1].w + cols[2].w, ROW_H, {
            align: "center",
            bold: true
        });
        strokeBox(doc, cx + cols[0].w + cols[1].w + cols[2].w, y, cols[3].w, ROW_H);
        drawCell(
            doc,
            formatNum(totalSupply),
            cx + cols[0].w + cols[1].w + cols[2].w,
            y,
            cols[3].w,
            ROW_H,
            { align: "right", bold: true }
        );
        strokeBox(doc, cx + cols[0].w + cols[1].w + cols[2].w + cols[3].w, y, cols[4].w, ROW_H);
        drawCell(
            doc,
            formatNum(totalTax),
            cx + cols[0].w + cols[1].w + cols[2].w + cols[3].w,
            y,
            cols[4].w,
            ROW_H,
            { align: "right", bold: true }
        );
        y += ROW_H + 10;

        doc.fontSize(FONT_SMALL).fillColor("#444");
        doc.text(
            "※ 본 문서는 전자세금계산서 국세청 연동 없이 매출장 기준으로 출력한 양식입니다.",
            MARGIN,
            y,
            { width: pageW }
        );
        y += 12;
        doc.text("합계금액(공급가액+세액): " + formatNum(totalSupply + totalTax) + "원", MARGIN, y);

        if (issuer.sealImage && issuer.sealImage.path && fs.existsSync(issuer.sealImage.path)) {
            try {
                doc.image(issuer.sealImage.path, MARGIN + halfW - 42, blockBottom - 38, {
                    width: 36,
                    height: 36
                });
            } catch (e) {}
        }

        doc.end();
    });
}

module.exports = { buildTaxInvoicePdfBuffer };
