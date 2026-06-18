/**
 * 공개 사이트 — 페이지 목록·경로 판별 (auth-storage, auth.js 공통)
 * 미로그인: 아래 페이지 자유 열람 · 그 외는 login.html
 */
(function (global) {
    var PUBLIC_PAGES = {
        "index.html": true,
        "login.html": true,
        "company.html": true,
        "company-jeongyuk.html": true,
        "company-driedfish.html": true,
        "company-frozen.html": true,
        "company-seafood.html": true,
        "company-grocery.html": true,
        "company-drink.html": true,
        "products.html": true,
        "product-detail.html": true,
        "support.html": true,
        "support-partners.html": true,
        "support-library.html": true,
        "support-qna.html": true,
        "support-inquiry.html": true
    };

    var THEJHON_SNS = {
        facebook:
            "https://www.facebook.com/profile.php?id=61590794526953&mibextid=ZbWKwL",
        instagram:
            "https://www.instagram.com/p/DZrcIivPFK7/?igsh=cHhvZTBhaHBweXZp",
        naverCafe: "https://m.cafe.naver.com/thejohnmg",
        youtube:
            "https://youtube.com/channel/UCRhPDfMExmqSbwjBlIXrWdw?si=F60UU2qsdfb8_0PH",
        kakao: "https://pf.kakao.com/_xavxlxjX/chat"
    };

    function currentPageFile() {
        var path = String(global.location.pathname || "")
            .replace(/\\/g, "/")
            .toLowerCase();
        var seg = (path.split("/").pop() || "").split("?")[0];
        return seg || "index.html";
    }

    function isHomePath() {
        var path = String(global.location.pathname || "")
            .replace(/\\/g, "/")
            .toLowerCase();
        return path === "" || path === "/" || path.endsWith("/index.html");
    }

    function isPublicPage(file) {
        if (isHomePath()) return true;
        file = file || currentPageFile();
        return !!PUBLIC_PAGES[file];
    }

    function isLoginPage(file) {
        return (file || currentPageFile()) === "login.html";
    }

    global.THEJHON_PUBLIC_SITE = {
        PUBLIC_PAGES: PUBLIC_PAGES,
        THEJHON_SNS: THEJHON_SNS,
        currentPageFile: currentPageFile,
        isHomePath: isHomePath,
        isPublicPage: isPublicPage,
        isLoginPage: isLoginPage
    };
})(typeof window !== "undefined" ? window : this);
