# 직원 계정 (staff 컬렉션)

## MongoDB 필드 (vendors와 동일 개념)

| 필드 | 용도 |
|------|------|
| `loginId` | 아이디 |
| `loginIdNorm` | 비밀번호 (입력값 그대로) |
| `st_company` | 업체이름 |
| `st_ceo` | 대표자 이름 |
| `st_ceo_tel` | 대표자 연락처 |
| `role` | `admin` (관리자) · `supervisor` (슈퍼바이저·전체 조회) |

## 역할 구분 (운영 기준)

| 역할 | 계정 | 설명 |
|------|------|------|
| **슈퍼바이저** | **`hanbaedal`** 한 계정 | `role: supervisor`. 전체 상품·업체 조회·관리자 추가 등 총괄 권한에 가깝게 동작합니다. |
| **관리자** | **`staff` 컬렉션에 등록된 아이디**( `role: admin` ) | 시드로는 **현재 2명**(`thejohn`, `aksangsa`)이 들어가 있으며, **앞으로 2명을 더 추가할 예정**이면 `POST /api/staff`(슈퍼바이저·총괄 권한 필요) 또는 관리 화면으로 동일하게 추가하면 됩니다. |

> 관리자 인원은 코드에 고정되지 않습니다. **MongoDB `staff` 문서 수 = 로그인 가능한 직원 계정 수**(역할별로 `admin` / `supervisor` 구분).

## 소스 코드 vs MongoDB

| 위치 | 역할 |
|------|------|
| `server/lib/staffFields.js` | 최초·재배포 시 **staff에 넣을 값 정의**(시드) |
| MongoDB **`staff` 컬렉션** | 실제 저장·**로그인 시 여기서만 조회** |

로그인 API(`/api/auth/login`)는 소스 비밀번호를 보지 않고, `staff`·`vendors` 문서의 `loginId` / `loginIdNorm`(비밀번호)만 검사합니다.

확인: https://thejohn.onrender.com/api/health → `staffOk: true`, `staffInDb`에 시드 계정(`thejohn`, `aksangsa`, `hanbaedal` 등) 포함

## staff 컬렉션 기본 등록 (서버 기동 시 자동 동기화)

| 구분 | 아이디 | 비밀번호 | 업체이름 | 대표자 | 연락처 |
|------|--------|----------|----------|--------|--------|
| 관리자 | `thejohn` | `leesb0129!` | (주) 더존 | 이상범 | 01029288196 |
| 관리자 | `aksangsa` | `kimjc2333!` | (주)에이케이상사 | 김종철 | 01047212333 |
| 슈퍼바이저 | `hanbaedal` | `haesoo.3346!` | 한가람 | 해수 | 01082170323 |

Render에서 `thejohn` 비밀번호만 환경 변수로 덮어쓸 때:

```
THEJHON_SEED_SUPERVISOR_PASSWORD=leesb0129!
```

## 로그인

- https://thejohn.onrender.com/login.html
- 관리자 `thejohn` / `leesb0129!`
- 관리자 `aksangsa` / `kimjc2333!`
- 슈퍼바이저 `hanbaedal` / `haesoo.3346!` — 전체 상품·업체 조회, 담당자 필터

## 관리자 추가 (인원 확대)

새 **관리자**(`role: admin`)는 아래 API로 등록합니다. 슈퍼바이저 계정으로 로그인한 뒤 호출하세요.

```http
POST /api/staff
Authorization: Bearer <슈퍼바이저 hanbaedal 토큰>
Content-Type: application/json

{
  "loginId": "admin01",
  "password": "비밀번호4자이상",
  "role": "admin",
  "st_company": "업체이름",
  "st_ceo": "대표자",
  "st_ceo_tel": "01000000000"
}
```

목록: `GET /api/staff`
