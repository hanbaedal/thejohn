/**
 * MongoDB base64 이미지 → Cloudflare R2 JPEG 일괄 이전 (수동 실행)
 * 사용: npm run migrate-images-to-r2
 * 환경 변수: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { connectDb, closeDb } = require("../db");
const { isR2Enabled } = require("../lib/r2Storage");
const { backfillImagesToR2 } = require("../lib/imageR2");

async function main() {
    if (!isR2Enabled()) {
        console.error("R2 환경 변수가 설정되지 않았습니다. .env 또는 Render 환경 변수를 확인하세요.");
        process.exit(1);
    }
    const db = await connectDb();
    let totalProducts = 0;
    let totalStaff = 0;
    let round = 0;
    for (;;) {
        round++;
        const report = await backfillImagesToR2(db, {
            productBatch: 25,
            staffBatch: 5,
            maxRounds: 1
        });
        totalProducts += report.products;
        totalStaff += report.staff;
        console.log("round", round, "— products:", report.products, "staff intro:", report.staff);
        if (!report.products && !report.staff) break;
        if (round >= 500) {
            console.warn("500라운드 제한 — 나머지는 서버 기동 시 백필 또는 재실행하세요.");
            break;
        }
    }
    await closeDb();
    console.log("migrate-images-to-r2 완료 — products:", totalProducts, "staff intro:", totalStaff);
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err);
        process.exit(1);
    });
}
