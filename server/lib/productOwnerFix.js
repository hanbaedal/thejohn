const { F } = require("./productFields");
const { staffLoginIdsEqual } = require("./staffLoginId");

/** 음료수 「삼다수 생수」 — 청산종합물류(GM_logistics) 담당으로 정정 (idempotent) */
const DRINK_PRODUCT_ID = "pr_mq80dn33_hchl8kfu";
const CHEONGSAN_LOGIN = "GM_logistics";

async function fixDrinkProductOwnerForCheongsan(db) {
    const col = db.collection("products");
    const doc = await col.findOne({ id: DRINK_PRODUCT_ID });
    if (!doc) {
        return { skipped: true, reason: "product_not_found" };
    }

    const current = String(doc[F.registeredBy] || "").trim();
    if (staffLoginIdsEqual(current, CHEONGSAN_LOGIN)) {
        return { skipped: true, reason: "already_cheongsan", loginId: current };
    }

    const staff = await db.collection("staff").findOne({
        loginId: { $in: [CHEONGSAN_LOGIN, CHEONGSAN_LOGIN.toLowerCase()] },
        active: { $ne: false }
    });
    if (!staff) {
        console.warn("[products] cheongsan drink owner fix: staff not found:", CHEONGSAN_LOGIN);
        return { skipped: true, reason: "staff_not_found" };
    }

    const loginId = String(staff.loginId || CHEONGSAN_LOGIN).trim();
    const companyName = String(staff.st_company || "청산종합물류").trim();
    const now = Date.now();

    const r = await col.updateOne(
        { id: DRINK_PRODUCT_ID },
        {
            $set: {
                [F.registeredBy]: loginId,
                [F.registeredByName]: companyName,
                updatedAt: now
            }
        }
    );

    if (r.modifiedCount) {
        console.log(
            "[products] cheongsan drink owner fixed:",
            DRINK_PRODUCT_ID,
            current,
            "->",
            loginId,
            "(" + companyName + ")"
        );
    }

    return {
        fixed: r.modifiedCount > 0,
        productId: DRINK_PRODUCT_ID,
        from: current,
        to: loginId,
        companyName: companyName
    };
}

module.exports = {
    fixDrinkProductOwnerForCheongsan,
    DRINK_PRODUCT_ID,
    CHEONGSAN_LOGIN
};
