(function () {
    var api = window.THEJHON_API;
    var track = document.getElementById("support-vendors-track");
    var marquee = document.getElementById("support-vendors-marquee");
    if (!track) return;

    var vendors = [];
    var DETAIL_HREF = "support-partner-detail.html";

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function displayOrDash(v) {
        var t = String(v || "").trim();
        return t || "—";
    }

    function detailHref(id) {
        return DETAIL_HREF + "?id=" + encodeURIComponent(String(id || ""));
    }

    function renderCard(it) {
        var name = String(it.vn_company || "").trim() || "이름 미등록";
        var phone = String(it.vn_phone || "").trim();
        var email = String(it.vn_email || "").trim();
        var logoInner = String(it.vn_logo || "").trim()
            ? '<img class="support-vendor-card__logo" src=' +
              JSON.stringify(it.vn_logo) +
              ' alt="" loading="lazy">'
            : '<span class="support-vendor-card__logo support-vendor-card__logo--empty" aria-hidden="true">—</span>';
        return (
            '<li><a class="support-vendor-card" href="' +
            escapeHtml(detailHref(it.id)) +
            '" aria-label="' +
            escapeHtml(name) +
            ' 상세 보기">' +
            '<p class="support-vendor-card__name">' +
            escapeHtml(name) +
            "</p>" +
            '<div class="support-vendor-card__logo-wrap">' +
            logoInner +
            "</div>" +
            '<p class="support-vendor-card__line">' +
            escapeHtml(displayOrDash(phone)) +
            "</p>" +
            '<p class="support-vendor-card__line">' +
            escapeHtml(displayOrDash(email)) +
            "</p>" +
            "</a></li>"
        );
    }

    function clearAutoScroll() {
        if (!marquee) return;
        marquee.classList.remove("is-auto-scroll");
        marquee.style.removeProperty("--support-vendors-scroll-duration");
        var clone = marquee.querySelector(".support-vendors-track--clone");
        if (clone) clone.remove();
    }

    function setupAutoScroll() {
        if (!marquee || !vendors.length) return;
        clearAutoScroll();
        var clone = track.cloneNode(true);
        clone.classList.add("support-vendors-track--clone");
        clone.removeAttribute("id");
        clone.setAttribute("aria-hidden", "true");
        marquee.appendChild(clone);
        var seconds = Math.max(24, Math.min(96, vendors.length * 3.5));
        marquee.style.setProperty("--support-vendors-scroll-duration", seconds + "s");
        marquee.classList.add("is-auto-scroll");
    }

    function render(items) {
        clearAutoScroll();
        vendors = (items || [])
            .filter(function (it) {
                return it && it.id;
            })
            .slice()
            .sort(function (a, b) {
                var na = String(a.vn_company || "").trim();
                var nb = String(b.vn_company || "").trim();
                return na.localeCompare(nb, "ko");
            });
        if (!vendors.length) {
            track.innerHTML =
                '<li class="support-vendors-empty-wrap" style="list-style:none"><p class="support-vendors-empty">등록된 업체가 없습니다.</p></li>';
            return;
        }
        track.innerHTML = vendors.map(renderCard).join("");
        setupAutoScroll();
    }

    function load() {
        clearAutoScroll();
        if (!api) {
            track.innerHTML =
                '<li style="list-style:none"><p class="support-vendors-empty">업체 목록을 불러올 수 없습니다.</p></li>';
            return;
        }
        track.innerHTML =
            '<li style="list-style:none"><p class="support-vendors-empty">불러오는 중…</p></li>';
        api.listVendors()
            .then(render)
            .catch(function () {
                track.innerHTML =
                    '<li style="list-style:none"><p class="support-vendors-empty">업체 목록을 불러오지 못했습니다.</p></li>';
            });
    }

    load();
})();
