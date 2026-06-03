const { prepareManualTransactionForPdf } = require("./orderEnrich");
const { buildTransactionPdfBuffer } = require("./transactionPdf");
const { trimStaffLoginId, staffLoginIdsEqual } = require("./staffLoginId");
const { staffCanAccessOrderManage, supervisorCanAccessAllOrders } = require("./orderAccess");

const COL = "transaction_manual";

function str(v) {
    return String(v ?? "").trim();
}

function newId() {
    return "txn_m_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
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
    for (let i = 0; i < list.length && i < 10; i++) {
        const it = list[i] || {};
        const qty = Number(it.quantity) || 0;
        const unit = Number(it.unitPrice) || 0;
        const line = Number(it.lineTotal) || (qty && unit ? qty * unit : 0);
        if (!str(it.productName) && !line) continue;
        sum += line;
        out.push({
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
        str(body.vendorRegisteredBy) ||
        (existing && existing.issuerStaffLoginId) ||
        trimStaffLoginId(auth && auth.userId);

    return {
        title: str(body.title) || str(body.vendorCompany) || "거래명세서",
        issueDate: parseIssueDate(body.issueDate != null ? body.issueDate : body.createdAt),
        issuerStaffLoginId: issuerStaffLoginId,
        issuerStaffName: str(body.issuerStaffName),
        vendorCompany: str(body.vendorCompany),
        vendorCeo: str(body.vendorCeo),
        vendorAddr: str(body.vendorAddr),
        vendorPhone: str(body.vendorPhone),
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
        vendorCeo: str(doc.vendorCeo),
        vendorAddr: str(doc.vendorAddr),
        vendorPhone: str(doc.vendorPhone),
        items: Array.isArray(doc.items) ? doc.items : [],
        totalAmount: Number(doc.totalAmount) || 0,
        note: str(doc.note),
        createdBy: str(doc.createdBy)
    };
}

function toPdfOrder(doc) {
    if (!doc) return null;
    return {
        id: doc.id,
        createdAt: doc.issueDate || doc.createdAt,
        vendorCompany: doc.vendorCompany,
        vendorCeo: doc.vendorCeo,
        vendorAddr: doc.vendorAddr,
        vendorPhone: doc.vendorPhone,
        vendorRegisteredBy: doc.issuerStaffLoginId,
        totalAmount: doc.totalAmount,
        items: doc.items,
        note: doc.note
    };
}

function listFilter(auth) {
    if (supervisorCanAccessAllOrders(auth)) return {};
    return { createdBy: trimStaffLoginId(auth.userId) };
}

function canAccessDoc(auth, doc) {
    if (!doc) return false;
    if (supervisorCanAccessAllOrders(auth)) return true;
    return staffLoginIdsEqual(doc.createdBy, auth.userId);
}

async function assertOrderManageAccess(auth) {
    if (!auth) throw new Error("권한이 없습니다.");
    if (auth.role === "supervisor") return;
    if (auth.role === "admin" && (await staffCanAccessOrderManage(auth))) return;
    throw new Error("주문서 관리 권한이 있는 관리자·슈퍼바이저만 이용할 수 있습니다.");
}

function validateBuilt(built) {
    if (!str(built.vendorCompany)) return "거래처(업체명)를 입력해 주세요.";
    if (!str(built.issuerStaffLoginId)) return "공급자(발행 관리자)를 선택해 주세요.";
    if (!built.items.length) return "품목을 1개 이상 입력해 주세요.";
    return "";
}

async function buildPdfFromDoc(db, doc) {
    const pdfOrder = await prepareManualTransactionForPdf(db, toPdfOrder(doc));
    return buildTransactionPdfBuffer(pdfOrder);
}

async function ensureIndexes(db) {
    const col = db.collection(COL);
    await col.createIndex({ id: 1 }, { unique: true });
    await col.createIndex({ createdBy: 1, updatedAt: -1 });
}

module.exports = {
    COL,
    newId,
    buildFromBody,
    toPublic,
    toPdfOrder,
    listFilter,
    canAccessDoc,
    assertOrderManageAccess,
    validateBuilt,
    buildPdfFromDoc,
    ensureIndexes,
    parseIssueDate
};
