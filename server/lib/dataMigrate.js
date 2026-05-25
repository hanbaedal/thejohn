const { migrateProductsCollection } = require("./productFields");
const { migrateVendorsCollection } = require("./vendorFields");
const { migrateStaffCollection } = require("./staffFields");
const { ensureLoginFieldsMigrated } = require("./loginResolve");

async function productDeptSummary(db) {
    return db
        .collection("products")
        .aggregate([
            { $group: { _id: "$pd_dept", n: { $sum: 1 } } },
            { $sort: { n: -1 } }
        ])
        .toArray();
}

async function countEmptyProductDept(db) {
    return db.collection("products").countDocuments({
        $or: [{ pd_dept: "" }, { pd_dept: { $exists: false } }, { pd_dept: null }]
    });
}

/**
 * MongoDB products·vendors·staff 를 현재 프로그램 필드 형식으로 일괄 변환
 * (관리자 API — requireRole admin)
 */
async function runFullDataMigration(db) {
    const before = {
        products: await db.collection("products").countDocuments(),
        vendors: await db.collection("vendors").countDocuments(),
        productsEmptyDept: await countEmptyProductDept(db),
        productDepts: await productDeptSummary(db)
    };

    const products = await migrateProductsCollection(db);
    const vendors = await migrateVendorsCollection(db);
    const staff = await migrateStaffCollection(db);
    await ensureLoginFieldsMigrated(db);

    const after = {
        products: await db.collection("products").countDocuments(),
        vendors: await db.collection("vendors").countDocuments(),
        productsEmptyDept: await countEmptyProductDept(db),
        productDepts: await productDeptSummary(db)
    };

    return {
        ok: true,
        message:
            "products·vendors·staff 레코드를 현재 프로그램 형식(pd_*, vn_*, 로그인 필드)으로 맞췄습니다.",
        before: before,
        after: after,
        steps: {
            products: products,
            vendors: vendors,
            staff: { collection: "staff", note: "staff 필드명 정리 완료" },
            loginFields: { collection: "staff", note: "로그인 필드 마이그레이션 완료" }
        }
    };
}

module.exports = {
    runFullDataMigration,
    productDeptSummary,
    countEmptyProductDept
};
