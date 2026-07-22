const { normalizeDept } = require("./productDept");

const SITE_NEWS_DEPT = "thejohn";

function normalizeNewsDept(v) {
    const raw = String(v ?? "").trim().toLowerCase();
    if (raw === SITE_NEWS_DEPT || raw === "더존소식") return SITE_NEWS_DEPT;
    return normalizeDept(v);
}

const F = {
    dept: "sn_dept",
    body: "sn_body",
    images: "sn_images",
    createdBy: "sn_created_by",
    createdByName: "sn_created_by_name",
    createdByTel: "sn_created_by_tel"
};

const MAX_BODY = 256;
const MAX_IMAGES = 3;
const MAX_IMAGE_DATA_URL_CHARS = Math.ceil(1024 * 1024 * 1.4);

function str(v) {
    return String(v || "").trim();
}

function sanitizeImages(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter(function (img) {
            return typeof img === "string" && img.length > 200;
        })
        .slice(0, MAX_IMAGES);
}

function buildFromBody(body) {
    return {
        sn_dept: normalizeNewsDept(body.sn_dept != null ? body.sn_dept : body.dept),
        sn_body: str(body.sn_body != null ? body.sn_body : body.body),
        sn_images: sanitizeImages(body.sn_images != null ? body.sn_images : body.images)
    };
}

function toPublic(doc) {
    if (!doc || !doc.id) return null;
    return {
        id: doc.id,
        sn_dept: normalizeNewsDept(doc[F.dept] || doc.sn_dept),
        sn_body: str(doc[F.body] || doc.sn_body),
        sn_images: sanitizeImages(doc[F.images] || doc.sn_images),
        sn_created_by: str(doc[F.createdBy] || doc.sn_created_by),
        sn_created_by_name: str(doc[F.createdByName] || doc.sn_created_by_name),
        sn_created_by_tel: str(doc[F.createdByTel] || doc.sn_created_by_tel),
        createdAt: doc.createdAt || 0,
        updatedAt: doc.updatedAt || 0
    };
}

function toDbDoc(id, built, existing, meta) {
    const prev = existing || {};
    const now = Date.now();
    return {
        id: id,
        [F.dept]: built.sn_dept,
        [F.body]: built.sn_body,
        [F.images]: built.sn_images,
        [F.createdBy]: meta.createdBy || prev[F.createdBy] || prev.sn_created_by || "",
        [F.createdByName]: meta.createdByName || prev[F.createdByName] || prev.sn_created_by_name || "",
        [F.createdByTel]: meta.createdByTel || prev[F.createdByTel] || prev.sn_created_by_tel || "",
        createdAt: prev.createdAt || now,
        updatedAt: now
    };
}

function validateBuilt(built) {
    if (!built.sn_dept) return "사업부문을 선택해 주세요.";
    if (!built.sn_body) return "내용을 입력해 주세요.";
    if (built.sn_body.length > MAX_BODY) {
        return "내용은 " + MAX_BODY + "자 이내로 입력해 주세요.";
    }
    if (built.sn_images.length > MAX_IMAGES) {
        return "사진은 최대 " + MAX_IMAGES + "장까지 등록할 수 있습니다.";
    }
    for (var i = 0; i < built.sn_images.length; i++) {
        if (built.sn_images[i].length > MAX_IMAGE_DATA_URL_CHARS) {
            return "사진 " + (i + 1) + "번의 용량이 너무 큽니다. 1MB 이하 사진을 사용해 주세요.";
        }
    }
    return "";
}

module.exports = {
    F,
    SITE_NEWS_DEPT,
    MAX_BODY,
    MAX_IMAGES,
    normalizeNewsDept,
    buildFromBody,
    toPublic,
    toDbDoc,
    validateBuilt,
    sanitizeImages
};
