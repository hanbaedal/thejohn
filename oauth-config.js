/**
 * SNS 로그인에 사용합니다. 값을 채운 뒤 사이트를 http(s)로 여세요(file://는 제한될 수 있음).
 *
 * 카카오
 *   https://developers.kakao.com → 내 애플리케이션 → 앱 키 → JavaScript 키
 *   플랫폼에 웹 도메인 등록(예: http://localhost:5500), 카카오 로그인 활성화
 *
 * 구글
 *   https://console.cloud.google.com → API 및 서비스 → 사용자 인증 정보
 *   → OAuth 2.0 클라이언트 ID(웹) → 승인된 JavaScript 원본에 사이트 주소 추가
 */
window.THEJHON_OAUTH = {
    kakaoJsKey: "",
    googleClientId: ""
};
