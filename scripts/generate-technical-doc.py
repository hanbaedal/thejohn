# -*- coding: utf-8 -*-
"""docs/ARCHITECTURE.md → thejohn-system-technical.docx (기술 구조 Word)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from md_to_docx import build_from_markdown  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
SRC = os.path.join(DOCS, "ARCHITECTURE.md")
OUT = os.path.join(DOCS, "thejohn-system-technical.docx")


def main():
    os.makedirs(DOCS, exist_ok=True)
    if not os.path.isfile(SRC):
        raise SystemExit("Missing " + SRC)
    build_from_markdown(
        SRC,
        OUT,
        doc_title="더존(thejohn) 기술 구조 설명서",
        source_note="원본: docs/ARCHITECTURE.md",
    )
    print("Technical doc:", OUT)


if __name__ == "__main__":
    main()
