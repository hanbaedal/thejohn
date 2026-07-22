/**
 * head 최상단 — 로그인 사용자는 기본 로고·파비콘 없이, 캐시된 관리자 로고만 즉시 표시
 */
(function (global) {
    (function ensurePwaMetaTags() {
        if (typeof document === "undefined") return;
        function ensureMeta(name, content) {
            if (document.querySelector('meta[name="' + name + '"]')) return;
            var meta = document.createElement("meta");
            meta.name = name;
            meta.content = content;
            document.head.appendChild(meta);
        }
        ensureMeta("mobile-web-app-capable", "yes");
    })();

    var AUTH_KEY = "thejhon_logged_in";
    var ROLE_KEY = "thejhon_role";
    var LOGO_KEY = "thejhon_staff_logo";
    var DEFAULT_FAVICON = "img/icon-192.png";
    var DEFAULT_SITE_LOGO = "img/logo.png";
    var DEFAULT_MANIFEST = "manifest.json";
    var DEFAULT_APP_NAME = "더존";
    var pwaManifestBlobUrl = "";
    var pwaManifestCacheKey = "";

    function siteOrigin() {
        try {
            return String(global.location.origin || "").replace(/\/$/, "");
        } catch (e) {
            return "";
        }
    }

    function toAbsoluteUrl(src) {
        var s = String(src || "").trim();
        if (!s) return s;
        if (/^(https?:|data:|blob:)/i.test(s)) return s;
        var origin = siteOrigin();
        if (!origin) return s;
        return origin + (s.charAt(0) === "/" ? s : "/" + s);
    }

    function iconMime(src) {
        var s = String(src || "");
        if (s.indexOf("data:image/jpeg") === 0 || s.indexOf("data:image/jpg") === 0) {
            return "image/jpeg";
        }
        if (s.indexOf("data:image/webp") === 0) return "image/webp";
        if (s.indexOf("data:image/gif") === 0) return "image/gif";
        return "image/png";
    }

    function setAppleWebAppTitle(name) {
        var title = String(name || "").trim() || DEFAULT_APP_NAME;
        var meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.name = "apple-mobile-web-app-title";
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", title);
    }

    function applyPwaManifest(logoSrc, companyName) {
        var link = document.querySelector('link[rel="manifest"]');
        if (!link) return;

        var custom = String(logoSrc || "").trim();
        if (!custom) {
            if (pwaManifestBlobUrl) {
                try {
                    URL.revokeObjectURL(pwaManifestBlobUrl);
                } catch (e) {}
                pwaManifestBlobUrl = "";
            }
            pwaManifestCacheKey = "";
            link.href = DEFAULT_MANIFEST;
            setAppleWebAppTitle(DEFAULT_APP_NAME);
            return;
        }

        var name = String(companyName || "").trim() || DEFAULT_APP_NAME;
        var shortName = name.length > 12 ? name.slice(0, 12) : name;
        var cacheKey = custom + "\0" + name;
        if (cacheKey === pwaManifestCacheKey && pwaManifestBlobUrl) {
            setAppleWebAppTitle(shortName);
            return;
        }
        var mime = iconMime(custom);
        var iconSrc = toAbsoluteUrl(custom);
        var origin = siteOrigin();
        var manifest = {
            name: name,
            short_name: shortName,
            description: name,
            id: origin ? origin + "/" : "/",
            start_url: origin ? origin + "/index.html" : "/index.html",
            scope: origin ? origin + "/" : "/",
            display: "standalone",
            background_color: "#f4f6f9",
            theme_color: "#0a4d9c",
            lang: "ko",
            icons: [
                { src: iconSrc, sizes: "192x192", type: mime, purpose: "any" },
                { src: iconSrc, sizes: "512x512", type: mime, purpose: "any" },
                { src: iconSrc, sizes: "512x512", type: mime, purpose: "maskable" }
            ]
        };

        if (pwaManifestBlobUrl) {
            try {
                URL.revokeObjectURL(pwaManifestBlobUrl);
            } catch (e2) {}
        }
        pwaManifestBlobUrl = URL.createObjectURL(
            new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" })
        );
        pwaManifestCacheKey = cacheKey;
        link.href = pwaManifestBlobUrl;
        setAppleWebAppTitle(shortName);
    }

    global.__thejhonApplyPwaManifest = applyPwaManifest;

    var store = global.THEJHON_AUTH_STORAGE;

    function authRead(key) {
        return store ? store.get(key) : "";
    }

    function usesStaffLogoRole() {
        try {
            if (authRead(AUTH_KEY) !== "1") return false;
            var role = authRead(ROLE_KEY) || "";
            return role === "admin" || role === "supervisor" || role === "vendor";
        } catch (e) {
            return false;
        }
    }

    function isLoggedInSession() {
        try {
            return authRead(AUTH_KEY) === "1";
        } catch (e) {
            return false;
        }
    }

    function isStaffBrandRole() {
        try {
            if (authRead(AUTH_KEY) !== "1") return false;
            var role = authRead(ROLE_KEY) || "";
            return role === "admin" || role === "supervisor";
        } catch (e) {
            return false;
        }
    }

    var isHomePage = (function () {
        try {
            var p = String(global.location.pathname || "")
                .replace(/\\/g, "/")
                .toLowerCase();
            if (!p || p === "/") return true;
            var seg = p.split("/").pop() || "";
            return seg === "" || seg === "index.html";
        } catch (e) {
            return false;
        }
    })();

    function escAttr(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
    }

    function escScriptJson(s) {
        return JSON.stringify(String(s || ""))
            .replace(/</g, "\\u003c")
            .replace(/>/g, "\\u003e")
            .replace(/\u2028/g, "\\u2028")
            .replace(/\u2029/g, "\\u2029");
    }

    var branded = usesStaffLogoRole();
    var staffBranded = isStaffBrandRole();
    function readCachedLogo() {
        return branded ? String(authRead(LOGO_KEY) || "").trim() : "";
    }

    function readBrandCompany() {
        if (branded) {
            return String(
                authRead("thejhon_brand_company_name") || authRead("thejhon_company_name") || ""
            ).trim();
        }
        return "더존 그룹";
    }

    function faviconHrefForSession(logoSrc) {
        var logo = String(logoSrc || "").trim();
        if (logo) return logo;
        /* 로그인(관리자·업체)인데 등록 로고 없음 — 한가람 기본 icon-192 대신 더존 로고 */
        if (branded) return DEFAULT_SITE_LOGO;
        return DEFAULT_FAVICON;
    }

    function applyFaviconHref(href) {
        var h = String(href || "").trim();
        if (!h) return;
        var mime = iconMime(h);
        var links = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
        for (var i = 0; i < links.length; i++) {
            links[i].href = h;
            try {
                links[i].type = mime;
            } catch (e) {}
        }
    }

    global.__thejhonApplyFavicon = applyFaviconHref;

    var customLogo = readCachedLogo();
    var brandCompany = readBrandCompany();
    var faviconHref = faviconHrefForSession(customLogo);
    var brandedWithCustom = branded && !!customLogo;

    if (isHomePage) {
        try {
            document.documentElement.classList.add("page-home-doc");
        } catch (eHome) {
            document.documentElement.className += " page-home-doc";
        }
    }

    if (brandedWithCustom) {
        try {
            document.documentElement.classList.add("site-brand-active");
            document.documentElement.classList.add("site-brand-has-logo");
            if (brandCompany) document.documentElement.classList.add("site-brand-hero-ready");
        } catch (e0) {
            document.documentElement.className += " site-brand-active site-brand-has-logo";
            if (brandCompany) document.documentElement.className += " site-brand-hero-ready";
        }
    } else if (branded) {
        try {
            document.documentElement.classList.add(
                "site-brand-active",
                "site-brand-has-logo",
                "site-brand-video-ready"
            );
            if (brandCompany) document.documentElement.classList.add("site-brand-hero-ready");
        } catch (e0b) {
            document.documentElement.className +=
                " site-brand-active site-brand-has-logo site-brand-video-ready";
            if (brandCompany) document.documentElement.className += " site-brand-hero-ready";
        }
    } else {
        /* 미로그인(공개) — 기본 더존 로고 즉시 표시 */
        try {
            document.documentElement.classList.add(
                "site-brand-active",
                "site-brand-has-logo",
                "site-brand-video-ready"
            );
        } catch (ePub) {
            document.documentElement.className +=
                " site-brand-active site-brand-has-logo site-brand-video-ready";
        }
    }

    document.write(
        "<style id=\"thejhon-brand-boot-css\">" +
            "html.page-home-doc .home-intro-video[poster*=\"logo.png\"]{opacity:0!important;visibility:hidden!important}" +
            "html.page-home-doc:not(.site-brand-has-logo) .dz-logo-img[src*=\"logo.png\"]," +
            "html.page-home-doc:not(.site-brand-has-logo) .dz-logo-img{opacity:0!important;visibility:hidden!important}" +
            "html.site-brand-active:not(.site-brand-has-logo) .dz-logo-img[src*=\"logo.png\"]," +
            "html.site-brand-active:not(.site-brand-has-logo) .home-intro-video[poster*=\"logo.png\"]{opacity:0!important}" +
            "html.site-brand-active.site-brand-has-logo .dz-logo-img{opacity:1!important;visibility:visible!important}" +
            "html.site-brand-active.site-brand-has-logo .dz-logo{visibility:visible!important}" +
            "html.site-brand-active.site-brand-has-logo .home-intro-video," +
            "html.site-brand-active.site-brand-video-ready .home-intro-video{opacity:1!important;visibility:visible!important}" +
            "html.site-brand-active:not(.site-brand-hero-ready) .company-hero," +
            "html.site-brand-active:not(.site-brand-hero-ready) #homeHeroTitle{visibility:hidden!important}" +
            "html.page-home-doc.site-brand-has-logo .company-hero," +
            "html.page-home-doc.site-brand-has-logo #homeHeroTitle{visibility:visible!important}" +
            "</style>"
    );

    if (isHomePage) {
        document.write(
            "<script>(function(){function stripHomePoster(){var v=document.querySelector('.home-intro-video');" +
                "if(!v)return;v.removeAttribute('poster');" +
                "document.documentElement.classList.add('site-brand-video-ready');}" +
                "function boot(){stripHomePoster();}" +
                "boot();document.addEventListener('DOMContentLoaded',boot);" +
                "})();<\/script>"
        );
    }

    if (faviconHref) {
        document.write(
            '<link rel="icon" href="' +
                escAttr(faviconHref) +
                '" sizes="192x192" type="image/png">\n' +
                '<link rel="apple-touch-icon" sizes="192x192" href="' +
                escAttr(faviconHref) +
                '">\n'
        );
    }

    if (brandedWithCustom && customLogo) {
        document.write(
            "<script>(function(){var L=" +
                escScriptJson(customLogo) +
                ";function stripPoster(v){if(!v)return;" +
                "var p=v.getAttribute('poster')||'';" +
                "if(p.indexOf('logo.png')>=0){v.removeAttribute('poster');}}" +
                "function markReady(){document.documentElement.classList.add('site-brand-has-logo','site-brand-video-ready');" +
                "document.documentElement.classList.remove('site-brand-pending');}" +
                "function apply(){var imgs=document.querySelectorAll('.dz-logo-img');" +
                "if(!imgs.length)return false;" +
                "for(var i=0;i<imgs.length;i++)imgs[i].setAttribute('src',L);" +
                "stripPoster(document.querySelector('.home-intro-video'));" +
                "markReady();return true;}" +
                "function boot(){stripPoster(document.querySelector('.home-intro-video'));apply();}" +
                "boot();if(!apply()){var obs=new MutationObserver(function(){" +
                "boot();if(document.querySelector('.dz-logo-img'))obs.disconnect();});" +
                "obs.observe(document.documentElement,{childList:true,subtree:true});}" +
                "})();<\/script>"
        );
    }

    function clearPending() {
        document.documentElement.classList.remove("site-brand-pending", "site-brand-custom");
    }

    function markBrandHasLogo() {
        document.documentElement.classList.add("site-brand-has-logo");
        document.documentElement.classList.remove("site-brand-pending");
    }

    function applyEarlyHeroBrand() {
        if (!brandCompany) return;
        function run() {
            var el =
                document.getElementById("homeHeroTitle") ||
                document.querySelector(".company-hero");
            if (!el) return false;
            if (!el.dataset.heroDefault) {
                el.dataset.heroDefault = (el.textContent || "").trim();
            }
            var def = el.dataset.heroDefault || "";
            var label = String(brandCompany || "").trim();
            if (label === "게스트") label = "더존 그룹";
            el.textContent =
                def.indexOf("더존") >= 0 ? def.replace(/더존/g, label) : label;
            document.documentElement.classList.add("site-brand-hero-ready");
            if (staffBranded && brandCompany) {
                document.title = brandCompany;
            }
            return true;
        }
        if (document.body && run()) return;
        document.addEventListener("DOMContentLoaded", function () {
            run();
        });
    }

    function stripDeozonVideoPoster() {
        var video = document.querySelector(".home-intro-video");
        if (!video) return;
        var poster = video.getAttribute("poster") || "";
        if (poster.indexOf("logo.png") >= 0) {
            video.removeAttribute("poster");
            document.documentElement.classList.add("site-brand-video-ready");
        }
    }

    applyEarlyHeroBrand();

    function applyEarlyHeaderLogo() {
        stripDeozonVideoPoster();
        var src = customLogo;
        if (!src) src = DEFAULT_SITE_LOGO;
        var imgs = document.querySelectorAll(".dz-logo-img");
        for (var i = 0; i < imgs.length; i++) {
            imgs[i].src = src;
        }
        markBrandHasLogo();
        clearPending();
    }

    function syncBrandFromSession() {
        customLogo = readCachedLogo();
        brandCompany = readBrandCompany();
        faviconHref = faviconHrefForSession(customLogo);
        applyFaviconHref(faviconHref);
        applyPwaManifest(customLogo || "", brandCompany);
        applyEarlyHeaderLogo();
        if (brandCompany) applyEarlyHeroBrand();
    }

    function bootPwaBrand() {
        syncBrandFromSession();
    }

    global.__THEJHON_BRAND_BOOT = {
        branded: branded,
        customLogo: customLogo,
        clearPending: clearPending,
        markBrandHasLogo: markBrandHasLogo
    };

    global.__thejhonSyncBrandFromSession = syncBrandFromSession;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            stripDeozonVideoPoster();
            syncBrandFromSession();
        });
    } else {
        stripDeozonVideoPoster();
        syncBrandFromSession();
    }
    window.addEventListener("pageshow", function () {
        syncBrandFromSession();
    });
})(typeof window !== "undefined" ? window : this);
