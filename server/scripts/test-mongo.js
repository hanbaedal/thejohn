require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { MongoClient } = require("mongodb");

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("MONGODB_URI missing");
        process.exit(1);
    }
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DB || "thejhon");
        const ping = await db.command({ ping: 1 });
        console.log("OK ping", ping);
        const cols = await db.listCollections().toArray();
        console.log("collections", cols.map((c) => c.name).join(", ") || "(none)");
    } catch (e) {
        console.error("FAIL", e.name, e.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}
main();
