# 직원 계정 (슈퍼바이저 · 관리자)

## 슈퍼바이저 (기본)

| 항목 | 값 |
|------|-----|
| 아이디 | `thejhon` |
| 비밀번호 | `leesb129!` (최초 DB 생성 시) |

Render **Environment**에 아래를 넣으면 배포할 때마다 비밀번호를 맞출 수 있습니다.

```
THEJHON_SEED_SUPERVISOR_PASSWORD=leesb129!
```

## 관리자 추가 (나중에 3명)

슈퍼바이저 또는 관리자로 로그인한 뒤 API 호출:

```http
POST /api/staff
Authorization: Bearer <로그인 후 토큰>
Content-Type: application/json

{
  "loginId": "admin01",
  "password": "비밀번호4자이상",
  "name": "홍길동"
}
```

목록 확인: `GET /api/staff` (동일 토큰)

## 로그인

- https://thejohn.co.kr/login.html (또는 onrender URL)
- 우측 상단 **로그인** 버튼
