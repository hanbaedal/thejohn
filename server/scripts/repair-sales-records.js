/**
 * 수동 실행: 주문·수기 거래명세서 → sales_records 누락분 보정
 * 사용: node server/scripts/repair-sales-records.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { MongoClient } = require("mongodb");
const { repairSalesRecords } = require("../lib/salesRecords");

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI missing");
        process.exit(1);
    }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "thejhon");
    const report = await repairSalesRecords(db);
    const total = await db.collection("sales_records").countDocuments({});
    console.log(JSON.stringify(Object.assign({ total }, report), null, 2));
    await client.close();
}

main().catch(function (e) {
    console.error(e);
    process.exit(1);
});
