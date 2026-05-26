const { buildLoginFields, getStoredPassword } = require("./loginAccount");

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
    address: "st_address"
};

/**
 * 기본 staff 시드 — 서버 기동 시 MongoDB에만 반영·비어 있는 필드만 보강합니다.
 * 로그인은 항상 DB 조회(loginResolve.js). 슈퍼바이저는 hanbaedal 하나,
 * 관리자(admin)는 staff 컬렉션의 모든 해당 행이며 시드 외 추가는 POST /api/staff(슈퍼바이저) 등으로 확장합니다.
 */
const DEFAULT_STAFF_ACCOUNTS = [
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
        id: "st_admin_aksangsa",
        loginId: "aksangsa",
        password: "kimjc2333!",
        st_company: "(주)에이케이상사",
        st_ceo: "김종철",
        st_ceo_tel: "01047212333",
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

const DEFAULT_STAFF_IDS = DEFAULT_STAFF_ACCOUNTS.map(function (s) {
    return s.id;
});

const EXPECTED_STAFF_LOGIN_IDS = DEFAULT_STAFF_ACCOUNTS.map(function (s) {
    return s.loginId;
});

function str(v) {
    return String(v ?? "").trim();
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
    if (doc.st_address != null) d[F.address] = str(doc.st_address);
    else if (!d[F.address] && doc.address) d[F.address] = str(doc.address);
    return d;
}

function toPublic(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    return {
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
        st_address: str(d[F.address]),
        role: d.role || "admin",
        active: d.active !== false,
        updatedAt: d.updatedAt || 0
    };
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
        st_address: str(body.st_address != null ? body.st_address : prev[F.address]),
        role: body.role || prev.role || "admin"
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
        [F.address]: built.st_address,
        role: built.role,
        active: true,
        updatedAt: Date.now()
    };
    if (existing?.createdAt) doc.createdAt = existing.createdAt;
    else doc.createdAt = Date.now();
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

/** 같은 loginId를 쓰는 옛 문서 제거 (고유 인덱스 충돌 방지) */
async function removeStaffLoginIdConflicts(col, seed) {
    const loginIds = [seed.loginId];
    if (seed.loginId === "thejohn") loginIds.push("thejhon");

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

    for (const seed of DEFAULT_STAFF_ACCOUNTS) {
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

    await col.deleteMany({
        loginId: { $in: ["thejohn", "thejhon", "aksangsa", "hanbaedal"] },
        id: { $nin: DEFAULT_STAFF_IDS }
    });
}

async function migrateStaffCollection(db) {
    const col = db.collection("staff");
    const docs = await col.find({}).toArray();
    let n = 0;
    for (const doc of docs) {
        if (!doc.id) continue;
        if (DEFAULT_STAFF_IDS.includes(doc.id)) continue;

        const pw = getStoredPassword(doc);
        const built = buildFromBody(
            {
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
                st_address: doc[F.address] || doc.st_address,
                role: doc.role
            },
            doc,
            doc.loginId || "",
            pw
        );
        await col.replaceOne({ id: doc.id }, toDbDoc(doc.id, built, doc));
        n++;
    }
    if (n) console.log("[staff] migrated field names:", n);
}

async function findExpectedStaffInDb(db) {
    const col = db.collection("staff");
    return col
        .find({
            $or: [{ id: { $in: DEFAULT_STAFF_IDS } }, { loginId: { $in: EXPECTED_STAFF_LOGIN_IDS } }],
            active: { $ne: false }
        })
        .project({ id: 1, loginId: 1, role: 1, st_company: 1, _id: 0 })
        .toArray();
}

module.exports = {
    F,
    fromLegacyDoc,
    DEFAULT_STAFF_ACCOUNTS,
    DEFAULT_STAFF_IDS,
    EXPECTED_STAFF_LOGIN_IDS,
    toPublic,
    buildFromBody,
    toDbDoc,
    getCompanyName,
    getCeoName,
    ensureDefaultStaffSeeds,
    migrateStaffCollection,
    findExpectedStaffInDb,
    legacyStaffUnset
};
