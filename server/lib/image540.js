const sharp = require("sharp");

const SIZE = 540;
const THUMB_SIZE = 180;
const JPEG_QUALITY = 85;
const THUMB_JPEG_QUALITY = 72;
const MAX_THUMB_DATA_URL_LEN = 32 * 1024;
/** 이미 540 JPEG이고 이 크기 이하면 재인코딩 생략 */
const SKIP_IF_JPEG_BYTES = 120 * 1024;

function parseDataUrl(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
    if (!m) return null;
    try {
        return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2], "base64") };
    } catch (e) {
        return null;
    }
}

function toJpegDataUrl(buf) {
    return "data:image/jpeg;base64," + buf.toString("base64");
}

async function shouldSkipResize(parsed) {
    if (!parsed || parsed.mime !== "image/jpeg") return false;
    if (parsed.buffer.length > SKIP_IF_JPEG_BYTES) return false;
    try {
        const meta = await sharp(parsed.buffer).metadata();
        return meta.width === SIZE && meta.height === SIZE;
    } catch (e) {
        return false;
    }
}

/** 상품 사진 — 540×540 cover (클라이언트와 동일) */
async function resizeSquare540Cover(dataUrl) {
    const raw = String(dataUrl || "").trim();
    if (!raw) return "";
    if (!/^data:image\//i.test(raw)) return raw;

    const parsed = parseDataUrl(raw);
    if (!parsed) return raw;
    if (await shouldSkipResize(parsed)) return raw;

    try {
        const out = await sharp(parsed.buffer)
            .rotate()
            .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
            .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
            .toBuffer();
        return toJpegDataUrl(out);
    } catch (e) {
        console.warn("[image540] product resize skip:", e.message);
        return raw;
    }
}

/** 업체 로고 — 540×540 contain (흰 배경) */
async function resizeSquare540Contain(dataUrl) {
    const raw = String(dataUrl || "").trim();
    if (!raw) return "";
    if (!/^data:image\//i.test(raw)) return raw;

    const parsed = parseDataUrl(raw);
    if (!parsed) return raw;
    if (await shouldSkipResize(parsed)) return raw;

    try {
        const out = await sharp(parsed.buffer)
            .rotate()
            .resize(SIZE, SIZE, {
                fit: "contain",
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
            .toBuffer();
        return toJpegDataUrl(out);
    } catch (e) {
        console.warn("[image540] logo resize skip:", e.message);
        return raw;
    }
}

/** 목록 카드용 180×180 JPEG data URL (~3–8KB) */
async function makeProductThumbDataUrl(dataUrl) {
    const raw = String(dataUrl || "").trim();
    if (!raw || !/^data:image\//i.test(raw)) return "";
    const parsed = parseDataUrl(raw);
    if (!parsed) return "";
    try {
        const out = await sharp(parsed.buffer)
            .rotate()
            .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
            .jpeg({ quality: THUMB_JPEG_QUALITY, mozjpeg: true })
            .toBuffer();
        const url = toJpegDataUrl(out);
        return url.length <= MAX_THUMB_DATA_URL_LEN ? url : "";
    } catch (e) {
        console.warn("[image540] thumb skip:", e.message);
        return "";
    }
}

/** 저장된 썸네일 data URL → JPEG 바이너리(재인코딩 없음) */
function jpegBufferFromThumbDataUrl(dataUrl) {
    const parsed = parseDataUrl(dataUrl);
    return parsed ? parsed.buffer : null;
}

/** 상세보기용 원본(540) JPEG 바이너리 */
async function fullCoverJpegBufferFromDataUrl(dataUrl) {
    const raw = String(dataUrl || "").trim();
    if (!raw) return null;
    if (!/^data:image\//i.test(raw)) return null;
    const parsed = parseDataUrl(raw);
    if (!parsed) return null;
    try {
        return await sharp(parsed.buffer)
            .rotate()
            .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
            .toBuffer();
    } catch (e) {
        console.warn("[image540] full cover skip:", e.message);
        return null;
    }
}

/** HTTP 썸네일 응답용 JPEG 바이너리 */
async function thumbJpegBufferFromDataUrl(dataUrl) {
    const raw = String(dataUrl || "").trim();
    if (!raw) return null;
    if (!/^data:image\//i.test(raw)) return null;
    const parsed = parseDataUrl(raw);
    if (!parsed) return null;
    try {
        return await sharp(parsed.buffer)
            .rotate()
            .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "centre" })
            .jpeg({ quality: THUMB_JPEG_QUALITY, mozjpeg: true })
            .toBuffer();
    } catch (e) {
        console.warn("[image540] thumb buffer skip:", e.message);
        return null;
    }
}

async function normalizeProductImages540(images) {
    const arr = Array.isArray(images) ? images : [];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
        const s = String(arr[i] || "").trim();
        if (!s) continue;
        out.push(await resizeSquare540Cover(s));
    }
    return out;
}

async function normalizeVendorLogo540(logo) {
    return resizeSquare540Contain(logo);
}

async function migrateStoredImagesTo540(db) {
    const report = { products: 0, vendors: 0, vendorNew: 0, images: 0 };

    const products = db.collection("products");
    const productDocs = await products
        .find({
            $or: [
                { pd_image: { $regex: "^data:image/", $options: "i" } },
                { image: { $regex: "^data:image/", $options: "i" } },
                { "pd_images.0": { $regex: "^data:image/", $options: "i" } }
            ]
        })
        .project({ id: 1, pd_image: 1, pd_images: 1, image: 1, images: 1 })
        .toArray();

    for (const doc of productDocs) {
        const { readImagesFromDoc, F } = require("./productFields");
        const before = readImagesFromDoc(doc);
        if (!before.length) continue;
        let after = await normalizeProductImages540(before);
        after = after.slice(0, 1);
        const beforeOne = before.slice(0, 1);
        const changed =
            after.length !== beforeOne.length ||
            after.some(function (u, i) {
                return u !== beforeOne[i];
            });
        if (!changed) continue;
        await products.updateOne(
            { id: doc.id },
            {
                $set: {
                    pd_images: after,
                    pd_image: after[0] || "",
                    [F.image]: after[0] || "",
                    [F.images]: after,
                    pd_has_image: after.length > 0,
                    updatedAt: Date.now()
                }
            }
        );
        report.products++;
        report.images += after.length;
    }

    async function migrateVendorLogos(colName, key) {
        const col = db.collection(colName);
        const docs = await col
            .find({ [key]: { $regex: "^data:image/", $options: "i" } })
            .project({ id: 1, [key]: 1 })
            .toArray();
        for (const doc of docs) {
            const before = String(doc[key] || "");
            const after = await normalizeVendorLogo540(before);
            if (after === before) continue;
            await col.updateOne({ id: doc.id }, { $set: { [key]: after, updatedAt: Date.now() } });
            if (colName === "vendors") report.vendors++;
            else report.vendorNew++;
        }
    }

    await migrateVendorLogos("vendors", "vn_logo");
    await migrateVendorLogos("vendor_new", "vn_logo");

    const total = report.products + report.vendors + report.vendorNew;
    if (total) {
        console.log("[image540] migrated stored images:", report);
    }
    return report;
}

/** 기존 상품 — pd_image_thumb 없으면 생성(서버 기동 시 배치) */
async function migrateProductThumbs(db, opts) {
    opts = opts || {};
    const limit = Math.max(1, Math.min(500, Number(opts.limit) || 80));
    const report = { products: 0, skipped: 0 };
    const products = db.collection("products");
    const docs = await products
        .find({
            $or: [
                { pd_has_image: true },
                { "pd_images.0": { $exists: true, $ne: "" } },
                { pd_image: { $regex: "^data:image/", $options: "i" } }
            ],
            $and: [
                {
                    $or: [
                        { pd_image_thumb: { $exists: false } },
                        { pd_image_thumb: "" },
                        { pd_image_thumb: null }
                    ]
                }
            ]
        })
        .project({ id: 1, pd_image: 1, pd_images: 1, image: 1, images: 1 })
        .limit(limit)
        .toArray();

    const { readImagesFromDoc } = require("./productFields");
    for (const doc of docs) {
        const images = readImagesFromDoc(doc);
        const main = images[0] || "";
        if (!main) {
            report.skipped++;
            continue;
        }
        const thumb = await makeProductThumbDataUrl(main);
        if (!thumb) {
            report.skipped++;
            continue;
        }
        await products.updateOne(
            { id: doc.id },
            { $set: { pd_image_thumb: thumb, updatedAt: Date.now() } }
        );
        report.products++;
    }
    if (report.products) {
        console.log("[image540] product thumbs migrated:", report);
    }
    return report;
}

module.exports = {
    SIZE,
    THUMB_SIZE,
    resizeSquare540Cover,
    resizeSquare540Contain,
    makeProductThumbDataUrl,
    jpegBufferFromThumbDataUrl,
    fullCoverJpegBufferFromDataUrl,
    thumbJpegBufferFromDataUrl,
    normalizeProductImages540,
    normalizeVendorLogo540,
    migrateStoredImagesTo540,
    migrateProductThumbs
};
