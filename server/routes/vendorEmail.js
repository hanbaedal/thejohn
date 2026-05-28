const express = require("express");
const nodemailer = require("nodemailer");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");

const router = express.Router();
const HISTORY_COLLECTION = "vendor_email_history";
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TOTAL_SIZE = 12 * 1024 * 1024;
const ALLOWED_EXTS = [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];

function trim(v) {
    return String(v || "").trim();
}

function hasSmtpConfig() {
    return (
        trim(process.env.SMTP_HOST) &&
        trim(process.env.SMTP_PORT) &&
        trim(process.env.SMTP_USER) &&
        trim(process.env.SMTP_PASS) &&
        trim(process.env.MAIL_FROM)
    );
}

function createTransporter() {
    return nodemailer.createTransport({
        host: trim(process.env.SMTP_HOST),
        port: Number(trim(process.env.SMTP_PORT) || 587),
        secure: String(process.env.SMTP_SECURE || "").trim() === "true",
        auth: {
            user: trim(process.env.SMTP_USER),
            pass: trim(process.env.SMTP_PASS)
        }
    });
}

function cleanEmail(v) {
    const email = trim(v).toLowerCase();
    if (!email || email.indexOf("@") < 1 || email.indexOf(".") < 3) return "";
    return email;
}

function escapeHtml(v) {
    return String(v || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function fileExt(name) {
    const n = String(name || "").trim().toLowerCase();
    const idx = n.lastIndexOf(".");
    return idx >= 0 ? n.slice(idx) : "";
}

function validateAndBuildAttachments(attachments) {
    const src = Array.isArray(attachments) ? attachments : [];
    if (src.length > MAX_ATTACHMENTS) {
        throw new Error("첨부는 최대 " + MAX_ATTACHMENTS + "개까지 가능합니다.");
    }
    const files = [];
    let total = 0;
    for (let i = 0; i < src.length; i++) {
        const it = src[i] || {};
        const filename = trim(it.filename);
        const content = trim(it.contentBase64);
        if (!filename || !content) continue;
        const ext = fileExt(filename);
        if (ALLOWED_EXTS.indexOf(ext) < 0) {
            throw new Error("허용되지 않는 첨부 형식입니다: " + filename);
        }
        const buf = Buffer.from(content, "base64");
        if (!buf.length) continue;
        if (buf.length > MAX_FILE_SIZE) {
            throw new Error("파일당 4MB 이하만 첨부해 주세요: " + filename);
        }
        total += buf.length;
        if (total > MAX_TOTAL_SIZE) {
            throw new Error("첨부 총 용량은 12MB 이하로 제한됩니다.");
        }
        files.push({
            filename: filename,
            content: buf
        });
    }
    return files;
}

async function collectRecipients(db, opts, senderId) {
    const set = new Set();
    const toList = [];
    const counts = { vendors: 0, vendorNew: 0 };
    const registerFilter = senderId ? { vn_registered_by: senderId } : {};

    if (opts.includeVendors) {
        const docs = await db
            .collection("vendors")
            .find(registerFilter, { projection: { vn_email: 1 } })
            .limit(5000)
            .toArray();
        for (let i = 0; i < docs.length; i++) {
            const email = cleanEmail(docs[i] && docs[i].vn_email);
            if (!email || set.has(email)) continue;
            set.add(email);
            toList.push(email);
        }
        counts.vendors = toList.length;
    }

    if (opts.includeVendorNew) {
        const before = toList.length;
        const docs = await db
            .collection("vendor_new")
            .find(registerFilter, { projection: { vn_email: 1 } })
            .limit(5000)
            .toArray();
        for (let i = 0; i < docs.length; i++) {
            const email = cleanEmail(docs[i] && docs[i].vn_email);
            if (!email || set.has(email)) continue;
            set.add(email);
            toList.push(email);
        }
        counts.vendorNew = toList.length - before;
    }

    return { recipients: toList, counts };
}

async function sendBulkEmails(transporter, from, recipients, subject, greeting, files) {
    const ok = [];
    const failed = [];
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
        greeting
    )}</div>`;
    const chunk = 20;
    for (let s = 0; s < recipients.length; s += chunk) {
        const batch = recipients.slice(s, s + chunk);
        const works = batch.map(async function (to) {
            try {
                await transporter.sendMail({
                    from: from,
                    to: to,
                    subject: subject,
                    text: greeting,
                    html: html,
                    attachments: files
                });
                ok.push(to);
            } catch (e) {
                failed.push({
                    email: to,
                    reason: trim((e && e.message) || "발송 실패")
                });
            }
        });
        await Promise.all(works);
    }
    return { ok, failed };
}

async function insertHistory(db, payload) {
    try {
        await db.collection(HISTORY_COLLECTION).insertOne(payload);
    } catch (e) {
        console.warn("[vendor_email] history insert warning:", e && e.message);
    }
}

router.post("/broadcast-test", requireRole("admin"), async function (req, res) {
    try {
        if (!hasSmtpConfig()) {
            return res.status(400).json({
                ok: false,
                error: "SMTP 설정이 없습니다.",
                hint: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM 환경 변수를 설정해 주세요."
            });
        }
        const body = req.body || {};
        const subject = trim(body.subject);
        const greeting = trim(body.greeting);
        const testEmail = cleanEmail(body.testEmail);
        if (!subject) return res.status(400).json({ ok: false, error: "메일 제목을 입력해 주세요." });
        if (!greeting) return res.status(400).json({ ok: false, error: "인사말(본문)을 입력해 주세요." });
        if (!testEmail) return res.status(400).json({ ok: false, error: "테스트 수신 이메일을 입력해 주세요." });
        const files = validateAndBuildAttachments(body.attachments);
        const senderName = trim(body.senderName) || "더존";
        const from = `"${senderName}" <${trim(process.env.MAIL_FROM)}>`;
        const transporter = createTransporter();
        await transporter.sendMail({
            from: from,
            to: testEmail,
            subject: "[테스트] " + subject,
            text: greeting,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap;">${escapeHtml(
                greeting
            )}</div>`,
            attachments: files
        });
        return res.json({ ok: true, sent: 1, to: testEmail });
    } catch (e) {
        console.error("POST /api/vendor-email/broadcast-test", e);
        return res.status(500).json({ ok: false, error: "테스트 메일 발송에 실패했습니다." });
    }
});

router.post("/broadcast", requireRole("admin"), async function (req, res) {
    try {
        if (!hasSmtpConfig()) {
            return res.status(400).json({
                ok: false,
                error: "SMTP 설정이 없습니다.",
                hint: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM 환경 변수를 설정해 주세요."
            });
        }
        const body = req.body || {};
        const subject = trim(body.subject);
        const greeting = trim(body.greeting);
        const includeVendors = !!body.includeVendors;
        const includeVendorNew = !!body.includeVendorNew;
        const onlyMine = body.onlyMine !== false;
        if (!subject) return res.status(400).json({ ok: false, error: "메일 제목을 입력해 주세요." });
        if (!greeting) return res.status(400).json({ ok: false, error: "인사말(본문)을 입력해 주세요." });
        if (!includeVendors && !includeVendorNew) {
            return res.status(400).json({ ok: false, error: "발송 대상을 최소 1개 선택해 주세요." });
        }
        const senderId = onlyMine && req.auth && req.auth.userId ? String(req.auth.userId) : "";
        const db = getDb();
        const { recipients, counts } = await collectRecipients(db, { includeVendors, includeVendorNew }, senderId);
        if (!recipients.length) {
            return res.status(400).json({
                ok: false,
                error: "발송 가능한 이메일 주소가 없습니다."
            });
        }
        const files = validateAndBuildAttachments(body.attachments);
        const transporter = createTransporter();
        const senderName = trim(body.senderName) || "더존";
        const from = `"${senderName}" <${trim(process.env.MAIL_FROM)}>`;
        const sentResult = await sendBulkEmails(transporter, from, recipients, subject, greeting, files);
        const history = {
            id: "veh_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
            senderId: req.auth && req.auth.userId ? String(req.auth.userId) : "",
            senderRole: req.auth && req.auth.role ? String(req.auth.role) : "",
            subject: subject,
            greeting: greeting,
            includeVendors: includeVendors,
            includeVendorNew: includeVendorNew,
            onlyMine: onlyMine,
            requestedCount: recipients.length,
            sentCount: sentResult.ok.length,
            failedCount: sentResult.failed.length,
            failed: sentResult.failed.slice(0, 200),
            attachCount: files.length,
            createdAt: Date.now()
        };
        await insertHistory(db, history);

        return res.json({
            ok: true,
            sent: sentResult.ok.length,
            failed: sentResult.failed.length,
            failedItems: sentResult.failed,
            counts: counts,
            historyId: history.id
        });
    } catch (e) {
        console.error("POST /api/vendor-email/broadcast", e);
        return res.status(500).json({ ok: false, error: "단체 메일 발송에 실패했습니다." });
    }
});

router.get("/history", requireRole("admin"), async function (req, res) {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10) || 20, 1), 100);
        const items = await getDb()
            .collection(HISTORY_COLLECTION)
            .find({}, { projection: { _id: 0 } })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
        return res.json({ ok: true, items: items });
    } catch (e) {
        console.error("GET /api/vendor-email/history", e);
        return res.status(500).json({ ok: false, error: "메일 발송 이력을 불러오지 못했습니다." });
    }
});

module.exports = router;
