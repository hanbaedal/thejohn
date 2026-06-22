const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { assertOrderManageAccess } = require("../lib/transactionManual");
const {
    ensureIndexes,
    queryByProduct,
    queryByVendor
} = require("../lib/salesRecords");
const { querySalesLedgerInquiry, listLedgerVendorCompanies } = require("../lib/salesLedgerInquiry");
const { buildSalesReportPdfBuffer, formatYmd } = require("../lib/salesReportPdf");

const router = express.Router();

function safeFilePart(s) {
    return String(s || "")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, "_")
        .trim()
        .slice(0, 80);
}

router.use(requireRole("supervisor", "admin"));

router.get("/inquiry", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        const { ensureIndexes: ensureLedgerIndexes } = require("../lib/salesLedger");
        await ensureLedgerIndexes(db);
        const result = await querySalesLedgerInquiry(db, req.auth, req.query);
        if (result.error) return res.status(400).json({ ok: false, error: result.error });
        res.json(result);
    } catch (e) {
        console.error("GET /api/sales-reports/inquiry", e);
        res.status(500).json({ ok: false, error: e.message || "매출장 조회에 실패했습니다." });
    }
});

router.get("/vendor-companies", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        const { ensureIndexes: ensureLedgerIndexes } = require("../lib/salesLedger");
        await ensureLedgerIndexes(db);
        const companies = await listLedgerVendorCompanies(db, req.auth, req.query);
        res.json({ ok: true, companies: companies });
    } catch (e) {
        console.error("GET /api/sales-reports/vendor-companies", e);
        res.status(500).json({ ok: false, error: e.message || "매출 업체 목록을 불러오지 못했습니다." });
    }
});

router.get("/by-product", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        const result = await queryByProduct(db, req.auth, req.query);
        if (result.error) return res.status(400).json({ ok: false, error: result.error });
        res.json(result);
    } catch (e) {
        console.error("GET /api/sales-reports/by-product", e);
        res.status(500).json({ ok: false, error: e.message || "조회에 실패했습니다." });
    }
});

router.get("/by-vendor", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        const result = await queryByVendor(db, req.auth, req.query);
        if (result.error) return res.status(400).json({ ok: false, error: result.error });
        res.json(result);
    } catch (e) {
        console.error("GET /api/sales-reports/by-vendor", e);
        res.status(500).json({ ok: false, error: e.message || "조회에 실패했습니다." });
    }
});

router.post("/pdf", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        const body = req.body || {};
        const reportType = String(body.reportType || "").trim();
        let result;
        let title;
        let subtitle;

        if (reportType === "by-product") {
            result = await queryByProduct(db, req.auth, body);
            title = "품목별 매출 집계";
            const p = result.product || {};
            subtitle = (p.name || "") + (p.pd_code ? " (" + p.pd_code + ")" : "");
        } else if (reportType === "by-vendor") {
            result = await queryByVendor(db, req.auth, body);
            title = "업체별 매출 집계";
            subtitle = String(body.vendorCompany || result.filter?.vendorCompany || "");
        } else if (reportType === "inquiry") {
            const { ensureIndexes: ensureLedgerIndexes } = require("../lib/salesLedger");
            await ensureLedgerIndexes(db);
            result = await querySalesLedgerInquiry(db, req.auth, body);
            if (result.mode === "date") {
                title = "매출장 (일자별)";
                subtitle =
                    result.period && result.period.dateFrom && result.period.dateTo
                        ? result.period.dateFrom + " ~ " + result.period.dateTo
                        : "";
            } else if (result.mode === "product") {
                title = "매출장 (품목별)";
                subtitle = String(body.productName || "").trim();
            } else {
                title = "매출장 (업체별)";
                subtitle = String(body.vendorCompany || result.filter?.vendorCompany || "");
            }
        } else {
            return res.status(400).json({ ok: false, error: "reportType이 올바르지 않습니다." });
        }

        if (result.error) return res.status(400).json({ ok: false, error: result.error });

        var period = "";
        if (reportType !== "inquiry") {
            const from = body.dateFrom ? formatYmd(parseYmdLocal(body.dateFrom)) : "";
            const to = body.dateTo ? formatYmd(parseYmdLocal(body.dateTo, true)) : "";
            period = from || to ? from + " ~ " + to : "전체";
        } else if (result.period && result.period.dateFrom && result.period.dateTo) {
            period = result.period.dateFrom + " ~ " + result.period.dateTo;
        }

        const buf = await buildSalesReportPdfBuffer({
            title: title,
            subtitle: subtitle,
            period: period,
            items: result.items,
            summary: result.summary,
            layout: reportType === "inquiry" ? "date-ledger" : ""
        });

        const fname = safeFilePart(title + "_" + subtitle) + ".pdf";
        const inline = body.inline !== false;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            (inline ? "inline" : "attachment") +
                '; filename="' +
                encodeURIComponent(fname) +
                '"; filename*=UTF-8\'\'' +
                encodeURIComponent(fname)
        );
        res.setHeader("Content-Length", String(buf.length));
        res.send(buf);
    } catch (e) {
        console.error("POST /api/sales-reports/pdf", e);
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: e.message || "PDF 생성에 실패했습니다." });
        }
    }
});

function parseYmdLocal(s, endOfDay) {
    const parts = String(s || "").trim().split("-");
    if (parts.length < 3) return Date.now();
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return Date.now();
    if (endOfDay) return new Date(y, m, d, 23, 59, 59, 999).getTime();
    return new Date(y, m, d, 0, 0, 0, 0).getTime();
}

module.exports = router;
