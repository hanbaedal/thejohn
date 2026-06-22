const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { assertOrderManageAccess } = require("../lib/transactionManual");
const { ensureIndexes } = require("../lib/salesRecords");
const { ensureIndexes: ensureLedgerIndexes } = require("../lib/salesLedger");
const { buildTaxInvoicePayload } = require("../lib/taxInvoiceBuild");
const { buildTaxInvoicePdfBuffer } = require("../lib/taxInvoicePdf");

const router = express.Router();

function safeFilePart(s) {
    return String(s || "")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, "_")
        .trim()
        .slice(0, 80);
}

router.use(requireRole("supervisor", "admin"));

router.post("/pdf", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        await ensureLedgerIndexes(db);
        const body = req.body || {};
        const payload = await buildTaxInvoicePayload(db, req.auth, body);
        if (payload.error) return res.status(400).json({ ok: false, error: payload.error });

        const buf = await buildTaxInvoicePdfBuffer(payload);
        const fname =
            safeFilePart("세금계산서_" + (payload.buyer && payload.buyer.company)) + ".pdf";
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
        console.error("POST /api/tax-invoices/pdf", e);
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: e.message || "세금계산서 PDF 생성에 실패했습니다." });
        }
    }
});

router.post("/preview", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        await ensureLedgerIndexes(db);
        const payload = await buildTaxInvoicePayload(db, req.auth, req.body || {});
        if (payload.error) return res.status(400).json({ ok: false, error: payload.error });
        res.json({ ok: true, preview: payload });
    } catch (e) {
        console.error("POST /api/tax-invoices/preview", e);
        res.status(500).json({ ok: false, error: e.message || "미리보기에 실패했습니다." });
    }
});

module.exports = router;
