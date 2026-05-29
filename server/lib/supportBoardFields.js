const F = {
    title: "sb_title",
    body: "sb_body",
    authorRole: "sb_author_role",
    authorUserId: "sb_author_user_id",
    authorLabel: "sb_author_label"
};

const MAX_TITLE = 200;
const MAX_BODY = 8000;

function str(v) {
    return String(v || "").trim();
}

function buildFromBody(body) {
    return {
        sb_title: str(body.sb_title != null ? body.sb_title : body.title),
        sb_body: str(body.sb_body != null ? body.sb_body : body.body)
    };
}

function toPublic(doc) {
    if (!doc || !doc.id) return null;
    return {
        id: doc.id,
        title: str(doc[F.title] || doc.title),
        body: str(doc[F.body] || doc.body),
        authorRole: str(doc[F.authorRole] || doc.authorRole),
        authorUserId: str(doc[F.authorUserId] || doc.authorUserId),
        authorLabel: str(doc[F.authorLabel] || doc.authorLabel),
        createdAt: doc.createdAt || 0,
        updatedAt: doc.updatedAt || 0
    };
}

function toDbDoc(id, built, author, existing) {
    var prev = existing || {};
    var now = Date.now();
    return {
        id: id,
        [F.title]: built.sb_title,
        [F.body]: built.sb_body,
        [F.authorRole]: author.role,
        [F.authorUserId]: author.userId,
        [F.authorLabel]: author.label,
        createdAt: prev.createdAt || now,
        updatedAt: now
    };
}

function validateBuilt(built) {
    if (!built.sb_title) return "제목을 입력해 주세요.";
    if (!built.sb_body) return "내용을 입력해 주세요.";
    if (built.sb_title.length > MAX_TITLE) {
        return "제목은 " + MAX_TITLE + "자 이내로 입력해 주세요.";
    }
    if (built.sb_body.length > MAX_BODY) {
        return "내용은 " + MAX_BODY + "자 이내로 입력해 주세요.";
    }
    return "";
}

module.exports = {
    F,
    MAX_TITLE,
    MAX_BODY,
    buildFromBody,
    toPublic,
    toDbDoc,
    validateBuilt
};
