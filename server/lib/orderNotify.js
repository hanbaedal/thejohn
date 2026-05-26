const crypto = require("crypto");
const { findStaffByLoginId, findVendorByLoginId } = require("./loginResolve");
const { F } = require("./vendorFields");
const { normalizeStaffLoginId } = require("./vendorAccess");

const DEFAULT_NOTIFY_LOGIN = "aksangsa";
const PDF_NOTIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizePhoneE164(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("82")) return "+" + digits;
    if (digits.startsWith("0")) return "+82" + digits.slice(1);
    return "+82" + digits;
}

function getPublicBaseUrl() {
    var u = String(process.env.ORDER_NOTIFY_PUBLIC_URL || process.env.PUBLIC_BASE_URL || "").trim();
    if (u) return u.replace(/\/$/, "");
    return "";
}

function phoneForStaffLoginId(loginId) {
    return findStaffByLoginId(String(loginId || "").trim()).then(function (staff) {
        if (staff && staff.st_ceo_tel) return normalizePhoneE164(staff.st_ceo_tel);
        return "";
    });
}

/** 업체 등록 담당 관리자 대표 연락처(st_ceo_tel) 우선 */
async function getAdminNotifyPhone(db, order) {
    var vendorLogin = String(order.vendorUserId || "").trim();
    if (vendorLogin) {
        try {
            var vendor = await findVendorByLoginId(vendorLogin);
            var registrar = vendor && vendor[F.registeredBy];
            if (registrar && normalizeStaffLoginId(registrar) !== "legacy") {
                var byRegistrar = await phoneForStaffLoginId(registrar);
                if (byRegistrar) return byRegistrar;
            }
        } catch (e) {
            /* ignore */
        }
    }

    var notify = order.notifyStaff || {};
    if (notify.tel) return normalizePhoneE164(notify.tel);

    var regBy = String(order.vendorRegisteredBy || "").trim();
    if (regBy) {
        var byOrder = await phoneForStaffLoginId(regBy);
        if (byOrder) return byOrder;
    }

    var fromEnv = String(process.env.ORDER_NOTIFY_PHONE || "").trim();
    if (fromEnv) return normalizePhoneE164(fromEnv);

    return phoneForStaffLoginId(
        String(process.env.ORDER_NOTIFY_STAFF_ID || DEFAULT_NOTIFY_LOGIN).trim()
    ).then(function (tel) {
        return tel || "+821047212333";
    });
}

async function getNotifyPhoneForOrder(db, order) {
    return getAdminNotifyPhone(db, order);
}

function buildSmsBody(order) {
    var lines = [];
    var supplier = order.supplier || {};
    var notify = order.notifyStaff || {};

    var supplierName = supplier.name || notify.name || "주문접수";
    lines.push("[" + supplierName + "] 업체 주문 " + (order.orderNo || order.id));
    lines.push("주문업체: " + (order.vendorCompany || ""));
    if (order.vendorUserId) lines.push("아이디: " + order.vendorUserId);
    if (order.vendorMgrName) lines.push("업체담당: " + order.vendorMgrName);
    if (order.vendorMgrTel) lines.push("담당연락: " + order.vendorMgrTel);
    if (order.vendorGradeLabel) lines.push("등급: " + order.vendorGradeLabel);
    if (order.vendorAddr) lines.push("납품: " + order.vendorAddr);
    if (notify.tel) lines.push("접수: " + notify.tel);
    lines.push("일시: " + new Date(order.createdAt || Date.now()).toLocaleString("ko-KR"));
    lines.push("---");
    (order.items || []).forEach(function (it, i) {
        var dept = it.pd_dept_label || it.pd_dept || "";
        var head = i + 1 + ". " + (dept ? "[" + dept + "] " : "") + (it.productName || "");
        lines.push(
            head +
                " " +
                (it.priceLabel || "") +
                " x" +
                (it.quantity || 0) +
                " = " +
                (Number(it.lineTotal) || 0).toLocaleString("ko-KR") +
                "원"
        );
    });
    lines.push("합계: " + (Number(order.totalAmount) || 0).toLocaleString("ko-KR") + "원");
    if (order.note) lines.push("비고: " + order.note);
    if (supplier.name && supplier.tel) {
        lines.push("공급: " + supplier.name + " " + supplier.tel);
    }

    var body = lines.join("\n");
    if (body.length > 1500) body = body.slice(0, 1497) + "...";
    return body;
}

function buildShortMmsBody(order) {
    var name = order.vendorCompany || order.vendorUserId || "업체";
    return "[발주서] " + name + " 주문 (" + (order.orderNo || order.id) + ")";
}

async function savePdfNotifyToken(db, orderId) {
    var token = crypto.randomBytes(24).toString("hex");
    var expires = Date.now() + PDF_NOTIFY_TTL_MS;
    await db.collection("orders").updateOne(
        { id: String(orderId) },
        { $set: { pdfNotifyToken: token, pdfNotifyExpiresAt: expires } }
    );
    return token;
}

async function sendTwilioMessage(toE164, body, mediaUrls) {
    var sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
    var token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
    var from = String(process.env.TWILIO_FROM_NUMBER || "").trim();
    if (!sid || !token || !from) {
        return { ok: false, skipped: true, reason: "TWILIO 환경 변수 미설정" };
    }

    var params = new URLSearchParams();
    params.append("To", toE164);
    params.append("From", from);
    params.append("Body", body || " ");
    if (mediaUrls && mediaUrls.length) {
        mediaUrls.forEach(function (url) {
            if (url) params.append("MediaUrl", url);
        });
    }

    var auth = Buffer.from(sid + ":" + token).toString("base64");
    var res = await fetch(
        "https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sid) + "/Messages.json",
        {
            method: "POST",
            headers: {
                Authorization: "Basic " + auth,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params
        }
    );
    var data = {};
    try {
        data = await res.json();
    } catch (e) {
        data = {};
    }
    if (!res.ok) {
        return {
            ok: false,
            error: (data && data.message) || "문자 전송 실패 (" + res.status + ")"
        };
    }
    return { ok: true, sid: data.sid };
}

async function sendSmsViaTwilio(toE164, body) {
    return sendTwilioMessage(toE164, body, null);
}

/**
 * 주문 접수 시 관리자 대표번호로 발주서 PDF 전송 (Twilio MMS, 실패 시 링크 SMS)
 */
async function notifyOrderAdmin(db, order, pdfBuffer) {
    var to = await getAdminNotifyPhone(db, order);
    if (!to) {
        return { ok: false, error: "수신 전화번호(관리자 대표 연락처)를 찾을 수 없습니다." };
    }

    var textBody = buildSmsBody(order);

    if (!pdfBuffer || !pdfBuffer.length) {
        var noPdf = await sendSmsViaTwilio(to, textBody + "\n(발주서 PDF 생성 실패)");
        return Object.assign({ mode: "sms_only", pdfSent: false }, noPdf);
    }

    var baseUrl = getPublicBaseUrl();
    if (!baseUrl) {
        var noUrl = await sendSmsViaTwilio(
            to,
            textBody + "\n(발주서: PUBLIC_BASE_URL 미설정 — 관리자 화면에서 PDF 저장)"
        );
        return Object.assign({ mode: "sms_only", pdfSent: false, reason: "PUBLIC_BASE_URL 없음" }, noUrl);
    }

    var notifyToken = await savePdfNotifyToken(db, order.id);
    var pdfUrl = baseUrl + "/api/orders/notify-pdf/" + notifyToken;
    var shortBody = buildShortMmsBody(order);

    var mmsResult = await sendTwilioMessage(to, shortBody, [pdfUrl]);
    if (mmsResult.ok) {
        return {
            ok: true,
            mode: "mms",
            pdfSent: true,
            pdfUrl: pdfUrl,
            to: to,
            sid: mmsResult.sid
        };
    }

    var linkBody = textBody + "\n\n[발주서 PDF]\n" + pdfUrl;
    if (linkBody.length > 1500) {
        linkBody = shortBody + "\n\n[발주서 PDF]\n" + pdfUrl;
    }
    var smsResult = await sendSmsViaTwilio(to, linkBody);
    return {
        ok: !!smsResult.ok,
        mode: smsResult.ok ? "sms_link" : "failed",
        pdfSent: false,
        pdfUrl: pdfUrl,
        to: to,
        mmsError: mmsResult.error || mmsResult.reason,
        sms: smsResult
    };
}

async function notifyOrderSms(db, order) {
    return notifyOrderAdmin(db, order, null);
}

module.exports = {
    getPublicBaseUrl,
    getNotifyPhoneForOrder,
    getAdminNotifyPhone,
    buildSmsBody,
    notifyOrderSms,
    notifyOrderAdmin,
    PDF_NOTIFY_TTL_MS
};
