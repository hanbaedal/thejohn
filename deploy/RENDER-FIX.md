# Render 502 / Bad Gateway 해결

## Render 대시보드 설정 (thejohn)

| 항목 | 값 |
|------|-----|
| **Root Directory** | `server` (또는 비우고 Start Command 아래 참고) |
| **Build Command** | `npm ci` |
| **Start Command** | `node index.js` (Root=`server`일 때) |
| **Health Check Path** | `/api/health` |

Root Directory를 **비운 경우**:
- Build: `cd server && npm ci`
- Start: `npm start` (저장소 루트 `package.json` 사용)

## Environment (필수)

```
MONGODB_URI=mongodb+srv://...
MONGODB_DB=thejhon
JWT_SECRET=32자이상임의문자열
THEJHON_ADMIN_PASSWORD=관리자비밀번호
THEJHON_GUEST_PASSWORD=guest
ALLOWED_ORIGINS=https://thejohn.onrender.com,https://thejohn.co.kr,https://www.thejohn.co.kr
NODE_ENV=production
```

`PORT`는 Render가 자동 설정 — **직접 넣지 않음**.

## MongoDB Atlas

**Network Access** → **0.0.0.0/0** (Allow from anywhere)

## 배포

1. Environment **Save**
2. **Manual Deploy** → Deploy latest commit
3. **Logs**에서 `listening on port` 확인
4. https://thejohn.onrender.com/api/health → `{"ok":true,"db":true}`

`db:false` 이면 Atlas URI·IP 허용 확인.
