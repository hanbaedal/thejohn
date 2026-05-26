/**
 * 푸터 — 저작권 문구 + 소셜 아이콘(페이스북·인스타·네이버카페·유튜브·카카오)
 * URL은 아래 변수에 채우면 활성화됩니다. 빈 문자열이면 준비 중(비클릭)으로 표시됩니다.
 */
(function (global) {
    var KAKAO_CHAT_URL = "https://pf.kakao.com/_xavxlxjX/chat";
    /** 비우면 해당 아이콘만 비활성 */
    var FACEBOOK_URL = "";
    var INSTAGRAM_URL = "";
    var NAVER_CAFE_URL = "";
    var YOUTUBE_URL = "";

    function iconFacebook() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path fill="currentColor" d="M13.5 8.5H16V5h-2.5C11.57 5 10 6.79 10 9.25V11H7v3h3v7h3v-7h2.6l.4-3H13v-1.75c0-.97.4-1.25 1.5-1.25z"/></svg>'
        );
    }

    function iconInstagram() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path fill="currentColor" d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A5.5 5.5 0 1 0 17.5 13 5.51 5.51 0 0 0 12 7.5zm6.25-2.75a1.25 1.25 0 1 0-1.25 1.25 1.25 1.25 0 0 0 1.25-1.25z"/></svg>'
        );
    }

    /** 네이버 카페 — 머그 + 테이블 실루엣 */
    function iconNaverCafe() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path fill="currentColor" d="M5 17h14v2H5v-2zm1-11h11l1 3v6H6V9l1-3zm8 11a2 2 0 1 0 4 0h-4z"/></svg>'
        );
    }

    function iconYoutube() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path fill="currentColor" d="M21.6 7.2c-.2-.8-.8-1.4-1.6-1.6C18 5 12 5 12 5s-6 0-8 .6c-.8.2-1.4.8-1.6 1.6C2 9.2 2 12 2 12s0 2.8.4 4.8c.2.8.8 1.4 1.6 1.6 2 .6 8 .6 8 .6s6 0 8-.6c.8-.2 1.4-.8 1.6-1.6.4-2 .4-4.8.4-4.8s0-2.8-.4-4.8zm-11.9 8V9.9l6.4 3.25-6.4 3.05z"/></svg>'
        );
    }

    function iconKakao() {
        return (
            '<svg class="site-footer-social__icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.52 5.35 3.86 6.84L5 21l3.45-1.9C9.55 19.36 10.74 19.5 12 19.5c5.52 0 10-3.58 10-8s-4.48-8-10-8z"/></svg>'
        );
    }

    function btnLink(classMod, url, title, aria, innerHtml) {
        var trimmed = String(url || "").trim();
        if (!trimmed) {
            var s = document.createElement("span");
            s.className =
                "site-footer-social__btn site-footer-social__btn--" + classMod + " is-soon";
            s.title = title + " (준비 중)";
            s.setAttribute("aria-label", title + " (준비 중)");
            s.innerHTML = innerHtml;
            return s;
        }
        var a = document.createElement("a");
        a.href = trimmed;
        a.className = "site-footer-social__btn site-footer-social__btn--" + classMod;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = title;
        a.setAttribute("aria-label", title);
        a.innerHTML = innerHtml;
        return a;
    }

    function btnKakao() {
        var a = document.createElement("a");
        a.href = KAKAO_CHAT_URL;
        a.className = "site-footer-social__btn site-footer-social__btn--kakao";
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = "카카오톡 채널 채팅";
        a.setAttribute("aria-label", "카카오톡 채널 채팅");
        a.innerHTML = iconKakao();
        return a;
    }

    function mount() {
        var inner = document.querySelector(".site-footer-inner");
        if (!inner) return;
        if (inner.querySelector(".site-footer-head")) return;
        /** 이전 버전: 래퍼 없이 바로 들어간 소셜 nav 제거 */
        var legacySocial = inner.querySelector(":scope > .site-footer-social");
        if (legacySocial) legacySocial.remove();

        var wrap = document.createElement("div");
        wrap.className = "site-footer-head";

        var copy = document.createElement("p");
        copy.className = "site-footer-copy";
        copy.textContent = "COPYRIGHT HaeSoo ALL RIGHTS RESERVED.";

        var nav = document.createElement("nav");
        nav.className = "site-footer-social";
        nav.setAttribute("aria-label", "소셜 미디어");

        nav.appendChild(
            btnLink("facebook", FACEBOOK_URL, "페이스북", "페이스북", iconFacebook())
        );
        nav.appendChild(
            btnLink("instagram", INSTAGRAM_URL, "인스타그램", "인스타그램", iconInstagram())
        );
        nav.appendChild(
            btnLink("navercafe", NAVER_CAFE_URL, "네이버 카페", "네이버 카페", iconNaverCafe())
        );
        nav.appendChild(
            btnLink("youtube", YOUTUBE_URL, "유튜브", "유튜브", iconYoutube())
        );
        nav.appendChild(btnKakao());

        wrap.appendChild(copy);
        wrap.appendChild(nav);
        inner.insertBefore(wrap, inner.firstChild);
    }

    global.THEJHON_FOOTER_SOCIAL = { mount: mount };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
    } else {
        mount();
    }
})(typeof window !== "undefined" ? window : this);
