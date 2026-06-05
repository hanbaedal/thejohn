const { F: VF, parseGrade, gradeDisplayLabel } = require("./vendorFields");
const { F: PF, readPricesFromDoc } = require("./productFields");
const {
    trimStaffLoginId,
    staffLoginIdsEqual,
    isLegacyRegisteredBy
} = require("./staffLoginId");

/**
 * 업체 거래처(등록 담당)와 상품 등록 담당이 같을 때만 등급별 가격.
 * 그 외(타 관리자 상품)는 무조건 가격1.
 */
function vendorOwnsProductPricing(vendorRegisteredBy, productRegisteredBy) {
    const v = trimStaffLoginId(vendorRegisteredBy);
    const p = trimStaffLoginId(productRegisteredBy);
    if (!v || isLegacyRegisteredBy(v) || !p || isLegacyRegisteredBy(p)) {
        return false;
    }
    return staffLoginIdsEqual(v, p);
}

function priceKeyForGrade(grade) {
    const g = parseGrade(grade) || "1";
    if (g === "2") return PF.price2;
    if (g === "3") return PF.price3;
    return PF.price1;
}

function priceLabelForGrade(grade) {
    return gradeDisplayLabel(grade);
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

/** @deprecated vendorProductAllowsOrderForVendor(productRegisteredBy, vendorDoc) 사용 */
function vendorProductAllowsOrder(productRegisteredBy, vendorRegisteredBy) {
    const p = trimStaffLoginId(productRegisteredBy);
    const v = trimStaffLoginId(vendorRegisteredBy);
    if (!p || !v || isLegacyRegisteredBy(p) || isLegacyRegisteredBy(v)) return false;
    return staffLoginIdsEqual(p, v);
}

module.exports = {
    vendorOwnsProductPricing,
    resolveVendorUnitPrice,
    priceLabelForGrade,
    vendorProductAllowsOrder
};
