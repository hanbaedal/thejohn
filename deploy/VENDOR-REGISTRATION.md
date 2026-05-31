# 업체·상품 — 단일 DB + 담당 관리자

## DB를 나누지 않습니다

직원 계정은 `staff`(슈퍼바이저 1계정 + 관리자 여러 명) · 업체(중복 가능) · 상품(관리자별 독립) · 향후 280곳 규모 모두 **MongoDB `vendors` · `products` 한 컬렉션**으로 운영합니다.

| 구분 | 필드 | 의미 |
|------|------|------|
| 업체 | `vn_registered_by` | 이 업체 **거래처(담당)** 관리자 loginId |
| 상품 | `pd_registered_by` | 이 상품을 **등록한** 관리자 (사업 영역) |
| 업체 구분 | `vn_record_type` | `partner` / `new` |
| 상품 구분 | `pd_record_type` | `catalog` / `new` |

업체는 여러 관리자와 거래할 수 있지만, **로그인 계정 1개**에는 **등록 시 기록된 담당 관리자**(`vn_registered_by`)가 붙습니다.

## 업체가 보는 가격 (핵심)

| 상품 등록 담당 | 업체에 표시되는 가격 |
|----------------|----------------------|
| **내 거래처 관리자**와 동일 (`pd_registered_by` === `vn_registered_by`) | 업체 **등급**에 따른 가격 (가격1~4 / 구매가) |
| **다른 관리자** 상품 | 무조건 **가격1** (`pd_price1`) |

- 화면: `auth.js` — `vendorProductUsesGradePrice`, `buildProductPriceHtml`
- 주문: `server/lib/vendorPricing.js` — 서버가 동일 규칙으로 금액 재계산 (조작 방지)

## 업체 주문 (st_order_enabled)

| | |
|---|---|
| **주문 가능 업체** | `vn_registered_by` 담당 관리자의 `staff.st_order_enabled = true` |
| **주문 가능 상품** | `pd_registered_by`가 업체 담당 관리자와 **동일**하고, 그 관리자가 **주문 권한** 보유 |
| **그 외 관리자 업체** | 해당 관리자 상품 **조회만**, 주문·장바구니 **불가** |

슈퍼바이저 → **관리자 관리** → 해당 관리자 **「주문」** ON 으로 권한 부여.  
서버: `server/lib/orderAccess.js`, `server/lib/staffOrderEnabled.js`

## 관리자 권한

| 역할 | 업체·상품 목록 |
|------|----------------|
| **총괄** (`thejohn`) | 전체 + 담당 필터 |
| **관리자** | 본인이 등록한 것 + `legacy`(기존 미지정) |
| **업체** | **등록 담당 관리자**(`vn_registered_by`)와 동일한 `pd_registered_by` 상품만 목록·주문 |

## 업체가 보는 상품 (2026)

| 로그인 | 목록 | 가격 |
|--------|------|------|
| **미로그인** | 사업부문별 전체 | 숨김 |
| **업체** | 사업부문별 **전체 상품** | 담당 관리자와 같으면 **등급가**, 타 관리자 상품은 **가격1** |
| **주문·장바구니** | — | 담당 관리자 **주문 권한 ON** + `pd_registered_by` 일치 상품만 |

## 상품명 중복

같은 사업부문·**같은 등록 담당** 안에서만 상품명 중복 불가.  
관리자마다 사업부문이 다르면 각자 독립 카탈로그로 운영합니다.

## 주문 SMS

1. 업체 `vn_registered_by` → 해당 관리자 `staff.st_ceo_tel`
2. 없으면 `ORDER_NOTIFY_PHONE` / `ORDER_NOTIFY_STAFF_ID` 환경 변수
3. 없으면 `st_order_enabled` 관리자 연락처 순회 (SOLAPI SMS)
