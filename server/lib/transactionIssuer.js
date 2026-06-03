const { fromLegacyDoc: staffFromLegacy, F: SF } = require("./staffFields");
const { formatFullAddress } = require("./addressFormat");
const { findStaffByRegisteredBy } = require("./staffRegisteredBy");
const { trimStaffLoginId } = require("./staffLoginId");
const { resolveSealForPdf } = require("./staffSealImage");

const DOUZONE_LOGIN_IDS = ["thejohn", "thejhon"];
const AK_LOGIN_IDS = ["ak20140516"];

function str(v) {
    return String(v ?? "").trim();
}

function normalizeCompanyKey(company) {
    return str(company)
        .replace(/\s+/g, "")
        .replace(/\(주\)/gi, "")
        .toLowerCase();
}

function staffCompany(staff) {
    if (!staff) return "";
    const d = staffFromLegacy(staff) || {};
    return str(d[SF.company] || staff.st_company);
}

function matchesAkSangsaStaff(staff) {
    if (!staff) return false;
    const loginKey = str(staff.loginId).toLowerCase();
    if (AK_LOGIN_IDS.indexOf(loginKey) >= 0) return true;
    if (staff.id && String(staff.id).toLowerCase().indexOf("aksangsa") >= 0) return true;
    const c = normalizeCompanyKey(staffCompany(staff));
    if (!c) return false;
    return c.indexOf("에이케이") >= 0 || c.indexOf("에이메이") >= 0;
}

function matchesDouzoneStaff(staff) {
    if (!staff) return false;
    const loginKey = str(staff.loginId).toLowerCase();
    if (DOUZONE_LOGIN_IDS.indexOf(loginKey) >= 0) return true;
    const c = normalizeCompanyKey(staffCompany(staff));
    return c.indexOf("더존") >= 0;
}

function staffSealDataUrl(staff) {
    if (!staff) return "";
    const d = staffFromLegacy(staff) || {};
    const raw = str(d[SF.seal] || staff.st_seal);
    if (/^data:image\/[a-z0-9+.-]+;base64,/i.test(raw)) return raw;
    return "";
}

function formatBizNo(raw) {
    var d = str(raw).replace(/\D/g, "");
    if (d.length === 10) {
        return d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5);
    }
    return str(raw);
}

function bankAccountForStaff(staff) {
    if (matchesAkSangsaStaff(staff)) {
        return str(process.env.AK_BANK_ACCOUNT || process.env.AEK_BANK_ACCOUNT || "");
    }
    if (matchesDouzoneStaff(staff)) {
        return str(process.env.DOUZONE_BANK_ACCOUNT || "");
    }
    return "";
}

function staffToIssuer(staff) {
    if (!staff) return null;
    var d = staffFromLegacy(staff) || {};
    return {
        templateId: "douzone",
        loginId: str(staff.loginId),
        company: staffCompany(staff),
        bizNo: formatBizNo(d[SF.bizNo] || staff.st_biz_no),
        ceo: str(d[SF.ceo] || staff.st_ceo),
        phone: str(d[SF.phone] || staff.st_phone),
        fax: str(d[SF.fax] || staff.st_fax),
        bizType: str(d[SF.bizType] || staff.st_biz_type),
        bizItem: str(d[SF.bizItem] || staff.st_biz_item),
        address:
            formatFullAddress(d[SF.zip], d[SF.addr], d[SF.addrDetail]) ||
            str(d[SF.address] || staff.st_address),
        sealDataUrl: staffSealDataUrl(staff),
        sealImage: resolveSealForPdf(staff, staffSealDataUrl(staff)),
        bankAccount: bankAccountForStaff(staff)
    };
}

async function resolveIssuerFromStaffLoginId(db, loginId) {
    const reg = trimStaffLoginId(loginId);
    if (!reg) return null;
    const staff = await findStaffByRegisteredBy(reg);
    if (!staff) return null;
    const issuer = staffToIssuer(staff);
    return issuer && issuer.company ? issuer : null;
}

function dominantProductRegistrar(order) {
    const items = Array.isArray(order && order.items) ? order.items : [];
    const seen = {};
    let chosen = "";
    for (let i = 0; i < items.length; i++) {
        const reg = trimStaffLoginId(items[i].productRegisteredBy);
        if (!reg) continue;
        if (!seen[reg]) seen[reg] = 0;
        seen[reg]++;
        if (!chosen || seen[reg] > seen[chosen]) chosen = reg;
    }
    const keys = Object.keys(seen);
    if (keys.length === 1) return keys[0];
    return chosen;
}

/**
 * 거래명세서 공급자 — 주문 업체 담당 관리자(staff) 기준. 없으면 상품 담당자, 최종 더존 폴백
 */
async function resolveIssuerForOrder(db, order) {
    const supplierLogin =
        str(order && order.vendorRegisteredBy) ||
        str(order && order.supplier && order.supplier.loginId);
    if (supplierLogin) {
        const fromVendor = await resolveIssuerFromStaffLoginId(db, supplierLogin);
        if (fromVendor) return fromVendor;
    }
    const productReg = dominantProductRegistrar(order);
    if (productReg && productReg !== supplierLogin) {
        const fromProduct = await resolveIssuerFromStaffLoginId(db, productReg);
        if (fromProduct) return fromProduct;
    }
    return resolveDouzoneIssuer(db);
}

/**
 * 더존 거래명세서 공급자 — staff 컬렉션 (주)더존 관리자 계정 (폴백)
 */
async function resolveDouzoneIssuer(db) {
    const col = db.collection("staff");
    for (let i = 0; i < DOUZONE_LOGIN_IDS.length; i++) {
        const staff = await col.findOne({
            loginId: DOUZONE_LOGIN_IDS[i],
            active: { $ne: false }
        });
        if (staff) {
            const issuer = staffToIssuer(staff);
            if (issuer && issuer.company) return issuer;
        }
    }
    const byName = await col.findOne({
        st_company: /더존/,
        role: { $in: ["admin", "supervisor"] },
        active: { $ne: false }
    });
    if (byName) return staffToIssuer(byName);
    return {
        templateId: "douzone",
        loginId: "",
        company: "더존푸드",
        bizNo: "",
        ceo: "",
        phone: "",
        fax: "",
        bizType: "",
        bizItem: "",
        address: "",
        sealDataUrl: "",
        sealImage: null,
        bankAccount: str(process.env.DOUZONE_BANK_ACCOUNT || "")
    };
}

module.exports = {
    resolveDouzoneIssuer,
    resolveIssuerForOrder,
    resolveIssuerFromStaffLoginId,
    staffToIssuer,
    matchesAkSangsaStaff,
    formatBizNo
};
