const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const bootTag = '    <script src="site-brand-boot.js"></script>\n';
const files = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let changed = 0;

for (const file of files) {
    const fp = path.join(root, file);
    let html = fs.readFileSync(fp, "utf8");
    const orig = html;

    if (!html.includes("site-brand-boot.js")) {
        html = html.replace(
            /(<meta name="viewport" content="width=device-width, initial-scale=1\.0">)\s*\n/,
            "$1\n" + bootTag
        );
    }

    html = html.replace(
        /\s*<link rel="icon" href="img\/icon-192\.png" sizes="192x192" type="image\/png">\s*\n/g,
        "\n"
    );
    html = html.replace(
        /\s*<link rel="apple-touch-icon" sizes="192x192" href="img\/icon-192\.png">\s*\n/g,
        "\n"
    );

    if (html !== orig) {
        fs.writeFileSync(fp, html, "utf8");
        changed++;
        console.log("updated", file);
    }
}

console.log("total", changed);
