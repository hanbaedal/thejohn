/**
 * funeralhallinfo 이미지 → 업체 vn_logo
 */

const { fetchFhiImageBuffer } = require("./funeralHallInfoLookup");
const { F, finalizeVendorBuilt } = require("./vendorFields");

async function fetchFhiLogoDataUrl(fhiId) {
    const id = String(fhiId || "").trim();
    if (!/^\d+$/.test(id)) {
        throw new Error("INVALID_FHI_ID");
    }
    const img = await fetchFhiImageBuffer(id);
    const mime = img.type || "image/webp";
    return "data:" + mime + ";base64," + img.buf.toString("base64");
}

async function applyFhiLogoToBuilt(built, fhiId) {
    if (!built) return built;
    const logo = await fetchFhiLogoDataUrl(fhiId);
    built.vn_logo = logo;
    await finalizeVendorBuilt(built);
    return built;
}

async function applyFhiMediaToDoc(doc, row) {
    const fhiId = String((row && row.fhi_id) || "").trim();
    if (!/^\d+$/.test(fhiId)) return doc;
    doc.fhi_id = fhiId;
    const pubType = String((row && row.vn_public_type) || "").trim();
    if (pubType) doc.vn_public_type = pubType;
    try {
        doc[F.logo] = await fetchFhiLogoDataUrl(fhiId);
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
