const { getDb } = require("../db");
const { loginLookupFilter } = require("./loginAccount");
const { F: VF } = require("./vendorFields");
const { trimStaffLoginId, registeredByInFilter, staffLoginIdsEqual } = require("./staffLoginId");

/** vendors — 동일 loginId · 다른 vn_registered_by 허용 (관리자별 등급) */
async function findAllVendorsByLoginId(loginId) {
    const filter = loginLookupFilter(loginId);
    if (!filter) return [];
    return getDb()
        .collection("vendors")
        .find(filter)
        .sort({ updatedAt: -1 })
        .toArray();
}

async function findVendorByLoginAndRegistrar(loginId, registeredBy) {
    const filter = loginLookupFilter(loginId);
    const reg = trimStaffLoginId(registeredBy);
    if (!filter || !reg) return null;
    return getDb()
        .collection("vendors")
        .findOne({
            $and: [filter, { [VF.registeredBy]: registeredByInFilter(reg) }]
        });
}

async function vendorHasAnyRegistration(loginId) {
    const docs = await findAllVendorsByLoginId(loginId);
    return docs.length > 0;
}

function vendorProfilesFromDocs(docs) {
    return (docs || []).map(function (doc) {
        return {
            id: doc.id,
            loginId: doc.loginId,
            registeredBy: String(doc[VF.registeredBy] || doc.vn_registered_by || "").trim(),
            registeredByName: String(doc[VF.registeredByName] || doc.vn_registered_by_name || "").trim(),
            grade: String(doc[VF.grade] || doc.vn_grade || "1").trim(),
            company: String(doc[VF.company] || doc.vn_company || "").trim()
        };
    });
}

module.exports = {
    findAllVendorsByLoginId,
    findVendorByLoginAndRegistrar,
    vendorHasAnyRegistration,
    vendorProfilesFromDocs,
    staffLoginIdsEqual
};
