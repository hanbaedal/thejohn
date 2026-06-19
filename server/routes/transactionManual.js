const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { prepareManualTransactionForPdf } = require("../lib/orderEnrich");
const { buildTransactionPdfBuffer } = require("../lib/transactionPdf");
const {
    COL,
    newId,
    buildFromBody,
    toPublic,
    toPdfOrder,
    listFilter,
    canAccessDoc,
    assertOrderManageAccess,
    validateBuilt,
    ensureIndexes
} = require("../lib/transactionManual");

const router = express.Router();

function safeFilePart(s) {
    return String(s || "")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, "_")
        .trim()
        .slice(0, 80);
}

function ymd(ts) {
    const d = new Date(ts || Date.now());
    return (
        String(d.getFullYear()) +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0")
    );
}

async function sendPdf(res, doc, opts) {
    opts = opts || {};
    const buf = await buildTransactionPdfBuffer(
        await prepareManualTransactionForPdf(getDb(), toPdfOrder(doc))
    );
    const company = safeFilePart(doc.vendorCompany || "거래명세서");
    const date = ymd(doc.issueDate || doc.createdAt);
    const fname = "거래명세서_" + company + "_" + date + ".pdf";
    const inline = !!opts.inline;
    const disp = inline ? "inline" : "attachment";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
        "Content-Disposition",
        disp +
            '; filename="' +
            encodeURIComponent(fname) +
            '"; filename*=UTF-8\'\'' +
            encodeURIComponent(fname)
    );
    res.setHeader("Content-Length", String(buf.length));
    res.send(buf);
}

router.use(requireRole("supervisor", "admin"));

router.post("/pdf", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const built = buildFromBody(req.body || {}, req.auth, null);
        const err = validateBuilt(built);
        if (err) return res.status(400).json({ ok: false, error: err });

        const previewDoc = Object.assign({ id: "txn_manual_preview" }, built, {
            createdBy: req.auth.userId
        });
        await sendPdf(res, previewDoc, { inline: true });
    } catch (e) {
        console.error("POST /api/transaction-manual/pdf", e);
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: e.message || "PDF 생성에 실패했습니다." });
        }
    }
});

router.get("/", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const db = getDb();
        await ensureIndexes(db);
        const docs = await db
            .collection(COL)
            .find(listFilter(req.auth, req.query))
            .sort({ updatedAt: -1 })
            .limit(200)
            .toArray();
        res.json({ ok: true, items: docs.map(toPublic) });
    } catch (e) {
        console.error("GET /api/transaction-manual", e);
        res.status(500).json({ ok: false, error: e.message || "목록을 불러오지 못했습니다." });
    }
});

router.get("/:id/pdf", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const doc = await getDb().collection(COL).findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "문서를 찾을 수 없습니다." });
        if (!canAccessDoc(req.auth, doc)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        const download =
            String(req.query.download || req.query.attachment || "").trim() === "1";
        await sendPdf(res, doc, { inline: !download });
    } catch (e) {
        console.error("GET /api/transaction-manual/:id/pdf", e);
        if (!res.headersSent) {
            res.status(500).json({ ok: false, error: e.message || "PDF 생성에 실패했습니다." });
        }
    }
});

router.get("/:id", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const doc = await getDb().collection(COL).findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "문서를 찾을 수 없습니다." });
        if (!canAccessDoc(req.auth, doc)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/transaction-manual/:id", e);
        res.status(500).json({ ok: false, error: e.message || "불러오지 못했습니다." });
    }
});

router.post("/", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const built = buildFromBody(req.body || {}, req.auth, null);
        const err = validateBuilt(built);
        if (err) return res.status(400).json({ ok: false, error: err });

        const now = Date.now();
        const doc = Object.assign(
            {
                id: newId(),
                createdBy: req.auth.userId,
                createdAt: now,
                updatedAt: now
            },
            built
        );
        await getDb().collection(COL).insertOne(doc);
        try {
            const { syncFromManualTransaction } = require("../lib/salesRecords");
            await syncFromManualTransaction(getDb(), doc);
        } catch (syncErr) {
            console.error("sales_records sync manual", syncErr.message);
        }
        try {
            const { createFromTransaction } = require("../lib/salesLedger");
            await createFromTransaction(getDb(), doc, req.auth);
        } catch (ledgerErr) {
            console.error("sales_ledgers from transaction", ledgerErr.message);
        }
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/transaction-manual", e);
        res.status(500).json({ ok: false, error: e.message || "저장에 실패했습니다." });
    }
});

router.put("/:id", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const col = getDb().collection(COL);
        const existing = await col.findOne({ id: req.params.id });
        if (!existing) return res.status(404).json({ ok: false, error: "문서를 찾을 수 없습니다." });
        if (!canAccessDoc(req.auth, existing)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }

        const built = buildFromBody(req.body || {}, req.auth, existing);
        const err = validateBuilt(built);
        if (err) return res.status(400).json({ ok: false, error: err });

        const next = Object.assign({}, existing, built, { updatedAt: Date.now() });
        await col.replaceOne({ id: existing.id }, next);
        try {
            const { syncFromManualTransaction } = require("../lib/salesRecords");
            await syncFromManualTransaction(getDb(), next);
        } catch (syncErr) {
            console.error("sales_records sync manual update", syncErr.message);
        }
        try {
            const { updateFromTransaction } = require("../lib/salesLedger");
            await updateFromTransaction(getDb(), next);
        } catch (ledgerErr) {
            console.error("sales_ledgers update from transaction", ledgerErr.message);
        }
        res.json({ ok: true, item: toPublic(next) });
    } catch (e) {
        console.error("PUT /api/transaction-manual/:id", e);
        res.status(500).json({ ok: false, error: e.message || "저장에 실패했습니다." });
    }
});

router.delete("/:id", async function (req, res) {
    try {
        await assertOrderManageAccess(req.auth);
        const col = getDb().collection(COL);
        const existing = await col.findOne({ id: req.params.id });
        if (!existing) return res.status(404).json({ ok: false, error: "문서를 찾을 수 없습니다." });
        if (!canAccessDoc(req.auth, existing)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        await col.deleteOne({ id: existing.id });
        try {
            const { deleteSalesForSource } = require("../lib/salesRecords");
            await deleteSalesForSource(getDb(), "manual", existing.id);
        } catch (syncErr) {
            console.error("sales_records delete manual", syncErr.message);
        }
        try {
            const { deleteFromTransaction } = require("../lib/salesLedger");
            await deleteFromTransaction(getDb(), existing.id);
        } catch (ledgerErr) {
            console.error("sales_ledgers delete from transaction", ledgerErr.message);
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/transaction-manual/:id", e);
        res.status(500).json({ ok: false, error: e.message || "삭제에 실패했습니다." });
    }
});

module.exports = router;
