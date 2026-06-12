# Cloudflare R2 이미지 저장 — thejohn.co.kr

상품 썸네일·커버, 회사소개 이미지를 **JPEG 고정** 후 **R2**에 저장합니다.  
`R2_PUBLIC_BASE_URL`을 설정하면 브라우저가 **CDN에서 직접** 이미지를 받아 MongoDB·Render 경유가 줄어듭니다.

---

## 동작 요약

| 단계 | 내용 |
|------|------|
| 저장 | 상품·회사소개 수정 시 JPEG → R2 업로드, MongoDB에는 키만 저장 |
| 조회 | R2 키 있으면 302(CDN) 또는 R2에서 스트리밍 |
| 기존 데이터 | 서버 기동 시 배치 이전 + `npm run migrate-images-to-r2` 수동 실행 |

---

## 1. Cloudflare R2 버킷

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → 버킷 **`thejohn`** (이미 생성됨)
2. **Settings** → **Public access** (또는 Custom Domain)
   - **R2.dev subdomain** 사용 시 URL 예: `https://pub-xxxx.r2.dev`
   - **Custom Domain** 권장: `https://cdn.thejohn.co.kr` (아래 CDN 가이드와 연동)

---

## 2. API 토큰

1. R2 → **Manage R2 API Tokens** → **Create API Token**
2. 권한: Object Read & Write (버킷 `thejohn`)
3. **Account ID**, **Access Key ID**, **Secret Access Key** 복사

---

## 3. Render 환경 변수

Render 대시보드 → 서비스 → **Environment**:

| 변수 | 예시 |
|------|------|
| `R2_ACCOUNT_ID` | Cloudflare 계정 ID |
| `R2_ACCESS_KEY_ID` | API 토큰 Access Key |
| `R2_SECRET_ACCESS_KEY` | API 토큰 Secret |
| `R2_BUCKET_NAME` | `thejohn` |
| `R2_PUBLIC_BASE_URL` | `https://cdn.thejohn.co.kr` 또는 `https://pub-xxxx.r2.dev` |

저장 후 **재배포**합니다.

---

## 4. 로컬 개발 (.env)

프로젝트 루트 `.env`에 위 변수를 동일하게 넣습니다.  
`.env.example` 참고.

---

## 5. 기존 이미지 일괄 이전 (속도 — **권장**)

R2에 이미지가 없으면 Render·MongoDB 경유로 **느립니다**. 아래를 한 번 실행하면 `img.thejohn.co.kr`에서 바로 로드됩니다.

**Render Shell** (대시보드 → thejohn → Shell):

```bash
cd server && npm run migrate-images-to-r2
```

완료까지 수 분~수십 분(상품 수에 따라). 로그에 `products: N` 이 0이 될 때까지 반복 실행해도 됩니다.

로컬:

```bash
cd server
npm run migrate-images-to-r2
```

---

## 6. CDN (권장)

`R2_PUBLIC_BASE_URL`을 **Custom Domain**으로 두면 Cloudflare 엣지 캐시가 적용됩니다.  
DNS·프록시 설정은 [CLOUDFLARE-CDN.md](./CLOUDFLARE-CDN.md)를 따릅니다.

---

## 7. 확인

1. `GET https://www.thejohn.co.kr/api/health` → `imageCdnBase` 필드에 CDN URL
2. 상품 목록·상세에서 이미지 URL이 `cdn.../products/.../thumb-0.jpg` 형태
3. 회사소개: `.../staff/{staffId}/intro-0.jpg`

R2 변수가 없으면 기존처럼 `/api/products/.../thumb.jpg` 경로를 사용합니다 (호환 유지).

---

## 비용·주의

- R2 저장·Class A/B 요청은 Cloudflare 요금제 기준 (일반 쇼핑몰 규모는 소액)
- MongoDB 문서 크기·API 응답 시간이 크게 줄어듭니다
- 이미지 URL에 `?access=JWT`를 붙이지 않는 CDN 직링크는 **캐시 공유에 유리**합니다 (공개 상품 이미지 전제)
