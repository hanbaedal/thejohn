# 로그인·권한 정의

## 슈퍼바이저 vs 관리자 (staff 컬렉션)

| 구분 | 계정 예 | 역할 필드 (`role`) | 비고 |
|------|---------|-------------------|------|
| **슈퍼바이저** | **`hanbaedal`** | `supervisor` | 총괄 계정 한 개. 전체 데이터 범위·`POST /api/staff`(관리자 추가) 등. |
| **관리자** | `staff`에 등록된 로그인 아이디 각각 | `admin` | **현재 2명**이 시드로 들어 있고, **추가 관리자는 `staff`에 등록되는 대로 확장**(예: 2명 추가 예정 시 동일하게 `staff` 행 추가). |

자세한 필드·API: `deploy/STAFF-ACCOUNTS.md`

## 상품관리 · 업체관리 메뉴 (비활성화 = 헤더에 메뉴가 안 보임)

| 상태 | 메뉴 | 사업부문 가격 |
|------|------|----------------|
| **1. 관리자 또는 슈퍼바이저** (`staff` 컬렉션, 아래 표 참고) | **표시** (활성) | **가격1~3 + 구매가** |
| **2. 업체** (업체등록 아이디·비밀번호) | **숨김** (비활성) | **aksangsa 등록 업체**: aksangsa 상품만·등급가 / **그 외 업체**: 담당 관리자 상품 조회만(주문 없음) |
| **3. 미로그인** | **숨김** (비활성) | **가격 비표시** |

## 로그인 경로

- **슈퍼바이저**: `staff` 컬렉션 — **`hanbaedal`** (`role: supervisor`)
- **관리자**: `staff` 컬렉션 — `role: admin` 인 **모든 `loginId`**(현재 시드 2명, 인원 추가 시 행만 늘리면 됨)
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
| **업체 주문** | `vn_registered_by` = **aksangsa** (`ORDER_VENDOR_STAFF_ID`) | 사업부문 **전체 상품 조회**(타 관리자 상품은 가격1). **주문·장바구니**는 **aksangsa** 등록 상품(`pd_registered_by`)만 |
| **그 외 업체** | thejohn 등 다른 관리자가 등록 | 전체 상품 **조회·가격**(타 관리자 가격1). **주문 없음** |
| **관리자 주문서관리** | 로그인 `aksangsa` | 업체관리 → 주문 리스트 |

- 환경 변수 `ORDER_VENDOR_STAFF_ID=aksangsa` (Render·`.env`)
- **업체(vendor)** 로그인 후 **사업부문 목록**에서 **주문 목록에 담기**·**주문하기** (상세 페이지는 설명만)
- **관리자**: 업체관리 → **주문 리스트** (`order-list-admin.html`), 본인 등록 업체 주문(총괄은 전체)
- 주문 저장 후 브라우저 PDF 다운로드(jsPDF), 서버 PDF: `GET /api/orders/:id/pdf`
- SMS: **SOLAPI(솔라피)** 권장 — `SOLAPI_*` 설정 시 aksangsa `st_ceo_tel`로 간단 주문 알림
