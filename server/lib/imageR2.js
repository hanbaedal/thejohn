/**
 * 상품·회사소개 이미지 — JPEG 고정 후 R2 업로드
 */
const r2 = require("./r2Storage");
const {
    jpegBufferFromThumbDataUrl,
    thumbJpegBufferFromDataUrl,
    fullCoverJpegBufferFromDataUrl,
    companyIntroJpegBufferFromDataUrl,
    makeProductThumbDataUrl
} = require("./image540");

function productCoverKey(productId, index) {
    return "products/" + String(productId || "").trim() + "/cover-" + String(index || 0) + ".jpg";
}

function productThumbKey(productId, index) {
    return "products/" + String(productId || "").trim() + "/thumb-" + String(index || 0) + ".jpg";
}

function staffIntroKey(staffId, index) {
    return "staff/" + String(staffId || "").trim() + "/intro-" + String(index || 0) + ".jpg";
}

async function bufferFromDataUrl(dataUrl, kind) {
    const raw = String(dataUrl || "").trim();
    if (!raw) return null;
    if (kind === "thumb") {
        const quick = jpegBufferFromThumbDataUrl(raw);
        if (quick) return quick;
        return thumbJpegBufferFromDataUrl(raw);
    }
    if (kind === "cover") {
        const quick = jpegBufferFromThumbDataUrl(raw);
        if (quick) return quick;
        return fullCoverJpegBufferFromDataUrl(raw);
    }
    if (kind === "intro") {
        return companyIntroJpegBufferFromDataUrl(raw);
    }
    return null;
}

/** 상품 저장 시 — cover·thumb JPEG를 R2에 올리고 키 배열 반환 */
async function uploadProductImagesToR2(productId, built) {
    if (!r2.isR2Enabled() || !productId || !built) {
        return { covers: [], thumbs: [], thumb0: "" };
    }
    const images = Array.isArray(built.pd_images) ? built.pd_images : [];
    const covers = [];
    const thumbs = [];
    for (let i = 0; i < images.length; i++) {
        const coverBuf = await bufferFromDataUrl(images[i], "cover");
        const coverK = productCoverKey(productId, i);
        if (coverBuf && (await r2.putJpeg(coverK, coverBuf))) {
            covers[i] = coverK;
        }
        const thumbSrc =
            i === 0 && built.pd_image_thumb
                ? built.pd_image_thumb
                : images[i];
        const thumbBuf = await bufferFromDataUrl(thumbSrc, "thumb");
        const thumbK = productThumbKey(productId, i);
        if (thumbBuf && (await r2.putJpeg(thumbK, thumbBuf))) {
            thumbs[i] = thumbK;
        }
    }
    return {
        covers: covers,
        thumbs: thumbs,
        thumb0: thumbs[0] || ""
    };
}

/** 회사소개 이미지 — staff 저장 시 */
async function uploadStaffIntroToR2(staffId, introImages) {
    if (!r2.isR2Enabled() || !staffId) return [];
    const arr = Array.isArray(introImages) ? introImages : [];
    const keys = [];
    for (let i = 0; i < arr.length; i++) {
        const buf = await bufferFromDataUrl(arr[i], "intro");
        const k = staffIntroKey(staffId, i);
        if (buf && (await r2.putJpeg(k, buf))) {
            keys.push(k);
        }
    }
    return keys;
}

/** HTTP — R2 공개 URL이 있으면 302, 없으면 R2에서 읽어 전송 */
async function serveR2Jpeg(res, key, fallbackBufFn) {
    const k = String(key || "").trim();
    const pub = r2.publicUrl(k);
    if (pub) {
        res.set("Cache-Control", r2.CACHE_CONTROL);
        return res.redirect(302, pub);
    }
    let buf = k ? await r2.getBuffer(k) : null;
    if (!buf && fallbackBufFn) {
        buf = await fallbackBufFn();
    }
    if (!buf) {
        return res.status(404).end();
    }
    res.set("Cache-Control", r2.CACHE_CONTROL);
    return res.type("image/jpeg").send(buf);
}

function readProductR2ThumbKey(doc, imgIdx) {
    if (!doc) return "";
    const idx = imgIdx || 0;
    if (Array.isArray(doc.pd_r2_thumbs) && doc.pd_r2_thumbs[idx]) {
        return String(doc.pd_r2_thumbs[idx]);
    }
    if (idx === 0 && doc.pd_r2_thumb) {
        return String(doc.pd_r2_thumb);
    }
    return "";
}

function readProductR2CoverKey(doc, imgIdx) {
    if (!doc) return "";
    const idx = imgIdx || 0;
    if (Array.isArray(doc.pd_r2_covers) && doc.pd_r2_covers[idx]) {
        return String(doc.pd_r2_covers[idx]);
    }
    return "";
}

function readStaffIntroR2Key(doc, imgIdx) {
    if (!doc || !Array.isArray(doc.st_company_intro_r2)) return "";
    return String(doc.st_company_intro_r2[imgIdx] || "");
}

/** 기존 MongoDB 데이터 — 배치 마이그레이션 */
async function migrateProductDocToR2(doc) {
    if (!r2.isR2Enabled() || !doc || !doc.id) return false;
    const { readImagesFromDoc } = require("./productFields");
    const images = readImagesFromDoc(doc);
    if (!images.length) return false;
    const built = {
        pd_images: images,
        pd_image_thumb: String(doc.pd_image_thumb || "").trim()
    };
    const uploaded = await uploadProductImagesToR2(doc.id, built);
    if (!uploaded.covers.length && !uploaded.thumbs.length) return false;
    const { getDb } = require("../db");
    await getDb()
        .collection("products")
        .updateOne(
            { id: doc.id },
            {
                $set: {
                    pd_r2_covers: uploaded.covers,
                    pd_r2_thumbs: uploaded.thumbs,
                    pd_r2_thumb: uploaded.thumb0 || "",
                    updatedAt: Date.now()
                }
            }
        );
    return true;
}

async function migrateStaffIntroToR2(doc) {
    if (!r2.isR2Enabled() || !doc || !doc.id) return false;
    const images = Array.isArray(doc.st_company_intro_images) ? doc.st_company_intro_images : [];
    if (!images.length) return false;
    const keys = await uploadStaffIntroToR2(doc.id, images);
    if (!keys.length) return false;
    const { getDb } = require("../db");
    await getDb()
        .collection("staff")
        .updateOne(
            { id: doc.id },
            { $set: { st_company_intro_r2: keys, updatedAt: Date.now() } }
        );
    return true;
}

/** 기존 상품 — R2 키 없으면 배치 업로드 */
async function migrateProductsBatchToR2(db, opts) {
    if (!r2.isR2Enabled() || !db) return { products: 0 };
    const limit = Math.max(1, Math.min(50, Number(opts && opts.limit) || 20));
    const { readImagesFromDoc } = require("./productFields");
    const col = db.collection("products");
    const cursor = col
        .find({
            $and: [
                {
                    $or: [
                        { "pd_images.0": { $exists: true, $ne: "" } },
                        { pd_image: { $regex: "^data:image/", $options: "i" } }
                    ]
                },
                {
                    $or: [
                        { pd_r2_thumb: { $exists: false } },
                        { pd_r2_thumb: "" },
                        { pd_r2_thumb: null }
                    ]
                }
            ]
        })
        .project({
            id: 1,
            pd_image: 1,
            pd_images: 1,
            image: 1,
            images: 1,
            pd_image_thumb: 1
        })
        .limit(limit);
    let count = 0;
    const docs = await cursor.toArray();
    for (let i = 0; i < docs.length; i++) {
        if (!readImagesFromDoc(docs[i]).length) continue;
        if (await migrateProductDocToR2(docs[i])) count++;
    }
    return { products: count };
}

/** 기존 staff 회사소개 — R2 키 없으면 배치 업로드 */
async function migrateStaffIntroBatchToR2(db, opts) {
    if (!r2.isR2Enabled() || !db) return { staff: 0 };
    const limit = Math.max(1, Math.min(20, Number(opts && opts.limit) || 5));
    const col = db.collection("staff");
    const docs = await col
        .find({
            "st_company_intro_images.0": { $exists: true, $ne: "" },
            $or: [
                { st_company_intro_r2: { $exists: false } },
                { st_company_intro_r2: { $size: 0 } },
                { st_company_intro_r2: null }
            ]
        })
        .project({ id: 1, st_company_intro_images: 1 })
        .limit(limit)
        .toArray();
    let count = 0;
    for (let i = 0; i < docs.length; i++) {
        if (await migrateStaffIntroToR2(docs[i])) count++;
    }
    return { staff: count };
}

/** 서버 기동 시 — MongoDB 이미지를 R2로 점진 이전 */
async function backfillImagesToR2(db, opts) {
    if (!r2.isR2Enabled() || !db) return { products: 0, staff: 0 };
    opts = opts || {};
    const productBatch = Math.max(5, Math.min(40, Number(opts.productBatch) || 15));
    const staffBatch = Math.max(1, Math.min(10, Number(opts.staffBatch) || 3));
    const maxRounds = Math.max(1, Math.min(20, Number(opts.maxRounds) || 8));
    let products = 0;
    let staff = 0;
    for (let r = 0; r < maxRounds; r++) {
        const pr = await migrateProductsBatchToR2(db, { limit: productBatch });
        products += pr.products;
        const sr = await migrateStaffIntroBatchToR2(db, { limit: staffBatch });
        staff += sr.staff;
        if (!pr.products && !sr.staff) break;
    }
    return { products: products, staff: staff };
}

function imageCdnBaseUrl() {
    const c = r2.getConfig();
    return c && c.publicBase ? c.publicBase : "";
}

module.exports = {
    productCoverKey,
    productThumbKey,
    staffIntroKey,
    uploadProductImagesToR2,
    uploadStaffIntroToR2,
    serveR2Jpeg,
    readProductR2ThumbKey,
    readProductR2CoverKey,
    readStaffIntroR2Key,
    migrateProductDocToR2,
    migrateStaffIntroToR2,
    migrateProductsBatchToR2,
    migrateStaffIntroBatchToR2,
    backfillImagesToR2,
    imageCdnBaseUrl,
    publicImageUrl: r2.publicUrl
};
