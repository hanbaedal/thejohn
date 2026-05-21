const bcrypt = require("bcryptjs");

/**
 * vendors · staff 공통 로그인 필드
 * - loginId     : 로그인 아이디
 * - loginIdNorm : 비밀번호 (사용자 입력값 그대로)
 */

function normalizeLoginId(loginId) {
    return String(loginId || "")
        .trim()
        .toLowerCase();
}

function normalizePasswordInput(plain) {
    return String(plain || "");
}

/** 아이디 조회 (대소문자 무시) */
function loginLookupFilter(loginId) {
    const trimmed = String(loginId || "").trim();
    const idn = normalizeLoginId(loginId);
    if (!trimmed) return { loginId: "__invalid__" };
    if (trimmed === idn) return { loginId: idn };
    return { $or: [{ loginId: trimmed }, { loginId: idn }] };
}

/** 신규·수정 시 저장 필드 */
function buildLoginFields(loginId, password) {
    const trimmed = String(loginId || "").trim();
    return {
        loginId: trimmed,
        loginIdNorm: normalizePasswordInput(password)
    };
}

function legacyAuthUnset() {
    return { password: "", passwordAscii: "", passwordHash: "" };
}

function decodePasswordFromAscii(ascii) {
    const raw = String(ascii || "").trim();
    if (!raw) return "";
    return raw
        .split(",")
        .map((part) => {
            const code = parseInt(part.trim(), 10);
            return Number.isFinite(code) ? String.fromCharCode(code) : "";
        })
        .join("");
}

function getStoredPassword(doc) {
    if (!doc) return "";
    if (doc.password != null && doc.password !== "") return String(doc.password);
    if (doc.passwordAscii) return decodePasswordFromAscii(doc.passwordAscii);
    const normLogin = normalizeLoginId(doc.loginId);
    if (doc.loginIdNorm != null && doc.loginIdNorm !== "" && doc.loginIdNorm !== normLogin) {
        return String(doc.loginIdNorm);
    }
    return "";
}

/**
 * @returns {Promise<{ valid: boolean, migratePassword?: string }>}
 */
async function verifyLoginPassword(doc, loginId, plainPassword) {
    const input = normalizePasswordInput(plainPassword);
    if (!doc) return { valid: false };

    const stored = getStoredPassword(doc);
    if (stored) {
        const valid = input === stored;
        if (valid && !usesLoginIdNormAsPassword(doc)) {
            return { valid: true, migratePassword: input };
        }
        return { valid };
    }

    if (doc.passwordHash) {
        const valid = await bcrypt.compare(input, doc.passwordHash);
        if (valid) return { valid: true, migratePassword: input };
    }

    return { valid: false };
}

function usesLoginIdNormAsPassword(doc) {
    if (!doc || doc.loginIdNorm == null || doc.loginIdNorm === "") return false;
    return doc.loginIdNorm !== normalizeLoginId(doc.loginId);
}

async function setLoginPassword(collection, filter, loginId, plainPassword) {
    const fields = buildLoginFields(loginId, plainPassword);
    await collection.updateOne(filter, {
        $set: {
            loginId: fields.loginId,
            loginIdNorm: fields.loginIdNorm,
            updatedAt: Date.now()
        },
        $unset: legacyAuthUnset()
    });
}

/** password / passwordAscii / 잘못된 loginIdNorm(소문자 아이디) → loginIdNorm에 비밀번호 */
async function migrateCollectionLoginFields(db, collectionName) {
    const col = db.collection(collectionName);
    const docs = await col.find({}).toArray();
    let migrated = 0;

    for (const doc of docs) {
        const normLogin = normalizeLoginId(doc.loginId);
        let plain = "";

        if (usesLoginIdNormAsPassword(doc)) {
            continue;
        }

        if (doc.password) plain = String(doc.password);
        else if (doc.passwordAscii) plain = decodePasswordFromAscii(doc.passwordAscii);
        else if (doc.loginIdNorm && doc.loginIdNorm === normLogin) {
            continue;
        } else if (doc.loginIdNorm && doc.loginIdNorm !== normLogin) {
            plain = String(doc.loginIdNorm);
        }

        if (!plain && !doc.passwordHash) continue;

        if (!plain) continue;

        await col.updateOne(
            { id: doc.id },
            {
                $set: {
                    loginId: String(doc.loginId || "").trim() || normLogin,
                    loginIdNorm: plain,
                    updatedAt: Date.now()
                },
                $unset: legacyAuthUnset()
            }
        );
        migrated++;
    }

    if (migrated) console.log("[loginAccount] migrated", collectionName, migrated);
}

const sensitiveLoginProjection = {
    loginIdNorm: 0,
    password: 0,
    passwordAscii: 0,
    passwordHash: 0
};

module.exports = {
    normalizeLoginId,
    normalizePasswordInput,
    loginLookupFilter,
    buildLoginFields,
    verifyLoginPassword,
    setLoginPassword,
    migrateCollectionLoginFields,
    getStoredPassword,
    legacyAuthUnset,
    sensitiveLoginProjection
};
