/**
 * e하늘 시설 사진 → 업체 vn_logo
 */

const { fetchEskyImageBuffer } = require("./funeralHallInfoLookup");
const { F, finalizeVendorBuilt } = require("./vendorFields");

async function fetchFhiLogoDataUrl(fhiId, fileurl) {
    const id = String(fhiId || "").trim();
    if (!/^\d+$/.test(id)) {
        throw new Error("INVALID_FHI_ID");
    }
    const img = await fetchEskyImageBuffer(id, fileurl);
    const mime = img.type || "image/webp";
    return "data:" + mime + ";base64," + img.buf.toString("base64");
}

async function applyFhiLogoToBuilt(built, fhiId, fileurl) {
    if (!built) return built;
    const logo = await fetchFhiLogoDataUrl(fhiId, fileurl);
    built.vn_logo = logo;
    await finalizeVendorBuilt(built);
    return built;
}

async function applyFhiMediaToDoc(doc, row) {
    const fhiId = String((row && row.fhi_id) || row.facilitycd || "").trim();
    if (!/^\d+$/.test(fhiId)) return doc;
    doc.fhi_id = fhiId;
    const pubType = String((row && row.vn_public_type) || "").trim();
    if (pubType) doc.vn_public_type = pubType;
    const fileurl = String((row && row.fileurl) || "").trim();
    try {
        doc[F.logo] = await fetchFhiLogoDataUrl(fhiId, fileurl);
    } catch (e) {
        console.warn("[vendor_fhi_media] image skip:", fhiId, e && e.message);
    }
    return doc;
}

module.exports = {
    fetchFhiLogoDataUrl,
    applyFhiLogoToBuilt,
    applyFhiMediaToDoc
};
