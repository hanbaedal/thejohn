const { fromLegacyDoc, F, getCompanyName } = require("./vendorFields");

function str(v) {
    return String(v || "").trim();
}

/** 업체 문서 → 주문 담당자 (담당자 없으면 대표·전화 fallback) */
function contactFromDoc(doc) {
    const d = fromLegacyDoc(doc) || doc || {};
    const mgrName =
        str(d[F.mgrName]) || str(d.manager) || str(d[F.ceo]) || str(d.ceo);
    const mgrTel =
        str(d[F.mgrTel]) ||
        str(d.managerPhone) ||
        str(d[F.ceoTel]) ||
        str(d.ceoPhone) ||
        str(d[F.phone]) ||
        str(d.phone);
    const mgrEmail =
        str(d[F.mgrEmail]) || str(d.mgrEmail) || str(d[F.email]) || str(d.email);
    return {
        company: getCompanyName(d),
        mgrName: mgrName,
        mgrTel: mgrTel,
        mgrEmail: mgrEmail,
        vendor: doc || null
    };
}

function contactScore(c) {
    let s = 0;
    if (c.mgrName) s += 2;
    if (c.mgrTel) s += 4;
    if (c.mgrName && c.mgrTel) s += 8;
    return s;
}

/** 동일 loginId 여러 vendor 레코드 중 주문 담당 정보가 가장 완전한 것 */
function resolveVendorOrderContact(docs) {
    const list = Array.isArray(docs) ? docs : docs ? [docs] : [];
    if (!list.length) {
        return { company: "", mgrName: "", mgrTel: "", mgrEmail: "", vendor: null };
    }
    let best = contactFromDoc(list[0]);
    let bestScore = contactScore(best);
    for (let i = 1; i < list.length; i++) {
        const c = contactFromDoc(list[i]);
        const sc = contactScore(c);
        if (sc > bestScore) {
            best = c;
            bestScore = sc;
        }
    }
    return best;
}

module.exports = {
    contactFromDoc,
    resolveVendorOrderContact
};
