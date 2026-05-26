# 로그인·권한 정의

## 상품관리 · 업체관리 메뉴 (비활성화 = 헤더에 메뉴가 안 보임)

| 상태 | 메뉴 | 사업부문 가격 |
|------|------|----------------|
| **1. 관리자** (`staff`: thejohn, aksangsa 등) | **표시** (활성) | **가격1~3 + 구매가** |
| **2. 업체** (업체등록 아이디·비밀번호) | **숨김** (비활성) | **담당 관리자 상품만 등급가**, 타 관리자 상품은 **가격1** |
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
| 업체 주문·장바구니 | `products.js`, `catalog-order-ui.js`, `vendor-cart.js`, `cart.html` |
| 주문 API·PDF·SMS | `server/routes/orders.js`, `server/lib/orderPdf.js`, `server/lib/orderNotify.js` |
| 업체 등록 담당 | `vn_registered_by` — `deploy/VENDOR-REGISTRATION.md` |

## 업체 주문

- **업체(vendor)** 로그인 후 **사업부문 목록**에서 수량·**주문 목록에 담기**·**주문하기** (상세 페이지는 설명만)
- **주문·장바구니**: `vn_registered_by` = `ORDER_VENDOR_STAFF_ID`(기본 **aksangsa**) 인 업체만. 그 외 업체는 상품·가격 **조회만**
- **관리자**: 업체관리 → **주문 리스트** (`order-list-admin.html`), 본인 등록 업체 주문(총괄은 전체)
- 주문 저장 후 브라우저 PDF 다운로드(jsPDF), 서버 PDF: `GET /api/orders/:id/pdf`
- SMS: Twilio 환경 변수 설정 시 `aksangsa` 담당 휴대폰(기본 `01047212333`)으로 주문 요약 문자 전송
