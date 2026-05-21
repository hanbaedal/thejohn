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

## Environment (7개, Save 후 Manual Deploy)

```
MONGODB_URI
MONGODB_DB=thejhon
JWT_SECRET=(32자 이상)
THEJHON_ADMIN_PASSWORD=(로그인 비밀번호)
THEJHON_GUEST_PASSWORD=guest
NODE_ENV=production
ALLOWED_ORIGINS=https://thejohn.onrender.com,https://thejohn.co.kr,https://www.thejohn.co.kr
```

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
