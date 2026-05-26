/**
 * 푸터 기업 정보 — MongoDB staff
 * 미로그인: DEFAULT_FOOTER_STAFF_ID(기본 thejohn)
 * 로그인: GET /api/auth/staff-profile (관리자=본인, 업체=vn_registered_by 담당 관리자)
 */
(function (global) {
    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function digitsOnly(tel) {
        return String(tel || "").replace(/\D/g, "");
    }

    function telHref(tel) {
        var d = digitsOnly(tel);
        if (!d) return "";
        if (d.indexOf("82") === 0) return "tel:+" + d;
        if (d.charAt(0) === "0") return "tel:+82" + d.slice(1);
        return "tel:+" + d;
    }

    /** 전화 표시용: 대표번호 우선, 없으면 대표 휴대폰 */
    function pickFooterPhone(st) {
        if (!st) return "";
        var a = String(st.st_phone || "").trim();
        if (a) return a;
        var b = String(st.st_ceo_tel || "").trim();
        return b || "";
    }

    /** 전화번호 하이픈(010 등) 간단 표시 */
    function formatPhoneDisplay(raw) {
        var d = digitsOnly(raw);
        if (d.length === 11 && d.indexOf("010") === 0) {
            return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
        }
        if (d.length === 10 && d.indexOf("02") === 0) {
            return d.slice(0, 2) + "-" + d.slice(2, 6) + "-" + d.slice(6);
        }
        if (d.length === 11 && d.indexOf("0") === 0) {
            return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
        }
        return String(raw || "").trim();
    }

    function row(label, ddHtml) {
        return (
            '<div class="site-footer-item">' +
            "<dt>" +
            escapeHtml(label) +
            "</dt><dd>" +
            ddHtml +
            "</dd></div>"
        );
    }

    function rowFull(label, ddHtml) {
        return (
            '<div class="site-footer-item site-footer-item--full">' +
            "<dt>" +
            escapeHtml(label) +
            "</dt><dd>" +
            ddHtml +
            "</dd></div>"
        );
    }

    function renderStaffGrid(staff) {
        var s = staff || {};
        var company = escapeHtml(String(s.st_company || "").trim() || "—");
        var ceo = escapeHtml(String(s.st_ceo || "").trim() || "—");
        var addr = escapeHtml(String(s.st_address || "").trim() || "—");

        var emailRaw = String(s.st_email || "").trim();
        var emailDd = emailRaw
            ? '<a href="mailto:' + escapeHtml(emailRaw) + '">' + escapeHtml(emailRaw) + "</a>"
            : "—";

        var phoneRaw = pickFooterPhone(s);
        var phoneDisp = formatPhoneDisplay(phoneRaw) || phoneRaw || "—";
        var phoneDd;
        var href = telHref(phoneRaw);
        if (href && phoneRaw) {
            phoneDd =
                '<a class="footer-tel" href="' +
                escapeHtml(href) +
                '">' +
                escapeHtml(phoneDisp) +
                "</a>";
        } else {
            phoneDd = escapeHtml(phoneDisp === "—" ? "—" : phoneDisp);
        }

        var fax = escapeHtml(String(s.st_fax || "").trim() || "—");
        var biz = escapeHtml(String(s.st_biz_no || "").trim() || "—");

        var parts = [];
        parts.push(row("상호", company));
        parts.push(row("대표", ceo));
        parts.push(rowFull("주소", addr));
        parts.push(row("이메일", emailDd));
        parts.push(row("전화", phoneDd));
        parts.push(row("팩스", fax));
        parts.push(row("사업자등록번호", biz));
        return parts.join("");
    }

    function setMsg(el, text, visible) {
        if (!el) return;
        if (visible && text) {
            el.hidden = false;
            el.textContent = text;
        } else {
            el.hidden = true;
            el.textContent = "";
        }
    }

    function loadStaffItem() {
        var Api = global.THEJHON_API;
        if (!Api || !Api.getPublicFooterStaff) {
            return Promise.reject(new Error("API 없음"));
        }
        var token =
            Api.getToken && Api.getToken()
                ? Api.getToken()
                : "";
        if (token && Api.getStaffProfile) {
            return Api.getStaffProfile().catch(function () {
                return Api.getPublicFooterStaff();
            });
        }
        return Api.getPublicFooterStaff();
    }

    function mount() {
        var grid = document.getElementById("siteFooterCompanyGrid");
        if (!grid) return;

        var msgEl = document.getElementById("siteFooterCompanyMsg");

        grid.innerHTML = '<div class="site-footer-item site-footer-item--full"><dt></dt><dd class="site-footer-loading">기업 정보를 불러오는 중…</dd></div>';

        loadStaffItem()
            .then(function (item) {
                grid.innerHTML = renderStaffGrid(item);
                setMsg(msgEl, "", false);
            })
            .catch(function () {
                grid.innerHTML = "";
                setMsg(msgEl, "기업 정보를 불러오지 못했습니다.", true);
            });
    }

    global.THEJHON_FOOTER_COMPANY = { mount: mount, renderStaffGrid: renderStaffGrid };
})(typeof window !== "undefined" ? window : this);
