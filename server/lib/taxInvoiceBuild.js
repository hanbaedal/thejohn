const { querySalesLedgerInquiry } = require("./salesLedgerInquiry");
const { resolveIssuerFromStaffLoginId, formatBizNo } = require("./transactionIssuer");
const { findVendorByLoginAndRegistrar } = require("./vendorLookup");
const { fromLegacyDoc: vendorFromLegacy, F: VF } = require("./vendorFields");
const { formatFullAddress } = require("./addressFormat");
const { supervisorCanAccessAllOrders } = require("./orderAccess");
const { trimStaffLoginId, registeredByInFilter } = require("./staffLoginId");

function str(v) {
    return String(v ?? "").trim();
}

async function resolveIssuerStaffLoginId(auth, query) {
    if (supervisorCanAccessAllOrders(auth)) {
        return trimStaffLoginId(query.adminStaffId);
    }
    return trimStaffLoginId(auth.userId);
}

async function findBuyerVendor(db, vendorCompany, issuerLoginId, vendorLoginId) {
    const company = str(vendorCompany);
    const issuer = trimStaffLoginId(issuerLoginId);
    if (vendorLoginId && issuer) {
        const byLogin = await findVendorByLoginAndRegistrar(vendorLoginId, issuer);
        if (byLogin) return byLogin;
    }
    if (!company) return null;
    if (issuer) {
        const match = await db.collection("vendors").findOne({
            [VF.company]: company,
            [VF.registeredBy]: registeredByInFilter(issuer)
        });
        if (match) return match;
    }
    return db.collection("vendors").findOne({ [VF.company]: company });
}

function vendorToBuyer(vendorDoc) {
    if (!vendorDoc) {
        return {
            company: "",
            bizNo: "",
            ceo: "",
            bizType: "",
            bizItem: "",
            address: "",
            phone: ""
        };
    }
    const v = vendorFromLegacy(vendorDoc) || {};
    return {
        company: str(v[VF.company]),
        bizNo: formatBizNo(v[VF.bizNo]),
        ceo: str(v[VF.ceo]),
        bizType: str(v[VF.bizType]),
        bizItem: str(v[VF.bizItem]),
        address: formatFullAddress(v[VF.zip], v[VF.addr], v[VF.addrDetail]) || str(v[VF.addr]),
        phone: str(v[VF.phone]) || str(v[VF.mgrTel])
    };
}

function aggregateItemsForTax(items) {
    const map = new Map();
    (items || []).forEach(function (row) {
        const key = str(row.productName) + "|" + String(row.unitPrice || 0);
        const line = Number(row.lineTotal) || 0;
        const qty = Number(row.quantity) || 0;
        if (!map.has(key)) {
            map.set(key, {
                productName: str(row.productName),
                unitPrice: Number(row.unitPrice) || 0,
                quantity: qty,
                lineTotal: line
            });
        } else {
            const cur = map.get(key);
            cur.quantity += qty;
            cur.lineTotal += line;
        }
    });
    return Array.from(map.values());
}

function aggregateVendorsFromItems(items) {
    const map = {};
    (items || []).forEach(function (row) {
        const name = str(row.vendorCompany);
        if (!name) return;
        if (!map[name]) {
            map[name] = {
                vendorCompany: name,
                vendorLoginId: "",
                lineCount: 0,
                totalAmount: 0
            };
        }
        map[name].lineCount += 1;
        map[name].totalAmount += Number(row.lineTotal) || 0;
        if (!map[name].vendorLoginId && row.vendorLoginId) {
            map[name].vendorLoginId = str(row.vendorLoginId);
        }
    });
    return Object.keys(map)
        .sort(function (a, b) {
            return a.localeCompare(b, "ko");
        })
        .map(function (k) {
            return map[k];
        });
}

async function listTaxInvoiceVendors(db, auth, query) {
    const issuerLoginId = await resolveIssuerStaffLoginId(auth, query || {});
    if (!issuerLoginId) {
        if (supervisorCanAccessAllOrders(auth)) {
            return { error: "슈퍼바이저는 공급 관리자를 선택해 주세요." };
        }
        return { error: "공급자(관리자) 정보를 확인할 수 없습니다." };
    }

    const inquiry = await querySalesLedgerInquiry(
        db,
        auth,
        Object.assign({}, query || {}, { mode: "date" })
    );
    if (inquiry.error) return { error: inquiry.error };

    return {
        ok: true,
        period: inquiry.period,
        vendors: aggregateVendorsFromItems(inquiry.items || [])
    };
}

async function buildTaxInvoicePayload(db, auth, query) {
    const issuerLoginId = await resolveIssuerStaffLoginId(auth, query || {});
    if (!issuerLoginId) {
        if (supervisorCanAccessAllOrders(auth)) {
            return { error: "슈퍼바이저는 공급 관리자를 선택해 주세요." };
        }
        return { error: "공급자(관리자) 정보를 확인할 수 없습니다." };
    }

    const inquiry = await querySalesLedgerInquiry(
        db,
        auth,
        Object.assign({}, query || {}, { mode: "vendor" })
    );
    if (inquiry.error) return { error: inquiry.error };

    const vendorCompany = str(query.vendorCompany);
    if (!vendorCompany) return { error: "업체를 선택해 주세요." };

    const items = aggregateItemsForTax(inquiry.items || []);
    if (!items.length) return { error: "해당 기간에 발부할 매출이 없습니다." };

    const issuer = await resolveIssuerFromStaffLoginId(db, issuerLoginId);
    if (!issuer || !issuer.company) {
        return { error: "공급자 사업자 정보를 불러오지 못했습니다." };
    }

    const buyerDoc = await findBuyerVendor(db, vendorCompany, issuerLoginId, str(query.vendorLoginId));
    const buyer = vendorToBuyer(buyerDoc);
    if (!buyer.company) buyer.company = vendorCompany;

    const totalAmount = items.reduce(function (s, it) {
        return s + (Number(it.lineTotal) || 0);
    }, 0);

    const issueDate =
        inquiry.period && inquiry.period.dateTo
            ? inquiry.period.dateTo.replace(/-/g, ".")
            : new Date().toISOString().slice(0, 10).replace(/-/g, ".");

    return {
        ok: true,
        title: "세금계산서",
        issueDate: issueDate,
        period: inquiry.period,
        issuer: issuer,
        buyer: buyer,
        items: items,
        summary: {
            count: items.length,
            totalQuantity: items.reduce(function (s, it) {
                return s + (Number(it.quantity) || 0);
            }, 0),
            totalAmount: totalAmount
        }
    };
}

module.exports = {
    buildTaxInvoicePayload,
    aggregateItemsForTax,
    listTaxInvoiceVendors
};
