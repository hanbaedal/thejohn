const bcrypt = require("bcryptjs");

/** API·DB에 저장할 비밀번호 = 사용자가 입력한 그대로 */
function normalizePasswordInput(plain) {
    return String(plain || "");
}

function legacyPasswordUnset() {
    return { passwordAscii: "", passwordHash: "" };
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

/**
 * @returns {Promise<{ valid: boolean, migratePlain?: string }>}
 */
async function verifyStoredPassword(doc, plainPassword) {
    const input = normalizePasswordInput(plainPassword);
    if (!doc) return { valid: false };

    if (doc.password != null && doc.password !== "") {
        return { valid: input === String(doc.password) };
    }

    if (doc.passwordAscii) {
        const plain = decodePasswordFromAscii(doc.passwordAscii);
        const valid = input === plain;
        return { valid, migratePlain: plain };
    }

    if (doc.passwordHash) {
        const valid = await bcrypt.compare(input, doc.passwordHash);
        if (valid) return { valid: true, migratePlain: input };
        return { valid: false };
    }

    return { valid: false };
}

async function setPlainPassword(collection, filter, plainPassword) {
    const password = normalizePasswordInput(plainPassword);
    await collection.updateOne(filter, {
        $set: { password, updatedAt: Date.now() },
        $unset: legacyPasswordUnset()
    });
}

/** 기존 passwordAscii / passwordHash → password(원문) 일괄 변환 */
async function migrateAllPasswordsToPlain(db) {
    let migrated = 0;
    for (const name of ["staff", "vendors"]) {
        const col = db.collection(name);
        const docs = await col
            .find({
                $or: [
                    { passwordAscii: { $exists: true, $ne: "" } },
                    { passwordHash: { $exists: true, $ne: "" } }
                ]
            })
            .toArray();

        for (const doc of docs) {
            let plain = "";
            if (doc.passwordAscii) {
                plain = decodePasswordFromAscii(doc.passwordAscii);
            } else if (doc.password) {
                plain = String(doc.password);
            } else if (doc.passwordHash) {
                continue;
            }
            if (!plain) continue;
            await col.updateOne(
                { id: doc.id },
                { $set: { password: plain, updatedAt: Date.now() }, $unset: legacyPasswordUnset() }
            );
            migrated++;
        }
    }
    if (migrated) console.log("[password] migrated to plain password:", migrated);
}

const sensitivePasswordProjection = { password: 0, passwordAscii: 0, passwordHash: 0 };

module.exports = {
    normalizePasswordInput,
    decodePasswordFromAscii,
    verifyStoredPassword,
    setPlainPassword,
    migrateAllPasswordsToPlain,
    legacyPasswordUnset,
    sensitivePasswordProjection
};
