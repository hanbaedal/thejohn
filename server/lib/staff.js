const bcrypt = require("bcryptjs");
const { getDb } = require("../db");

const SUPERVISOR_LOGIN = "thejhon";

function normalizeId(s) {
    return String(s || "")
        .trim()
        .toLowerCase();
}

function newStaffId() {
    return "st_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

async function ensureStaffIndexes(db) {
    const col = db.collection("staff");
    await col.createIndex({ loginIdNorm: 1 }, { unique: true });
    await col.createIndex({ id: 1 }, { unique: true });
}

/** 슈퍼바이저 thejhon — 최초 1회 생성 또는 SEED 환경 변수로 비밀번호 갱신 */
async function ensureSupervisorSeed(db) {
    const col = db.collection("staff");
    const loginIdNorm = normalizeId(SUPERVISOR_LOGIN);
    const existing = await col.findOne({ loginIdNorm });
    const pwFromEnv = String(process.env.THEJHON_SEED_SUPERVISOR_PASSWORD || "").trim();
    const initialPw = pwFromEnv || "leesb129!";
    const shouldSetPassword = pwFromEnv || !existing;

    if (!shouldSetPassword) return;

    const passwordHash = await bcrypt.hash(initialPw, 10);
    await col.updateOne(
        { loginIdNorm },
        {
            $set: {
                id: existing?.id || "st_supervisor_thejhon",
                loginId: SUPERVISOR_LOGIN,
                loginIdNorm,
                role: "supervisor",
                name: "슈퍼바이저",
                passwordHash,
                active: true,
                updatedAt: Date.now()
            },
            $setOnInsert: { createdAt: Date.now() }
        },
        { upsert: true }
    );
    console.log("[staff] supervisor", SUPERVISOR_LOGIN, pwFromEnv ? "(password from env)" : "(initial seed)");
}

async function findStaffByLogin(loginId) {
    const idn = normalizeId(loginId);
    if (!idn) return null;
    return getDb().collection("staff").findOne({ loginIdNorm: idn, active: { $ne: false } });
}

async function verifyStaffPassword(staff, password) {
    if (!staff?.passwordHash) return false;
    return bcrypt.compare(String(password || ""), staff.passwordHash);
}

function isStaffRole(role) {
    return role === "supervisor" || role === "admin";
}

function isReservedStaffLoginId(loginId) {
    const idn = normalizeId(loginId);
    return idn === normalizeId(SUPERVISOR_LOGIN) || idn === "thejohn" || idn === "thejhon";
}

async function createStaffAccount({ loginId, password, role, name }, creatorRole) {
    const idn = normalizeId(loginId);
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
    if (await vendors.findOne({ loginIdNorm: idn })) {
        throw new Error("이미 업체 등록에 사용 중인 아이디입니다.");
    }
    const staffCol = getDb().collection("staff");
    if (await staffCol.findOne({ loginIdNorm: idn })) {
        throw new Error("이미 사용 중인 아이디입니다.");
    }

    const doc = {
        id: newStaffId(),
        loginId: String(loginId).trim(),
        loginIdNorm: idn,
        role: "admin",
        name: String(name || "").trim() || "관리자",
        passwordHash: await bcrypt.hash(String(password), 10),
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
    ensureStaffIndexes,
    ensureSupervisorSeed,
    findStaffByLogin,
    verifyStaffPassword,
    isStaffRole,
    isReservedStaffLoginId,
    createStaffAccount,
    normalizeId
};
