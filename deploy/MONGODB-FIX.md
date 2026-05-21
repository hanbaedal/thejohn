# MongoDB 연결 — Render SSL 오류 해결

## 증상

- `데이터베이스 연결 중입니다`
- `/api/health` → `"db": false`, `SSL alert number 80`

## ✅ Render에 이렇게 설정 (권장)

**MONGODB_URI 한 줄 대신** 아래 4개를 넣으세요. 비밀번호에 `!` 가 있어도 그대로 입력합니다.

| Key | Value (예시) |
|-----|----------------|
| `MONGODB_USER` | `thejohn_db_user` |
| `MONGODB_PASSWORD` | Atlas Database Access 비밀번호 (**그대로**, 따옴표 없음) |
| `MONGODB_HOST` | `cluster0.7v76oy0.mongodb.net` |
| `MONGODB_DB` | `thejhon` |

`MONGODB_URI` 는 **비우거나 삭제**해도 됩니다 (분리 방식이 우선).

**Save** → **Manual Deploy**

## Atlas (필수)

1. **Network Access** → **Allow Access from Anywhere** (`0.0.0.0/0`)
2. **Database Access** → 사용자 비밀번호 확인 (모르면 Edit → 새 비밀번호 → Render `MONGODB_PASSWORD`에 동일하게)

## 확인

https://thejohn.onrender.com/api/health

```json
{"ok":true,"db":true,"dbError":""}
```

https://thejohn.onrender.com/api/env-check → `"mongoFromParts": true`

## 로컬 `.env` (선택)

```
MONGODB_USER=thejohn_db_user
MONGODB_PASSWORD=비밀번호
MONGODB_HOST=cluster0.7v76oy0.mongodb.net
MONGODB_DB=thejhon
```

또는 기존 `MONGODB_URI=...` 도 계속 사용 가능.
