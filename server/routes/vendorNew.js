const express = require("express");
const { getDb } = require("../db");
const { requireRole } = require("../middleware/auth");
const { isReservedStaffLoginId } = require("../lib/staff");
const {
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    validateLoginIdLength,
    validatePasswordLength,
    filterPartnerDepts,
    validatePartnerDeptsForRegister,
    F
} = require("../lib/vendorFields");
const { getVendorStoredPassword } = require("../lib/loginAccount");
const { findDuplicateCompanyInCollection, findLoginInCollection } = require("../lib/vendorCollections");
const {
    canReadVendor,
    canWriteVendor,
    buildVendorListQuery,
    stampNewVendorRegistration,
    applyRegistrationOnUpdate
} = require("../lib/vendorAccess");
const { findAnyVendorLoginConflict } = require("../lib/vendorCollections");
const {
    COLLECTION,
    newVendorNewId,
    toListItem,
    applyCompanyNormToDoc,
    findDuplicateNewCompany
} = require("../lib/vendorNew");

const router = express.Router();

function escapeRegex(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isReservedAdminLoginId(loginId) {
    return isReservedStaffLoginId(loginId);
}

function newPartnerVendorId() {
    return "vr_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function writeErrorMessage(e) {
    if (e && e.code === 11000) {
        const key = e.keyPattern || {};
        if (key.loginId) return "이미 사용 중인 아이디입니다.";
        return "중복된 값이 있어 저장할 수 없습니다.";
    }
    return "";
}

async function findStaffLoginConflict(loginId) {
    const { loginLookupFilter } = require("../lib/loginAccount");
    return getDb().collection("staff").findOne(loginLookupFilter(loginId));
}

router.get("/check-login-id", requireRole("supervisor", "admin"), async function (req, res) {
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
        const conflict = await findAnyVendorLoginConflict(getDb(), loginId, {
            newId: excludeId
        });
        res.json({
            ok: true,
            duplicate: !!conflict,
            error: conflict ? "이미 사용 중인 아이디입니다. (" + conflict.where + ")" : ""
        });
    } catch (e) {
        console.error("GET /api/vendor-new/check-login-id", e);
        res.status(500).json({ ok: false, error: "아이디 중복 확인에 실패했습니다." });
    }
});

/** 신규업체 목록 (vendor_new) */
router.get("/", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const q = String(req.query.q || "").trim();
        const filter = Object.assign({}, buildVendorListQuery(req.auth));
        if (q) {
            filter.vn_company = { $regex: escapeRegex(q), $options: "i" };
        }
        const docs = await getDb()
            .collection(COLLECTION)
            .find(filter)
            .sort({ updatedAt: -1 })
            .limit(500)
            .toArray();
        const items = [];
        for (const doc of docs) {
            const row = toListItem(doc);
            if (row) items.push(row);
        }
        res.json({ ok: true, items: items });
    } catch (e) {
        console.error("GET /api/vendor-new", e);
        res.status(500).json({ ok: false, error: "신규업체 목록을 불러오지 못했습니다." });
    }
});

router.get("/:id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const doc = await getDb().collection(COLLECTION).findOne({ id: req.params.id });
        if (!doc) return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        if (!canReadVendor(req.auth, doc)) {
            return res.status(403).json({ ok: false, error: "이 신규업체를 조회할 권한이 없습니다." });
        }
        res.json({ ok: true, item: toPublic(doc, { includePassword: true }) });
    } catch (e) {
        console.error("GET /api/vendor-new/:id", e);
        res.status(500).json({ ok: false, error: "신규업체를 불러오지 못했습니다." });
    }
});

router.post("/", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "").trim();

        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const body = Object.assign({}, req.body, { vn_record_type: "new" });
        const built = buildFromBody(body, null, loginId, password);
        const err = validateBuilt(built, true);
        if (err) return res.status(400).json({ ok: false, error: err });

        const db = getDb();
        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }
        const loginConflict = await findAnyVendorLoginConflict(db, loginId, {});
        if (loginConflict) {
            return res.status(409).json({
                ok: false,
                error: "이미 사용 중인 아이디입니다. (" + loginConflict.where + ")"
            });
        }
        const dupCompany = await findDuplicateNewCompany(db, built.vn_company);
        if (dupCompany) {
            return res.status(409).json({
                ok: false,
                error: "이미 등록된 업체명입니다: " + (built.vn_company || "")
            });
        }

        const col = db.collection(COLLECTION);
        let doc = toDbDoc(newVendorNewId(), built, null);
        doc = applyCompanyNormToDoc(doc, built.vn_company);
        if (req.body.prospectId) doc.vn_prospect_source_id = String(req.body.prospectId).trim();
        doc = await stampNewVendorRegistration(doc, req.auth);
        await col.insertOne(doc);
        console.log(
            "[vendor_new] inserted:",
            doc.id,
            doc.loginId,
            doc.vn_company,
            "by",
            doc[F.registeredBy]
        );
        res.status(201).json({ ok: true, item: toPublic(doc, { includePassword: true }) });
    } catch (e) {
        console.error("POST /api/vendor-new", e);
        const dup = writeErrorMessage(e);
        if (dup) return res.status(409).json({ ok: false, error: dup });
        res.status(500).json({ ok: false, error: "신규업체 저장에 실패했습니다." });
    }
});

router.put("/:id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const id = req.params.id;
        const col = getDb().collection(COLLECTION);
        const existing = await col.findOne({ id });
        if (!existing) return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        if (!canWriteVendor(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 신규업체는 수정할 수 없습니다."
            });
        }

        const loginId = String(req.body.loginId || "").trim();
        const password = String(req.body.password || "").trim();
        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const body = Object.assign({}, req.body, { vn_record_type: "new" });
        const built = buildFromBody(body, existing, loginId, password);
        const err = validateBuilt(built, false);
        if (err) return res.status(400).json({ ok: false, error: err });

        const db = getDb();
        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }
        const loginConflict = await findAnyVendorLoginConflict(db, loginId, { newId: id });
        if (loginConflict) {
            return res.status(409).json({
                ok: false,
                error: "이미 사용 중인 아이디입니다. (" + loginConflict.where + ")"
            });
        }
        const dupCompany = await findDuplicateNewCompany(db, built.vn_company, id);
        if (dupCompany) {
            return res.status(409).json({
                ok: false,
                error: "이미 등록된 업체명입니다: " + (built.vn_company || "")
            });
        }

        let doc = toDbDoc(id, built, existing);
        doc = applyCompanyNormToDoc(doc, built.vn_company);
        doc = await applyRegistrationOnUpdate(doc, existing, req.auth, req.body);
        await col.replaceOne({ id }, doc);
        console.log("[vendor_new] updated:", doc.id, doc.loginId);
        res.json({ ok: true, item: toPublic(doc, { includePassword: true }) });
    } catch (e) {
        console.error("PUT /api/vendor-new/:id", e);
        const dup = writeErrorMessage(e);
        if (dup) return res.status(409).json({ ok: false, error: dup });
        res.status(500).json({ ok: false, error: "신규업체 수정에 실패했습니다." });
    }
});

/** 신규업체 → 거래처(vendors) 업체등록 */
router.post("/:id/promote-to-vendor", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const id = req.params.id;
        const col = getDb().collection(COLLECTION);
        const existing = await col.findOne({ id });
        if (!existing) {
            return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        }
        if (!canWriteVendor(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 신규업체는 업체등록할 수 없습니다."
            });
        }
        if (existing.vn_promoted_vendor_id) {
            return res.status(409).json({
                ok: false,
                error: "이미 업체등록(거래처)으로 등록되었습니다.",
                vendorId: String(existing.vn_promoted_vendor_id)
            });
        }

        const loginId = String(req.body.loginId || existing.loginId || "").trim();
        const password = String(req.body.password || "").trim();
        if (isReservedAdminLoginId(loginId)) {
            return res.status(400).json({ ok: false, error: "사용할 수 없는 아이디입니다." });
        }

        const body = Object.assign({}, req.body, { vn_record_type: "partner" });
        const built = buildFromBody(body, existing, loginId, password);
        built.vn_depts = filterPartnerDepts(built.vn_depts);
        const deptErr = validatePartnerDeptsForRegister(built.vn_depts);
        if (deptErr) return res.status(400).json({ ok: false, error: deptErr });

        const idErr = validateLoginIdLength(built.loginId);
        if (idErr) return res.status(400).json({ ok: false, error: idErr });
        const pwPlain = built.passwordPlain || getVendorStoredPassword(existing);
        built.passwordPlain = pwPlain;
        const pwErr = validatePasswordLength(pwPlain, true);
        if (pwErr) return res.status(400).json({ ok: false, error: pwErr });
        if (!built.vn_company) {
            return res.status(400).json({ ok: false, error: "업체이름을 입력해 주세요." });
        }
        if (!built.vn_grade) {
            return res.status(400).json({ ok: false, error: "업체등급(Silver/Gold/Diamond)을 선택해 주세요." });
        }

        const db = getDb();
        if (await findStaffLoginConflict(loginId)) {
            return res.status(409).json({ ok: false, error: "이미 관리자(staff)에 사용 중인 아이디입니다." });
        }
        if (await findLoginInCollection(db, "vendors", loginId, null)) {
            return res.status(409).json({ ok: false, error: "이미 거래처에 사용 중인 아이디입니다." });
        }
        const loginConflict = await findAnyVendorLoginConflict(db, loginId, { newId: id });
        if (loginConflict) {
            return res.status(409).json({
                ok: false,
                error: "이미 사용 중인 아이디입니다. (" + loginConflict.where + ")"
            });
        }
        const dupCompany = await findDuplicateCompanyInCollection(db, "vendors", built.vn_company, null);
        if (dupCompany) {
            return res.status(409).json({
                ok: false,
                error: "이미 등록된 업체명입니다: " + (built.vn_company || "")
            });
        }

        const vendorsCol = db.collection("vendors");
        let doc = toDbDoc(newPartnerVendorId(), built, existing);
        doc[F.recordType] = "partner";
        doc.vn_source_new_id = id;
        doc = applyCompanyNormToDoc(doc, built.vn_company);
        doc = await stampNewVendorRegistration(doc, req.auth);
        await vendorsCol.insertOne(doc);
        await col.updateOne(
            { id },
            {
                $set: {
                    vn_promoted_vendor_id: doc.id,
                    vn_promoted_at: Date.now(),
                    updatedAt: Date.now()
                }
            }
        );
        console.log(
            "[vendor_new] promoted to vendors:",
            id,
            "->",
            doc.id,
            doc.loginId,
            doc.vn_company
        );
        res.status(201).json({ ok: true, item: toPublic(doc) });
    } catch (e) {
        console.error("POST /api/vendor-new/:id/promote-to-vendor", e);
        const dup = writeErrorMessage(e);
        if (dup) return res.status(409).json({ ok: false, error: dup });
        res.status(500).json({ ok: false, error: "업체등록에 실패했습니다." });
    }
});

router.delete("/:id", requireRole("supervisor", "admin"), async function (req, res) {
    try {
        const col = getDb().collection(COLLECTION);
        const existing = await col.findOne({ id: req.params.id });
        if (!existing) {
            return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        }
        if (!canWriteVendor(req.auth, existing)) {
            return res.status(403).json({
                ok: false,
                error: "다른 관리자가 등록한 신규업체는 삭제할 수 없습니다."
            });
        }
        const result = await col.deleteOne({ id: req.params.id });
        if (result.deletedCount === 0) {
            return res.status(404).json({ ok: false, error: "신규업체를 찾을 수 없습니다." });
        }
        res.json({ ok: true });
    } catch (e) {
        console.error("DELETE /api/vendor-new/:id", e);
        res.status(500).json({ ok: false, error: "신규업체 삭제에 실패했습니다." });
    }
});

module.exports = router;
