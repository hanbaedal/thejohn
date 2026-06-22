/**
 * 수동 실행: 음료수 상품 담당 → GM_logistics(청산종합물류)
 * 사용: node server/scripts/fix-drink-product-owner.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { MongoClient } = require("mongodb");
const { fixDrinkProductOwnerForCheongsan } = require("../lib/productOwnerFix");

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI missing");
        process.exit(1);
    }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "thejhon");
    const report = await fixDrinkProductOwnerForCheongsan(db);
    console.log(JSON.stringify(report, null, 2));
    await client.close();
}

main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
