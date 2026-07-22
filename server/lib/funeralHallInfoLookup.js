/**
 * e하늘(15774129.go.kr) — 서울·경기·인천 장례식장 목록·이미지
 * fac_list.ajax · price_info.ajax (공공 장사정보 포털)
 */

var ESKY_BASE = "https://15774129.go.kr";
var FHI_BASE = ESKY_BASE;
var FACILITY_GROUP_FUNERAL = "TBC0700001";
var PAGE_SIZE = 12;

var FHI_REGIONS = [
    { id: "seoul", label: "서울", sub: "서울특별시", slug: "서울", icon: "🏢", sidocd: "1100000000" },
    { id: "gyeonggi", label: "경기", sub: "경기도", slug: "경기", icon: "🏘️", sidocd: "4100000000" },
    { id: "incheon", label: "인천", sub: "인천광역시", slug: "인천", icon: "🌊", sidocd: "2800000000" }
];

var CACHE_TTL_MS = 24 * 60 * 60 * 1000;
var cache = {
    summaries: { at: 0, data: null },
    regions: {},
    images: {},
    imagePaths: {}
};

var UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function normRegionKey(region) {
    var r = String(region || "").trim();
    for (var i = 0; i < FHI_REGIONS.length; i++) {
        var row = FHI_REGIONS[i];
        if (r === row.id || r === row.label || r === row.slug || r === row.sub || r === row.sidocd) {
            return row.slug;
        }
    }
    return r;
}

function findRegionMeta(slug) {
    for (var i = 0; i < FHI_REGIONS.length; i++) {
        if (FHI_REGIONS[i].slug === slug) return FHI_REGIONS[i];
    }
    return null;
}

/** 주소에서 시·구·군(읍·면) 추출 */
function parseDistrictFromAddr(addr) {
    var s = String(addr || "")
        .trim()
        .replace(/\([^)]*\)/g, "")
        .trim();
    if (!s) return "기타";

    var m;
    m = s.match(/^서울특별시\s+(\S+?[구군])/);
    if (m) return m[1];

    m = s.match(/^인천광역시\s+(\S+?[구군])/);
    if (m) return m[1];

    m = s.match(/^경기도\s+(\S+?[시군])/);
    if (m) return m[1];

    var parts = s.split(/\s+/);
    if (parts.length >= 2 && /(?:특별시|광역시|도)$/.test(parts[0])) return parts[1];
    return "기타";
}

function attachDistricts(items) {
    for (var i = 0; i < items.length; i++) {
        if (!items[i].district) {
            items[i].district = parseDistrictFromAddr(items[i].vn_addr);
        }
    }
    return items;
}

function publicCodeLabel(code) {
    var c = String(code || "").trim();
    if (c === "TCM0100001") return "공설";
    if (c === "TCM0100002") return "사설";
    return "";
}

function stripBom(text) {
    return String(text || "").replace(/^\uFEFF/, "");
}

function rememberImagePath(facilitycd, fileurl) {
    var id = String(facilitycd || "").trim();
    var path = String(fileurl || "").trim();
    if (id && path && path !== "/BCUser/") {
        cache.imagePaths[id] = path;
    }
}

function normalizeHomepage(url) {
    var u = String(url || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return "https://" + u.replace(/^\/\//, "");
}

async function postEskyAjax(path, params) {
    var body = new URLSearchParams();
    Object.keys(params || {}).forEach(function (key) {
        var val = params[key];
        if (val != null) body.set(key, String(val));
    });

    var controller = new AbortController();
    var timer = setTimeout(function () {
        controller.abort();
    }, 25000);
    try {
        var res = await fetch(ESKY_BASE + path, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                Accept: "application/json, text/javascript, */*; q=0.01",
                "X-Requested-With": "XMLHttpRequest",
                "User-Agent": UA
            },
            body: body.toString(),
            signal: controller.signal
        });
        if (!res.ok) throw new Error("ESKY_HTTP_" + res.status);
        var json = JSON.parse(stripBom(await res.text()));
        if (!json.isSuccess) {
            throw new Error(String(json.errorMessage || "ESKY_API_FAIL"));
        }
        return json;
    } finally {
        clearTimeout(timer);
    }
}

function mapListRow(row) {
    var facilitycd = String(row.facilitycd || "").trim();
    var fileurl = String(row.fileurl || "").trim();
    rememberImagePath(facilitycd, fileurl);
    return {
        fhi_id: facilitycd,
        esky_id: facilitycd,
        facilitycd: facilitycd,
        vn_company: String(row.companyname || "").trim(),
        vn_addr: String(row.fulladdress || "").trim(),
        district: parseDistrictFromAddr(row.fulladdress),
        vn_public_type: publicCodeLabel(row.publiccode),
        vn_room_count: "",
        vn_mortuary_count: "",
        vn_phone: String(row.telephone || "").trim(),
        vn_web: "",
        fileurl: fileurl,
        image_url: fileurl && fileurl !== "/BCUser/" ? ESKY_BASE + fileurl : "",
        sanbundiv: String(row.sanbundiv || "N").trim() || "N",
        source: "esky"
    };
}

async function fetchFacListPage(sidocd, pageNo) {
    return postEskyAjax("/portal/fnlfac/fac_list.ajax", {
        curPageNo: String(pageNo),
        pageInqCnt: String(PAGE_SIZE),
        sidocd: sidocd,
        gungucd: "",
        companyname: "",
        facilitygroupcd: FACILITY_GROUP_FUNERAL,
        publiccode: ""
    });
}

async function fetchAllFacList(sidocd) {
    var page = 1;
    var total = 0;
    var items = [];
    while (true) {
        var data = await fetchFacListPage(sidocd, page);
        total = Number(data.cnt) || 0;
        var batch = data.list || [];
        for (var i = 0; i < batch.length; i++) {
            items.push(mapListRow(batch[i]));
        }
        if (!batch.length || items.length >= total) break;
        page += 1;
    }
    return { total: total, items: items };
}

async function fetchFacilityDetail(facilitycd, sanbundiv) {
    var data = await postEskyAjax("/portal/fnlfac/price_info.ajax", {
        facilitycd: String(facilitycd || ""),
        sanbundiv: String(sanbundiv || "N")
    });
    var detail = data.detail || {};
    return {
        vn_room_count: detail.charnelabilitycnt != null ? String(detail.charnelabilitycnt) : "",
        vn_mortuary_count: detail.mortuaycnt != null ? String(detail.mortuaycnt) : "",
        vn_phone: String(detail.telephone || "").trim(),
        vn_web: normalizeHomepage(detail.homepage)
    };
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

async function enrichDetails(items) {
    await mapPool(
        items,
        async function (row) {
            if (!row || !row.facilitycd) return row;
            try {
                var extra = await fetchFacilityDetail(row.facilitycd, row.sanbundiv);
                if (extra.vn_room_count) row.vn_room_count = extra.vn_room_count;
                if (extra.vn_mortuary_count) row.vn_mortuary_count = extra.vn_mortuary_count;
                if (extra.vn_phone) row.vn_phone = extra.vn_phone;
                if (extra.vn_web) row.vn_web = extra.vn_web;
            } catch (e) {
                /* 상세 없으면 목록 값 유지 */
            }
            return row;
        },
        6
    );
    return items;
}

async function fetchEskyImageBuffer(facilitycd, fileurl) {
    var id = String(facilitycd || "").trim();
    var path = String(fileurl || cache.imagePaths[id] || "").trim();
    if (!path || path === "/BCUser/") throw new Error("NO_ESKY_IMAGE");

    var now = Date.now();
    var cacheKey = id + "|" + path;
    var cached = cache.images[cacheKey];
    if (cached && now - cached.at < CACHE_TTL_MS) {
        return cached;
    }

    var url = path.indexOf("http") === 0 ? path : ESKY_BASE + path;
    var controller = new AbortController();
    var timer = setTimeout(function () {
        controller.abort();
    }, 25000);
    try {
        var res = await fetch(url, {
            method: "GET",
            headers: {
                "User-Agent": UA,
                Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                Referer: ESKY_BASE + "/portal/esky/fnlfac/fac_list.do"
            },
            signal: controller.signal
        });
        if (!res.ok) throw new Error("ESKY_IMG_" + res.status);
        var buf = Buffer.from(await res.arrayBuffer());
        var entry = {
            at: now,
            buf: buf,
            type: String(res.headers.get("content-type") || "image/jpeg").split(";")[0].trim()
        };
        cache.images[cacheKey] = entry;
        return entry;
    } finally {
        clearTimeout(timer);
    }
}

/** @deprecated funeralhallinfo 호환 — esky fetch 사용 */
async function fetchFhiImageBuffer(fhiId, fileurl) {
    return fetchEskyImageBuffer(fhiId, fileurl);
}

async function getRegionSummaries() {
    var now = Date.now();
    if (cache.summaries.data && now - cache.summaries.at < CACHE_TTL_MS) {
        return cache.summaries.data;
    }

    var list = [];
    for (var i = 0; i < FHI_REGIONS.length; i++) {
        var row = FHI_REGIONS[i];
        var count = 0;
        try {
            var data = await fetchFacListPage(row.sidocd, 1);
            count = Number(data.cnt) || 0;
        } catch (e) {
            count = 0;
        }
        list.push({
            id: row.id,
            label: row.label,
            sub: row.sub,
            slug: row.slug,
            icon: row.icon,
            count: count
        });
    }

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
        return { region: meta, items: attachDistricts(cached.items.slice()), cached: true };
    }

    var fetched = await fetchAllFacList(meta.sidocd);
    var items = attachDistricts(fetched.items);
    if (options.withPhones !== false) {
        await enrichDetails(items);
    }

    cache.regions[slug] = { at: now, items: items };
    return { region: meta, items: items, cached: false };
}

module.exports = {
    ESKY_BASE,
    FHI_BASE,
    FHI_REGIONS,
    getRegionSummaries,
    getRegionItems,
    fetchFhiImageBuffer,
    fetchEskyImageBuffer,
    parseDistrictFromAddr,
    normRegionKey,
    rememberImagePath
};
