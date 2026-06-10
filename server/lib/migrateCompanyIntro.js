/**
 * 회사소개(인사말·소개 이미지) — 기존 하드코딩·정적 파일 → staff 컬렉션
 * Render 기동 시 runStartupMigrations 에서 호출 (비어 있는 필드만 채움)
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
    buildHomepageGreetingText,
    matchesWooilFoodCompany,
    matchesAkSangsaCompany
} = require("./companyIntro");

const AEK_GALLERY_COUNT = 12;
const WOOIL_BLOCK_COUNT = 4;
/** SVG→JPEG 한글 폰트 방식 변경 시 우일푸드 이미지 재생성 */
const WOOIL_INTRO_IMAGE_GEN = 2;
const INTRO_IMAGE_SIZE = 800;
const FONT_REGULAR = path.join(__dirname, "..", "fonts", "NotoSansKR-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "..", "fonts", "NotoSansKR-Bold.ttf");

let cachedFontCssEmbedded = "";

function fontFaceDataUrl(filePath) {
    const buf = fs.readFileSync(filePath);
    return (
        "data:application/font-ttf;base64," + buf.toString("base64")
    );
}

function resolveAekGalleryDir() {
    const candidates = [
        path.join(__dirname, "..", "public", "img", "company-intro", "aek"),
        path.join(__dirname, "..", "..", "img", "company-intro", "aek")
    ];
    for (let i = 0; i < candidates.length; i++) {
        if (fs.existsSync(path.join(candidates[i], "1.png"))) {
            return candidates[i];
        }
    }
    return candidates[0];
}

function escapeXml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function wrapLines(text, maxChars) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach(function (word) {
        const next = line ? line + " " + word : word;
        if (next.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    });
    if (line) lines.push(line);
    return lines;
}

/** Render·librsvg 에서 file:// 폰트가 깨지므로 base64 임베드 */
function fontCssEmbedded() {
    if (cachedFontCssEmbedded) return cachedFontCssEmbedded;
    if (!fs.existsSync(FONT_REGULAR)) {
        throw new Error("한글 폰트 없음: server/fonts/NotoSansKR-Regular.ttf");
    }
    let css =
        "@font-face{font-family:'NotoKR';font-weight:400;font-style:normal;src:url('" +
        fontFaceDataUrl(FONT_REGULAR) +
        "') format('truetype');}";
    if (fs.existsSync(FONT_BOLD)) {
        css +=
            "@font-face{font-family:'NotoKR';font-weight:700;font-style:normal;src:url('" +
            fontFaceDataUrl(FONT_BOLD) +
            "') format('truetype');}";
    }
    cachedFontCssEmbedded = css;
    return css;
}

async function svgToJpegDataUrl(svg) {
    const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
    return "data:image/jpeg;base64," + buf.toString("base64");
}

async function renderIntroBlockImage(opts) {
    const titleEn = escapeXml(opts.titleEn || "");
    const titleKo = escapeXml(opts.titleKo || "");
    const lines = (opts.lines || []).map(escapeXml);
    const height = Math.max(420, 180 + lines.length * 34);
    let y = 88;
    let bodySvg = "";
    lines.forEach(function (line, idx) {
        const weight = opts.emphasis && opts.emphasis[idx] ? 700 : 400;
        const fill = opts.emphasis && opts.emphasis[idx] ? "#e65100" : "#3d5166";
        bodySvg +=
            '<text x="400" y="' +
            y +
            '" text-anchor="middle" font-family="NotoKR,sans-serif" font-size="22" font-weight="' +
            weight +
            '" fill="' +
            fill +
            '">' +
            line +
            "</text>";
        y += 34;
    });

    const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="' +
        height +
        '">' +
        "<defs><style>" +
        fontCssEmbedded() +
        "</style></defs>" +
        '<rect width="100%" height="100%" fill="#ffffff"/>' +
        '<rect x="12" y="12" width="776" height="' +
        (height - 24) +
        '" rx="10" fill="#ffffff" stroke="#e0e6ed"/>' +
        '<text x="400" y="52" text-anchor="middle" font-family="NotoKR,sans-serif" font-size="26" font-weight="700" fill="#7cb342" letter-spacing="2">' +
        titleEn +
        " " +
        titleKo +
        "</text>" +
        bodySvg +
        "</svg>";

    return svgToJpegDataUrl(svg);
}

async function buildWooilIntroImages(companyName) {
    const name = String(companyName || "(주)우일푸드").trim();
    return [
        await renderIntroBlockImage({
            titleEn: "VISION",
            titleKo: "비전",
            lines: [
                name + "가 취급하는 식품이라면 누구나 신뢰할 수 있는 기업이 되겠습니다.",
                name + "는 공급자와 수요자 모두가 만족을 느끼는 행복한 기업이 되겠습니다.",
                name + "와 함께하면 모두가 건강할 수 있다는 믿음과 행복한 마음을 가질 수 있는 기업이 되겠습니다."
            ],
            emphasis: [true, true, true]
        }),
        await renderIntroBlockImage({
            titleEn: "MANAGEMENT POLICY",
            titleKo: "경영 방침",
            lines: wrapLines(
                "최고의 상품을 엄선하여 상품 고급화와 상품의 규격화에 상품의 질은 높이고 가격은 내리는 식품유통의 합리화에 고객을 위하고 회사를 위하며 우리를 위하는 모두에게 좋은 이윤을 얻을 수 있는 기업이 되고자 합니다.",
                28
            )
        }),
        await renderIntroBlockImage({
            titleEn: "COMPANY MOTTO",
            titleKo: "사훈",
            lines: ["Ⅰ. 건강한 정신", "Ⅱ. 성실한 행동", "Ⅲ. 감사한 마음"]
        }),
        await renderIntroBlockImage({
            titleEn: "MANAGEMENT IDEOLOGY",
            titleKo: "경영 이념",
            lines: ["Ⅰ. 고객을 위하고", "Ⅱ. 회사를 위하며", "Ⅲ. 우리를 위하여"]
        })
    ];
}

async function fileToIntroDataUrl(filePath) {
    const buf = await sharp(filePath)
        .resize(INTRO_IMAGE_SIZE, INTRO_IMAGE_SIZE, {
            fit: "inside",
            withoutEnlargement: true
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    return "data:image/jpeg;base64," + buf.toString("base64");
}

async function loadAekGalleryImages() {
    const dir = resolveAekGalleryDir();
    const images = [];
    for (let n = 1; n <= AEK_GALLERY_COUNT; n++) {
        const filePath = path.join(dir, n + ".png");
        if (!fs.existsSync(filePath)) {
            throw new Error("AK 갤러리 파일 없음: " + filePath);
        }
        images.push(await fileToIntroDataUrl(filePath));
    }
    return images;
}

async function migrateStaffDoc(col, staff) {
    const company = String(staff.st_company || "").trim();
    const loginId = String(staff.loginId || "").trim().toLowerCase();
    const update = {};
    const label = company || staff.id || loginId;

    const hasGreeting = String(staff.st_company_greeting || "").trim().length > 0;
    const hasImages =
        Array.isArray(staff.st_company_intro_images) &&
        staff.st_company_intro_images.length > 0;

    if (!hasGreeting) {
        update.st_company_greeting = buildHomepageGreetingText(company, loginId);
    }

    if (matchesWooilFoodCompany(company)) {
        const imgGen = Number(staff.st_company_intro_images_gen) || 0;
        const needsWooilImages = !hasImages || imgGen !== WOOIL_INTRO_IMAGE_GEN;
        if (needsWooilImages) {
            try {
                update.st_company_intro_images = await buildWooilIntroImages(company);
                update.st_company_intro_images_gen = WOOIL_INTRO_IMAGE_GEN;
            } catch (imgErr) {
                console.warn("[staff] wooil intro images skip:", label, imgErr.message);
            }
        }
    } else if (loginId === "ak20140516" || matchesAkSangsaCompany(company)) {
        if (!hasImages) {
            update.st_company_intro_images = await loadAekGalleryImages();
        }
    }

    if (!Object.keys(update).length) {
        return false;
    }

    update.updatedAt = Date.now();
    await col.updateOne({ id: staff.id }, { $set: update });
    console.log(
        "[staff] company-intro migrate:",
        label,
        update.st_company_greeting ? "인사말" : "",
        update.st_company_intro_images
            ? "이미지 " + update.st_company_intro_images.length + "장"
            : ""
    );
    return true;
}

/** 우일푸드 등 — 이미지 없을 때만 재시도 (관리자가 비운 뒤 재기동 시 채움) */
async function migrateCompanyIntroCollection(database) {
    const col = database.collection("staff");
    const staffList = await col.find({ active: { $ne: false } }).toArray();
    let count = 0;
    for (let i = 0; i < staffList.length; i++) {
        if (await migrateStaffDoc(col, staffList[i])) count++;
    }
    if (count) {
        console.log("[staff] company-intro migrate 완료:", count, "건");
    }
    return count;
}

module.exports = {
    migrateCompanyIntroCollection,
    buildWooilIntroImages,
    WOOIL_BLOCK_COUNT,
    WOOIL_INTRO_IMAGE_GEN
};
