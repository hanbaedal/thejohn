# -*- coding: utf-8 -*-
"""deploy/*.md → docs/thejohn-deploy-*.docx (배포·운영 가이드 Word)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from md_to_docx import build_from_markdown  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPLOY = os.path.join(ROOT, "deploy")
DOCS = os.path.join(ROOT, "docs")

DEPLOY_GUIDES = [
    (
        "DEPLOY-GABIA.md",
        "thejohn-deploy-gabia.docx",
        "더존(thejohn) 가비아 DNS·Render 배포",
    ),
    (
        "RENDER-FIX.md",
        "thejohn-deploy-render.docx",
        "더존(thejohn) Render 배포 설정",
    ),
    (
        "MONGODB-FIX.md",
        "thejohn-deploy-mongodb.docx",
        "더존(thejohn) MongoDB 연결",
    ),
    (
        "LOGIN-PERMISSIONS.md",
        "thejohn-deploy-login-permissions.docx",
        "더존(thejohn) 로그인·권한",
    ),
    (
        "STAFF-ACCOUNTS.md",
        "thejohn-deploy-staff-accounts.docx",
        "더존(thejohn) 직원 계정",
    ),
    (
        "VENDOR-REGISTRATION.md",
        "thejohn-deploy-vendor-registration.docx",
        "더존(thejohn) 업체 등록",
    ),
    (
        "CLOUDFLARE-CDN.md",
        "thejohn-deploy-cloudflare-cdn.docx",
        "더존(thejohn) Cloudflare CDN 적용",
    ),
]


def main():
    os.makedirs(DOCS, exist_ok=True)
    for md_name, out_name, title in DEPLOY_GUIDES:
        src = os.path.join(DEPLOY, md_name)
        if not os.path.isfile(src):
            raise SystemExit("Missing " + src)
        out = os.path.join(DOCS, out_name)
        build_from_markdown(
            src,
            out,
            doc_title=title,
            source_note="원본: deploy/" + md_name,
        )
        print("Deploy doc:", out)


if __name__ == "__main__":
    main()
