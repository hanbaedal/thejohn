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

function pickAddressFromBody(body, prev, fieldNames) {
    const fn = fieldNames || {};
    const zipK = fn.zip || "st_zip";
    const addrK = fn.addr || "st_addr";
    const detailK = fn.detail || "st_addr_detail";
    const legacyK = fn.legacy || "st_address";

    const p = prev || {};
    const zip = str(body[zipK] != null ? body[zipK] : p[zipK]);
    const addr = str(
        body[addrK] != null
            ? body[addrK]
            : body[legacyK] != null
              ? body[legacyK]
              : p[addrK] || p[legacyK]
    );
    const detail = str(body[detailK] != null ? body[detailK] : p[detailK]);
    const legacy = formatFullAddress(zip, addr, detail);

    const out = {};
    out[zipK] = zip;
    out[addrK] = addr;
    out[detailK] = detail;
    if (legacyK) out[legacyK] = legacy || str(body[legacyK] != null ? body[legacyK] : p[legacyK]);
    return out;
}

module.exports = {
    str,
    formatFullAddress,
    hydrateAddressFields,
    pickAddressFromBody
};
