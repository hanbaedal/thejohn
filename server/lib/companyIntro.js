/** 회사소개 — 인사말·소개 이미지 (staff 컬렉션) */
const MAX_COMPANY_GREETING_CHARS = 540;
const MAX_COMPANY_INTRO_IMAGES = 15;

const WOOIL_INTRO_BLOCK_LABELS = ["비전", "경영 방침", "사훈", "경영 이념"];

function str(v) {
    return String(v ?? "").trim();
}

function normalizeCompanyGreeting(raw, options) {
    const opts = options || {};
    if (raw === undefined || raw === null) return undefined;
    const s = str(raw);
    if (!s) return "";
    if (s.length > MAX_COMPANY_GREETING_CHARS) {
        throw new Error(
            "인사말은 " + MAX_COMPANY_GREETING_CHARS + "자 이하로 입력해 주세요."
        );
    }
    return s;
}

function normalizeCompanyIntroImages(raw) {
    if (raw === undefined || raw === null) return undefined;
    if (!Array.isArray(raw)) {
        throw new Error("회사소개 이미지 형식이 올바르지 않습니다.");
    }
    const out = [];
    for (let i = 0; i < raw.length; i++) {
        const s = String(raw[i] || "").trim();
        if (!s) continue;
        if (!/^data:image\//i.test(s)) {
            throw new Error("회사소개 이미지는 사진 파일만 등록할 수 있습니다.");
        }
        if (s.length > 2.5 * 1024 * 1024) {
            throw new Error("회사소개 이미지 용량이 너무 큽니다. 다시 등록해 주세요.");
        }
        out.push(s);
        if (out.length > MAX_COMPANY_INTRO_IMAGES) {
            throw new Error(
                "회사소개 이미지는 최대 " + MAX_COMPANY_INTRO_IMAGES + "장까지 등록할 수 있습니다."
            );
        }
    }
    return out;
}

function readCompanyIntroImagesFromDoc(doc) {
    if (!doc) return [];
    const raw = doc.st_company_intro_images;
    if (!Array.isArray(raw)) return [];
    return raw.map(function (item) {
        return String(item || "").trim();
    }).filter(Boolean);
}

function buildWooilGreetingText(companyName) {
    const name = str(companyName) || "주식회사 우일푸드";
    return [
        "반갑습니다.",
        name + "에 오신 것을 환영합니다.",
        name +
            "는 성실과 노력으로 성장하는 기틀을 두고 있는 식자재 전문 납품기업입니다. " +
            name +
            "는 동북아시아의 중심 인천에 자리잡고 있으며 신선한 식자재 전문 납품기업으로 설립하여 기업의 경영이익이 이윤을 찾기보다는 신선하고 품질 좋은 식재료로서 최선을 다하는 자세로 임하겠습니다.",
        "본사는 위와 같은 설립취지의 마음으로 향후 국내 최고의 식자재 전문 유통기업으로서 책임과 의무를 다하겠습니다."
    ].join("\n\n");
}

function buildDefaultDojeonGreetingText(companyName) {
    const name = str(companyName).replace(/(은|는)$/, "") || "(주)더존";
    const eu = name.endsWith("존") ? "은" : "는";
    return [
        "안녕하십니까.",
        name +
            eu +
            " 전국 장례식장 식자재 공급 전문기업으로, 변화하는 장례식장 음식문화에 맞춰 더욱 전문적이고 체계적인 공급시스템을 구축해 운영하고 있는 중견기업입니다.",
        name +
            eu +
            " 정육, 건어물, 냉동식품, 냉동수산물, 공산품, 음료수 등 각 품목별 소사장 책임운영 체계를 도입하여, 보다 전문적이고 신속한 공급이 가능하도록 운영하고 있습니다.",
        "각 분야 담당자가 직접 품질과 납품을 책임지는 시스템을 통해 안정적인 물류와 높은 상품 경쟁력을 제공해 드리고 있는 것이 " +
            name +
            "만의 차별화된 운영 시스템입니다.",
        "따라서 " +
            name +
            eu +
            " 철저한 품질관리와 책임 있는 운영, 그리고 적극적인 현장 대응으로 장례식장의 든든한 파트너가 되는 것이 " +
            name +
            '의 "사명"입니다.',
        '앞으로 고객의 입장에서 먼저 고민하며 함께 성장하는 기업으로 "최선"을 다하겠습니다.<br>감사합니다.'
    ].join("\n\n");
}

function matchesWooilFoodCompany(company) {
    return String(company || "").indexOf("우일푸드") !== -1;
}

function matchesAkSangsaCompany(company) {
    const c = String(company || "")
        .replace(/\s+/g, "")
        .replace(/\(주\)/gi, "")
        .toLowerCase();
    if (!c) return false;
    return c.indexOf("에이케이") !== -1 || c.indexOf("에이메이") !== -1;
}

module.exports = {
    MAX_COMPANY_GREETING_CHARS,
    MAX_COMPANY_INTRO_IMAGES,
    WOOIL_INTRO_BLOCK_LABELS,
    normalizeCompanyGreeting,
    normalizeCompanyIntroImages,
    readCompanyIntroImagesFromDoc,
    buildWooilGreetingText,
    buildDefaultDojeonGreetingText,
    matchesWooilFoodCompany,
    matchesAkSangsaCompany
};
