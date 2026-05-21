(function () {
    var api = window.THEJHON_API;
    var root = document.getElementById("sp-partners-root");
    if (!root) return;

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

    function render(items) {
        var list = (items || []).slice().sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });
        if (!list.length) {
            root.innerHTML =
                '<p class="sp-partners-empty">등록된 업체가 없습니다. <a href="vendor-register.html">업체등록</a>에서 정보를 등록하면 이곳에 표시됩니다.</p>';
            return;
        }
        root.innerHTML =
            '<ul class="sp-partners-grid">' +
            list
                .map(function (it) {
                    var name = String(it.vn_company || "").trim() || "이름 미등록";
                    var w = String(it.vn_web || "").trim();
                    var webBlock;
                    if (w) {
                        var href = safeWebHref(w);
                        webBlock =
                            '<p class="sp-partner-web"><span class="sp-partner-label">홈페이지</span> <a href="' +
                            escapeHtml(href) +
                            '" target="_blank" rel="noopener noreferrer">' +
                            escapeHtml(w) +
                            "</a></p>";
                    } else {
                        webBlock =
                            '<p class="sp-partner-web sp-partner-web--muted"><span class="sp-partner-label">홈페이지</span> 미등록</p>';
                    }
                    var logo = it.vn_logo && String(it.vn_logo).trim();
                    var logoBlock = logo
                        ? '<div class="sp-partner-logo-wrap"><img class="sp-partner-logo" src=' +
                          JSON.stringify(logo) +
                          ' alt="' +
                          escapeHtml(name + " 로고") +
                          '" loading="lazy" width="200" height="120"></div>'
                        : '<div class="sp-partner-logo-wrap sp-partner-logo-wrap--empty" role="img" aria-label="로고 없음">로고 없음</div>';
                    var noteRaw = String(it.vn_note || "").trim();
                    var grade = it.vn_grade || "1";
                    var noteBlock = noteRaw
                        ? '<div class="sp-partner-note"><span class="sp-partner-label">회사 상황 · 등급 ' +
                          escapeHtml(grade) +
                          '</span><p class="sp-partner-note-body">' +
                          escapeMultiline(noteRaw) +
                          "</p></div>"
                        : '<div class="sp-partner-note sp-partner-note--empty"><span class="sp-partner-label">추가설명</span> 없음</div>';
                    return (
                        '<li><article class="sp-partner-card"><header class="sp-partner-header"><h2 class="sp-partner-name">' +
                        escapeHtml(name) +
                        "</h2>" +
                        webBlock +
                        "</header>" +
                        logoBlock +
                        noteBlock +
                        "</article></li>"
                    );
                })
                .join("") +
            "</ul>";
    }

    function load() {
        if (!api) {
            root.innerHTML = '<p class="sp-partners-empty">업체 목록을 불러올 수 없습니다.</p>';
            return;
        }
        root.innerHTML = '<p class="sp-partners-empty">불러오는 중…</p>';
        api.listVendors()
            .then(render)
            .catch(function () {
                root.innerHTML =
                    '<p class="sp-partners-empty">업체 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
            });
    }

    load();
})();
