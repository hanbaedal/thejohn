const { trimStaffLoginId, registeredByInFilter } = require("./staffLoginId");
const { supervisorCanAccessAllOrders } = require("./orderAccess");
const { parseYmdToMs } = require("./accessLog");
const { fromLegacyDoc: productFromLegacy, F: PF } = require("./productFields");

const COL = "sales_records";

function str(v) {
    return String(v ?? "").trim();
}

function newLineId() {
    return "sr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

async function ensureIndexes(db) {
    const col = db.collection(COL);
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ source: 1, sourceId: 1 });
    await col.createIndex({ issuerStaffLoginId: 1, issueDate: -1 });
    await col.createIndex({ productId: 1, issueDate: -1 });
    await col.createIndex({ pd_dept: 1, issueDate: -1 });
    await col.createIndex({ vendorCompany: 1, issueDate: -1 });
}

async function lookupProductMeta(db, it) {
    let productId = str(it.productId);
    let pd_dept = str(it.pd_dept);
    let pd_code = str(it.pd_code);
    let productName = str(it.productName);

    if (productId) {
        const p = await db.collection("products").findOne({ id: productId });
        if (p) {
            const leg = productFromLegacy(p) || {};
            if (!pd_dept) pd_dept = str(leg[PF.dept] || p.pd_dept);
            if (!pd_code) pd_code = str(leg[PF.code] || p.pd_code);
            if (!productName) productName = str(leg[PF.name] || p.pd_name);
        }
    } else if (pd_code) {
        const p = await db.collection("products").findOne({ pd_code: pd_code });
        if (p) {
            productId = str(p.id);
            const leg = productFromLegacy(p) || {};
            if (!pd_dept) pd_dept = str(leg[PF.dept] || p.pd_dept);
            if (!productName) productName = str(leg[PF.name] || p.pd_name);
        }
    }
    return { productId, pd_dept, pd_code, productName };
}

function lineFromItem(base, it, index, meta) {
    meta = meta || {};
    const qty = Number(it.quantity) || 0;
    const unit = Number(it.unitPrice) || 0;
    const line = Number(it.lineTotal) || (qty && unit ? qty * unit : 0);
    return Object.assign({}, base, {
        id: newLineId(),
        sourceLineIndex: index,
        productId: meta.productId || str(it.productId),
        productName: meta.productName || str(it.productName),
        pd_code: meta.pd_code || str(it.pd_code),
        pd_dept: meta.pd_dept || str(it.pd_dept),
        pd_size: str(it.pd_size),
        quantity: qty,
        unitPrice: unit,
        lineTotal: line
    });
}

async function replaceSalesForSource(db, source, sourceId, lines) {
    const col = db.collection(COL);
    await col.deleteMany({ source: source, sourceId: sourceId });
    if (!lines || !lines.length) return 0;
    await col.insertMany(lines);
    return lines.length;
}

async function syncFromOrder(db, order) {
    if (!order || !order.id) return 0;
    await ensureIndexes(db);
    const base = {
        source: "order",
        sourceId: order.id,
        sourceLabel: "주문",
        orderNo: str(order.orderNo),
        issuerStaffLoginId: trimStaffLoginId(order.vendorRegisteredBy),
        issuerStaffName: str(order.vendorRegisteredByName),
        issueDate: Number(order.createdAt) || Date.now(),
        vendorCompany: str(order.vendorCompany),
        vendorUserId: str(order.vendorUserId),
        syncedAt: Date.now()
    };
    const items = Array.isArray(order.items) ? order.items : [];
    const lines = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const meta = await lookupProductMeta(db, it);
        lines.push(lineFromItem(base, it, i, meta));
    }
    return replaceSalesForSource(db, "order", order.id, lines);
}

async function syncFromManualTransaction(db, doc) {
    if (!doc || !doc.id) return 0;
    await ensureIndexes(db);
    const base = {
        source: "manual",
        sourceId: doc.id,
        sourceLabel: "수기",
        orderNo: "",
        issuerStaffLoginId: trimStaffLoginId(doc.issuerStaffLoginId),
        issuerStaffName: str(doc.issuerStaffName),
        issueDate: Number(doc.issueDate || doc.createdAt) || Date.now(),
        vendorCompany: str(doc.vendorCompany),
        vendorUserId: "",
        syncedAt: Date.now()
    };
    const items = Array.isArray(doc.items) ? doc.items : [];
    const lines = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const meta = await lookupProductMeta(db, it);
        lines.push(lineFromItem(base, it, i, meta));
    }
    return replaceSalesForSource(db, "manual", doc.id, lines);
}

async function deleteSalesForSource(db, source, sourceId) {
    await db.collection(COL).deleteMany({ source: source, sourceId: sourceId });
}

function buildDateQuery(dateFrom, dateTo) {
    const fromMs = parseYmdToMs(dateFrom, false);
    const toMs = parseYmdToMs(dateTo, true);
    if ((dateFrom && !fromMs) || (dateTo && !toMs)) {
        return { error: "기간 날짜 형식이 올바르지 않습니다." };
    }
    if (fromMs && toMs && fromMs >= toMs) {
        return { error: "기간 선택이 올바르지 않습니다." };
    }
    const q = {};
    if (fromMs || toMs) {
        q.issueDate = {};
        if (fromMs) q.issueDate.$gte = fromMs;
        if (toMs) q.issueDate.$lt = toMs;
    }
    return { query: q };
}

function issuerFilter(auth, adminStaffId) {
    if (supervisorCanAccessAllOrders(auth)) {
        const issuer = trimStaffLoginId(adminStaffId);
        if (issuer) return { issuerStaffLoginId: registeredByInFilter(issuer) };
        return {};
    }
    return { issuerStaffLoginId: registeredByInFilter(trimStaffLoginId(auth.userId)) };
}

function toPublicRow(doc) {
    return {
        id: doc.id,
        source: doc.source,
        sourceId: doc.sourceId,
        sourceLabel: doc.sourceLabel || doc.source,
        orderNo: str(doc.orderNo),
        issueDate: doc.issueDate || 0,
        issuerStaffLoginId: str(doc.issuerStaffLoginId),
        issuerStaffName: str(doc.issuerStaffName),
        vendorCompany: str(doc.vendorCompany),
        productId: str(doc.productId),
        productName: str(doc.productName),
        pd_code: str(doc.pd_code),
        pd_dept: str(doc.pd_dept),
        pd_size: str(doc.pd_size),
        quantity: Number(doc.quantity) || 0,
        unitPrice: Number(doc.unitPrice) || 0,
        lineTotal: Number(doc.lineTotal) || 0
    };
}

async function queryByProduct(db, auth, query) {
    query = query || {};
    const dept = str(query.dept || query.pd_dept);
    const productId = str(query.productId);
    if (!dept) return { error: "사업부문을 선택해 주세요." };
    if (!productId) return { error: "품목을 선택해 주세요." };

    const datePack = buildDateQuery(query.dateFrom, query.dateTo);
    if (datePack.error) return { error: datePack.error };

    const product = await db.collection("products").findOne({ id: productId });
    const pdCode = product ? str(product.pd_code || (productFromLegacy(product) || {})[PF.code]) : "";

    const match = Object.assign({}, issuerFilter(auth, query.adminStaffId), datePack.query, {
        pd_dept: dept,
        $or: [{ productId: productId }]
    });
    if (pdCode) match.$or.push({ pd_code: pdCode });

    const rows = await db
        .collection(COL)
        .find(match)
        .sort({ issueDate: -1, sourceId: 1, sourceLineIndex: 1 })
        .limit(2000)
        .toArray();

    const items = rows.map(toPublicRow);
    const summary = {
        count: items.length,
        totalQuantity: items.reduce(function (s, r) {
            return s + (Number(r.quantity) || 0);
        }, 0),
        totalAmount: items.reduce(function (s, r) {
            return s + (Number(r.lineTotal) || 0);
        }, 0)
    };
    return {
        ok: true,
        filter: { dept: dept, productId: productId, dateFrom: query.dateFrom, dateTo: query.dateTo },
        product: product
            ? {
                  id: product.id,
                  name: str(product.pd_name || (productFromLegacy(product) || {})[PF.name]),
                  pd_code: pdCode,
                  pd_dept: dept
              }
            : { id: productId, name: "", pd_code: pdCode, pd_dept: dept },
        summary: summary,
        items: items
    };
}

async function queryByVendor(db, auth, query) {
    query = query || {};
    const vendorCompany = str(query.vendorCompany);
    if (!vendorCompany) return { error: "업체를 선택해 주세요." };

    const datePack = buildDateQuery(query.dateFrom, query.dateTo);
    if (datePack.error) return { error: datePack.error };

    const match = Object.assign({}, issuerFilter(auth, query.adminStaffId), datePack.query, {
        vendorCompany: vendorCompany
    });

    const rows = await db
        .collection(COL)
        .find(match)
        .sort({ issueDate: -1, sourceId: 1, sourceLineIndex: 1 })
        .limit(2000)
        .toArray();

    const items = rows.map(toPublicRow);
    const summary = {
        count: items.length,
        totalQuantity: items.reduce(function (s, r) {
            return s + (Number(r.quantity) || 0);
        }, 0),
        totalAmount: items.reduce(function (s, r) {
            return s + (Number(r.lineTotal) || 0);
        }, 0)
    };
    return {
        ok: true,
        filter: { vendorCompany: vendorCompany, dateFrom: query.dateFrom, dateTo: query.dateTo },
        summary: summary,
        items: items
    };
}

async function backfillSalesRecords(db) {
    await ensureIndexes(db);
    const count = await db.collection(COL).countDocuments({});
    if (count > 0) return { skipped: true, count: count };

    let orderLines = 0;
    const orders = await db.collection("orders").find({}).toArray();
    for (let i = 0; i < orders.length; i++) {
        orderLines += await syncFromOrder(db, orders[i]);
    }

    let manualLines = 0;
    const manuals = await db.collection("transaction_manual").find({}).toArray();
    for (let j = 0; j < manuals.length; j++) {
        manualLines += await syncFromManualTransaction(db, manuals[j]);
    }

    const total = await db.collection(COL).countDocuments({});
    console.log("[sales_records] backfill done — orders:", orders.length, "manual:", manuals.length, "lines:", total);
    return { skipped: false, orders: orders.length, manual: manuals.length, lines: total, orderLines, manualLines };
}

module.exports = {
    COL,
    ensureIndexes,
    syncFromOrder,
    syncFromManualTransaction,
    deleteSalesForSource,
    queryByProduct,
    queryByVendor,
    backfillSalesRecords,
    toPublicRow
};
