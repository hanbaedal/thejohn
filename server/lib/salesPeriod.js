const { parseYmdToMs, ymdFromMs } = require("./accessLog");

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstCalendarParts(ts) {
    const kst = new Date((ts || Date.now()) + KST_OFFSET_MS);
    return {
        y: kst.getUTCFullYear(),
        m: kst.getUTCMonth(),
        d: kst.getUTCDate()
    };
}

function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function toYmd(y, m, d) {
    return (
        String(y) +
        "-" +
        String(m + 1).padStart(2, "0") +
        "-" +
        String(d).padStart(2, "0")
    );
}

/** 1일=오늘 · 1개월=지난달 · 3개월=지난달 포함 최근 3달(당월 제외) */
function resolveSalesPeriod(preset, dateFrom, dateTo) {
    const key = String(preset || "")
        .trim()
        .toLowerCase();
    const p = kstCalendarParts(Date.now());

    if (key === "today" || key === "1day" || key === "1일") {
        const ymd = toYmd(p.y, p.m, p.d);
        return { ok: true, preset: "today", dateFrom: ymd, dateTo: ymd, label: "1일" };
    }

    if (key === "lastmonth" || key === "1month" || key === "1개월") {
        let y = p.y;
        let m = p.m - 1;
        if (m < 0) {
            m = 11;
            y -= 1;
        }
        const from = toYmd(y, m, 1);
        const to = toYmd(y, m, daysInMonth(y, m));
        return { ok: true, preset: "lastMonth", dateFrom: from, dateTo: to, label: "1개월" };
    }

    if (key === "last3months" || key === "3months" || key === "3개월") {
        let endY = p.y;
        let endM = p.m - 1;
        if (endM < 0) {
            endM = 11;
            endY -= 1;
        }
        let startM = endM - 2;
        let startY = endY;
        while (startM < 0) {
            startM += 12;
            startY -= 1;
        }
        const from = toYmd(startY, startM, 1);
        const to = toYmd(endY, endM, daysInMonth(endY, endM));
        return { ok: true, preset: "last3Months", dateFrom: from, dateTo: to, label: "3개월" };
    }

    const from = String(dateFrom || "").trim();
    const to = String(dateTo || "").trim();
    if (!from || !to) {
        return { error: "기간을 선택해 주세요." };
    }
    const fromMs = parseYmdToMs(from, false);
    const toMs = parseYmdToMs(to, true);
    if (!fromMs || !toMs || fromMs >= toMs) {
        return { error: "기간 날짜가 올바르지 않습니다." };
    }
    return { ok: true, preset: "custom", dateFrom: from, dateTo: to, label: "기간설정" };
}

function buildIssueDateQuery(dateFrom, dateTo) {
    const fromMs = parseYmdToMs(dateFrom, false);
    const toMs = parseYmdToMs(dateTo, true);
    if (!fromMs || !toMs || fromMs >= toMs) {
        return { error: "기간 선택이 올바르지 않습니다." };
    }
    return {
        query: { issueDate: { $gte: fromMs, $lt: toMs } },
        fromMs: fromMs,
        toMs: toMs
    };
}

module.exports = {
    kstCalendarParts,
    resolveSalesPeriod,
    buildIssueDateQuery,
    ymdFromMs,
    toYmd
};
