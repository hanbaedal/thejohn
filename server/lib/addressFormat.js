/** 우편번호·도로명 주소·상세주소 — 우편 스티커·표시용 */

function str(v) {
    return String(v ?? "").trim();
}

function formatFullAddress(zip, addr, detail) {
    const parts = [];
    const z = str(zip);
    const a = str(addr);
    const d = str(detail);
    if (z) parts.push(z);
    if (a) parts.push(a);
    if (d) parts.push(d);
    return parts.join(" ");
}

/** 레거시 한 줄 주소 → 3필드 보강 (우편번호·상세 없으면 전체를 주소 칸에) */
function hydrateAddressFields(d, keys) {
    if (!d || !keys) return d;
    const zipKey = keys.zip;
    const addrKey = keys.addr;
    const detailKey = keys.detail;
    const legacyKey = keys.legacy;

    let zip = str(d[zipKey]);
    let addr = str(d[addrKey]);
    let detail = str(d[detailKey]);
    const legacy = legacyKey ? str(d[legacyKey]) : "";

    if (!zip && !addr && !detail && legacy) {
        addr = legacy;
    }
    if (zipKey) d[zipKey] = zip;
    if (addrKey) d[addrKey] = addr;
    if (detailKey) d[detailKey] = detail;
    if (legacyKey) {
        d[legacyKey] = formatFullAddress(zip, addr, detail) || legacy;
    }
    return d;
}

function hasBodyField(body, key) {
    return !!key && Object.prototype.hasOwnProperty.call(body, key);
}

/** 요청에 필드가 없거나 undefined면 prev 유지. 빈 문자열은 의도적 삭제로 처리 */
function readBodyField(body, prev, key) {
    if (!key) return "";
    const p = prev || {};
    if (!hasBodyField(body, key) || body[key] === undefined) {
        return str(p[key]);
    }
    return str(body[key]);
}

/** 레거시 한 줄 주소 앞 5자리 우편번호 */
function extractZipFromLine(line) {
    const m = str(line).match(/^(\d{5})(?:\s+|$)/);
    return m ? m[1] : "";
}

/** st_addr에 우편번호·상세가 합쳐 저장된 경우 분리 필드로 복구 */
function repairMergedAddressFields(zip, addr, detail) {
    let z = str(zip);
    let a = str(addr);
    let d = str(detail);
    if (!z || !a) return { zip: z, addr: a, detail: d };

    const prefix = z + " ";
    if (a === z || a.startsWith(prefix)) {
        let road = a === z ? "" : a.slice(prefix.length).trim();
        if (road.startsWith(prefix)) {
            road = road.slice(prefix.length).trim();
        }
        if (d) {
            const tail = " " + d;
            if (road.endsWith(tail)) {
                road = road.slice(0, -tail.length).trim();
            } else if (road.endsWith(d)) {
                road = road.slice(0, -d.length).trim();
            }
        }
        if (road) a = road;
    }
    return { zip: z, addr: a, detail: d };
}

/** 요청 body에 필드가 없으면 prev(기존 DB) 분리 필드를 유지. legacy 한 줄은 분리 필드가 없을 때만 사용 */
function pickAddressFromBody(body, prev, fieldNames) {
    const fn = fieldNames || {};
    const zipK = fn.zip || "st_zip";
    const addrK = fn.addr || "st_addr";
    const detailK = fn.detail || "st_addr_detail";
    const legacyK = fn.legacy || "st_address";

    const p = prev || {};
    let zip = readBodyField(body, p, zipK);
    let addr = readBodyField(body, p, addrK);
    let detail = readBodyField(body, p, detailK);

    if (!addr && legacyK) {
        const legacyLine = readBodyField(body, p, legacyK);
        if (legacyLine) addr = legacyLine;
    }

    if (!zip && addr) {
        const parsedZip = extractZipFromLine(addr);
        if (parsedZip) {
            zip = parsedZip;
            const prefix = parsedZip + " ";
            if (addr === parsedZip) {
                addr = "";
            } else if (addr.startsWith(prefix)) {
                addr = addr.slice(prefix.length).trim();
            }
        }
    }

    const repaired = repairMergedAddressFields(zip, addr, detail);
    zip = repaired.zip;
    addr = repaired.addr;
    detail = repaired.detail;

    const legacy = formatFullAddress(zip, addr, detail);

    const out = {};
    out[zipK] = zip;
    out[addrK] = addr;
    out[detailK] = detail;
    if (legacyK) {
        const prevLegacy = str(p[legacyK] || "");
        const bodyLegacy = readBodyField(body, p, legacyK);
        out[legacyK] = legacy || bodyLegacy || prevLegacy;
    }
    return out;
}

module.exports = {
    str,
    formatFullAddress,
    hydrateAddressFields,
    repairMergedAddressFields,
    readBodyField,
    extractZipFromLine,
    pickAddressFromBody
};
