const { getDb } = require("../db");
const {
    buildLoginFields,
    loginLookupFilter,
    verifyLoginPassword,
    setLoginPassword,
    legacyAuthUnset,
    normalizeLoginId
} = require("./loginAccount");

const SUPERVISOR_LOGIN = "thejhon";
const DEFAULT_SUPERVISOR_PASSWORD = "leesb0129!";

function newStaffId() {
    return "st_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

async function ensureStaffIndexes(db) {
    const col = db.collection("staff");
    await col.createIndex({ loginId: 1 }, { unique: true });
    await col.createIndex({ id: 1 }, { unique: true });
}

/** 슈퍼바이저 — vendors와 동일: loginId + loginIdNorm(비밀번호) */
async function ensureSupervisorSeed(db) {
    const col = db.collection("staff");
    const pwFromEnv = String(process.env.THEJHON_SEED_SUPERVISOR_PASSWORD || "").trim();
    const password = pwFromEnv || DEFAULT_SUPERVISOR_PASSWORD;
    const loginFields = buildLoginFields(SUPERVISOR_LOGIN, password);
    const existing = await col.findOne(loginLookupFilter(SUPERVISOR_LOGIN));

    await col.updateOne(
        loginLookupFilter(SUPERVISOR_LOGIN),
        {
            $set: {
                id: existing?.id || "st_supervisor_thejhon",
                loginId: loginFields.loginId,
                loginIdNorm: loginFields.loginIdNorm,
                role: "supervisor",
                name: "슈퍼바이저",
                active: true,
                updatedAt: Date.now()
            },
            $unset: legacyAuthUnset(),
            $setOnInsert: { createdAt: Date.now() }
        },
        { upsert: true }
    );
    console.log("[staff] supervisor synced (loginId / loginIdNorm):", SUPERVISOR_LOGIN);
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
    return idn === normalizeLoginId(SUPERVISOR_LOGIN) || idn === "thejohn" || idn === "thejhon";
}

async function createStaffAccount({ loginId, password, role, name }, creatorRole) {
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

    const vendors = getDb().collection("vendors");
    if (await vendors.findOne(loginLookupFilter(loginId))) {
        throw new Error("이미 업체 등록에 사용 중인 아이디입니다.");
    }
    const staffCol = getDb().collection("staff");
    if (await staffCol.findOne(loginLookupFilter(loginId))) {
        throw new Error("이미 사용 중인 아이디입니다.");
    }

    const loginFields = buildLoginFields(loginId, password);
    const doc = {
        id: newStaffId(),
        loginId: loginFields.loginId,
        loginIdNorm: loginFields.loginIdNorm,
        role: "admin",
        name: String(name || "").trim() || "관리자",
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    await staffCol.insertOne(doc);
    return {
        id: doc.id,
        loginId: doc.loginId,
        role: doc.role,
        name: doc.name
    };
}

module.exports = {
    SUPERVISOR_LOGIN,
    DEFAULT_SUPERVISOR_PASSWORD,
    ensureStaffIndexes,
    ensureSupervisorSeed,
    findStaffByLogin,
    verifyStaffPassword,
    isStaffRole,
    isReservedStaffLoginId,
    normalizeLoginId
};
