const { loginLookupFilter } = require("./loginAccount");

const F_COMPANY_NORM = "vn_company_norm";

function normalizeCompanyKey(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function applyCompanyNormToDoc(doc, companyName) {
    if (!doc) return doc;
    const norm = normalizeCompanyKey(companyName != null ? companyName : doc.vn_company);
    if (norm) doc[F_COMPANY_NORM] = norm;
    return doc;
}

async function findVendorByLoginId(db, loginId, excludeId) {
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return db.collection("vendors").findOne(filter);
}

async function findLoginInCollection(db, collectionName, loginId, excludeId) {
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return db.collection(collectionName).findOne(filter);
}

async function findDuplicateCompanyInCollection(db, collectionName, companyName, excludeId) {
    const norm = normalizeCompanyKey(companyName);
    if (!norm) return null;
    const col = db.collection(collectionName);
    const idClause = excludeId ? { id: { $ne: excludeId } } : {};

    let doc = await col.findOne(Object.assign({ vn_company_norm: norm }, idClause));
    if (doc) return doc;

    const trimmed = String(companyName || "").trim();
    if (trimmed) {
        doc = await col.findOne(Object.assign({ vn_company: trimmed }, idClause));
        if (doc) return doc;
    }

    const legacy = await col
        .find(
            Object.assign(
                {
                    vn_company: { $exists: true, $nin: ["", null] },
                    $or: [{ vn_company_norm: { $exists: false } }, { vn_company_norm: "" }]
                },
                idClause
            )
        )
        .limit(3000)
        .toArray();
    for (let i = 0; i < legacy.length; i++) {
        if (normalizeCompanyKey(legacy[i].vn_company) === norm) return legacy[i];
    }
    return null;
}

/** 로그인 아이디 — vendors · vendor_new · vendor_prospects */
async function findAnyVendorLoginConflict(db, loginId, exclude) {
    const ex = exclude || {};
    const dupVendor = await findVendorByLoginId(db, loginId, ex.vendorId);
    if (dupVendor) return { dup: dupVendor, where: "기존 업체" };
    const dupNew = await findLoginInCollection(db, "vendor_new", loginId, ex.newId);
    if (dupNew) return { dup: dupNew, where: "신규업체" };
    const dupProspect = await findLoginInCollection(db, "vendor_prospects", loginId, ex.prospectId);
    if (dupProspect) return { dup: dupProspect, where: "예비거래처" };
    return null;
}

function collectionNameForVendorDoc(vendor) {
    const id = String((vendor && vendor.id) || "");
    if (id.indexOf("vnew_") === 0) return "vendor_new";
    if (id.indexOf("vp_") === 0) return "vendor_prospects";
    return "vendors";
}

module.exports = {
    F_COMPANY_NORM,
    normalizeCompanyKey,
    applyCompanyNormToDoc,
    findVendorByLoginId,
    findLoginInCollection,
    findDuplicateCompanyInCollection,
    findAnyVendorLoginConflict,
    collectionNameForVendorDoc
};
