const {
    normalizeDeptForStorage,
    readDeptFromDoc
} = require("./productDept");

/** products 컬렉션 필드명 (Atlas 레코드 키) */
const F = {
    name: "pd_name",
    price1: "pd_price1",
    price2: "pd_price2",
    price3: "pd_price3",
    price4: "pd_price4",
    size: "pd_size",
    image: "pd_image",
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

function str(v) {
    return String(v ?? "").trim();
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

function productHasImage(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return false;
    return !!str(d[F.image]);
}

/** 목록 API용 — products 컬렉션(pd_*, per-*, id) 그대로 매핑, 이미지 본문은 제외 */
function toPublicListItem(doc) {
    if (!doc) return null;
    const d = fromLegacyDoc(doc) || doc;
    const id = ensureProductId(d);
    if (!id) return null;
    const prices = readPricesFromDoc(d);
    const hasImage =
        d.pd_has_image === true ||
        (d.pd_has_image !== false && !!str(d[F.image] || d.pd_image));
    const pd_dept = readDeptFromDoc(d) || normalizeDeptForStorage(d[F.dept] || d.pd_dept);
    return {
        id: id,
        pd_name: str(d[F.name] || d.pd_name),
        pd_price1: prices.pd_price1,
        pd_price2: prices.pd_price2,
        pd_price3: prices.pd_price3,
        pd_price4: prices.pd_price4,
        pd_size: str(d[F.size] || d.pd_size),
        pd_dept: pd_dept,
        pd_explain: str(d[F.explain] || d.pd_explain).slice(0, 120),
        pd_has_image: hasImage,
        pd_record_type: normalizeRecordType(d[F.recordType] || d.pd_record_type),
        pd_registered_by: str(d[F.registeredBy] || d.pd_registered_by),
        pd_registered_by_name: str(d[F.registeredByName] || d.pd_registered_by_name),
        pd_registered_at: d[F.registeredAt] || d.pd_registered_at || 0,
        createdAt: d.createdAt || 0,
        updatedAt: d.updatedAt || 0
    };
}

function toPublic(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    const prices = readPricesFromDoc(d);
    return {
        id: d.id,
        pd_name: str(d[F.name]),
        pd_price1: prices.pd_price1,
        pd_price2: prices.pd_price2,
        pd_price3: prices.pd_price3,
        pd_price4: prices.pd_price4,
        pd_size: str(d[F.size]),
        pd_image: String(d[F.image] || ""),
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
    const pd_explain = str(body.pd_explain != null ? body.pd_explain : body.content);
    const pd_size = str(body.pd_size != null ? body.pd_size : body.spec);
    let pd_image =
        body.pd_image !== undefined && body.pd_image !== null
            ? String(body.pd_image)
            : body.image !== undefined && body.image !== null
              ? String(body.image)
              : String(prev[F.image] || "");

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
        pd_explain,
        pd_size,
        pd_dept,
        pd_group,
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

function toDbDoc(id, built, existing) {
    const doc = {
        id,
        [F.name]: built.pd_name,
        [F.price1]: built.pd_price1,
        [F.price2]: built.pd_price2,
        [F.price3]: built.pd_price3,
        [F.price4]: built.pd_price4,
        [F.size]: built.pd_size,
        [F.image]: built.pd_image,
        [F.explain]: built.pd_explain,
        [F.dept]: built.pd_dept,
        [F.group]: built.pd_group,
        [F.personName]: built.per_name,
        [F.personPhone]: built.perNumber,
        [F.personEmail]: built.perEmail,
        [F.recordType]: built.pd_record_type,
        pd_has_image: !!str(built.pd_image),
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
        filter[F.registeredBy] = String(registeredBy || "")
            .trim()
            .toLowerCase();
    }
    if (excludeId) filter.id = { $ne: String(excludeId) };
    return db.collection("products").findOne(filter);
}

function validateBuilt(built, requireImage) {
    if (!built.pd_name) return "상품 명칭을 입력해 주세요.";
    if (!built.pd_explain) return "상품 설명을 입력해 주세요.";
    const prices = [built.pd_price1, built.pd_price2, built.pd_price3, built.pd_price4];
    if (prices.some((p) => !isFinite(p))) return "가격 1~4를 올바르게 입력해 주세요.";
    if (!built.pd_dept) return "사업부문을 선택해 주세요.";
    if (requireImage && !built.pd_image) return "신규 등록 시 상품 사진이 필요합니다.";
    return "";
}

function ensureProductId(doc) {
    if (doc.id && str(doc.id)) return str(doc.id);
    if (doc._id) return "pr_" + String(doc._id);
    return "pr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

async function migrateProductsCollection(db) {
    const col = db.collection("products");
    const docs = await col.find({}).toArray();
    let n = 0;
    let idFixed = 0;
    let deptFixed = 0;
    let emptyDept = 0;
    for (const doc of docs) {
        const id = ensureProductId(doc);
        if (!doc.id) idFixed++;
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
                pd_image: doc[F.image] || doc.image,
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
        if (!doc.id) {
            await col.updateOne({ _id: doc._id }, { $set: { id: id } });
        }
        const next = toDbDoc(id, built, doc);
        const img = str(next[F.image]);
        next.pd_has_image = !!img;
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
    PRICE_KEYS,
    toPublic,
    toPublicListItem,
    productHasImage,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    findDuplicateProductByName,
    migrateProductsCollection,
    fromLegacyDoc,
    readPricesFromDoc
};
