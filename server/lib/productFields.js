/** products 컬렉션 필드명 (Atlas 레코드 키) */
const F = {
    name: "pd_name",
    price: "pd_price",
    size: "pd_size",
    image: "pd_image",
    explain: "pd_explain",
    personName: "per_name",
    personPhone: "per-number",
    personEmail: "per-email"
};

function str(v) {
    return String(v ?? "").trim();
}

function parsePrice(v) {
    const n = parseInt(v, 10);
    return isFinite(n) && n >= 0 ? n : NaN;
}

/** 예전 title/content/spec/price/image → 신규 필드 */
function fromLegacyDoc(doc) {
    if (!doc) return null;
    const d = Object.assign({}, doc);
    if (!d[F.name] && doc.title) d[F.name] = String(doc.title).trim();
    if (!d[F.explain] && doc.content) d[F.explain] = String(doc.content).trim();
    if (!d[F.size] && doc.spec) d[F.size] = String(doc.spec).trim();
    if (d[F.price] == null && doc.price != null) d[F.price] = parsePrice(doc.price);
    if (!d[F.image] && doc.image) d[F.image] = String(doc.image);
    if (!d[F.personName] && doc.per_name) d[F.personName] = String(doc.per_name).trim();
    if (!d[F.personPhone] && doc["per-number"]) d[F.personPhone] = String(doc["per-number"]).trim();
    if (!d[F.personEmail] && doc["per-email"]) d[F.personEmail] = String(doc["per-email"]).trim();
    return d;
}

function toPublic(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    return {
        id: d.id,
        pd_name: str(d[F.name]),
        pd_price: Number(d[F.price]) || 0,
        pd_size: str(d[F.size]),
        pd_image: String(d[F.image] || ""),
        pd_explain: str(d[F.explain]),
        per_name: str(d[F.personName]),
        "per-number": str(d[F.personPhone]),
        "per-email": str(d[F.personEmail]),
        updatedAt: d.updatedAt || 0
    };
}

function buildFromBody(body, existing) {
    const prev = fromLegacyDoc(existing) || {};
    const pd_name = str(body.pd_name != null ? body.pd_name : body.title);
    const pd_explain = str(body.pd_explain != null ? body.pd_explain : body.content);
    const pd_size = str(body.pd_size != null ? body.pd_size : body.spec);
    const pd_price =
        body.pd_price != null || body.price != null
            ? parsePrice(body.pd_price != null ? body.pd_price : body.price)
            : parsePrice(prev[F.price]);
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
        pd_price,
        pd_image,
        per_name,
        perNumber,
        perEmail
    };
}

function toDbDoc(id, built, existing) {
    const doc = {
        id,
        [F.name]: built.pd_name,
        [F.price]: built.pd_price,
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
    if (!isFinite(built.pd_price)) return "상품 가격을 올바르게 입력해 주세요.";
    if (requireImage && !built.pd_image) return "신규 등록 시 상품 사진이 필요합니다.";
    return "";
}

async function migrateProductsCollection(db) {
    const col = db.collection("products");
    const docs = await col.find({}).toArray();
    let n = 0;
    for (const doc of docs) {
        const hasNew = doc[F.name] != null || doc[F.explain] != null;
        const hasOld = doc.title != null || doc.content != null;
        if (hasNew && !hasOld) continue;
        if (!hasOld && !hasNew) continue;

        const built = buildFromBody(
            {
                pd_name: doc[F.name] || doc.title,
                pd_explain: doc[F.explain] || doc.content,
                pd_size: doc[F.size] || doc.spec,
                pd_price: doc[F.price] != null ? doc[F.price] : doc.price,
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
    if (n) console.log("[products] migrated field names:", n);
}

module.exports = {
    F,
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    migrateProductsCollection,
    fromLegacyDoc
};
