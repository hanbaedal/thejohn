const { findStaffByLoginId } = require("./loginResolve");
const { findVendorByLoginId } = require("./loginResolve");
const { F } = require("./vendorFields");
const { normalizeStaffLoginId } = require("./vendorAccess");

const DEFAULT_NOTIFY_LOGIN = "aksangsa";

function normalizePhoneE164(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("82")) return "+" + digits;
    if (digits.startsWith("0")) return "+82" + digits.slice(1);
    return "+82" + digits;
}

async function phoneForStaffLoginId(loginId) {
    var staff = await findStaffByLoginId(String(loginId || "").trim());
    if (staff && staff.st_ceo_tel) return normalizePhoneE164(staff.st_ceo_tel);
    return "";
}

async function getNotifyPhoneForOrder(db, order) {
    var fromEnv = String(process.env.ORDER_NOTIFY_PHONE || "").trim();
    if (fromEnv) return normalizePhoneE164(fromEnv);

    var notify = order.notifyStaff || {};
    if (notify.tel) return normalizePhoneE164(notify.tel);

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

    try {
        var staff = await findStaffByLoginId(
            String(process.env.ORDER_NOTIFY_STAFF_ID || DEFAULT_NOTIFY_LOGIN).trim()
        );
        if (staff && staff.st_ceo_tel) return normalizePhoneE164(staff.st_ceo_tel);
    } catch (e) {
        /* ignore */
    }
    return "+821047212333";
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

async function sendSmsViaTwilio(toE164, body) {
    var sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
    var token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
    var from = String(process.env.TWILIO_FROM_NUMBER || "").trim();
    if (!sid || !token || !from) {
        return { ok: false, skipped: true, reason: "TWILIO 환경 변수 미설정" };
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
            body: new URLSearchParams({
                To: toE164,
                From: from,
                Body: body
            })
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
            error: (data && data.message) || "SMS 전송 실패 (" + res.status + ")"
        };
    }
    return { ok: true, sid: data.sid };
}

async function notifyOrderSms(db, order) {
    var to = await getNotifyPhoneForOrder(db, order);
    var body = buildSmsBody(order);
    if (!to) return { ok: false, error: "수신 전화번호를 찾을 수 없습니다." };
    return sendSmsViaTwilio(to, body);
}

module.exports = {
    getNotifyPhoneForOrder,
    buildSmsBody,
    notifyOrderSms
};
