const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { buildOrderPdfBuffer } = require("../lib/orderPdf");
const { findVendorByLoginId } = require("../lib/loginResolve");
const { prepareOrderForPdf, prepareOrderForTransactionPdf } = require("../lib/orderEnrich");
const { buildTransactionPdfBuffer } = require("../lib/transactionPdf");
const {
    vendorCanPlaceOrders,
    buildOrderListQuery,
    buildSupervisorOrderListQuery,
    buildVendorOrderListQuery,
    staffCanReadOrder,
    staffCanAccessOrderManage,
    supervisorCanAccessAllOrders,
    normalizeStaffLoginId
} = require("../lib/orderAccess");
const { submitVendorOrder, deleteOrderCascade } = require("../lib/orderSubmit");

const router = express.Router();

function safeFilePart(s) {
    return String(s || "")
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, "_")
        .trim()
        .slice(0, 80);
}

function ymd(ts) {
    var d = new Date(ts || Date.now());
    return (
        String(d.getFullYear()) +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0")
    );
}

function wantsPdfDownload(req) {
    return String(req.query.download || req.query.attachment || "").trim() === "1";
}

function sendPdfBuffer(res, buf, fname, opts) {
    opts = opts || {};
    const download = !!opts.download;
    const disp = download ? "attachment" : "inline";
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

router.get("/notify-pdf/:token", async function (req, res) {
    try {
        var token = String(req.params.token || "").trim();
        if (!token) {
            return res.status(400).send("잘못된 링크입니다.");
        }
        var order = await getDb().collection("orders").findOne({ pdfNotifyToken: token });
        if (!order) {
            return res.status(404).send("발주서를 찾을 수 없습니다.");
        }
        if (order.pdfNotifyExpiresAt && Date.now() > order.pdfNotifyExpiresAt) {
            return res.status(410).send("다운로드 링크가 만료되었습니다.");
        }
        var pdfOrder = await prepareOrderForPdf(getDb(), order);
        var buf = await buildOrderPdfBuffer(pdfOrder);
        var fname = safeFilePart(pdfOrder.vendorCompany || "주문서") + "_" + ymd(pdfOrder.createdAt) + ".pdf";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'inline; filename="' + fname + '"');
        res.setHeader("Content-Length", String(buf.length));
        return res.send(buf);
    } catch (e) {
        console.error("GET /api/orders/notify-pdf/:token", e);
        return res.status(500).send("PDF를 생성하지 못했습니다.");
    }
});

function toOrderListItem(order) {
    return {
        id: order.id,
        orderNo: order.orderNo,
        orderKind: order.orderKind || "",
        parentOrderId: order.parentOrderId || "",
        orderStaffLoginId: order.orderStaffLoginId || "",
        vendorCompany: order.vendorCompany,
        vendorUserId: order.vendorUserId,
        vendorRegisteredBy: order.vendorRegisteredBy,
        vendorRegisteredByName: order.vendorRegisteredByName,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        status: order.status || "submitted",
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        note: order.note || ""
    };
}

function toOrderDetail(order) {
    const base = toOrderListItem(order);
    return Object.assign({}, base, {
        vendorGrade: order.vendorGrade || "",
        vendorGradeLabel: order.vendorGradeLabel || "",
        vendorMgrName: order.vendorMgrName || "",
        vendorMgrTel: order.vendorMgrTel || "",
        vendorRegisteredMgrName: order.vendorRegisteredMgrName || "",
        vendorRegisteredMgrTel: order.vendorRegisteredMgrTel || "",
        vendorMgrEmail: order.vendorMgrEmail || "",
        vendorAddr: order.vendorAddr || "",
        vendorPhone: order.vendorPhone || "",
        orderContactConfirmed: !!order.orderContactConfirmed,
        orderContactConfirmedAt: order.orderContactConfirmedAt || 0,
        items: Array.isArray(order.items) ? order.items : []
    });
}

function toAdminSplit(order) {
    return {
        id: order.id,
        orderNo: order.orderNo || "",
        orderStaffLoginId: order.orderStaffLoginId || "",
        adminName:
            order.vendorRegisteredByName ||
            (order.supplier && order.supplier.name) ||
            order.orderStaffLoginId ||
            "",
        totalAmount: order.totalAmount || 0,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        items: Array.isArray(order.items) ? order.items : []
    };
}

router.get("/", requireRole("admin", "vendor", "supervisor"), async function (req, res) {
    try {
        function parseYmdToMs(s, endOfDay) {
            var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
            if (!m) return 0;
            var y = parseInt(m[1], 10);
            var mo = parseInt(m[2], 10) - 1;
            var d = parseInt(m[3], 10) + (endOfDay ? 1 : 0);
            return new Date(y, mo, d).getTime();
        }

        var fromMs = parseYmdToMs(req.query.dateFrom, false);
        var toMs = parseYmdToMs(req.query.dateTo, true);
        var vendorName = String(req.query.vendorName || "").trim();
        if ((req.query.dateFrom && !fromMs) || (req.query.dateTo && !toMs)) {
            return res.status(400).json({ ok: false, error: "기간 날짜 형식이 올바르지 않습니다." });
        }
        if (fromMs && toMs && fromMs >= toMs) {
            return res.status(400).json({ ok: false, error: "기간 선택이 올바르지 않습니다." });
        }

        let query;
        if (req.auth.role === "vendor") {
            const vendor = await findVendorByLoginId(req.auth.userId || "");
            if (!vendor || !(await vendorCanPlaceOrders(vendor))) {
                return res.status(403).json({
                    ok: false,
                    error: "주문 내역을 조회할 권한이 없습니다."
                });
            }
            query = buildVendorOrderListQuery(req.auth);
        } else if (supervisorCanAccessAllOrders(req.auth)) {
            var adminStaffId = normalizeStaffLoginId(req.query.adminStaffId || "");
            query = buildSupervisorOrderListQuery(req.auth, adminStaffId);
            if (!adminStaffId) {
                query = {
                    $or: [{ orderKind: "admin" }, { orderKind: "vendor" }, { orderKind: { $exists: false } }]
                };
            }
        } else {
            if (!(await staffCanAccessOrderManage(req.auth))) {
                return res.status(403).json({
                    ok: false,
                    error: "관리자만 이용할 수 있습니다."
                });
            }
            query = await buildOrderListQuery(req.auth);
        }
        if (fromMs || toMs) {
            query.createdAt = {};
            if (fromMs) query.createdAt.$gte = fromMs;
            if (toMs) query.createdAt.$lt = toMs;
        }
        if (vendorName) {
            query.vendorCompany = { $regex: vendorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
        }
        const items = await getDb()
            .collection("orders")
            .find(query)
            .sort({ createdAt: -1 })
            .limit(500)
            .toArray();
        res.json({ ok: true, items: items.map(toOrderListItem) });
    } catch (e) {
        console.error("GET /api/orders", e);
        res.status(500).json({ ok: false, error: "주문 목록을 불러오지 못했습니다." });
    }
});

router.get("/:id", requireRole("admin", "vendor", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ ok: false, error: "주문 ID가 없습니다." });
        }
        const order = await getDb().collection("orders").findOne({ id: id });
        if (!order) {
            return res.status(404).json({ ok: false, error: "주문을 찾을 수 없습니다." });
        }
        if (!(await staffCanReadOrder(req.auth, order))) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        var detail = toOrderDetail(order);
        if (req.auth.role === "vendor" && order.orderKind === "vendor") {
            var splits = await getDb()
                .collection("orders")
                .find({ parentOrderId: order.id, orderKind: "admin" })
                .sort({ orderNo: 1 })
                .toArray();
            if (splits.length) {
                detail.adminSplits = splits.map(toAdminSplit);
            }
        }
        return res.json({ ok: true, order: detail });
    } catch (e) {
        console.error("GET /api/orders/:id", e);
        return res.status(500).json({ ok: false, error: "주문 내용을 불러오지 못했습니다." });
    }
});

router.delete("/:id", requireRole("admin", "vendor"), async function (req, res) {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ ok: false, error: "주문 ID가 없습니다." });
        }
        const col = getDb().collection("orders");
        const order = await col.findOne({ id: id });
        if (!order) {
            return res.status(404).json({ ok: false, error: "주문을 찾을 수 없습니다." });
        }
        if (!(await staffCanReadOrder(req.auth, order))) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        await deleteOrderCascade(getDb(), order);
        return res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/orders/:id", e);
        return res.status(500).json({ ok: false, error: "주문 삭제에 실패했습니다." });
    }
});

router.post("/", requireRole("vendor"), async function (req, res) {
    try {
        if (!req.body || req.body.orderContactConfirmed !== true) {
            return res.status(400).json({
                ok: false,
                error: "주문하는 분 정보 확인에 체크해 주세요."
            });
        }

        const result = await submitVendorOrder(getDb(), req.auth, req.body || {});
        if (result.error) {
            return res.status(result.status || 400).json({ ok: false, error: result.error });
        }

        const order = result.order;
        return res.json({
            ok: true,
            order: {
                id: order.id,
                orderNo: order.orderNo,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt
            },
            orderDetail: order,
            adminOrders: (result.adminOrders || []).map(toOrderListItem),
            pdfReady: !!order.hasPdf,
            pdfUrl: "/api/orders/" + encodeURIComponent(order.id) + "/pdf",
            notify: result.notifyResults
        });
    } catch (e) {
        console.error("POST /api/orders", e);
        return res.status(500).json({ ok: false, error: "주문 처리 중 오류가 발생했습니다." });
    }
});

router.get("/:id/transaction-pdf", requireRole("vendor", "admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const order = await getDb().collection("orders").findOne({ id: id });
        if (!order) {
            return res.status(404).json({ ok: false, error: "주문을 찾을 수 없습니다." });
        }
        if (!(await staffCanReadOrder(req.auth, order))) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        const pdfOrder = await prepareOrderForTransactionPdf(getDb(), order);
        const buf = await buildTransactionPdfBuffer(pdfOrder);
        const company = safeFilePart(pdfOrder.vendorCompany || "거래명세서");
        const date = ymd(pdfOrder.createdAt);
        const fname = "거래명세서_" + company + "_" + date + ".pdf";
        sendPdfBuffer(res, buf, fname, { download: wantsPdfDownload(req) });
    } catch (e) {
        console.error("GET order transaction-pdf", e);
        return res.status(500).json({ ok: false, error: "거래명세서 PDF 생성에 실패했습니다." });
    }
});

router.get("/:id/pdf", requireRole("vendor", "admin", "supervisor"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const order = await getDb().collection("orders").findOne({ id: id });
        if (!order) {
            return res.status(404).json({ ok: false, error: "주문을 찾을 수 없습니다." });
        }
        if (!(await staffCanReadOrder(req.auth, order))) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        const pdfOrder = await prepareOrderForPdf(getDb(), order);
        const buf = await buildOrderPdfBuffer(pdfOrder);
        const company = safeFilePart(pdfOrder.vendorCompany || "주문서");
        const date = ymd(pdfOrder.createdAt);
        const fname = company + "_" + date + ".pdf";
        sendPdfBuffer(res, buf, fname, { download: wantsPdfDownload(req) });
    } catch (e) {
        console.error("GET order pdf", e);
        return res.status(500).json({ ok: false, error: "PDF 생성에 실패했습니다." });
    }
});

module.exports = router;
