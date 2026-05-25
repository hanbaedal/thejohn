/**
 * 주문서 PDF 한글 폰트 — 배포 시 server/fonts/ 에 없으면 다운로드
 */
const fs = require("fs");
const https = require("https");
const path = require("path");

const fontsDir = path.join(__dirname, "..", "fonts");
const dest = path.join(fontsDir, "NotoSansKR-Regular.ttf");
const SOURCES = [
    "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf",
    "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@Sans2.004/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf"
];

function download(url) {
    return new Promise(function (resolve, reject) {
        var req = https.get(
            url,
            { headers: { "User-Agent": "thejhon-homepage-pdf-font/1.0" } },
            function (res) {
                if (
                    res.statusCode &&
                    res.statusCode >= 300 &&
                    res.statusCode < 400 &&
                    res.headers.location
                ) {
                    res.resume();
                    return download(res.headers.location).then(resolve, reject);
                }
                if (res.statusCode !== 200) {
                    res.resume();
                    return reject(new Error("HTTP " + res.statusCode + " " + url));
                }
                var chunks = [];
                res.on("data", function (c) {
                    chunks.push(c);
                });
                res.on("end", function () {
                    resolve(Buffer.concat(chunks));
                });
            }
        );
        req.on("error", reject);
        req.setTimeout(120000, function () {
            req.destroy(new Error("timeout " + url));
        });
    });
}

async function main() {
    var alt = path.join(fontsDir, "NanumGothic.ttf");
    if (
        (fs.existsSync(dest) && fs.statSync(dest).size > 500000) ||
        (fs.existsSync(alt) && fs.statSync(alt).size > 500000)
    ) {
        console.log("[ensure-pdf-font] OK (exists)", fs.existsSync(dest) ? dest : alt);
        return;
    }
    var fromEnv = String(process.env.PDF_FONT_PATH || "").trim();
    if (fromEnv && fs.existsSync(fromEnv)) {
        console.log("[ensure-pdf-font] OK (PDF_FONT_PATH)", fromEnv);
        return;
    }

    fs.mkdirSync(fontsDir, { recursive: true });
    var lastErr = null;
    for (var i = 0; i < SOURCES.length; i++) {
        try {
            console.log("[ensure-pdf-font] downloading…", SOURCES[i]);
            var buf = await download(SOURCES[i]);
            if (!buf || buf.length < 200000) {
                throw new Error("file too small (" + (buf ? buf.length : 0) + " bytes)");
            }
            var out = dest;
            if (SOURCES[i].indexOf(".otf") !== -1) {
                out = path.join(fontsDir, "NotoSansCJKkr-Regular.otf");
            }
            fs.writeFileSync(out, buf);
            console.log("[ensure-pdf-font] saved", out, "(" + buf.length + " bytes)");
            return;
        } catch (e) {
            lastErr = e;
            console.warn("[ensure-pdf-font] failed:", SOURCES[i], e.message);
        }
    }
    console.error(
        "[ensure-pdf-font] 한글 폰트를 받지 못했습니다. PDF 한글이 깨질 수 있습니다.",
        lastErr ? lastErr.message : ""
    );
    process.exitCode = 1;
}

main();
