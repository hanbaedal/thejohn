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

var FTA_BOARD = "http://www.fta.or.kr/bbs/board.php";
var FTA_CITY_CODES = [
    "서울",
    "부산",
    "대구",
    "인천",
    "광주",
    "대전",
    "울산",
    "세종",
    "경기",
    "강원",
    "충북",
    "충남",
    "전북",
    "전남",
    "경북",
    "경남",
    "제주"
];
var FTA_CITY_ALIASES = {
    서울: "서울",
    서울특별시: "서울",
    부산: "부산",
    부산광역시: "부산",
    대구: "대구",
    대구광역시: "대구",
    인천: "인천",
    인천광역시: "인천",
    광주: "광주",
    광주광역시: "광주",
    대전: "대전",
    대전광역시: "대전",
    울산: "울산",
    울산광역시: "울산",
    세종: "세종",
    세종특별자치시: "세종",
    경기: "경기",
    경기도: "경기",
    강원: "강원",
    강원도: "강원",
    강원특별자치도: "강원",
    충북: "충북",
    충청북도: "충북",
    충남: "충남",
    충청남도: "충남",
    전북: "전북",
    전라북도: "전북",
    전북특별자치도: "전북",
    전남: "전남",
    전라남도: "전남",
    경북: "경북",
    경상북도: "경북",
    경남: "경남",
    경상남도: "경남",
    제주: "제주",
    제주특별자치도: "제주"
};

function decodeHtmlEntities(s) {
    return String(s || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}

function stripTags(s) {
    return decodeHtmlEntities(String(s || "").replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeFtaCity(keyword) {
    var raw = String(keyword || "").trim();
    if (!raw) return "";
    if (FTA_CITY_ALIASES[raw]) return FTA_CITY_ALIASES[raw];
    for (var i = 0; i < FTA_CITY_CODES.length; i++) {
        var code = FTA_CITY_CODES[i];
        if (raw.indexOf(code) === 0) return code;
    }
    return raw;
}

function parseFtaRows(html) {
    var items = [];
    var chunks = String(html || "").split(/<tr\b[^>]*>/i);
    for (var i = 1; i < chunks.length; i++) {
        var tr = chunks[i].split(/<\/tr>/i)[0];
        var tds = [];
        var tdRe = /<td\b[^>]*>([\s\S]*?)(?=<td\b|<\/tr>|$)/gi;
        var tm;
        while ((tm = tdRe.exec(tr))) tds.push(tm[1]);
        if (tds.length < 3) continue;
        var nameLink = tds[0].match(/wr_id=(\d+)[^>]*>\s*([\s\S]*?)<\/a>/i);
        var name = stripTags(nameLink ? nameLink[2] : tds[0]);
        if (!name || /자료가 없습니다|게시물이 없습니다/i.test(name)) continue;
        var phone = stripTags(tds[1]);
        var addr = stripTags(tds[2]);
        var web = "";
        var webMatch = (tds[3] || "").match(/href=["']([^"']+)["']/i);
        if (webMatch) {
            web = decodeHtmlEntities(webMatch[1]).trim();
            if (/fta\.or\.kr|board\.php/i.test(web)) web = "";
        }
        items.push({
            wr_id: nameLink ? nameLink[1] : "",
            vn_company: name,
            vn_phone: phone,
            vn_addr: addr,
            vn_web: web
        });
    }
    return items;
}

function parseFtaLastPage(html) {
    var m = String(html || "").match(/page=(\d+)[^>]*>\s*맨끝/i);
    if (m) return parseInt(m[1], 10);
    var max = 1;
    var re = /[?&]page=(\d+)/gi;
    var pm;
    while ((pm = re.exec(html))) max = Math.max(max, parseInt(pm[1], 10));
    return max;
}

function buildFtaListUrl(params) {
    var qs = new URLSearchParams(Object.assign({ bo_table: "sub03_01" }, params));
    return FTA_BOARD + "?" + qs.toString();
}

async function fetchFtaHtml(params) {
    var url = buildFtaListUrl(params);
    var controller = new AbortController();
    var timer = setTimeout(function () {
        controller.abort();
    }, 15000);
    try {
        var res = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml"
            },
            signal: controller.signal
        });
        if (!res.ok) throw new Error("FTA_HTTP_" + res.status);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

async function fetchFtaPages(baseParams) {
    var html = await fetchFtaHtml(Object.assign({}, baseParams, { page: "1" }));
    var lastPage = parseFtaLastPage(html);
    var rows = parseFtaRows(html);
    for (var page = 2; page <= lastPage; page++) {
        var pageHtml = await fetchFtaHtml(Object.assign({}, baseParams, { page: String(page) }));
        rows = rows.concat(parseFtaRows(pageHtml));
    }
    return rows;
}

async function searchFuneralHalls(keyword, mode) {
    var q = String(keyword || "").trim();
    var searchMode = String(mode || "city").toLowerCase() === "name" ? "name" : "city";
    if (!q) return { items: [], configured: true, lastErr: "" };

    try {
        var params;
        if (searchMode === "name") {
            params = {
                sca: "",
                sop: "or",
                sfl: "wr_subject||wr_content",
                stx: q
            };
        } else {
            var city = normalizeFtaCity(q);
            if (FTA_CITY_CODES.indexOf(city) < 0) {
                return {
                    items: [],
                    configured: true,
                    lastErr: "UNKNOWN_CITY:" + q
                };
            }
            params = { sca: city };
        }

        var rawRows = await fetchFtaPages(params);
        var out = [];
        var seen = new Set();
        for (var i = 0; i < rawRows.length; i++) {
            var row = rawRows[i] || {};
            var name = String(row.vn_company || "").trim();
            if (!name) continue;
            var key = normText(name);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
                vn_company: name,
                vn_phone: String(row.vn_phone || "").trim(),
                vn_addr: String(row.vn_addr || "").trim(),
                vn_web: String(row.vn_web || "").trim(),
                vn_record_type: "new",
                source: "fta_board"
            });
        }
        return { items: out, configured: true, lastErr: "" };
    } catch (e) {
        return {
            items: [],
            configured: true,
            lastErr: String((e && e.message) || "FTA_UNKNOWN")
        };
    }
}

module.exports = {
    findExternalVendorInfo,
    canUseNaver,
    searchFuneralHalls
};

