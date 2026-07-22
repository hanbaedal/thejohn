/**
 * funeralhallinfo.com — 서울·경기·인천 장례식장 목록 수집
 * (e하늘 비교 없음, 리스트 표시·선택 저장용)
 */

var FHI_BASE = "https://www.funeralhallinfo.com";
var FHI_REGIONS = [
    { id: "seoul", label: "서울", sub: "서울특별시", slug: "서울", icon: "🏢" },
    { id: "gyeonggi", label: "경기", sub: "경기도", slug: "경기", icon: "🏘️" },
    { id: "incheon", label: "인천", sub: "인천광역시", slug: "인천", icon: "🌊" }
];

var CACHE_TTL_MS = 24 * 60 * 60 * 1000;
var cache = {
    summaries: { at: 0, data: null },
    regions: {}
};

function decodeEntities(s) {
    return String(s || "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}

function stripTags(s) {
    return decodeEntities(String(s || "").replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function normRegionKey(region) {
    var r = String(region || "").trim();
    for (var i = 0; i < FHI_REGIONS.length; i++) {
        var row = FHI_REGIONS[i];
        if (r === row.id || r === row.label || r === row.slug || r === row.sub) return row.slug;
    }
    return r;
}

function findRegionMeta(slug) {
    for (var i = 0; i < FHI_REGIONS.length; i++) {
        if (FHI_REGIONS[i].slug === slug) return FHI_REGIONS[i];
    }
    return null;
}

async function fetchHtml(path) {
    var url = path.indexOf("http") === 0 ? path : FHI_BASE + path;
    var controller = new AbortController();
    var timer = setTimeout(function () {
        controller.abort();
    }, 20000);
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
        if (!res.ok) throw new Error("FHI_HTTP_" + res.status);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

function parseListCards(html) {
    var items = [];
    var seen = {};
    var re = /href="(\/funeral-home\/(\d+)\/)"/g;
    var m;
    while ((m = re.exec(html))) {
        var fid = m[2];
        if (seen[fid]) continue;
        seen[fid] = true;
        var chunk = html.slice(m.index, m.index + 4000);
        var nameMatch = chunk.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
        var altMatch = chunk.match(/alt="([^"]+)"/);
        var name = stripTags(nameMatch ? nameMatch[1] : altMatch ? altMatch[1] : "");
        if (!name) continue;
        var imgMatch = chunk.match(/src="(\/media\/funeral-home\/\d+\/)"/);
        var typeMatch = chunk.match(/>(공설|사설)</);
        var addrMatch = chunk.match(/<p class="text-gray-600 text-sm[^"]*"[^>]*>([\s\S]*?)<\/p>/);
        var roomMatch = chunk.match(/빈소\s*<!--\s*-->\s*(\d+)\s*<!--\s*-->\s*실/);
        if (!roomMatch) roomMatch = chunk.match(/빈소\s*(\d+)\s*실/);
        var mortMatch = chunk.match(/안치실\s*<!--\s*-->\s*(\d+)\s*<!--\s*-->\s*실/);
        if (!mortMatch) mortMatch = chunk.match(/안치실\s*(\d+)\s*실/);
        items.push({
            fhi_id: fid,
            vn_company: name,
            vn_addr: stripTags(addrMatch ? addrMatch[1] : ""),
            vn_public_type: typeMatch ? typeMatch[1] : "",
            vn_room_count: roomMatch ? roomMatch[1] : "",
            vn_mortuary_count: mortMatch ? mortMatch[1] : "",
            vn_phone: "",
            vn_web: "",
            image_url: imgMatch ? FHI_BASE + imgMatch[1] : "",
            source: "funeralhallinfo"
        });
    }
    return items;
}

function parseRegionSummaries(html) {
    var out = {};
    for (var i = 0; i < FHI_REGIONS.length; i++) {
        var row = FHI_REGIONS[i];
        var slugEnc = encodeURIComponent(row.slug);
        var blockRe = new RegExp(
            'href="/regions/' + slugEnc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '/"[\\s\\S]{0,1200}?(\\d+)\\s*</div>\\s*<div class="text-xs text-gray-500">\\s*개소',
            "i"
        );
        var bm = html.match(blockRe);
        if (bm) out[row.slug] = parseInt(bm[1], 10);
    }
    return out;
}

async function fetchDetailPhone(fhiId) {
    try {
        var html = await fetchHtml("/funeral-home/" + fhiId + "/");
        var phones = html.match(/\d{2,3}-\d{3,4}-\d{4}/g) || [];
        if (!phones.length) return "";
        return phones[0];
    } catch (e) {
        return "";
    }
}

async function mapPool(items, fn, concurrency) {
    var out = new Array(items.length);
    var idx = 0;
    var workers = [];
    var n = Math.min(concurrency || 6, items.length || 1);
    for (var w = 0; w < n; w++) {
        workers.push(
            (async function worker() {
                while (true) {
                    var i = idx++;
                    if (i >= items.length) break;
                    out[i] = await fn(items[i], i);
                }
            })()
        );
    }
    await Promise.all(workers);
    return out;
}

async function enrichPhones(items) {
    await mapPool(
        items,
        async function (row) {
            if (row.vn_phone) return row;
            row.vn_phone = await fetchDetailPhone(row.fhi_id);
            return row;
        },
        8
    );
    return items;
}

async function getRegionSummaries() {
    var now = Date.now();
    if (cache.summaries.data && now - cache.summaries.at < CACHE_TTL_MS) {
        return cache.summaries.data;
    }
    var html = await fetchHtml("/regions/");
    var counts = parseRegionSummaries(html);
    var list = FHI_REGIONS.map(function (row) {
        return {
            id: row.id,
            label: row.label,
            sub: row.sub,
            slug: row.slug,
            icon: row.icon,
            count: counts[row.slug] || 0
        };
    });
    cache.summaries = { at: now, data: list };
    return list;
}

async function getRegionItems(region, options) {
    options = options || {};
    var slug = normRegionKey(region);
    var meta = findRegionMeta(slug);
    if (!meta) throw new Error("UNKNOWN_REGION");

    var now = Date.now();
    var cached = cache.regions[slug];
    if (!options.refresh && cached && cached.items && now - cached.at < CACHE_TTL_MS) {
        return { region: meta, items: cached.items, cached: true };
    }

    var html = await fetchHtml("/regions/" + encodeURIComponent(slug) + "/");
    var items = parseListCards(html);
    if (options.withPhones !== false) {
        await enrichPhones(items);
    }
    cache.regions[slug] = { at: now, items: items };
    return { region: meta, items: items, cached: false };
}

module.exports = {
    FHI_BASE,
    FHI_REGIONS,
    getRegionSummaries,
    getRegionItems,
    normRegionKey
};
