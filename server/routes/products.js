const express = require("express");
const { getDb } = require("../db");
const { requireRole, extractBearer, verifyToken } = require("../middleware/auth");
const {
    toPublic,
    toPublicListItem,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    findDuplicateProductByName,
    F
} = require("../lib/productFields");
const {
    isStaffAuth,
    canReadProduct,
    canWriteProduct,
    buildProductListQuery,
    stampNewProductRegistration,
    applyProductRegistrationOnUpdate
} = require("../lib/productAccess");
const { normalizeStaffLoginId } = require("../lib/vendorAccess");
const { normalizeDept, deptQuery } = require("../lib/productDept");

const router = express.Router();

function newId() {
    return "pr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function optionalAuth(req) {
    const token = extractBearer(req);
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

function buildListFindQuery(auth, reqQuery) {
    const base = buildProductListQuery(auth, reqQuery.registeredBy);
    const deptPart = reqQuery.dept ? deptQuery(reqQuery.dept) : null;
    if (!deptPart) return base;
    if (!base || Object.keys(base).length === 0) return deptPart;
    return { $and: [base, deptPart] };
}

router.get("/", async (req, res) => {
    try {
        const auth = optionalAuth(req);
        const query = buildListFindQuery(auth, req.query);
        const items = await getDb()
            .collection("products")
            .aggregate([
                { $match: query },
                { $sort: { updatedAt: -1 } },
                {
                    $addFields: {
                        pd_has_image: {
                            $or: [
                                {
                                    $gt: [
                                        {
                                            $strLenCP: {
                                                $ifNull: [
                                                    { $substrBytes: ["$" + F.image, 0, 1] },
                                                    ""
                                                ]
                                            }
                                        },
                                        0
                                    ]
                                },
                                {
                                    $gt: [
                                        {
                                            $strLenCP: {
                                                $ifNull: [
                                                    { $substrBytes: ["$image", 0, 1] },
                                                    ""
                                                ]
                                            }
                                        },
                                        0
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    $project: {
                        id: 1,
                        title: 1,
                        content: 1,
                        spec: 1,
                        image: 1,
                        pd_price: 1,
                        price: 1,
                        [F.name]: 1,
                        [F.price1]: 1,
                        [F.price2]: 1,
                        [F.price3]: 1,
                        [F.price4]: 1,
                        [F.size]: 1,
                        [F.dept]: 1,
                        pd_dept: 1,
                        dept: 1,
                        division: 1,
                        category: 1,
                        updatedAt: 1,
                        pd_has_image: 1,
                        [F.image]: 0
                    }
                }
            ])
            .toArray();
        res.json({
            ok: true,
            items: items.map(toPublicListItem).filter(Boolean),
            dept: req.query.dept ? normalizeDept(req.query.dept) : "",
            scope: auth && isStaffAuth(auth) ? "staff" : "public"
        });
    } catch (e) {
        console.error("GET /api/products", e);
        res.status(500).json({ ok: false, error: "상품 목록을 불러오지 못했습니다." });
    }
});

router.get("/check-name", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const name = String(req.query.name || "");
        const excludeId = req.query.excludeId ? String(req.query.excludeId) : "";
        const dept = String(req.query.dept || "");
        if (!name.trim() || !dept.trim()) {
            return res.json({ ok: true, duplicate: false });
        }
        const owner = normalizeStaffLoginId(req.auth.userId);
        const dup = await findDuplicateProductByName(getDb(), name, excludeId, dept, owner);
        res.json({
            ok: true,
            duplicate: !!dup,
            item: dup ? toPublic(dup) : null
        });
    } catch (e) {
        console.error("GET /api/products/check-name", e);
        res.status(500).json({ ok: false, error: "상품명 중복 확인에 실패했습니다." });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const auth = optionalAuth(req);
        const doc = await getDb().collection("products").findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        if (auth && isStaffAuth(auth) && !canReadProduct(auth, doc)) {
            return res.status(403).json({ ok: false, error: "이 상품을 조회할 권한이 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/products/:id", e);
        res.status(500).json({ ok: false, error: "상품을 불러오지 못했습니다." });
    }
});

router.post("/", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const built = buildFromBody(req.body, null);
        const err = validateBuilt(built, true);
        if (err) return res.status(400).json({ ok: false, error: err });

        const owner = normalizeStaffLoginId(req.auth.userId);
        const dup = await findDuplicateProductByName(getDb(), built.pd_name, null, built.pd_dept, owner);
        if (dup) {
            return res.status(409).json({
                ok: false,
                code: "DUPLICATE_NAME",
                error: "같은 사업부문에 이미 등록된 상품 명칭입니다."
            });
        }

        let doc = toDbDoc(newId(), built, null);
        doc = await stampNewProductRegistration(doc, req.auth);
        await getDb().collection("products").insertOne(doc);
        console.log("[products] inserted:", doc.id, doc[F.name], "by", doc[F.registeredBy]);
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/products", e);
        res.status(500).json({ ok: false, error: "상품 저장에 실패했습니다." });
    }
});

router.put("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const id = req.params.id;
        const existing = await getDb().collection("products").findOne({ id });
        if (!existing) return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        if (!canWriteProduct(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 상품은 수정할 수 없습니다."
            });
        }

        const built = buildFromBody(req.body, existing);
        const err = validateBuilt(built, false);
        if (err) return res.status(400).json({ ok: false, error: err });

        const owner = normalizeStaffLoginId(existing[F.registeredBy] || req.auth.userId);
        const dup = await findDuplicateProductByName(getDb(), built.pd_name, id, built.pd_dept, owner);
        if (dup) {
            return res.status(409).json({
                ok: false,
                code: "DUPLICATE_NAME",
                error: "같은 사업부문에 이미 등록된 상품 명칭입니다."
            });
        }

        let doc = toDbDoc(id, built, existing);
        doc = await applyProductRegistrationOnUpdate(doc, existing, req.auth, req.body);
        await getDb().collection("products").replaceOne({ id }, doc);
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("PUT /api/products/:id", e);
        res.status(500).json({ ok: false, error: "상품 저장에 실패했습니다." });
    }
});

router.delete("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const existing = await getDb().collection("products").findOne({ id: req.params.id });
        if (!existing) return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        if (!canWriteProduct(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 상품은 삭제할 수 없습니다."
            });
        }
        const result = await getDb().collection("products").deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/products/:id", e);
        res.status(500).json({ ok: false, error: "상품 삭제에 실패했습니다." });
    }
});

module.exports = router;
