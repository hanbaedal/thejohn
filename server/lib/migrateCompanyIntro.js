/**
 * 회사소개 인사말 — DB 비어 있을 때만 홈페이지 템플릿으로 채움
 * 소개 이미지는 마이그레이션하지 않음 — 회사 소개 관리에서 수기 등록
 *
 * 주의: staff 전체 toArray() 금지 — st_company_intro_images(base64 다수)가 있으면
 * 기동·재배포 때마다 MongoDB 대용량 읽기 → 상품 thumb 등 전체가 느려짐
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

/** 이미지 본문 없이 장수만 서버에서 일괄 보강 (pipeline update) */
async function backfillCompanyIntroImageCounts(col) {
    const missing = await col.countDocuments({
        active: { $ne: false },
        st_company_intro_image_count: { $exists: false }
    });
    if (!missing) return 0;

    const withImages = await col.updateMany(
        {
            active: { $ne: false },
            st_company_intro_image_count: { $exists: false },
            "st_company_intro_images.0": { $exists: true }
        },
        [
            {
                $set: {
                    st_company_intro_image_count: {
                        $size: { $ifNull: ["$st_company_intro_images", []] }
                    },
                    updatedAt: Date.now()
                }
            }
        ]
    );

    const withoutImages = await col.updateMany(
        {
            active: { $ne: false },
            st_company_intro_image_count: { $exists: false },
            $or: [
                { st_company_intro_images: { $exists: false } },
                { st_company_intro_images: { $size: 0 } }
            ]
        },
        { $set: { st_company_intro_image_count: 0, updatedAt: Date.now() } }
    );

    return (withImages.modifiedCount || 0) + (withoutImages.modifiedCount || 0);
}

async function migrateCompanyIntroCollection(database) {
    const col = database.collection("staff");
    const greetingList = await col
        .find(
            {
                active: { $ne: false },
                $or: [
                    { st_company_greeting: { $exists: false } },
                    { st_company_greeting: null },
                    { st_company_greeting: "" }
                ]
            },
            {
                projection: {
                    id: 1,
                    st_company: 1,
                    loginId: 1,
                    st_company_greeting: 1
                }
            }
        )
        .toArray();

    let count = 0;
    for (let i = 0; i < greetingList.length; i++) {
        if (await migrateStaffDoc(col, greetingList[i])) count++;
    }
    if (count) {
        console.log("[staff] company-intro migrate 완료:", count, "건");
    }

    const countBackfill = await backfillCompanyIntroImageCounts(col);
    if (countBackfill) {
        console.log("[staff] company-intro image count:", countBackfill, "건");
    }
    return count;
}

module.exports = {
    migrateCompanyIntroCollection
};
