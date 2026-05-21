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
THEJHON_GUEST_PASSWORD=guest
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
