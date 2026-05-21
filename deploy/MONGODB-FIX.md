# MongoDB 연결 안 될 때 (Render · Atlas)

## 증상

- https://thejohn.onrender.com/api/health → `"db": false`
- 로그인·상품 저장 시 「데이터베이스 연결 중」

## 1. MongoDB Atlas

1. [cloud.mongodb.com](https://cloud.mongodb.com) 로그인  
2. **Network Access** → **ADD IP ADDRESS** → **Allow Access from Anywhere** (`0.0.0.0/0`) → Confirm  
3. **Database Access** → 사용자 `thejohn_db_user` 비밀번호 확인 (잊었으면 **Edit** → 새 비밀번호)  
4. **Database** → Connect → **Drivers** → 연결 문자열 복사  

## 2. Render Environment

**thejohn → Environment → MONGODB_URI**

- 값 **앞뒤에 따옴표 `"` 넣지 않기**  
- 한 줄로 붙여넣기 (줄바꿈 없음)  
- 예시 형식:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

비밀번호에 `@ # % &` 등이 있으면 [URL 인코딩](https://www.urlencoder.org/) 후 URI에 넣기.

| 변수 | 값 |
|------|-----|
| `MONGODB_URI` | Atlas에서 복사한 전체 문자열 |
| `MONGODB_DB` | `thejhon` |

**Save Changes** → **Manual Deploy**

## 3. 확인

- `/api/health` → `"db": true`  
- `/api/env-check` → `"MONGODB_URI": true`  
- `dbError` 가 비어 있어야 함 (오류 메시지 표시됨)

## 4. 로컬 (.env)

`homepage/.env` 의 `MONGODB_URI` 를 Atlas와 **동일한 최신 비밀번호**로 맞추기.

테스트:

```powershell
cd c:\TheJhon\homepage\server
node scripts/test-mongo.js
```

`OK ping` 이 나오면 URI는 맞습니다.
