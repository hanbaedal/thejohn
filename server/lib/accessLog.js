const { normalizeStaffLoginId } = require("./orderAccess");

const COLLECTION = "access_logs";
const IDLE_MS = 30 * 60 * 1000;
const USAGE_QUERY_LIMIT = 20000;

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
        await col.createIndex({ userId: 1, at: -1 }, { name: "access_logs_user_at" });
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

async function logGuestLogin(db, guestId) {
    return logAccessEvent(db, {
        kind: "guest_login",
        role: "guest",
        userId: String(guestId || "").trim(),
        label: "게스트"
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

async function logSessionEnd(db, auth) {
    if (!auth || !auth.userId) return null;
    return logAccessEvent(db, {
        kind: "session_end",
        role: auth.role || "guest",
        userId: auth.userId,
        vendorRegisteredBy: auth.vendorRegisteredBy || "",
        label: auth.userId
    });
}

function isLoginKind(kind) {
    return kind === "staff_login" || kind === "vendor_login" || kind === "guest_login";
}

function categorizeLog(doc) {
    var kind = String(doc.kind || "");
    if (kind === "staff_login") return "staff";
    if (kind === "vendor_login") return "vendor";
    if (kind === "guest_login") return "guest";
    if (kind === "session_end") {
        var roleEnd = String(doc.role || "");
        if (roleEnd === "admin" || roleEnd === "supervisor") return "staff";
        if (roleEnd === "vendor") return "vendor";
        return "guest";
    }
    if (kind === "page_view") {
        var role = String(doc.role || "");
        if (role === "admin" || role === "supervisor") return "staff";
        if (role === "vendor") return "vendor";
        return "guest";
    }
    return "guest";
}

function closeSessionState(state) {
    return {
        startAt: state.startAt,
        endAt: state.lastAt,
        durationMs: Math.max(0, (state.lastAt || 0) - (state.startAt || 0))
    };
}

function buildSessionsFromEvents(events) {
    var sessions = [];
    var current = null;
    (events || []).forEach(function (ev) {
        var kind = String(ev.kind || "");
        var at = ev.at || 0;
        if (isLoginKind(kind)) {
            if (current) sessions.push(closeSessionState(current));
            current = { startAt: at, lastAt: at };
            return;
        }
        if (kind === "session_end") {
            if (current) {
                current.lastAt = Math.max(current.lastAt, at);
                sessions.push(closeSessionState(current));
                current = null;
            }
            return;
        }
        if (kind === "page_view") {
            if (!current) {
                current = { startAt: at, lastAt: at };
                return;
            }
            if (at - current.lastAt > IDLE_MS) {
                sessions.push(closeSessionState(current));
                current = { startAt: at, lastAt: at };
            } else {
                current.lastAt = at;
            }
        }
    });
    if (current) sessions.push(closeSessionState(current));
    return sessions;
}

function summarizeUserEvents(events, meta) {
    meta = meta || {};
    var loginCount = 0;
    var pageViews = 0;
    var lastLoginAt = 0;
    var label = meta.label || "";
    var role = meta.role || "";
    var vendorRegisteredBy = meta.vendorRegisteredBy || "";
    (events || []).forEach(function (ev) {
        if (isLoginKind(ev.kind)) {
            loginCount += 1;
            if (ev.at > lastLoginAt) lastLoginAt = ev.at;
            if (ev.label) label = ev.label;
            if (ev.role) role = ev.role;
            if (ev.vendorRegisteredBy) vendorRegisteredBy = ev.vendorRegisteredBy;
        }
        if (ev.kind === "page_view") pageViews += 1;
        if (!label && ev.label) label = ev.label;
        if (!vendorRegisteredBy && ev.vendorRegisteredBy) vendorRegisteredBy = ev.vendorRegisteredBy;
    });
    var sessions = buildSessionsFromEvents(events);
    var totalDurationMs = sessions.reduce(function (s, x) {
        return s + (x.durationMs || 0);
    }, 0);
    return {
        loginCount: loginCount,
        pageViews: pageViews,
        sessionCount: sessions.length,
        totalDurationMs: totalDurationMs,
        avgSessionMs: sessions.length ? Math.round(totalDurationMs / sessions.length) : 0,
        lastLoginAt: lastLoginAt,
        label: label,
        role: role,
        vendorRegisteredBy: vendorRegisteredBy
    };
}

function userGroupKey(doc) {
    return categorizeLog(doc) + "\t" + String(doc.userId || "").trim().toLowerCase();
}

async function loadStaffNameMap(db) {
    var map = {};
    try {
        var rows = await db
            .collection("staff")
            .find({ active: { $ne: false } })
            .project({ loginId: 1, st_company: 1, role: 1 })
            .toArray();
        rows.forEach(function (s) {
            var id = normalizeStaffLoginId(s.loginId);
            if (id) map[id] = String(s.st_company || s.loginId || id);
        });
    } catch (e) {}
    return map;
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

async function queryUsageStats(db, dateFrom, dateTo) {
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
        .sort({ at: 1 })
        .limit(USAGE_QUERY_LIMIT)
        .toArray();

    var staffNames = await loadStaffNameMap(db);
    var byUser = {};

    items.forEach(function (doc) {
        var cat = categorizeLog(doc);
        var uid = String(doc.userId || "").trim();
        if (!uid) return;
        var key = cat + "\t" + uid.toLowerCase();
        if (!byUser[key]) {
            byUser[key] = { category: cat, userId: uid, events: [] };
        }
        byUser[key].events.push(doc);
    });

    var staff = [];
    var vendors = [];
    var guests = [];
    var summary = {
        staffLogins: 0,
        staffPageViews: 0,
        staffDurationMs: 0,
        vendorLogins: 0,
        vendorPageViews: 0,
        vendorDurationMs: 0,
        guestLogins: 0,
        guestPageViews: 0,
        guestDurationMs: 0
    };

    Object.keys(byUser).forEach(function (key) {
        var row = byUser[key];
        var stat = summarizeUserEvents(row.events);
        var entry = {
            userId: row.userId,
            label: stat.label || row.userId,
            role: stat.role || "",
            loginCount: stat.loginCount,
            pageViews: stat.pageViews,
            sessionCount: stat.sessionCount,
            totalDurationMs: stat.totalDurationMs,
            avgSessionMs: stat.avgSessionMs,
            lastLoginAt: stat.lastLoginAt || 0
        };
        if (row.category === "staff") {
            var sid = normalizeStaffLoginId(row.userId);
            if (staffNames[sid]) entry.label = staffNames[sid];
            staff.push(entry);
            summary.staffLogins += stat.loginCount;
            summary.staffPageViews += stat.pageViews;
            summary.staffDurationMs += stat.totalDurationMs;
        } else if (row.category === "vendor") {
            entry.vendorRegisteredBy = stat.vendorRegisteredBy || "";
            entry.adminName =
                staffNames[entry.vendorRegisteredBy] || entry.vendorRegisteredBy || "—";
            vendors.push(entry);
            summary.vendorLogins += stat.loginCount;
            summary.vendorPageViews += stat.pageViews;
            summary.vendorDurationMs += stat.totalDurationMs;
        } else {
            entry.label = "게스트 " + String(row.userId).slice(-8);
            guests.push(entry);
            summary.guestLogins += stat.loginCount;
            summary.guestPageViews += stat.pageViews;
            summary.guestDurationMs += stat.totalDurationMs;
        }
    });

    function sortByDuration(a, b) {
        return (b.totalDurationMs || 0) - (a.totalDurationMs || 0);
    }
    staff.sort(sortByDuration);
    vendors.sort(sortByDuration);
    guests.sort(sortByDuration);

    var vendorsByAdminMap = {};
    vendors.forEach(function (v) {
        var adminId = v.vendorRegisteredBy || "legacy";
        if (!vendorsByAdminMap[adminId]) {
            vendorsByAdminMap[adminId] = {
                adminLoginId: adminId,
                adminName: staffNames[adminId] || (adminId === "legacy" ? "담당 미지정" : adminId),
                vendorCount: 0,
                loginCount: 0,
                pageViews: 0,
                totalDurationMs: 0,
                vendors: []
            };
        }
        var g = vendorsByAdminMap[adminId];
        g.vendorCount += 1;
        g.loginCount += v.loginCount;
        g.pageViews += v.pageViews;
        g.totalDurationMs += v.totalDurationMs;
        g.vendors.push(v);
    });

    var vendorsByAdmin = Object.keys(vendorsByAdminMap)
        .sort(function (a, b) {
            if (a === "legacy") return 1;
            if (b === "legacy") return -1;
            return a.localeCompare(b, "ko");
        })
        .map(function (k) {
            return vendorsByAdminMap[k];
        });

    var recent = items
        .slice()
        .sort(function (a, b) {
            return (b.at || 0) - (a.at || 0);
        })
        .slice(0, 100)
        .map(formatLogPublic);

    return {
        summary: summary,
        staff: staff,
        vendors: vendors,
        vendorsByAdmin: vendorsByAdmin,
        guests: guests,
        recent: recent,
        truncated: items.length >= USAGE_QUERY_LIMIT
    };
}

module.exports = {
    COLLECTION,
    ensureAccessLogIndexes,
    logAccessEvent,
    logStaffLogin,
    logVendorLogin,
    logGuestLogin,
    logPageView,
    logSessionEnd,
    queryAccessStats,
    queryUsageStats,
    parseYmdToMs,
    ymdFromMs
};
