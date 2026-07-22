/**
 * 등록 업체 e하늘 누락 필드 일괄 보강 (CLI)
 * 사용: node server/scripts/backfill-vendor-fhi-fields.js [--dry-run]
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { connectDb, getDb } = require("../db");
const { backfillPartnerVendorsFromFhi } = require("../lib/vendorFhiBackfill");

async function main() {
    const dryRun = process.argv.indexOf("--dry-run") >= 0;
    await connectDb();
    const db = getDb();
    const result = await backfillPartnerVendorsFromFhi(db, {
        dryRun: dryRun,
        includeLogo: true,
        onlyMissing: true
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
