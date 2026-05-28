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

function stripHtml(s) {
    return String(s || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function headers() {
    return {
        "X-Naver-Client-Id": String(process.env.NAVER_SEARCH_CLIENT_ID || "").trim(),
        "X-Naver-Client-Secret": String(process.env.NAVER_SEARCH_CLIENT_SECRET || "").trim()
    };
}

async function fetchNaverSearch(endpoint, query, display) {
    var url =
        "https://openapi.naver.com/v1/search/" +
        endpoint +
        ".json?display=" +
        String(display || 10) +
        "&query=" +
        encodeURIComponent(String(query || ""));
    var controller = new AbortController();
    var timer = setTimeout(function () {
        controller.abort();
    }, 7000);
    try {
        var res = await fetch(url, {
            method: "GET",
            headers: headers(),
            signal: controller.signal
        });
        if (!res.ok) {
            var body = "";
            try {
                body = await res.text();
            } catch (e) {}
            throw new Error("NAVER_" + endpoint.toUpperCase() + "_" + res.status + (body ? ": " + body : ""));
        }
        var json = await res.json();
        return Array.isArray(json && json.items) ? json.items : [];
    } finally {
        clearTimeout(timer);
    }
}

async function fetchNaverLocal(built) {
    if (!canUseNaver()) return null;
    var company = String(built.vn_company || "").trim();
    if (!company) return null;

    var query = company;
    if (built.vn_addr) query += " " + String(built.vn_addr || "").trim();
    try {
        var items = await fetchNaverSearch("local", query, 5);
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
    }
}

async function findExternalVendorInfo(built) {
    var naver = await fetchNaverLocal(built);
    if (naver) return naver;
    return null;
}

async function searchFuneralHalls(keyword, mode) {
    if (!canUseNaver()) return { items: [], configured: false };
    var q = String(keyword || "").trim();
    var searchMode = String(mode || "city").toLowerCase() === "name" ? "name" : "city";
    if (!q) return { items: [], configured: true };
    var queries =
        searchMode === "name"
            ? [q, q + " 장례식장", q + " 장례문화원"]
            : [q + " 장례식장", q + " 장례", q + " 장례문화원"];
    var out = [];
    var seen = new Set();
    var lastErr = "";

    function pushLocalItem(it) {
        var name = stripHtml(it.title || "");
        if (!name) return;
        var key = normText(name);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
            vn_company: name,
            vn_phone: String(it.telephone || "").trim(),
            vn_addr: String(it.roadAddress || it.address || "").trim(),
            vn_web: String(it.link || "").trim(),
            vn_record_type: "new",
            source: "naver_local"
        });
    }

    function pushWebItem(it) {
        var title = stripHtml(it.title || "");
        if (!title || title.indexOf("장례") < 0) return;
        var name = title
            .replace(/\s*\|\s*.*$/, "")
            .replace(/\s*-\s*.*$/, "")
            .trim();
        if (!name) return;
        var key = normText(name);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
            vn_company: name,
            vn_phone: "",
            vn_addr: "",
            vn_web: String(it.link || "").trim(),
            vn_record_type: "new",
            source: "naver_web"
        });
    }

    try {
        for (var q = 0; q < queries.length; q++) {
            var rawLocal = await fetchNaverSearch("local", queries[q], 30);
            for (var i = 0; i < rawLocal.length; i++) {
                pushLocalItem(rawLocal[i] || {});
            }
            var rawWeb = await fetchNaverSearch("webkr", queries[q], 30);
            for (var w = 0; w < rawWeb.length; w++) {
                pushWebItem(rawWeb[w] || {});
            }
        }
        return { items: out, configured: true, lastErr: "" };
    } catch (e) {
        lastErr = String((e && e.message) || "NAVER_LOCAL_UNKNOWN");
        return { items: [], configured: true, lastErr: lastErr };
    }
}

module.exports = {
    findExternalVendorInfo,
    canUseNaver,
    searchFuneralHalls
};

