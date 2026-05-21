const express = require("express");
const bcrypt = require("bcryptjs");
const { getDb } = require("../db");
const { signToken } = require("../middleware/auth");

const router = express.Router();

const ADMIN_ID = "thejohn";
const GUEST_ID = "guest";

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

function isReservedAdminLoginId(idn) {
    return idn === normalizeId(ADMIN_ID) || idn === "thejhon";
}

router.post("/login", async (req, res) => {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "");
        const idn = normalizeId(loginId);

        if (!loginId || !password) {
            return res.status(400).json({ ok: false, error: "아이디와 비밀번호를 입력해 주세요." });
        }

        if (isReservedAdminLoginId(idn)) {
            const adminPw = String(process.env.THEJHON_ADMIN_PASSWORD || "").trim();
            if (!adminPw || password !== adminPw) {
                return res.status(401).json({ ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." });
            }
            const token = signToken({ role: "admin", userId: loginId });
            return res.json({
                ok: true,
                role: "admin",
                userId: loginId,
                companyName: "(주)더존",
                token
            });
        }

        if (idn === normalizeId(GUEST_ID)) {
            const guestPw = process.env.THEJHON_GUEST_PASSWORD || "guest";
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

        let valid = false;
        if (vendor.passwordHash) {
            valid = await bcrypt.compare(password, vendor.passwordHash);
        } else if (vendor.password) {
            valid = password === String(vendor.password);
            if (valid) {
                const passwordHash = await bcrypt.hash(password, 10);
                await vendors.updateOne({ id: vendor.id }, { $set: { passwordHash }, $unset: { password: "" } });
            }
        }

        if (!valid) {
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
