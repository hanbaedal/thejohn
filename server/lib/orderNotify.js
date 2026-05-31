const { findStaffByRegisteredBy } = require("./staffRegisteredBy");
const { phoneFromOrderEnabledStaff } = require("./staffOrderEnabled");
const { F } = require("./vendorFields");
const { normalizeStaffLoginId } = require("./vendorAccess");
const { isSolapiConfigured, sendSolapiSms } = require("./solapiSms");

function normalizePhoneE164(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("82")) return "+" + digits;
    if (digits.startsWith("0")) return "+82" + digits.slice(1);
    return "+82" + digits;
}

function phoneForStaffLoginId(loginId) {
    return findStaffByRegisteredBy(String(loginId || "").trim()).then(function (staff) {
        if (staff && staff.st_ceo_tel) return normalizePhoneE164(staff.st_ceo_tel);
        return "";
    });
}

/** 업체 등록 담당 관리자 대표 연락처(st_ceo_tel) 우선 */
async function getAdminNotifyPhone(db, order) {
    var vendorLogin = String(order.vendorUserId || "").trim();
    if (vendorLogin) {
        try {
            const { findVendorByLoginId } = require("./loginResolve");
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

    var notifyStaffId = String(process.env.ORDER_NOTIFY_STAFF_ID || "").trim();
    if (notifyStaffId) {
        var byEnv = await phoneForStaffLoginId(notifyStaffId);
        if (byEnv) return byEnv;
    }

    var fromOrderEnabled = await phoneFromOrderEnabledStaff();
    if (fromOrderEnabled) return normalizePhoneE164(fromOrderEnabled);

    return "";
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

function buildShortSmsBody(order) {
    var name = order.vendorCompany || order.vendorUserId || "업체";
    var itemCount = Array.isArray(order.items) ? order.items.length : 0;
    var total = (Number(order.totalAmount) || 0).toLocaleString("ko-KR");
    var lines = [
        "[발주서] " + name + " 주문 접수",
        (order.orderNo || order.id || "") + " · " + itemCount + "품목 · " + total + "원"
    ];
    if (order.vendorMgrName) {
        var mgr = order.vendorMgrName;
        if (order.vendorMgrTel) mgr += " " + order.vendorMgrTel;
        lines.push("업체담당: " + mgr);
    }
    if (order.note) {
        var note = String(order.note).trim();
        if (note.length > 40) note = note.slice(0, 37) + "...";
        lines.push("비고: " + note);
    }
    lines.push("관리자 주문리스트에서 PDF 확인");
    var body = lines.join("\n");
    if (body.length > 1500) body = body.slice(0, 1497) + "...";
    return body;
}

function getNotifyMode() {
    var mode = String(process.env.ORDER_NOTIFY_MODE || "sms").trim().toLowerCase();
    return mode === "full" ? "full" : "sms";
}

async function sendOrderSms(toPhone, body) {
    if (!isSolapiConfigured()) {
        return { ok: false, skipped: true, reason: "SOLAPI 환경 변수 미설정" };
    }
    return sendSolapiSms(toPhone, body);
}

/**
 * 주문 접수 시 관리자 대표번호로 SOLAPI SMS 알림
 * ORDER_NOTIFY_MODE=sms(기본, 간단) | full(상세)
 */
async function notifyOrderAdmin(db, order) {
    var to = await getAdminNotifyPhone(db, order);
    if (!to) {
        return { ok: false, error: "수신 전화번호(관리자 대표 연락처)를 찾을 수 없습니다." };
    }

    var mode = getNotifyMode();
    var textBody = mode === "full" ? buildSmsBody(order) : buildShortSmsBody(order);

    var smsResult = await sendOrderSms(to, textBody);
    return Object.assign({ mode: mode, pdfSent: false, to: to, provider: "solapi" }, smsResult);
}

async function notifyOrderSms(db, order) {
    return notifyOrderAdmin(db, order);
}

module.exports = {
    getNotifyPhoneForOrder,
    getAdminNotifyPhone,
    buildSmsBody,
    buildShortSmsBody,
    notifyOrderSms,
    notifyOrderAdmin
};
