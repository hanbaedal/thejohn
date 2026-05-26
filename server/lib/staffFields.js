const { buildLoginFields, getStoredPassword } = require("./loginAccount");

/** staff 컬렉션 — vendors와 같은 개념의 로그인·업체 정보 */
const F = {
    company: "st_company",
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
 * 기본 관리자 계정 — 서버 기동 시 MongoDB staff 컬렉션에만 기록(upsert).
 * 로그인 검증은 소스가 아니라 DB staff·vendors 조회(loginResolve.js)만 사용합니다.
 */
const DEFAULT_STAFF_ACCOUNTS = [
    {
        id: "st_admin_thejohn",
        loginId: "thejohn",
        password: "leesb0129!",
        st_company: "(주) 더존",
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
    if (!d[F.company]) {
        if (doc.st_company) d[F.company] = str(doc.st_company);
        else if (doc.companyName) d[F.company] = str(doc.companyName);
        else if (doc.role === "supervisor") d[F.company] = "(주)더존";
    }
    if (!d[F.ceo]) {
        if (doc.st_ceo) d[F.ceo] = str(doc.st_ceo);
        else if (doc.name) d[F.ceo] = str(doc.name);
        else if (doc.role === "supervisor") d[F.ceo] = "슈퍼바이저";
    }
    if (!d[F.ceoTel] && doc.st_ceo_tel) d[F.ceoTel] = str(doc.st_ceo_tel);
    if (!d[F.email] && doc.st_email) d[F.email] = str(doc.st_email);
    if (!d[F.web] && doc.st_web) d[F.web] = str(doc.st_web);
    if (!d[F.bizNo] && doc.st_biz_no) d[F.bizNo] = str(doc.st_biz_no);
    if (!d[F.bizType] && doc.st_biz_type) d[F.bizType] = str(doc.st_biz_type);
    if (!d[F.bizItem] && doc.st_biz_item) d[F.bizItem] = str(doc.st_biz_item);
    if (!d[F.address] && doc.st_address) d[F.address] = str(doc.st_address);
    return d;
}

function toPublic(doc) {
    const d = fromLegacyDoc(doc);
    if (!d) return null;
    return {
        id: d.id,
        loginId: d.loginId || "",
        st_company: str(d[F.company]),
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

async function ensureDefaultStaffSeeds(db) {
    const col = db.collection("staff");
    const pwFromEnv = String(process.env.THEJHON_SEED_SUPERVISOR_PASSWORD || "").trim();

    await col.deleteOne({ id: "st_supervisor_thejohn" });
    await col.deleteOne({ id: "st_supervisor_thejhon" });

    for (const seed of DEFAULT_STAFF_ACCOUNTS) {
        await removeStaffLoginIdConflicts(col, seed);

        const password =
            seed.loginId === "thejohn" && pwFromEnv ? pwFromEnv : seed.password;
        const built = buildFromBody(
            {
                st_company: seed.st_company,
                st_ceo: seed.st_ceo,
                st_ceo_tel: seed.st_ceo_tel,
                role: seed.role
            },
            null,
            seed.loginId,
            password
        );
        const existing = await col.findOne({ id: seed.id });
        const doc = toDbDoc(seed.id, built, existing);

        await col.replaceOne({ id: seed.id }, doc, { upsert: true });
        console.log("[staff] synced:", doc.loginId, doc.role, doc.id);
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
