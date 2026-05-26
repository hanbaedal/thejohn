/**
 * 푸터 소셜 아이콘 — 카카오 채널 채팅, 페이스북·인스타(준비 중)
 */
(function (global) {
    var KAKAO_CHAT_URL = "https://pf.kakao.com/_xavxlxjX/chat";

    function iconKakao() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.52 5.35 3.86 6.84L5 21l3.45-1.9C9.55 19.36 10.74 19.5 12 19.5c5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>' +
            "</svg>"
        );
    }

    function iconFacebook() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="currentColor" d="M13.5 8.5H16V5h-2.5C11.57 5 10 6.79 10 9.25V11H7v3h3v7h3v-7h2.6l.4-3H13v-1.75c0-.97.4-1.25 1.5-1.25z"/>' +
            "</svg>"
        );
    }

    function iconInstagram() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<path fill="currentColor" d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A5.5 5.5 0 1 0 17.5 13 5.51 5.51 0 0 0 12 7.5zm6.25-2.75a1.25 1.25 0 1 0-1.25 1.25 1.25 1.25 0 0 0 1.25-1.25z"/>' +
            "</svg>"
        );
    }

    function mount() {
        var inner = document.querySelector(".site-footer-inner");
        if (!inner || inner.querySelector(".site-footer-social")) return;

        var nav = document.createElement("nav");
        nav.className = "site-footer-social";
        nav.setAttribute("aria-label", "소셜 미디어");

        var kakao = document.createElement("a");
        kakao.href = KAKAO_CHAT_URL;
        kakao.className = "site-footer-social__btn site-footer-social__btn--kakao";
        kakao.target = "_blank";
        kakao.rel = "noopener noreferrer";
        kakao.title = "(주)더존 카카오톡 채널 채팅";
        kakao.setAttribute("aria-label", "카카오톡 채널 채팅");
        kakao.innerHTML = iconKakao();

        var fb = document.createElement("span");
        fb.className = "site-footer-social__btn site-footer-social__btn--facebook is-soon";
        fb.title = "페이스북 (준비 중)";
        fb.setAttribute("aria-label", "페이스북 (준비 중)");
        fb.innerHTML = iconFacebook();

        var ig = document.createElement("span");
        ig.className = "site-footer-social__btn site-footer-social__btn--instagram is-soon";
        ig.title = "인스타그램 (준비 중)";
        ig.setAttribute("aria-label", "인스타그램 (준비 중)");
        ig.innerHTML = iconInstagram();

        nav.appendChild(kakao);
        nav.appendChild(fb);
        nav.appendChild(ig);
        inner.appendChild(nav);
    }

    global.THEJHON_FOOTER_SOCIAL = { mount: mount };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
    } else {
        mount();
    }
})(typeof window !== "undefined" ? window : this);
