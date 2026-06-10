const { buildLoginFields, getStoredPassword } = require("./loginAccount");
const {
    normalizeCompanyGreeting,
    normalizeCompanyIntroImages
} = require("./companyIntro");
const {
    formatFullAddress,
    hydrateAddressFields,
    pickAddressFromBody
} = require("./addressFormat");
const {
    trimStaffLoginId,
    staffLoginIdKey,
    staffLoginIdsEqual,
    loginIdValues,
    registeredByInFilter,
    isLegacyRegisteredBy
} = require("./staffLoginId");

/** staff 컬렉션 — vendors와 같은 개념의 로그인·업체 정보 */
const F = {
    company: "st_company",
    phone: "st_phone",
    fax: "st_fax",
    ceo: "st_ceo",
    ceoTel: "st_ceo_tel",
    email: "st_email",
    web: "st_web",
    bizNo: "st_biz_no",
    bizType: "st_biz_type",
    bizItem: "st_biz_item",
    zip: "st_zip",
    addr: "st_addr",
    addrDetail: "st_addr_detail",
    address: "st_address",
    facebook: "st_facebook",
    instagram: "st_instagram",
    naverCafe: "st_naver_cafe",
    youtube: "st_youtube",
    kakao: "st_kakao",
    logo: "st_logo",
    seal: "st_seal",
    companyGreeting: "st_company_greeting",
    companyIntroImages: "st_company_intro_images",
    companyIntroImageCount: "st_company_intro_image_count",
    orderEnabled: "st_order_enabled"
};

/** 로그인·헤더용 — 회사소개 이미지 배열(base64 다수) 제외 */
const STAFF_PROJECTION_NO_INTRO = { st_company_intro_images: 0 };

/** 로그인 검증용 — 대용량 미디어·인사말 제외(로고는 이후 staff-profile에서) */
const STAFF_PROJECTION_LOGIN = {
    st_company_intro_images: 0,
    st_company_greeting: 0,
    st_seal: 0,
    st_logo: 0
};

/** 회사 소개 관리 — 인사말·소개 이미지만 (로고·도장 제외) */
const STAFF_PROJECTION_COMPANY_INTRO = {
    id: 1,
    loginId: 1,
    role: 1,
    st_company: 1,
    st_company_greeting: 1,
    st_company_intro_images: 1
};

/**
 * 기본 staff 시드 — 서버 기동 시 MongoDB에만 반영·비어 있는 필드만 보강합니다.
 * 로그인은 항상 DB 조회(loginResolve.js). 슈퍼바이저는 hanbaedal 하나,
 * 관리자(admin)는 staff 컬렉션의 모든 해당 행이며 시드 외 추가는 POST /api/staff(슈퍼바이저) 등으로 확장합니다.
 */
const CORE_STAFF_ACCOUNTS = [
    {
        id: "st_admin_thejohn",
        loginId: "thejohn",
        password: "leesb0129!",
        st_company: "(주) 더존",
        st_phone: "032-666-5255",
        st_fax: "032-662-5246",
        st_ceo: "이상범",
        st_ceo_tel: "01029288196",
        role: "admin"
    },
    {
        id: "st_supervisor_hanbaedal",
        loginId: "hanbaedal",
        password: "haesoo.3346!",
        st_company: "한가람",
        st_ceo: "해수",
        st_ceo_tel: "01082170323",
        role: "supervisor"
    }
];

/** 구 MongoDB 문서 id (loginId 아님) — 기존 DB 삭제 방지·registered_by 정리용 */
const LEGACY_PROTECTED_STAFF_DOC_IDS = ["st_admin_aksangsa"];

const OPTIONAL_ORDER_ADMIN_SEED_ID = "st_admin_aemae";

function getDefaultStaffAccounts() {
    return CORE_STAFF_ACCOUNTS.slice();
}

function getProtectedStaffSeedIds() {
    return CORE_STAFF_ACCOUNTS.map(function (s) {
        return s.id;
    }).concat(LEGACY_PROTECTED_STAFF_DOC_IDS, [OPTIONAL_ORDER_ADMIN_SEED_ID]);
}

/** @deprecated — getDefaultStaffAccounts() 사용 */
const DEFAULT_STAFF_ACCOUNTS = getDefaultStaffAccounts();

const DEFAULT_STAFF_IDS = getProtectedStaffSeedIds();

const EXPECTED_STAFF_LOGIN_IDS = CORE_STAFF_ACCOUNTS.map(function (s) {
    return s.loginId;
});

function str(v) {
    return String(v ?? "").trim();
}

/** 카카오 채널 ID·URL → 채팅 URL (https://pf.kakao.com/_ID/chat) */
function normalizeKakaoChannelUrl(raw) {
    const s = str(raw);
    if (!s) return "";
    if (/^_[A-Za-z0-9]+$/.test(s)) {
        return `https://pf.kakao.com/${s}/chat`;
    }
    let m = s.match(/pf\.kakao\.com\/(_[A-Za-z0-9]+)/i);
    if (m) return `https://pf.kakao.com/${m[1]}/chat`;
    if (/^[A-Za-z0-9]{4,}$/.test(s) && !s.includes(".") && !s.includes("/")) {
        return `https://pf.kakao.com/_${s}/chat`;
    }
    if (/^https?:\/\//i.test(s)) {
        if (/pf\.kakao\.com\/_[A-Za-z0-9]+/i.test(s)) {
            return s.replace(/\/+$/, "").replace(/\/chat$/i, "") + "/chat";
        }
        return s;
    }
    return s;
}

/** 저장·표시용 — loginId 원문(대소문자 유지). 비교는 staffLoginIdsEqual / staffLoginIdKey */
function normalizeStaffLoginId(loginId) {
    return trimStaffLoginId(loginId);
}

function staffOrderEnabledFromDoc(doc) {
    if (!doc || doc.role !== "admin") return false;
    return doc[F.orderEnabled] === true || doc.st_order_enabled === true;
}

function fromLegacyDoc(doc) {
    if (!doc) return null;
    const d = Object.assign({}, doc);
    if (doc.st_company != null && str(doc.st_company)) d[F.company] = str(doc.st_company);
    else if (!str(d[F.company])) {
        if (doc.companyName) d[F.company] = str(doc.companyName);
        else if (doc.role === "supervisor") d[F.company] = "(주)더존";
    }
    if (doc.st_ceo != null && str(doc.st_ceo)) d[F.ceo] = str(doc.st_ceo);
    else if (!str(d[F.ceo])) {
        if (doc.name) d[F.ceo] = str(doc.name);
        else if (doc.ceo) d[F.ceo] = str(doc.ceo);
        else if (doc.role === "supervisor") d[F.ceo] = "슈퍼바이저";
    }
    if (doc.st_phone != null) d[F.phone] = str(doc.st_phone);
    else if (!d[F.phone] && doc.phone) d[F.phone] = str(doc.phone);
    if (doc.st_fax != null) d[F.fax] = str(doc.st_fax);
    if (doc.st_ceo_tel != null) d[F.ceoTel] = str(doc.st_ceo_tel);
    else if (!d[F.ceoTel] && doc.ceoPhone) d[F.ceoTel] = str(doc.ceoPhone);
    if (doc.st_email != null) d[F.email] = str(doc.st_email);
    else if (!d[F.email] && doc.email) d[F.email] = str(doc.email);
    if (doc.st_web != null) d[F.web] = str(doc.st_web);
    if (doc.st_biz_no != null) d[F.bizNo] = str(doc.st_biz_no);
    if (doc.st_biz_type != null) d[F.bizType] = str(doc.st_biz_type);
    if (doc.st_biz_item != null) d[F.bizItem] = str(doc.st_biz_item);
    if (doc.st_zip != null) d[F.zip] = str(doc.st_zip);
    if (doc.st_addr != null) d[F.addr] = str(doc.st_addr);
    if (doc.st_addr_detail != null) d[F.addrDetail] = str(doc.st_addr_detail);
    if (doc.st_address != null) d[F.address] = str(doc.st_address);
    else if (!d[F.address] && doc.address) d[F.address] = str(doc.address);
    hydrateAddressFields(d, {
        zip: F.zip,
        addr: F.addr,
        detail: F.addrDetail,
        legacy: F.address
    });
    if (doc.st_facebook != null) d[F.facebook] = str(doc.st_facebook);
    if (doc.st_instagram != null) d[F.instagram] = str(doc.st_instagram);
    if (doc.st_naver_cafe != null) d[F.naverCafe] = str(doc.st_naver_cafe);
    if (doc.st_youtube != null) d[F.youtube] = str(doc.st_youtube);
    if (doc.st_kakao != null) d[F.kakao] = str(doc.st_kakao);
    if (doc.st_logo != null) d[F.logo] = String(doc.st_logo);
    if (doc.st_seal != null) d[F.seal] = String(doc.st_seal);
    if (doc.st_company_greeting != null) d[F.companyGreeting] = String(doc.st_company_greeting);
    if (Array.isArray(doc.st_company_intro_images)) {
        d[F.companyIntroImages] = doc.st_company_intro_images
            .map(function (item) {
                return String(item || "").trim();
            })
            .filter(Boolean);
    }
    return d;
}

function companyIntroImageCountFromDoc(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return 0;
    const stored = parseInt(d[F.companyIntroImageCount], 10);
    if (isFinite(stored) && stored >= 0) return stored;
    if (!Array.isArray(d[F.companyIntroImages])) return 0;
    return d[F.companyIntroImages].filter(function (item) {
        return String(item || "").trim();
    }).length;
}

function toPublic(doc, options) {
    const opts = options || {};
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    const pub = {
        id: str(d.id) || str(d.loginId) || "",
        loginId: d.loginId || "",
        st_company: str(d[F.company]),
        st_phone: str(d[F.phone]),
        st_fax: str(d[F.fax]),
        st_ceo: str(d[F.ceo]),
        st_ceo_tel: str(d[F.ceoTel]),
        st_email: str(d[F.email]),
        st_web: str(d[F.web]),
        st_biz_no: str(d[F.bizNo]),
        st_biz_type: str(d[F.bizType]),
        st_biz_item: str(d[F.bizItem]),
        st_zip: str(d[F.zip]),
        st_addr: str(d[F.addr]),
        st_addr_detail: str(d[F.addrDetail]),
        st_address: str(d[F.address]),
        st_facebook: str(d[F.facebook]),
        st_instagram: str(d[F.instagram]),
        st_naver_cafe: str(d[F.naverCafe]),
        st_youtube: str(d[F.youtube]),
        st_kakao: normalizeKakaoChannelUrl(d[F.kakao]),
        st_logo: String(d[F.logo] || ""),
        st_seal: String(d[F.seal] || ""),
        st_company_greeting: String(d[F.companyGreeting] || ""),
        st_company_intro_images: opts.light
            ? []
            : Array.isArray(d[F.companyIntroImages])
              ? d[F.companyIntroImages].slice()
              : [],
        st_company_intro_image_count: companyIntroImageCountFromDoc(d),
        role: d.role || "admin",
        active: d.active !== false,
        loginEnabled: d.loginEnabled !== false,
        orderEnabled: staffOrderEnabledFromDoc(d),
        updatedAt: d.updatedAt || 0
    };
    if (opts.includePassword) {
        pub.password = getStoredPassword(doc);
    }
    return pub;
}

function getCompanyName(doc) {
    const d = fromLegacyDoc(doc);
    return d ? str(d[F.company]) : "";
}

function getCeoName(doc) {
    const d = fromLegacyDoc(doc);
    return d ? str(d[F.ceo]) : "";
}

function buildFromBody(body, existing, loginId, password) {
    const prev = fromLegacyDoc(existing) || {};
    const loginFields = buildLoginFields(
        loginId,
        password || (existing ? getStoredPassword(existing) : "")
    );

    const addrParts = pickAddressFromBody(body, prev, {
        zip: "st_zip",
        addr: "st_addr",
        detail: "st_addr_detail",
        legacy: "st_address"
    });

    return {
        loginId: loginFields.loginId,
        loginIdNorm: loginFields.loginIdNorm,
        st_company: str(body.st_company != null ? body.st_company : body.companyName || prev[F.company]),
        st_phone: str(body.st_phone != null ? body.st_phone : prev[F.phone]),
        st_fax: str(body.st_fax != null ? body.st_fax : prev[F.fax]),
        st_ceo: str(body.st_ceo != null ? body.st_ceo : body.name || prev[F.ceo]),
        st_ceo_tel: str(body.st_ceo_tel != null ? body.st_ceo_tel : body.ceoPhone || prev[F.ceoTel]),
        st_email: str(body.st_email != null ? body.st_email : prev[F.email]),
        st_web: str(body.st_web != null ? body.st_web : prev[F.web]),
        st_biz_no: str(body.st_biz_no != null ? body.st_biz_no : prev[F.bizNo]),
        st_biz_type: str(body.st_biz_type != null ? body.st_biz_type : prev[F.bizType]),
        st_biz_item: str(body.st_biz_item != null ? body.st_biz_item : prev[F.bizItem]),
        st_zip: addrParts.st_zip,
        st_addr: addrParts.st_addr,
        st_addr_detail: addrParts.st_addr_detail,
        st_address: addrParts.st_address,
        st_facebook: str(body.st_facebook != null ? body.st_facebook : prev[F.facebook]),
        st_instagram: str(body.st_instagram != null ? body.st_instagram : prev[F.instagram]),
        st_naver_cafe: str(body.st_naver_cafe != null ? body.st_naver_cafe : prev[F.naverCafe]),
        st_youtube: str(body.st_youtube != null ? body.st_youtube : prev[F.youtube]),
        st_kakao: normalizeKakaoChannelUrl(
            body.st_kakao != null ? body.st_kakao : prev[F.kakao]
        ),
        st_logo:
            body.st_logo !== undefined && body.st_logo !== null
                ? String(body.st_logo)
                : String(prev[F.logo] || ""),
        st_seal:
            body.st_seal !== undefined && body.st_seal !== null
                ? String(body.st_seal)
                : String(prev[F.seal] || ""),
        st_company_greeting:
            body.st_company_greeting !== undefined
                ? normalizeCompanyGreeting(body.st_company_greeting) ?? ""
                : String(prev[F.companyGreeting] || ""),
        st_company_intro_images:
            body.st_company_intro_images !== undefined
                ? normalizeCompanyIntroImages(body.st_company_intro_images) ?? []
                : Array.isArray(prev[F.companyIntroImages])
                  ? prev[F.companyIntroImages].slice()
                  : [],
        role: body.role || prev.role || "admin",
        loginEnabled:
            body.loginEnabled === false || body.loginEnabled === "false" || body.loginEnabled === 0
                ? false
                : body.loginEnabled === true ||
                    body.loginEnabled === "true" ||
                    body.loginEnabled === 1
                  ? true
                  : existing
                    ? existing.loginEnabled !== false
                    : true,
        st_order_enabled:
            body.orderEnabled === false ||
            body.orderEnabled === "false" ||
            body.orderEnabled === 0 ||
            body.st_order_enabled === false
                ? false
                : body.orderEnabled === true ||
                    body.orderEnabled === "true" ||
                    body.orderEnabled === 1 ||
                    body.st_order_enabled === true
                  ? true
                  : existing
                    ? existing[F.orderEnabled] === true || existing.st_order_enabled === true
                    : false
    };
}

function toDbDoc(id, built, existing) {
    const doc = {
        id,
        loginId: built.loginId,
        loginIdNorm: built.loginIdNorm,
        [F.company]: built.st_company,
        [F.phone]: built.st_phone,
        [F.fax]: built.st_fax,
        [F.ceo]: built.st_ceo,
        [F.ceoTel]: built.st_ceo_tel,
        [F.email]: built.st_email,
        [F.web]: built.st_web,
        [F.bizNo]: built.st_biz_no,
        [F.bizType]: built.st_biz_type,
        [F.bizItem]: built.st_biz_item,
        [F.zip]: built.st_zip,
        [F.addr]: built.st_addr,
        [F.addrDetail]: built.st_addr_detail,
        [F.address]: built.st_address,
        [F.facebook]: built.st_facebook,
        [F.instagram]: built.st_instagram,
        [F.naverCafe]: built.st_naver_cafe,
        [F.youtube]: built.st_youtube,
        [F.kakao]: built.st_kakao,
        [F.logo]: built.st_logo,
        [F.seal]: built.st_seal,
        [F.companyGreeting]: built.st_company_greeting,
        [F.companyIntroImages]: Array.isArray(built.st_company_intro_images)
            ? built.st_company_intro_images
            : [],
        [F.companyIntroImageCount]: Array.isArray(built.st_company_intro_images)
            ? built.st_company_intro_images.filter(function (item) {
                  return String(item || "").trim();
              }).length
            : companyIntroImageCountFromDoc(existing),
        role: built.role,
        active: existing?.active !== false,
        loginEnabled: built.loginEnabled !== false,
        [F.orderEnabled]: built.st_order_enabled === true,
        updatedAt: Date.now()
    };
    if (existing?.createdAt) doc.createdAt = existing.createdAt;
    else doc.createdAt = Date.now();
    if (Array.isArray(existing?.previousLoginIds) && existing.previousLoginIds.length) {
        doc.previousLoginIds = existing.previousLoginIds.slice();
    }
    if (built.loginEnabled !== false && existing) {
        var ids = [];
        if (Array.isArray(existing.activeSessionIds)) ids = existing.activeSessionIds.slice();
        else if (existing.activeSessionId) ids = [existing.activeSessionId];
        if (ids.length) doc.activeSessionIds = ids;
        if (existing.sessionUpdatedAt) doc.sessionUpdatedAt = existing.sessionUpdatedAt;
    }
    if (existing) {
        if (existing.passwordHash) doc.passwordHash = existing.passwordHash;
        if (existing.password) doc.password = existing.password;
        if (existing.passwordAscii) doc.passwordAscii = existing.passwordAscii;
    }
    return doc;
}

function legacyStaffUnset() {
    return {
        name: "",
        companyName: "",
        ceo: "",
        ceoPhone: "",
        password: "",
        passwordAscii: "",
        passwordHash: ""
    };
}

/** 같은 loginId를 쓰는 옛 문서 제거 (고유 인덱스 충돌 방지) — 시드 계정의 현재 loginId 기준 */
async function removeStaffLoginIdConflicts(col, seed) {
    const existing = await col.findOne({ id: seed.id });
    const canonicalLoginId =
        existing && str(existing.loginId) ? str(existing.loginId) : str(seed.loginId);
    if (!canonicalLoginId) return;

    const loginIds = [canonicalLoginId];
    const idn = staffLoginIdKey(canonicalLoginId);
    if (idn === "thejohn" || idn === "thejhon") {
        loginIds.push("thejohn", "thejhon");
    }

    await col.deleteMany({
        loginId: { $in: loginIds },
        id: { $ne: seed.id }
    });
}

/** 기존 staff 행이 있으면 시드로 덮어쓰지 않고, 비어 있는 필드만 채움 */
function seedProfileBody(seed, existing) {
    if (!existing) {
        return {
            st_company: seed.st_company || "",
            st_phone: seed.st_phone || "",
            st_fax: seed.st_fax || "",
            st_ceo: seed.st_ceo || "",
            st_ceo_tel: seed.st_ceo_tel || "",
            role: seed.role
        };
    }
    const prev = fromLegacyDoc(existing) || {};
    function pick(field, seedVal) {
        var cur = str(prev[field]);
        if (cur) return cur;
        return str(seedVal);
    }
    return {
        st_company: pick(F.company, seed.st_company),
        st_phone: pick(F.phone, seed.st_phone),
        st_fax: pick(F.fax, seed.st_fax),
        st_ceo: pick(F.ceo, seed.st_ceo),
        st_ceo_tel: pick(F.ceoTel, seed.st_ceo_tel),
        st_email: pick(F.email, ""),
        st_web: pick(F.web, ""),
        st_biz_no: pick(F.bizNo, ""),
        st_biz_type: pick(F.bizType, ""),
        st_biz_item: pick(F.bizItem, ""),
        st_address: pick(F.address, ""),
        role: existing.role || seed.role
    };
}

async function ensureDefaultStaffSeeds(db) {
    const col = db.collection("staff");
    const pwFromEnv = String(process.env.THEJHON_SEED_SUPERVISOR_PASSWORD || "").trim();
    const { setLoginPassword } = require("./loginAccount");

    await col.deleteOne({ id: "st_supervisor_thejohn" });
    await col.deleteOne({ id: "st_supervisor_thejhon" });

    for (const seed of CORE_STAFF_ACCOUNTS) {
        await removeStaffLoginIdConflicts(col, seed);

        const existing = await col.findOne({ id: seed.id });
        const seedPassword =
            seed.loginId === "thejohn" && pwFromEnv ? pwFromEnv : seed.password;

        if (existing) {
            var storedPw = getStoredPassword(existing);
            if (!storedPw) {
                await setLoginPassword(col, { id: seed.id }, seed.loginId, seedPassword);
            } else if (seed.loginId === "thejohn" && pwFromEnv) {
                await setLoginPassword(col, { id: seed.id }, seed.loginId, pwFromEnv);
            }

            var patch = {};
            if (!str(existing.loginId)) patch.loginId = seed.loginId;
            if (!existing.role) patch.role = seed.role;
            if (existing.active === false) patch.active = true;

            var profile = seedProfileBody(seed, existing);
            var prev = fromLegacyDoc(existing) || {};
            if (!str(prev[F.company]) && profile.st_company) patch[F.company] = profile.st_company;
            if (!str(prev[F.phone]) && profile.st_phone) patch[F.phone] = profile.st_phone;
            if (!str(prev[F.fax]) && profile.st_fax) patch[F.fax] = profile.st_fax;
            if (!str(prev[F.ceo]) && profile.st_ceo) patch[F.ceo] = profile.st_ceo;
            if (!str(prev[F.ceoTel]) && profile.st_ceo_tel) patch[F.ceoTel] = profile.st_ceo_tel;

            if (Object.keys(patch).length) {
                patch.updatedAt = Date.now();
                await col.updateOne({ id: seed.id }, { $set: patch });
            }
            console.log("[staff] seed kept (no overwrite):", seed.loginId, seed.id);
            continue;
        }

        const built = buildFromBody(seedProfileBody(seed, null), null, seed.loginId, seedPassword);
        const doc = toDbDoc(seed.id, built, null);
        await col.insertOne(doc);
        console.log("[staff] seed created:", doc.loginId, doc.role, doc.id);
    }

    await ensureOptionalOrderAdminSeed(col);
}

/** 환경 변수로만 선택 시드 — 주문 권한 관리자 (loginId는 DB·슈퍼바이저 화면에서 관리) */
async function ensureOptionalOrderAdminSeed(col) {
    const loginId = String(process.env.SEED_ORDER_ADMIN_LOGIN || "").trim();
    const password = String(process.env.SEED_ORDER_ADMIN_PASSWORD || "").trim();
    if (!loginId || !password) return;

    let existing = await col.findOne({ id: OPTIONAL_ORDER_ADMIN_SEED_ID });
    if (!existing) {
        for (let i = 0; i < LEGACY_PROTECTED_STAFF_DOC_IDS.length; i++) {
            existing = await col.findOne({ id: LEGACY_PROTECTED_STAFF_DOC_IDS[i] });
            if (existing) break;
        }
    }
    if (existing) {
        console.log("[staff] order admin seed skipped (existing doc):", existing.loginId, existing.id);
        return;
    }

    const built = buildFromBody(
        {
            st_company: String(process.env.SEED_ORDER_ADMIN_COMPANY || "(주)에이메이상사").trim(),
            st_ceo: String(process.env.SEED_ORDER_ADMIN_CEO || "").trim(),
            st_ceo_tel: String(process.env.SEED_ORDER_ADMIN_CEO_TEL || "").trim(),
            role: "admin",
            orderEnabled: true
        },
        null,
        loginId,
        password
    );
    const doc = toDbDoc(OPTIONAL_ORDER_ADMIN_SEED_ID, built, null);
    await col.insertOne(doc);
    console.log("[staff] order admin seed created:", doc.loginId, doc.id);
}

function staffNeedsFieldMigration(doc) {
    if (!doc || !doc.id) return false;
    if (!str(doc[F.company]) && (doc.companyName || doc.st_company)) return true;
    if (doc.companyName) return true;
    if (doc.name && !str(doc[F.ceo])) return true;
    if (doc.ceo && !str(doc[F.ceo])) return true;
    if (doc.ceoPhone && !str(doc[F.ceoTel])) return true;
    if (doc.address && !str(doc[F.addr]) && !str(doc.st_addr)) return true;
    if (doc.st_address && !str(doc[F.addr]) && !str(doc.st_addr)) return true;
    return false;
}

function staffMigrationBodyFromDoc(doc) {
    const body = {
        st_company: doc[F.company] || doc.companyName,
        st_phone: doc[F.phone] || doc.st_phone,
        st_fax: doc[F.fax] || doc.st_fax,
        st_ceo: doc[F.ceo] || doc.name || doc.ceo,
        st_ceo_tel: doc[F.ceoTel] || doc.ceoPhone,
        st_email: doc[F.email] || doc.st_email,
        st_web: doc[F.web] || doc.st_web,
        st_biz_no: doc[F.bizNo] || doc.st_biz_no,
        st_biz_type: doc[F.bizType] || doc.st_biz_type,
        st_biz_item: doc[F.bizItem] || doc.st_biz_item,
        st_facebook: doc[F.facebook] || doc.st_facebook,
        st_instagram: doc[F.instagram] || doc.st_instagram,
        st_naver_cafe: doc[F.naverCafe] || doc.st_naver_cafe,
        st_youtube: doc[F.youtube] || doc.st_youtube,
        st_kakao: doc[F.kakao] || doc.st_kakao,
        role: doc.role
    };
    const zip = str(doc[F.zip] || doc.st_zip);
    const addr = str(doc[F.addr] || doc.st_addr);
    const detail = str(doc[F.addrDetail] || doc.st_addr_detail);
    const legacy = str(doc[F.address] || doc.st_address || doc.address);
    if (zip) body.st_zip = zip;
    if (addr) body.st_addr = addr;
    if (detail) body.st_addr_detail = detail;
    if (legacy) body.st_address = legacy;
    return body;
}

var STAFF_MIGRATE_PROJECT = {
    id: 1,
    loginId: 1,
    role: 1,
    companyName: 1,
    name: 1,
    ceo: 1,
    ceoPhone: 1,
    address: 1,
    st_company: 1,
    st_phone: 1,
    st_fax: 1,
    st_ceo: 1,
    st_ceo_tel: 1,
    st_email: 1,
    st_web: 1,
    st_biz_no: 1,
    st_biz_type: 1,
    st_biz_item: 1,
    st_zip: 1,
    st_addr: 1,
    st_addr_detail: 1,
    st_address: 1,
    st_facebook: 1,
    st_instagram: 1,
    st_naver_cafe: 1,
    st_youtube: 1,
    st_kakao: 1,
    st_order_enabled: 1,
    active: 1,
    loginEnabled: 1,
    password: 1,
    passwordHash: 1
};
STAFF_MIGRATE_PROJECT[F.company] = 1;
STAFF_MIGRATE_PROJECT[F.phone] = 1;
STAFF_MIGRATE_PROJECT[F.fax] = 1;
STAFF_MIGRATE_PROJECT[F.ceo] = 1;
STAFF_MIGRATE_PROJECT[F.ceoTel] = 1;
STAFF_MIGRATE_PROJECT[F.email] = 1;
STAFF_MIGRATE_PROJECT[F.web] = 1;
STAFF_MIGRATE_PROJECT[F.bizNo] = 1;
STAFF_MIGRATE_PROJECT[F.bizType] = 1;
STAFF_MIGRATE_PROJECT[F.bizItem] = 1;
STAFF_MIGRATE_PROJECT[F.zip] = 1;
STAFF_MIGRATE_PROJECT[F.addr] = 1;
STAFF_MIGRATE_PROJECT[F.addrDetail] = 1;
STAFF_MIGRATE_PROJECT[F.address] = 1;
STAFF_MIGRATE_PROJECT[F.facebook] = 1;
STAFF_MIGRATE_PROJECT[F.instagram] = 1;
STAFF_MIGRATE_PROJECT[F.naverCafe] = 1;
STAFF_MIGRATE_PROJECT[F.youtube] = 1;
STAFF_MIGRATE_PROJECT[F.kakao] = 1;
STAFF_MIGRATE_PROJECT[F.orderEnabled] = 1;

async function migrateStaffCollection(db) {
    const col = db.collection("staff");
    const docs = await col.find({}).project(STAFF_MIGRATE_PROJECT).toArray();
    let n = 0;
    let skipped = 0;
    for (const doc of docs) {
        if (!doc.id) continue;
        if (DEFAULT_STAFF_IDS.includes(doc.id)) continue;
        if (!staffNeedsFieldMigration(doc)) {
            skipped++;
            continue;
        }

        const full = await col.findOne({ id: doc.id });
        if (!full) continue;
        const pw = getStoredPassword(full);
        const built = buildFromBody(
            staffMigrationBodyFromDoc(full),
            full,
            full.loginId || "",
            pw
        );
        await col.replaceOne({ id: doc.id }, toDbDoc(doc.id, built, full));
        n++;
    }
    if (n) console.log("[staff] migrated field names:", n, "skipped:", skipped);
    await migrateStaffOrderEnabled(col);
}

async function migrateStaffOrderEnabled(col) {
    const docs = await col
        .find({ role: "admin" })
        .project({ id: 1, role: 1, st_order_enabled: 1, [F.orderEnabled]: 1 })
        .toArray();
    let n = 0;
    for (const doc of docs) {
        if (doc[F.orderEnabled] !== undefined || doc.st_order_enabled !== undefined) continue;
        await col.updateOne(
            { id: doc.id },
            { $set: { [F.orderEnabled]: false, updatedAt: Date.now() } }
        );
        n++;
    }
    if (n) console.log("[staff] migrated st_order_enabled (default off):", n);
}

async function findExpectedStaffInDb(db) {
    const col = db.collection("staff");
    return col
        .find({
            id: { $in: DEFAULT_STAFF_IDS },
            active: { $ne: false }
        })
        .project({ id: 1, loginId: 1, role: 1, st_company: 1, _id: 0 })
        .toArray();
}

function staffSeedAccountsOk(docs) {
    return CORE_STAFF_ACCOUNTS.every(function (seed) {
        return (docs || []).some(function (d) {
            return d.id === seed.id;
        });
    });
}

module.exports = {
    F,
    STAFF_PROJECTION_NO_INTRO,
    STAFF_PROJECTION_LOGIN,
    STAFF_PROJECTION_COMPANY_INTRO,
    fromLegacyDoc,
    DEFAULT_STAFF_ACCOUNTS,
    DEFAULT_STAFF_IDS,
    EXPECTED_STAFF_LOGIN_IDS,
    CORE_STAFF_ACCOUNTS,
    getDefaultStaffAccounts,
    getProtectedStaffSeedIds,
    LEGACY_PROTECTED_STAFF_DOC_IDS,
    OPTIONAL_ORDER_ADMIN_SEED_ID,
    toPublic,
    buildFromBody,
    toDbDoc,
    getCompanyName,
    getCeoName,
    ensureDefaultStaffSeeds,
    migrateStaffCollection,
    findExpectedStaffInDb,
    staffSeedAccountsOk,
    legacyStaffUnset,
    normalizeStaffLoginId,
    trimStaffLoginId,
    staffLoginIdKey,
    staffLoginIdsEqual,
    loginIdValues,
    registeredByInFilter,
    isLegacyRegisteredBy,
    staffOrderEnabledFromDoc,
    migrateStaffOrderEnabled,
    normalizeKakaoChannelUrl
};
