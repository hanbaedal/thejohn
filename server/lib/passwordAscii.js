const bcrypt = require("bcryptjs");

/** MongoDB에 저장: 각 문자의 charCode (예: "leesb0129!" → "108,101,101,...") */
function encodePasswordToAscii(plain) {
    const s = String(plain || "");
    if (!s) return "";
    return [...s].map((ch) => ch.charCodeAt(0)).join(",");
}

/** Atlas에서 passwordAscii 필드만으로 원문 확인용 */
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

function legacyUnset() {
    return { passwordHash: "", password: "" };
}

/**
 * @returns {Promise<{ valid: boolean, migrateAscii?: string }>}
 */
async function verifyStoredPassword(doc, plainPassword) {
    const password = String(plainPassword || "");
    if (!doc) return { valid: false };

    if (doc.passwordAscii) {
        return { valid: decodePasswordFromAscii(doc.passwordAscii) === password };
    }

    if (doc.passwordHash) {
        const valid = await bcrypt.compare(password, doc.passwordHash);
        if (valid) {
            return { valid: true, migrateAscii: encodePasswordToAscii(password) };
        }
        return { valid: false };
    }

    if (doc.password != null && doc.password !== "") {
        const valid = password === String(doc.password);
        if (valid) {
            return { valid: true, migrateAscii: encodePasswordToAscii(password) };
        }
        return { valid: false };
    }

    return { valid: false };
}

async function migrateDocPasswordToAscii(collection, filter, plainPassword) {
    const ascii = encodePasswordToAscii(plainPassword);
    await collection.updateOne(filter, {
        $set: { passwordAscii: ascii, updatedAt: Date.now() },
        $unset: legacyUnset()
    });
    return ascii;
}

module.exports = {
    encodePasswordToAscii,
    decodePasswordFromAscii,
    verifyStoredPassword,
    migrateDocPasswordToAscii,
    legacyUnset,
    sensitivePasswordProjection: { passwordAscii: 0, passwordHash: 0, password: 0 }
};
