const { parseYmdToMs } = require("./accessLog");
const { staffLoginIdKey, isLegacyRegisteredBy } = require("./staffLoginId");

const COLLECTION = "solapi_logs";

function newLogId() {
    return "slog_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function adminKey(loginId) {
    if (!loginId || isLegacyRegisteredBy(loginId)) return "legacy";
    return staffLoginIdKey(loginId) || "legacy";
}

async function ensureSolapiLogIndexes(db) {
    const col = db.collection(COLLECTION);
    try {
        await col.createIndex({ at: -1 }, { name: "solapi_logs_at" });
        await col.createIndex({ vendorRegisteredBy: 1, at: -1 }, { name: "solapi_logs_admin_at" });
        await col.createIndex({ vendorUserId: 1, at: -1 }, { name: "solapi_logs_vendor_at" });
    } catch (e) {
        console.warn("[thejohn] solapi_logs index:", e.message);
    }
}

/**
 * 업체 주문 SMS(SOLAPI) 발송 기록
 * @param {object} db
 * @param {object} order
 * @param {object} result notifyOrderAdmin 반환값
 */
async function logSolapiSend(db, order, result) {
    if (!db || !order) return null;
    result = result || {};
    order = order || {};
    const doc = {
        id: newLogId(),
        at: Date.now(),
        vendorRegisteredBy: String(order.vendorRegisteredBy || "").trim(),
        vendorRegisteredByName: String(order.vendorRegisteredByName || "").trim(),
        vendorUserId: String(order.vendorUserId || "").trim(),
        vendorCompany: String(order.vendorCompany || "").trim(),
        orderId: String(order.id || "").trim(),
        orderNo: String(order.orderNo || "").trim(),
        to: String(result.to || "").trim(),
        ok: !!result.ok,
        skipped: !!result.skipped,
        error: String(result.error || result.reason || "").trim(),
        groupId: String(result.groupId || "").trim(),
        mode: String(result.mode || "").trim()
    };
    await db.collection(COLLECTION).insertOne(doc);
    return doc;
}

async function loadStaffNameMap(db) {
    const map = {};
    try {
        const rows = await db
            .collection("staff")
            .find({ active: { $ne: false } }, { projection: { loginId: 1, st_company: 1 } })
            .toArray();
        rows.forEach(function (s) {
            const key = adminKey(s.loginId);
            if (key && key !== "legacy") {
                map[key] = String(s.st_company || s.loginId || key);
            }
        });
    } catch (e) {}
    return map;
}

function compareAdminKeys(a, b) {
    if (a === "legacy") return 1;
    if (b === "legacy") return -1;
    try {
        return a.localeCompare(b, "ko");
    } catch (e) {
        return a.localeCompare(b);
    }
}

async function querySolapiStats(db, dateFrom, dateTo) {
    const fromMs = parseYmdToMs(dateFrom, false);
    const toMs = parseYmdToMs(dateTo, true);
    if ((dateFrom && !fromMs) || (dateTo && !toMs)) {
        return { error: "기간 날짜 형식이 올바르지 않습니다." };
    }
    if (fromMs && toMs && fromMs >= toMs) {
        return { error: "기간 선택이 올바르지 않습니다." };
    }

    const filter = {};
    if (fromMs || toMs) {
        filter.at = {};
        if (fromMs) filter.at.$gte = fromMs;
        if (toMs) filter.at.$lt = toMs;
    }

    const items = await db
        .collection(COLLECTION)
        .find(filter)
        .sort({ at: -1 })
        .limit(5000)
        .toArray();

    const staffNames = await loadStaffNameMap(db);
    const byAdminMap = {};
    const summary = { attempts: 0, success: 0, failed: 0, skipped: 0 };

    items.forEach(function (doc) {
        const adminId = adminKey(doc.vendorRegisteredBy);
        const vendorId = String(doc.vendorUserId || "").trim() || "(미지정)";
        summary.attempts += 1;
        if (doc.skipped) summary.skipped += 1;
        else if (doc.ok) summary.success += 1;
        else summary.failed += 1;

        if (!byAdminMap[adminId]) {
            byAdminMap[adminId] = {
                loginId: adminId,
                name:
                    staffNames[adminId] ||
                    (adminId === "legacy" ? "기존(담당 미지정)" : doc.vendorRegisteredByName || adminId),
                attempts: 0,
                success: 0,
                failed: 0,
                skipped: 0,
                vendors: {}
            };
        }
        const g = byAdminMap[adminId];
        g.attempts += 1;
        if (doc.skipped) g.skipped += 1;
        else if (doc.ok) g.success += 1;
        else g.failed += 1;

        if (!g.vendors[vendorId]) {
            g.vendors[vendorId] = {
                vendorUserId: vendorId,
                vendorCompany: String(doc.vendorCompany || "").trim(),
                attempts: 0,
                success: 0,
                failed: 0,
                skipped: 0,
                lastAt: 0
            };
        }
        const v = g.vendors[vendorId];
        v.attempts += 1;
        if (doc.skipped) v.skipped += 1;
        else if (doc.ok) v.success += 1;
        else v.failed += 1;
        if (!v.vendorCompany && doc.vendorCompany) v.vendorCompany = doc.vendorCompany;
        const at = Number(doc.at) || 0;
        if (at > v.lastAt) v.lastAt = at;
    });

    const byAdmin = Object.keys(byAdminMap)
        .sort(compareAdminKeys)
        .map(function (k) {
            const g = byAdminMap[k];
            const vendors = Object.keys(g.vendors)
                .map(function (vid) {
                    return g.vendors[vid];
                })
                .sort(function (a, b) {
                    return (b.attempts || 0) - (a.attempts || 0);
                });
            return {
                loginId: g.loginId,
                name: g.name,
                vendorCount: vendors.length,
                attempts: g.attempts,
                success: g.success,
                failed: g.failed,
                skipped: g.skipped,
                vendors: vendors
            };
        })
        .sort(function (a, b) {
            return (b.attempts || 0) - (a.attempts || 0);
        });

    const recent = items.slice(0, 80).map(function (doc) {
        const adminId = adminKey(doc.vendorRegisteredBy);
        return {
            at: doc.at,
            adminLoginId: adminId,
            adminName: staffNames[adminId] || doc.vendorRegisteredByName || adminId,
            vendorUserId: doc.vendorUserId,
            vendorCompany: doc.vendorCompany,
            orderNo: doc.orderNo,
            ok: doc.ok,
            skipped: doc.skipped,
            error: doc.error
        };
    });

    return {
        summary: summary,
        byAdmin: byAdmin,
        recent: recent,
        truncated: items.length >= 5000
    };
}

module.exports = {
    COLLECTION,
    ensureSolapiLogIndexes,
    logSolapiSend,
    querySolapiStats
};
