const express = require("express");
const { getDb, isDbReady } = require("../db");
const { requireRole, extractBearer, verifyToken } = require("../middleware/auth");
const {
    toPublic,
    toPublicListItem,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    findDuplicateProductByName,
    applyStaffContactFallback,
    F
} = require("../lib/productFields");
const { findStaffByLoginId } = require("../lib/loginResolve");
const {
    canWriteProduct,
    buildProductListQuery,
    buildVendorCatalogProductQuery,
    vendorCanAccessProduct,
    stampNewProductRegistration,
    applyProductRegistrationOnUpdate
} = require("../lib/productAccess");
const { normalizeStaffLoginId, isStaffAuth } = require("../lib/vendorAccess");
const { findVendorByLoginId } = require("../lib/loginResolve");
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

function buildListFindQuery(auth, reqQuery, vendorDoc) {
    const deptPart = reqQuery.dept ? deptQuery(reqQuery.dept) : null;
    let base = {};

    if (auth && auth.role === "vendor") {
        base = buildVendorCatalogProductQuery(vendorDoc, auth);
    } else {
        /** 사업부문(?dept=) — 비로그인 공개 카탈로그: 부문만 필터 */
        const catalogByDept =
            !!reqQuery.dept && !reqQuery.registeredBy && !(auth && isStaffAuth(auth));
        if (catalogByDept) {
            base = {};
        } else if (auth && isStaffAuth(auth)) {
            base = buildProductListQuery(auth);
        } else if (auth) {
            base = buildProductListQuery(auth);
        }
    }

    if (!deptPart) return base;
    if (!base || Object.keys(base).length === 0) return deptPart;
    return { $and: [base, deptPart] };
}

async function resolveVendorForAuth(auth) {
    if (!auth || auth.role !== "vendor") return null;
    return findVendorByLoginId(auth.userId || "");
}

function contactNeedsStaffFallback(item) {
    if (!item) return false;
    const reg = String(item.pd_registered_by || "").trim();
    if (!reg) return false;
    return (
        !String(item.per_name || "").trim() ||
        !String(item["per-number"] || "").trim()
    );
}

async function enrichProductsContact(rows) {
    const staffCache = Object.create(null);
    const out = [];
    for (const row of rows || []) {
        if (!contactNeedsStaffFallback(row)) {
            out.push(row);
            continue;
        }
        const key = String(row.pd_registered_by || "").trim();
        if (!staffCache[key]) {
            staffCache[key] = await findStaffByLoginId(key);
        }
        out.push(applyStaffContactFallback(row, staffCache[key]));
    }
    return out;
}

router.get("/", async (req, res) => {
    try {
        if (!isDbReady()) {
            return res.status(503).json({
                ok: false,
                error: "데이터베이스에 연결 중입니다. 잠시 후 다시 시도해 주세요."
            });
        }
        const auth = optionalAuth(req);
        const vendorDoc = await resolveVendorForAuth(auth);
        const query = buildListFindQuery(auth, req.query, vendorDoc);
        const catalogByDept =
            !!req.query.dept &&
            !req.query.registeredBy &&
            !(auth && isStaffAuth(auth)) &&
            !(auth && auth.role === "vendor");
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
        const enriched = await enrichProductsContact(rows);
        const payload = {
            ok: true,
            items: enriched,
            dept: req.query.dept ? normalizeDept(req.query.dept) : "",
            scope:
                auth && auth.role === "vendor"
                    ? "vendor"
                    : catalogByDept
                      ? "catalog"
                      : auth && isStaffAuth(auth)
                        ? "staff"
                        : "public"
        };
        try {
            res.json(payload);
        } catch (jsonErr) {
            console.error("GET /api/products json", jsonErr);
            res.status(500).json({ ok: false, error: "상품 목록을 불러오지 못했습니다." });
        }
    } catch (e) {
        console.error("GET /api/products", e);
        res.status(500).json({ ok: false, error: "상품 목록을 불러오지 못했습니다." });
    }
});

/** 목록 썸네일 — pd_image 만 반환(사업부문 카드용) */
router.get("/:id/cover", async function (req, res) {
    try {
        const auth = optionalAuth(req);
        const vendorDoc = await resolveVendorForAuth(auth);
        const doc = await getDb()
            .collection("products")
            .findOne(
                { id: req.params.id },
                { projection: { [F.image]: 1, pd_image: 1, [F.registeredBy]: 1 } }
            );
        if (!doc) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        if (auth && auth.role === "vendor" && !vendorCanAccessProduct(vendorDoc, doc, auth)) {
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
        const auth = optionalAuth(req);
        const vendorDoc = await resolveVendorForAuth(auth);
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
        if (auth && auth.role === "vendor" && !vendorCanAccessProduct(vendorDoc, doc, auth)) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        let item = toPublic(doc);
        const img = String(item.pd_image || "");
        if (img.length > 400 || /^data:/i.test(img)) {
            item.pd_has_image = true;
            item.pd_image = "";
        } else {
            item.pd_has_image = !!img;
        }
        if (contactNeedsStaffFallback(item)) {
            const staff = await findStaffByLoginId(String(item.pd_registered_by || "").trim());
            item = applyStaffContactFallback(item, staff);
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
