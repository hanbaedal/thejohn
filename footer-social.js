/**
 * 푸터 — 소셜 아이콘 + 기업 정보
 * - 게스트: SNS 먼저 → thejohn 관리자 정보 → 저작권
 * - 관리자·슈퍼바이저·업체: 본인(또는 담당 관리자) SNS, 비어 있으면 thejohn SNS로 대체
 * - 카카오톡 채널: (주)더존 고정 URL
 */
(function (global) {
    var KAKAO_CHAT_URL = "https://pf.kakao.com/_xavxlxjX/chat";
    var CACHE_THEJOHN = "thejhon_footer_sns_thejohn_v1";
    var CACHE_SESSION_PREFIX = "thejhon_footer_sns_session_v1:";
    var CACHE_TTL_MS = 30 * 60 * 1000;
    var thejohnFetchPromise = null;

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
        a.setAttribute("aria-label", aria);
        a.innerHTML = innerHtml;
        return a;
    }

    function parseKakaoChannelPublicId(raw) {
        var s = String(raw || "").trim();
        if (!s) return "";
        if (/^_[A-Za-z0-9]+$/.test(s)) return s;
        var m = s.match(/(_[A-Za-z0-9]+)/);
        return m ? m[1] : "";
    }

    function normalizeKakaoChatUrl(raw) {
        var s = String(raw || "").trim();
        if (!s) return "";
        var id = parseKakaoChannelPublicId(s);
        if (id) return "https://pf.kakao.com/" + id + "/chat";
        if (/^https?:\/\//i.test(s) && /pf\.kakao\.com/i.test(s)) {
            return s.replace(/\/+$/, "").replace(/\/chat$/i, "") + "/chat";
        }
        return s;
    }

    function btnKakao(chatUrl) {
        var url = normalizeKakaoChatUrl(chatUrl);
        var channelId = parseKakaoChannelPublicId(url);
        if (!url || !channelId) {
            return btnLink("kakao", "", "카카오톡 채널 채팅", "카카오톡 채널 채팅", iconKakao());
        }
        return btnLink("kakao", url, "카카오톡 채널 채팅", "카카오톡 채널 채팅", iconKakao());
    }

    function replaceSocialBtn(nav, classMod, url, title) {
        if (!nav) return;
        var sel = ".site-footer-social__btn--" + classMod;
        var old = nav.querySelector(sel);
        if (!old) return;
        if (classMod === "kakao") {
            nav.replaceChild(btnKakao(url), old);
            return;
        }
        var inner =
            classMod === "facebook"
                ? iconFacebook()
                : classMod === "instagram"
                  ? iconInstagram()
                  : classMod === "navercafe"
                    ? iconNaverCafe()
                    : iconYoutube();
        var neu = btnLink(classMod, url, title, title, inner);
        nav.replaceChild(neu, old);
    }

    function applyLinks(urls) {
        var nav = document.querySelector(".site-footer-social");
        if (!nav) return;
        var u = urls || {};
        replaceSocialBtn(nav, "facebook", u.facebook, "페이스북");
        replaceSocialBtn(nav, "instagram", u.instagram, "인스타그램");
        replaceSocialBtn(nav, "navercafe", u.naverCafe, "네이버 카페");
        replaceSocialBtn(nav, "youtube", u.youtube, "유튜브");
        replaceSocialBtn(nav, "kakao", KAKAO_CHAT_URL, "카카오톡 채널 채팅");
    }

    function pickStaffSocialField(staff, key) {
        return staff ? String(staff[key] || "").trim() : "";
    }

    /** primary 우선, 비어 있으면 fallback(thejohn) */
    function socialFromStaff(primary, fallback) {
        function pick(key) {
            var v = pickStaffSocialField(primary, key);
            if (v) return v;
            return pickStaffSocialField(fallback, key);
        }
        return {
            facebook: pick("st_facebook"),
            instagram: pick("st_instagram"),
            naverCafe: pick("st_naver_cafe"),
            youtube: pick("st_youtube"),
            kakao: KAKAO_CHAT_URL
        };
    }

    function emptySocialUrls() {
        return {
            facebook: "",
            instagram: "",
            naverCafe: "",
            youtube: "",
            kakao: KAKAO_CHAT_URL
        };
    }

    function readUrlCache(key) {
        if (!key) return null;
        try {
            var raw = sessionStorage.getItem(key);
            if (!raw) return null;
            var pack = JSON.parse(raw);
            if (!pack || typeof pack.at !== "number" || Date.now() - pack.at > CACHE_TTL_MS) {
                sessionStorage.removeItem(key);
                return null;
            }
            return pack.urls || null;
        } catch (ignore) {
            return null;
        }
    }

    function writeUrlCache(key, urls) {
        if (!key || !urls) return;
        try {
            sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), urls: urls }));
        } catch (ignore) {
            /* quota */
        }
    }

    function sessionCacheKey() {
        var Auth = global.THEJHON_AUTH;
        if (!Auth || !Auth.isLoggedIn || !Auth.isLoggedIn()) return "";
        var role = Auth.getRole ? String(Auth.getRole() || "").trim() : "";
        if (role === "guest" || !role) return "";
        var uid = Auth.getUserId ? String(Auth.getUserId() || "").trim() : "";
        if (!uid) return "";
        return CACHE_SESSION_PREFIX + role + ":" + uid;
    }

    function initialSocialUrls() {
        var sessionKey = sessionCacheKey();
        var cached = (sessionKey && readUrlCache(sessionKey)) || readUrlCache(CACHE_THEJOHN);
        if (cached) {
            var out = {
                facebook: String(cached.facebook || "").trim(),
                instagram: String(cached.instagram || "").trim(),
                naverCafe: String(cached.naverCafe || "").trim(),
                youtube: String(cached.youtube || "").trim(),
                kakao: KAKAO_CHAT_URL
            };
            return out;
        }
        return emptySocialUrls();
    }

    function applyCachedLinksFirst() {
        var urls = initialSocialUrls();
        if (
            urls.facebook ||
            urls.instagram ||
            urls.naverCafe ||
            urls.youtube ||
            urls.kakao
        ) {
            applyLinks(urls);
        }
    }

    function fetchThejohnFooterStaff() {
        var Api = global.THEJHON_API;
        if (!Api || !Api.getPublicFooterStaff) {
            return Promise.resolve(null);
        }
        if (thejohnFetchPromise) return thejohnFetchPromise;
        thejohnFetchPromise = Api.getPublicFooterStaff()
            .then(function (st) {
                if (st) {
                    writeUrlCache(CACHE_THEJOHN, socialFromStaff(st));
                }
                return st;
            })
            .catch(function () {
                thejohnFetchPromise = null;
                return null;
            });
        return thejohnFetchPromise;
    }

    function prefetchThejohnSocial() {
        if (readUrlCache(CACHE_THEJOHN)) return;
        fetchThejohnFooterStaff();
    }

    function isGuestFooterRole() {
        var Auth = global.THEJHON_AUTH;
        return !!(
            Auth &&
            Auth.isLoggedIn &&
            Auth.isLoggedIn() &&
            Auth.getRole &&
            Auth.getRole() === "guest"
        );
    }

    function buildSocialNav(urls) {
        var nav = document.createElement("nav");
        nav.className = "site-footer-social";
        nav.setAttribute("aria-label", "소셜 미디어");
        var initial = urls || initialSocialUrls();
        nav.appendChild(
            btnLink("facebook", initial.facebook, "페이스북", "페이스북", iconFacebook())
        );
        nav.appendChild(
            btnLink("instagram", initial.instagram, "인스타그램", "인스타그램", iconInstagram())
        );
        nav.appendChild(
            btnLink("navercafe", initial.naverCafe, "네이버 카페", "네이버 카페", iconNaverCafe())
        );
        nav.appendChild(btnLink("youtube", initial.youtube, "유튜브", "유튜브", iconYoutube()));
        nav.appendChild(btnKakao(initial.kakao));
        return nav;
    }

    function ensureFooterCopy(inner) {
        if (!inner) return null;
        var copy = inner.querySelector(":scope > .site-footer-copy");
        if (!copy) {
            copy = document.createElement("p");
            copy.className = "site-footer-copy";
            copy.textContent = "COPYRIGHT HaeSoo ALL RIGHTS RESERVED.";
        }
        var copyInHead = inner.querySelector(".site-footer-head .site-footer-copy");
        if (copyInHead && copyInHead !== copy) {
            copyInHead.remove();
        }
        return copy;
    }

    /** SNS → 관리자 정보 → 저작권 순서 고정 */
    function ensureFooterLayout(inner) {
        if (!inner) return;
        var head = inner.querySelector(".site-footer-head");
        var grid =
            inner.querySelector(".site-footer-grid") ||
            document.getElementById("siteFooterCompanyGrid");
        var msg = inner.querySelector(".site-footer-company-msg");
        var copy = ensureFooterCopy(inner);
        var social = inner.querySelector(".site-footer-social");

        if (!head) {
            head = document.createElement("div");
            head.className = "site-footer-head";
        }
        if (social && social.parentNode !== head) {
            head.appendChild(social);
        }
        var strayCopy = head.querySelector(".site-footer-copy");
        if (strayCopy) strayCopy.remove();

        var ordered = [head, grid, msg, copy];
        for (var i = 0; i < ordered.length; i++) {
            if (ordered[i]) inner.appendChild(ordered[i]);
        }
    }

    function loadGuestFooterCompany() {
        var Api = global.THEJHON_API;
        var FC = global.THEJHON_FOOTER_COMPANY;
        var grid = document.getElementById("siteFooterCompanyGrid");
        var msgEl = document.getElementById("siteFooterCompanyMsg");
        if (!grid || !Api || !Api.getPublicFooterStaff) return Promise.resolve();

        grid.innerHTML =
            '<div class="site-footer-item site-footer-item--full"><dt></dt><dd class="site-footer-loading">기업 정보를 불러오는 중…</dd></div>';

        return Api.getPublicFooterStaff()
            .then(function (st) {
                if (FC && FC.renderStaffGrid) {
                    grid.innerHTML = FC.renderStaffGrid(st);
                }
                if (msgEl) {
                    msgEl.hidden = true;
                    msgEl.textContent = "";
                }
                var footer = document.querySelector("footer.site-footer");
                if (footer) footer.classList.add("site-footer--guest-ready");
            })
            .catch(function () {
                grid.innerHTML = "";
                if (msgEl) {
                    msgEl.hidden = false;
                    msgEl.textContent = "기업 정보를 불러오지 못했습니다.";
                }
            });
    }

    /** 게스트: SNS 먼저 표시 → 그 아래 thejohn 관리자 정보(모든 페이지 동일) */
    function syncGuestFooter() {
        var inner = document.querySelector(".site-footer-inner");
        if (!inner) return Promise.resolve();

        mount();
        applyCachedLinksFirst();

        return fetchThejohnFooterStaff()
            .then(function (thejohn) {
                var urls = thejohn ? socialFromStaff(thejohn) : emptySocialUrls();
                applyLinks(urls);
                writeUrlCache(CACHE_THEJOHN, urls);
            })
            .then(function () {
                return loadGuestFooterCompany();
            });
    }

    function syncSocialLinks() {
        if (isGuestFooterRole()) {
            return syncGuestFooter();
        }

        mount();
        applyCachedLinksFirst();

        var Auth = global.THEJHON_AUTH;
        var Api = global.THEJHON_API;
        var role = Auth && Auth.getRole ? String(Auth.getRole() || "").trim() : "";
        var loggedIn = Auth && Auth.isLoggedIn && Auth.isLoggedIn();
        var sessionKey = sessionCacheKey();

        if (loggedIn && (role === "admin" || role === "supervisor" || role === "vendor")) {
            var profilePromise =
                Api && Api.getStaffProfile
                    ? Api.getStaffProfile().catch(function () {
                          return null;
                      })
                    : Promise.resolve(null);
            return Promise.all([fetchThejohnFooterStaff(), profilePromise]).then(function (res) {
                var thejohn = res[0];
                var st = res[1];
                var urls = socialFromStaff(st, thejohn);
                applyLinks(urls);
                if (sessionKey) writeUrlCache(sessionKey, urls);
            });
        }

        return fetchThejohnFooterStaff().then(function (thejohn) {
            var urls = thejohn ? socialFromStaff(thejohn) : emptySocialUrls();
            applyLinks(urls);
        });
    }

    function mount() {
        var inner = document.querySelector(".site-footer-inner");
        if (!inner) return;

        var legacySocial = inner.querySelector(":scope > .site-footer-social");
        if (legacySocial) legacySocial.remove();

        var head = inner.querySelector(".site-footer-head");
        var social = head ? head.querySelector(".site-footer-social") : null;
        if (!social) {
            social = buildSocialNav(initialSocialUrls());
        }

        if (!head) {
            head = document.createElement("div");
            head.className = "site-footer-head";
            head.appendChild(social);
        } else if (social.parentNode !== head) {
            head.appendChild(social);
        }

        ensureFooterLayout(inner);
    }

    global.THEJHON_FOOTER_SOCIAL = {
        mount: mount,
        applyLinks: applyLinks,
        syncSocialLinks: syncSocialLinks,
        syncGuestFooter: syncGuestFooter,
        ensureFooterLayout: ensureFooterLayout,
        socialFromStaff: socialFromStaff,
        fetchThejohnFooterStaff: fetchThejohnFooterStaff
    };
    global.__thejhonRefreshFooterSocial = syncSocialLinks;

    function boot() {
        prefetchThejohnSocial();
        if (isGuestFooterRole()) {
            syncGuestFooter();
            return;
        }
        mount();
        syncSocialLinks();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
    global.addEventListener("pageshow", function () {
        if (isGuestFooterRole()) syncGuestFooter();
        else syncSocialLinks();
    });
    global.addEventListener("thejhon-auth-permissions-updated", function () {
        if (isGuestFooterRole()) syncGuestFooter();
        else syncSocialLinks();
    });
})(typeof window !== "undefined" ? window : this);
