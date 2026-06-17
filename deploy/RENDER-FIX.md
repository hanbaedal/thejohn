# Render Bad Gateway — 최종 체크리스트

## Render Settings (thejohn) — 아래와 **완전히 동일**하게

| 항목 | 값 |
|------|-----|
| **Root Directory** | `server` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

❌ `Root Directory` 비움 + `npm start`(루트) 조합은 쓰지 마세요.  
❌ `PORT` 환경 변수 넣지 마세요.

## Environment (Save 후 Manual Deploy)

**MongoDB (권장 — 비밀번호에 `!` 있어도 OK)**

| Key | 예시 |
|-----|------|
| `MONGODB_USER` | Atlas Database Access 사용자명 |
| `MONGODB_PASSWORD` | Atlas 비밀번호 (따옴표 없이) |
| `MONGODB_HOST` | `cluster0.xxxxx.mongodb.net` |
| `MONGODB_DB` | `thejhon` |

`MONGODB_URI` 한 줄도 가능하나, **USER/PASSWORD/HOST가 있으면 그쪽이 우선**합니다.

**그 외 필수**

```
JWT_SECRET=(32자 이상 랜덤)
NODE_ENV=production
ALLOWED_ORIGINS=https://thejohn.onrender.com,https://thejohn.co.kr,https://www.thejohn.co.kr
```

## 「데이터베이스 연결 중」 / 로그인 503

1. https://thejohn.onrender.com/api/health → `"db": true` 여야 함  
2. `"db": false` 이면 `dbError` 확인 (bad auth → Atlas·Render 비밀번호 동일하게)  
3. https://thejohn.onrender.com/api/env-check → `mongoFromParts` 또는 `MONGODB_URI` true  
4. Atlas **Network Access** `0.0.0.0/0` → **Manual Deploy**

## Atlas (health 에 db:false 일 때)

Network Access → **0.0.0.0/0**  
MONGODB_URI 따옴표 없이 한 줄 — [MONGODB-FIX.md](MONGODB-FIX.md)

## Logs에서 성공 메시지

```
[copy-static] OK → .../public
[thejohn] boot ...
[thejohn] static root: .../public
[thejohn] listening on port ...
[thejohn] MongoDB connected
```

## GitHub push 후 Render 자동 배포가 안 될 때

### 1) GitHub Actions ≠ Render 배포 (흔한 오해)

| 경로 | 역할 |
|------|------|
| **Render 대시보드** → Settings → **Auto-Deploy** | `main` 푸시 시 Render가 직접 빌드·배포 (기본) |
| **`.github/workflows/deploy-render.yml`** | 빌드 검증 + (선택) **Deploy Hook** 호출 |

워크플로 이름이 `deploy-render`여도, **Render Deploy Hook Secret이 없으면** GitHub만 CI를 돌리고 Render 배포는 **Render 쪽 Auto-Deploy**에 맡깁니다.

### 2) Render Auto-Deploy 확인

Render → **thejohn** 서비스 → **Settings** → **Build & Deploy**

| 항목 | 권장값 |
|------|--------|
| **Auto-Deploy** | **Yes** |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Build Command** | `npm ci && npm run build` |
| **Start Command** | `npm start` |

GitHub 연결이 끊겼으면 **Settings → Connect** 에서 `hanbaedal/thejohn` 재연결.

### 3) Deploy Hook으로 push마다 배포 보장 (권장)

1. Render → thejohn → **Settings** → **Deploy Hook** → URL 복사  
2. GitHub → `hanbaedal/thejohn` → **Settings** → **Secrets and variables** → **Actions**  
3. **New repository secret**  
   - Name: `RENDER_DEPLOY_HOOK_URL`  
   - Value: Deploy Hook URL  
4. `main`에 push → Actions **Deploy to Render** → `Trigger Render deploy hook` 성공 확인

### 4) 배포됐는지 확인

- https://thejohn.onrender.com/products-dept-nav.css 에 `720px` 모바일 주석이 있으면 최신 정적 파일 반영됨  
- https://thejohn.co.kr 는 **Cloudflare CDN** 캐시로 예전 JS/CSS가 보일 수 있음 → 시크릿 창 또는 Cloudflare **Purge Cache**

### 5) 수동 배포 (당장 반영)

Render → thejohn → **Manual Deploy** → **Deploy latest commit**

## 확인 URL

- https://thejohn.onrender.com/api/health
- https://thejohn.onrender.com/api/env-check

## 로컬 (Render와 동일)

```powershell
cd c:\TheJhon\homepage\server
npm ci
npm run build
npm start
```

## 커스텀 도메인 (서비스 살아난 뒤)

가비아 DNS:

- `www` → CNAME `thejohn.onrender.com`
- `@` → A `216.24.57.1` (Render 안내와 다르면 Render 값 우선)

기존 `121.254.178.234` A 레코드는 **삭제**.
