/**
 * 주소 → 시·구·군 분류 (예비 업체 찾기 상세보기)
 */
(function (global) {
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

        m = s.match(/^경기도\s+(\S+?[시군])\s+(\S+?[구읍면])/);
        if (m && /[구읍면]$/.test(m[2])) return m[1] + " " + m[2];

        m = s.match(/^경기도\s+(\S+?[시군])/);
        if (m) return m[1];

        var parts = s.split(/\s+/);
        if (parts.length >= 2 && /(?:특별시|광역시|도)$/.test(parts[0])) return parts[1];
        return "기타";
    }

    function enrichItems(items) {
        (items || []).forEach(function (it) {
            if (!it.district) it.district = parseDistrictFromAddr(it.vn_addr);
        });
        return items;
    }

    function sortDistrictKeys(keys) {
        return (keys || []).slice().sort(function (a, b) {
            if (a === "기타") return 1;
            if (b === "기타") return -1;
            return a.localeCompare(b, "ko");
        });
    }

    function countByDistrict(items) {
        var map = {};
        enrichItems(items);
        (items || []).forEach(function (it) {
            var d = it.district || "기타";
            map[d] = (map[d] || 0) + 1;
        });
        return map;
    }

    function groupByDistrict(items) {
        var map = {};
        enrichItems(items);
        (items || []).forEach(function (it) {
            var d = it.district || "기타";
            if (!map[d]) map[d] = [];
            map[d].push(it);
        });
        return sortDistrictKeys(Object.keys(map)).map(function (district) {
            return { district: district, items: map[district] };
        });
    }

    global.THEJHON_VENDOR_DISTRICT = {
        parse: parseDistrictFromAddr,
        enrichItems: enrichItems,
        groupByDistrict: groupByDistrict,
        countByDistrict: countByDistrict,
        sortDistrictKeys: sortDistrictKeys
    };
})(typeof window !== "undefined" ? window : this);
