(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("vd-root");

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function escapeMultiline(s) {
        return String(s)
            .split("\n")
            .map(function (line) {
                return escapeHtml(line);
            })
            .join("<br>");
    }

    function safeWebHref(s) {
        var t = String(s || "").trim();
        if (!t) return "";
        if (/^https?:\/\//i.test(t)) return t;
        return "https://" + t;
    }

    function deptLabels(it) {
        var raw = it.vn_depts;
        if (!Array.isArray(raw) || !raw.length) return "미지정";
        var labels = [];
        for (var i = 0; i < raw.length; i++) {
            var id = catalog ? catalog.normalizeDept(raw[i]) : String(raw[i] || "").trim().toLowerCase();
            var lbl = PF.deptLabel(catalog, id);
            if (lbl && labels.indexOf(lbl) < 0) labels.push(lbl);
        }
        return labels.length ? labels.join(", ") : "미지정";
    }

    function contactRow(label, html) {
        if (!html) return "";
        return "<dt>" + escapeHtml(label) + "</dt><dd>" + html + "</dd>";
    }

    function telLink(v) {
        var t = String(v || "").trim();
        if (!t) return "";
        return (
            '<a class="footer-tel" href="tel:' +
            escapeHtml(t.replace(/\s/g, "")) +
            '">' +
            escapeHtml(t) +
            "</a>"
        );
    }

    function mailLink(v) {
        var t = String(v || "").trim();
        if (!t) return "";
        return '<a href="mailto:' + escapeHtml(t) + '">' + escapeHtml(t) + "</a>";
    }

    function webLink(v) {
        var t = String(v || "").trim();
        if (!t) return "";
        var href = safeWebHref(t);
        return (
            '<a href="' +
            escapeHtml(href) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(t) +
            "</a>"
        );
    }

    function getIdFromQuery() {
        try {
            var params = new URLSearchParams(window.location.search);
            return params.get("id") || "";
        } catch (e) {
            return "";
        }
    }

    function showMissing(msg, backHref) {
        document.title = "업체 상세 — 더존";
        root.innerHTML =
            '<p class="vd-missing">' +
            escapeHtml(msg || "업체를 찾을 수 없습니다.") +
            ' <a href="' +
            escapeHtml(backHref || "vendor-list-admin.html") +
            '">업체 리스트</a>로 돌아가 주세요.</p>';
    }

    function renderItem(it) {
        var titlePlain = String(it.vn_company || "업체");
        document.title =
            titlePlain.length > 60 ? titlePlain.slice(0, 57) + "… — 더존" : titlePlain + " — 더존";

        var logo = it.vn_logo && String(it.vn_logo).trim();
        var imgBlock = logo
            ? "<img class=\"vd-hero-img\" src=" + JSON.stringify(logo) + ' alt="">'
            : '<div class="vd-hero-img vd-hero-img--empty" role="img" aria-label="로고 없음">로고 없음</div>';

        var rows = [];
        rows.push(contactRow("로그인 아이디", escapeHtml(it.loginId || "—")));
        rows.push(contactRow("사업부문", escapeHtml(deptLabels(it))));
        var gradeLbl =
            window.THEJHON_AUTH && THEJHON_AUTH.vendorGradeLabel
                ? THEJHON_AUTH.vendorGradeLabel(it.vn_grade)
                : String(it.vn_grade || "1") + "등급";
        rows.push(contactRow("업체등급", escapeHtml(gradeLbl)));
        rows.push(contactRow("대표자", escapeHtml(it.vn_ceo || "—")));
        rows.push(contactRow("대표 연락처", telLink(it.vn_ceo_tel) || "—"));
        rows.push(contactRow("회사 전화", telLink(it.vn_phone) || "—"));
        rows.push(contactRow("회사 이메일", mailLink(it.vn_email) || "—"));
        rows.push(contactRow("홈페이지", webLink(it.vn_web) || "—"));
        if (it.vn_addr && String(it.vn_addr).trim()) {
            rows.push(contactRow("주소", escapeMultiline(String(it.vn_addr).trim())));
        }
        rows.push(contactRow("담당자", escapeHtml(it.vn_mgr_name || "—")));
        rows.push(contactRow("담당 연락처", telLink(it.vn_mgr_tel) || "—"));
        rows.push(contactRow("담당 이메일", mailLink(it.vn_mgr_email) || "—"));

        var noteBlock = "";
        if (it.vn_note && String(it.vn_note).trim()) {
            noteBlock = '<div class="vd-note">' + escapeMultiline(String(it.vn_note).trim()) + "</div>";
        }

        var canManage =
            window.THEJHON_AUTH &&
            THEJHON_AUTH.canManageRegisters &&
            THEJHON_AUTH.canManageRegisters();
        var actions = "";
        if (canManage && it.id) {
            actions =
                '<div class="vd-actions">' +
                '<a href="vendor-edit.html">업체 수정에서 편집</a>' +
                '<a href="support-partners.html">파트너 소개 페이지</a>' +
                "</div>";
        }

        root.innerHTML =
            '<article class="vd-article">' +
            imgBlock +
            '<div class="vd-text"><h1 class="vd-title">' +
            escapeHtml(it.vn_company || "") +
            '</h1><p class="vd-badge">' +
            escapeHtml(
                window.THEJHON_AUTH && THEJHON_AUTH.vendorGradeLabel
                    ? THEJHON_AUTH.vendorGradeLabel(it.vn_grade)
                    : String(it.vn_grade || "1") + "등급"
            ) +
            "</p>" +
            '<p class="vd-spec">사업부문: <strong>' +
            escapeHtml(deptLabels(it)) +
            "</strong></p>" +
            '<dl class="vd-contact">' +
            rows.join("") +
            "</dl>" +
            noteBlock +
            actions +
            "</div></article>";
    }

    function render() {
        if (!root) return;

        var access =
            window.THEJHON_AUTH && THEJHON_AUTH.getRegisterAccess
                ? THEJHON_AUTH.getRegisterAccess()
                : { allowed: false, reason: "관리자 로그인이 필요합니다." };
        if (!access.allowed) {
            showMissing(access.reason, "login.html?next=vendor-list-admin.html");
            return;
        }

        var id = getIdFromQuery();
        if (!id) {
            showMissing("업체 ID가 없습니다.");
            return;
        }
        if (!api || !api.getVendor) {
            showMissing("API를 사용할 수 없습니다.");
            return;
        }

        root.innerHTML = '<p class="vd-missing">불러오는 중…</p>';
        api.getVendor(id)
            .then(function (it) {
                if (!it) {
                    showMissing("해당 업체가 없거나 삭제되었습니다.");
                    return;
                }
                renderItem(it);
            })
            .catch(function () {
                showMissing("해당 업체가 없거나 삭제되었습니다.");
            });
    }

    render();
})();
