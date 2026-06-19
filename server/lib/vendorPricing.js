const { F: VF, parseGrade, gradeDisplayLabel } = require("./vendorFields");
const { F: PF, readPricesFromDoc } = require("./productFields");
const { trimStaffLoginId, isLegacyRegisteredBy } = require("./staffLoginId");

function priceKeyForGrade(grade) {
    const g = parseGrade(grade) || "1";
    if (g === "2") return PF.price2;
    if (g === "3") return PF.price3;
    return PF.price1;
}

function priceLabelForGrade(grade) {
    return gradeDisplayLabel(grade);
}

/** 등급 칸이 비어 있거나 0이면 가격1 */
function unitPriceWithGradeFallback(prices, grade) {
    prices = prices || {};
    const key = priceKeyForGrade(grade);
    const primary = Number(prices[key]) || 0;
    if (primary > 0) {
        return {
            unitPrice: primary,
            priceLabel: priceLabelForGrade(grade),
            pricingMode: "grade",
            priceKey: key
        };
    }
    const fallback = Number(prices[PF.price1]) || 0;
    return {
        unitPrice: fallback,
        priceLabel: priceLabelForGrade(grade) + (key !== PF.price1 ? "→가격1" : ""),
        pricingMode: fallback > 0 && key !== PF.price1 ? "grade_fallback_price1" : "grade",
        priceKey: PF.price1
    };
}

/**
 * 상품 + (해당 상품 등록 관리자 기준) 업체 문서 → 단가
 * vendorDoc는 pd_registered_by 와 vn_registered_by 가 맞는 업체 레코드
 */
function resolveVendorUnitPrice(productDoc, vendorDoc) {
    const prices = readPricesFromDoc(productDoc);
    if (!vendorDoc) {
        return {
            unitPrice: Number(prices[PF.price1]) || 0,
            priceLabel: "가격1",
            pricingMode: "price1"
        };
    }
    const grade = parseGrade(vendorDoc[VF.grade] || vendorDoc.vn_grade) || "1";
    return unitPriceWithGradeFallback(prices, grade);
}

/** @deprecated */
function vendorOwnsProductPricing(vendorRegisteredBy, productRegisteredBy) {
    const v = trimStaffLoginId(vendorRegisteredBy);
    const p = trimStaffLoginId(productRegisteredBy);
    if (!v || isLegacyRegisteredBy(v) || !p || isLegacyRegisteredBy(p)) return false;
    return v.toLowerCase() === p.toLowerCase();
}

function vendorProductAllowsOrder(productRegisteredBy, vendorRegisteredBy) {
    return vendorOwnsProductPricing(productRegisteredBy, vendorRegisteredBy);
}

module.exports = {
    vendorOwnsProductPricing,
    resolveVendorUnitPrice,
    unitPriceWithGradeFallback,
    priceLabelForGrade,
    priceKeyForGrade,
    vendorProductAllowsOrder
};
