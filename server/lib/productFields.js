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
    personName: "per_name",
    personPhone: "per-number",
    personEmail: "per-email"
};

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
    return d;
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
        per_name: str(d[F.personName]),
        "per-number": str(d[F.personPhone]),
        "per-email": str(d[F.personEmail]),
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

    return {
        pd_name,
        pd_explain,
        pd_size,
        pd_image,
        per_name,
        perNumber,
        perEmail,
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
        [F.personName]: built.per_name,
        [F.personPhone]: built.perNumber,
        [F.personEmail]: built.perEmail,
        updatedAt: Date.now()
    };
    if (existing && existing.createdAt) doc.createdAt = existing.createdAt;
    else if (!existing) doc.createdAt = Date.now();
    return doc;
}

function validateBuilt(built, requireImage) {
    if (!built.pd_name) return "상품 명칭을 입력해 주세요.";
    if (!built.pd_explain) return "상품 설명을 입력해 주세요.";
    const prices = [built.pd_price1, built.pd_price2, built.pd_price3, built.pd_price4];
    if (prices.some((p) => !isFinite(p))) return "가격 1~4를 올바르게 입력해 주세요.";
    if (!prices.some((p) => p > 0)) return "가격 1~4 중 하나 이상 0원보다 크게 입력해 주세요.";
    if (requireImage && !built.pd_image) return "신규 등록 시 상품 사진이 필요합니다.";
    return "";
}

async function migrateProductsCollection(db) {
    const col = db.collection("products");
    const docs = await col.find({}).toArray();
    let n = 0;
    for (const doc of docs) {
        if (!doc.id) continue;
        const built = buildFromBody(
            {
                pd_name: doc[F.name] || doc.title,
                pd_explain: doc[F.explain] || doc.content,
                pd_size: doc[F.size] || doc.spec,
                pd_price: doc[F.price1] != null ? doc[F.price1] : doc.pd_price,
                pd_price1: doc[F.price1],
                pd_price2: doc[F.price2],
                pd_price3: doc[F.price3],
                pd_price4: doc[F.price4],
                pd_image: doc[F.image] || doc.image,
                per_name: doc[F.personName] || doc.per_name,
                "per-number": doc[F.personPhone] || doc["per-number"],
                "per-email": doc[F.personEmail] || doc["per-email"]
            },
            doc
        );
        const next = toDbDoc(doc.id, built, doc);
        await col.replaceOne({ id: doc.id }, next);
        n++;
    }
    if (n) console.log("[products] migrated (incl. pd_price1~4):", n);
}

module.exports = {
    F,
    PRICE_KEYS,
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    migrateProductsCollection,
    fromLegacyDoc,
    readPricesFromDoc
};
