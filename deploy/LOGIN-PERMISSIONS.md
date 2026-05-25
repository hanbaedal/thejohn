# 로그인·권한 정의

## 상품관리 · 업체관리 메뉴 (비활성화 = 헤더에 메뉴가 안 보임)

| 상태 | 메뉴 | 사업부문 가격 |
|------|------|----------------|
| **1. 관리자** (`staff`: thejohn, aksangsa 등) | **표시** (활성) | **가격1~4 전체** |
| **2. 업체** (업체등록 아이디·비밀번호) | **숨김** (비활성) | **등급별 가격** (1등급→가격1, 2등급→가격2, 3등급→가격3) |
| **3. 미로그인** | **숨김** (비활성) | **가격 비표시** |

## 로그인 경로

- **관리자**: MongoDB `staff` 컬렉션
- **업체**: **업체등록**에서 저장한 `loginId` · `password` → `vendors` 컬렉션
- 게스트 로그인 없음

## 구현

| 기능 | 파일 |
|------|------|
| 메뉴 표시/숨김 | `auth.js` — `canShowAdminNavMenus`, `applyNavRegisterVisibility` |
| 메뉴 DOM | `admin-header.js` — 스태프만 드롭다운 생성 |
| 가격 HTML | `auth.js` — `buildProductPriceHtml` |
| 사업부문 목록·상세 | `products.js`, `product-detail.js` |
