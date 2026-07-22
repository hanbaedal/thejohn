/**
 * e하늘 장례식장 ↔ 사업부문 업체(vendors) 매칭
 *
 * 정책: 이름(compact) 우선 매칭. 주소는 동명·유사명일 때만 보조.
 *       전화번호는 FHI·DB 간 다를 수 있어 사용하지 않음.
 */

const { fromLegacyDoc, F } = require("./vendorFields");

function normText(v) {
    return String(v || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

/** 비교용 업체명 — 공백·괄호·장례식장 접미어 제거 */
function compactCompanyKey(name) {
    return normText(name)
        .replace(/[\(\（][^\)\）]*[\)\）]/g, " ")
        .replace(/\s+/g, "")
        .replace(/장례식장/g, "")
        .replace(/[^\uac00-\ud7a3a-z0-9]/gi, "");
}

function pickCompany(vendorOrRow) {
    if (!vendorOrRow) return "";
    return String(
        vendorOrRow.vn_company ||
            vendorOrRow.companyName ||
            (vendorOrRow[F.company] != null ? vendorOrRow[F.company] : "") ||
            ""
    ).trim();
}

function pickAddr(vendorOrRow) {
    if (!vendorOrRow) return "";
    return String(vendorOrRow.vn_addr || vendorOrRow.address || "").trim();
}

function normalizeVendorForMatch(doc) {
    const legacy = fromLegacyDoc(doc) || doc || {};
    return {
        id: legacy.id || doc.id,
        vn_company: pickCompany(legacy),
        vn_addr: pickAddr(legacy),
        vn_depts: Array.isArray(legacy[F.depts])
            ? legacy[F.depts]
            : Array.isArray(legacy.vn_depts)
              ? legacy.vn_depts
              : [],
        vn_logo: String(legacy[F.logo] || legacy.vn_logo || "").trim(),
        fhi_id: String(doc.fhi_id || legacy.fhi_id || "").trim()
    };
}

/** 0=없음, 1=유사, 2=포함, 3=compact 완전일치 */
function nameMatchLevel(vendor, fhiRow) {
    const vCompact = compactCompanyKey(pickCompany(vendor));
    const fCompact = compactCompanyKey(pickCompany(fhiRow));
    if (vCompact && fCompact) {
        if (vCompact === fCompact) return 3;
        if (vCompact.length >= 3 && fCompact.length >= 3) {
            if (vCompact.indexOf(fCompact) >= 0 || fCompact.indexOf(vCompact) >= 0) return 2;
        }
    }
    const vNorm = normText(pickCompany(vendor));
    const fNorm = normText(pickCompany(fhiRow));
    if (vNorm && fNorm) {
        if (vNorm === fNorm) return 3;
        if (vNorm.indexOf(fNorm) >= 0 || fNorm.indexOf(vNorm) >= 0) return 2;
    }
    return 0;
}

function addrMatches(vendor, fhiRow) {
    const a = normText(pickAddr(vendor)).replace(/\s+/g, "");
    const b = normText(pickAddr(fhiRow)).replace(/\s+/g, "");
    if (!a || !b || a.length < 4 || b.length < 4) return false;
    return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/** 이름·주소만 사용 (전화번호 제외) */
function scoreFhiMatch(vendor, fhiRow) {
    const level = nameMatchLevel(vendor, fhiRow);
    if (!level) return 0;
    let score = level * 10;
    if (addrMatches(vendor, fhiRow)) score += 5;
    return score;
}

function hasVendorLogo(vendor) {
    return !!String((vendor && vendor.vn_logo) || "").trim();
}

async function loadPartnerVendors(db) {
    const docs = await db
        .collection("vendors")
        .find({ vn_record_type: { $ne: "new" } })
        .toArray();
    return docs.map(normalizeVendorForMatch).filter(function (v) {
        return v && v.id && pickCompany(v);
    });
}

function buildVendorMatchIndex(vendors) {
    const byFhiId = Object.create(null);
    const byCompact = Object.create(null);
    (vendors || []).forEach(function (v) {
        const fid = String(v.fhi_id || "").trim();
        if (fid) byFhiId[fid] = v;
        const ck = compactCompanyKey(v.vn_company);
        if (ck.length >= 2) {
            if (!byCompact[ck]) byCompact[ck] = [];
            byCompact[ck].push(v);
        }
    });
    return { byFhiId: byFhiId, byCompact: byCompact, list: vendors || [] };
}

function pickFromCandidates(candidates, fhiRow) {
    if (!candidates || !candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const addrHits = candidates.filter(function (v) {
        return addrMatches(v, fhiRow);
    });
    if (addrHits.length >= 1) return addrHits[0];
    return candidates[0];
}

function matchByCompactName(fhiRow, index) {
    const fhiCompact = compactCompanyKey(pickCompany(fhiRow));
    if (fhiCompact.length < 2) return null;

    if (index.byCompact[fhiCompact]) {
        const vendor = pickFromCandidates(index.byCompact[fhiCompact], fhiRow);
        if (vendor) return { vendor: vendor, score: 100 };
    }

    if (fhiCompact.length >= 3) {
        const keys = Object.keys(index.byCompact);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key.length < 3) continue;
            if (fhiCompact === key || fhiCompact.indexOf(key) >= 0 || key.indexOf(fhiCompact) >= 0) {
                const vendor = pickFromCandidates(index.byCompact[key], fhiRow);
                if (vendor) return { vendor: vendor, score: 90 };
            }
        }
    }
    return null;
}

function matchFhiRowToVendor(fhiRow, vendorsOrIndex) {
    const index = Array.isArray(vendorsOrIndex)
        ? buildVendorMatchIndex(vendorsOrIndex)
        : vendorsOrIndex || buildVendorMatchIndex([]);
    if (!fhiRow || !index.list.length) return null;

    const fhiId = String(fhiRow.fhi_id || "").trim();
    if (fhiId && index.byFhiId[fhiId]) {
        return { vendor: index.byFhiId[fhiId], score: 100 };
    }

    const compactHit = matchByCompactName(fhiRow, index);
    if (compactHit) return compactHit;

    let best = null;
    let bestScore = 0;
    for (let i = 0; i < index.list.length; i++) {
        const score = scoreFhiMatch(index.list[i], fhiRow);
        if (score > bestScore) {
            bestScore = score;
            best = index.list[i];
        }
    }
    if (!best || bestScore < 20) return null;
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

    const vendorCompact = compactCompanyKey(vendor.vn_company);
    if (vendorCompact.length >= 2) {
        for (let i = 0; i < fhiItems.length; i++) {
            const row = fhiItems[i];
            const level = nameMatchLevel(vendor, row);
            if (level >= 2) {
                return Object.assign({}, row, { score: level >= 3 ? 100 : 90 });
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
    if (!best || bestScore < 20) return null;
    return Object.assign({}, best, { score: bestScore });
}

function annotateFhiItems(items, vendors) {
    if (!Array.isArray(items) || !items.length) return items || [];
    const index = buildVendorMatchIndex(vendors);
    return items.map(function (row) {
        const matched = matchFhiRowToVendor(row, index);
        if (!matched) return row;
        const v = matched.vendor;
        return Object.assign({}, row, {
            registered_vendor: {
                id: v.id,
                vn_company: v.vn_company || "",
                vn_depts: Array.isArray(v.vn_depts) ? v.vn_depts : [],
                has_logo: hasVendorLogo(v),
                match_score: matched.score
            }
        });
    });
}

module.exports = {
    normText,
    compactCompanyKey,
    normalizeVendorForMatch,
    nameMatchLevel,
    addrMatches,
    scoreFhiMatch,
    hasVendorLogo,
    loadPartnerVendors,
    buildVendorMatchIndex,
    matchFhiRowToVendor,
    findBestFhiMatch,
    annotateFhiItems
};
