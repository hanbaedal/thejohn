# 업체·상품 — 단일 DB + 관리자별 등록

## DB를 나누지 않습니다

직원(`staff`) · 업체(`vendors`) · 상품(`products`) 모두 **MongoDB 한 DB·한 컬렉션**으로 운영합니다.

| 구분 | 필드 | 의미 |
|------|------|------|
| 업체 | `loginId` | 업체 로그인 아이디 (여러 관리자가 **같은 loginId**로 각각 등록 가능) |
| 업체 | `vn_registered_by` | 이 레코드를 **등록한** 관리자 loginId |
| 업체 | `vn_grade` | **해당 관리자** 기준 거래 등급 (1~3) |
| 상품 | `pd_registered_by` | 상품 **등록 관리자** loginId |

**DB 인덱스:** `{ loginId, vn_registered_by }` 복합 unique — 관리자마다 같은 업체 아이디를 따로 등록·등급 부여.

## 업체가 보는 가격

| 조건 | 가격 |
|------|------|
| 상품 `pd_registered_by` = **그 관리자에게 등록된** 업체 프로필 존재 | 해당 관리자가 준 **등급** → 가격1~3 |
| 등급 칸(가격2/3) 비어 있거나 0 | **가격1** fallback |
| 해당 관리자에게 **미등록** | **가격1** 표시 · 주문은 **가능** (등록 업체 전원) |

- 화면: `auth.js` — `getVendorUnitPriceForProduct`, `vendorProfiles`
- 주문: `server/lib/vendorPricing.js`, `server/lib/orderSubmit.js`

## 업체 주문

| | |
|---|---|
| **주문 가능 업체** | `vendors`에 **1명 이상** 관리자에게 등록된 loginId |
| **주문 가능 상품** | **모든 관리자** 상품 (등급가는 본인에게 등록한 관리자 상품만) |
| **관리자 주문서관리** | **모든 admin** 이용 (`st_order_enabled` 폐지) |

주문 1회 → DB: **vendor 발주 1건** + **상품 등록 관리자별 admin 발주 N건** + 관리자별 SMS(솔라피).

## 로그인 · vendorProfiles

업체 로그인 시 동일 `loginId`의 **모든** vendor 레코드를 `vendorProfiles`로 내려줍니다.

```json
[
  { "registeredBy": "adminA", "grade": "1", ... },
  { "registeredBy": "adminB", "grade": "2", ... }
]
```

같은 loginId로 등록할 때 **비밀번호는 동일하게** 맞추는 것을 권장합니다.

## 관리자 권한

| 역할 | 업체 |
|------|------|
| **슈퍼바이저** | 전체 조회·관리 |
| **관리자** | **본인이 등록**(`vn_registered_by`)한 업체만 수정 |
| **업체** | 주문·장바구니 (등록 업체 — 모든 상품) |

## 주문 SMS

1. admin 발주의 `orderStaffLoginId` → 해당 관리자 `st_ceo_tel`
2. 없으면 `ORDER_NOTIFY_PHONE` / `ORDER_NOTIFY_STAFF_ID`
3. 없으면 **활성 admin** 대표 연락처 순회 (SOLAPI SMS)

SMS 실패·잔고 없음 → **주문·발주 DB 저장은 그대로 성공**.

## E2E 테스트

`deploy/ORDER-RULES-E2E.md` 체크리스트 참고.
