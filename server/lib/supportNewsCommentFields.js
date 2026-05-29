const F = {
    newsId: "snc_news_id",
    parentId: "snc_parent_id",
    body: "snc_body",
    authorRole: "snc_author_role",
    authorUserId: "snc_author_user_id",
    authorName: "snc_author_name"
};

const MAX_BODY = 256;

function str(v) {
    return String(v || "").trim();
}

function toPublic(doc) {
    if (!doc || !doc.id) return null;
    return {
        id: doc.id,
        snc_news_id: str(doc[F.newsId] || doc.snc_news_id),
        snc_parent_id: str(doc[F.parentId] || doc.snc_parent_id),
        snc_body: str(doc[F.body] || doc.snc_body),
        snc_author_role: str(doc[F.authorRole] || doc.snc_author_role),
        snc_author_user_id: str(doc[F.authorUserId] || doc.snc_author_user_id),
        snc_author_name: str(doc[F.authorName] || doc.snc_author_name),
        createdAt: doc.createdAt || 0
    };
}

function buildFromBody(body) {
    return {
        snc_body: str(body.snc_body != null ? body.snc_body : body.body),
        snc_parent_id: str(body.snc_parent_id != null ? body.snc_parent_id : body.parentId)
    };
}

function validateBuilt(built) {
    if (!built.snc_body) return "댓글 내용을 입력해 주세요.";
    if (built.snc_body.length > MAX_BODY) {
        return "댓글은 " + MAX_BODY + "자 이내로 입력해 주세요.";
    }
    return "";
}

function toDbDoc(id, newsId, built, meta) {
    const now = Date.now();
    return {
        id: id,
        [F.newsId]: newsId,
        [F.parentId]: built.snc_parent_id || "",
        [F.body]: built.snc_body,
        [F.authorRole]: meta.authorRole || "vendor",
        [F.authorUserId]: meta.authorUserId || "",
        [F.authorName]: meta.authorName || "",
        createdAt: now
    };
}

module.exports = {
    F,
    MAX_BODY,
    buildFromBody,
    toPublic,
    toDbDoc,
    validateBuilt
};
