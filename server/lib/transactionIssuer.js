const path = require("path");
const { fromLegacyDoc: staffFromLegacy, F: SF } = require("./staffFields");
const { formatFullAddress } = require("./addressFormat");

/** 거래명세서 공급자 인감 (더존푸드) */
const DOUZONE_SEAL_PATH = path.join(__dirname, "..", "assets", "douzone-seal.png");
const DOUZONE_LOGIN_IDS = ["thejohn"];

function str(v) {
    return String(v ?? "").trim();
}

function formatBizNo(raw) {
    var d = str(raw).replace(/\D/g, "");
    if (d.length === 10) {
        return d.slice(0, 3) + "-" + d.slice(3, 5) + "-" + d.slice(5);
    }
    return str(raw);
}

function staffToIssuer(staff) {
    if (!staff) return null;
    var d = staffFromLegacy(staff) || {};
    return {
        templateId: "douzone",
        loginId: str(staff.loginId),
        company: str(d[SF.company] || staff.st_company),
        bizNo: formatBizNo(d[SF.bizNo] || staff.st_biz_no),
        ceo: str(d[SF.ceo] || staff.st_ceo),
        phone: str(d[SF.phone] || staff.st_phone),
        fax: str(d[SF.fax] || staff.st_fax),
        bizType: str(d[SF.bizType] || staff.st_biz_type),
        bizItem: str(d[SF.bizItem] || staff.st_biz_item),
        address:
            formatFullAddress(d[SF.zip], d[SF.addr], d[SF.addrDetail]) ||
            str(d[SF.address] || staff.st_address),
        sealPath: DOUZONE_SEAL_PATH,
        bankAccount: str(process.env.DOUZONE_BANK_ACCOUNT || "")
    };
}

/**
 * 더존 거래명세서 공급자 — staff 컬렉션 (주)더존 관리자 계정
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
        sealPath: DOUZONE_SEAL_PATH,
        bankAccount: str(process.env.DOUZONE_BANK_ACCOUNT || "")
    };
}

module.exports = {
    DOUZONE_SEAL_PATH,
    resolveDouzoneIssuer,
    staffToIssuer,
    formatBizNo
};
