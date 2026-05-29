const crypto = require("crypto");
const { getDb } = require("../db");
const { findStaffByLoginId, findVendorByLoginId } = require("./loginResolve");
const { collectionNameForVendorDoc } = require("./vendorCollections");

/** 관리자·업체 동시 접속 허용 수 (슈퍼바이저 제외) */
const MAX_CONCURRENT_SESSIONS = 2;

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

/** legacy activeSessionId + activeSessionIds 배열 통합 */
function getActiveSessionIds(doc) {
    if (!doc) return [];
    var ids = [];
    if (Array.isArray(doc.activeSessionIds)) {
        doc.activeSessionIds.forEach(function (s) {
            var v = str(s);
            if (v && ids.indexOf(v) < 0) ids.push(v);
        });
    }
    var legacy = str(doc.activeSessionId);
    if (legacy && ids.indexOf(legacy) < 0) ids.push(legacy);
    return ids;
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

/** 로그인 전 — 동시 접속 한도·접속 비활성 검사 */
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
    var activeCount = getActiveSessionIds(doc).length;
    if (activeCount >= MAX_CONCURRENT_SESSIONS) {
        return {
            ok: false,
            code: "ALREADY_LOGGED_IN",
            error: "다른곳에서 로그인해서 사용중입니다!",
            activeSessions: activeCount,
            maxSessions: MAX_CONCURRENT_SESSIONS
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
    var next = getActiveSessionIds(info.doc).concat([sid]);
    await getDb()
        .collection(info.collection)
        .updateOne(
            { id: info.doc.id },
            {
                $set: { activeSessionIds: next, sessionUpdatedAt: Date.now() },
                $unset: { activeSessionId: "" }
            }
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
    return getActiveSessionIds(resolved.doc).indexOf(sid) >= 0;
}

async function clearLoginSession(auth) {
    if (!auth || !sessionEnforced(auth.role)) return;
    const resolved = await resolveAccountDoc(auth.role, auth.userId);
    if (!resolved || !resolved.doc || !resolved.doc.id) return;
    const sid = str(auth.sid);
    var current = getActiveSessionIds(resolved.doc);
    var next = sid ? current.filter(function (id) { return id !== sid; }) : [];
    if (next.length) {
        await getDb()
            .collection(resolved.collection)
            .updateOne({ id: resolved.doc.id }, { $set: { activeSessionIds: next, sessionUpdatedAt: Date.now() } });
    } else {
        await getDb()
            .collection(resolved.collection)
            .updateOne(
                { id: resolved.doc.id },
                { $unset: { activeSessionIds: "", activeSessionId: "", sessionUpdatedAt: "" } }
            );
    }
}

async function clearAllSessionsForDoc(collection, docId) {
    if (!collection || !docId) return;
    await getDb()
        .collection(collection)
        .updateOne(
            { id: docId },
            { $unset: { activeSessionIds: "", activeSessionId: "", sessionUpdatedAt: "" } }
        );
}

async function clearStaffSessionById(staffId) {
    await clearAllSessionsForDoc("staff", staffId);
}

module.exports = {
    MAX_CONCURRENT_SESSIONS,
    newSessionId,
    isSupervisorRole,
    sessionEnforced,
    isLoginEnabledStaff,
    getActiveSessionIds,
    assertCanStartLogin,
    assignLoginSession,
    verifyAuthSession,
    clearLoginSession,
    clearStaffSessionById,
    clearAllSessionsForDoc
};
