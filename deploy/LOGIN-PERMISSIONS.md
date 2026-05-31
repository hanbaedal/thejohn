# 로그인·권한 정의

## 정책 요약 (0~5)

| # | 규칙 | 구현 |
|---|------|------|
| **0** | **슈퍼바이저** 로그인 → 모든 페이지·기능 (관리자 관리·접속통계·슈퍼바이저 주문 목록·엑셀 불러오기 등 포함) | `role: supervisor` — `canManageStaffAccounts`, `getSupervisorExcelImportAccess` 등 |
| **1** | **관리자** 로그인 → 슈퍼바이저 **「관리자 관리」** 만 제외하고 전부 이용 | `role: admin` — `canShowAdminNavMenus` / `canManageRegisters`. `staff-manage*.html` 등은 슈퍼바이저 전용 |
| **2** | 슈퍼바이저가 관리자 목록에서 **「주문」** 설정 → DB `st_order_enabled` → 그 관리자 `loginId`로 등록된 **업체** 주문·장바구니 전 기능 | `staffOrderEnabledFromDoc` · `findStaffByRegisteredBy` · `vendorCanPlaceOrders` |
| **3** | **새 탭**마다 **서로 다른 업체·관리자** 로그인 가능 (같은 Chrome 프로필) | `sessionStorage` 우선 — 탭별 독립 세션. 동시 접속·중복 로그인 차단 없음 |
| **4** | **같은 기기·다른 기기** 간 로그인은 **서로 영향 없음** (독립) | 서버 단일 세션 강제 없음. A폰·B노트북은 각각 독립 JWT |
| **5** | **한 업체 아이디**의 **여러 기기·여러 탭** 동시 로그인 **제한 없음** | `sessionControl.js` — `MAX_CONCURRENT_SESSIONS = Infinity`, `sessionEnforced` = false |

### 같은 브라우저(프로필) 안에서

- **일반 Chrome·Edge**: 탭마다 `sessionStorage` → **탭별로 다른 업체** 로그인 가능 (어제까지와 동일).
- **PWA(홈 화면 추가)**: `localStorage`도 사용 → 앱을 닫았다 열어도 로그인 유지. PWA 창 하나 = 계정 하나.
- **로그인 아이디 힌트**만 `localStorage`에 저장 (로그인 폼 자동 입력용, 탭 간 공유).

---

## 역할별 메뉴·기능

| 역할 | 계정 | 상품·업체 관리 | 관리자 관리 | 주문서관리 | 업체 주문 |
|------|------|----------------|-------------|------------|-----------|
| 슈퍼바이저 | `hanbaedal` 등 `supervisor` | ○ | ○ | ○ (전체) | — |
| 관리자 | `staff` · `admin` | ○ | ✕ | ○ (`st_order_enabled` 시) | — |
| 업체 | `vendors` · `loginId` | ✕ | ✕ | — | ○ (담당 관리자가 주문 권한 + 본인 등록 상품) |
| 미로그인 | — | ✕ | ✕ | ✕ | ✕ |

## 주문 권한 (규칙 2)

1. 슈퍼바이저 → **관리자 등록·목록** → 해당 관리자 **「주문」** 버튼 ON  
2. DB `staff.st_order_enabled = true` 저장  
3. **관리자** 로그인 → **주문서관리** 메뉴 (`order-list-admin.html`)  
4. 그 관리자가 등록한 **업체** (`vn_registered_by` = 해당 관리자 `loginId`) 로그인 →  
   - 담당 관리자가 등록한 **상품** (`pd_registered_by` 일치)만 주문·장바구니  
   - `vendorCanPlaceOrders` / `canPlaceVendorOrders` 로 판단  

관리자 **loginId 변경** 시 `vn_registered_by`·`pd_registered_by`는 서버가 자동 갱신합니다. 옛 아이디(`aksangsa` 등)가 남아 있으면 기동 시 `reconcileStaleRegisteredByReferences`로 맞춥니다.

## 로그인·세션 (규칙 3~5)

| 항목 | 동작 |
|------|------|
| 동시 접속 제한 | **없음** — 같은 아이디로 폰·PC·탭 여러 곳 동시 사용 가능 |
| 서버 JWT | 기기마다 독립 발급, 타 기기 로그인이 다른 기기를 끊지 않음 |
| 클라이언트 저장 | **탭**: `sessionStorage` (탭별 독립) · **PWA**: `localStorage`도 사용 (앱 종료 후 유지) |
| 권한 갱신 | 페이지 로드 시 `GET /api/auth/session` — 주문 권한 등 DB 최신값 반영 → `thejhon-auth-permissions-updated` 이벤트 |
| 계정 전환 (같은 탭) | 새 로그인 시 이전 세션·장바구니 정리 후 새 계정 적용 |

## 로그인 경로

- **슈퍼바이저**: `staff` · `role: supervisor` (예: `hanbaedal`)
- **관리자**: `staff` · `role: admin`
- **업체**: **업체등록** `vendors` · `loginId` / `password`
- 게스트 로그인 없음

## 구현 파일

| 기능 | 파일 |
|------|------|
| 권한·메뉴 | `auth.js` — `canShowAdminNavMenus`, `canShowOrderManageMenu`, `canPlaceVendorOrders`, `enforceRegisterPages` |
| 세션 저장 (탭/PWA) | `auth-storage.js` — `THEJHON_AUTH_STORAGE` |
| 세션 (무제한 동시) | `server/lib/sessionControl.js` |
| 주문 권한 DB | `server/lib/staffFields.js` — `st_order_enabled`, `server/lib/orderAccess.js`, `server/lib/staffRegisteredBy.js` |
| 로그인 API | `server/routes/auth.js`, `server/lib/loginResolve.js` |
| 메뉴 DOM | `admin-header.js`, `nav.js` |

관련: `deploy/STAFF-ACCOUNTS.md`, `deploy/VENDOR-REGISTRATION.md`
