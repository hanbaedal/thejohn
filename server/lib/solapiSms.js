/**
 * SOLAPI(솔라피) — 국내 SMS/LMS 발송 (실운영 권장)
 * https://solapi.com
 */
const crypto = require("crypto");

const SOLAPI_SEND_URL = "https://api.solapi.com/messages/v4/send";

function normalizeKrMobile(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (digits.startsWith("82")) digits = "0" + digits.slice(2);
    if (digits.length === 10 || digits.length === 11) return digits;
    if (digits.startsWith("10") && digits.length === 10) return "0" + digits;
    return digits;
}

function buildAuthHeader(apiKey, apiSecret) {
    var alphabet = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var salt = "";
    var bytes = crypto.randomBytes(32);
    for (var i = 0; i < 32; i++) {
        salt += alphabet[bytes[i] % alphabet.length];
    }
    var date = new Date().toISOString();
    var signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
    return (
        "HMAC-SHA256 apiKey=" +
        apiKey +
        ", date=" +
        date +
        ", salt=" +
        salt +
        ", signature=" +
        signature
    );
}

function isSolapiConfigured() {
    return !!(
        String(process.env.SOLAPI_API_KEY || "").trim() &&
        String(process.env.SOLAPI_API_SECRET || "").trim() &&
        String(process.env.SOLAPI_FROM_NUMBER || "").trim()
    );
}

async function sendSolapiSms(toPhone, text) {
    var apiKey = String(process.env.SOLAPI_API_KEY || "").trim();
    var apiSecret = String(process.env.SOLAPI_API_SECRET || "").trim();
    var from = normalizeKrMobile(process.env.SOLAPI_FROM_NUMBER || "");
    var to = normalizeKrMobile(toPhone);

    if (!apiKey || !apiSecret || !from) {
        return { ok: false, skipped: true, reason: "SOLAPI 환경 변수 미설정" };
    }
    if (!to || to.length < 10) {
        return { ok: false, error: "수신 번호 형식이 올바르지 않습니다." };
    }

    var body = String(text || "").trim();
    if (!body) {
        return { ok: false, error: "문자 내용이 비어 있습니다." };
    }

    try {
        var res = await fetch(SOLAPI_SEND_URL, {
            method: "POST",
            headers: {
                Authorization: buildAuthHeader(apiKey, apiSecret),
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: {
                    to: to,
                    from: from,
                    text: body
                }
            })
        });
        var data = {};
        try {
            data = await res.json();
        } catch (e) {
            data = {};
        }
        if (!res.ok) {
            var errMsg =
                (data && data.errorMessage) ||
                (data && data.message) ||
                (data && data.errorCode) ||
                "SOLAPI 발송 실패 (" + res.status + ")";
            return { ok: false, error: String(errMsg) };
        }
        var groupId =
            (data && data.groupId) ||
            (data && data.messageId) ||
            (data && data.statusMessage) ||
            "";
        return { ok: true, provider: "solapi", groupId: groupId, to: to, from: from };
    } catch (e) {
        return { ok: false, error: (e && e.message) || "SOLAPI 요청 오류" };
    }
}

module.exports = {
    isSolapiConfigured,
    sendSolapiSms,
    normalizeKrMobile
};
