/**
 * 엑셀 열 이름 → vendor_prospects 필드 (브라우저·서버 로직 동기화용)
 */
(function (global) {
    var HEADER_ALIASES = [
        { field: "vn_company", keys: ["업체명", "업체이름", "업체명칭", "상호", "회사명", "company", "vn_company"] },
        { field: "vn_ceo_tel", keys: ["대표자연락처", "대표연락처", "대표자전화", "대표자휴대폰", "대표전화", "ceotel", "vn_ceo_tel", "ceo_phone"] },
        { field: "vn_ceo", keys: ["대표자", "대표자명", "대표", "ceo", "vn_ceo", "대표자이름"] },
        { field: "vn_web", keys: ["홈페이지", "웹사이트", "website", "web", "vn_web", "url"] },
        { field: "vn_email", keys: ["이메일", "회사이메일", "email", "vn_email", "메일", "e-mail"] },
        { field: "vn_phone", keys: ["회사전화", "전화번호", "phone", "vn_phone", "회사전화번호"] },
        { field: "vn_addr", keys: ["회사주소", "주소", "address", "addr", "vn_addr", "소재지"] },
        { field: "vn_mgr_tel", keys: ["담당자연락처", "담당자전화", "담당자휴대폰", "managerphone", "vn_mgr_tel", "mgr_tel"] },
        { field: "vn_mgr_name", keys: ["담당자", "담당자명", "담당자이름", "manager", "vn_mgr_name", "mgr_name"] },
        { field: "vn_mgr_email", keys: ["담당자이메일", "담당자메일", "mgr_email", "vn_mgr_email", "manageremail"] },
        { field: "vn_note", keys: ["회사상황", "비고", "메모", "note", "vn_note"] },
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

    /** 긴 열 이름 우선(대표자연락처 ≠ 대표자) */
    function matchHeaderToField(label) {
        var norm = normalizeHeaderLabel(label);
        if (!norm) return "";
        var bestField = "";
        var bestLen = 0;
        for (var i = 0; i < HEADER_ALIASES.length; i++) {
            var entry = HEADER_ALIASES[i];
            for (var j = 0; j < entry.keys.length; j++) {
                var keyNorm = normalizeHeaderLabel(entry.keys[j]);
                if (!keyNorm) continue;
                var matched = false;
                if (norm === keyNorm) matched = true;
                else if (keyNorm.length >= 2 && norm.indexOf(keyNorm) >= 0) matched = true;
                else if (norm.length >= 2 && keyNorm.indexOf(norm) >= 0) matched = true;
                if (matched && keyNorm.length > bestLen) {
                    bestLen = keyNorm.length;
                    bestField = entry.field;
                }
            }
        }
        return bestField;
    }

    function looksLikePhone(s) {
        var t = String(s || "").replace(/\s/g, "");
        if (!t) return false;
        if (/@/.test(t)) return false;
        var digits = t.replace(/\D/g, "");
        if (digits.length < 8) return false;
        return /^[\d\-().+]+$/.test(t);
    }

    function looksLikeEmail(s) {
        return /@/.test(String(s || ""));
    }

    /** 대표자/담당자 칸에 전화번호가 들어온 경우 보정 */
    function normalizeImportRow(obj) {
        if (!obj) return obj;
        if (obj.vn_ceo && looksLikePhone(obj.vn_ceo) && !obj.vn_ceo_tel) {
            obj.vn_ceo_tel = obj.vn_ceo;
            obj.vn_ceo = "";
        }
        if (obj.vn_ceo && looksLikeEmail(obj.vn_ceo) && !obj.vn_email) {
            obj.vn_email = obj.vn_ceo;
            obj.vn_ceo = "";
        }
        if (obj.vn_mgr_name && looksLikePhone(obj.vn_mgr_name) && !obj.vn_mgr_tel) {
            obj.vn_mgr_tel = obj.vn_mgr_name;
            obj.vn_mgr_name = "";
        }
        if (obj.vn_mgr_name && looksLikeEmail(obj.vn_mgr_name) && !obj.vn_mgr_email) {
            obj.vn_mgr_email = obj.vn_mgr_name;
            obj.vn_mgr_name = "";
        }
        return obj;
    }

    global.THEJHON_EXCEL_IMPORT_MAP = {
        HEADER_ALIASES: HEADER_ALIASES,
        normalizeHeaderLabel: normalizeHeaderLabel,
        matchHeaderToField: matchHeaderToField,
        normalizeImportRow: normalizeImportRow,
        looksLikePhone: looksLikePhone
    };
})(typeof window !== "undefined" ? window : global);
