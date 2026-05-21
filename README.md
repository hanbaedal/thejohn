# thejohn — 더존 홈페이지

정적 HTML 사이트 + Node.js API + MongoDB Atlas로 상품·업체 데이터를 관리합니다.

- **저장소**: [github.com/hanbaedal/thejohn](https://github.com/hanbaedal/thejohn)
- **운영 도메인(예정)**: [thejohn.co.kr](https://thejohn.co.kr)

## 구조

| 경로 | 설명 |
|------|------|
| `*.html`, `*.js`, `common.css` | 프론트엔드 (브라우저) |
| `thejhon-api.js` | `/api` REST 클라이언트 |
| `server/` | Express API + 정적 파일 서빙 |

## 로컬 실행

### 1. 환경 변수

프로젝트 루트에 `.env` 파일을 만듭니다 (`.env.example` 참고).

```env
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster....mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=thejhon
PORT=3000
JWT_SECRET=32자_이상_랜덤_문자열
THEJHON_ADMIN_PASSWORD=관리자비밀번호
THEJHON_GUEST_PASSWORD=guest
ALLOWED_ORIGINS=http://localhost:3000
```

> MongoDB 비밀번호·JWT는 Git에 올리지 마세요. Atlas에서 IP 허용 목록을 설정하세요.

### 2. 서버 설치 및 실행

```bash
cd server
npm install
npm start
```

브라우저에서 `http://localhost:3000` 으로 접속합니다.  
HTML을 파일로 직접 열면(`file://`) API가 동작하지 않습니다.

### 3. 관리자 로그인

- 아이디: `thejohn` (또는 `thejhon`)
- 비밀번호: `.env`의 `THEJHON_ADMIN_PASSWORD`

관리자만 **상품등록**·**업체등록** CRUD가 가능합니다.

## API 요약

| 메서드 | 경로 | 권한 |
|--------|------|------|
| GET | `/api/products` | 공개 |
| GET | `/api/products/:id` | 공개 |
| POST/PUT/DELETE | `/api/products` | 관리자 JWT |
| GET | `/api/vendors` | 공개 (비밀번호 미포함) |
| POST/PUT/DELETE | `/api/vendors` | 관리자 JWT |
| POST | `/api/auth/login` | 공개 |

## thejohn.co.kr 배포 (개요)

1. **VPS 또는 PaaS**에 Node 18+ 설치
2. 이 저장소 클론 후 `server`에서 `npm install --production`
3. `.env` 설정, `pm2 start index.js` 등으로 프로세스 유지
4. **Nginx** 예시: `thejohn.co.kr` → `proxy_pass http://127.0.0.1:3000`
5. **DNS**: `thejohn.co.kr` A 레코드를 서버 IP로 연결
6. **HTTPS**: Let’s Encrypt (`certbot`)

동일 출처에서 HTML과 `/api`를 함께 제공하므로 `thejhon-api.js`의 `baseUrl`은 비워 두면 됩니다.

## GitHub에 푸시

```bash
git init
git remote add origin https://github.com/hanbaedal/thejohn.git
git add .
git commit -m "Add homepage with MongoDB API for products and vendors"
git push -u origin main
```

## 기존 localStorage 데이터

이전에 브라우저에만 저장된 상품·업체는 MongoDB에 없습니다. 관리자로 로그인한 뒤 **상품등록**·**업체등록**에서 다시 입력하거나, 별도 마이그레이션 스크립트를 사용하세요.
