/**
 * 회사소개 인사말 — DB 비어 있을 때만 홈페이지 템플릿으로 채움
 * 소개 이미지는 마이그레이션하지 않음 — 회사 소개 관리에서 수기 등록
 */
const { buildHomepageGreetingText } = require("./companyIntro");

async function migrateStaffDoc(col, staff) {
    const company = String(staff.st_company || "").trim();
    const loginId = String(staff.loginId || "").trim().toLowerCase();
    const update = {};
    const label = company || staff.id || loginId;

    const hasGreeting = String(staff.st_company_greeting || "").trim().length > 0;

    if (!hasGreeting) {
        update.st_company_greeting = buildHomepageGreetingText(company, loginId);
    }

    if (!Object.keys(update).length) {
        return false;
    }

    update.updatedAt = Date.now();
    await col.updateOne({ id: staff.id }, { $set: update });
    console.log("[staff] company-intro migrate:", label, "인사말");
    return true;
}

async function backfillCompanyIntroImageCount(col, staff) {
    const images = Array.isArray(staff.st_company_intro_images)
        ? staff.st_company_intro_images
        : [];
    const imageCount = images.filter(function (item) {
        return String(item || "").trim();
    }).length;
    const stored = parseInt(staff.st_company_intro_image_count, 10);
    if (isFinite(stored) && stored === imageCount) return false;
    await col.updateOne(
        { id: staff.id },
        { $set: { st_company_intro_image_count: imageCount, updatedAt: Date.now() } }
    );
    return true;
}

async function migrateCompanyIntroCollection(database) {
    const col = database.collection("staff");
    const staffList = await col.find({ active: { $ne: false } }).toArray();
    let count = 0;
    let countBackfill = 0;
    for (let i = 0; i < staffList.length; i++) {
        if (await migrateStaffDoc(col, staffList[i])) count++;
        if (await backfillCompanyIntroImageCount(col, staffList[i])) countBackfill++;
    }
    if (count) {
        console.log("[staff] company-intro migrate 완료:", count, "건");
    }
    if (countBackfill) {
        console.log("[staff] company-intro image count:", countBackfill, "건");
    }
    return count;
}

module.exports = {
    migrateCompanyIntroCollection
};
