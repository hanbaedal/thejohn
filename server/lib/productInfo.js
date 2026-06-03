/**
 * product_info 컬렉션 — 식품 표시사항 등 고정 항목별 입력값
 */
const { canWriteProductAsync } = require("./productAccess");

const COL = "product_info";

const F = {
    productId: "product_id",
    productName: "pi_product_name",
    foodType: "pi_food_type",
    producer: "pi_producer",
    manufactureDate: "pi_manufacture_date",
    expirationDate: "pi_expiration_date",
    storageMethod: "pi_storage_method",
    netWeight: "pi_net_weight",
    ingredients: "pi_ingredients",
    customerCenter: "pi_customer_center",
    notes: "pi_notes"
};

/** 화면·문서용 고정 제목 (순서 유지) */
const FIELD_DEFS = [
    { key: "productName", label: "제품명", field: F.productName, multiline: false, max: 200 },
    { key: "foodType", label: "식품유형", field: F.foodType, multiline: false, max: 120 },
    { key: "producer", label: "생산자", field: F.producer, multiline: false, max: 200 },
    { key: "manufactureDate", label: "제조월일", field: F.manufactureDate, multiline: false, max: 120 },
    { key: "expirationDate", label: "소비기한", field: F.expirationDate, multiline: false, max: 200 },
    { key: "storageMethod", label: "보관방법", field: F.storageMethod, multiline: false, max: 200 },
    { key: "netWeight", label: "내용량", field: F.netWeight, multiline: false, max: 80 },
    {
        key: "ingredients",
        label: "원재료명 및 함량",
        field: F.ingredients,
        multiline: true,
        max: 8000
    },
    { key: "customerCenter", label: "고객센터", field: F.customerCenter, multiline: false, max: 80 },
    { key: "notes", label: "확인사항", field: F.notes, multiline: true, max: 4000 }
];

function str(v) {
    return String(v ?? "")
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD")
        .replace(/\u0000/g, "")
        .trim();
}

function newId() {
    return "pif_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function emptyValues() {
    const o = {};
    FIELD_DEFS.forEach(function (def) {
        o[def.key] = "";
    });
    return o;
}

function buildFromBody(body) {
    body = body && typeof body === "object" ? body : {};
    const values = emptyValues();
    FIELD_DEFS.forEach(function (def) {
        if (body[def.key] != null) values[def.key] = str(body[def.key]).slice(0, def.max);
    });
    return values;
}

function valuesToDb(values) {
    const doc = {};
    FIELD_DEFS.forEach(function (def) {
        doc[def.field] = values[def.key] != null ? str(values[def.key]).slice(0, def.max) : "";
    });
    return doc;
}

function valuesFromDoc(doc) {
    doc = doc || {};
    const values = emptyValues();
    FIELD_DEFS.forEach(function (def) {
        values[def.key] = str(doc[def.field]);
    });
    return values;
}

function toPublic(doc) {
    if (!doc) return null;
    return {
        id: doc.id,
        productId: doc[F.productId],
        values: valuesFromDoc(doc),
        updatedAt: doc.updatedAt || doc.createdAt || null
    };
}

async function ensureIndexes(db) {
    await db.collection(COL).createIndex({ [F.productId]: 1 }, { unique: true });
}

async function findByProductId(db, productId) {
    return db.collection(COL).findOne({ [F.productId]: String(productId || "").trim() });
}

async function assertCanWriteProduct(auth, productDoc) {
    if (!(await canWriteProductAsync(auth, productDoc))) {
        const err = new Error("이 상품에 대한 상품정보를 수정할 권한이 없습니다.");
        err.status = 403;
        throw err;
    }
}

async function upsertForProduct(db, auth, productId, body) {
    const pid = String(productId || "").trim();
    if (!pid) {
        const err = new Error("상품 ID가 없습니다.");
        err.status = 400;
        throw err;
    }
    const product = await db.collection("products").findOne({ id: pid });
    if (!product) {
        const err = new Error("상품을 찾을 수 없습니다.");
        err.status = 404;
        throw err;
    }
    await assertCanWriteProduct(auth, product);

    const values = buildFromBody(body);
    const now = Date.now();
    const existing = await findByProductId(db, pid);
    const dataFields = valuesToDb(values);
    dataFields[F.productId] = pid;
    dataFields.updatedAt = now;

    if (existing) {
        await db.collection(COL).updateOne({ id: existing.id }, { $set: dataFields });
        const updated = await findByProductId(db, pid);
        return toPublic(updated);
    }

    const doc = Object.assign(
        {
            id: newId(),
            createdAt: now,
            createdBy: auth.userId || ""
        },
        dataFields
    );
    await db.collection(COL).insertOne(doc);
    return toPublic(doc);
}

async function removeForProduct(db, auth, productId) {
    const pid = String(productId || "").trim();
    const product = await db.collection("products").findOne({ id: pid });
    if (!product) {
        const err = new Error("상품을 찾을 수 없습니다.");
        err.status = 404;
        throw err;
    }
    await assertCanWriteProduct(auth, product);
    await db.collection(COL).deleteOne({ [F.productId]: pid });
    return { ok: true };
}

module.exports = {
    COL,
    F,
    FIELD_DEFS,
    emptyValues,
    buildFromBody,
    toPublic,
    ensureIndexes,
    findByProductId,
    upsertForProduct,
    removeForProduct,
    assertCanWriteProduct
};
