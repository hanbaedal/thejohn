const { findStaffByLoginId, findVendorByLoginId } = require("./loginResolve");
const { getCompanyName: getVendorCompanyName } = require("./vendorFields");

function str(v) {
    return String(v || "").trim();
}

function guestIdFromBody(body) {
    return str(body && (body.guestId || body.guest_id));
}

async function resolveAuthorLabel(role, userId) {
    var loginId = str(userId);
    var authorName = loginId || "회원";
    if (role === "vendor") {
        try {
            var vendor = await findVendorByLoginId(loginId);
            if (vendor) authorName = getVendorCompanyName(vendor) || loginId;
        } catch (e) {
            /* ignore */
        }
    } else if (role === "admin" || role === "supervisor") {
        try {
            var staff = await findStaffByLoginId(loginId);
            if (staff) {
                var name = str(staff.st_ceo || staff.name);
                if (name) authorName = name;
            }
        } catch (e) {
            /* ignore */
        }
    } else if (role === "supervisor") {
        authorName = "슈퍼바이저";
    } else if (role === "admin") {
        authorName = authorName === loginId ? "관리자" : authorName;
    } else if (role === "oauth") {
        authorName = "SNS 로그인";
    }
    return authorName;
}

/**
 * @param {object|null} auth JWT payload
 * @param {object} body request body (guestId for visitors)
 */
async function resolvePostAuthor(auth, body) {
    if (auth && auth.userId) {
        var role = str(auth.role) || "member";
        var userId = str(auth.userId);
        var label = await resolveAuthorLabel(role, userId);
        return {
            role: role,
            userId: userId,
            label: label
        };
    }
    var guestId = guestIdFromBody(body);
    if (!guestId) {
        return { error: "방문자 식별 정보가 없습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요." };
    }
    return {
        role: "guest",
        userId: guestId,
        label: "방문자"
    };
}

function isStaffAdmin(auth) {
    var role = str(auth && auth.role);
    return role === "admin" || role === "supervisor";
}

function authorKey(role, userId) {
    return str(role) + "\t" + str(userId).toLowerCase();
}

function matchesAuthor(auth, doc, roleField, userIdField) {
    if (!auth || !auth.userId) return false;
    return authorKey(auth.role, auth.userId) === authorKey(doc[roleField], doc[userIdField]);
}

function matchesGuest(doc, guestId, roleField, userIdField) {
    if (!guestId) return false;
    return (
        str(doc[roleField]) === "guest" &&
        str(doc[userIdField]).toLowerCase() === str(guestId).toLowerCase()
    );
}

function parseUnlockedIds(query) {
    var raw = query && query.unlocked;
    if (!raw) return [];
    return String(raw)
        .split(",")
        .map(function (s) {
            return s.trim();
        })
        .filter(Boolean);
}

module.exports = {
    str,
    guestIdFromBody,
    resolvePostAuthor,
    isStaffAdmin,
    matchesAuthor,
    matchesGuest,
    parseUnlockedIds,
    authorKey
};
