const express = require("express");
const { getDb } = require("../db");
const { loginLookupFilter } = require("../lib/loginAccount");
const { requireRole, extractBearer, verifyToken } = require("../middleware/auth");
const { isReservedStaffLoginId } = require("../lib/staff");
const {
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    validateLoginIdLength,
    F
} = require("../lib/vendorFields");
const {
    isStaffAuth,
    canReadVendor,
    canWriteVendor,
    buildVendorListQuery,
    stampNewVendorRegistration,
    applyRegistrationOnUpdate
} = require("../lib/vendorAccess");

const router = express.Router();

function newId() {
    return "vr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function isReservedAdminLoginId(loginId) {
    return isReservedStaffLoginId(loginId);
}

function vendorWriteErrorMessage(e) {
    if (e && e.code === 11000) {
        const key = e.keyPattern || {};
        if (key.loginId) return "이미 사용 중인 아이디입니다.";
        if (key.loginIdNorm) {
            return "DB 인덱스 충돌(loginIdNorm)입니다. 서버를 재배포한 뒤 다시 시도해 주세요.";
        }
        if (key.password) {
            return "같은 비밀번호를 쓰는 업체가 이미 있거나 DB 인덱스 충돌입니다. 서버 재배포 후 비밀번호를 다르게 설정해 보세요.";
        }
        return "중복된 값이 있어 저장할 수 없습니다.";
    }
    return "";
}

function optionalAuth(req) {
    const token = extractBearer(req);
    if (!token) return null;
    try {
        return verifyToken(token);
    } catch (e) {
        return null;
    }
}

async function findDuplicateVendor(vendors, loginId, excludeId) {
    const idFilter = loginLookupFilter(loginId);
    const filter = excludeId ? { $and: [idFilter, { id: { $ne: excludeId } }] } : idFilter;
    return vendors.findOne(filter);
}

async function findStaffLoginConflict(loginId) {
    return getDb().collection("staff").findOne(loginLookupFilter(loginId));
}

router.get("/", async (req, res) => {
    try {
        const auth = optionalAuth(req);
        const query = buildVendorListQuery(auth, req.query.registeredBy);
        const items = await getDb()
            .collection("vendors")
            .find(query)
            .sort({ updatedAt: -1 })
            .toArray();
        res.json({ ok: true, items: items.map(toPublic), scope: auth && isStaffAuth(auth) ? "staff" : "public" });
    } catch (e) {
        console.error("GET /api/vendors", e);
        res.status(500).json({ ok: false, error: "업체 목록을 불러오지 못했습니다." });
    }
});

router.get("/check-login-id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const loginId = String(req.query.loginId || "").trim();
        const excludeId = req.query.excludeId ? String(req.query.excludeId) : "";
        if (!loginId) {
            return res.json({ ok: true, duplicate: false });
        }
        const fmt = validateLoginIdLength(loginId);
        if (fmt) {
            return res.json({ ok: true, duplicate: false, invalid: true, error: fmt });
        }
        if (isReservedAdminLoginId(loginId)) {
            return res.json({
                ok: true,
                duplicate: true,
                reserved: true,
                error: "사용할 수 없는 아이디입니다."
            });
        }
        if (await findStaffLoginConflict(loginId)) {
            return res.json({
                ok: true,
                duplicate: true,
                error: "이미 관리자(staff)에 사용 중인 아이디입니다."
            });
        }
        const dup = await findDuplicateVendor(getDb().collection("vendors"), loginId, excludeId);
        res.json({
            ok: true,
            duplicate: !!dup,
            error: dup ? "이미 사용 중인 아이디입니다." : ""
        });
    } catch (e) {
        console.error("GET /api/vendors/check-login-id", e);
        res.status(500).json({ ok: false, error: "아이디 중복 확인에 실패했습니다." });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const auth = optionalAuth(req);
        const doc = await getDb().collection("vendors").findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "업체를 찾을 수 없습니다." });
        if (auth && isStaffAuth(auth) && !canReadVendor(auth, doc)) {
            return res.status(403).json({ ok: false, error: "이 업체를 조회할 권한이 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("GET /api/vendors/:id", e);
        res.status(500).json({ ok: false, error: "업체를 불러오지 못했습니다." });
    }
});

router.post("/", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "");

        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const built = buildFromBody(req.body, null, loginId, password);
        const err = validateBuilt(built, true);
        if (err) return res.status(400).json({ ok: false, error: err });

        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }

        const vendors = getDb().collection("vendors");
        const dup = await findDuplicateVendor(vendors, loginId);
        if (dup) return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });

        let doc = toDbDoc(newId(), built, null);
        doc = await stampNewVendorRegistration(doc, req.auth);
        await vendors.insertOne(doc);
        console.log(
            "[vendors] inserted:",
            doc.id,
            doc.loginId,
            doc.vn_company,
            "by",
            doc[F.registeredBy]
        );
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/vendors", e);
        const dup = vendorWriteErrorMessage(e);
        if (dup) return res.status(409).json({ ok: false, error: dup });
        res.status(500).json({ ok: false, error: "업체 저장에 실패했습니다." });
    }
});

router.put("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const id = req.params.id;
        const vendors = getDb().collection("vendors");
        const existing = await vendors.findOne({ id });
        if (!existing) return res.status(404).json({ ok: false, error: "업체를 찾을 수 없습니다." });
        if (!canWriteVendor(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 업체는 수정할 수 없습니다. 총괄(thejohn)에게 담당 변경을 요청하세요."
            });
        }

        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "");

        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const built = buildFromBody(req.body, existing, loginId, password);
        const err = validateBuilt(built, false);
        if (err) return res.status(400).json({ ok: false, error: err });

        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }

        const dup = await findDuplicateVendor(vendors, loginId, id);
        if (dup) return res.status(409).json({ ok: false, error: "이미 사용 중인 아이디입니다." });

        let doc = toDbDoc(id, built, existing);
        doc = await applyRegistrationOnUpdate(doc, existing, req.auth, req.body);
        await vendors.replaceOne({ id }, doc);
        console.log("[vendors] updated:", doc.id, doc.loginId, "owner", doc[F.registeredBy]);
        res.json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("PUT /api/vendors/:id", e);
        const dup = vendorWriteErrorMessage(e);
        if (dup) return res.status(409).json({ ok: false, error: dup });
        res.status(500).json({ ok: false, error: "업체 수정에 실패했습니다." });
    }
});

router.delete("/:id", requireRole("supervisor", "admin"), async (req, res) => {
    try {
        const existing = await getDb().collection("vendors").findOne({ id: req.params.id });
        if (!existing) {
            return res.status(404).json({ ok: false, error: "업체를 찾을 수 없습니다." });
        }
        if (!canWriteVendor(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 업체는 삭제할 수 없습니다."
            });
        }
        const result = await getDb().collection("vendors").deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ ok: false, error: "업체를 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/vendors/:id", e);
        res.status(500).json({ ok: false, error: "업체 삭제에 실패했습니다." });
    }
});

module.exports = router;
