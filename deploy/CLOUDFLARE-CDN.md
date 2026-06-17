# thejohn.co.kr — Cloudflare CDN 적용 가이드

R2·이미지 저장소 이전 없이, **Cloudflare CDN만** 앞에 두어 정적 파일·이미지 재방문 속도를 개선하는 절차입니다.

---

## 이게 뭘 해 주나

```
[사용자] → [Cloudflare 엣지(가까운 서버)] → (캐시 있으면 여기서 끝)
                                      → (없으면) [Render → MongoDB]
```

| 대상 | CDN 효과 |
|------|----------|
| HTML·CSS·JS | **큼** |
| 이미지 (thumb.jpg, cover.jpg 등) | 브라우저 캐시(7일) + CDN **일부** |
| MongoDB·코드 구조 | **변경 없음** |

---

## 적용 전 확인

| 항목 | 확인 |
|------|------|
| Cloudflare | 가입 완료 (dash.cloudflare.com) |
| 사이트 운영 | Render (`www.thejohn.co.kr`) |
| DNS | 가비아에서 Render로 연결 중 |
| API | 같은 도메인 (`api-config.js` → `THEJHON_API_BASE_URL = ""`) |

---

## 1단계 — Cloudflare에 사이트 추가

1. [dash.cloudflare.com](https://dash.cloudflare.com) 로그인
2. **Add a site** → `thejohn.co.kr` 입력
3. 플랜: **Free** 선택
4. DNS 스캔 결과 확인 후 Continue

---

## 2단계 — 가비아 DNS를 Cloudflare로 넘기기

Cloudflare가 안내하는 **네임서버 2개** (예: `xxx.ns.cloudflare.com`)를 복사합니다.

**가비아 (My가비아 → 도메인 → DNS/네임서버)**

1. **네임서버 변경** → Cloudflare 네임서버 2개 입력
2. 저장

전파: **30분~24시간** (보통 1~2시간).

> 네임서버만 Cloudflare로 바꿉니다. **도메인 등록(가비아 결제)은 그대로** 가비아에 둬도 됩니다.

---

## 3단계 — Cloudflare DNS에 Render 연결

Cloudflare **DNS → Records**에서 Render 대시보드 **Custom Domains** 안내와 맞춥니다.

| 타입 | 이름 | 내용 | 프록시 |
|------|------|------|--------|
| CNAME | `www` | `xxxx.onrender.com` (Render 안내값) | **Proxied (주황 구름)** |
| A 또는 CNAME | `@` (루트) | Render 안내값 | **Proxied** |

- **주황 구름 ON** = CDN·캐시 사용 (이번 목적)
- 회색 구름 = CDN 없음 (쓰지 않음)

Render 쪽에도 `thejohn.co.kr`, `www.thejohn.co.kr` **Custom Domain** 등록은 **그대로** 유지합니다.

---

## 4단계 — SSL 설정

Cloudflare **SSL/TLS → Overview**

- **Full (strict)** 권장
  - 방문자 ↔ Cloudflare: HTTPS
  - Cloudflare ↔ Render: HTTPS (Render 인증서 사용)

**Edge Certificates**: Always Use HTTPS **ON**  
**SSL/TLS → Edge Certificates → Automatic HTTPS Rewrites** **ON**

5~10분 후 `https://www.thejohn.co.kr/api/health` 로 확인합니다.

---

## 5단계 — 캐시 규칙 (무료 플랜)

**Caching → Cache Rules** → Create rule

### 규칙 1 — 정적 파일 (효과 큼)

- **If:** URI Path ends with `.js` OR `.css` OR `.html` OR `.woff2` OR `.png` OR `.ico`
- **Then:** Cache eligibility = Eligible for cache, Edge TTL = 1 day 이상

### 규칙 2 — 상품 이미지 API (선택)

- **If:** URI Path contains `/api/products/` AND ends with `.jpg`
- **Then:** Edge TTL = 7 days (서버 `Cache-Control: 7일`과 맞춤)

**회사소개 이미지:** `/api/auth/company-intro/` + `.jpg` 도 같은 방식으로 추가 가능.

---

## 6단계 — 동작 확인

1. `https://www.thejohn.co.kr` 접속·로그인
2. 사업부문 → 상품 상세
3. Cloudflare **Caching → Overview** 에서 요청 수 증가 확인
4. 개발자 도구 → Network → 이미지 요청 **Response Headers**
   - `cf-cache-status: HIT` → CDN에서 제공
   - `MISS` → 첫 요청(정상), 이후 HIT 가능

---

## 비용

| 항목 | 예상 |
|------|------|
| Cloudflare Free | **0원** |
| Render·Atlas | **기존과 동일** |
| R2 | **사용 안 함** |

---

## 알아두실 점 (이미지 CDN)

지금 이미지 URL에 로그인용 `?access=JWT` 가 붙습니다.

```
/api/products/pr_xxx/thumb.jpg?access=eyJhbG...
```

| 상황 | 설명 |
|------|------|
| 같은 사용자·같은 토큰으로 재방문 | CDN·브라우저 캐시 효과 **있음** |
| 사용자마다 URL이 다름 | 전역 공유 캐시는 **잘 안 됨** |
| 정적 파일·재방문 | 체감 개선 **큼** |

나중에 코드만 조금 바꿔 **쿠키 인증 + URL에 토큰 없음**으로 가면 이미지 CDN 효과가 더 커집니다. (별도 작업, 지금 필수 아님)

---

## 적용 순서 요약

```
1. Cloudflare에 thejohn.co.kr 추가
2. 가비아 네임서버 → Cloudflare로 변경
3. DNS: www / @ → Render (주황 구름 ON)
4. SSL Full (strict)
5. 정적 파일·jpg 캐시 규칙
6. 사이트·이미지·로그인 테스트
```

---

## 문제 생기면

| 증상 | 조치 |
|------|------|
| 사이트 안 열림 | DNS 전파 대기, Render Custom Domain 재확인 |
| SSL 오류 | SSL 모드를 Full (strict)로, Render 도메인 Verified 확인 |
| 로그인 실패 | `ALLOWED_ORIGINS`에 `https://www.thejohn.co.kr` 포함 여부 |
| 이미지 안 보임 | `cf-cache-status` 확인, 규칙이 API를 막지 않는지 확인 |

---

## R2 없이 그다음에 할 수 있는 것 (CDN 다음)

| 순서 | 내용 | 효과 |
|------|------|------|
| 1 | **CDN** (위 가이드) | 정적·재방문 빠름 |
| 2 | 업로드 시 JPEG 완성 저장 (요청 때 sharp 제거) | DB·CPU 부담 감소 |
| 3 | Atlas·Render **같은 리전** | DB 읽기 지연 감소 |

---

## 현재 이미지 구조 참고 (R2 제외)

지금 홈페이지는 MongoDB에 base64 저장 + Node가 `thumb.jpg` / `cover.jpg` 로 JPEG 제공합니다.

| 이미 잘 된 것 | 아직 병목 |
|--------------|-----------|
| 목록 API에 이미지 제외 | MongoDB에 이미지 본문 |
| img src 병렬 로드 | 캐시 미스 시 DB + sharp |
| 상세 cover 직접 로드 | Render 재시작 시 메모리 캐시 초기화 |
| Cache-Control 7일 | CDN 없으면 매번 서버 왕복 |

**“이론상 최고속”은 아니지만**, R2 없이는 **CDN + (선택) 업로드 시 JPEG 고정** 조합이 비용 대비 효과가 큽니다.

---

## 저장소·관련 파일

- GitHub: https://github.com/hanbaedal/thejohn
- 배포 문서: `deploy/DEPLOY-GABIA.md`
- API 설정: `api-config.js`
