const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { queryAccessStats, queryUsageStats, parseYmdToMs } = require("../lib/accessLog");
const { F: PF } = require("../lib/productFields");
const { F: VF } = require("../lib/vendorFields");
const { normalizeStaffLoginId } = require("../lib/orderAccess");
const { registeredByInFilter } = require("../lib/staffLoginId");

const router = express.Router();

async function aggregateByRegisteredBy(db, collectionName, field) {
    var pipeline = [
        {
            $group: {
                _id: {
                    $cond: [
                        {
                            $or: [
                                { $eq: ["$" + field, ""] },
                                { $eq: ["$" + field, null] },
                                { $not: ["$" + field] }
                            ]
                        },
                        "legacy",
                        { $toLower: { $trim: { input: { $toString: "$" + field } } } }
                    ]
                },
                count: { $sum: 1 }
            }
        }
    ];
    var rows = await db.collection(collectionName).aggregate(pipeline).toArray();
    var out = {};
    rows.forEach(function (r) {
        out[r._id || "legacy"] = r.count || 0;
    });
    return out;
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

router.get("/db-stats", requireRole("supervisor"), async function (req, res) {
    try {
        var db = getDb();
        var staffList = await db
            .collection("staff")
            .find({ active: { $ne: false } })
            .project({ loginId: 1, st_company: 1, role: 1 })
            .toArray();

        var productsBy = await aggregateByRegisteredBy(db, "products", PF.registeredBy);
        var vendorsBy = await aggregateByRegisteredBy(db, "vendors", VF.registeredBy);
        var vendorNewBy = await aggregateByRegisteredBy(db, "vendor_new", VF.registeredBy);
        var prospectsBy = await aggregateByRegisteredBy(db, "vendor_prospects", VF.registeredBy);
        var ordersBy = await aggregateByRegisteredBy(db, "orders", "vendorRegisteredBy");

        var adminKeys = {};
        staffList.forEach(function (s) {
            if (s.role === "admin" || s.role === "supervisor") {
                var id = normalizeStaffLoginId(s.loginId);
                if (id) adminKeys[id] = true;
            }
        });
        Object.keys(productsBy).forEach(function (k) {
            adminKeys[k] = true;
        });
        Object.keys(vendorsBy).forEach(function (k) {
            adminKeys[k] = true;
        });
        Object.keys(ordersBy).forEach(function (k) {
            adminKeys[k] = true;
        });

        var staffNameMap = {};
        staffList.forEach(function (s) {
            var id = normalizeStaffLoginId(s.loginId);
            if (id) staffNameMap[id] = String(s.st_company || s.loginId || id);
        });

        var byAdmin = Object.keys(adminKeys)
            .sort(function (a, b) {
                if (a === "legacy") return 1;
                if (b === "legacy") return -1;
                return a.localeCompare(b, "ko");
            })
            .map(function (loginId) {
                return {
                    loginId: loginId,
                    name: staffNameMap[loginId] || (loginId === "legacy" ? "기존(담당 미지정)" : loginId),
                    products: productsBy[loginId] || 0,
                    vendors: vendorsBy[loginId] || 0,
                    vendorNew: vendorNewBy[loginId] || 0,
                    vendorProspects: prospectsBy[loginId] || 0,
                    orders: ordersBy[loginId] || 0,
                    total:
                        (productsBy[loginId] || 0) +
                        (vendorsBy[loginId] || 0) +
                        (vendorNewBy[loginId] || 0) +
                        (vendorProspectsBy[loginId] || 0) +
                        (ordersBy[loginId] || 0)
                };
            });

        var totals = {
            products: await db.collection("products").countDocuments(),
            vendors: await db.collection("vendors").countDocuments(),
            vendorNew: await db.collection("vendor_new").countDocuments(),
            vendorProspects: await db.collection("vendor_prospects").countDocuments(),
            orders: await db.collection("orders").countDocuments(),
            staff: staffList.length
        };

        return res.json({ ok: true, totals: totals, byAdmin: byAdmin });
    } catch (e) {
        console.error("GET /api/supervisor/db-stats", e);
        return res.status(500).json({ ok: false, error: "DB 사용 통계를 불러오지 못했습니다." });
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

module.exports = router;
