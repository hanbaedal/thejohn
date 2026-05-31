# 직원 계정 (staff 컬렉션)

## MongoDB 필드 (vendors와 동일 개념)

| 필드 | 용도 |
|------|------|
| `loginId` | 아이디 |
| `loginIdNorm` | 비밀번호 (입력값 그대로) |
| `st_company` | 업체이름 |
| `st_ceo` | 대표자 이름 |
| `st_ceo_tel` | 대표자 연락처 |
| `st_order_enabled` | 주문 권한 (슈퍼바이저 「주문」 ON 시 true) |
| `role` | `admin` (관리자) · `supervisor` (슈퍼바이저·전체 조회) |

## 역할 구분 (운영 기준)

| 역할 | 계정 | 설명 |
|------|------|------|
| **슈퍼바이저** | **`hanbaedal`** 한 계정 | `role: supervisor`. 전체 상품·업체 조회·관리자 추가 등 총괄 권한에 가깝게 동작합니다. |
| **관리자** | **`staff` 컬렉션에 등록된 아이디**( `role: admin` ) | 슈퍼바이저 화면 또는 `POST /api/staff`로 추가. **주문 권한**은 `st_order_enabled`로 개별 설정. |

> 관리자 인원은 코드에 고정되지 않습니다. **MongoDB `staff` 문서 수 = 로그인 가능한 직원 계정 수**(역할별로 `admin` / `supervisor` 구분).

## 소스 코드 vs MongoDB

| 위치 | 역할 |
|------|------|
| `server/lib/staffFields.js` | 최초·재배포 시 **핵심 시드**(thejohn, hanbaedal) 정의 |
| MongoDB **`staff` 컬렉션** | 실제 저장·**로그인 시 여기서만 조회** |

로그인 API(`/api/auth/login`)는 소스 비밀번호를 보지 않고, `staff`·`vendors` 문서의 `loginId` / `loginIdNorm`(비밀번호)만 검사합니다.

확인: https://thejohn.onrender.com/api/health → `staffOk: true`, `staffInDb`에 시드 계정(`thejohn`, `hanbaedal` 등) 포함

## staff 컬렉션 기본 등록 (서버 기동 시 자동 동기화)

| 구분 | 아이디 | 비밀번호 | 업체이름 | 대표자 | 연락처 |
|------|--------|----------|----------|--------|--------|
| 관리자 | `thejohn` | `leesb0129!` | (주) 더존 | 이상범 | 01029288196 |
| 슈퍼바이저 | `hanbaedal` | `haesoo.3346!` | 한가람 | 해수 | 01082170323 |

추가 관리자·주문 권한 계정은 **MongoDB에 직접 등록**하거나 슈퍼바이저 API/화면으로 추가합니다.  
신규 배포 시 환경 변수로 선택 시드 가능:

```
SEED_ORDER_ADMIN_LOGIN=관리자아이디
SEED_ORDER_ADMIN_PASSWORD=비밀번호
SEED_ORDER_ADMIN_COMPANY=(주)에이메이상사
SEED_ORDER_ADMIN_CEO=대표자명
SEED_ORDER_ADMIN_CEO_TEL=01000000000
```

Render에서 `thejohn` 비밀번호만 환경 변수로 덮어쓸 때:

```
THEJHON_SEED_SUPERVISOR_PASSWORD=leesb0129!
```

## 로그인

- https://thejohn.onrender.com/login.html
- 관리자 `thejohn` / `leesb0129!`
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
  "st_ceo_tel": "01000000000",
  "orderEnabled": true
}
```

목록: `GET /api/staff`
