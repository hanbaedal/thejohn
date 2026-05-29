(function () {
    var api = window.THEJHON_API;
    var root = document.getElementById("sp-partners-root");
    var DETAIL_HREF = "support-partner-detail.html";

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function str(v) {
        return String(v || "").trim();
    }

    function detailHref(id) {
        return DETAIL_HREF + "?id=" + encodeURIComponent(String(id || ""));
    }

    function listThumbHtml(it) {
        var logo = str(it.vn_logo);
        if (logo) {
            return (
                '<span class="sp-list-thumb"><img src="' +
                escapeHtml(logo) +
                '" alt="" loading="lazy"></span>'
            );
        }
        return '<span class="sp-list-thumb sp-list-thumb--empty" aria-hidden="true">로고</span>';
    }

    function listRowHtml(it) {
        var name = str(it.vn_company) || "이름 미등록";
        var meta = [
            str(it.vn_mgr_name) ? "담당 " + str(it.vn_mgr_name) : "",
            str(it.vn_phone) || str(it.vn_mgr_tel) || "",
            str(it.vn_web) ? "홈페이지 있음" : ""
        ]
            .filter(Boolean)
            .join(" · ");
        return (
            '<li><a class="sp-list-row" href="' +
            escapeHtml(detailHref(it.id)) +
            '">' +
            listThumbHtml(it) +
            '<span class="sp-list-main"><span class="sp-list-name">' +
            escapeHtml(name) +
            "</span>" +
            (meta ? '<span class="sp-list-meta">' + escapeHtml(meta) + "</span>" : "") +
            '</span><span class="sp-list-chevron" aria-hidden="true">›</span></a></li>'
        );
    }

    function render(items) {
        var vendors = (items || [])
            .filter(function (it) {
                return it && it.id;
            })
            .slice()
            .sort(function (a, b) {
                return str(a.vn_company).localeCompare(str(b.vn_company), "ko");
            });
        if (!vendors.length) {
            root.innerHTML =
                '<p class="sp-partners-empty">등록된 업체가 없습니다. <a href="vendor-register.html">업체등록</a>에서 정보를 등록하면 이곳에 표시됩니다.</p>';
            return;
        }
        root.innerHTML =
            '<ul class="sp-list">' + vendors.map(listRowHtml).join("") + "</ul>";
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
