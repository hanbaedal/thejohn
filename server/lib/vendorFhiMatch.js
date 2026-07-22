/**
 * funeralhallinfo 장례식장 ↔ 사업부문 업체(vendors) 매칭
 */

const MATCH_THRESHOLD = 8;

function normText(v) {
    return String(v || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function normPhone(v) {
    return String(v || "").replace(/[^\d]/g, "");
}

function companyName(vendorOrRow) {
    return normText(
        (vendorOrRow && (vendorOrRow.vn_company || vendorOrRow.companyName)) || ""
    );
}

/** FHI row ↔ vendor 점수 (이름 +5, 전화 +4, 주소 +3) */
function scoreFhiMatch(vendor, fhiRow) {
    let score = 0;
    const company = companyName(vendor);
    const fhiCompany = companyName(fhiRow);
    const phone = normPhone(vendor && vendor.vn_phone);
    const fhiPhone = normPhone(fhiRow && fhiRow.vn_phone);
    const addr = normText(vendor && vendor.vn_addr);
    const fhiAddr = normText(fhiRow && fhiRow.vn_addr);

    if (
        company &&
        fhiCompany &&
        (fhiCompany === company || fhiCompany.indexOf(company) >= 0 || company.indexOf(fhiCompany) >= 0)
    ) {
        score += 5;
    }
    if (phone && fhiPhone && phone === fhiPhone) score += 4;
    if (
        addr &&
        fhiAddr &&
        (fhiAddr.indexOf(addr) >= 0 || addr.indexOf(fhiAddr) >= 0 || fhiAddr === addr)
    ) {
        score += 3;
    }
    return score;
}

function hasVendorLogo(vendor) {
    return !!String((vendor && vendor.vn_logo) || "").trim();
}

/** 사업부문 등록 업체 목록 (신규업체 제외) */
async function loadPartnerVendors(db) {
    return db
        .collection("vendors")
        .find({ vn_record_type: { $ne: "new" } })
        .project({
            id: 1,
            vn_company: 1,
            vn_phone: 1,
            vn_addr: 1,
            vn_depts: 1,
            vn_logo: 1,
            fhi_id: 1
        })
        .toArray();
}

function matchFhiRowToVendor(fhiRow, vendors) {
    if (!fhiRow || !Array.isArray(vendors) || !vendors.length) return null;

    const fhiId = String((fhiRow.fhi_id || "")).trim();
    if (fhiId) {
        for (let i = 0; i < vendors.length; i++) {
            const v = vendors[i];
            if (String(v.fhi_id || "").trim() === fhiId) {
                return { vendor: v, score: 100 };
            }
        }
    }

    let best = null;
    let bestScore = 0;
    for (let i = 0; i < vendors.length; i++) {
        const score = scoreFhiMatch(vendors[i], fhiRow);
        if (score > bestScore) {
            bestScore = score;
            best = vendors[i];
        }
    }
    if (!best || bestScore < MATCH_THRESHOLD) return null;
    return { vendor: best, score: bestScore };
}

function findBestFhiMatch(vendor, fhiItems) {
    if (!vendor || !Array.isArray(fhiItems) || !fhiItems.length) return null;

    const storedId = String(vendor.fhi_id || "").trim();
    if (storedId) {
        for (let i = 0; i < fhiItems.length; i++) {
            if (String(fhiItems[i].fhi_id || "").trim() === storedId) {
                return Object.assign({}, fhiItems[i], { score: 100 });
            }
        }
    }

    let best = null;
    let bestScore = 0;
    for (let i = 0; i < fhiItems.length; i++) {
        const score = scoreFhiMatch(vendor, fhiItems[i]);
        if (score > bestScore) {
            bestScore = score;
            best = fhiItems[i];
        }
    }
    if (!best || bestScore < MATCH_THRESHOLD) return null;
    return Object.assign({}, best, { score: bestScore });
}

function annotateFhiItems(items, vendors) {
    if (!Array.isArray(items) || !items.length) return items || [];
    return items.map(function (row) {
        const matched = matchFhiRowToVendor(row, vendors);
        if (!matched) return row;
        const v = matched.vendor;
        return Object.assign({}, row, {
            registered_vendor: {
                id: v.id,
                vn_company: v.vn_company || "",
                vn_depts: Array.isArray(v.vn_depts) ? v.vn_depts : [],
                has_logo: hasVendorLogo(v)
            }
        });
    });
}

module.exports = {
    MATCH_THRESHOLD,
    normText,
    normPhone,
    scoreFhiMatch,
    hasVendorLogo,
    loadPartnerVendors,
    matchFhiRowToVendor,
    findBestFhiMatch,
    annotateFhiItems
};
