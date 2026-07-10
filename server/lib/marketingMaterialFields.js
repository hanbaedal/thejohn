const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = MAX_FILE_SIZE * MAX_FILES;
const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 500;
const MAX_CATEGORY = 40;

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const VIDEO_EXTS = [".mp4"];
const DOC_EXTS = [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx"];
const ALLOWED_EXTS = IMAGE_EXTS.concat(VIDEO_EXTS, DOC_EXTS);

const EXT_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".hwp": "application/x-hwp",
    ".hwpx": "application/hwp+zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

const F = {
    title: "mm_title",
    description: "mm_description",
    category: "mm_category",
    files: "mm_files",
    createdBy: "mm_created_by",
    createdByName: "mm_created_by_name",
    expireAt: "expireAt"
};

function str(v) {
    return String(v || "").trim();
}

function fileExt(name) {
    const n = String(name || "").trim().toLowerCase();
    const idx = n.lastIndexOf(".");
    return idx >= 0 ? n.slice(idx) : "";
}

function mimeForExt(ext) {
    return EXT_MIME[ext] || "application/octet-stream";
}

function fileKind(ext) {
    if (IMAGE_EXTS.indexOf(ext) >= 0) return "image";
    if (VIDEO_EXTS.indexOf(ext) >= 0) return "video";
    if (DOC_EXTS.indexOf(ext) >= 0) return "document";
    return "other";
}

function computeExpireAt(createdAt) {
    const base = Number(createdAt) || Date.now();
    return base + RETENTION_MS;
}

function sanitizeExistingFiles(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(function (f) {
            if (!f || typeof f !== "object") return null;
            const filename = str(f.filename);
            const r2Key = str(f.r2Key);
            const id = str(f.id);
            if (!filename || !r2Key || !id) return null;
            const ext = fileExt(filename);
            return {
                id: id,
                filename: filename,
                mime: str(f.mime) || mimeForExt(ext),
                size: Number(f.size) || 0,
                kind: str(f.kind) || fileKind(ext),
                r2Key: r2Key
            };
        })
        .filter(Boolean);
}

function buildFromBody(body) {
    return {
        mm_title: str(body.mm_title != null ? body.mm_title : body.title),
        mm_description: str(body.mm_description != null ? body.mm_description : body.description),
        mm_category: str(body.mm_category != null ? body.mm_category : body.category),
        mm_uploads: Array.isArray(body.mm_uploads)
            ? body.mm_uploads
            : Array.isArray(body.uploads)
              ? body.uploads
              : [],
        mm_keep_file_ids: Array.isArray(body.mm_keep_file_ids)
            ? body.mm_keep_file_ids.map(function (id) {
                  return str(id);
              }).filter(Boolean)
            : Array.isArray(body.keepFileIds)
              ? body.keepFileIds.map(function (id) {
                    return str(id);
                }).filter(Boolean)
              : null
    };
}

function parseUploads(uploads) {
    const out = [];
    let total = 0;
    const src = Array.isArray(uploads) ? uploads : [];
    if (src.length > MAX_FILES) {
        throw new Error("파일은 최대 " + MAX_FILES + "개까지 등록할 수 있습니다.");
    }
    for (let i = 0; i < src.length; i++) {
        const it = src[i] || {};
        const filename = str(it.filename);
        const content = str(it.contentBase64);
        if (!filename || !content) continue;
        const ext = fileExt(filename);
        if (ALLOWED_EXTS.indexOf(ext) < 0) {
            throw new Error("허용되지 않는 파일 형식입니다: " + filename);
        }
        if (VIDEO_EXTS.indexOf(ext) >= 0 && ext !== ".mp4") {
            throw new Error("동영상은 mp4만 업로드할 수 있습니다.");
        }
        const buf = Buffer.from(content, "base64");
        if (!buf.length) continue;
        if (buf.length > MAX_FILE_SIZE) {
            throw new Error("파일당 10MB 이하만 업로드할 수 있습니다: " + filename);
        }
        total += buf.length;
        if (total > MAX_TOTAL_SIZE) {
            throw new Error("첨부 총 용량은 50MB 이하로 제한됩니다.");
        }
        out.push({
            filename: filename,
            mime: mimeForExt(ext),
            size: buf.length,
            kind: fileKind(ext),
            buffer: buf
        });
    }
    return out;
}

function toPublic(doc) {
    if (!doc || !doc.id) return null;
    const files = sanitizeExistingFiles(doc[F.files] || doc.mm_files);
    const createdAt = doc.createdAt || 0;
    const expireAt = Number(doc[F.expireAt] || doc.expireAt) || computeExpireAt(createdAt);
    return {
        id: doc.id,
        mm_title: str(doc[F.title] || doc.mm_title),
        mm_description: str(doc[F.description] || doc.mm_description),
        mm_category: str(doc[F.category] || doc.mm_category),
        mm_files: files.map(function (f, idx) {
            return {
                id: f.id,
                filename: f.filename,
                mime: f.mime,
                size: f.size,
                kind: f.kind,
                index: idx
            };
        }),
        mm_created_by: str(doc[F.createdBy] || doc.mm_created_by),
        mm_created_by_name: str(doc[F.createdByName] || doc.mm_created_by_name),
        createdAt: createdAt,
        updatedAt: doc.updatedAt || 0,
        expireAt: expireAt
    };
}

function toDbDoc(id, built, existing, meta, storedFiles) {
    const prev = existing || {};
    const now = Date.now();
    const createdAt = prev.createdAt || now;
    return {
        id: id,
        [F.title]: built.mm_title,
        [F.description]: built.mm_description,
        [F.category]: built.mm_category,
        [F.files]: sanitizeExistingFiles(storedFiles),
        [F.createdBy]: meta.createdBy || prev[F.createdBy] || prev.mm_created_by || "",
        [F.createdByName]: meta.createdByName || prev[F.createdByName] || prev.mm_created_by_name || "",
        [F.expireAt]: computeExpireAt(createdAt),
        createdAt: createdAt,
        updatedAt: now
    };
}

function validateBuilt(built, fileCount) {
    if (!built.mm_title) return "제목을 입력해 주세요.";
    if (built.mm_title.length > MAX_TITLE) {
        return "제목은 " + MAX_TITLE + "자 이내로 입력해 주세요.";
    }
    if (built.mm_description.length > MAX_DESCRIPTION) {
        return "설명은 " + MAX_DESCRIPTION + "자 이내로 입력해 주세요.";
    }
    if (built.mm_category.length > MAX_CATEGORY) {
        return "분류는 " + MAX_CATEGORY + "자 이내로 입력해 주세요.";
    }
    if (!fileCount) return "파일을 1개 이상 첨부해 주세요.";
    if (fileCount > MAX_FILES) {
        return "파일은 최대 " + MAX_FILES + "개까지 등록할 수 있습니다.";
    }
    return "";
}

function newFileId() {
    return "mmf_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function r2KeyFor(materialId, fileId, filename) {
    const safe = String(filename || "file")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 80);
    return "marketing/" + materialId + "/" + fileId + "_" + safe;
}

module.exports = {
    F,
    MAX_FILES,
    MAX_FILE_SIZE,
    MAX_TOTAL_SIZE,
    RETENTION_DAYS,
    RETENTION_MS,
    ALLOWED_EXTS,
    IMAGE_EXTS,
    VIDEO_EXTS,
    DOC_EXTS,
    buildFromBody,
    parseUploads,
    sanitizeExistingFiles,
    toPublic,
    toDbDoc,
    validateBuilt,
    computeExpireAt,
    newFileId,
    r2KeyFor,
    mimeForExt,
    fileExt,
    fileKind
};
