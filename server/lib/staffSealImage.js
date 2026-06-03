const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SEAL_DIR_IMG = path.join(PROJECT_ROOT, "img", "seals");
const SEAL_DIR_ASSETS = path.join(__dirname, "../assets");

const DOUZONE_LOGIN_IDS = ["thejohn", "thejhon"];
const AK_LOGIN_IDS = ["ak20140516"];

function str(v) {
    return String(v ?? "").trim();
}

function normalizeCompanyKey(company) {
    return str(company)
        .replace(/\s+/g, "")
        .replace(/\(주\)/gi, "")
        .toLowerCase();
}

function staffCompany(staff) {
    if (!staff) return "";
    return str(staff.st_company || staff.companyName);
}

function matchesAkSangsaStaff(staff) {
    if (!staff) return false;
    const loginKey = str(staff.loginId).toLowerCase();
    if (AK_LOGIN_IDS.indexOf(loginKey) >= 0) return true;
    if (staff.id && String(staff.id).toLowerCase().indexOf("aksangsa") >= 0) return true;
    const c = normalizeCompanyKey(staffCompany(staff));
    return c.indexOf("에이케이") >= 0 || c.indexOf("에이메이") >= 0;
}

function matchesDouzoneStaff(staff) {
    if (!staff) return false;
    const loginKey = str(staff.loginId).toLowerCase();
    if (DOUZONE_LOGIN_IDS.indexOf(loginKey) >= 0) return true;
    return normalizeCompanyKey(staffCompany(staff)).indexOf("더존") >= 0;
}

function sealNameCandidates(staff) {
    const seen = new Set();
    const out = [];
    function add(name) {
        const n = str(name).toLowerCase();
        if (!n || seen.has(n)) return;
        seen.add(n);
        out.push(n);
    }
    add(staff && staff.loginId);
    add(staff && staff.id);
    if (matchesDouzoneStaff(staff)) {
        add("douzone-seal");
        add("thejohn");
        add("thejhon");
    }
    if (matchesAkSangsaStaff(staff)) {
        add("ak-seal");
        add("ak20140516");
    }
    return out;
}

function findSealPngFile(staff) {
    const names = sealNameCandidates(staff);
    const dirs = [SEAL_DIR_IMG, SEAL_DIR_ASSETS];
    for (let d = 0; d < dirs.length; d++) {
        const dir = dirs[d];
        if (!fs.existsSync(dir)) continue;
        for (let i = 0; i < names.length; i++) {
            const filePath = path.join(dir, names[i] + ".png");
            if (fs.existsSync(filePath)) return filePath;
        }
    }
    return null;
}

function parseDataUrl(raw) {
    const m = String(raw || "").match(/^data:image\/([a-z0-9+.-]+);base64,(.+)$/i);
    if (!m || !m[2]) return null;
    return {
        mime: m[1].toLowerCase(),
        buffer: Buffer.from(m[2], "base64")
    };
}

function pngDataUrlFromFile(filePath) {
    const buf = fs.readFileSync(filePath);
    return "data:image/png;base64," + buf.toString("base64");
}

/**
 * 거래명세서 PDF — 투명 PNG 우선 (DB PNG → img/seals·assets PNG 파일)
 */
function resolveSealForPdf(staff, sealRaw) {
    const raw = str(sealRaw);
    const parsed = raw ? parseDataUrl(raw) : null;
    if (parsed && parsed.mime === "png") {
        return { kind: "buffer", buffer: parsed.buffer };
    }
    const file = findSealPngFile(staff);
    if (file) {
        return { kind: "path", path: file };
    }
    if (parsed) {
        return { kind: "buffer", buffer: parsed.buffer };
    }
    return null;
}

/**
 * staff 저장 시 — JPEG·빈 값이면 img/seals 의 투명 PNG로 DB 보정
 */
function normalizeStaffSealForDb(seal, staff) {
    const raw = str(seal);
    const parsed = raw ? parseDataUrl(raw) : null;
    if (parsed && parsed.mime === "png") {
        return raw;
    }
    const file = findSealPngFile(staff);
    if (file) {
        try {
            return pngDataUrlFromFile(file);
        } catch (e) {
            console.warn("[staff] seal file read failed:", file, e.message);
        }
    }
    return raw;
}

module.exports = {
    SEAL_DIR_IMG,
    findSealPngFile,
    resolveSealForPdf,
    normalizeStaffSealForDb,
    pngDataUrlFromFile
};
