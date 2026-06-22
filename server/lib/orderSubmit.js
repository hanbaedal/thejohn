const { F: PF } = require("./productFields");
const { deptLabel } = require("./orderDeptLabels");
const { resolveVendorUnitPrice } = require("./vendorPricing");
const { findVendorByLoginAndRegistrar, findAllVendorsByLoginId } = require("./vendorLookup");
const { findVendorByLoginId } = require("./loginResolve");
const { buildEnrichedOrder } = require("./orderEnrich");
const { buildOrderPdfBuffer } = require("./orderPdf");
const { notifyOrderAdmin } = require("./orderNotify");
const { vendorProductAllowsOrderForVendor } = require("./orderAccess");
const { trimStaffLoginId, staffLoginIdsEqual } = require("./staffLoginId");
const { syncFromOrder, deleteSalesForSource } = require("./salesRecords");
const { resolveVendorOrderContact } = require("./vendorOrderContact");
const { allocVendorOrderNo } = require("./orderNo");

function newOrderId() {
    return "ord_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/** @deprecated 테스트·레거시 — 신규 주문은 allocVendorOrderNo 사용 */
function newOrderNoLegacy() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    var seq = String(Date.now()).slice(-6);
    return "DZ" + y + m + day + "-" + seq;
}

function groupItemsByProductAdmin(items) {
    var map = new Map();
    (items || []).forEach(function (it) {
        var key = trimStaffLoginId(it.productRegisteredBy);
        if (!key) key = "_unknown";
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(it);
    });
    return map;
}

async function buildOrderItemsFromDb(db, clientItems, vendorLoginId) {
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

        var productReg = String(product[PF.registeredBy] || product.pd_registered_by || "").trim();
        if (!(await vendorProductAllowsOrderForVendor(productReg, vendorLoginId))) {
            return {
                error:
                    "「" +
                    (product[PF.name] || product.pd_name || productId) +
                    "」 주문할 수 없습니다. 관리자에게 등록된 업체 계정으로 로그인했는지 확인해 주세요."
            };
        }

        var vendorDoc = await findVendorByLoginAndRegistrar(vendorLoginId, productReg);
        var priced = resolveVendorUnitPrice(product, vendorDoc);
        var unitPrice = priced.unitPrice;
        var lineTotal = unitPrice * qty;
        var deptId = String(it.pd_dept || product[PF.dept] || product.pd_dept || "").trim();

        out.push({
            productId: productId,
            productName: String(it.productName || product[PF.name] || product.pd_name || "").trim(),
            pd_dept: deptId,
            pd_dept_label: deptLabel(deptId),
            pd_size: String(it.pd_size || product[PF.size] || product.pd_size || "").trim(),
            unitPrice: unitPrice,
            priceLabel: priced.priceLabel,
            pricingMode: priced.pricingMode || "",
            quantity: qty,
            lineTotal: lineTotal,
            productRegisteredBy: productReg
        });
    }
    return out.length ? out : null;
}

async function buildSplitAdminOrder(db, vendorLoginId, vendorPrimary, items, extras) {
    var staffLogin = trimStaffLoginId(extras.orderStaffLoginId);
    var vendorDoc = (await findVendorByLoginAndRegistrar(vendorLoginId, staffLogin)) || vendorPrimary;
    var totalAmount = items.reduce(function (s, it) {
        return s + (Number(it.lineTotal) || 0);
    }, 0);
    return buildEnrichedOrder(db, vendorDoc, items, Object.assign({}, extras, {
        totalAmount: totalAmount,
        orderKind: "admin",
        orderStaffLoginId: staffLogin,
        parentOrderId: extras.parentOrderId,
        supplierStaffLoginId: staffLogin
    }));
}

async function submitVendorOrder(db, auth, body) {
    var vendorLoginId = trimStaffLoginId(auth.userId);
    var primaryVendor = await findVendorByLoginId(vendorLoginId);
    if (!primaryVendor) {
        return { error: "업체 정보를 찾을 수 없습니다.", status: 403 };
    }

    var allVendors = await findAllVendorsByLoginId(vendorLoginId);
    var registered = resolveVendorOrderContact(allVendors.length ? allVendors : [primaryVendor]);
    var placerName = String((body && (body.orderPlacerName || body.vendorMgrName)) || "").trim();
    var placerTel = String((body && (body.orderPlacerTel || body.vendorMgrTel)) || "").trim();
    if (!placerName || !placerTel) {
        return { error: "주문하는 분 이름·연락처를 입력해 주세요.", status: 400 };
    }

    var contactExtras = {
        vendorRegisteredMgrName: registered.mgrName,
        vendorRegisteredMgrTel: registered.mgrTel,
        vendorMgrName: placerName,
        vendorMgrTel: placerTel
    };

    var builtItems = await buildOrderItemsFromDb(db, body && body.items, vendorLoginId);
    if (builtItems && builtItems.error) {
        return { error: builtItems.error, status: 403 };
    }
    var items = builtItems;
    if (!items || !items.length) {
        return { error: "주문할 상품이 없습니다.", status: 400 };
    }

    var createdAt = Date.now();
    var vendorOrderId = newOrderId();
    var vendorOrderNo = await allocVendorOrderNo(db);
    var totalAmount = items.reduce(function (s, it) {
        return s + it.lineTotal;
    }, 0);

    var vendorOrder = await buildEnrichedOrder(db, primaryVendor, items, Object.assign({}, contactExtras, {
        id: vendorOrderId,
        orderNo: vendorOrderNo,
        vendorUserId: vendorLoginId,
        vendorCompany: String((body && body.vendorCompany) || "").trim(),
        note: String((body && body.note) || "").trim(),
        totalAmount: totalAmount,
        createdAt: createdAt,
        status: "submitted",
        orderContactConfirmed: true,
        orderContactConfirmedAt: createdAt,
        orderKind: "vendor"
    }));

    await db.collection("orders").insertOne(vendorOrder);

    var enrichedItems = vendorOrder.items || items;
    var groups = groupItemsByProductAdmin(enrichedItems);
    var adminOrders = [];
    var notifyResults = [];

    for (var entry of groups) {
        var staffLogin = entry[0];
        var groupItems = entry[1];
        if (staffLogin === "_unknown" || !groupItems.length) continue;

        var adminOrderId = newOrderId();
        var adminOrderNo = vendorOrderNo + "-" + String(adminOrders.length + 1).padStart(2, "0");
        var adminOrder = await buildSplitAdminOrder(db, vendorLoginId, primaryVendor, groupItems, Object.assign({}, contactExtras, {
            id: adminOrderId,
            orderNo: adminOrderNo,
            vendorUserId: vendorLoginId,
            vendorCompany: vendorOrder.vendorCompany,
            note: vendorOrder.note,
            createdAt: createdAt,
            status: "submitted",
            orderContactConfirmed: true,
            orderContactConfirmedAt: createdAt,
            parentOrderId: vendorOrderId,
            orderStaffLoginId: staffLogin
        }));

        await db.collection("orders").insertOne(adminOrder);
        adminOrders.push(adminOrder);

        try {
            await syncFromOrder(db, adminOrder);
        } catch (syncErr) {
            console.error("sales_records sync admin order", syncErr.message);
        }

        try {
            await buildOrderPdfBuffer(adminOrder);
            await db.collection("orders").updateOne(
                { id: adminOrder.id },
                { $set: { hasPdf: true, pdfGeneratedAt: Date.now() } }
            );
        } catch (pdfErr) {
            console.error("admin order PDF", pdfErr.message);
        }

        try {
            var notifyResult = await notifyOrderAdmin(db, adminOrder);
            notifyResults.push({ orderId: adminOrder.id, staffLogin: staffLogin, notify: notifyResult });
        } catch (notifyErr) {
            console.error("admin order notify", notifyErr.message);
            notifyResults.push({ orderId: adminOrder.id, staffLogin: staffLogin, error: notifyErr.message });
        }
    }

    try {
        await buildOrderPdfBuffer(vendorOrder);
        await db.collection("orders").updateOne(
            { id: vendorOrder.id },
            { $set: { hasPdf: true, pdfGeneratedAt: Date.now(), adminOrderIds: adminOrders.map(function (o) {
                return o.id;
            }) } }
        );
    } catch (pdfErr) {
        console.error("vendor order PDF", pdfErr.message);
    }

    return {
        ok: true,
        order: vendorOrder,
        adminOrders: adminOrders,
        notifyResults: notifyResults
    };
}

async function deleteOrderCascade(db, order) {
    if (!order || !order.id) return;
    var col = db.collection("orders");
    if (order.orderKind === "vendor") {
        var children = await col.find({ parentOrderId: order.id }).toArray();
        for (var i = 0; i < children.length; i++) {
            await col.deleteOne({ id: children[i].id });
            try {
                await deleteSalesForSource(db, "order", children[i].id);
            } catch (e) {}
        }
    }
    await col.deleteOne({ id: order.id });
    try {
        await deleteSalesForSource(db, "order", order.id);
    } catch (e) {}
    if (order.parentOrderId && order.orderKind === "admin") {
        try {
            await deleteSalesForSource(db, "order", order.id);
        } catch (e2) {}
    }
}

module.exports = {
    buildOrderItemsFromDb,
    submitVendorOrder,
    deleteOrderCascade,
    newOrderId,
    newOrderNoLegacy
};
