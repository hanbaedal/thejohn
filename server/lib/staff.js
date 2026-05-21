const { getDb } = require("../db");
const { loginLookupFilter, verifyLoginPassword, setLoginPassword } = require("./loginAccount");
const {
    SUPERVISOR_LOGIN,
    toPublic,
    buildFromBody,
    toDbDoc,
    getCompanyName,
    getCeoName
} = require("./staffFields");

function str(v) {
    return String(v ?? "").trim();
}

function normalizeLoginId(loginId) {
    return String(loginId || "")
        .trim()
        .toLowerCase();
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

async function createStaffAccount(
    { loginId, password, role, st_company, st_ceo, st_ceo_tel, name },
    creatorRole
) {
    const idn = normalizeLoginId(loginId);
    if (!idn) throw new Error("아이디를 입력해 주세요.");
    if (isReservedStaffLoginId(loginId) && role !== "supervisor") {
        throw new Error("사용할 수 없는 아이디입니다.");
    }
    if (role !== "admin") throw new Error("관리자(admin)만 추가할 수 있습니다.");
    if (creatorRole !== "supervisor" && creatorRole !== "admin") {
        throw new Error("권한이 없습니다.");
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

    const built = buildFromBody(
        {
            st_company: st_company || name,
            st_ceo: st_ceo || name,
            st_ceo_tel,
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

module.exports = {
    SUPERVISOR_LOGIN,
    ensureStaffIndexes,
    findStaffByLogin,
    verifyStaffPassword,
    isStaffRole,
    isReservedStaffLoginId,
    createStaffAccount,
    getCompanyName,
    getCeoName,
    normalizeLoginId
};
