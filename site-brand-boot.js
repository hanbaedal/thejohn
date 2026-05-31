/**
 * head 최상단 — 로그인 사용자는 기본 로고·파비콘 없이, 캐시된 관리자 로고만 즉시 표시
 */
(function (global) {
    var AUTH_KEY = "thejhon_logged_in";
    var ROLE_KEY = "thejhon_role";
    var LOGO_KEY = "thejhon_staff_logo";
    var DEFAULT_FAVICON = "img/icon-192.png";
    var DEFAULT_MANIFEST = "manifest.json";
    var DEFAULT_APP_NAME = "더존";
    var pwaManifestBlobUrl = "";

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
            link.href = DEFAULT_MANIFEST;
            setAppleWebAppTitle(DEFAULT_APP_NAME);
            return;
        }

        var name = String(companyName || "").trim() || DEFAULT_APP_NAME;
        var shortName = name.length > 12 ? name.slice(0, 12) : name;
        var mime = iconMime(custom);
        var manifest = {
            name: name,
            short_name: shortName,
            description: name,
            id: "/",
            start_url: "/index.html",
            scope: "/",
            display: "standalone",
            background_color: "#f4f6f9",
            theme_color: "#0a4d9c",
            lang: "ko",
            icons: [
                { src: custom, sizes: "192x192", type: mime, purpose: "any" },
                { src: custom, sizes: "512x512", type: mime, purpose: "any" },
                { src: custom, sizes: "512x512", type: mime, purpose: "maskable" }
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
        link.href = pwaManifestBlobUrl;
        setAppleWebAppTitle(shortName);
    }

    global.__thejhonApplyPwaManifest = applyPwaManifest;

    function authRead(key) {
        try {
            var v = localStorage.getItem(key);
            if (v != null && v !== "") return v;
        } catch (e) {}
        try {
            return sessionStorage.getItem(key) || "";
        } catch (e2) {
            return "";
        }
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

    function escAttr(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;");
    }

    var branded = usesStaffLogoRole();
    var customLogo = branded ? String(authRead(LOGO_KEY) || "").trim() : "";
    var faviconHref = customLogo || (branded ? "" : DEFAULT_FAVICON);

    if (branded) {
        document.documentElement.className += " site-brand-pending";
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

    function clearPending() {
        document.documentElement.classList.remove("site-brand-pending");
    }

    function applyEarlyHeaderLogo() {
        if (!customLogo) return;
        var imgs = document.querySelectorAll(".dz-logo-img");
        for (var i = 0; i < imgs.length; i++) {
            imgs[i].src = customLogo;
        }
        clearPending();
    }

    function bootPwaBrand() {
        if (!customLogo) return;
        var company = "";
        try {
            company = authRead("thejhon_company_name") || "";
        } catch (e) {}
        applyPwaManifest(customLogo, company);
    }

    global.__THEJHON_BRAND_BOOT = {
        branded: branded,
        customLogo: customLogo,
        clearPending: clearPending
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            applyEarlyHeaderLogo();
            bootPwaBrand();
        });
    } else {
        applyEarlyHeaderLogo();
        bootPwaBrand();
    }
})(typeof window !== "undefined" ? window : this);
