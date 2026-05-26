# 로그인·권한 정의

## 상품관리 · 업체관리 메뉴 (비활성화 = 헤더에 메뉴가 안 보임)

| 상태 | 메뉴 | 사업부문 가격 |
|------|------|----------------|
| **1. 관리자** (`staff`: thejohn, aksangsa 등) | **표시** (활성) | **가격1~3 + 구매가** |
| **2. 업체** (업체등록 아이디·비밀번호) | **숨김** (비활성) | **aksangsa 등록 업체**: aksangsa 상품만·등급가 / **그 외 업체**: 담당 관리자 상품 조회만(주문 없음) |
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

## 업체 주문 (aksangsa 전용)

| 대상 | 조건 | 가능 기능 |
|------|------|-----------|
| **업체 주문** | `vn_registered_by` = **aksangsa** (`ORDER_VENDOR_STAFF_ID`) | 사업부문에서 **aksangsa** 등록 상품(`pd_registered_by`)만 목록·**주문 목록에 담기**·**주문하기** |
| **그 외 업체** | thejohn 등 다른 관리자가 등록 | 상품·가격 **조회만** (주문 버튼·API·주문서 메뉴 없음) |
| **관리자 주문서관리** | 로그인 `aksangsa` | 업체관리 → 주문 리스트 |

- 환경 변수 `ORDER_VENDOR_STAFF_ID=aksangsa` (Render·`.env`)
- **업체(vendor)** 로그인 후 **사업부문 목록**에서 **주문 목록에 담기**·**주문하기** (상세 페이지는 설명만)
- **관리자**: 업체관리 → **주문 리스트** (`order-list-admin.html`), 본인 등록 업체 주문(총괄은 전체)
- 주문 저장 후 브라우저 PDF 다운로드(jsPDF), 서버 PDF: `GET /api/orders/:id/pdf`
- SMS: **SOLAPI(솔라피)** 권장 — `SOLAPI_*` 설정 시 aksangsa `st_ceo_tel`로 간단 주문 알림
