const { F: VF, parseGrade } = require("./vendorFields");
const { F: PF, readPricesFromDoc } = require("./productFields");
const { normalizeStaffLoginId, LEGACY_REGISTERED_BY } = require("./vendorAccess");

/**
 * 업체 거래처(등록 담당)와 상품 등록 담당이 같을 때만 등급별 가격.
 * 그 외(타 관리자 상품)는 무조건 가격1.
 */
function vendorOwnsProductPricing(vendorRegisteredBy, productRegisteredBy) {
    const v = normalizeStaffLoginId(vendorRegisteredBy);
    const p = normalizeStaffLoginId(productRegisteredBy);
    if (!v || v === LEGACY_REGISTERED_BY || !p || p === LEGACY_REGISTERED_BY) {
        return false;
    }
    return v === p;
}

function priceKeyForGrade(grade) {
    const g = parseGrade(grade) || "1";
    if (g === "2") return PF.price2;
    if (g === "3") return PF.price3;
    return PF.price1;
}

function priceLabelForGrade(grade) {
    const g = parseGrade(grade) || "1";
    return g + "등급";
}

function resolveVendorUnitPrice(productDoc, vendorDoc) {
    const prices = readPricesFromDoc(productDoc);
    const vendorReg = vendorDoc ? vendorDoc[VF.registeredBy] : "";
    const productReg = productDoc ? productDoc[PF.registeredBy] : "";

    if (vendorOwnsProductPricing(vendorReg, productReg)) {
        const grade = parseGrade(vendorDoc[VF.grade]) || "1";
        const key = priceKeyForGrade(grade);
        return {
            unitPrice: Number(prices[key]) || 0,
            priceLabel: priceLabelForGrade(grade),
            pricingMode: "grade"
        };
    }

    return {
        unitPrice: Number(prices[PF.price1]) || 0,
        priceLabel: "가격1",
        pricingMode: "price1"
    };
}

/** 주문·장바구니 — pd_registered_by 가 ORDER_VENDOR_STAFF_ID(기본 aksangsa) 인 상품만 */
function vendorProductAllowsOrder(productRegisteredBy) {
    const { getOrderEnabledStaffId } = require("./orderAccess");
    const p = normalizeStaffLoginId(productRegisteredBy);
    if (!p || p === LEGACY_REGISTERED_BY) return false;
    return p === getOrderEnabledStaffId();
}

module.exports = {
    vendorOwnsProductPricing,
    resolveVendorUnitPrice,
    priceLabelForGrade,
    vendorProductAllowsOrder
};
