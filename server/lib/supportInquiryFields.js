const F = {
    subject: "si_subject",
    body: "si_body",
    password: "si_password",
    fromRole: "si_from_role",
    fromUserId: "si_from_user_id",
    fromLabel: "si_from_label",
    status: "si_status",
    reply: "si_reply",
    repliedAt: "si_replied_at",
    replyBy: "si_reply_by"
};

const MAX_SUBJECT = 200;
const MAX_BODY = 8000;
const MAX_REPLY = 12000;

function str(v) {
    return String(v || "").trim();
}

function hasPassword(doc) {
    return /^\d{6}$/.test(str(doc[F.password] || doc.password));
}

function normalizePassword(raw) {
    var pw = str(raw);
    if (!pw) return "";
    if (!/^\d{6}$/.test(pw)) return null;
    return pw;
}

function buildFromBody(body) {
    return {
        si_subject: str(body.si_subject != null ? body.si_subject : body.subject),
        si_body: str(body.si_body != null ? body.si_body : body.body),
        si_password: normalizePassword(body.si_password != null ? body.si_password : body.password)
    };
}

function canViewDoc(doc, ctx) {
    if (!doc) return false;
    if (ctx.isAdmin) return true;
    if (ctx.isAuthor) return true;
    if (!hasPassword(doc)) return true;
    return ctx.unlockedIds.indexOf(doc.id) !== -1;
}

function toPublic(doc, ctx) {
    if (!doc || !doc.id) return null;
    ctx = ctx || {};
    var view = canViewDoc(doc, ctx);
    var bodyText = view ? str(doc[F.body] || doc.body) : "";
    var replyText = view ? str(doc[F.reply] || doc.reply) : "";
    return {
        id: doc.id,
        subject: str(doc[F.subject] || doc.subject),
        body: bodyText,
        hasPassword: hasPassword(doc),
        canView: view,
        fromRole: str(doc[F.fromRole] || doc.fromRole),
        fromUserId: str(doc[F.fromUserId] || doc.fromUserId),
        fromLabel: str(doc[F.fromLabel] || doc.fromLabel),
        status: str(doc[F.status] || doc.status) === "answered" ? "answered" : "open",
        reply: replyText,
        repliedAt: view ? doc[F.repliedAt] || doc.repliedAt || null : null,
        replyBy: view ? str(doc[F.replyBy] || doc.replyBy) : "",
        createdAt: doc.createdAt || 0,
        updatedAt: doc.updatedAt || 0
    };
}

function previewFromBody(body, maxLen) {
    var t = str(body);
    if (!t) return "";
    maxLen = maxLen || 64;
    return t.length > maxLen ? t.slice(0, maxLen) + "…" : t;
}

function toDbDoc(id, built, author, existing) {
    var prev = existing || {};
    var now = Date.now();
    if (built.si_password === null) {
        return { error: "비밀번호는 6자리 숫자이거나 비워 두세요." };
    }
    return {
        doc: {
            id: id,
            [F.subject]: built.si_subject,
            [F.body]: built.si_body,
            [F.password]: built.si_password || "",
            [F.fromRole]: author.role,
            [F.fromUserId]: author.userId,
            [F.fromLabel]: author.label,
            [F.status]: prev[F.status] || "open",
            [F.reply]: prev[F.reply] || "",
            [F.repliedAt]: prev[F.repliedAt] || null,
            [F.replyBy]: prev[F.replyBy] || "",
            createdAt: prev.createdAt || now,
            updatedAt: now
        }
    };
}

function validateBuilt(built, isCreate) {
    if (!built.si_subject) return "제목을 입력해 주세요.";
    if (!built.si_body) return "내용을 입력해 주세요.";
    if (built.si_subject.length > MAX_SUBJECT) {
        return "제목은 " + MAX_SUBJECT + "자 이내로 입력해 주세요.";
    }
    if (built.si_body.length > MAX_BODY) {
        return "내용은 " + MAX_BODY + "자 이내로 입력해 주세요.";
    }
    if (isCreate && built.si_password === null) {
        return "비밀번호는 6자리 숫자이거나 비워 두세요.";
    }
    return "";
}

function validateReplyBody(body) {
    var reply = str(body.si_reply != null ? body.si_reply : body.reply);
    var status = str(body.si_status != null ? body.si_status : body.status);
    if (reply.length > MAX_REPLY) {
        return "답변은 " + MAX_REPLY + "자 이내로 입력해 주세요.";
    }
    if (status && status !== "open" && status !== "answered") {
        return "상태 값이 올바르지 않습니다.";
    }
    return "";
}

function applyReply(doc, body, adminUserId) {
    var reply = str(body.si_reply != null ? body.si_reply : body.reply);
    var status = str(body.si_status != null ? body.si_status : body.status);
    var nextStatus = status === "answered" ? "answered" : "open";
    var now = Date.now();
    return Object.assign({}, doc, {
        [F.reply]: reply,
        [F.status]: nextStatus,
        [F.repliedAt]: reply ? now : doc[F.repliedAt] || null,
        [F.replyBy]: reply ? str(adminUserId) || "admin" : doc[F.replyBy] || "",
        updatedAt: now
    });
}

module.exports = {
    F,
    hasPassword,
    buildFromBody,
    toPublic,
    toDbDoc,
    validateBuilt,
    validateReplyBody,
    applyReply,
    previewFromBody,
    canViewDoc
};
