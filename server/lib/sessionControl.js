const crypto = require("crypto");
const { getDb } = require("../db");
const { findStaffByLoginId, findVendorByLoginId } = require("./loginResolve");
const { collectionNameForVendorDoc } = require("./vendorCollections");

function newSessionId() {
    return "sess_" + crypto.randomBytes(16).toString("hex");
}

function isSupervisorRole(role) {
    return role === "supervisor";
}

function sessionEnforced(role) {
    return !isSupervisorRole(role);
}

function str(v) {
    return String(v ?? "").trim();
}

async function resolveAccountDoc(role, userId) {
    if (role === "vendor") {
        const doc = await findVendorByLoginId(userId);
        if (!doc) return null;
        return { doc: doc, collection: collectionNameForVendorDoc(doc) };
    }
    if (role === "admin" || role === "supervisor") {
        const doc = await findStaffByLoginId(userId);
        if (!doc) return null;
        return { doc: doc, collection: "staff" };
    }
    return null;
}

function isLoginEnabledStaff(staff) {
    if (!staff) return false;
    if (staff.role === "supervisor") return true;
    return staff.loginEnabled !== false;
}

/** 로그인 전 — 슈퍼바이저 제외 중복 접속·접속 비활성 검사 */
async function assertCanStartLogin(role, userId) {
    if (isSupervisorRole(role)) {
        return { ok: true };
    }
    const resolved = await resolveAccountDoc(role, userId);
    if (!resolved || !resolved.doc) {
        return { ok: false, code: "NOT_REGISTERED", error: "계정을 찾을 수 없습니다." };
    }
    const doc = resolved.doc;
    if (role === "admin" && !isLoginEnabledStaff(doc)) {
        return {
            ok: false,
            code: "LOGIN_DISABLED",
            error: "접속이 비활성화된 관리자 계정입니다. 슈퍼바이저에게 문의해 주세요."
        };
    }
    if (str(doc.activeSessionId)) {
        return {
            ok: false,
            code: "ALREADY_LOGGED_IN",
            error:
                "이미 다른 곳에서 로그인 중입니다. 기존 접속에서 로그아웃한 뒤 다시 시도해 주세요."
        };
    }
    return { ok: true, resolved: resolved };
}

/** 로그인 성공 후 세션 ID 발급 (슈퍼바이저는 세션 없음) */
async function assignLoginSession(role, userId, resolved) {
    if (!sessionEnforced(role)) {
        return "";
    }
    const info = resolved || (await resolveAccountDoc(role, userId));
    if (!info || !info.doc || !info.doc.id) return "";
    const sid = newSessionId();
    await getDb()
        .collection(info.collection)
        .updateOne(
            { id: info.doc.id },
            { $set: { activeSessionId: sid, sessionUpdatedAt: Date.now() } }
        );
    return sid;
}

async function verifyAuthSession(auth) {
    if (!auth || !sessionEnforced(auth.role)) return true;
    const sid = str(auth.sid);
    if (!sid) return false;
    const resolved = await resolveAccountDoc(auth.role, auth.userId);
    if (!resolved || !resolved.doc) return false;
    if (auth.role === "admin" && !isLoginEnabledStaff(resolved.doc)) return false;
    return str(resolved.doc.activeSessionId) === sid;
}

async function clearLoginSession(auth) {
    if (!auth || !sessionEnforced(auth.role)) return;
    const resolved = await resolveAccountDoc(auth.role, auth.userId);
    if (!resolved || !resolved.doc || !resolved.doc.id) return;
    const filter = { id: resolved.doc.id };
    if (auth.sid) {
        filter.activeSessionId = str(auth.sid);
    }
    await getDb()
        .collection(resolved.collection)
        .updateOne(filter, { $unset: { activeSessionId: "", sessionUpdatedAt: "" } });
}

async function clearStaffSessionById(staffId) {
    if (!staffId) return;
    await getDb()
        .collection("staff")
        .updateOne({ id: staffId }, { $unset: { activeSessionId: "", sessionUpdatedAt: "" } });
}

module.exports = {
    newSessionId,
    isSupervisorRole,
    sessionEnforced,
    isLoginEnabledStaff,
    assertCanStartLogin,
    assignLoginSession,
    verifyAuthSession,
    clearLoginSession,
    clearStaffSessionById
};
