const express = require("express");
const { getDb } = require("../db");
const { verifyStoredPassword, migrateDocPasswordToAscii } = require("../lib/passwordAscii");
const { signToken } = require("../middleware/auth");
const {
    findStaffByLogin,
    verifyStaffPassword,
    isStaffRole,
    isReservedStaffLoginId
} = require("../lib/staff");

const router = express.Router();
const GUEST_ID = "guest";

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

router.post("/login", async (req, res) => {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "");
        const idn = normalizeId(loginId);

        if (!loginId || !password) {
            return res.status(400).json({ ok: false, error: "아이디와 비밀번호를 입력해 주세요." });
        }

        const staff = await findStaffByLogin(loginId);
        if (staff && isStaffRole(staff.role)) {
            const valid = await verifyStaffPassword(staff, password);
            if (!valid) {
                return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
            }
            const token = signToken({ role: staff.role, userId: staff.loginId });
            return res.json({
                ok: true,
                role: staff.role,
                userId: staff.loginId,
                companyName: staff.role === "supervisor" ? "슈퍼바이저" : "(주)더존",
                displayName: staff.name || staff.loginId,
                token
            });
        }

        if (isReservedStaffLoginId(loginId)) {
            const legacyPw = String(process.env.THEJHON_ADMIN_PASSWORD || "").trim();
            if (legacyPw && password === legacyPw) {
                const token = signToken({ role: "admin", userId: loginId });
                return res.json({
                    ok: true,
                    role: "admin",
                    userId: loginId,
                    companyName: "(주)더존",
                    token
                });
            }
            return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
        }

        if (idn === normalizeId(GUEST_ID)) {
            const guestPw = String(process.env.THEJHON_GUEST_PASSWORD || "guest").trim();
            if (password !== guestPw) {
                return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
            }
            const token = signToken({ role: "guest", userId: GUEST_ID });
            return res.json({ ok: true, role: "guest", userId: GUEST_ID, companyName: "", token });
        }

        const vendors = getDb().collection("vendors");
        const vendor = await vendors.findOne({ loginIdNorm: idn });
        if (!vendor) {
            return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
        }

        const vendorCheck = await verifyStoredPassword(vendor, password);
        if (vendorCheck.valid && vendorCheck.migrateAscii) {
            await migrateDocPasswordToAscii(vendors, { id: vendor.id }, password);
        }

        if (!vendorCheck.valid) {
            return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
        }

        const token = signToken({ role: "vendor", userId: vendor.loginId });
        return res.json({
            ok: true,
            role: "vendor",
            userId: vendor.loginId,
            companyName: String(vendor.companyName || "").trim(),
            token
        });
    } catch (e) {
        console.error("POST /api/auth/login", e);
        return res.status(500).json({ ok: false, error: "로그인 처리 중 오류가 발생했습니다." });
    }
});

module.exports = router;
