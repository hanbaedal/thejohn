const { trimStaffLoginId, registeredByInFilter } = require("./staffLoginId");
const { supervisorCanAccessAllOrders } = require("./orderAccess");
const { resolveSalesPeriod, buildIssueDateQuery } = require("./salesPeriod");
const { COL: RECORDS_COL, toPublicRow } = require("./salesRecords");
const { COL: LEDGER_COL } = require("./salesLedger");
const { fromLegacyDoc: productFromLegacy, F: PF } = require("./productFields");

function str(v) {
    return String(v ?? "").trim();
}

function issuerFilter(auth, adminStaffId) {
    if (supervisorCanAccessAllOrders(auth)) {
        const issuer = trimStaffLoginId(adminStaffId);
        if (issuer) return { issuerStaffLoginId: registeredByInFilter(issuer) };
        return {};
    }
    return { issuerStaffLoginId: registeredByInFilter(trimStaffLoginId(auth.userId)) };
}

function ledgerRowsFromDoc(doc) {
    const items = Array.isArray(doc.items) ? doc.items : [];
    const rows = [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const qty = Number(it.quantity) || 0;
        const unit = Number(it.unitPrice) || 0;
        const line = Number(it.lineTotal) || (qty && unit ? qty * unit : 0);
        if (!str(it.productName) && !line) continue;
        rows.push({
            id: str(doc.id) + ":" + i,
            issueDate: Number(doc.issueDate) || Number(doc.createdAt) || 0,
            source: "ledger",
            sourceLabel: "거래명세서(수기)",
            orderNo: "",
            vendorCompany: str(doc.vendorCompany),
            productId: str(it.productId),
            productName: str(it.productName),
            pd_code: str(it.pd_code),
            pd_dept: str(it.pd_dept),
            quantity: qty,
            unitPrice: unit,
            lineTotal: line,
            issuerStaffLoginId: str(doc.issuerStaffLoginId)
        });
    }
    return rows;
}

function summarize(items) {
    return {
        count: items.length,
        totalQuantity: items.reduce(function (s, r) {
            return s + (Number(r.quantity) || 0);
        }, 0),
        totalAmount: items.reduce(function (s, r) {
            return s + (Number(r.lineTotal) || 0);
        }, 0)
    };
}

function sortRows(items) {
    items.sort(function (a, b) {
        const da = Number(a.issueDate) || 0;
        const db = Number(b.issueDate) || 0;
        if (da !== db) return db - da;
        const va = str(a.vendorCompany);
        const vb = str(b.vendorCompany);
        if (va !== vb) return va.localeCompare(vb, "ko");
        return str(a.productName).localeCompare(str(b.productName), "ko");
    });
    return items;
}

function rowMatchesProduct(row, dept, productId, pdCode) {
    if (dept && str(row.pd_dept) !== dept) return false;
    if (productId && str(row.productId) === productId) return true;
    if (pdCode && str(row.pd_code) === pdCode) return true;
    return false;
}

function ymdFromTs(ts) {
    const d = new Date(Number(ts) || Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
}

function aggregateByDate(items) {
    const map = {};
    (items || []).forEach(function (row) {
        const ymd = ymdFromTs(row.issueDate);
        if (!map[ymd]) {
            map[ymd] = {
                issueDate: ymd,
                count: 0,
                totalQuantity: 0,
                totalAmount: 0
            };
        }
        map[ymd].count += 1;
        map[ymd].totalQuantity += Number(row.quantity) || 0;
        map[ymd].totalAmount += Number(row.lineTotal) || 0;
    });
    return Object.keys(map)
        .sort(function (a, b) {
            return b.localeCompare(a);
        })
        .map(function (k) {
            return map[k];
        });
}

async function fetchLedgerItems(db, auth, query, dateQ, issuerQ, vendorCompany) {
    const orderMatch = Object.assign({}, issuerQ, dateQ, { source: "order" });
    if (vendorCompany) orderMatch.vendorCompany = vendorCompany;

    const orderRows = await db
        .collection(RECORDS_COL)
        .find(orderMatch)
        .sort({ issueDate: -1 })
        .limit(5000)
        .toArray();

    let items = orderRows.map(function (doc) {
        const row = toPublicRow(doc);
        row.sourceLabel = "거래명세서(주문)";
        return row;
    });

    const ledgerMatch = Object.assign({}, issuerQ, dateQ, {
        sourceType: "transaction_manual"
    });
    if (vendorCompany) ledgerMatch.vendorCompany = vendorCompany;

    const ledgerDocs = await db
        .collection(LEDGER_COL)
        .find(ledgerMatch)
        .sort({ issueDate: -1 })
        .limit(500)
        .toArray();

    ledgerDocs.forEach(function (doc) {
        items = items.concat(ledgerRowsFromDoc(doc));
    });

    return items;
}

async function querySalesLedgerInquiry(db, auth, query) {
    query = query || {};
    const mode = str(query.mode || "vendor").toLowerCase();
    const period = resolveSalesPeriod(query.preset, query.dateFrom, query.dateTo);
    if (period.error) return { error: period.error };

    const datePack = buildIssueDateQuery(period.dateFrom, period.dateTo);
    if (datePack.error) return { error: datePack.error };

    const vendorCompany = str(query.vendorCompany);
    const dept = str(query.dept || query.pd_dept);
    const productId = str(query.productId);

    if (mode === "vendor" && !vendorCompany) {
        return { error: "업체를 선택해 주세요." };
    }
    if (mode === "product") {
        if (!dept) return { error: "사업부문을 선택해 주세요." };
        if (!productId) return { error: "품목을 선택해 주세요." };
    }

    const issuerQ = issuerFilter(auth, query.adminStaffId);
    const dateQ = datePack.query;

    const vendorFilter = mode === "vendor" ? vendorCompany : "";
    let items = await fetchLedgerItems(db, auth, query, dateQ, issuerQ, vendorFilter);

    if (mode === "product") {
        const product = await db.collection("products").findOne({ id: productId });
        const pdCode = product
            ? str(product.pd_code || (productFromLegacy(product) || {})[PF.code])
            : "";
        items = items.filter(function (row) {
            return rowMatchesProduct(row, dept, productId, pdCode);
        });
    }

    items = sortRows(items);

    const result = {
        ok: true,
        mode: mode,
        period: {
            preset: period.preset,
            label: period.label,
            dateFrom: period.dateFrom,
            dateTo: period.dateTo
        },
        filter:
            mode === "vendor"
                ? { vendorCompany: vendorCompany }
                : mode === "product"
                  ? { dept: dept, productId: productId }
                  : {},
        summary: summarize(items),
        items: items
    };

    if (mode === "date") {
        result.dayGroups = aggregateByDate(items);
        result.summary = {
            count: result.dayGroups.length,
            totalQuantity: items.reduce(function (s, r) {
                return s + (Number(r.quantity) || 0);
            }, 0),
            totalAmount: items.reduce(function (s, r) {
                return s + (Number(r.lineTotal) || 0);
            }, 0)
        };
    }

    return result;
}

module.exports = {
    querySalesLedgerInquiry,
    ledgerRowsFromDoc,
    aggregateByDate
};
