# thejohn — 구현 요약 (2026-06 기준)

## 한 줄 요약

모든 관리자가 주문서관리 가능. 업체별·관리자별 등급가로 주문하면 업체 1건 + 관리자별 발주 N건으로 나뉜다. 거래명세 수기로 매출을 입력하면 매출장이 자동 생성되며, 매출장 조회에서 수기·발주를 한 표로 본다.

---

## 주문·발주

| 항목 | 내용 |
|------|------|
| 주문 1회 | 장바구니 상품의 등록 관리자별로 발주 분할 |
| DB 저장 | orderKind: vendor 1건 + orderKind: admin N건 |
| 연결 | admin 발주는 parentOrderId → vendor 발주 |
| 발주 목록 | 각 관리자는 본인 admin 발주만 조회 |
| SMS | 관리자별 admin 발주 건마다 발송 |
| SMS 실패 | 주문·저장은 성공, 문자만 실패 (솔라피 잔고 없어도 OK) |

---

## 가격·등급

| 항목 | 내용 |
|------|------|
| 등급 | 관리자가 업체 등록 시 등급 1/2/3 지정 |
| 단가 | 등급에 맞는 가격2/3, 없으면 가격1 |
| 적용 범위 | 상품 상세·장바구니·주문·거래명세 수기 |
| 제한 | 해당 관리자 미등록 시 **가격1**, 주문은 **등록 업체면 가능** |

---

## 업체 등록

| 항목 | 내용 |
|------|------|
| 동일 loginId | 관리자마다 별도 등록 가능 (등급 각각) |
| DB | loginId + vn_registered_by 복합 unique |
| 수정 | 본인이 등록한 업체만 수정 가능 |

---

## 권한·메뉴

| 항목 | 내용 |
|------|------|
| 주문서관리 | 모든 admin + supervisor (구 st_order_enabled UI·권한에서 제거) |
| 로그아웃 | index.html (공개 홈)으로 이동 |
| 허브 메뉴 | 발주 목록·PDF, 거래명세, 거래명세 수기 작성/목록, 매출장 조회 |

---

## 매출장

| 구분 | 내용 |
|------|------|
| 입력 | 거래명세 수기 작성만 (매출장 단독 입력 화면 제거) |
| 자동 생성 | 수기 저장 → sales_ledgers 자동 생성 |
| 수정·삭제 | 수기 수정/삭제 시 매출장 동기화 |
| 조회 | sales-ledger-inquiry.html — 수기 + 발주 통합 표 |
| 중복 방지 | sales_records의 manual은 조회에서 제외 (ledger와 중복 방지) |
| 발주 매출 | admin 발주만 반영, issuerStaffLoginId = 상품 등록 관리자 |

### 조회 기간 (KST)

| 버튼 | 범위 |
|------|------|
| 1일 | 오늘 |
| 1개월 | 지난달 |
| 3개월 | 지난달 포함 최근 3달 (당월 제외) |
| 기간설정 | 시작일~종료일 직접 지정 |

### 조회 탭

- 업체별 / 품목별 (구 sales-by-vendor, sales-by-product → 리다이렉트)

---

## 거래명세 수기

- 업체 선택 후 품목 추가 시 해당 상품 등록 관리자의 등급 단가 자동 적용
- 저장·수정·삭제 ↔ 매출장 연동

---

## 구 URL 리다이렉트

| 예전 | 이동 |
|------|------|
| sales-by-vendor.html | sales-ledger-inquiry.html?mode=vendor |
| sales-by-product.html | sales-ledger-inquiry.html?mode=product |
| sales-ledger-list.html | transaction-manual-list.html |
| sales-ledger-register.html | transaction-manual-register.html |

---

## 배포

| 항목 | 내용 |
|------|------|
| 방식 | Render (main 푸시 → 자동 배포) |
| 도메인 | thejohn.co.kr / www.thejohn.co.kr |
| API | 같은 도메인 /api/* |
| 최근 커밋 | e054dbe — 매출장 조회 통합 |

---

## 참고·잔여 사항

| 항목 | 내용 |
|------|------|
| DB 필드 | st_order_enabled 필드는 잔존 (접근 제어에는 미사용) |
| E2E | deploy/ORDER-RULES-E2E.md (일부 항목은 매출장 조회 개편 후 문서 갱신 필요) |
| CDN | Cloudflare 사용 시 캐시 purge 또는 시크릿 창으로 최신 UI 확인 |

---

## 관련 문서

- deploy/VENDOR-REGISTRATION.md — 업체·가격 정책
- deploy/LOGIN-PERMISSIONS.md — 로그인·역할
- deploy/ORDER-RULES-E2E.md — 주문·등급·매출 E2E 체크리스트
