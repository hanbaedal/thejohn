/**
 * API 서버 주소 (thejhon-api.js 보다 먼저 로드)
 * - '' : 같은 도메인 (/api → Node, Render·Nginx 통합 배포)
 * - 'https://xxx.onrender.com' : 가비아 웹호스팅(정적만) + API 분리 배포 시
 */
(function (global) {
    var base = "";
    if (typeof location !== "undefined" && location.hostname) {
        var host = String(location.hostname).toLowerCase();
        // Render 통합 배포: 같은 도메인에서 /api 호출 (세션·메뉴 권한 동기화)
        if (host === "thejohn.co.kr" || host === "www.thejohn.co.kr") {
            base = "";
        }
    }
    global.THEJHON_API_BASE_URL = base;
})(typeof window !== "undefined" ? window : this);
