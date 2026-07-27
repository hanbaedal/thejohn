(function () {
    var api = window.THEJHON_API;
    var PF = window.THEJHON_PRODUCT_FORM;
    var catalog = window.THEJHON_PRODUCT_CATALOG;
    var root = document.getElementById("spd-root");
    var LIST_HREF = "support-partners.html";

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

    function str(v) {
        return String(v || "").trim();
    }

    function safeWebHref(s) {
        var t = str(s);
        if (!t) return "";
        if (/^https?:\/\//i.test(t)) return t;
        return "https://" + t;
    }

    function telHref(tel) {
        var d = String(tel || "").replace(/\D/g, "");
        if (!d) return "";
        if (d.indexOf("82") === 0) return "tel:+" + d;
        if (d.charAt(0) === "0") return "tel:+82" + d.slice(1);
        return "tel:+" + d;
    }

    function emptyDash() {
        return '<span class="sp-contact-empty">—</span>';
    }

    function normalizeVendorDeptId(id) {
        var n = String(id || "").trim().toLowerCase();
        if (n === "uncontracted" || n === "미계약") return "uncontracted";
        return catalog ? catalog.normalizeDept(id) : n;
    }

    function vendorDeptIds(it) {
        var raw = it && it.vn_depts;
        if (!Array.isArray(raw)) return [];
        return raw.map(function (id) {
            return normalizeVendorDeptId(id);
        });
    }

    function vendorDeptLabels(it) {
        var ids = vendorDeptIds(it);
        var labels = [];
        for (var i = 0; i < ids.length; i++) {
            if (!ids[i]) continue;
            var lbl = PF && PF.deptLabel ? PF.deptLabel(catalog, ids[i]) : ids[i];
            if (lbl && labels.indexOf(lbl) < 0) labels.push(lbl);
        }
        return labels.join(", ");
    }

    function roomCountLabel(it) {
        var n = parseInt(it && it.vn_room_count, 10);
        if (!isFinite(n) || n <= 0) return "";
        return String(n) + "개";
    }

    function formatAddress(it) {
        var AF = window.THEJHON_ADDRESS_FIELDS;
        if (AF && AF.formatFullAddress) {
            return str(AF.formatFullAddress(it.vn_zip, it.vn_addr, it.vn_addr_detail));
        }
        return [it.vn_zip, it.vn_addr, it.vn_addr_detail]
            .map(function (v) {
                return str(v);
            })
            .filter(Boolean)
            .join(" ");
    }

    function facilitySummaryHtml(it) {
        var parts = [];
        var dept = vendorDeptLabels(it);
        var rooms = roomCountLabel(it);
        if (dept) parts.push(dept);
        if (rooms) parts.push("빈소 " + rooms);
        if (!parts.length) {
            return '<p class="sp-facility-summary sp-facility-summary--empty">사업부문 · 빈소 —</p>';
        }
        return (
            '<p class="sp-facility-summary">' + escapeHtml(parts.join(" · ")) + "</p>"
        );
    }

    function addressHtml(it) {
        var full = formatAddress(it);
        if (!full) {
            return '<p class="sp-address sp-address--empty">주소: —</p>';
        }
        return '<p class="sp-address">주소: ' + escapeMultiline(full) + "</p>";
    }

    function getIdFromQuery() {
        try {
            return new URLSearchParams(window.location.search).get("id") || "";
        } catch (e) {
            return "";
        }
    }

    function showMissing(msg) {
        document.title = "파트너 업체 상세 — 더존";
        root.innerHTML =
            '<p class="sp-missing">' +
            escapeHtml(msg || "업체를 찾을 수 없습니다.") +
            ' <a href="' +
            escapeHtml(LIST_HREF) +
            '">파트너회사 소개</a>으로 돌아가 주세요.</p>';
    }

    function syncFixedHeaderOffset() {
        if (window.SUPPORT_LAYOUT && SUPPORT_LAYOUT.syncSupportHeaderOffset) {
            SUPPORT_LAYOUT.syncSupportHeaderOffset();
        }
    }

    function backLinkHtml() {
        return (
            '<a class="sp-back-link" href="' +
            escapeHtml(LIST_HREF) +
            '" aria-label="파트너회사 목록으로 돌아가기">' +
            '<span aria-hidden="true">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M15 6l-6 6 6 6"/>' +
            "</svg></span> 파트너회사 소개</a>"
        );
    }

    function heroHtml(it) {
        var logo = str(it.vn_logo);
        if (logo) {
            return (
                '<img class="sp-hero-img" src="' +
                escapeHtml(logo) +
                '" alt="' +
                escapeHtml(str(it.vn_company) || "업체") +
                ' 로고">'
            );
        }
        return (
            '<div class="sp-hero-img sp-hero-img--empty" role="img" aria-label="로고 없음">로고 없음</div>'
        );
    }

    function webHtml(it) {
        var w = str(it.vn_web);
        if (!w) {
            return '<p class="sp-web sp-web--empty">홈페이지: —</p>';
        }
        var href = safeWebHref(w);
        return (
            '<p class="sp-web">홈페이지: <a href="' +
            escapeHtml(href) +
            '" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(w) +
            "</a></p>"
        );
    }

    function telLinkHtml(tel) {
        if (!tel) return emptyDash();
        return (
            '<a href="' +
            escapeHtml(telHref(tel)) +
            '">' +
            escapeHtml(tel) +
            "</a>"
        );
    }

    function contactHtml(it) {
        var companyTel = str(it.vn_phone);
        var name = str(it.vn_mgr_name);
        var mgrTel = str(it.vn_mgr_tel);
        var email = str(it.vn_mgr_email) || str(it.vn_email);
        var nameDd = name ? escapeHtml(name) : emptyDash();
        var emailDd = email
            ? '<a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + "</a>"
            : emptyDash();
        return (
            '<dl class="sp-contact">' +
            "<dt>회사 전화</dt><dd>" +
            telLinkHtml(companyTel) +
            "</dd>" +
            "<dt>담당자</dt><dd>" +
            nameDd +
            "</dd>" +
            "<dt>담당 연락처</dt><dd>" +
            telLinkHtml(mgrTel) +
            "</dd>" +
            "<dt>이메일</dt><dd>" +
            emailDd +
            "</dd></dl>"
        );
    }

    function articleHtml(it, isCurrent) {
        var name = str(it.vn_company) || "이름 미등록";
        var note = str(it.vn_note);
        var noteBlock = note
            ? '<h3 class="sp-section-label">회사 상황</h3><div class="sp-content">' +
              escapeMultiline(note) +
              "</div>"
            : '<h3 class="sp-section-label">회사 상황</h3><div class="sp-content sp-content--empty">등록된 내용이 없습니다.</div>';
        var curClass = isCurrent ? "sp-article is-current" : "sp-article";
        return (
            '<article class="' +
            curClass +
            '" id="sp-item-' +
            escapeHtml(it.id) +
            '" data-vendor-id="' +
            escapeHtml(it.id) +
            '">' +
            '<div class="sp-main">' +
            '<div class="sp-hero-wrap">' +
            heroHtml(it) +
            "</div>" +
            '<div class="sp-summary">' +
            '<h2 class="sp-title">' +
            escapeHtml(name) +
            "</h2>" +
            facilitySummaryHtml(it) +
            addressHtml(it) +
            webHtml(it) +
            contactHtml(it) +
            noteBlock +
            "</div></div></article>"
        );
    }

    function scrollToVendor(id) {
        if (!id) return;
        var el = document.getElementById("sp-item-" + id);
        if (!el) return;
        try {
            el.scrollIntoView({ behavior: "auto", block: "start" });
        } catch (e) {
            el.scrollIntoView(true);
        }
    }

    function sortVendors(items) {
        return (items || [])
            .filter(function (it) {
                return it && it.id;
            })
            .slice()
            .sort(function (a, b) {
                return str(a.vn_company).localeCompare(str(b.vn_company), "ko");
            });
    }

    function renderFeed(items, focusId) {
        var focus = items.find(function (it) {
            return it.id === focusId;
        });
        if (!focus) {
            showMissing("해당 업체가 없거나 삭제되었습니다.");
            return;
        }
        var titlePlain = str(focus.vn_company) || "파트너 업체";
        document.title =
            titlePlain.length > 60
                ? titlePlain.slice(0, 57) + "… — 더존"
                : titlePlain + " — 더존";

        root.innerHTML =
            '<div class="sp-feed">' +
            '<div class="sp-feed-toolbar">' +
            backLinkHtml() +
            "</div>" +
            '<div class="sp-feed-list" role="feed">' +
            items
                .map(function (it) {
                    return articleHtml(it, it.id === focusId);
                })
                .join("") +
            "</div></div>";

        requestAnimationFrame(function () {
            syncFixedHeaderOffset();
            scrollToVendor(focusId);
        });
    }

    function render() {
        if (!root) return;
        var id = getIdFromQuery();
        if (!id) {
            showMissing("업체 ID가 없습니다.");
            return;
        }
        if (!api) {
            showMissing("API를 사용할 수 없습니다.");
            return;
        }
        root.innerHTML = '<p class="sp-missing">불러오는 중…</p>';
        api.listVendors()
            .then(function (items) {
                var list = sortVendors(items);
                if (!list.length) {
                    showMissing("등록된 업체가 없습니다.");
                    return;
                }
                renderFeed(list, id);
            })
            .catch(function (err) {
                showMissing((err && err.message) || "업체 정보를 불러오지 못했습니다.");
            });
    }

    render();
})();
