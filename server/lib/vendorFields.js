const {
    buildLoginFields,
    getStoredPassword,
    getVendorStoredPassword,
    vendorHasCanonicalLoginSchema,
    normalizeLoginId,
    normalizePasswordInput
} = require("./loginAccount");
const { hydrateAddressFields, pickAddressFromBody } = require("./addressFormat");

/** vendors 컬렉션 필드 */
/** 상품 카탈로그 6부문 + 신규업체용 미계약 */
const PARTNER_DEPT_IDS = ["jeongyuk", "driedfish", "frozen", "seafood", "grocery", "drink"];

const VALID_DEPT_IDS = PARTNER_DEPT_IDS.concat(["uncontracted"]);
const MAX_VENDOR_NOTE_LEN = 256;

const VENDOR_DEPT_LABEL_TO_ID = {
    미계약: "uncontracted",
    uncontracted: "uncontracted"
};

const LEGACY_DEPT_MAP = {
    livestock: "jeongyuk",
    meals: "frozen",
    banchan: "grocery"
};

const F = {
    company: "vn_company",
    depts: "vn_depts",
    ceo: "vn_ceo",
    ceoTel: "vn_ceo_tel",
    grade: "vn_grade",
    roomCount: "vn_room_count",
    web: "vn_web",
    email: "vn_email",
    phone: "vn_phone",
    bizNo: "vn_biz_no",
    bizItem: "vn_biz_item",
    bizType: "vn_biz_type",
    zip: "vn_zip",
    addr: "vn_addr",
    addrDetail: "vn_addr_detail",
    mgrName: "vn_mgr_name",
    mgrTel: "vn_mgr_tel",
    mgrEmail: "vn_mgr_email",
    logo: "vn_logo",
    note: "vn_note",
    recordType: "vn_record_type",
    registeredBy: "vn_registered_by",
    registeredByName: "vn_registered_by_name",
    registeredAt: "vn_registered_at"
};

const RECORD_PARTNER = "partner";
const RECORD_NEW = "new";

const FHI_EXTRA_KEYS = [
    "fhi_id",
    "vn_public_type",
    "vn_fax",
    "vn_mortuary_count",
    "vn_park_count",
    "fileurl",
    "mealroomyn",
    "waitroomyn",
    "parkyn",
    "superyn",
    "imparyn"
];

function copyFhiExtrasToDoc(doc, existing) {
    if (!existing || !doc) return doc;
    FHI_EXTRA_KEYS.forEach(function (key) {
        if (existing[key] != null && str(existing[key])) {
            doc[key] = existing[key];
        }
    });
    return doc;
}

function normalizeRecordType(v) {
    return String(v || "")
        .trim()
        .toLowerCase() === RECORD_NEW
        ? RECORD_NEW
        : RECORD_PARTNER;
}

function str(v) {
    return String(v ?? "").trim();
}

function parseRoomCount(v) {
    const s = str(v);
    if (!s) return "";
    const n = parseInt(s.replace(/[^\d-]/g, ""), 10);
    if (!Number.isFinite(n) || n < 0) return "";
    return String(n);
}

const VENDOR_GRADE_MAX = 3;

function parseGrade(v) {
    const n = parseInt(v, 10);
    if (n >= 1 && n <= VENDOR_GRADE_MAX) return String(n);
    if (n === 4) return "3";
    return "";
}

const GRADE_DISPLAY = { "1": "Silver", "2": "Gold", "3": "Diamond" };

function gradeDisplayLabel(v) {
    const g = parseGrade(v) || "1";
    return GRADE_DISPLAY[g] || GRADE_DISPLAY["1"];
}

function normalizeDeptId(v) {
    var raw = String(v || "").trim();
    if (!raw) return "";
    if (VENDOR_DEPT_LABEL_TO_ID[raw]) return VENDOR_DEPT_LABEL_TO_ID[raw];
    var id = raw.toLowerCase();
    if (LEGACY_DEPT_MAP[id]) return LEGACY_DEPT_MAP[id];
    if (VENDOR_DEPT_LABEL_TO_ID[id]) return VENDOR_DEPT_LABEL_TO_ID[id];
    return id;
}

function filterPartnerDepts(depts) {
    const list = Array.isArray(depts) ? depts : [];
    const out = [];
    const seen = new Set();
    for (const item of list) {
        const id = normalizeDeptId(item);
        if (!id || !PARTNER_DEPT_IDS.includes(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

function validatePartnerDeptsForRegister(depts) {
    if (!filterPartnerDepts(depts).length) {
        return "사업부문을 한개이상 선택하세요!";
    }
    return "";
}

function parseDeptsList(body, prev) {
    let raw = body?.vn_depts;
    if (raw == null && prev && prev[F.depts]) raw = prev[F.depts];
    let list = [];
    if (Array.isArray(raw)) list = raw;
    else if (typeof raw === "string" && raw.trim()) {
        list = raw.split(",");
    }
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const id = normalizeDeptId(item);
        if (!id || !VALID_DEPT_IDS.includes(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

function fromLegacyDoc(doc) {
    if (!doc) return null;
    const d = Object.assign({}, doc);
    if (!d[F.company] && doc.companyName) d[F.company] = String(doc.companyName).trim();
    if (!d[F.ceo] && doc.ceo) d[F.ceo] = String(doc.ceo).trim();
    if (!d[F.ceoTel] && doc.ceoPhone) d[F.ceoTel] = String(doc.ceoPhone).trim();
    if (!d[F.grade] && doc.vn_grade) d[F.grade] = parseGrade(doc.vn_grade);
    if (!d[F.roomCount] && (doc.vn_room_count != null || doc.roomCount != null)) {
        d[F.roomCount] = parseRoomCount(doc.vn_room_count != null ? doc.vn_room_count : doc.roomCount);
    }
    if (!d[F.web] && doc.website) d[F.web] = String(doc.website).trim();
    if (!d[F.email] && doc.email) d[F.email] = String(doc.email).trim();
    if (!d[F.phone] && doc.phone) d[F.phone] = String(doc.phone).trim();
    if (doc.vn_zip != null) d[F.zip] = str(doc.vn_zip);
    if (!d[F.addr] && doc.address) d[F.addr] = String(doc.address).trim();
    if (doc.vn_addr_detail != null) d[F.addrDetail] = str(doc.vn_addr_detail);
    hydrateAddressFields(d, {
        zip: F.zip,
        addr: F.addr,
        detail: F.addrDetail,
        legacy: null
    });
    if (!d[F.mgrName] && doc.manager) d[F.mgrName] = String(doc.manager).trim();
    if (!d[F.mgrTel] && doc.managerPhone) d[F.mgrTel] = String(doc.managerPhone).trim();
    if (!d[F.mgrEmail] && doc.mgrEmail) d[F.mgrEmail] = String(doc.mgrEmail).trim();
    if (!d[F.logo] && doc.logo) d[F.logo] = String(doc.logo);
    if (!d[F.note] && doc.note) d[F.note] = String(doc.note).trim();
    if (!d[F.grade]) d[F.grade] = parseGrade(d[F.grade]) || "1";
    if (!d[F.recordType] && doc.vn_record_type) d[F.recordType] = normalizeRecordType(doc.vn_record_type);
    if (!d[F.recordType]) d[F.recordType] = RECORD_PARTNER;
    if (!d[F.registeredBy] && doc.vn_registered_by) d[F.registeredBy] = str(doc.vn_registered_by);
    if (!d[F.registeredByName] && doc.vn_registered_by_name) {
        d[F.registeredByName] = str(doc.vn_registered_by_name);
    }
    if (!d[F.registeredAt] && doc.vn_registered_at) d[F.registeredAt] = doc.vn_registered_at;
    if (!d[F.depts] && Array.isArray(doc.vn_depts)) d[F.depts] = doc.vn_depts;
    else if (!d[F.depts] && typeof doc.vn_depts === "string") {
        d[F.depts] = parseDeptsList({ vn_depts: doc.vn_depts }, null);
    } else if (!d[F.depts]) d[F.depts] = [];
    return d;
}

function getCompanyName(doc) {
    if (!doc) return "";
    const d = fromLegacyDoc(doc);
    if (d && str(d[F.company])) return str(d[F.company]);
    return str(doc[F.company]) || str(doc.vn_company) || str(doc.companyName) || "";
}

function toPublic(doc, options) {
    const opts = options || {};
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    const pub = {
        id: d.id,
        loginId: d.loginId || "",
        vn_company: str(d[F.company]),
        vn_depts: Array.isArray(d[F.depts]) ? d[F.depts] : [],
        vn_ceo: str(d[F.ceo]),
        vn_ceo_tel: str(d[F.ceoTel]),
        vn_grade: parseGrade(d[F.grade]) || "1",
        vn_room_count: parseRoomCount(d[F.roomCount]),
        vn_web: str(d[F.web]),
        vn_email: str(d[F.email]),
        vn_phone: str(d[F.phone]),
        vn_biz_no: str(d[F.bizNo] || d.vn_biz_no),
        vn_biz_item: str(d[F.bizItem] || d.vn_biz_item),
        vn_biz_type: str(d[F.bizType] || d.vn_biz_type),
        vn_zip: str(d[F.zip]),
        vn_addr: str(d[F.addr]),
        vn_addr_detail: str(d[F.addrDetail]),
        vn_mgr_name: str(d[F.mgrName]),
        vn_mgr_tel: str(d[F.mgrTel]),
        vn_mgr_email: str(d[F.mgrEmail]),
        vn_logo: String(d[F.logo] || ""),
        vn_note: str(d[F.note]),
        vn_record_type: normalizeRecordType(d[F.recordType]),
        vn_registered_by: str(d[F.registeredBy]),
        vn_registered_by_name: str(d[F.registeredByName]),
        vn_registered_at: d[F.registeredAt] || 0,
        updatedAt: d.updatedAt || 0,
        vn_promoted_vendor_id: str(doc.vn_promoted_vendor_id || ""),
        vn_promoted_at: doc.vn_promoted_at || 0,
        fhi_id: str(doc.fhi_id || ""),
        vn_public_type: str(doc.vn_public_type || ""),
        vn_fax: str(doc.vn_fax || ""),
        vn_mortuary_count: str(doc.vn_mortuary_count || ""),
        vn_park_count: str(doc.vn_park_count || ""),
        fileurl: str(doc.fileurl || ""),
        mealroomyn: str(doc.mealroomyn || ""),
        waitroomyn: str(doc.waitroomyn || ""),
        parkyn: str(doc.parkyn || ""),
        superyn: str(doc.superyn || ""),
        imparyn: str(doc.imparyn || "")
    };
    if (opts.includePassword) {
        pub.password = getVendorStoredPassword(doc);
    }
    return pub;
}

function resolvePasswordPlain(existing, loginId, password) {
    const incoming = normalizePasswordInput(password);
    if (incoming) return incoming;
    if (existing) return getVendorStoredPassword(existing) || getStoredPassword(existing);
    return "";
}

function buildFromBody(body, existing, loginId, password) {
    const prev = fromLegacyDoc(existing) || {};
    const loginFields = buildLoginFields(loginId, "");
    const passwordPlain = resolvePasswordPlain(existing, loginId, password);

    const addrParts = pickAddressFromBody(body, prev, {
        zip: "vn_zip",
        addr: "vn_addr",
        detail: "vn_addr_detail",
        legacy: null
    });

    const built = {
        loginId: loginFields.loginId,
        loginIdNorm: normalizeLoginId(loginFields.loginId),
        passwordPlain: passwordPlain,
        vn_company: str(body.vn_company != null ? body.vn_company : body.companyName),
        vn_depts: parseDeptsList(body, prev),
        vn_ceo: str(body.vn_ceo != null ? body.vn_ceo : body.ceo),
        vn_ceo_tel: str(body.vn_ceo_tel != null ? body.vn_ceo_tel : body.ceoPhone),
        vn_grade: parseGrade(body.vn_grade != null ? body.vn_grade : prev[F.grade]) || "1",
        vn_room_count: parseRoomCount(
            body.vn_room_count != null ? body.vn_room_count : prev[F.roomCount]
        ),
        vn_web: str(body.vn_web != null ? body.vn_web : body.website),
        vn_email: str(body.vn_email != null ? body.vn_email : body.email),
        vn_phone: str(body.vn_phone != null ? body.vn_phone : body.phone),
        vn_biz_no: str(body.vn_biz_no != null ? body.vn_biz_no : prev[F.bizNo]),
        vn_biz_item: str(body.vn_biz_item != null ? body.vn_biz_item : prev[F.bizItem]),
        vn_biz_type: str(body.vn_biz_type != null ? body.vn_biz_type : prev[F.bizType]),
        vn_zip: addrParts.vn_zip,
        vn_addr: addrParts.vn_addr,
        vn_addr_detail: addrParts.vn_addr_detail,
        vn_mgr_name: str(body.vn_mgr_name != null ? body.vn_mgr_name : body.manager),
        vn_mgr_tel: str(body.vn_mgr_tel != null ? body.vn_mgr_tel : body.managerPhone),
        vn_mgr_email: str(body.vn_mgr_email != null ? body.vn_mgr_email : body.mgrEmail),
        vn_logo:
            body.vn_logo !== undefined && body.vn_logo !== null
                ? String(body.vn_logo)
                : body.logo !== undefined && body.logo !== null
                  ? String(body.logo)
                  : String(prev[F.logo] || ""),
        vn_note: str(body.vn_note != null ? body.vn_note : body.note).slice(0, MAX_VENDOR_NOTE_LEN),
        vn_record_type:
            body.vn_record_type != null
                ? normalizeRecordType(body.vn_record_type)
                : normalizeRecordType(prev[F.recordType])
    };

    return built;
}

/** 저장 직전 — 업체 로고를 540×540 JPEG로 통일 */
async function finalizeVendorBuilt(built) {
    if (!built || !built.vn_logo) return built;
    const { normalizeVendorLogo540 } = require("./image540");
    built.vn_logo = await normalizeVendorLogo540(built.vn_logo);
    return built;
}

function toDbDoc(id, built, existing) {
    const passwordPlain = built.passwordPlain || "";
    const doc = {
        id,
        loginId: built.loginId,
        loginIdNorm: built.loginIdNorm,
        password: passwordPlain,
        [F.company]: built.vn_company,
        [F.depts]: built.vn_depts,
        [F.ceo]: built.vn_ceo,
        [F.ceoTel]: built.vn_ceo_tel,
        [F.grade]: built.vn_grade,
        [F.roomCount]: built.vn_room_count || "",
        [F.web]: built.vn_web,
        [F.email]: built.vn_email,
        [F.phone]: built.vn_phone,
        [F.bizNo]: built.vn_biz_no,
        [F.bizItem]: built.vn_biz_item,
        [F.bizType]: built.vn_biz_type,
        [F.zip]: built.vn_zip,
        [F.addr]: built.vn_addr,
        [F.addrDetail]: built.vn_addr_detail,
        [F.mgrName]: built.vn_mgr_name,
        [F.mgrTel]: built.vn_mgr_tel,
        [F.mgrEmail]: built.vn_mgr_email,
        [F.logo]: built.vn_logo,
        [F.note]: built.vn_note,
        [F.recordType]: built.vn_record_type,
        updatedAt: Date.now()
    };
    if (existing?.createdAt) doc.createdAt = existing.createdAt;
    else doc.createdAt = Date.now();
    if (existing && existing[F.registeredBy]) {
        doc[F.registeredBy] = existing[F.registeredBy];
        doc[F.registeredByName] = existing[F.registeredByName] || "";
        if (existing[F.registeredAt]) doc[F.registeredAt] = existing[F.registeredAt];
    }
    if (existing) {
        if (!passwordPlain && existing.passwordHash) doc.passwordHash = existing.passwordHash;
        if (!passwordPlain && existing.passwordAscii) doc.passwordAscii = existing.passwordAscii;
        if (!passwordPlain && existing.password && !doc.password) {
            doc.password = String(existing.password);
        }
    }
    copyFhiExtrasToDoc(doc, existing);
    return doc;
}

function validateLoginIdLength(loginId) {
    const id = str(loginId);
    if (!id) return "아이디를 입력해 주세요.";
    if (id.length < 6 || id.length > 12) return "아이디는 6~12자리로 입력해 주세요.";
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return "아이디는 영문, 숫자, _(밑줄), -(하이픈)만 사용할 수 있습니다.";
    }
    return "";
}

function validatePasswordLength(password, requirePassword) {
    const pw = String(password || "");
    if (!pw) return requirePassword ? "비밀번호를 입력해 주세요." : "";
    if (pw.length < 8 || pw.length > 16) return "비밀번호는 8~16자리로 입력해 주세요.";
    return "";
}

function validateBuilt(built, requirePassword) {
    const idErr = validateLoginIdLength(built.loginId);
    if (idErr) return idErr;
    const pwErr = validatePasswordLength(built.passwordPlain, requirePassword);
    if (pwErr) return pwErr;
    if (!built.vn_company) return "업체이름을 입력해 주세요.";
    if (!built.vn_depts || !built.vn_depts.length) return "사업부문을 하나 이상 선택해 주세요.";
    if (!built.vn_grade) return "업체등급(Silver/Gold/Diamond)을 선택해 주세요.";
    if (built.vn_note && built.vn_note.length > MAX_VENDOR_NOTE_LEN) {
        return "회사 상황은 한글 기준 256자 이내로 입력해 주세요.";
    }
    return "";
}

const legacyVendorUnset = {
    companyName: "",
    ceo: "",
    ceoPhone: "",
    bizNo: "",
    manager: "",
    managerPhone: "",
    website: "",
    email: "",
    address: "",
    logo: "",
    note: "",
    password: "",
    passwordAscii: "",
    passwordHash: ""
};

function ensureVendorId(doc) {
    if (doc.id && str(doc.id)) return str(doc.id);
    if (doc._id) return "vn_" + String(doc._id);
    return "vn_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function vendorNeedsFieldMigration(doc) {
    if (!doc) return false;
    if (!doc.id) return true;
    if (!doc[F.company] && (doc.companyName || doc.vn_company)) return true;
    if (!doc[F.depts] || !doc[F.depts].length) {
        if (doc.vn_depts && doc.vn_depts.length) return true;
    }
    if (!vendorHasCanonicalLoginSchema(doc)) {
        const pw = getVendorStoredPassword(doc);
        const hasHash = !!(doc.passwordHash && String(doc.passwordHash).length);
        if (pw || hasHash) return true;
    }
    return false;
}

async function migrateVendorsCollection(db) {
    const col = db.collection("vendors");
    const docs = await col.find({}).toArray();
    let n = 0;
    let skipped = 0;
    let idFixed = 0;
    for (const doc of docs) {
        const id = ensureVendorId(doc);
        if (!doc.id) idFixed++;
        const pw = getVendorStoredPassword(doc);
        const hasHash = !!(doc.passwordHash && String(doc.passwordHash).length);
        if (!pw && hasHash) {
            if (!doc.id) {
                await col.updateOne({ _id: doc._id }, { $set: { id: id } });
                idFixed++;
            }
            skipped++;
            continue;
        }
        if (!pw && doc.loginId) {
            console.warn("[vendors] missing login password:", id, doc.loginId);
        }
        if (!vendorNeedsFieldMigration(doc)) {
            skipped++;
            continue;
        }
        const splitZip = str(doc[F.zip] || doc.vn_zip);
        const splitAddr = str(doc[F.addr] || doc.vn_addr);
        const splitDetail = str(doc[F.addrDetail] || doc.vn_addr_detail);
        const legacyAddr = str(doc.address);
        const migBody = {
            vn_company: doc[F.company] || doc.companyName,
            vn_depts: doc[F.depts] || doc.vn_depts,
            vn_ceo: doc[F.ceo] || doc.ceo,
            vn_ceo_tel: doc[F.ceoTel] || doc.ceoPhone,
            vn_grade: doc[F.grade] || "1",
            vn_room_count: doc[F.roomCount] || doc.vn_room_count || "",
            vn_web: doc[F.web] || doc.website,
            vn_email: doc[F.email] || doc.email,
            vn_phone: doc[F.phone] || doc.phone,
            vn_mgr_name: doc[F.mgrName] || doc.manager,
            vn_mgr_tel: doc[F.mgrTel] || doc.managerPhone,
            vn_mgr_email: doc[F.mgrEmail] || doc.mgrEmail,
            vn_logo: doc[F.logo] || doc.logo,
            vn_note: doc[F.note] || doc.note,
            password: pw
        };
        if (splitZip) migBody.vn_zip = splitZip;
        if (splitAddr) migBody.vn_addr = splitAddr;
        else if (!splitZip && legacyAddr) migBody.vn_addr = legacyAddr;
        if (splitDetail) migBody.vn_addr_detail = splitDetail;
        const built = buildFromBody(migBody, doc, doc.loginId || "", pw);
        if (!doc.id) {
            await col.updateOne({ _id: doc._id }, { $set: { id: id } });
        }
        const next = toDbDoc(id, built, doc);
        await col.replaceOne({ id: id }, next, { upsert: true });
        n++;
    }

    const legacy = await col.updateMany(
        {
            $or: [
                { [F.registeredBy]: { $exists: false } },
                { [F.registeredBy]: "" },
                { [F.registeredBy]: null }
            ]
        },
        {
            $set: {
                [F.registeredBy]: "legacy",
                [F.registeredByName]: "기존(담당 미지정)"
            }
        }
    );
    const report = {
        collection: "vendors",
        processed: n,
        skipped: skipped,
        idFixed: idFixed,
        legacyRegisteredBy: legacy.modifiedCount || 0
    };
    if (n) console.log("[vendors] migrated:", report);
    return report;
}

module.exports = {
    F,
    FHI_EXTRA_KEYS,
    copyFhiExtrasToDoc,
    fromLegacyDoc,
    toPublic,
    buildFromBody,
    finalizeVendorBuilt,
    toDbDoc,
    validateBuilt,
    validateLoginIdLength,
    validatePasswordLength,
    parseDeptsList,
    VALID_DEPT_IDS,
    PARTNER_DEPT_IDS,
    filterPartnerDepts,
    validatePartnerDeptsForRegister,
    migrateVendorsCollection,
    getCompanyName,
    parseGrade,
    parseRoomCount,
    gradeDisplayLabel,
    VENDOR_GRADE_MAX,
    legacyVendorUnset
};
