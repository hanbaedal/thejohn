# 한글 PDF 폰트

배포·시작 시 `npm run postinstall` / `node scripts/ensure-pdf-font.js` 가 `NotoSansKR-Regular.ttf` 를 이 폴더에 받습니다.

수동으로 넣을 때: `NotoSansKR-Regular.ttf`, `NanumGothic.ttf`, `NotoSansCJKkr-Regular.otf` 등

환경 변수 `PDF_FONT_PATH` 로 다른 TTF/OTF 경로를 지정할 수 있습니다.

Windows 로컬은 `malgun.ttf` 도 자동 탐색합니다(폰트 파일이 없을 때).
