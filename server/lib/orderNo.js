/** 주문서 번호 — DZ + KST 연월일 + 당일 순번 (예: DZ20260617-003) */

function kstYmd(date) {
    const d = date || new Date();
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const kst = new Date(utc + 9 * 3600000);
    const y = kst.getFullYear();
    const m = String(kst.getMonth() + 1).padStart(2, "0");
    const day = String(kst.getDate()).padStart(2, "0");
    return "" + y + m + day;
}

async function allocVendorOrderNo(db) {
    const ymd = kstYmd();
    const col = db.collection("order_daily_counters");
    const id = "vendor_" + ymd;
    await col.updateOne({ _id: id }, { $inc: { seq: 1 } }, { upsert: true });
    const doc = await col.findOne({ _id: id });
    const seq = doc && doc.seq ? doc.seq : 1;
    return "DZ" + ymd + "-" + String(seq).padStart(3, "0");
}

module.exports = {
    kstYmd,
    allocVendorOrderNo
};
