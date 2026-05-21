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

## MongoDB 비밀번호 저장 (`password`)

직원·업체 비밀번호는 **입력한 문자열 그대로** `password` 필드에 저장합니다.

| 항목 | 값 |
|------|-----|
| 슈퍼바이저 아이디 | `thejhon` |
| 슈퍼바이저 비밀번호 | `leesb0129!` (서버 기동 시 Atlas에 동기화) |

- 등록·수정 API에 넣은 비밀번호 = DB `password` 값
- 예전 `passwordAscii` / `passwordHash` 는 기동 시 `password` 로 자동 변환

## 로그인 (서버)

`POST /api/auth/login` 시 **`staff`와 `vendors`를 `Promise.all`로 동시 조회**한 뒤:

1. `staff` 슈퍼바이저/관리자 비밀번호 일치
2. 없으면 `vendors` 업체 비밀번호 일치
3. 예약 아이디(`thejhon` 등)는 위가 모두 실패할 때만 레거시 env 확인

(예전처럼 `thejhon`만 조회 후 바로 401 하지 않음)

## 로그인 (화면)

- https://thejohn.co.kr/login.html (또는 onrender URL)
- 우측 상단 **로그인** 버튼
