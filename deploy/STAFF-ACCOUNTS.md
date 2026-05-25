# 직원 계정 (staff 컬렉션)

## MongoDB 필드 (vendors와 동일 개념)

| 필드 | 용도 |
|------|------|
| `loginId` | 아이디 |
| `loginIdNorm` | 비밀번호 (입력값 그대로) |
| `st_company` | 업체이름 |
| `st_ceo` | 대표자 이름 |
| `st_ceo_tel` | 대표자 연락처 |
| `role` | `admin` (관리자만, 슈퍼바이저 없음) |

## 소스 코드 vs MongoDB

| 위치 | 역할 |
|------|------|
| `server/lib/staffFields.js` | 최초·재배포 시 **staff에 넣을 값 정의**(시드) |
| MongoDB **`staff` 컬렉션** | 실제 저장·**로그인 시 여기서만 조회** |

로그인 API(`/api/auth/login`)는 소스 비밀번호를 보지 않고, `staff`·`vendors` 문서의 `loginId` / `loginIdNorm`(비밀번호)만 검사합니다.

확인: https://thejohn.onrender.com/api/health → `staffOk: true`, `staffInDb`에 `thejohn`, `aksangsa`

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
