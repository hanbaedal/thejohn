# thejohn.co.kr 배포 (가비아 + Render)

현재 `121.254.178.234` 서버는 **가비아 Apache 기본(파킹) 페이지**만 보입니다.  
이 프로젝트는 **Node.js + MongoDB** 가 필요하므로, 아래 **방법 A(권장)** 를 사용하세요.

---

## 방법 A — Render에 전체 배포 (권장, SSH/FTP 불필요)

사이트·API·MongoDB(Atlas)를 한곳에서 운영합니다. SSL도 Render에서 자동 처리됩니다.

### 1) Render에 배포

1. [Render](https://render.com) 가입 → **New** → **Blueprint**
2. GitHub 저장소 **hanbaedal/thejohn** 연결
3. `render.yaml` 인식 후 **Environment**에서 아래를 **직접 입력** (`.env` 값 참고):
   - `MONGODB_URI`
   - `THEJHON_ADMIN_PASSWORD`
   - (선택) `JWT_SECRET` — 비우면 Render가 생성
4. **Apply** → 배포 완료까지 대기 (5~10분)
5. 임시 URL `https://thejohn-xxxx.onrender.com` 에서 `/api/health` 확인

### 2) Render에 도메인 연결

1. Render 서비스 → **Settings** → **Custom Domains**
2. `thejohn.co.kr`, `www.thejohn.co.kr` 추가
3. Render가 안내하는 **DNS 레코드**를 복사

### 3) 가비아 DNS 변경 (My가비아 → DNS 설정)

기존 A 레코드(`121.254.178.234`)를 **Render 안내값**으로 바꿉니다.

| 호스트 | Render 안내 | 비고 |
|--------|-------------|------|
| `@` | A 레코드 IP (Render 제공) | 또는 ANAME/ALIAS |
| `www` | CNAME → `xxxx.onrender.com` | Render 안내 따름 |

**저장** 후 전파 10분~48시간.  
`api-config.js` 의 `THEJHON_API_BASE_URL` 은 **`""` (빈 문자열)** 유지.

### 4) 확인

- `https://thejohn.co.kr`
- 관리자 로그인 → 상품등록 저장 → Atlas `thejhon` DB 생성 확인

---

## 방법 B — 가비아 웹호스팅(정적) + Render(API만)

Apache 호스팅에 HTML만 올리고 API는 Render URL을 씁니다.

1. Render는 방법 A와 같이 배포
2. `api-config.js` 수정:
   ```js
   global.THEJHON_API_BASE_URL = "https://thejohn-xxxx.onrender.com";
   ```
3. 가비아 **FTP**로 HTML/JS/CSS 업로드 (관리콘솔 FTP 비밀번호 사용)
4. `ALLOWED_ORIGINS` 에 `https://thejohn.co.kr` 포함

---

## 방법 C — 가비아 서버호스팅(SSH 가능 시)

SSH(22번)가 열린 Linux 서버일 때:

```bash
bash deploy/install-on-server.sh
# Nginx: deploy/nginx-thejohn.conf.example 참고
# 가비아 SSL 설치 후 HTTPS 적용
```

---

## SSL (가비아 DNS만 쓸 때)

Render로 옮기면 Render가 HTTPS 처리합니다.  
`121.254.178.234` 에 계속 두는 경우: My가비아 → **SSL(Let's Encrypt)** 에서 `thejohn.co.kr` + `www` 신청.

---

## 저장소

https://github.com/hanbaedal/thejohn
