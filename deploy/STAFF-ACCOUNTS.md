# 직원 계정 (슈퍼바이저 · 관리자)

## 슈퍼바이저 (기본)

| 항목 | 값 |
|------|-----|
| 아이디 | `thejhon` |
| 비밀번호 | `leesb0129!` (최초 DB 생성 시) |

Render **Environment**에 아래를 넣으면 배포할 때마다 비밀번호를 맞출 수 있습니다.

```
THEJHON_SEED_SUPERVISOR_PASSWORD=leesb0129!
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

## MongoDB 비밀번호 저장 (`passwordAscii`)

직원·업체 비밀번호는 **bcrypt 해시 대신** `passwordAscii` 필드에 저장합니다.

| 예시 비밀번호 | Atlas에 보이는 값 (일부) |
|---------------|-------------------------|
| `leesb0129!` | `108,101,101,115,98,48,49,50,57,33` |

- 각 문자의 **ASCII(유니코드) 코드**를 쉼표로 연결
- Atlas에서 숫자만 보면 원문 복원 가능 (관리·확인용)
- 예전 `passwordHash` 문서는 **로그인 1회** 시 자동으로 `passwordAscii`로 변환

## 로그인

- https://thejohn.co.kr/login.html (또는 onrender URL)
- 우측 상단 **로그인** 버튼
