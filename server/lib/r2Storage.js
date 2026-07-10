/**
 * Cloudflare R2 (S3 호환) — 이미지 JPEG 저장·조회
 * 환경 변수 없으면 비활성(기존 MongoDB 경로 유지)
 */
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const CACHE_CONTROL = "public, max-age=604800, immutable";

function getConfig() {
    const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
    const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
    const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
    const bucket = String(process.env.R2_BUCKET_NAME || "thejohn").trim();
    const publicBase = String(process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
        return null;
    }
    return { accountId, accessKeyId, secretAccessKey, bucket, publicBase };
}

let clientCache = null;

function isR2Enabled() {
    return !!getConfig();
}

function getClient() {
    if (clientCache) return clientCache;
    const c = getConfig();
    if (!c) return null;
    clientCache = new S3Client({
        region: "auto",
        endpoint: "https://" + c.accountId + ".r2.cloudflarestorage.com",
        credentials: {
            accessKeyId: c.accessKeyId,
            secretAccessKey: c.secretAccessKey
        }
    });
    return clientCache;
}

function publicUrl(key) {
    const c = getConfig();
    const k = String(key || "").trim();
    if (!c || !c.publicBase || !k) return "";
    return c.publicBase + "/" + k.replace(/^\//, "");
}

async function streamToBuffer(body) {
    if (!body) return null;
    if (Buffer.isBuffer(body)) return body;
    const chunks = [];
    for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function putObject(key, buffer, contentType) {
    const client = getClient();
    const c = getConfig();
    if (!client || !c || !buffer || !buffer.length) return false;
    const k = String(key || "").trim();
    if (!k) return false;
    const ct = String(contentType || "application/octet-stream").trim() || "application/octet-stream";
    try {
        await client.send(
            new PutObjectCommand({
                Bucket: c.bucket,
                Key: k,
                Body: buffer,
                ContentType: ct,
                CacheControl: CACHE_CONTROL
            })
        );
        return true;
    } catch (e) {
        console.warn("[r2] putObject", k, e.message);
        return false;
    }
}

async function deleteObject(key) {
    const client = getClient();
    const c = getConfig();
    const k = String(key || "").trim();
    if (!client || !c || !k) return false;
    try {
        await client.send(
            new DeleteObjectCommand({
                Bucket: c.bucket,
                Key: k
            })
        );
        return true;
    } catch (e) {
        console.warn("[r2] delete", k, e.message);
        return false;
    }
}

async function putJpeg(key, buffer) {
    const client = getClient();
    const c = getConfig();
    if (!client || !c || !buffer || !buffer.length) return false;
    const k = String(key || "").trim();
    if (!k) return false;
    try {
        await client.send(
            new PutObjectCommand({
                Bucket: c.bucket,
                Key: k,
                Body: buffer,
                ContentType: "image/jpeg",
                CacheControl: CACHE_CONTROL
            })
        );
        return true;
    } catch (e) {
        console.warn("[r2] put", k, e.message);
        return false;
    }
}

async function getBuffer(key) {
    const client = getClient();
    const c = getConfig();
    const k = String(key || "").trim();
    if (!client || !c || !k) return null;
    try {
        const out = await client.send(
            new GetObjectCommand({
                Bucket: c.bucket,
                Key: k
            })
        );
        return await streamToBuffer(out.Body);
    } catch (e) {
        if (e && e.name !== "NoSuchKey") {
            console.warn("[r2] get", k, e.message);
        }
        return null;
    }
}

async function exists(key) {
    const client = getClient();
    const c = getConfig();
    const k = String(key || "").trim();
    if (!client || !c || !k) return false;
    try {
        await client.send(
            new HeadObjectCommand({
                Bucket: c.bucket,
                Key: k
            })
        );
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = {
    isR2Enabled,
    getConfig,
    publicUrl,
    putObject,
    putJpeg,
    getBuffer,
    exists,
    deleteObject,
    CACHE_CONTROL
};
