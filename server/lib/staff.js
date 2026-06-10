const { getDb } = require("../db");
const { loginLookupFilter, verifyLoginPassword, setLoginPassword, normalizeLoginId } = require("./loginAccount");
const {
    toPublic,
    buildFromBody,
    toDbDoc,
    getCompanyName,
    getCeoName,
    DEFAULT_STAFF_IDS,
    F: SF
} = require("./staffFields");
const { getStoredPassword } = require("./loginAccount");
const { validateLoginIdLength } = require("./vendorFields");
const { findAnyVendorLoginConflict } = require("./vendorCollections");
const {
    propagateStaffLoginIdChange,
    loginIdsEquivalent
} = require("./staffLoginIdMigration");
const { appendPreviousLoginIds } = require("./staffRegisteredBy");
const { normalizeStaffSealForDb } = require("./staffSealImage");

function str(v) {
    return String(v ?? "").trim();
}

function newStaffId() {
    return "st_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

async function ensureStaffIndexes(db) {
    const col = db.collection("staff");
    await col.createIndex({ loginId: 1 }, { unique: true });
    await col.createIndex({ id: 1 }, { unique: true });
}

async function findStaffByLogin(loginId) {
    return getDb().collection("staff").findOne(loginLookupFilter(loginId));
}

async function verifyStaffPassword(staff, loginId, password) {
    const result = await verifyLoginPassword(staff, loginId, password);
    if (result.valid && result.migratePassword != null) {
        await setLoginPassword(
            getDb().collection("staff"),
            { id: staff.id },
            loginId,
            result.migratePassword
        );
    }
    return result.valid;
}

function isStaffRole(role) {
    return role === "supervisor" || role === "admin";
}

function isReservedStaffLoginId(loginId) {
    const idn = normalizeLoginId(loginId);
    return idn === "thejohn" || idn === "thejhon";
}

function canAssignStaffLoginId(loginId, existingStaff) {
    if (!isReservedStaffLoginId(loginId)) return true;
    if (!existingStaff) return false;
    return loginIdsEquivalent(loginId, existingStaff.loginId);
}

function copyIfDefined(target, source, keys) {
    for (const key of keys) {
        if (source[key] !== undefined) target[key] = source[key];
    }
}

function normalizePickedSeal(picked, loginId, existing) {
    if (picked.st_seal === undefined) return;
    picked.st_seal = normalizeStaffSealForDb(picked.st_seal, {
        loginId: str(loginId || picked.loginId),
        id: existing && existing.id,
        st_company: picked.st_company || (existing && getCompanyName(existing))
    });
}

function pickStaffBody(body) {
    const picked = {
        loginId: body.loginId,
        st_company: body.st_company,
        st_phone: body.st_phone,
        st_fax: body.st_fax,
        st_ceo: body.st_ceo,
        st_ceo_tel: body.st_ceo_tel,
        st_email: body.st_email,
        st_web: body.st_web,
        st_biz_no: body.st_biz_no,
        st_biz_type: body.st_biz_type,
        st_biz_item: body.st_biz_item,
        st_facebook: body.st_facebook,
        st_instagram: body.st_instagram,
        st_naver_cafe: body.st_naver_cafe,
        st_youtube: body.st_youtube,
        st_kakao: body.st_kakao,
        name: body.name,
        loginEnabled: body.loginEnabled,
        orderEnabled: body.orderEnabled
    };
    copyIfDefined(picked, body, [
        "st_zip",
        "st_addr",
        "st_addr_detail",
        "st_address",
        "st_logo",
        "st_seal",
        "st_company_greeting",
        "st_company_intro_images"
    ]);
    return picked;
}

async function findStaffById(idOrLogin, opts) {
    opts = opts || {};
    const key = String(idOrLogin || "").trim();
    if (!key) return null;
    const col = getDb().collection("staff");
    const active = { active: { $ne: false } };
    const { STAFF_PROJECTION_NO_INTRO } = require("./staffFields");
    const findOpts =
        opts.light !== false && !opts.full
            ? { projection: STAFF_PROJECTION_NO_INTRO }
            : {};
    let doc = await col.findOne({ id: key, ...active }, findOpts);
    if (!doc) doc = await col.findOne({ loginId: key, ...active }, findOpts);
    if (!doc) {
        const lf = loginLookupFilter(key);
        doc = await col.findOne({ ...active, ...lf }, findOpts);
    }
    return doc;
}

async function findStaffLoginConflict(loginId, excludeStaffId) {
    const staffCol = getDb().collection("staff");
    const lf = loginLookupFilter(loginId);
    const filter = excludeStaffId
        ? { $and: [lf, { id: { $ne: excludeStaffId } }] }
        : lf;
    return staffCol.findOne(filter);
}

async function checkStaffLoginId(loginId, excludeStaffId) {
    const id = str(loginId);
    if (!id) {
        return { duplicate: false, invalid: true, error: "아이디를 입력해 주세요." };
    }
    const fmt = validateLoginIdLength(id);
    if (fmt) {
        return { duplicate: false, invalid: true, error: fmt };
    }
    let existing = null;
    if (excludeStaffId) {
        existing = await findStaffById(excludeStaffId);
    }
    // 신규 등록만 예약 아이디(thejohn 등) 차단 — 수정은 슈퍼바이저가 자유롭게 변경
    if (!excludeStaffId && !canAssignStaffLoginId(id, existing)) {
        return { duplicate: true, reserved: true, error: "사용할 수 없는 아이디입니다." };
    }
    if (await findStaffLoginConflict(id, excludeStaffId)) {
        return { duplicate: true, error: "이미 사용 중인 아이디입니다." };
    }
    const conflict = await findAnyVendorLoginConflict(getDb(), id, {});
    if (conflict) {
        return { duplicate: true, error: "이미 업체 등록에 사용 중인 아이디입니다." };
    }
    return { duplicate: false };
}

async function createStaffAccount(body, creatorRole) {
    const loginId = body.loginId;
    const password = body.password;
    const role = body.role || "admin";
    const idn = normalizeLoginId(loginId);
    if (!idn) throw new Error("아이디를 입력해 주세요.");
    const idErr = validateLoginIdLength(loginId);
    if (idErr) throw new Error(idErr);
    if (!canAssignStaffLoginId(loginId, null)) {
        throw new Error("사용할 수 없는 아이디입니다.");
    }
    if (role !== "admin") throw new Error("관리자(admin)만 추가할 수 있습니다.");
    if (creatorRole !== "supervisor") {
        throw new Error("슈퍼바이저만 관리자를 등록할 수 있습니다.");
    }
    if (!password || String(password).length < 4) {
        throw new Error("비밀번호는 4자 이상으로 입력해 주세요.");
    }
    if (!str(body.st_company)) throw new Error("회사명을 입력해 주세요.");

    if (await findAnyVendorLoginConflict(getDb(), loginId, {})) {
        throw new Error("이미 업체 등록에 사용 중인 아이디입니다.");
    }
    const staffCol = getDb().collection("staff");
    if (await findStaffLoginConflict(loginId, "")) {
        throw new Error("이미 사용 중인 아이디입니다.");
    }

    const picked = pickStaffBody(body);
    normalizePickedSeal(picked, loginId, null);
    const buildBody = {
        st_company: picked.st_company || picked.name,
        st_phone: picked.st_phone,
        st_fax: picked.st_fax,
        st_ceo: picked.st_ceo || picked.name,
        st_ceo_tel: picked.st_ceo_tel,
        st_email: picked.st_email,
        st_web: picked.st_web,
        st_biz_no: picked.st_biz_no,
        st_biz_type: picked.st_biz_type,
        st_biz_item: picked.st_biz_item,
        st_facebook: picked.st_facebook,
        st_instagram: picked.st_instagram,
        st_naver_cafe: picked.st_naver_cafe,
        st_youtube: picked.st_youtube,
        st_kakao: picked.st_kakao,
        st_logo: picked.st_logo !== undefined ? picked.st_logo : "",
        st_seal: picked.st_seal !== undefined ? picked.st_seal : "",
        st_company_greeting:
            picked.st_company_greeting !== undefined ? picked.st_company_greeting : "",
        st_company_intro_images:
            picked.st_company_intro_images !== undefined
                ? picked.st_company_intro_images
                : [],
        role: "admin",
        loginEnabled: true,
        orderEnabled: picked.orderEnabled === true
    };
    copyIfDefined(buildBody, picked, ["st_zip", "st_addr", "st_addr_detail", "st_address", "st_seal"]);
    const built = buildFromBody(buildBody, null, loginId, password);
    const doc = toDbDoc(newStaffId(), built, null);
    await staffCol.insertOne(doc);
    return toPublic(doc);
}

async function findStaffByAuthUser(authUserId) {
    const key = String(authUserId || "").trim();
    if (!key) return null;
    let doc = await findStaffById(key);
    if (!doc) doc = await findStaffByLogin(key);
    return doc;
}

async function applyStaffAccountUpdate(staffKey, body) {
    const key = String(staffKey || "").trim();
    if (!key) throw new Error("계정 ID가 없습니다.");

    const staffCol = getDb().collection("staff");
    const existing = await findStaffById(key);
    if (!existing) throw new Error("계정을 찾을 수 없습니다.");
    const staffId = existing.id;

    const picked = pickStaffBody(body);
    const nextLoginId =
        picked.loginId != null && str(picked.loginId) ? str(picked.loginId) : str(existing.loginId);
    normalizePickedSeal(picked, nextLoginId, existing);
    if (!str(picked.st_company) && !getCompanyName(existing)) {
        throw new Error("회사명을 입력해 주세요.");
    }

    if (!nextLoginId) throw new Error("아이디를 입력해 주세요.");

    const loginChanged = !loginIdsEquivalent(nextLoginId, existing.loginId);
    if (loginChanged) {
        const check = await checkStaffLoginId(nextLoginId, existing.id);
        if (check.invalid) throw new Error(check.error || "아이디 형식이 올바르지 않습니다.");
        if (check.duplicate) throw new Error(check.error || "이미 사용 중인 아이디입니다.");
    }

    const password =
        body.password && String(body.password).length >= 4
            ? String(body.password)
            : getStoredPassword(existing);
    if (!password) throw new Error("비밀번호를 확인할 수 없습니다.");

    const buildBody = {
        st_company: picked.st_company,
        st_phone: picked.st_phone,
        st_fax: picked.st_fax,
        st_ceo: picked.st_ceo,
        st_ceo_tel: picked.st_ceo_tel,
        st_email: picked.st_email,
        st_web: picked.st_web,
        st_biz_no: picked.st_biz_no,
        st_biz_type: picked.st_biz_type,
        st_biz_item: picked.st_biz_item,
        st_facebook: picked.st_facebook,
        st_instagram: picked.st_instagram,
        st_naver_cafe: picked.st_naver_cafe,
        st_youtube: picked.st_youtube,
        role: existing.role || "admin",
        loginEnabled:
            picked.loginEnabled !== undefined
                ? picked.loginEnabled
                : existing.loginEnabled !== false,
        orderEnabled:
            picked.orderEnabled !== undefined
                ? picked.orderEnabled
                : existing
                  ? existing.st_order_enabled === true || existing[SF.orderEnabled] === true
                  : false
    };
    copyIfDefined(buildBody, picked, [
        "st_zip",
        "st_addr",
        "st_addr_detail",
        "st_address",
        "st_kakao",
        "st_logo",
        "st_seal",
        "st_company_greeting",
        "st_company_intro_images"
    ]);
    const built = buildFromBody(buildBody, existing, nextLoginId, password);
    const doc = toDbDoc(existing.id, built, existing);
    if (loginChanged) {
        doc.previousLoginIds = appendPreviousLoginIds(existing, existing.loginId);
    }
    await staffCol.replaceOne({ id: staffId }, doc);

    var migration = null;
    if (loginChanged) {
        migration = await propagateStaffLoginIdChange(
            getDb(),
            existing.loginId,
            nextLoginId,
            getCompanyName(doc) || doc.st_company || ""
        );
    }

    if (doc.loginEnabled === false) {
        await staffCol.updateOne(
            { id: staffId },
            { $unset: { activeSessionIds: "", activeSessionId: "", sessionUpdatedAt: "" } }
        );
    }
    const pub = toPublic(doc, { includePassword: true });
    if (loginChanged) {
        pub.loginIdChanged = true;
        pub.loginIdMigration = migration && migration.updated ? migration.updated : {};
    }
    return pub;
}

async function updateStaffAccount(id, body, creatorRole) {
    if (creatorRole !== "supervisor") {
        throw new Error("슈퍼바이저만 관리자 정보를 수정할 수 있습니다.");
    }
    return applyStaffAccountUpdate(id, body);
}

async function updateStaffSelfAccount(authUserId, body) {
    const existing = await findStaffByAuthUser(authUserId);
    if (!existing) throw new Error("계정을 찾을 수 없습니다.");
    const safeBody = Object.assign({}, body || {});
    delete safeBody.loginEnabled;
    delete safeBody.orderEnabled;
    delete safeBody.role;
    return applyStaffAccountUpdate(existing.id, safeBody);
}

async function deleteStaffAccount(id, creatorRole) {
    if (creatorRole !== "supervisor") {
        throw new Error("슈퍼바이저만 관리자를 삭제할 수 있습니다.");
    }
    const staffKey = String(id || "").trim();
    if (!staffKey) throw new Error("계정 ID가 없습니다.");

    const staffCol = getDb().collection("staff");
    const existing = await findStaffById(staffKey);
    if (!existing) throw new Error("계정을 찾을 수 없습니다.");
    const staffId = existing.id;
    if (!staffId) throw new Error("계정 ID가 올바르지 않습니다.");
    if (DEFAULT_STAFF_IDS.includes(staffId)) {
        throw new Error("기본 관리자·슈퍼바이저 계정은 삭제할 수 없습니다.");
    }
    if (existing.role === "supervisor") {
        throw new Error("슈퍼바이저 계정은 삭제할 수 없습니다.");
    }

    await staffCol.updateOne(
        { id: staffId },
        { $set: { active: false, updatedAt: Date.now() }, $unset: { activeSessionIds: "", activeSessionId: "", sessionUpdatedAt: "" } }
    );
    return { id: staffId, deleted: true };
}

module.exports = {
    ensureStaffIndexes,
    findStaffByLogin,
    findStaffById,
    verifyStaffPassword,
    isStaffRole,
    isReservedStaffLoginId,
    canAssignStaffLoginId,
    checkStaffLoginId,
    createStaffAccount,
    updateStaffAccount,
    updateStaffSelfAccount,
    findStaffByAuthUser,
    deleteStaffAccount,
    getCompanyName,
    getCeoName,
    normalizeLoginId,
    DEFAULT_STAFF_IDS
};
