const { F, buildFromBody, parseGrade } = require("./vendorFields");

const MAX_IMPORT_ROWS = 500;

/** 엑셀 1행 헤더 → 필드 키 (공백·대소문자 무시) */
const HEADER_ALIASES = [
    { field: "vn_company", keys: ["업체명", "업체이름", "업체명칭", "상호", "회사명", "company", "vn_company", "companyname"] },
    { field: "vn_ceo", keys: ["대표자", "대표자명", "대표", "ceo", "vn_ceo", "대표자이름"] },
    { field: "vn_ceo_tel", keys: ["대표자연락처", "대표연락처", "대표자전화", "대표자휴대폰", "대표전화", "ceotel", "vn_ceo_tel", "ceo_phone", "대표자연락"] },
    { field: "vn_web", keys: ["홈페이지", "웹사이트", "website", "web", "vn_web", "url", "홈페이지주소"] },
    { field: "vn_email", keys: ["이메일", "회사이메일", "email", "vn_email", "메일", "e-mail"] },
    { field: "vn_phone", keys: ["회사전화", "전화", "전화번호", "phone", "vn_phone", "회사전화번호", "대표전화"] },
    { field: "vn_addr", keys: ["회사주소", "주소", "address", "addr", "vn_addr", "소재지"] },
    { field: "vn_mgr_name", keys: ["담당자", "담당자명", "담당자이름", "manager", "vn_mgr_name", "mgr_name"] },
    { field: "vn_mgr_tel", keys: ["담당자연락처", "담당자전화", "담당자휴대폰", "managerphone", "vn_mgr_tel", "mgr_tel", "담당자연락"] },
    { field: "vn_mgr_email", keys: ["담당자이메일", "담당자메일", "mgr_email", "vn_mgr_email", "manageremail"] },
    { field: "vn_note", keys: ["회사상황", "비고", "메모", "note", "vn_note", "설명", "특이사항"] },
    { field: "vn_grade", keys: ["업체등급", "등급", "grade", "vn_grade"] },
    { field: "vn_depts", keys: ["사업부문", "부문", "depts", "vn_depts"] }
];

function normalizeHeaderLabel(h) {
    return String(h || "")
        .trim()
        .replace(/\s+/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9가-힣_]/g, "");
}

function matchHeaderToField(label) {
    const norm = normalizeHeaderLabel(label);
    if (!norm) return "";
    for (let i = 0; i < HEADER_ALIASES.length; i++) {
        const entry = HEADER_ALIASES[i];
        for (let j = 0; j < entry.keys.length; j++) {
            const keyNorm = normalizeHeaderLabel(entry.keys[j]);
            if (norm === keyNorm || norm.indexOf(keyNorm) >= 0 || keyNorm.indexOf(norm) >= 0) {
                return entry.field;
            }
        }
    }
    return "";
}

function mapHeaders(headerRow) {
    const map = {};
    (headerRow || []).forEach(function (cell, idx) {
        const field = matchHeaderToField(cell);
        if (field) map[idx] = field;
    });
    return map;
}

function cellStr(v) {
    if (v == null) return "";
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return String(v).trim();
}

function parseDeptsCell(raw) {
    const s = cellStr(raw);
    if (!s) return [];
    return s
        .split(/[,，、/|]/)
        .map(function (p) {
            return p.trim();
        })
        .filter(Boolean);
}

/** 헤더·데이터 행(배열의 배열) → API rows */
function rowsFromSheetMatrix(matrix) {
    if (!matrix || !matrix.length) return { rows: [], error: "시트에 데이터가 없습니다." };
    const headerRow = matrix[0] || [];
    const colMap = mapHeaders(headerRow);
    const hasCompany = Object.keys(colMap).some(function (idx) {
        return colMap[idx] === "vn_company";
    });
    if (!hasCompany) {
        return {
            rows: [],
            error:
                "「업체명」 또는 「업체이름」 열을 찾을 수 없습니다. 첫 줄에 헤더를 넣어 주세요."
        };
    }

    const rows = [];
    for (let r = 1; r < matrix.length; r++) {
        const line = matrix[r];
        if (!line || !line.length) continue;
        const obj = { vn_record_type: "new" };
        let any = false;
        Object.keys(colMap).forEach(function (idx) {
            const field = colMap[idx];
            const val = line[Number(idx)];
            if (field === "vn_depts") {
                obj.vn_depts = parseDeptsCell(val);
            } else {
                const s = cellStr(val);
                if (s) {
                    obj[field] = s;
                    any = true;
                }
            }
        });
        if (any && obj.vn_company) rows.push(obj);
    }
    if (!rows.length) {
        return { rows: [], error: "저장할 업체 행이 없습니다. 업체명이 비어 있지 않은지 확인해 주세요." };
    }
    if (rows.length > MAX_IMPORT_ROWS) {
        return {
            rows: [],
            error: "한 번에 최대 " + MAX_IMPORT_ROWS + "건까지 불러올 수 있습니다."
        };
    }
    return { rows: rows, error: "" };
}

function validateImportRow(row, rowIndex) {
    const built = buildFromBody(Object.assign({ vn_record_type: "new" }, row), null, "", "");
    if (!built.vn_company) {
        return { ok: false, error: (rowIndex || 0) + "행: 업체명이 없습니다." };
    }
    if (!built.vn_grade) built.vn_grade = "1";
    if (!built.vn_depts) built.vn_depts = [];
    return { ok: true, built: built };
}

function toImportDbDoc(id, built, registration) {
    const now = Date.now();
    const doc = {
        id,
        [F.company]: built.vn_company,
        [F.depts]: built.vn_depts || [],
        [F.ceo]: built.vn_ceo || "",
        [F.ceoTel]: built.vn_ceo_tel || "",
        [F.grade]: parseGrade(built.vn_grade) || "1",
        [F.web]: built.vn_web || "",
        [F.email]: built.vn_email || "",
        [F.phone]: built.vn_phone || "",
        [F.addr]: built.vn_addr || "",
        [F.mgrName]: built.vn_mgr_name || "",
        [F.mgrTel]: built.vn_mgr_tel || "",
        [F.mgrEmail]: built.vn_mgr_email || "",
        [F.logo]: "",
        [F.note]: built.vn_note || "",
        [F.recordType]: "new",
        createdAt: now,
        updatedAt: now
    };
    if (registration) {
        doc[F.registeredBy] = registration.registeredBy || "";
        doc[F.registeredByName] = registration.registeredByName || "";
        doc[F.registeredAt] = registration.registeredAt || now;
    }
    return doc;
}

module.exports = {
    MAX_IMPORT_ROWS,
    HEADER_ALIASES,
    mapHeaders,
    rowsFromSheetMatrix,
    validateImportRow,
    toImportDbDoc,
    normalizeHeaderLabel,
    matchHeaderToField
};
