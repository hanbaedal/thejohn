const { normalizeStaffLoginId } = require("./orderAccess");

const COLLECTION = "access_logs";

function newLogId() {
    return "alog_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function parseYmdToMs(s, endOfDay) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
    if (!m) return 0;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10) - 1;
    var d = parseInt(m[3], 10) + (endOfDay ? 1 : 0);
    return new Date(y, mo, d).getTime();
}

function ymdFromMs(ts) {
    var d = new Date(ts || Date.now());
    return (
        String(d.getFullYear()) +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}

async function ensureAccessLogIndexes(db) {
    const col = db.collection(COLLECTION);
    try {
        await col.createIndex({ at: -1 }, { name: "access_logs_at" });
        await col.createIndex({ kind: 1, at: -1 }, { name: "access_logs_kind_at" });
    } catch (e) {
        console.warn("[thejohn] access_logs index:", e.message);
    }
}

/**
 * @param {object} db
 * @param {{ kind: string, role?: string, userId?: string, page?: string, vendorRegisteredBy?: string, label?: string }} data
 */
async function logAccessEvent(db, data) {
    if (!db || !data || !data.kind) return null;
    var at = Date.now();
    var doc = {
        id: newLogId(),
        at: at,
        kind: String(data.kind),
        role: String(data.role || "guest").trim() || "guest",
        userId: String(data.userId || "").trim(),
        page: String(data.page || "").trim(),
        vendorRegisteredBy: normalizeStaffLoginId(data.vendorRegisteredBy || ""),
        label: String(data.label || "").trim()
    };
    await db.collection(COLLECTION).insertOne(doc);
    return doc;
}

async function logStaffLogin(db, role, userId, label) {
    return logAccessEvent(db, {
        kind: "staff_login",
        role: role,
        userId: userId,
        label: label || userId
    });
}

async function logVendorLogin(db, userId, vendorRegisteredBy, label) {
    return logAccessEvent(db, {
        kind: "vendor_login",
        role: "vendor",
        userId: userId,
        vendorRegisteredBy: vendorRegisteredBy,
        label: label || userId
    });
}

async function logPageView(db, auth, page) {
    var role = (auth && auth.role) || "guest";
    var userId = (auth && auth.userId) || "";
    var vendorRegisteredBy = (auth && auth.vendorRegisteredBy) || "";
    return logAccessEvent(db, {
        kind: "page_view",
        role: role,
        userId: userId,
        page: page,
        vendorRegisteredBy: vendorRegisteredBy
    });
}

function categorizeLog(doc) {
    var kind = String(doc.kind || "");
    if (kind === "staff_login") return "staff";
    if (kind === "vendor_login") return "vendor";
    if (kind === "page_view") {
        var role = String(doc.role || "");
        if (role === "admin" || role === "supervisor") return "staff";
        if (role === "vendor") return "vendor";
        return "guest";
    }
    return "guest";
}

function formatLogPublic(doc) {
    var cat = categorizeLog(doc);
    var at = doc.at || 0;
    return {
        id: doc.id,
        at: at,
        date: ymdFromMs(at),
        time: new Date(at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        category: cat,
        kind: doc.kind,
        role: doc.role || "",
        userId: doc.userId || "",
        page: doc.page || "",
        vendorRegisteredBy: doc.vendorRegisteredBy || "",
        label: doc.label || doc.userId || doc.page || ""
    };
}

async function queryAccessStats(db, dateFrom, dateTo) {
    var fromMs = parseYmdToMs(dateFrom, false);
    var toMs = parseYmdToMs(dateTo, true);
    if ((dateFrom && !fromMs) || (dateTo && !toMs)) {
        return { error: "기간 날짜 형식이 올바르지 않습니다." };
    }
    if (fromMs && toMs && fromMs >= toMs) {
        return { error: "기간 선택이 올바르지 않습니다." };
    }

    var filter = {};
    if (fromMs || toMs) {
        filter.at = {};
        if (fromMs) filter.at.$gte = fromMs;
        if (toMs) filter.at.$lt = toMs;
    }

    var items = await db
        .collection(COLLECTION)
        .find(filter)
        .sort({ at: -1 })
        .limit(2000)
        .toArray();

    var summary = { staff: 0, vendor: 0, guest: 0 };
    var byDayMap = {};

    items.forEach(function (doc) {
        var pub = formatLogPublic(doc);
        summary[pub.category] = (summary[pub.category] || 0) + 1;
        if (!byDayMap[pub.date]) {
            byDayMap[pub.date] = { date: pub.date, staff: 0, vendor: 0, guest: 0 };
        }
        byDayMap[pub.date][pub.category] = (byDayMap[pub.date][pub.category] || 0) + 1;
    });

    var byDay = Object.keys(byDayMap)
        .sort()
        .reverse()
        .map(function (k) {
            return byDayMap[k];
        });

    return {
        summary: summary,
        byDay: byDay,
        items: items.map(formatLogPublic)
    };
}

module.exports = {
    COLLECTION,
    ensureAccessLogIndexes,
    logAccessEvent,
    logStaffLogin,
    logVendorLogin,
    logPageView,
    queryAccessStats,
    parseYmdToMs,
    ymdFromMs
};
