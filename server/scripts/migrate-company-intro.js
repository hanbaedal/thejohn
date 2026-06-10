/**
 * 회사소개 마이그레이션 — 수동 실행용 (배포는 기동 시 자동 migrateCompanyIntroCollection)
 * 사용: npm run migrate-company-intro
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { connectDb, closeDb } = require("../db");
const { migrateCompanyIntroCollection } = require("../lib/migrateCompanyIntro");

async function main() {
    const db = await connectDb();
    const count = await migrateCompanyIntroCollection(db);
    await closeDb();
    console.log("migrate-company-intro 완료:", count, "건 갱신");
}

if (require.main === module) {
    main().catch(function (err) {
        console.error(err);
        process.exit(1);
    });
}
