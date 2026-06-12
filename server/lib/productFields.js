const {
    normalizeDeptForStorage,
    readDeptFromDoc
} = require("./productDept");
const { registeredByInFilter } = require("./staffLoginId");

/** products 컬렉션 필드명 (Atlas 레코드 키) */
const F = {
    name: "pd_name",
    code: "pd_code",
    price1: "pd_price1",
    price2: "pd_price2",
    price3: "pd_price3",
    price4: "pd_price4",
    size: "pd_size",
    image: "pd_image",
    images: "pd_images",
    explain: "pd_explain",
    dept: "pd_dept",
    group: "pd_group",
    personName: "per_name",
    personPhone: "per-number",
    personEmail: "per-email",
    recordType: "pd_record_type",
    registeredBy: "pd_registered_by",
    registeredByName: "pd_registered_by_name",
    registeredAt: "pd_registered_at"
};

const RECORD_CATALOG = "catalog";
const RECORD_NEW = "new";

function normalizeRecordType(v) {
    return String(v || "")
        .trim()
        .toLowerCase() === RECORD_NEW
        ? RECORD_NEW
        : RECORD_CATALOG;
}

const PRICE_KEYS = ["pd_price1", "pd_price2", "pd_price3", "pd_price4"];
const MAX_PRODUCT_EXPLAIN_LEN = 256;

function str(v) {
    return jsonSafeStr(v).trim();
}

function toNum(v) {
    if (v == null) return 0;
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "object" && typeof v.toNumber === "function") {
        const n = v.toNumber();
        return isFinite(n) ? n : 0;
    }
    const n = Number(v);
    return isFinite(n) ? n : 0;
}

/** JSON 응답 직렬화 오류 방지(깨진 surrogate 등) */
function jsonSafeStr(v) {
    return String(v ?? "")
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")
        .replace(/\u0000/g, "");
}

const PRODUCT_CODE_MAX_LEN = 16;
const MAX_PRODUCT_IMAGES = 5;

function normalizeProductCode(v) {
    return str(v).slice(0, PRODUCT_CODE_MAX_LEN);
}

function parsePrice(v) {
    if (v === "" || v === null || v === undefined) return 0;
    const n = parseInt(v, 10);
    return isFinite(n) && n >= 0 ? n : NaN;
}

function readPricesFromDoc(doc) {
    const d = doc || {};
    let p1 = d[F.price1];
    let p2 = d[F.price2];
    let p3 = d[F.price3];
    let p4 = d[F.price4];
    if (p1 == null && d.pd_price != null) p1 = d.pd_price;
    if (p1 == null && d.price != null) p1 = d.price;
    return {
        pd_price1: Number(p1) || 0,
        pd_price2: Number(p2) || 0,
        pd_price3: Number(p3) || 0,
        pd_price4: Number(p4) || 0
    };
}

/** 예전 title/content/spec/price/image → 신규 필드 */
function fromLegacyDoc(doc) {
    if (!doc) return null;
    const d = Object.assign({}, doc);
    if (!d[F.name] && doc.title) d[F.name] = String(doc.title).trim();
    if (!d[F.code] && doc.pd_code) d[F.code] = normalizeProductCode(doc.pd_code);
    if (!d[F.explain] && doc.content) d[F.explain] = String(doc.content).trim();
    if (!d[F.size] && doc.spec) d[F.size] = String(doc.spec).trim();
    const prices = readPricesFromDoc(doc);
    d[F.price1] = prices.pd_price1;
    d[F.price2] = prices.pd_price2;
    d[F.price3] = prices.pd_price3;
    d[F.price4] = prices.pd_price4;
    if (!d[F.image] && doc.image) d[F.image] = String(doc.image);
    if (!d[F.personName] && doc.per_name) d[F.personName] = String(doc.per_name).trim();
    if (!d[F.personPhone] && doc["per-number"]) d[F.personPhone] = String(doc["per-number"]).trim();
    if (!d[F.personEmail] && doc["per-email"]) d[F.personEmail] = String(doc["per-email"]).trim();
    if (!d[F.recordType] && doc.pd_record_type) d[F.recordType] = normalizeRecordType(doc.pd_record_type);
    if (!d[F.recordType]) d[F.recordType] = RECORD_CATALOG;
    if (!d[F.registeredBy] && doc.pd_registered_by) d[F.registeredBy] = str(doc.pd_registered_by);
    if (!d[F.registeredByName] && doc.pd_registered_by_name) {
        d[F.registeredByName] = str(doc.pd_registered_by_name);
    }
    if (!d[F.registeredAt] && doc.pd_registered_at) d[F.registeredAt] = doc.pd_registered_at;
    const deptNorm = readDeptFromDoc(doc);
    if (deptNorm) d[F.dept] = deptNorm;
    return d;
}

/** 저장·응답용 이미지 URL 배열 (최대 5장, 레거시 pd_image 호환) */
function readImagesFromDoc(doc) {
    const d = fromLegacyDoc(doc) || doc || {};
    let arr = [];
    if (Array.isArray(d[F.images])) arr = d[F.images];
    else if (Array.isArray(d.pd_images)) arr = d.pd_images;
    arr = arr.map((x) => str(x)).filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);
    const legacy = str(d[F.image] || d.pd_image);
    if (!arr.length && legacy) arr = [legacy];
    return arr;
}

function normalizeImagesFromBody(body, existing) {
    body = body && typeof body === "object" ? body : {};
    const prev = fromLegacyDoc(existing) || existing || {};
    let arr = [];
    if (Array.isArray(body.pd_images)) {
        arr = body.pd_images.map((x) => str(x)).filter(Boolean);
    } else if (body.pd_image !== undefined && body.pd_image !== null) {
        const one = str(body.pd_image);
        if (one) arr = [one];
    } else if (body.image !== undefined && body.image !== null) {
        const one = str(body.image);
        if (one) arr = [one];
    } else if (body.pd_images === null || body.pd_image === "") {
        arr = [];
    } else {
        arr = readImagesFromDoc(prev);
    }
    return arr.slice(0, MAX_PRODUCT_IMAGES);
}

function productHasImage(doc) {
    return readImagesFromDoc(doc).length > 0;
}

/** 목록 API용 — products 컬렉션(pd_*, per-*, id) 그대로 매핑, 이미지 본문은 제외 */
function toPublicListItem(doc, opts) {
    opts = opts || {};
    const fullExplain = !!opts.fullExplain;
    const includeCover = !!opts.includeCover;
    if (!doc) return null;
    const d = fromLegacyDoc(doc) || doc;
    const id = ensureProductId(d);
    if (!id) return null;
    const prices = readPricesFromDoc(d);
    const images = readImagesFromDoc(d);
    const countFromDoc = toNum(d.pd_image_count);
    const imageCountVal = countFromDoc > 0 ? countFromDoc : images.length;
    const hasImage =
        d.pd_has_image === true ||
        (d.pd_has_image !== false && (imageCountVal > 0 || images.length > 0));
    const pd_dept = readDeptFromDoc(d) || normalizeDeptForStorage(d[F.dept] || d.pd_dept);
    const row = {
        id: id,
        pd_name: str(d[F.name] || d.pd_name),
        pd_code: normalizeProductCode(d[F.code] || d.pd_code),
        pd_price1: prices.pd_price1,
        pd_price2: prices.pd_price2,
        pd_price3: prices.pd_price3,
        pd_price4: prices.pd_price4,
        pd_size: str(d[F.size] || d.pd_size),
        pd_dept: pd_dept,
        pd_explain: fullExplain
            ? str(d[F.explain] || d.pd_explain)
            : str(d[F.explain] || d.pd_explain).slice(0, 120),
        pd_has_image: hasImage,
        pd_image_count: imageCountVal > 0 ? imageCountVal : images.length,
        pd_record_type: normalizeRecordType(d[F.recordType] || d.pd_record_type),
        pd_registered_by: str(d[F.registeredBy] || d.pd_registered_by),
        pd_registered_by_name: str(d[F.registeredByName] || d.pd_registered_by_name),
        pd_registered_at: toNum(d[F.registeredAt] || d.pd_registered_at),
        per_name: str(d[F.personName] || d.per_name),
        "per-number": str(d[F.personPhone] || d["per-number"]),
        "per-email": str(d[F.personEmail] || d["per-email"]),
        createdAt: toNum(d.createdAt),
        updatedAt: toNum(d.updatedAt)
    };
    if (includeCover && hasImage) {
        const cover = String(images[0] || "").trim();
        if (cover && cover.length <= 600000) {
            row.pd_image = cover;
        }
    }
    try {
        attachProductCdnField(row, d);
    } catch (r2Err) {
        /* R2 미설정 */
    }
    if (opts.includeThumb) {
        const thumb = str(d.pd_image_thumb);
        if (thumb && thumb.length <= 32000) {
            row.pd_thumb = thumb;
        }
    }
    return row;
}

/** 상품 담당자 비어 있을 때 등록 관리자(staff) 연락처로 보강 */
function applyStaffContactFallback(item, staffDoc) {
    if (!item) return item;
    const out = Object.assign({}, item);
    if (!staffDoc) return out;
    const d = staffDoc;
    const ceo = str(d.st_ceo || d.name || d.ceo);
    const ceoTel = str(d.st_ceo_tel || d.ceoPhone);
    const phone = str(d.st_phone || d.phone);
    const email = str(d.st_email || d.email);
    if (!str(out.per_name)) {
        out.per_name = ceo || str(out.pd_registered_by_name);
    }
    if (!str(out["per-number"])) {
        out["per-number"] = ceoTel || phone;
    }
    if (!str(out["per-email"])) {
        out["per-email"] = email;
    }
    return out;
}

function toPublic(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    const prices = readPricesFromDoc(d);
    const images = readImagesFromDoc(d);
    return {
        id: d.id,
        pd_name: str(d[F.name]),
        pd_code: normalizeProductCode(d[F.code]),
        pd_price1: prices.pd_price1,
        pd_price2: prices.pd_price2,
        pd_price3: prices.pd_price3,
        pd_price4: prices.pd_price4,
        pd_size: str(d[F.size]),
        pd_images: images,
        pd_image: images[0] || "",
        pd_has_image: images.length > 0,
        pd_image_count: images.length,
        pd_thumb: (() => {
            const thumb = str(d.pd_image_thumb);
            return thumb && thumb.length <= 32000 ? thumb : "";
        })(),
        pd_explain: str(d[F.explain]),
        pd_dept: normalizeDeptForStorage(d[F.dept]) || str(d[F.dept]),
        pd_group: str(d[F.group]),
        per_name: str(d[F.personName]),
        "per-number": str(d[F.personPhone]),
        "per-email": str(d[F.personEmail]),
        pd_record_type: normalizeRecordType(d[F.recordType]),
        pd_registered_by: str(d[F.registeredBy]),
        pd_registered_by_name: str(d[F.registeredByName]),
        pd_registered_at: d[F.registeredAt] || 0,
        updatedAt: d.updatedAt || 0
    };
}

function parsePricesFromBody(body, existing) {
    const prev = fromLegacyDoc(existing) || {};
    const prevP = readPricesFromDoc(prev);

    function one(key, legacyKey) {
        if (body[key] != null && body[key] !== "") return parsePrice(body[key]);
        if (legacyKey && body[legacyKey] != null) return parsePrice(body[legacyKey]);
        return parsePrice(prevP[key]);
    }

    return {
        pd_price1: one("pd_price1", "pd_price"),
        pd_price2: one("pd_price2", null),
        pd_price3: one("pd_price3", null),
        pd_price4: one("pd_price4", null)
    };
}

function buildFromBody(body, existing) {
    const prev = fromLegacyDoc(existing) || {};
    const prices = parsePricesFromBody(body, existing);
    const pd_name = str(body.pd_name != null ? body.pd_name : body.title);
    const pd_code = normalizeProductCode(
        body.pd_code != null ? body.pd_code : prev[F.code] != null ? prev[F.code] : ""
    );
    const pd_explain = str(body.pd_explain != null ? body.pd_explain : body.content).slice(
        0,
        MAX_PRODUCT_EXPLAIN_LEN
    );
    const pd_size = str(body.pd_size != null ? body.pd_size : body.spec);
    const pd_images = normalizeImagesFromBody(body, existing);
    const pd_image = pd_images[0] || "";

    const per_name = str(body.per_name != null ? body.per_name : prev[F.personName]);
    const perNumber = str(
        body["per-number"] != null ? body["per-number"] : prev[F.personPhone]
    );
    const perEmail = str(body["per-email"] != null ? body["per-email"] : prev[F.personEmail]);
    const pd_dept = normalizeDeptForStorage(
        body.pd_dept != null
            ? body.pd_dept
            : prev[F.dept] != null
              ? prev[F.dept]
              : readDeptFromDoc(existing)
    );
    const pd_group = str(
        body.pd_group != null ? body.pd_group : prev[F.group] != null ? prev[F.group] : ""
    ).toLowerCase();

    return {
        pd_name,
        pd_code,
        pd_explain,
        pd_size,
        pd_dept,
        pd_group,
        pd_images,
        pd_image,
        per_name,
        perNumber,
        perEmail,
        pd_record_type:
            body.pd_record_type != null
                ? normalizeRecordType(body.pd_record_type)
                : normalizeRecordType(prev[F.recordType]),
        ...prices
    };
}

/** 저장 직전 — 상품 사진 540×540 + 목록용 썸네일 + (R2) JPEG 업로드 */
async function finalizeProductBuilt(built, productId) {
    if (!built) return built;
    const { normalizeProductImages540, makeProductThumbDataUrl } = require("./image540");
    const imgs = await normalizeProductImages540(built.pd_images);
    built.pd_images = imgs;
    built.pd_image = imgs[0] || "";
    built.pd_image_thumb = built.pd_image ? await makeProductThumbDataUrl(built.pd_image) : "";
    const pid = String(productId || built.id || "").trim();
    if (pid && imgs.length) {
        const { uploadProductImagesToR2 } = require("./imageR2");
        const r2 = await uploadProductImagesToR2(pid, built);
        built.pd_r2_covers = r2.covers;
        built.pd_r2_thumbs = r2.thumbs;
        built.pd_r2_thumb = r2.thumb0 || "";
    }
    return built;
}

function toDbDoc(id, built, existing) {
    const doc = {
        id,
        [F.name]: built.pd_name,
        [F.code]: built.pd_code,
        [F.price1]: built.pd_price1,
        [F.price2]: built.pd_price2,
        [F.price3]: built.pd_price3,
        [F.price4]: built.pd_price4,
        [F.size]: built.pd_size,
        [F.image]: built.pd_image,
        [F.images]: built.pd_images,
        pd_image_thumb: built.pd_image_thumb || "",
        pd_r2_covers: Array.isArray(built.pd_r2_covers) ? built.pd_r2_covers : [],
        pd_r2_thumbs: Array.isArray(built.pd_r2_thumbs) ? built.pd_r2_thumbs : [],
        pd_r2_thumb: String(built.pd_r2_thumb || ""),
        [F.explain]: built.pd_explain,
        [F.dept]: built.pd_dept,
        [F.group]: built.pd_group,
        [F.personName]: built.per_name,
        [F.personPhone]: built.perNumber,
        [F.personEmail]: built.perEmail,
        [F.recordType]: built.pd_record_type,
        pd_has_image: built.pd_images.length > 0,
        updatedAt: Date.now()
    };
    if (existing && existing.createdAt) doc.createdAt = existing.createdAt;
    else if (!existing) doc.createdAt = Date.now();
    if (existing && existing[F.registeredBy]) {
        doc[F.registeredBy] = existing[F.registeredBy];
        doc[F.registeredByName] = existing[F.registeredByName] || "";
        if (existing[F.registeredAt]) doc[F.registeredAt] = existing[F.registeredAt];
    }
    return doc;
}

/** 같은 사업부문 내 동일 명칭(앞뒤 공백 제거 후 대소문자 무시) 상품 조회 */
async function findDuplicateProductByName(db, name, excludeId, dept, registeredBy) {
    const n = str(name);
    const deptNorm = str(dept);
    if (!n || !deptNorm) return null;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRe = new RegExp("^" + esc + "$", "i");
    const filter = {
        [F.dept]: deptNorm,
        $or: [{ [F.name]: nameRe }, { title: nameRe }]
    };
    if (registeredBy) {
        filter[F.registeredBy] = registeredByInFilter(registeredBy);
    }
    if (excludeId) filter.id = { $ne: String(excludeId) };
    return db.collection("products").findOne(filter);
}

/** 같은 사업부문 내 동일 상품 코드(대소문자 무시, 16자 정규화) */
async function findDuplicateProductByCode(db, code, excludeId, dept) {
    const c = normalizeProductCode(code);
    const deptNorm = str(dept);
    if (!c || !deptNorm) return null;
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const codeRe = new RegExp("^" + esc + "$", "i");
    const filter = {
        [F.dept]: deptNorm,
        $or: [{ [F.code]: codeRe }, { pd_code: codeRe }]
    };
    if (excludeId) filter.id = { $ne: String(excludeId) };
    return db.collection("products").findOne(filter);
}

function validateBuilt(built, requireImage) {
    if (built.pd_code && built.pd_code.length > PRODUCT_CODE_MAX_LEN) {
        return "상품 코드는 16자 이내로 입력해 주세요.";
    }
    if (!built.pd_name) return "상품 명칭을 입력해 주세요.";
    if (!built.pd_explain) return "상품 설명을 입력해 주세요.";
    if (built.pd_explain.length > MAX_PRODUCT_EXPLAIN_LEN) {
        return "상품 설명은 한글 기준 256자 이내로 입력해 주세요.";
    }
    const prices = [built.pd_price1, built.pd_price2, built.pd_price3, built.pd_price4];
    if (prices.some((p) => !isFinite(p))) return "가격 1~4를 올바르게 입력해 주세요.";
    if (!built.pd_dept) return "사업부문을 선택해 주세요.";
    if (requireImage && !built.pd_images.length) {
        return "신규 등록 시 상품 사진을 1장 이상 선택해 주세요.";
    }
    if (built.pd_images.length > MAX_PRODUCT_IMAGES) {
        return "상품 사진은 최대 " + MAX_PRODUCT_IMAGES + "장까지 등록할 수 있습니다.";
    }
    return "";
}

function ensureProductId(doc) {
    if (doc.id && str(doc.id)) return str(doc.id);
    if (doc._id) return "pr_" + String(doc._id);
    return "pr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/** 목록·상세 — R2 CDN thumb URL (관리자 JWT 없이 img.thejohn.co.kr 직링크) */
function attachProductCdnField(item, doc) {
    if (!item || !doc) return item;
    const { readProductR2ThumbKey, publicImageUrl, imageCdnBaseUrl } = require("./imageR2");
    const r2Key = readProductR2ThumbKey(doc, 0);
    if (r2Key) {
        const cdn = publicImageUrl(r2Key);
        if (cdn) item.pd_image_cdn = cdn;
        return item;
    }
    const base = imageCdnBaseUrl();
    const pid = str(doc.id);
    if (base && pid && item.pd_has_image !== false) {
        item.pd_image_cdn = base + "/products/" + encodeURIComponent(pid) + "/thumb-0.jpg";
    }
    return item;
}

/** 목록 API — 사진·설명 본문 제외(대용량 base64 $strLenCP 방지) */
async function findProductsForList(db, query, opts) {
    opts = opts || {};
    const fullExplain = !!opts.fullExplain;
    const imgKey = F.image;
    const pipeline = [
        { $match: query || {} },
        { $sort: { updatedAt: -1 } },
        {
            $addFields: {
                pd_images_size: { $size: { $ifNull: ["$pd_images", []] } }
            }
        },
        {
            $addFields: {
                pd_has_image: {
                    $cond: [
                        { $eq: ["$pd_has_image", true] },
                        true,
                        {
                            $cond: [
                                { $eq: ["$pd_has_image", false] },
                                false,
                                { $gt: ["$pd_images_size", 0] }
                            ]
                        }
                    ]
                },
                pd_image_count: {
                    $cond: [
                        { $gt: ["$pd_images_size", 0] },
                        "$pd_images_size",
                        {
                            $cond: [{ $eq: ["$pd_has_image", true] }, 1, 0]
                        }
                    ]
                }
            }
        },
        { $project: { pd_images_size: 0 } }
    ];
    const projectExclude = {
        [imgKey]: 0,
        pd_images: 0,
        pd_image: 0,
        images: 0,
        image: 0
    };
    if (!fullExplain) {
        projectExclude[F.explain] = 0;
        projectExclude.pd_explain = 0;
        projectExclude.content = 0;
    }
    if (!opts.includeCover) {
        projectExclude.pd_image_thumb = 0;
        pipeline.push({ $project: projectExclude });
    }
    return db.collection("products").aggregate(pipeline).toArray();
}

/** 레거시 필드명(title/content 등)이 남아 있을 때만 전체 문서 재구성 — 정상 데이터는 건드리지 않음 */
function productNeedsFieldMigration(doc) {
    if (!doc) return false;
    if (!doc.id) return true;
    if (doc.title && !str(doc[F.name])) return true;
    if (doc.content && !str(doc[F.explain])) return true;
    if (doc.spec && !str(doc[F.size])) return true;
    if (doc.image && !readImagesFromDoc(doc).length) return true;
    if (doc.pd_dept && !str(doc[F.dept])) return true;
    if (doc.dept && !str(doc[F.dept]) && !str(doc.pd_dept)) return true;
    return false;
}

async function migrateProductsCollection(db) {
    const col = db.collection("products");
    const docs = await col.find({}).toArray();
    let n = 0;
    let skipped = 0;
    let idFixed = 0;
    let deptFixed = 0;
    let emptyDept = 0;
    for (const doc of docs) {
        const id = ensureProductId(doc);
        if (!doc.id) {
            await col.updateOne({ _id: doc._id }, { $set: { id: id } });
            idFixed++;
        }
        if (!productNeedsFieldMigration(doc)) {
            skipped++;
            continue;
        }
        const rawDept = doc[F.dept] || doc.pd_dept || "";
        const built = buildFromBody(
            {
                pd_name: doc[F.name] || doc.title,
                pd_explain: doc[F.explain] || doc.content,
                pd_size: doc[F.size] || doc.spec,
                pd_dept: readDeptFromDoc(doc) || rawDept,
                pd_price: doc[F.price1] != null ? doc[F.price1] : doc.pd_price,
                pd_price1: doc[F.price1],
                pd_price2: doc[F.price2],
                pd_price3: doc[F.price3],
                pd_price4: doc[F.price4],
                per_name: doc[F.personName] || doc.per_name,
                "per-number": doc[F.personPhone] || doc["per-number"],
                "per-email": doc[F.personEmail] || doc["per-email"],
                pd_record_type: doc[F.recordType] || doc.pd_record_type
            },
            doc
        );
        if (built.pd_dept && built.pd_dept !== String(rawDept).trim().toLowerCase()) {
            deptFixed++;
        }
        if (!built.pd_dept) emptyDept++;
        const next = toDbDoc(id, built, doc);
        const imgs = readImagesFromDoc(doc);
        next[F.images] = imgs;
        next[F.image] = imgs[0] || "";
        next.pd_has_image = imgs.length > 0;
        await col.replaceOne({ id: id }, next, { upsert: true });
        n++;
    }
    const legacy = await col.updateMany(
        {
            $or: [
                { [F.registeredBy]: { $exists: false } },
                { [F.registeredBy]: "" },
                { [F.registeredBy]: null }
            ]
        },
        {
            $set: {
                [F.registeredBy]: "legacy",
                [F.registeredByName]: "기존(담당 미지정)"
            }
        }
    );
    const report = {
        collection: "products",
        processed: n,
        skipped: skipped,
        idFixed: idFixed,
        deptNormalized: deptFixed,
        emptyDeptAfter: emptyDept,
        legacyRegisteredBy: legacy.modifiedCount || 0
    };
    if (n) console.log("[products] migrated:", report);
    return report;
}

module.exports = {
    F,
    PRODUCT_CODE_MAX_LEN,
    normalizeProductCode,
    PRICE_KEYS,
    toPublic,
    toPublicListItem,
    productHasImage,
    readImagesFromDoc,
    normalizeImagesFromBody,
    MAX_PRODUCT_IMAGES,
    buildFromBody,
    finalizeProductBuilt,
    toDbDoc,
    validateBuilt,
    findDuplicateProductByName,
    findDuplicateProductByCode,
    migrateProductsCollection,
    findProductsForList,
    fromLegacyDoc,
    readPricesFromDoc,
    applyStaffContactFallback,
    attachProductCdnField
};
