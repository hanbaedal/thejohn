const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { buildOrderPdfBuffer } = require("../lib/orderPdf");
const { notifyOrderAdmin } = require("../lib/orderNotify");
const { findVendorByLoginId } = require("../lib/loginResolve");
const { resolveVendorUnitPrice } = require("../lib/vendorPricing");
const { buildEnrichedOrder, prepareOrderForPdf } = require("../lib/orderEnrich");
const { deptLabel } = require("../lib/orderDeptLabels");
const { F: PF } = require("../lib/productFields");
const {
    vendorCanPlaceOrders,
    buildOrderListQuery,
    buildVendorOrderListQuery,
    staffCanReadOrder,
    staffCanAccessOrderManage,
    getOrderEnabledStaffId
} = require("../lib/orderAccess");

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

/** Twilio MMS용 — 토큰 링크로 발주서 PDF 공개 (7일) */
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
        vendorMgrEmail: order.vendorMgrEmail || "",
        vendorAddr: order.vendorAddr || "",
        vendorPhone: order.vendorPhone || "",
        orderContactConfirmed: !!order.orderContactConfirmed,
        orderContactConfirmedAt: order.orderContactConfirmedAt || 0,
        items: Array.isArray(order.items) ? order.items : []
    });
}

function newOrderId() {
    return "ord_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function newOrderNo() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var seq = String(Date.now()).slice(-6);
    return "DZ" + y + m + day + "-" + seq;
}

async function buildOrderItemsFromDb(db, clientItems, vendorDoc) {
    if (!Array.isArray(clientItems) || !clientItems.length) return null;
    var out = [];
    for (var i = 0; i < clientItems.length; i++) {
        var it = clientItems[i] || {};
        var productId = String(it.productId || "").trim();
        if (!productId) continue;
        var qty = parseInt(it.quantity, 10);
        if (!isFinite(qty) || qty < 1) continue;

        var product = await db.collection("products").findOne({ id: productId });
        if (!product) continue;

        var priced = resolveVendorUnitPrice(product, vendorDoc);
        var unitPrice = priced.unitPrice;
        var lineTotal = unitPrice * qty;
        var deptId = String(it.pd_dept || product[PF.dept] || "").trim();
        out.push({
            productId: productId,
            productName: String(it.productName || product[PF.name] || product.pd_name || "").trim(),
            pd_dept: deptId,
            pd_dept_label: deptLabel(deptId),
            pd_size: String(it.pd_size || product[PF.size] || product.pd_size || "").trim(),
            unitPrice: unitPrice,
            priceLabel: priced.priceLabel,
            quantity: qty,
            lineTotal: lineTotal
        });
    }
    return out.length ? out : null;
}

router.get("/", requireRole("admin", "vendor"), async function (req, res) {
    try {
        let query;
        if (req.auth.role === "vendor") {
            const vendor = await findVendorByLoginId(req.auth.userId || "");
            if (!vendor || !vendorCanPlaceOrders(vendor)) {
                return res.status(403).json({
                    ok: false,
                    error: "주문 내역을 조회할 권한이 없습니다."
                });
            }
            query = buildVendorOrderListQuery(req.auth);
        } else {
            if (!staffCanAccessOrderManage(req.auth)) {
                return res.status(403).json({
                    ok: false,
                    error: "주문서관리는 aksangsa 관리자만 이용할 수 있습니다."
                });
            }
            query = buildOrderListQuery(req.auth);
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

router.get("/:id", requireRole("admin", "vendor"), async function (req, res) {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ ok: false, error: "주문 ID가 없습니다." });
        }
        const order = await getDb().collection("orders").findOne({ id: id });
        if (!order) {
            return res.status(404).json({ ok: false, error: "주문을 찾을 수 없습니다." });
        }
        if (!staffCanReadOrder(req.auth, order)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        return res.json({ ok: true, order: toOrderDetail(order) });
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
        if (!staffCanReadOrder(req.auth, order)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        await col.deleteOne({ id: id });
        return res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/orders/:id", e);
        return res.status(500).json({ ok: false, error: "주문 삭제에 실패했습니다." });
    }
});

router.post("/", requireRole("vendor"), async function (req, res) {
    try {
        const db = getDb();
        const vendor = await findVendorByLoginId(req.auth.userId || "");
        if (!vendor) {
            return res.status(403).json({ ok: false, error: "업체 정보를 찾을 수 없습니다." });
        }
        if (!vendorCanPlaceOrders(vendor)) {
            return res.status(403).json({
                ok: false,
                error:
                    "주문 권한이 없습니다. 담당 거래처(" +
                    getOrderEnabledStaffId() +
                    ")에 등록된 업체만 주문할 수 있습니다."
            });
        }

        if (!req.body || req.body.orderContactConfirmed !== true) {
            return res.status(400).json({
                ok: false,
                error: "주문 담당자 확인에 체크해 주세요."
            });
        }

        const items = await buildOrderItemsFromDb(db, req.body && req.body.items, vendor);
        if (!items) {
            return res.status(400).json({ ok: false, error: "주문할 상품이 없습니다." });
        }

        const totalAmount = items.reduce(function (s, it) {
            return s + it.lineTotal;
        }, 0);

        const orderId = newOrderId();
        const orderNo = newOrderNo();
        const createdAt = Date.now();

        const order = await buildEnrichedOrder(db, vendor, items, {
            id: orderId,
            orderNo: orderNo,
            vendorUserId: req.auth.userId || "",
            vendorCompany: String((req.body && req.body.vendorCompany) || "").trim(),
            vendorGrade: String((req.body && req.body.vendorGrade) || "").trim(),
            note: String((req.body && req.body.note) || "").trim(),
            totalAmount: totalAmount,
            createdAt: createdAt,
            status: "submitted",
            orderContactConfirmed: true,
            orderContactConfirmedAt: createdAt
        });

        await db.collection("orders").insertOne(order);

        let pdfBuffer = null;
        try {
            pdfBuffer = await buildOrderPdfBuffer(order);
            await db.collection("orders").updateOne(
                { id: order.id },
                { $set: { hasPdf: true, pdfGeneratedAt: Date.now() } }
            );
        } catch (pdfErr) {
            console.error("order PDF", pdfErr.message);
        }

        const notifyResult = await notifyOrderAdmin(db, order, pdfBuffer);

        return res.json({
            ok: true,
            order: {
                id: order.id,
                orderNo: order.orderNo,
                totalAmount: order.totalAmount,
                createdAt: order.createdAt
            },
            orderDetail: order,
            pdfReady: !!pdfBuffer,
            pdfUrl: "/api/orders/" + encodeURIComponent(order.id) + "/pdf",
            notify: notifyResult
        });
    } catch (e) {
        console.error("POST /api/orders", e);
        return res.status(500).json({ ok: false, error: "주문 처리 중 오류가 발생했습니다." });
    }
});

router.get("/:id/pdf", requireRole("vendor", "admin"), async function (req, res) {
    try {
        const id = String(req.params.id || "");
        const order = await getDb().collection("orders").findOne({ id: id });
        if (!order) {
            return res.status(404).json({ ok: false, error: "주문을 찾을 수 없습니다." });
        }
        if (!staffCanReadOrder(req.auth, order)) {
            return res.status(403).json({ ok: false, error: "권한이 없습니다." });
        }
        const pdfOrder = await prepareOrderForPdf(getDb(), order);
        const buf = await buildOrderPdfBuffer(pdfOrder);
        const company = safeFilePart(pdfOrder.vendorCompany || "주문서");
        const date = ymd(pdfOrder.createdAt);
        const fname = company + "_" + date + ".pdf";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="' + encodeURIComponent(fname) + '"; filename*=UTF-8\'\'' + encodeURIComponent(fname)
        );
        res.send(buf);
    } catch (e) {
        console.error("GET order pdf", e);
        return res.status(500).json({ ok: false, error: "PDF 생성에 실패했습니다." });
    }
});

module.exports = router;
