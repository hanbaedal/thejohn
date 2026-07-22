/**
 * e하늘 장례식장 ↔ 사업부문 업체(vendors) 매칭
 *
 * 정책: 장례식장 이름이 완전히 같을 때만 동일 시설로 본다.
 *       (공백·괄호·기호 차이만 정규화 후 비교)
 *       이름 일부만 겹치면 다른 장례식장 — 매칭하지 않음.
 *       fhi_id 가 저장돼 있으면 ID 우선. 전화번호는 사용하지 않음.
 */

const { fromLegacyDoc, F } = require("./vendorFields");

function normText(v) {
    return String(v || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

/** 비교용 업체명 — 공백·괄호·기호만 정규화 (이름 전체가 같아야 함) */
function compactCompanyKey(name) {
    return normText(name)
        .replace(/[\(\（][^\)\）]*[\)\）]/g, " ")
        .replace(/\s+/g, "")
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

/** 이름 완전 일치 여부 (부분 포함·유사명 제외) */
function namesMatchExactly(vendor, fhiRow) {
    const vName = pickCompany(vendor);
    const fName = pickCompany(fhiRow);
    if (!vName || !fName) return false;

    const vNorm = normText(vName).replace(/\s+/g, "");
    const fNorm = normText(fName).replace(/\s+/g, "");
    if (vNorm && fNorm && vNorm === fNorm) return true;

    const vCompact = compactCompanyKey(vName);
    const fCompact = compactCompanyKey(fName);
    return !!(vCompact && fCompact && vCompact === fCompact);
}

/** 0=없음, 3=완전일치 */
function nameMatchLevel(vendor, fhiRow) {
    return namesMatchExactly(vendor, fhiRow) ? 3 : 0;
}

function addrMatches(vendor, fhiRow) {
    const a = normText(pickAddr(vendor)).replace(/\s+/g, "");
    const b = normText(pickAddr(fhiRow)).replace(/\s+/g, "");
    if (!a || !b || a.length < 4 || b.length < 4) return false;
    return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}

/** 이름 완전 일치 시에만 점수 (주소는 동명 후보 tie-break 용) */
function scoreFhiMatch(vendor, fhiRow) {
    if (!namesMatchExactly(vendor, fhiRow)) return 0;
    let score = 30;
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
    return docs
        .map(function (doc) {
            const v = normalizeVendorForMatch(doc);
            v.kind = "partner";
            return v;
        })
        .filter(function (v) {
            return v && v.id && pickCompany(v);
        });
}

async function loadNewVendors(db) {
    const docs = await db.collection("vendor_new").find({}).toArray();
    return docs
        .map(function (doc) {
            const v = normalizeVendorForMatch(doc);
            v.kind = "new";
            return v;
        })
        .filter(function (v) {
            return v && v.id && pickCompany(v);
        });
}

async function loadProspectVendors(db) {
    const docs = await db.collection("vendor_prospects").find({}).toArray();
    return docs
        .map(function (doc) {
            const v = normalizeVendorForMatch(doc);
            v.kind = "prospect";
            return v;
        })
        .filter(function (v) {
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
            if (namesMatchExactly(vendor, row)) {
                return Object.assign({}, row, { score: 100 });
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

function buildRegisteredVendorMeta(vendor, score) {
    const kind = String((vendor && vendor.kind) || "partner").trim();
    return {
        id: vendor.id,
        kind: kind === "new" || kind === "prospect" ? kind : "partner",
        vn_company: vendor.vn_company || "",
        vn_depts: Array.isArray(vendor.vn_depts) ? vendor.vn_depts : [],
        has_logo: hasVendorLogo(vendor),
        match_score: score
    };
}

function annotateFhiItems(items, vendorsOrOptions) {
    if (!Array.isArray(items) || !items.length) return items || [];
    const options = Array.isArray(vendorsOrOptions)
        ? { partners: vendorsOrOptions }
        : vendorsOrOptions || {};
    const partners = options.partners || [];
    const newVendors = options.newVendors || [];
    const prospects = options.prospects || [];
    const partnerIndex = buildVendorMatchIndex(partners);
    const newIndex = buildVendorMatchIndex(newVendors);
    const prospectIndex = buildVendorMatchIndex(prospects);

    return items.map(function (row) {
        const partnerMatch = matchFhiRowToVendor(row, partnerIndex);
        if (partnerMatch) {
            return Object.assign({}, row, {
                registered_vendor: buildRegisteredVendorMeta(
                    Object.assign({}, partnerMatch.vendor, { kind: "partner" }),
                    partnerMatch.score
                )
            });
        }
        const newMatch = matchFhiRowToVendor(row, newIndex);
        if (newMatch) {
            return Object.assign({}, row, {
                registered_vendor: buildRegisteredVendorMeta(
                    Object.assign({}, newMatch.vendor, { kind: "new" }),
                    newMatch.score
                )
            });
        }
        const prospectMatch = matchFhiRowToVendor(row, prospectIndex);
        if (prospectMatch) {
            return Object.assign({}, row, {
                registered_vendor: buildRegisteredVendorMeta(
                    Object.assign({}, prospectMatch.vendor, { kind: "prospect" }),
                    prospectMatch.score
                )
            });
        }
        return row;
    });
}

function countRegistrationKinds(items) {
    const counts = { partner: 0, new: 0, prospect: 0 };
    (items || []).forEach(function (row) {
        const kind = row && row.registered_vendor && row.registered_vendor.kind;
        if (kind && counts[kind] != null) counts[kind]++;
    });
    return counts;
}

module.exports = {
    normText,
    compactCompanyKey,
    normalizeVendorForMatch,
    nameMatchLevel,
    namesMatchExactly,
    addrMatches,
    scoreFhiMatch,
    hasVendorLogo,
    loadPartnerVendors,
    loadNewVendors,
    loadProspectVendors,
    buildVendorMatchIndex,
    matchFhiRowToVendor,
    findBestFhiMatch,
    annotateFhiItems,
    countRegistrationKinds
};
