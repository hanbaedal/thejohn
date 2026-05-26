/**
 * 모든 HTML의 site-footer 블록을 index.html 기준으로 통일합니다.
 * 사용: node scripts/sync-footer-html.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const canonical = `    <footer class="site-footer">
        <div class="site-footer-inner">
            <dl class="site-footer-grid">
                <div class="site-footer-item">
                    <dt>상호</dt>
                    <dd>(주)더존</dd>
                </div>
                <div class="site-footer-item">
                    <dt>대표</dt>
                    <dd>이상범</dd>
                </div>
                <div class="site-footer-item">
                    <dt>휴대폰</dt>
                    <dd><a class="footer-tel" href="tel:+821029288196">010-2928-8196</a></dd>
                </div>
                <div class="site-footer-item">
                    <dt>이메일</dt>
                    <dd><a href="mailto:leesb0129@daum.net">leesb0129@daum.net</a></dd>
                </div>
                <div class="site-footer-item">
                    <dt>전화</dt>
                    <dd><a class="footer-tel" href="tel:+82326665255">032-666-5255</a></dd>
                </div>
                <div class="site-footer-item">
                    <dt>팩스</dt>
                    <dd>032-662-5246</dd>
                </div>
                <div class="site-footer-item">
                    <dt>사업자등록번호</dt>
                    <dd>130-45-32935</dd>
                </div>
                <div class="site-footer-item site-footer-item--full">
                    <dt>주소</dt>
                    <dd>경기도 부천시 원미구 부천로 130번길 5, 삼도빌딩 1층</dd>
                </div>
            </dl>
        </div>
    </footer>`;

const re = /<footer class="site-footer">[\s\S]*?<\/footer>/;

let n = 0;
for (const name of fs.readdirSync(root)) {
    if (!name.endsWith(".html")) continue;
    const file = path.join(root, name);
    let html = fs.readFileSync(file, "utf8");
    if (!re.test(html)) continue;
    html = html.replace(re, canonical);
    fs.writeFileSync(file, html, "utf8");
    n++;
}
console.log("[sync-footer-html] updated", n, "files");
