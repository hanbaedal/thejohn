const {
    buildLoginFields,
    getStoredPassword,
    normalizeLoginId,
    normalizePasswordInput
} = require("./loginAccount");

/** vendors 컬렉션 필드 */
const VALID_DEPT_IDS = ["livestock", "seafood", "meals", "banchan", "drink"];

const F = {
    company: "vn_company",
    depts: "vn_depts",
    ceo: "vn_ceo",
    ceoTel: "vn_ceo_tel",
    grade: "vn_grade",
    web: "vn_web",
    email: "vn_email",
    phone: "vn_phone",
    addr: "vn_addr",
    mgrName: "vn_mgr_name",
    mgrTel: "vn_mgr_tel",
    mgrEmail: "vn_mgr_email",
    logo: "vn_logo",
    note: "vn_note"
};

function str(v) {
    return String(v ?? "").trim();
}

function parseGrade(v) {
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 3) return String(n);
    return "";
}

function normalizeDeptId(v) {
    return String(v || "")
        .trim()
        .toLowerCase();
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
    if (!d[F.web] && doc.website) d[F.web] = String(doc.website).trim();
    if (!d[F.email] && doc.email) d[F.email] = String(doc.email).trim();
    if (!d[F.phone] && doc.phone) d[F.phone] = String(doc.phone).trim();
    if (!d[F.addr] && doc.address) d[F.addr] = String(doc.address).trim();
    if (!d[F.mgrName] && doc.manager) d[F.mgrName] = String(doc.manager).trim();
    if (!d[F.mgrTel] && doc.managerPhone) d[F.mgrTel] = String(doc.managerPhone).trim();
    if (!d[F.mgrEmail] && doc.mgrEmail) d[F.mgrEmail] = String(doc.mgrEmail).trim();
    if (!d[F.logo] && doc.logo) d[F.logo] = String(doc.logo);
    if (!d[F.note] && doc.note) d[F.note] = String(doc.note).trim();
    if (!d[F.grade]) d[F.grade] = parseGrade(d[F.grade]) || "1";
    if (!d[F.depts] && Array.isArray(doc.vn_depts)) d[F.depts] = doc.vn_depts;
    else if (!d[F.depts] && typeof doc.vn_depts === "string") {
        d[F.depts] = parseDeptsList({ vn_depts: doc.vn_depts }, null);
    } else if (!d[F.depts]) d[F.depts] = [];
    return d;
}

function getCompanyName(doc) {
    const d = fromLegacyDoc(doc);
    return d ? str(d[F.company]) : "";
}

function toPublic(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    return {
        id: d.id,
        loginId: d.loginId || "",
        vn_company: str(d[F.company]),
        vn_depts: Array.isArray(d[F.depts]) ? d[F.depts] : [],
        vn_ceo: str(d[F.ceo]),
        vn_ceo_tel: str(d[F.ceoTel]),
        vn_grade: parseGrade(d[F.grade]) || "1",
        vn_web: str(d[F.web]),
        vn_email: str(d[F.email]),
        vn_phone: str(d[F.phone]),
        vn_addr: str(d[F.addr]),
        vn_mgr_name: str(d[F.mgrName]),
        vn_mgr_tel: str(d[F.mgrTel]),
        vn_mgr_email: str(d[F.mgrEmail]),
        vn_logo: String(d[F.logo] || ""),
        vn_note: str(d[F.note]),
        updatedAt: d.updatedAt || 0
    };
}

function resolvePasswordPlain(existing, loginId, password) {
    const incoming = normalizePasswordInput(password);
    if (incoming) return incoming;
    if (existing) return getStoredPassword(existing);
    return "";
}

function buildFromBody(body, existing, loginId, password) {
    const prev = fromLegacyDoc(existing) || {};
    const loginFields = buildLoginFields(loginId, "");
    const passwordPlain = resolvePasswordPlain(existing, loginId, password);

    const built = {
        loginId: loginFields.loginId,
        loginIdNorm: normalizeLoginId(loginFields.loginId),
        passwordPlain: passwordPlain,
        vn_company: str(body.vn_company != null ? body.vn_company : body.companyName),
        vn_depts: parseDeptsList(body, prev),
        vn_ceo: str(body.vn_ceo != null ? body.vn_ceo : body.ceo),
        vn_ceo_tel: str(body.vn_ceo_tel != null ? body.vn_ceo_tel : body.ceoPhone),
        vn_grade: parseGrade(body.vn_grade != null ? body.vn_grade : prev[F.grade]) || "1",
        vn_web: str(body.vn_web != null ? body.vn_web : body.website),
        vn_email: str(body.vn_email != null ? body.vn_email : body.email),
        vn_phone: str(body.vn_phone != null ? body.vn_phone : body.phone),
        vn_addr: str(body.vn_addr != null ? body.vn_addr : body.address),
        vn_mgr_name: str(body.vn_mgr_name != null ? body.vn_mgr_name : body.manager),
        vn_mgr_tel: str(body.vn_mgr_tel != null ? body.vn_mgr_tel : body.managerPhone),
        vn_mgr_email: str(body.vn_mgr_email != null ? body.vn_mgr_email : body.mgrEmail),
        vn_logo:
            body.vn_logo !== undefined && body.vn_logo !== null
                ? String(body.vn_logo)
                : body.logo !== undefined && body.logo !== null
                  ? String(body.logo)
                  : String(prev[F.logo] || ""),
        vn_note: str(body.vn_note != null ? body.vn_note : body.note)
    };

    return built;
}

function toDbDoc(id, built, existing) {
    const doc = {
        id,
        loginId: built.loginId,
        loginIdNorm: built.loginIdNorm,
        password: built.passwordPlain || "",
        [F.company]: built.vn_company,
        [F.depts]: built.vn_depts,
        [F.ceo]: built.vn_ceo,
        [F.ceoTel]: built.vn_ceo_tel,
        [F.grade]: built.vn_grade,
        [F.web]: built.vn_web,
        [F.email]: built.vn_email,
        [F.phone]: built.vn_phone,
        [F.addr]: built.vn_addr,
        [F.mgrName]: built.vn_mgr_name,
        [F.mgrTel]: built.vn_mgr_tel,
        [F.mgrEmail]: built.vn_mgr_email,
        [F.logo]: built.vn_logo,
        [F.note]: built.vn_note,
        updatedAt: Date.now()
    };
    if (existing?.createdAt) doc.createdAt = existing.createdAt;
    else doc.createdAt = Date.now();
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
    if (!built.vn_grade) return "업체등급(1~3)을 선택해 주세요.";
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

async function migrateVendorsCollection(db) {
    const col = db.collection("vendors");
    const docs = await col.find({}).toArray();
    let n = 0;
    for (const doc of docs) {
        if (!doc.id) continue;
        const pw = getStoredPassword(doc);
        const built = buildFromBody(
            {
                vn_company: doc[F.company] || doc.companyName,
                vn_depts: doc[F.depts] || doc.vn_depts,
                vn_ceo: doc[F.ceo] || doc.ceo,
                vn_ceo_tel: doc[F.ceoTel] || doc.ceoPhone,
                vn_grade: doc[F.grade] || "1",
                vn_web: doc[F.web] || doc.website,
                vn_email: doc[F.email] || doc.email,
                vn_phone: doc[F.phone] || doc.phone,
                vn_addr: doc[F.addr] || doc.address,
                vn_mgr_name: doc[F.mgrName] || doc.manager,
                vn_mgr_tel: doc[F.mgrTel] || doc.managerPhone,
                vn_mgr_email: doc[F.mgrEmail] || doc.mgrEmail,
                vn_logo: doc[F.logo] || doc.logo,
                vn_note: doc[F.note] || doc.note,
                password: pw
            },
            doc,
            doc.loginId || "",
            pw
        );
        const next = toDbDoc(doc.id, built, doc);
        await col.replaceOne({ id: doc.id }, next);
        n++;
    }
    if (n) console.log("[vendors] migrated field names:", n);
}

module.exports = {
    F,
    toPublic,
    buildFromBody,
    toDbDoc,
    validateBuilt,
    validateLoginIdLength,
    validatePasswordLength,
    parseDeptsList,
    VALID_DEPT_IDS,
    migrateVendorsCollection,
    getCompanyName,
    parseGrade,
    legacyVendorUnset
};
