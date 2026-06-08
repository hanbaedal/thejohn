const express = require("express");
const { getDb, isDbReady } = require("../db");
const { requireRole, extractBearer, verifyToken } = require("../middleware/auth");
const {
    toPublic,
    toPublicListItem,
    buildFromBody,
    finalizeProductBuilt,
    toDbDoc,
    validateBuilt,
    findDuplicateProductByName,
    findDuplicateProductByCode,
    applyStaffContactFallback,
    findProductsForList,
    readImagesFromDoc,
    MAX_PRODUCT_IMAGES,
    F
} = require("../lib/productFields");
const { findStaffByLoginId } = require("../lib/loginResolve");
const { findStaffByRegisteredBy } = require("../lib/staffRegisteredBy");
const {
    canWriteProductAsync,
    createProductWriteChecker,
    buildProductListQuery,
    buildProductListQueryAsync,
    buildVendorCatalogProductQuery,
    vendorCanAccessProduct,
    stampNewProductRegistration,
    applyProductRegistrationOnUpdate
} = require("../lib/productAccess");
const { normalizeStaffLoginId, isStaffAuth, isSupervisorAuth } = require("../lib/vendorAccess");
const { trimStaffLoginId, registeredByInFilter } = require("../lib/staffLoginId");
const { findVendorByLoginId } = require("../lib/loginResolve");
const { normalizeDept, deptQuery } = require("../lib/productDept");
const {
    ensureIndexes: ensureProductInfoIndexes,
    findByProductId: findProductInfoByProductId,
    upsertForProduct: upsertProductInfo,
    removeForProduct: removeProductInfo,
    toPublic: toPublicProductInfo,
    FIELD_DEFS: PRODUCT_INFO_FIELD_DEFS,
    F: PRODUCT_INFO_F
} = require("../lib/productInfo");

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

async function buildListFindQuery(auth, reqQuery, vendorDoc) {
    const deptPart = reqQuery.dept ? deptQuery(reqQuery.dept) : null;
    let base = {};

    if (auth && auth.role === "vendor") {
        base = buildVendorCatalogProductQuery(vendorDoc, auth);
    } else {
        /** ?dept= 만 있으면 사업부문 카탈로그(부문 전체). ?registeredBy= 있으면 담당 관리자 필터 */
        const regBy = trimStaffLoginId(reqQuery.registeredBy || "");
        const catalogByDept = !!reqQuery.dept && !regBy;
        if (regBy && auth && isSupervisorAuth(auth)) {
            base = { [F.registeredBy]: registeredByInFilter(regBy) };
        } else if (catalogByDept) {
            base = {};
        } else if (auth && auth.role === "admin" && isStaffAuth(auth)) {
            base = await buildProductListQueryAsync(auth);
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
            staffCache[key] =
                (await findStaffByRegisteredBy(key)) || (await findStaffByLoginId(key));
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
        const query = await buildListFindQuery(auth, req.query, vendorDoc);
        const catalogByDept = !!req.query.dept && !req.query.registeredBy;
        let writeChecker = null;
        if (auth && isStaffAuth(auth)) {
            try {
                writeChecker = await createProductWriteChecker(auth);
            } catch (checkerErr) {
                console.error("GET /api/products writeChecker", checkerErr.message);
            }
        }
        const fullExplain = req.query.fullExplain === "1";
        /** 사진은 기본 제외 — 프론트에서 /covers API로 5개 단위 로드 */
        const includeCover = req.query.includeCover === "1";
        const items = await findProductsForList(getDb(), query, { includeCover: includeCover });
        const rows = [];
        for (const doc of items) {
            try {
                const row = toPublicListItem(doc, { fullExplain: fullExplain, includeCover: includeCover });
                if (row) {
                    if (writeChecker) {
                        try {
                            row.canWrite = writeChecker(doc);
                        } catch (writeErr) {
                            console.error("GET /api/products canWrite", doc && doc.id, writeErr.message);
                            row.canWrite = false;
                        }
                    }
                    rows.push(row);
                }
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

/** 목록용 대표 사진 일괄 조회 — ids=pr_a,pr_b (최대 80개) */
router.get("/covers", async function (req, res) {
    try {
        const auth = optionalAuth(req);
        const vendorDoc = await resolveVendorForAuth(auth);
        const raw = String(req.query.ids || "")
            .split(",")
            .map(function (s) {
                return String(s || "").trim();
            })
            .filter(Boolean);
        const ids = [];
        const seen = Object.create(null);
        raw.forEach(function (id) {
            if (seen[id] || ids.length >= 80) return;
            seen[id] = true;
            ids.push(id);
        });
        if (!ids.length) {
            return res.json({ ok: true, covers: {} });
        }
        const docs = await getDb()
            .collection("products")
            .find(
                { id: { $in: ids } },
                {
                    projection: {
                        id: 1,
                        [F.image]: 1,
                        [F.images]: 1,
                        pd_image: 1,
                        pd_images: 1,
                        [F.registeredBy]: 1
                    }
                }
            )
            .toArray();
        const covers = {};
        docs.forEach(function (doc) {
            if (auth && auth.role === "vendor" && !vendorCanAccessProduct(vendorDoc, doc, auth)) {
                return;
            }
            const images = readImagesFromDoc(doc);
            const img = images[0] || "";
            if (img) covers[doc.id] = img;
        });
        res.json({ ok: true, covers: covers });
    } catch (e) {
        console.error("GET /api/products/covers", e);
        res.status(500).json({ ok: false, error: "사진을 불러오지 못했습니다." });
    }
});

/** 상품 사진 전체(호환) — 최대 1장 */
router.get("/:id/images", async function (req, res) {
    try {
        const auth = optionalAuth(req);
        const vendorDoc = await resolveVendorForAuth(auth);
        const doc = await getDb()
            .collection("products")
            .findOne(
                { id: req.params.id },
                {
                    projection: {
                        [F.image]: 1,
                        [F.images]: 1,
                        pd_image: 1,
                        pd_images: 1,
                        [F.registeredBy]: 1
                    }
                }
            );
        if (!doc) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        if (auth && auth.role === "vendor" && !vendorCanAccessProduct(vendorDoc, doc, auth)) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        const images = readImagesFromDoc(doc);
        if (!images.length) {
            return res.status(404).json({ ok: false, error: "사진이 없습니다." });
        }
        res.json({ ok: true, images: images, count: images.length });
    } catch (e) {
        console.error("GET /api/products/:id/images", e);
        res.status(500).json({ ok: false, error: "사진을 불러오지 못했습니다." });
    }
});

/** 목록·상세 썸네일 — 대표 사진 1장 */
router.get("/:id/cover", async function (req, res) {
    try {
        const auth = optionalAuth(req);
        const vendorDoc = await resolveVendorForAuth(auth);
        const doc = await getDb()
            .collection("products")
            .findOne(
                { id: req.params.id },
                {
                    projection: {
                        [F.image]: 1,
                        [F.images]: 1,
                        pd_image: 1,
                        pd_images: 1,
                        [F.registeredBy]: 1
                    }
                }
            );
        if (!doc) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        if (auth && auth.role === "vendor" && !vendorCanAccessProduct(vendorDoc, doc, auth)) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        const images = readImagesFromDoc(doc);
        let idx = parseInt(String(req.query.index || "0"), 10);
        if (!isFinite(idx) || idx < 0) idx = 0;
        if (idx >= MAX_PRODUCT_IMAGES) idx = MAX_PRODUCT_IMAGES - 1;
        const img = images[idx] || "";
        if (!img) {
            return res.status(404).json({ ok: false, error: "사진이 없습니다." });
        }
        res.json({ ok: true, pd_image: img, index: idx, count: images.length });
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

router.get("/check-code", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const code = String(req.query.code || "");
        const excludeId = req.query.excludeId ? String(req.query.excludeId) : "";
        const dept = String(req.query.dept || "");
        if (!code.trim() || !dept.trim()) {
            return res.json({ ok: true, duplicate: false });
        }
        const dup = await findDuplicateProductByCode(getDb(), code, excludeId, dept);
        res.json({
            ok: true,
            duplicate: !!dup,
            item: dup ? toPublic(dup) : null
        });
    } catch (e) {
        console.error("GET /api/products/check-code", e);
        res.status(500).json({ ok: false, error: "상품 코드 중복 확인에 실패했습니다." });
    }
});

router.get("/:id/info", async (req, res) => {
    try {
        const auth = optionalAuth(req);
        const vendorDoc = await resolveVendorForAuth(auth);
        const pid = String(req.params.id || "").trim();
        const db = getDb();
        await ensureProductInfoIndexes(db);
        const existing = await db.collection("products").findOne({ id: pid });
        if (!existing) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        if (auth && auth.role === "vendor" && !vendorCanAccessProduct(vendorDoc, existing, auth)) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        const doc = await findProductInfoByProductId(db, pid);
        res.json({
            ok: true,
            item: doc ? toPublicProductInfo(doc) : null,
            fieldDefs: PRODUCT_INFO_FIELD_DEFS.map(function (d) {
                return { key: d.key, label: d.label, multiline: !!d.multiline, max: d.max };
            })
        });
    } catch (e) {
        console.error("GET /api/products/:id/info", e);
        res.status(e.status || 500).json({ ok: false, error: e.message || "상품정보를 불러오지 못했습니다." });
    }
});

router.put("/:id/info", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const pid = String(req.params.id || "").trim();
        const db = getDb();
        await ensureProductInfoIndexes(db);
        const item = await upsertProductInfo(db, req.auth, pid, req.body || {});
        res.json({ ok: true, item: item });
    } catch (e) {
        console.error("PUT /api/products/:id/info", e);
        res.status(e.status || 500).json({ ok: false, error: e.message || "상품정보 저장에 실패했습니다." });
    }
});

router.delete("/:id/info", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const pid = String(req.params.id || "").trim();
        const db = getDb();
        await removeProductInfo(db, req.auth, pid);
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/products/:id/info", e);
        res.status(e.status || 500).json({ ok: false, error: e.message || "상품정보 삭제에 실패했습니다." });
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
        const rawImages = readImagesFromDoc(doc);
        item.pd_image_count = rawImages.length;
        item.pd_has_image = rawImages.length > 0;
        item.pd_images = rawImages.map(function (u) {
            const s = String(u || "");
            if (s.length > 400 || /^data:/i.test(s)) return "";
            return s;
        });
        item.pd_image = item.pd_images[0] || "";
        if (contactNeedsStaffFallback(item)) {
            const staff = await findStaffByLoginId(String(item.pd_registered_by || "").trim());
            item = applyStaffContactFallback(item, staff);
        }
        if (auth && isStaffAuth(auth)) {
            item.canWrite = await canWriteProductAsync(auth, doc);
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
        await finalizeProductBuilt(built);
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

        if (built.pd_code) {
            const dupCode = await findDuplicateProductByCode(
                getDb(),
                built.pd_code,
                null,
                built.pd_dept
            );
            if (dupCode) {
                return res.status(409).json({
                    ok: false,
                    code: "DUPLICATE_CODE",
                    error: "같은 사업부문에 이미 사용 중인 상품 코드입니다."
                });
            }
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
        if (!(await canWriteProductAsync(req.auth, existing))) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 상품은 수정할 수 없습니다."
            });
        }

        const built = buildFromBody(req.body, existing);
        await finalizeProductBuilt(built);
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

        if (built.pd_code) {
            const dupCode = await findDuplicateProductByCode(
                getDb(),
                built.pd_code,
                id,
                built.pd_dept
            );
            if (dupCode) {
                return res.status(409).json({
                    ok: false,
                    code: "DUPLICATE_CODE",
                    error: "같은 사업부문에 이미 사용 중인 상품 코드입니다."
                });
            }
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
        if (!(await canWriteProductAsync(req.auth, existing))) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 상품은 삭제할 수 없습니다."
            });
        }
        const db = getDb();
        const result = await db.collection("products").deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ ok: false, error: "상품을 찾을 수 없습니다." });
        }
        try {
            await db.collection("product_info").deleteOne({ [PRODUCT_INFO_F.productId]: req.params.id });
        } catch (delInfoErr) {
            console.warn("DELETE product_info", delInfoErr.message);
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/products/:id", e);
        res.status(500).json({ ok: false, error: "상품 삭제에 실패했습니다." });
    }
});

module.exports = router;
