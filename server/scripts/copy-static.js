/**
 * Render 배포: server/ 루트에서도 HTML·JS·CSS 사용 가능하도록 public/ 에 복사
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..");
const dest = path.resolve(__dirname, "../public");
const SKIP = new Set([
    "server",
    "node_modules",
    ".git",
    "deploy",
    ".github",
    ".vscode",
    "public"
]);
const EXT = new Set([".html", ".js", ".css"]);

function shouldCopy(name) {
    return EXT.has(path.extname(name).toLowerCase());
}

function copyFrom(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
        if (SKIP.has(name)) continue;
        const srcPath = path.join(src, name);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
            copyFrom(srcPath, path.join(dst, name));
        } else if (stat.isFile() && shouldCopy(name)) {
            fs.copyFileSync(srcPath, path.join(dst, name));
        }
    }
}

if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
}
copyFrom(repoRoot, dest);
console.log("[copy-static] OK →", dest);
