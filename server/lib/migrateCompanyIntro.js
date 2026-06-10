/**
 * 회사소개(인사말·소개 이미지) — 기존 하드코딩·정적 파일 → staff 컬렉션
 * Render 기동 시 runStartupMigrations 에서 호출 (비어 있는 필드만 채움)
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const {
    buildWooilGreetingText,
    buildDefaultDojeonGreetingText,
    matchesWooilFoodCompany,
    matchesAkSangsaCompany
} = require("./companyIntro");

const AEK_GALLERY_COUNT = 12;
const INTRO_IMAGE_SIZE = 800;

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

    if (matchesWooilFoodCompany(company)) {
        if (!hasGreeting) {
            update.st_company_greeting = buildWooilGreetingText(company);
        }
        /* SVG 자동 생성 이미지는 서버에서 한글이 깨짐 → 회사소개 페이지는 HTML 블록 표시 */
        if (hasImages) {
            update.st_company_intro_images = [];
        }
    } else if (loginId === "ak20140516" || matchesAkSangsaCompany(company)) {
        if (!hasGreeting) {
            update.st_company_greeting = buildDefaultDojeonGreetingText(
                company || "(주)에이케이상사"
            );
        }
        if (!hasImages) {
            update.st_company_intro_images = await loadAekGalleryImages();
        }
    } else if (loginId === "thejohn" || company.indexOf("더존") !== -1) {
        if (!hasGreeting) {
            update.st_company_greeting = buildDefaultDojeonGreetingText(company || "(주)더존");
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
    migrateCompanyIntroCollection
};
