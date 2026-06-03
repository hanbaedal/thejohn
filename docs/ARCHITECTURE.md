# thejohn 프로젝트 구조

더존(thejohn) 홈페이지·업무 시스템의 아키텍처와 디렉터리 역할을 정리한 문서입니다.

- **저장소**: [github.com/hanbaedal/thejohn](https://github.com/hanbaedal/thejohn)
- **운영**: Render Web Service (`render.yaml`) + MongoDB Atlas
- **도메인**: `thejohn.co.kr`, `www.thejohn.co.kr`, `thejohn.onrender.com`

---

## 1. 전체 아키텍처

정적 **HTML/JS 프론트**와 **Node(Express) API**, **MongoDB**를 **한 서버 프로세스**에서 함께 제공합니다.

```
[브라우저]
  *.html, *.js, common.css
  auth.js · thejhon-api.js · order-ui.js …
        │  JWT Bearer
        ▼
[Node Express — server/]
  index.js → routes/*.js → lib/*.js
        │
        ├── MongoDB Atlas (staff, vendors, products, orders, …)
        ├── PDFKit (발주서·거래명세서)
        └── 정적 파일 (루트 HTML → build 시 server/public 복사)
```

### 요청 흐름

1. 사용자가 `https://thejohn.co.kr/어떤페이지.html` 접속
2. Express가 정적 HTML/JS/CSS를 반환 (`express.static`)
3. 페이지 스크립트가 `thejhon-api.js`로 `/api/*` 호출 (동일 출처)
4. `middleware/auth.js`에서 JWT·역할 검증 후 라우트 처리
5. PDF 등 바이너리는 `Content-Disposition: inline`(보기) 또는 `attachment`(저장, `?download=1`)

---

## 2. 디렉터리 구조

| 영역 | 경로 | 설명 |
|------|------|------|
| **프론트** | 저장소 루트 `*.html`, `*.js`, `*.css` | 페이지 단위 UI (React/Vue 등 SPA 프레임워크 없음) |
| **API 클라이언트** | `thejhon-api.js`, `api-config.js` | REST 호출, 토큰·에러 처리 |
| **인증·네비** | `auth.js`, `auth-storage.js`, `nav.js`, `admin-header.js` | 로그인, 역할별 페이지 가드, 헤더 메뉴 |
| **백엔드** | `server/` | Express 앱, API, 도메인 로직, PDF |
| **배포·운영** | `render.yaml`, `deploy/`, `.github/workflows/` | Render, 가비아 DNS, MongoDB 설정 가이드 |
| **문서** | `docs/`, `README.md` | 구조·배포 설명 |

### 빌드·정적 파일

- `server/package.json`의 `build` / `prestart`: `ensure-pdf-font.js` → `copy-static.js`
- `copy-static.js`가 루트의 HTML·JS·CSS·img 등을 `server/public`으로 복사
- `index.js`의 `resolveStaticRoot()`가 `server/public` 또는 상위 루트에서 `index.html` 탐색

로컬·Render 모두 **`cd server && npm start`** 한 프로세스로 API + 화면을 서빙합니다.

---

## 3. 백엔드 (`server/`)

### 3.1 진입점

| 파일 | 역할 |
|------|------|
| `index.js` | Express 앱, CORS, `requireDb`, API 마운트, 정적·SPA fallback |
| `db.js` | MongoDB 연결 (`MONGODB_URI` 또는 USER/PASSWORD/HOST 조합) |

### 3.2 API 라우트 (`server/routes/`)

| 경로 prefix | 파일 | 주요 기능 |
|-------------|------|-----------|
| `/api/auth` | `auth.js` | 로그인, JWT 발급 |
| `/api/staff` | `staff.js` | 내부 직원(슈퍼바이저·관리자) CRUD |
| `/api/products` | `products.js` | 상품 목록·등록·수정 |
| `/api/vendors` | `vendors.js` | 거래처(업체) |
| `/api/vendor-prospects` | `vendorProspects.js` | 예비 거래처 |
| `/api/vendor-new` | `vendorNew.js` | 신규 업체 등록 흐름 |
| `/api/orders` | `orders.js` | 주문·발주서 PDF·거래명세 PDF |
| `/api/transaction-manual` | `transactionManual.js` | 수기 거래명세서 CRUD·PDF |
| `/api/vendor-email` | `vendorEmail.js` | 업체 메일 발송 |
| `/api/supervisor` | `supervisor.js` | 슈퍼바이저 통계·발주 집계 |
| `/api/access` | `access.js` | 접속·페이지 뷰 통계 |
| `/api/support-news` | `supportNews.js` | 소식 |
| `/api/support-board` | `supportBoard.js` | 게시판 |
| `/api/support-inquiry` | `supportInquiry.js` | 1:1 문의 |

공통: 대부분 `requireDb` 미들웨어 이후 마운트. 인증 필요 구간은 `requireRole("supervisor", "admin", …)` 사용.

### 3.3 도메인 라이브러리 (`server/lib/`) — 예시

| 파일 | 역할 |
|------|------|
| `orderAccess.js` | 주문·목록 조회 권한, 관리자/업체 필터 |
| `orderEnrich.js` | 주문·PDF용 데이터 보강 |
| `orderPdf.js` | 발주서 PDF 생성 |
| `transactionPdf.js`, `transactionPdfDouzone.js` | 거래명세서 PDF 레이아웃 |
| `transactionIssuer.js`, `staffSealImage.js` | 공급자·인감 이미지 |
| `transactionManual.js` | 수기 거래명세 DB·검증 |
| `staff.js`, `staffFields.js` | 직원 계정·시드 |
| `vendorPricing.js` | 업체 등급별 단가 |
| `orderNotify.js`, `solapiSms.js` | 주문 알림·SMS |

### 3.4 인증 (`server/middleware/auth.js`)

- `Authorization: Bearer <JWT>` 검증
- `requireRole(...roles)`로 supervisor / admin / vendor 등 제한

### 3.5 헬스·환경 확인

| 엔드포인트 | 용도 |
|------------|------|
| `GET /api/health` | 서비스·DB 연결, staff 시드 상태 |
| `GET /api/env-check` | 환경 변수 설정 여부 (비밀 값 노출 없음) |

---

## 4. 프론트엔드 구성

### 4.1 공통 스크립트

| 파일 | 역할 |
|------|------|
| `thejhon-api.js` | 모든 `/api` 호출, `pdfBlobFromResponse` 등 |
| `auth.js` | 로그인 상태, 페이지별 접근 제어, 역할별 허브 링크 |
| `auth-storage.js` | 토큰·세션 (탭별 sessionStorage, PWA는 localStorage) |
| `api-config.js` | `THEJHON_API_BASE_URL` (통합 배포 시 `""`) |
| `order-ui.js` | 주문 상세 HTML, PDF 모달·저장 |
| `order-detail-modal.js` | 주문 상세 모달 컴포넌트 |
| `pdf-view-modal.css` | PDF 보기 모달 스타일 (`common.css`에서 import) |

### 4.2 기능별 페이지 묶음

| 묶음 | 대표 페이지 | 설명 |
|------|-------------|------|
| **공개·홈** | `index.html`, `company-*.html` | 소개, 사업부문 |
| **로그인** | `login.html`, `login.js` | staff / vendor / guest |
| **업무 허브** | `work-hub.html`, `staff-manage-hub.html`, `homepage-manage-hub.html` | 역할별 메뉴 진입 |
| **상품·업체** | `products.html`, `vendor-manage.html`, `vendor-excel-import.html` | CRUD, 엑셀, 예비거래처 |
| **거래처 주문** | `cart.html`, `vendor-order-modal.js`, `vendor-cart.js` | 장바구니·주문 제출 |
| **주문서 관리** | `order-manage-hub.html`, `order-list-admin.html`, `supervisor-order-list.html`, `supervisor-*-pdf.html` | 발주·거래명세 조회·PDF |
| **수기 거래명세** | `transaction-manual-register.html`, `transaction-manual-list.html` | 작성·목록·모달 PDF |
| **고객지원** | `support-news.html`, `support-qna.html`, `support-inquiry.html`, `support-library.html` | 소식·QnA·문의·자료 |
| **통계** | `supervisor-access-stats.html`, `supervisor-db-stats.html` | 접속·DB 요약 |

페이지마다 전용 `*.js` / `*.css`가 붙는 **멀티 페이지(MPA)** 패턴입니다.

---

## 5. 권한 모델

`auth.js` 주석·구현 기준 요약:

| 역할 | 설명 |
|------|------|
| **supervisor** | 전체 기능, 관리자(staff) 계정 생성, 통계 |
| **admin** | 담당 업체·상품, 주문 관리 (`st_order_enabled` 등 플래그) |
| **vendor** | 담당 관리자 상품 주문, 등급가 적용 |
| **guest** | 상품 열람(가격 제한), 접속 통계 |

- 프론트: `auth.js`가 허용 페이지 목록·리다이렉트 처리
- 백엔드: 동일 작업을 JWT `role`로 재검증 (우회 방지)

---

## 6. PDF 처리

| 종류 | 생성 | API | 프론트 |
|------|------|-----|--------|
| 발주서 | `orderPdf.js` | `GET /api/orders/:id/pdf` | `viewOrderPdfWithAuth` → 모달 |
| 주문 거래명세 | `transactionPdf*.js` | `GET /api/orders/:id/transaction-pdf` | `viewTransactionPdfWithAuth` → 모달 |
| 수기 거래명세 | 동일 PDF 파이프라인 | `GET/POST /api/transaction-manual/.../pdf` | 목록·작성 화면 모달 |

- **보기**: 서버 `Content-Disposition: inline`, 클라이언트 `openPdfBlobInModal` (iframe)
- **저장**: `?download=1` → `attachment`, `downloadOrderPdfWithAuth` / `downloadTransactionPdfWithAuth`
- 한글 폰트: `server/scripts/ensure-pdf-font.js`, `server/fonts/`

---

## 7. MongoDB 컬렉션 (대표)

실제 스키마는 `server/lib/*Fields.js` 및 라우트를 참고하세요.

| 컬렉션 | 용도 |
|--------|------|
| `staff` | 내부 직원 계정 |
| `vendors` | 거래처 로그인·등급·담당 관리자 |
| `products` | 상품 마스터 |
| `orders` | 주문·발주 |
| `transaction_manual` | 수기 거래명세서 |
| (지원) | 소식·게시판·문의 등 `support*` 라우트 연동 |

---

## 8. 배포

### Render (권장)

`render.yaml` 요약:

| 항목 | 값 |
|------|-----|
| Root Directory | `server` |
| Build | `npm ci && npm run build` |
| Start | `npm start` |
| Health Check | `/api/health` |

필수 환경 변수: `MONGODB_*` 또는 `MONGODB_URI`, `JWT_SECRET`, `ALLOWED_ORIGINS` 등.  
상세: [deploy/RENDER-FIX.md](../deploy/RENDER-FIX.md), [deploy/DEPLOY-GABIA.md](../deploy/DEPLOY-GABIA.md)

### GitHub

`main` 브랜치 푸시 시 Render 자동 배포(연동 시).  
워크플로: `.github/workflows/deploy-render.yml` (있는 경우 CI 보조)

---

## 9. 로컬 개발

```bash
# 프로젝트 루트에 .env (README·.env.example 참고)
cd server
npm install
npm start
```

- 접속: `http://localhost:3000`
- `file://`로 HTML을 직접 열면 API가 동작하지 않음
- 관리자 시드: `.env`의 `THEJHON_ADMIN_PASSWORD`, 로그인 ID `thejohn` / `thejhon`

---

## 10. 관리용 오피스 문서

경영·관리 보고용 **Word / PowerPoint** (한글 파일명):

| 파일 | 용도 |
|------|------|
| `docs/thejohn-system-structure-management.docx` | 상세 설명서 (표·목차) |
| `docs/thejohn-system-structure-management.pptx` | 회의·브리핑용 슬라이드 |

재생성:

```bash
python scripts/generate-management-docs.py
```

(필요 패키지: `pip install python-docx python-pptx`)

---

## 11. 관련 문서

| 문서 | 내용 |
|------|------|
| [README.md](../README.md) | 빠른 시작, API 요약 |
| [deploy/RENDER-FIX.md](../deploy/RENDER-FIX.md) | Render Bad Gateway·Mongo 설정 |
| [deploy/DEPLOY-GABIA.md](../deploy/DEPLOY-GABIA.md) | 가비아 DNS + Render |
| [deploy/MONGODB-FIX.md](../deploy/MONGODB-FIX.md) | MongoDB 연결 문제 |
| [deploy/STAFF-ACCOUNTS.md](../deploy/STAFF-ACCOUNTS.md) | 직원 계정 |
| [deploy/VENDOR-REGISTRATION.md](../deploy/VENDOR-REGISTRATION.md) | 업체 등록 |

---

*문서 버전: 2026-05 기준 코드베이스 (`main`)에 맞춤.*
