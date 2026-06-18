"""HTML head: public-site-config.js + auth-storage 캐시 버스팅"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = '    <script src="auth-storage.js?v=20260619-public-gate"></script>'
NEW = (
    '    <script src="public-site-config.js?v=20260620"></script>\n'
    '    <script src="auth-storage.js?v=20260620-public"></script>'
)
count = 0
for path in ROOT.glob("*.html"):
    text = path.read_text(encoding="utf-8")
    if "public-site-config.js" in text:
        continue
    if OLD in text:
        path.write_text(text.replace(OLD, NEW), encoding="utf-8")
        count += 1
        print(path.name)
print("updated", count)
