"""HTML head의 auth-storage.js에 캐시 버스팅 쿼리 추가"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = 'src="auth-storage.js"'
NEW = 'src="auth-storage.js?v=20260619-public-gate"'
count = 0
for path in ROOT.glob("*.html"):
    text = path.read_text(encoding="utf-8")
    if OLD in text and NEW not in text:
        path.write_text(text.replace(OLD, NEW), encoding="utf-8")
        count += 1
        print(path.name)
print("updated", count)
