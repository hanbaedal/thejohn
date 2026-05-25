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
    const deptPart = reqQuery.dept ? deptQuery(reqQuery.dept) : null;
    /** 사업부문(?dept=) — 공개 카탈로그: 부문만 필터 */
    const catalogByDept = !!reqQuery.dept && !reqQuery.registeredBy;
    let base = {};
    if (catalogByDept) {
        base = {};
    } else if (auth && isStaffAuth(auth)) {
        /** 관리자 상품·업체 리스트 — products 컬렉션 전체, 담당 필터는 registeredBy 선택 시만 */
        if (reqQuery.registeredBy) {
            base = buildProductListQuery(auth, reqQuery.registeredBy);
        } else {
            base = {};
        }
    } else if (auth) {
        base = buildProductListQuery(auth, reqQuery.registeredBy);
    }
    if (!deptPart) return base;
    if (!base || Object.keys(base).length === 0) return deptPart;
    return { $and: [base, deptPart] };
}

router.get("/", async (req, res) => {
    try {
        const auth = optionalAuth(req);
        const query = buildListFindQuery(auth, req.query);
        const catalogByDept = !!req.query.dept && !req.query.registeredBy;
        const items = await getDb()
            .collection("products")
            .find(query, { projection: { [F.image]: 0, pd_image: 0, image: 0 } })
            .sort({ updatedAt: -1 })
            .toArray();
        const rows = [];
        for (const doc of items) {
            try {
                const row = toPublicListItem(doc);
                if (row) rows.push(row);
            } catch (mapErr) {
                console.error("GET /api/products map", doc && doc.id, mapErr.message);
            }
        }
        res.json({
            ok: true,
            items: rows,
            dept: req.query.dept ? normalizeDept(req.query.dept) : "",
            scope: catalogByDept ? "catalog" : auth && isStaffAuth(auth) ? "staff" : "public"
        });
    } catch (e) {
        console.error("GET /api/products", e);
        res.status(500).json({ ok: false, error: "상품 목록을 불러오지 못했습니다." });
    }
});

/** 목록 썸네일 — pd_image 만 반환(사업부문 카드용) */
router.get("/:id/cover", async function (req, res) {
    try {
        const doc = await getDb()
            .collection("products")
            .findOne(
                { id: req.params.id },
                { projection: { [F.image]: 1, pd_image: 1 } }
            );
        if (!doc) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        const img = String(doc[F.image] || doc.pd_image || "");
        if (!img) {
            return res.status(404).json({ ok: false, error: "사진이 없습니다." });
        }
        res.json({ ok: true, pd_image: img });
    } catch (e) {
        console.error("GET /api/products/:id/cover", e);
        res.status(500).json({ ok: false, error: "사진을 불러오지 못했습니다." });
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
        const pid = String(req.params.id || "").trim();
        let doc = await getDb().collection("products").findOne({ id: pid });
        if (!doc && /^[a-f0-9]{24}$/i.test(pid)) {
            try {
                const { ObjectId } = require("mongodb");
                doc = await getDb().collection("products").findOne({ _id: new ObjectId(pid) });
            } catch (oidErr) {
                /* ignore invalid ObjectId */
            }
        }
        if (!doc) return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        const item = toPublic(doc);
        const img = String(item.pd_image || "");
        if (img.length > 400 || /^data:/i.test(img)) {
            item.pd_has_image = true;
            item.pd_image = "";
        } else {
            item.pd_has_image = !!img;
        }
        res.json({ ok: true, item: item });
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
