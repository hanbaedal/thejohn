# Render 배포 전체 점검 (로컬 OK · Render 실패)

## 로컬 vs Render 차이

| | 로컬 | Render |
|---|------|--------|
| 설정 | `homepage/.env` 파일 | **Environment Variables** (대시보드) |
| 포트 | 3000 (직접 지정) | Render가 `PORT` 자동 부여 |
| 실행 | `cd server && npm start` | Build + Start 명령 필요 |
| MongoDB | 집/회사 IP 허용 | **0.0.0.0/0** 필수 |

`.env`는 GitHub에 없음 → Render에 **직접 입력**하지 않으면 100% 실패합니다.

---

## Render 대시보드 — Settings (필수)

**thejohn → Settings**

| 항목 | 값 |
|------|-----|
| **Root Directory** | 비움 (`.` 저장소 루트) |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

❌ 잘못된 예 (502 원인):

- Root = `server` 인데 Start = `npm start` (루트 package.json 기준)
- Build = `npm ci` (루트에 package-lock 없음 → 빌드 실패)
- `PORT=3000` Environment에 직접 입력

---

## Environment Variables (7개)

Render → **Environment** → Add variable (이름 / 값 **분리**)

```
MONGODB_URI          = mongodb+srv://...@cluster0....mongodb.net/?retryWrites=true&w=majority
MONGODB_DB           = thejhon
JWT_SECRET           = 32자_이상_임의_문자열
THEJHON_ADMIN_PASSWORD = (관리자 로그인 비밀번호 — leesb0129! 등 본인이 정한 값)
THEJHON_GUEST_PASSWORD = guest
NODE_ENV             = production
ALLOWED_ORIGINS      = https://thejohn.onrender.com,https://thejohn.co.kr,https://www.thejohn.co.kr,http://localhost:3000
```

**Save Changes** → **Manual Deploy** → **Deploy latest commit**

---

## MongoDB Atlas

1. **Network Access** → `0.0.0.0/0` (Allow from anywhere)
2. **Database Access** → 사용자 비밀번호 유효
3. 배포 후 Atlas → **Browse Collections** → `thejhon` DB 생성 확인

---

## 배포 성공 확인 순서

1. **Logs** (Deploy 탭)
   - ✅ `[thejohn] boot ...`
   - ✅ `[thejohn] listening on port ...`
   - ✅ `[thejohn] MongoDB connected`
   - ❌ `npm ci` / `Cannot find module` → Build Command·Root Directory 재확인
   - ❌ `MONGODB_URI 환경 변수` → Environment 미저장

2. URL
   - https://thejohn.onrender.com/api/health → `{"ok":true,"db":true}`
   - https://thejohn.onrender.com/api/env-check → env 항목이 true
   - https://thejohn.onrender.com → 더존 홈

3. 로그인
   - 아이디: `thejohn`
   - 비밀번호: **THEJHON_ADMIN_PASSWORD에 넣은 값** (MongoDB 비밀번호 아님)

---

## 로컬에서 Render와 동일 조건 테스트

```powershell
cd c:\TheJhon\homepage
$env:PORT="10000"
# .env 내용을 $env: 변수로 설정하거나 dotenv 사용
npm run build
npm start
```

http://localhost:10000/api/health

---

## thejohn.co.kr 도메인 (Render 정상 후)

Render → Custom Domains → `thejohn.co.kr`, `www` 추가  
가비아 DNS를 Render 안내값으로 변경 (기존 `121.254.178.234` A 레코드 교체)

---

## 여전히 실패 시

Logs **마지막 20줄**을 복사해 주세요.  
특히 `Build failed`, `Error:`, `MONGODB`, `Cannot find module` 문구가 원인입니다.
