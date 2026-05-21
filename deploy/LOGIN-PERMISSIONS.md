# 로그인·권한 (홈페이지 동작 정리)

## 1. 게스트 모드 (홈페이지 최초 방문·로그아웃 후)

- 로그인하지 않은 상태 = **게스트**와 동일하게 동작합니다.
- **상품소개**(`products.html`, `product-detail.html`): 가격 **비표시** (「가격: 비공개」)
- 헤더 메뉴 **상품등록·업체등록 숨김**
- 등록 페이지 URL 직접 접근 시 → 메인으로 이동 + 안내

## 2. 로그인 버튼

- 오른쪽 상단 **로그인** → `login.html` (돌아올 페이지는 `?next=` 로 유지)
- 로그인 성공 후 **로그아웃** 버튼 표시

## 3. 스테프 로그인 (`supervisor`, `admin`)

- MongoDB **`staff`** 컬렉션 아이디·비밀번호로 `/api/auth/login`
- **상품등록·업체등록** 메뉴 표시, 등록·수정·삭제 API 사용 가능
- 상품 가격 **표시** (스테프도 열람 가능)

## 4. 업체 로그인 (`vendor`)

- MongoDB **`vendors`** 컬렉션 아이디·비밀번호로 `/api/auth/login`
- **상품 가격 표시**
- **상품등록·업체등록** 메뉴 **숨김**, 등록 페이지·API 사용 불가

## 5. 게스트 아이디 로그인

- `guest` / 게스트 비밀번호: 가격 비공개, 등록 메뉴 없음 (1번과 동일)

## 구현 위치

| 기능 | 파일 |
|------|------|
| 권한 판단 | `auth.js` — `isGuestMode`, `canSeePrices`, `canManageRegisters` |
| 메뉴 표시 | `nav.js` — `applyNavRegisterVisibility` |
| 가격 마스킹 | `products.js`, `product-detail.js` |
| 등록 페이지 차단 | `auth.js` — `enforceRegisterPages` |
| 서버 로그인 | `server/lib/loginResolve.js`, `server/routes/auth.js` |

## 기본 계정 (staff 컬렉션 시드)

| 구분 | 아이디 | 비밀번호 | 업체 |
|------|--------|----------|------|
| 관리자 | `thejohn` | `leesb0129!` | (주) 더존 |
| 관리자 | `aksangsa` | `kimjc2333!` | (주)에이케이상사 |
