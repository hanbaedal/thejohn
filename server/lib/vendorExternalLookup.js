function normText(v) {
    return String(v || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function normalizePhone(v) {
    var digits = String(v || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    if (digits.length === 8) return digits;
    if (digits.length === 9 && digits.indexOf("02") === 0) return digits;
    if (digits.length >= 10 && digits.length <= 11) return digits;
    return digits;
}

function scoreCandidate(item, built) {
    var score = 0;
    var company = normText(built.vn_company);
    var addr = normText(built.vn_addr);
    var phone = normalizePhone(built.vn_phone);
    var title = normText(item.title || "");
    var road = normText(item.roadAddress || "");
    var address = normText(item.address || "");
    var tel = normalizePhone(item.telephone || "");

    if (company && title && (title === company || title.indexOf(company) >= 0)) score += 5;
    if (addr && (road === addr || address === addr || road.indexOf(addr) >= 0 || address.indexOf(addr) >= 0)) {
        score += 3;
    }
    if (phone && tel && phone === tel) score += 4;
    return score;
}

function canUseNaver() {
    return (
        String(process.env.NAVER_SEARCH_CLIENT_ID || "").trim() &&
        String(process.env.NAVER_SEARCH_CLIENT_SECRET || "").trim()
    );
}

async function fetchNaverLocal(built) {
    if (!canUseNaver()) return null;
    var company = String(built.vn_company || "").trim();
    if (!company) return null;

    var query = company;
    if (built.vn_addr) query += " " + String(built.vn_addr || "").trim();
    var url =
        "https://openapi.naver.com/v1/search/local.json?display=5&query=" +
        encodeURIComponent(query);
    var controller = new AbortController();
    var timer = setTimeout(function () {
        controller.abort();
    }, 5000);
    try {
        var res = await fetch(url, {
            method: "GET",
            headers: {
                "X-Naver-Client-Id": String(process.env.NAVER_SEARCH_CLIENT_ID || "").trim(),
                "X-Naver-Client-Secret": String(process.env.NAVER_SEARCH_CLIENT_SECRET || "").trim()
            },
            signal: controller.signal
        });
        if (!res.ok) return null;
        var json = await res.json();
        var items = Array.isArray(json && json.items) ? json.items : [];
        if (!items.length) return null;
        var best = null;
        var bestScore = -1;
        for (var i = 0; i < items.length; i++) {
            var it = items[i] || {};
            var s = scoreCandidate(it, built);
            if (s > bestScore) {
                bestScore = s;
                best = it;
            }
        }
        if (!best || bestScore < 2) return null;
        var out = {
            vn_ceo: "",
            vn_ceo_tel: "",
            vn_web: String(best.link || "").trim(),
            vn_email: "",
            vn_phone: String(best.telephone || "").trim(),
            vn_addr: String(best.roadAddress || best.address || "").trim(),
            source: "naver_local",
            score: bestScore
        };
        return out;
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function findExternalVendorInfo(built) {
    var naver = await fetchNaverLocal(built);
    if (naver) return naver;
    return null;
}

module.exports = {
    findExternalVendorInfo,
    canUseNaver
};

