/** 회사소개 이미지 — MongoDB 배열에서 한 장씩 JPEG로 제공 (JSON/base64 일괄 전송 방지) */
const { getDb, isDbReady } = require("../db");
const { extractBearer, verifyToken } = require("../middleware/auth");
const { findVendorByLoginId } = require("./loginResolve");
const { loginLookupFilter } = require("./loginAccount");
const { companyIntroJpegBufferFromDataUrl } = require("./image540");
const { MAX_COMPANY_INTRO_IMAGES } = require("./companyIntro");

const introBufCache = new Map();
const INTRO_BUF_CACHE_MAX = 200;

function normalizeFooterStaffLoginId(loginIdRaw) {
    return String(loginIdRaw || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "");
}

function optionalAuthFromRequest(req) {
    const q = req.query || {};
    const token =
        extractBearer(req) || String(q.access || q.token || "").trim();
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

function introCacheKey(staffId, index) {
    return String(staffId || "").trim() + ":" + String(index);
}

function rememberIntroBuf(staffId, index, buf) {
    const key = introCacheKey(staffId, index);
    if (introBufCache.has(key)) introBufCache.delete(key);
    introBufCache.set(key, buf);
    while (introBufCache.size > INTRO_BUF_CACHE_MAX) {
        const first = introBufCache.keys().next().value;
        introBufCache.delete(first);
    }
}

function parseIntroIndexParam(raw) {
    const s = String(raw || "").replace(/\.jpg$/i, "").trim();
    let idx = parseInt(s, 10);
    if (!isFinite(idx) || idx < 0) idx = 0;
    if (idx >= MAX_COMPANY_INTRO_IMAGES) idx = MAX_COMPANY_INTRO_IMAGES - 1;
    return idx;
}

async function resolveCompanyIntroStaffLoginId(req) {
    const auth = optionalAuthFromRequest(req);
    const footer = normalizeFooterStaffLoginId(
        process.env.DEFAULT_FOOTER_STAFF_ID || "thejohn"
    );
    if (!auth) return footer;
    const role = String(auth.role || "").trim();
    if (role === "admin" || role === "supervisor") {
        return String(auth.userId || "").trim() || footer;
    }
    if (role === "vendor") {
        const vendor = await findVendorByLoginId(auth.userId || "");
        const reg = vendor
            ? String(vendor.vn_registered_by || vendor.registeredBy || "").trim()
            : "";
        return reg || footer;
    }
    return footer;
}

async function findStaffIdByLoginKey(staffLoginId) {
    const key = String(staffLoginId || "").trim();
    if (!key) return "";
    const col = getDb().collection("staff");
    const active = { active: { $ne: false } };
    const projection = { id: 1 };
    let doc = await col.findOne({ id: key, ...active }, { projection: projection });
    if (!doc) doc = await col.findOne({ loginId: key, ...active }, { projection: projection });
    if (!doc) {
        const lf = loginLookupFilter(key);
        doc = await col.findOne({ ...active, ...lf }, { projection: projection });
    }
    return doc && doc.id ? String(doc.id) : key;
}

async function loadCompanyIntroImageDataUrl(staffLoginId, index) {
    const key = String(staffLoginId || "").trim();
    if (!key) return null;
    const col = getDb().collection("staff");
    const active = { active: { $ne: false } };
    const projection = { st_company_intro_images: { $slice: [index, 1] }, id: 1 };
    let doc = await col.findOne({ id: key, ...active }, { projection: projection });
    if (!doc) doc = await col.findOne({ loginId: key, ...active }, { projection: projection });
    if (!doc) {
        const lf = loginLookupFilter(key);
        doc = await col.findOne({ ...active, ...lf }, { projection: projection });
    }
    if (!doc || !Array.isArray(doc.st_company_intro_images)) return null;
    const dataUrl = String(doc.st_company_intro_images[0] || "").trim();
    return dataUrl || null;
}

async function serveCompanyIntroJpeg(req, res) {
    if (!isDbReady()) {
        return res.status(503).end();
    }
    const imgIdx = parseIntroIndexParam(req.params.index);
    const staffLoginId = await resolveCompanyIntroStaffLoginId(req);
    if (!staffLoginId) {
        return res.status(404).end();
    }

    const staffId = await findStaffIdByLoginKey(staffLoginId);
    const cacheKey = introCacheKey(staffId, imgIdx);
    const cached = introBufCache.get(cacheKey);
    if (cached) {
        res.set("Cache-Control", "public, max-age=604800, immutable");
        return res.type("image/jpeg").send(cached);
    }

    const dataUrl = await loadCompanyIntroImageDataUrl(staffLoginId, imgIdx);
    if (!dataUrl) {
        return res.status(404).end();
    }
    const buf = await companyIntroJpegBufferFromDataUrl(dataUrl);
    if (!buf) {
        return res.status(404).end();
    }
    rememberIntroBuf(staffId, imgIdx, buf);
    res.set("Cache-Control", "public, max-age=604800, immutable");
    return res.type("image/jpeg").send(buf);
}

module.exports = {
    serveCompanyIntroJpeg,
    resolveCompanyIntroStaffLoginId,
    parseIntroIndexParam
};
