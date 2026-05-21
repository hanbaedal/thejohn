# 직원 계정 (staff 컬렉션)

## MongoDB 필드 (vendors와 동일 개념)

| 필드 | 용도 |
|------|------|
| `loginId` | 아이디 |
| `loginIdNorm` | 비밀번호 (입력값 그대로) |
| `st_company` | 업체이름 |
| `st_ceo` | 대표자 이름 |
| `st_ceo_tel` | 대표자 연락처 |
| `role` | `admin` (관리자) · 필요 시 `supervisor` |

## staff 컬렉션 기본 등록 (서버 기동 시 자동 동기화)

| 구분 | 아이디 | 비밀번호 | 업체이름 | 대표자 | 연락처 |
|------|--------|----------|----------|--------|--------|
| 관리자 | `thejohn` | `leesb0129!` | (주) 더존 | 이상범 | 01029288196 |
| 관리자 | `aksangsa` | `kimjc2333!` | (주)에이케이상사 | 김종철 | 01047212333 |

Render에서 `thejohn` 비밀번호만 환경 변수로 덮어쓸 때:

```
THEJHON_SEED_SUPERVISOR_PASSWORD=leesb0129!
```

## 로그인

- https://thejohn.onrender.com/login.html
- 관리자 `thejohn` / `leesb0129!`
- 관리자 `aksangsa` / `kimjc2333!`

## 관리자 추가 API

```http
POST /api/staff
Authorization: Bearer <토큰>
Content-Type: application/json

{
  "loginId": "admin01",
  "password": "비밀번호4자이상",
  "st_company": "업체이름",
  "st_ceo": "대표자",
  "st_ceo_tel": "01000000000"
}
```

목록: `GET /api/staff`
