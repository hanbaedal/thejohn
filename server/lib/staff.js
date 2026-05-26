const { getDb } = require("../db");
const { loginLookupFilter, verifyLoginPassword, setLoginPassword, normalizeLoginId } = require("./loginAccount");
const {
    toPublic,
    buildFromBody,
    toDbDoc,
    getCompanyName,
    getCeoName,
    DEFAULT_STAFF_IDS
} = require("./staffFields");
const { getStoredPassword } = require("./loginAccount");

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
    return idn === "thejohn" || idn === "thejhon" || idn === "aksangsa";
}

function pickStaffBody(body) {
    return {
        st_company: body.st_company,
        st_ceo: body.st_ceo,
        st_ceo_tel: body.st_ceo_tel,
        st_email: body.st_email,
        st_web: body.st_web,
        st_biz_no: body.st_biz_no,
        st_biz_type: body.st_biz_type,
        st_biz_item: body.st_biz_item,
        st_address: body.st_address,
        name: body.name
    };
}

async function findStaffById(id) {
    return getDb().collection("staff").findOne({ id: String(id || "").trim() });
}

async function createStaffAccount(body, creatorRole) {
    const loginId = body.loginId;
    const password = body.password;
    const role = body.role || "admin";
    const idn = normalizeLoginId(loginId);
    if (!idn) throw new Error("아이디를 입력해 주세요.");
    if (isReservedStaffLoginId(loginId)) {
        throw new Error("사용할 수 없는 아이디입니다.");
    }
    if (role !== "admin") throw new Error("관리자(admin)만 추가할 수 있습니다.");
    if (creatorRole !== "supervisor") {
        throw new Error("슈퍼바이저만 관리자를 등록할 수 있습니다.");
    }
    if (!password || String(password).length < 4) {
        throw new Error("비밀번호는 4자 이상으로 입력해 주세요.");
    }
    if (!str(st_company)) throw new Error("업체이름을 입력해 주세요.");

    const vendors = getDb().collection("vendors");
    if (await vendors.findOne(loginLookupFilter(loginId))) {
        throw new Error("이미 업체 등록에 사용 중인 아이디입니다.");
    }
    const staffCol = getDb().collection("staff");
    if (await staffCol.findOne(loginLookupFilter(loginId))) {
        throw new Error("이미 사용 중인 아이디입니다.");
    }

    const picked = pickStaffBody(body);
    const built = buildFromBody(
        {
            st_company: picked.st_company || picked.name,
            st_ceo: picked.st_ceo || picked.name,
            st_ceo_tel: picked.st_ceo_tel,
            st_email: picked.st_email,
            st_web: picked.st_web,
            st_biz_no: picked.st_biz_no,
            st_biz_type: picked.st_biz_type,
            st_biz_item: picked.st_biz_item,
            st_address: picked.st_address,
            role: "admin"
        },
        null,
        loginId,
        password
    );
    const doc = toDbDoc(newStaffId(), built, null);
    await staffCol.insertOne(doc);
    return toPublic(doc);
}

async function updateStaffAccount(id, body, creatorRole) {
    if (creatorRole !== "supervisor") {
        throw new Error("슈퍼바이저만 관리자 정보를 수정할 수 있습니다.");
    }
    const staffId = String(id || "").trim();
    if (!staffId) throw new Error("계정 ID가 없습니다.");

    const staffCol = getDb().collection("staff");
    const existing = await staffCol.findOne({ id: staffId, active: { $ne: false } });
    if (!existing) throw new Error("계정을 찾을 수 없습니다.");

    const picked = pickStaffBody(body);
    if (!str(picked.st_company) && !getCompanyName(existing)) {
        throw new Error("회사명을 입력해 주세요.");
    }

    const password =
        body.password && String(body.password).length >= 4
            ? String(body.password)
            : getStoredPassword(existing);
    if (!password) throw new Error("비밀번호를 확인할 수 없습니다.");

    const built = buildFromBody(
        {
            st_company: picked.st_company,
            st_ceo: picked.st_ceo,
            st_ceo_tel: picked.st_ceo_tel,
            st_email: picked.st_email,
            st_web: picked.st_web,
            st_biz_no: picked.st_biz_no,
            st_biz_type: picked.st_biz_type,
            st_biz_item: picked.st_biz_item,
            st_address: picked.st_address,
            role: existing.role || "admin"
        },
        existing,
        existing.loginId,
        password
    );
    const doc = toDbDoc(existing.id, built, existing);
    await staffCol.replaceOne({ id: staffId }, doc);
    return toPublic(doc);
}

module.exports = {
    ensureStaffIndexes,
    findStaffByLogin,
    findStaffById,
    verifyStaffPassword,
    isStaffRole,
    isReservedStaffLoginId,
    createStaffAccount,
    updateStaffAccount,
    getCompanyName,
    getCeoName,
    normalizeLoginId,
    DEFAULT_STAFF_IDS
};
