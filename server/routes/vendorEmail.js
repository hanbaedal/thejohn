const express = require("express");
const nodemailer = require("nodemailer");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { registeredByInFilter } = require("../lib/staffLoginId");

const router = express.Router();
const HISTORY_COLLECTION = "vendor_email_history";
const MAX_ATTACHMENTS = 5;
const GREETING_MAX = 400;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_TOTAL_SIZE = 12 * 1024 * 1024;
const ALLOWED_EXTS = [".pdf", ".hwp", ".hwpx", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"];

function trim(v) {
    return String(v || "").trim();
}

function greetingLength(text) {
    return Array.from(String(text || "")).length;
}

function validateGreeting(greeting) {
    if (!greeting) return "내용을 입력해 주세요.";
    if (greetingLength(greeting) > GREETING_MAX) {
        return "내용은 " + GREETING_MAX + "자 이하로 입력해 주세요.";
    }
    return "";
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

function normalizeEmailSource(v) {
    return String(v || "").trim() === "vendor_new" ? "vendor_new" : "vendors";
}

async function collectRecipientsForCollection(db, collection, selMap, ids, registerFilter) {
    const set = new Set();
    const toList = [];
    let companyCount = 0;
    let managerCount = 0;
    if (!ids.length) {
        return { recipients: toList, companyCount: 0, managerCount: 0, vendorCount: 0, emailSet: set };
    }
    const docs = await db
        .collection(collection)
        .find(Object.assign({ id: { $in: ids } }, registerFilter), {
            projection: { id: 1, vn_email: 1, vn_mgr_email: 1, vn_company: 1 }
        })
        .limit(5000)
        .toArray();
    for (let j = 0; j < docs.length; j++) {
        const doc = docs[j] || {};
        const sel = selMap[doc.id];
        if (!sel) continue;
        if (sel.sendCompany) {
            const companyEmail = cleanEmail(doc.vn_email);
            if (companyEmail && !set.has(companyEmail)) {
                set.add(companyEmail);
                toList.push(companyEmail);
                companyCount++;
            }
        }
        if (sel.sendManager) {
            const managerEmail = cleanEmail(doc.vn_mgr_email);
            if (managerEmail && !set.has(managerEmail)) {
                set.add(managerEmail);
                toList.push(managerEmail);
                managerCount++;
            }
        }
    }
    return {
        recipients: toList,
        companyCount: companyCount,
        managerCount: managerCount,
        vendorCount: docs.length,
        emailSet: set
    };
}

async function collectRecipientsFromSelections(db, selections, senderId) {
    const registerFilter = senderId ? { vn_registered_by: registeredByInFilter(senderId) } : {};
    const src = Array.isArray(selections) ? selections : [];
    const maps = { vendors: {}, vendor_new: {} };
    const idsByCol = { vendors: [], vendor_new: [] };
    for (let i = 0; i < src.length; i++) {
        const row = src[i] || {};
        const id = trim(row.id);
        if (!id) continue;
        if (!row.sendCompany && !row.sendManager) continue;
        const col = normalizeEmailSource(row.source);
        if (!maps[col][id]) {
            maps[col][id] = {
                sendCompany: !!row.sendCompany,
                sendManager: !!row.sendManager
            };
            idsByCol[col].push(id);
        } else {
            maps[col][id].sendCompany = maps[col][id].sendCompany || !!row.sendCompany;
            maps[col][id].sendManager = maps[col][id].sendManager || !!row.sendManager;
        }
    }
    const globalSet = new Set();
    const toList = [];
    let companyCount = 0;
    let managerCount = 0;
    let vendorCount = 0;
    const cols = ["vendors", "vendor_new"];
    for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        const part = await collectRecipientsForCollection(
            db,
            col,
            maps[col],
            idsByCol[col],
            registerFilter
        );
        vendorCount += part.vendorCount;
        for (let r = 0; r < part.recipients.length; r++) {
            const email = part.recipients[r];
            if (!globalSet.has(email)) {
                globalSet.add(email);
                toList.push(email);
            }
        }
        companyCount += part.companyCount;
        managerCount += part.managerCount;
    }
    return {
        recipients: toList,
        counts: {
            company: companyCount,
            manager: managerCount,
            total: toList.length,
            vendors: vendorCount
        }
    };
}

async function resolveSenderName(db, auth, requestedName) {
    const direct = trim(requestedName);
    if (direct) return direct;
    const userId = auth && auth.userId ? String(auth.userId) : "";
    if (!userId) return "더존";
    try {
        const staff = await db
            .collection("staff")
            .findOne({ loginId: userId }, { projection: { st_company: 1, companyName: 1 } });
        const company = trim((staff && (staff.st_company || staff.companyName)) || "");
        return company || "더존";
    } catch (e) {
        return "더존";
    }
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
        const greetingErr = validateGreeting(greeting);
        if (greetingErr) return res.status(400).json({ ok: false, error: greetingErr });
        if (!testEmail) return res.status(400).json({ ok: false, error: "테스트 수신 이메일을 입력해 주세요." });
        const files = validateAndBuildAttachments(body.attachments);
        const senderName = await resolveSenderName(getDb(), req.auth, body.senderName);
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
        const selections = Array.isArray(body.selections) ? body.selections : [];
        if (!subject) return res.status(400).json({ ok: false, error: "메일 제목을 입력해 주세요." });
        const greetingErr = validateGreeting(greeting);
        if (greetingErr) return res.status(400).json({ ok: false, error: greetingErr });
        if (!selections.length) {
            return res.status(400).json({ ok: false, error: "수신자를 선택해 주세요." });
        }
        const senderId = req.auth && req.auth.userId ? String(req.auth.userId) : "";
        const db = getDb();
        const { recipients, counts } = await collectRecipientsFromSelections(db, selections, senderId);
        const sources = [];
        const sourceSeen = {};
        for (let si = 0; si < selections.length; si++) {
            const srcKey = normalizeEmailSource(selections[si].source);
            if (!sourceSeen[srcKey]) {
                sourceSeen[srcKey] = true;
                sources.push(srcKey);
            }
        }
        if (!recipients.length) {
            return res.status(400).json({
                ok: false,
                error: "선택한 수신자에 발송 가능한 이메일 주소가 없습니다."
            });
        }
        const files = validateAndBuildAttachments(body.attachments);
        const transporter = createTransporter();
        const senderName = await resolveSenderName(db, req.auth, body.senderName);
        const from = `"${senderName}" <${trim(process.env.MAIL_FROM)}>`;
        const sentResult = await sendBulkEmails(transporter, from, recipients, subject, greeting, files);
        const history = {
            id: "veh_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
            senderId: req.auth && req.auth.userId ? String(req.auth.userId) : "",
            senderRole: req.auth && req.auth.role ? String(req.auth.role) : "",
            subject: subject,
            greeting: greeting,
            sources: sources,
            source: sources.length === 1 ? sources[0] : "mixed",
            onlyMine: true,
            selectionCount: selections.length,
            requestedCount: recipients.length,
            recipientCounts: counts,
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
        const dateFrom = trim(req.query.dateFrom);
        const dateTo = trim(req.query.dateTo);
        const filter = {};
        const role = req.auth && req.auth.role ? String(req.auth.role) : "";
        const userId = req.auth && req.auth.userId ? String(req.auth.userId) : "";
        if (role !== "supervisor" && userId) {
            filter.senderId = userId;
        }
        if (dateFrom || dateTo) {
            let fromMs = 0;
            let toMs = 0;
            if (dateFrom) {
                const m1 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateFrom);
                if (!m1) return res.status(400).json({ ok: false, error: "시작일 형식이 올바르지 않습니다." });
                fromMs = new Date(parseInt(m1[1], 10), parseInt(m1[2], 10) - 1, parseInt(m1[3], 10)).getTime();
            }
            if (dateTo) {
                const m2 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateTo);
                if (!m2) return res.status(400).json({ ok: false, error: "종료일 형식이 올바르지 않습니다." });
                toMs = new Date(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10) + 1).getTime();
            }
            if (fromMs && toMs && fromMs >= toMs) {
                return res.status(400).json({ ok: false, error: "기간 선택이 올바르지 않습니다." });
            }
            filter.createdAt = {};
            if (fromMs) filter.createdAt.$gte = fromMs;
            if (toMs) filter.createdAt.$lt = toMs;
        }
        const items = await getDb()
            .collection(HISTORY_COLLECTION)
            .find(filter, { projection: { _id: 0 } })
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
