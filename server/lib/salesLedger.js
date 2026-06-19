const { trimStaffLoginId, staffLoginIdsEqual, registeredByInFilter } = require("./staffLoginId");
const { supervisorCanAccessAllOrders } = require("./orderAccess");

const COL = "sales_ledgers";

function str(v) {
    return String(v ?? "").trim();
}

function newId() {
    return "sl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function parseIssueDate(v) {
    if (v == null || v === "") return Date.now();
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d.getTime() : Date.now();
}

function normalizeItems(raw) {
    const list = Array.isArray(raw) ? raw : [];
    const out = [];
    let sum = 0;
    for (let i = 0; i < list.length && i < 50; i++) {
        const it = list[i] || {};
        const qty = Number(it.quantity) || 0;
        const unit = Number(it.unitPrice) || 0;
        const line = Number(it.lineTotal) || (qty && unit ? qty * unit : 0);
        if (!str(it.productName) && !line) continue;
        sum += line;
        out.push({
            productId: str(it.productId),
            pd_code: str(it.pd_code).slice(0, 16),
            productName: str(it.productName),
            pd_size: str(it.pd_size),
            quantity: qty,
            unitPrice: unit,
            lineTotal: line
        });
    }
    return { items: out, totalAmount: sum };
}

function buildFromBody(body, auth, existing) {
    const itemsPack = normalizeItems(body.items);
    const issuerStaffLoginId =
        str(body.issuerStaffLoginId) ||
        (existing && existing.issuerStaffLoginId) ||
        trimStaffLoginId(auth && auth.userId);

    return {
        title: str(body.title) || str(body.vendorCompany) || "매출장",
        issueDate: parseIssueDate(body.issueDate != null ? body.issueDate : body.createdAt),
        issuerStaffLoginId: issuerStaffLoginId,
        issuerStaffName: str(body.issuerStaffName),
        vendorCompany: str(body.vendorCompany),
        vendorUserId: str(body.vendorUserId),
        sourceType: str(body.sourceType) || str(existing && existing.sourceType) || "manual",
        sourceId: str(body.sourceId) || str(existing && existing.sourceId),
        items: itemsPack.items,
        totalAmount:
            Number(body.totalAmount) > 0 ? Number(body.totalAmount) : itemsPack.totalAmount,
        note: str(body.note)
    };
}

function toPublic(doc) {
    if (!doc) return null;
    return {
        id: doc.id,
        title: str(doc.title),
        issueDate: doc.issueDate || doc.createdAt || 0,
        createdAt: doc.createdAt || 0,
        updatedAt: doc.updatedAt || 0,
        issuerStaffLoginId: str(doc.issuerStaffLoginId),
        issuerStaffName: str(doc.issuerStaffName),
        vendorCompany: str(doc.vendorCompany),
        vendorUserId: str(doc.vendorUserId),
        sourceType: str(doc.sourceType),
        sourceId: str(doc.sourceId),
        items: Array.isArray(doc.items) ? doc.items : [],
        totalAmount: Number(doc.totalAmount) || 0,
        note: str(doc.note),
        createdBy: str(doc.createdBy)
    };
}

function listFilter(auth, query) {
    query = query || {};
    if (supervisorCanAccessAllOrders(auth)) {
        const issuer = trimStaffLoginId(query.issuerStaffId || query.adminStaffId || "");
        if (issuer) return { issuerStaffLoginId: registeredByInFilter(issuer) };
        return {};
    }
    if (auth.role === "admin") {
        return { issuerStaffLoginId: registeredByInFilter(auth.userId) };
    }
    return { createdBy: trimStaffLoginId(auth.userId) };
}

function canAccessDoc(auth, doc) {
    if (!doc) return false;
    if (supervisorCanAccessAllOrders(auth)) return true;
    if (auth.role === "admin") {
        return staffLoginIdsEqual(doc.issuerStaffLoginId, auth.userId);
    }
    return staffLoginIdsEqual(doc.createdBy, auth.userId);
}

async function assertSalesLedgerAccess(auth) {
    if (!auth) throw new Error("권한이 없습니다.");
    if (auth.role === "supervisor" || auth.role === "admin") return;
    throw new Error("관리자·슈퍼바이저만 이용할 수 있습니다.");
}

function validateBuilt(built) {
    if (!str(built.vendorCompany)) return "거래처(업체명)를 입력해 주세요.";
    if (!str(built.issuerStaffLoginId)) return "발행 관리자를 선택해 주세요.";
    if (!built.items.length) return "품목을 1개 이상 입력해 주세요.";
    return "";
}

async function ensureIndexes(db) {
    const col = db.collection(COL);
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ issuerStaffLoginId: 1, issueDate: -1 });
    await col.createIndex({ sourceType: 1, sourceId: 1 });
    await col.createIndex({ createdBy: 1, updatedAt: -1 });
}

async function createFromTransaction(db, txnDoc, auth) {
    if (!txnDoc || !txnDoc.id) return null;
    await ensureIndexes(db);
    const col = db.collection(COL);
    const existing = await col.findOne({ sourceType: "transaction_manual", sourceId: txnDoc.id });
    if (existing) return existing;

    const built = {
        title: str(txnDoc.title) || str(txnDoc.vendorCompany) || "매출장",
        issueDate: txnDoc.issueDate || txnDoc.createdAt || Date.now(),
        issuerStaffLoginId: str(txnDoc.issuerStaffLoginId),
        issuerStaffName: str(txnDoc.issuerStaffName),
        vendorCompany: str(txnDoc.vendorCompany),
        sourceType: "transaction_manual",
        sourceId: txnDoc.id,
        items: Array.isArray(txnDoc.items) ? txnDoc.items : [],
        totalAmount: Number(txnDoc.totalAmount) || 0,
        note: str(txnDoc.note)
    };
    const now = Date.now();
    const doc = Object.assign({}, built, {
        id: newId(),
        createdAt: now,
        updatedAt: now,
        createdBy: trimStaffLoginId(auth && auth.userId)
    });
    await col.insertOne(doc);
    return doc;
}

module.exports = {
    COL,
    newId,
    buildFromBody,
    toPublic,
    listFilter,
    canAccessDoc,
    assertSalesLedgerAccess,
    validateBuilt,
    ensureIndexes,
    createFromTransaction
};
