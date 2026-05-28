(function () {
    var api = window.THEJHON_API;
    var track = document.getElementById("support-vendors-track");
    var marquee = document.getElementById("support-vendors-marquee");
    var modal = document.getElementById("support-vendor-modal");
    var modalBody = document.getElementById("support-vendor-modal-body");
    if (!track) return;

    var vendors = [];

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

    function displayOrDash(v) {
        var t = String(v || "").trim();
        return t || "—";
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

    function phoneModalHtml(phone) {
        var t = String(phone || "").trim();
        if (!t) return "—";
        var href = telHref(t);
        if (!href) return escapeHtml(t);
        return (
            '<a class="support-vendor-modal__tel" href="' +
            escapeHtml(href) +
            '">' +
            escapeHtml(t) +
            "</a>"
        );
    }

    function logoBlock(logo, name, classPrefix) {
        var src = String(logo || "").trim();
        if (!src) {
            return (
                '<div class="' +
                classPrefix +
                '__logo-wrap"><span class="' +
                classPrefix +
                '__logo ' +
                classPrefix +
                '__logo--empty" role="img" aria-label="로고 없음">로고 없음</span></div>'
            );
        }
        return (
            '<div class="' +
            classPrefix +
            '__logo-wrap"><img class="' +
            classPrefix +
            '__logo" src=' +
            JSON.stringify(src) +
            ' alt="' +
            escapeHtml((name || "업체") + " 로고") +
            '" loading="lazy"></div>'
        );
    }

    function renderCard(it, index) {
        var name = String(it.vn_company || "").trim() || "이름 미등록";
        var phone = String(it.vn_phone || "").trim();
        var email = String(it.vn_email || "").trim();
        var logoInner = String(it.vn_logo || "").trim()
            ? '<img class="support-vendor-card__logo" src=' +
              JSON.stringify(it.vn_logo) +
              ' alt="" loading="lazy">'
            : '<span class="support-vendor-card__logo support-vendor-card__logo--empty" aria-hidden="true">—</span>';
        return (
            '<li><button type="button" class="support-vendor-card" data-vendor-index="' +
            index +
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
            "</button></li>"
        );
    }

    function openModal(it) {
        if (!modal || !modalBody) return;
        var name = String(it.vn_company || "").trim() || "이름 미등록";
        var note = String(it.vn_note || "").trim();
        modalBody.innerHTML =
            '<div class="support-vendor-modal__head">' +
            '<h2 id="support-vendor-modal-title" class="support-vendor-modal__title">' +
            escapeHtml(name) +
            "</h2>" +
            '<button type="button" class="support-vendor-modal__close" id="support-vendor-modal-close-inner" aria-label="닫기">×</button>' +
            "</div>" +
            logoBlock(it.vn_logo, name, "support-vendor-modal") +
            '<dl class="support-vendor-modal__dl">' +
            "<dt>전화</dt><dd>" +
            phoneModalHtml(it.vn_phone) +
            "</dd>" +
            "<dt>이메일</dt><dd>" +
            escapeHtml(displayOrDash(it.vn_email)) +
            "</dd>" +
            "<dt>주소</dt><dd>" +
            escapeHtml(displayOrDash(it.vn_addr)) +
            "</dd>" +
            "</dl>" +
            '<div class="support-vendor-modal__note"><h3>회사 상황</h3><p>' +
            (note ? escapeMultiline(note) : "등록된 내용이 없습니다.") +
            "</p></div>";
        modal.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = "";
    }

    function bindTrackClicks() {
        var clickRoot = marquee || track;
        clickRoot.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-vendor-index]");
            if (!btn) return;
            var idx = parseInt(btn.getAttribute("data-vendor-index"), 10);
            if (!Number.isFinite(idx) || !vendors[idx]) return;
            openModal(vendors[idx]);
        });
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
        vendors = (items || []).slice().sort(function (a, b) {
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

    if (modal) {
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
    }
    if (modalBody) {
        modalBody.addEventListener("click", function (e) {
            if (e.target.closest("#support-vendor-modal-close-inner")) closeModal();
        });
    }
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && modal && !modal.hidden) closeModal();
    });

    bindTrackClicks();
    load();
})();
