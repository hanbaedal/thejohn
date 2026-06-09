const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { queryAccessStats, queryUsageStats, parseYmdToMs } = require("../lib/accessLog");
const { querySolapiStats } = require("../lib/solapiLog");
const { isSolapiConfigured } = require("../lib/solapiSms");
const { F: PF } = require("../lib/productFields");
const { F: VF } = require("../lib/vendorFields");
const { normalizeStaffLoginId } = require("../lib/orderAccess");
const { registeredByInFilter, staffLoginIdKey, isLegacyRegisteredBy } = require("../lib/staffLoginId");

const router = express.Router();

function registeredByKey(loginId) {
    if (loginId === undefined || loginId === null || loginId === "" || isLegacyRegisteredBy(loginId)) {
        return "legacy";
    }
    return staffLoginIdKey(loginId) || "legacy";
}

function compareAdminKeys(a, b) {
    if (a === "legacy") return 1;
    if (b === "legacy") return -1;
    try {
        return a.localeCompare(b, "ko");
    } catch (localeErr) {
        return a.localeCompare(b);
    }
}

/** 담당 관리자별 건수 — 단순 $group 후 JS 정규화 */
async function aggregateByRegisteredBy(db, collectionName, field) {
    var out = {};
    var rows = await db
        .collection(collectionName)
        .aggregate([{ $group: { _id: "$" + field, count: { $sum: 1 } } }], { maxTimeMS: 90000 })
        .toArray();
    rows.forEach(function (row) {
        var key = registeredByKey(row._id);
        out[key] = (out[key] || 0) + (row.count || 0);
    });
    return out;
}

async function safeAggregateByRegisteredBy(db, collectionName, field) {
    try {
        return await aggregateByRegisteredBy(db, collectionName, field);
    } catch (e) {
        console.error("[db-stats] aggregate", collectionName, field, e.message);
        return {};
    }
}

async function safeCountCollection(db, collectionName) {
    try {
        return await db.collection(collectionName).countDocuments();
    } catch (e) {
        console.error("[db-stats] count", collectionName, e.message);
        try {
            return await db.collection(collectionName).estimatedDocumentCount();
        } catch (e2) {
            return 0;
        }
    }
}

/** 담당 관리자별 문서 BSON 크기 합(바이트) */
async function aggregateBytesByRegisteredBy(db, collectionName, field) {
    var out = {};
    var rows = await db
        .collection(collectionName)
        .aggregate(
            [{ $group: { _id: "$" + field, bytes: { $sum: { $bsonSize: "$$ROOT" } } } }],
            { maxTimeMS: 120000 }
        )
        .toArray();
    rows.forEach(function (row) {
        var key = registeredByKey(row._id);
        out[key] = (out[key] || 0) + (Number(row.bytes) || 0);
    });
    return out;
}

async function safeAggregateBytesByRegisteredBy(db, collectionName, field) {
    try {
        return await aggregateBytesByRegisteredBy(db, collectionName, field);
    } catch (e) {
        console.error("[db-stats] bytes", collectionName, field, e.message);
        return {};
    }
}

function mergeNumericMaps(maps) {
    var out = {};
    (maps || []).forEach(function (m) {
        Object.keys(m || {}).forEach(function (k) {
            out[k] = (out[k] || 0) + (m[k] || 0);
        });
    });
    return out;
}

function sumMapValues(m) {
    return Object.keys(m || {}).reduce(function (s, k) {
        return s + (m[k] || 0);
    }, 0);
}

function buildUsageByAdmin(usageResult) {
    var out = {};
    function ensure(key) {
        if (!out[key]) {
            out[key] = {
                durationMs: 0,
                pageViews: 0,
                logins: 0,
                lastActiveAt: 0
            };
        }
        return out[key];
    }
    (usageResult.staff || []).forEach(function (s) {
        var key = registeredByKey(s.userId);
        var row = ensure(key);
        row.durationMs += Number(s.totalDurationMs) || 0;
        row.pageViews += Number(s.pageViews) || 0;
        row.logins += Number(s.loginCount) || 0;
        var last = Number(s.lastLoginAt) || 0;
        if (last > row.lastActiveAt) row.lastActiveAt = last;
    });
    (usageResult.vendorsByAdmin || []).forEach(function (g) {
        var key = registeredByKey(g.adminLoginId);
        var row = ensure(key);
        row.durationMs += Number(g.totalDurationMs) || 0;
        row.pageViews += Number(g.pageViews) || 0;
        row.logins += Number(g.loginCount) || 0;
    });
    return out;
}

function defaultUsageDateRange() {
    var to = new Date();
    var from = new Date(to);
    from.setDate(from.getDate() - 30);
    function ymd(d) {
        return (
            String(d.getFullYear()) +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0")
        );
    }
    return { dateFrom: ymd(from), dateTo: ymd(to) };
}

router.get("/usage-stats", requireRole("supervisor"), async function (req, res) {
    try {
        var dateFrom = String(req.query.dateFrom || "").trim();
        var dateTo = String(req.query.dateTo || "").trim();
        var result = await queryUsageStats(getDb(), dateFrom, dateTo);
        if (result.error) {
            return res.status(400).json({ ok: false, error: result.error });
        }
        return res.json({
            ok: true,
            summary: result.summary,
            staff: result.staff,
            vendors: result.vendors,
            vendorsByAdmin: result.vendorsByAdmin,
            guests: result.guests,
            recent: result.recent,
            truncated: result.truncated
        });
    } catch (e) {
        console.error("GET /api/supervisor/usage-stats", e);
        return res.status(500).json({ ok: false, error: "이용 통계를 불러오지 못했습니다." });
    }
});

router.get("/access-stats", requireRole("supervisor"), async function (req, res) {
    try {
        var dateFrom = String(req.query.dateFrom || "").trim();
        var dateTo = String(req.query.dateTo || "").trim();
        var result = await queryAccessStats(getDb(), dateFrom, dateTo);
        if (result.error) {
            return res.status(400).json({ ok: false, error: result.error });
        }
        return res.json({ ok: true, summary: result.summary, byDay: result.byDay, items: result.items });
    } catch (e) {
        console.error("GET /api/supervisor/access-stats", e);
        return res.status(500).json({ ok: false, error: "접속 통계를 불러오지 못했습니다." });
    }
});

router.get("/solapi-stats", requireRole("supervisor"), async function (req, res) {
    try {
        var dateFrom = String(req.query.dateFrom || "").trim();
        var dateTo = String(req.query.dateTo || "").trim();
        var result = await querySolapiStats(getDb(), dateFrom, dateTo);
        if (result.error) {
            return res.status(400).json({ ok: false, error: result.error });
        }
        return res.json({
            ok: true,
            configured: isSolapiConfigured(),
            summary: result.summary,
            byAdmin: result.byAdmin,
            recent: result.recent,
            truncated: result.truncated
        });
    } catch (e) {
        console.error("GET /api/supervisor/solapi-stats", e);
        return res.status(500).json({ ok: false, error: "SOLAPI 이용 현황을 불러오지 못했습니다." });
    }
});

router.get("/db-stats", requireRole("supervisor"), async function (req, res) {
    try {
        var db = getDb();
        var period = defaultUsageDateRange();
        var dateFrom = String(req.query.dateFrom || period.dateFrom).trim();
        var dateTo = String(req.query.dateTo || period.dateTo).trim();

        var staffList = await db
            .collection("staff")
            .find(
                { active: { $ne: false } },
                { projection: { loginId: 1, st_company: 1, role: 1 } }
            )
            .toArray();

        var agg = await Promise.all([
            safeAggregateByRegisteredBy(db, "products", PF.registeredBy),
            safeAggregateByRegisteredBy(db, "vendors", VF.registeredBy),
            safeAggregateByRegisteredBy(db, "vendor_new", VF.registeredBy),
            safeAggregateByRegisteredBy(db, "vendor_prospects", VF.registeredBy),
            safeAggregateByRegisteredBy(db, "orders", "vendorRegisteredBy"),
            safeAggregateBytesByRegisteredBy(db, "products", PF.registeredBy),
            safeAggregateBytesByRegisteredBy(db, "vendors", VF.registeredBy),
            safeAggregateBytesByRegisteredBy(db, "vendor_new", VF.registeredBy),
            safeAggregateBytesByRegisteredBy(db, "vendor_prospects", VF.registeredBy),
            safeAggregateBytesByRegisteredBy(db, "orders", "vendorRegisteredBy"),
            queryUsageStats(db, dateFrom, dateTo)
        ]);
        var productsBy = agg[0];
        var vendorsBy = agg[1];
        var vendorNewBy = agg[2];
        var prospectsBy = agg[3];
        var ordersBy = agg[4];
        var storageBy = mergeNumericMaps([agg[5], agg[6], agg[7], agg[8], agg[9]]);
        var usageResult = agg[10] || {};
        if (usageResult.error) {
            return res.status(400).json({ ok: false, error: usageResult.error });
        }
        var usageByAdmin = buildUsageByAdmin(usageResult);

        var adminKeys = {};
        staffList.forEach(function (s) {
            if (s.role === "admin" || s.role === "supervisor") {
                var id = registeredByKey(s.loginId);
                if (id) adminKeys[id] = true;
            }
        });
        Object.keys(productsBy).forEach(function (k) {
            adminKeys[k] = true;
        });
        Object.keys(vendorsBy).forEach(function (k) {
            adminKeys[k] = true;
        });
        Object.keys(vendorNewBy).forEach(function (k) {
            adminKeys[k] = true;
        });
        Object.keys(prospectsBy).forEach(function (k) {
            adminKeys[k] = true;
        });
        Object.keys(ordersBy).forEach(function (k) {
            adminKeys[k] = true;
        });

        var staffNameMap = {};
        staffList.forEach(function (s) {
            var id = registeredByKey(s.loginId);
            if (id && id !== "legacy") {
                staffNameMap[id] = String(s.st_company || s.loginId || id);
            }
        });

        var byAdmin = Object.keys(adminKeys)
            .sort(compareAdminKeys)
            .map(function (loginId) {
                var usage = usageByAdmin[loginId] || {};
                return {
                    loginId: loginId,
                    name: staffNameMap[loginId] || (loginId === "legacy" ? "기존(담당 미지정)" : loginId),
                    storageBytes: storageBy[loginId] || 0,
                    usageDurationMs: usage.durationMs || 0,
                    usagePageViews: usage.pageViews || 0,
                    usageLogins: usage.logins || 0,
                    lastActiveAt: usage.lastActiveAt || 0,
                    products: productsBy[loginId] || 0,
                    vendors: vendorsBy[loginId] || 0,
                    vendorNew: vendorNewBy[loginId] || 0,
                    vendorProspects: prospectsBy[loginId] || 0,
                    orders: ordersBy[loginId] || 0,
                    total:
                        (productsBy[loginId] || 0) +
                        (vendorsBy[loginId] || 0) +
                        (vendorNewBy[loginId] || 0) +
                        (prospectsBy[loginId] || 0) +
                        (ordersBy[loginId] || 0)
                };
            });

        var counts = await Promise.all([
            safeCountCollection(db, "products"),
            safeCountCollection(db, "vendors"),
            safeCountCollection(db, "vendor_new"),
            safeCountCollection(db, "vendor_prospects"),
            safeCountCollection(db, "orders")
        ]);
        var totals = {
            products: counts[0],
            vendors: counts[1],
            vendorNew: counts[2],
            vendorProspects: counts[3],
            orders: counts[4],
            staff: staffList.length,
            storageBytes: sumMapValues(storageBy),
            usageDurationMs:
                (Number(usageResult.summary && usageResult.summary.staffDurationMs) || 0) +
                (Number(usageResult.summary && usageResult.summary.vendorDurationMs) || 0)
        };

        return res.json({
            ok: true,
            totals: totals,
            byAdmin: byAdmin,
            period: { dateFrom: dateFrom, dateTo: dateTo },
            usageTruncated: !!usageResult.truncated
        });
    } catch (e) {
        console.error("GET /api/supervisor/db-stats", e);
        return res.status(500).json({
            ok: false,
            error: "DB 사용 통계를 불러오지 못했습니다.",
            detail: e && e.message ? String(e.message) : ""
        });
    }
});

router.get("/order-stats", requireRole("supervisor"), async function (req, res) {
    try {
        var dateFrom = String(req.query.dateFrom || "").trim();
        var dateTo = String(req.query.dateTo || "").trim();
        var adminStaffId = normalizeStaffLoginId(req.query.adminStaffId || "");

        var fromMs = parseYmdToMs(dateFrom, false);
        var toMs = parseYmdToMs(dateTo, true);
        if ((dateFrom && !fromMs) || (dateTo && !toMs)) {
            return res.status(400).json({ ok: false, error: "기간 날짜 형식이 올바르지 않습니다." });
        }
        if (fromMs && toMs && fromMs >= toMs) {
            return res.status(400).json({ ok: false, error: "기간 선택이 올바르지 않습니다." });
        }

        var query = {};
        if (adminStaffId) query.vendorRegisteredBy = registeredByInFilter(adminStaffId);
        if (fromMs || toMs) {
            query.createdAt = {};
            if (fromMs) query.createdAt.$gte = fromMs;
            if (toMs) query.createdAt.$lt = toMs;
        }

        var orders = await getDb()
            .collection("orders")
            .find(query)
            .sort({ createdAt: -1 })
            .limit(500)
            .toArray();

        var totalAmount = orders.reduce(function (s, o) {
            return s + (Number(o.totalAmount) || 0);
        }, 0);

        var byAdminMap = {};
        orders.forEach(function (o) {
            var key = normalizeStaffLoginId(o.vendorRegisteredBy) || "legacy";
            if (!byAdminMap[key]) {
                byAdminMap[key] = { loginId: key, count: 0, totalAmount: 0, name: o.vendorRegisteredByName || key };
            }
            byAdminMap[key].count += 1;
            byAdminMap[key].totalAmount += Number(o.totalAmount) || 0;
        });

        return res.json({
            ok: true,
            summary: {
                count: orders.length,
                totalAmount: totalAmount
            },
            byAdmin: Object.keys(byAdminMap)
                .sort()
                .map(function (k) {
                    return byAdminMap[k];
                }),
            items: orders.map(function (order) {
                return {
                    id: order.id,
                    orderNo: order.orderNo,
                    vendorCompany: order.vendorCompany,
                    vendorRegisteredBy: order.vendorRegisteredBy,
                    vendorRegisteredByName: order.vendorRegisteredByName,
                    totalAmount: order.totalAmount,
                    createdAt: order.createdAt,
                    status: order.status || "submitted",
                    itemCount: Array.isArray(order.items) ? order.items.length : 0
                };
            })
        });
    } catch (e) {
        console.error("GET /api/supervisor/order-stats", e);
        return res.status(500).json({ ok: false, error: "발주서 통계를 불러오지 못했습니다." });
    }
});

/** Word·PPT 매뉴얼 재생성 (scripts/generate-*.py) — 슈퍼바이저 전용 */
router.post("/regenerate-docs", requireRole("supervisor"), async function (req, res) {
    try {
        const { regenerateAllDocs } = require("../lib/regenerateDocs");
        const payload = await regenerateAllDocs();
        res.json(payload);
    } catch (e) {
        console.error("POST /api/supervisor/regenerate-docs", e);
        res.status(e.status || 500).json({
            ok: false,
            error: e.message || "문서를 생성하지 못했습니다."
        });
    }
});

router.get("/docs-info", requireRole("supervisor"), function (req, res) {
    try {
        const { listDocFileStats } = require("../lib/regenerateDocs");
        res.json({ ok: true, files: listDocFileStats() });
    } catch (e) {
        console.error("GET /api/supervisor/docs-info", e);
        res.status(500).json({ ok: false, error: "문서 정보를 불러오지 못했습니다." });
    }
});

module.exports = router;
