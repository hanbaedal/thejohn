#!/usr/bin/env python3
"""카탈로그·인쇄물용 더존 홈페이지 QR 코드 생성 (일반·로고 중앙)."""
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
LOGO = IMG / "logo.png"
FILL = "#052a4d"

# (파일명, URL, 설명)
VARIANTS = [
    ("qr-thejohn-catalog.png", "https://thejohn.co.kr/", "홈페이지"),
    ("qr-thejohn-products.png", "https://thejohn.co.kr/products.html", "상품 카탈로그"),
    ("qr-thejohn-login.png", "https://thejohn.co.kr/login.html", "로그인"),
]


def make_qr_image(url: str, box_size: int = 32) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=box_size,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color=FILL, back_color="white").convert("RGB")


def overlay_logo(qr_img: Image.Image, logo_path: Path) -> Image.Image:
    """QR 중앙에 로고 + 흰 배경 패드 (스캔 가능하도록 약 22% 크기)."""
    out = qr_img.copy()
    w, h = out.size
    logo_max = int(min(w, h) * 0.22)
    pad = int(logo_max * 0.18)

    logo = Image.open(logo_path).convert("RGBA")
    lw, lh = logo.size
    scale = logo_max / max(lw, lh)
    new_w, new_h = int(lw * scale), int(lh * scale)
    logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)

    plate_w = new_w + pad * 2
    plate_h = new_h + pad * 2
    plate = Image.new("RGBA", (plate_w, plate_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(plate)
    radius = max(4, pad // 2)
    draw.rounded_rectangle((0, 0, plate_w - 1, plate_h - 1), radius=radius, fill=(255, 255, 255, 255))
    plate.paste(logo, (pad, pad), logo)

    cx, cy = w // 2, h // 2
    out.paste(plate, (cx - plate_w // 2, cy - plate_h // 2), plate)
    return out


def save_pair(url: str, base_name: str, label: str, box_size: int = 32) -> None:
    plain = make_qr_image(url, box_size)
    plain_path = IMG / base_name
    plain.save(plain_path, dpi=(300, 300))
    print(f"  {plain_path.name}  {plain.size[0]}×{plain.size[1]}px  →  {url}  ({label})")

    if LOGO.is_file():
        stem = Path(base_name).stem
        branded_name = f"{stem}-logo.png"
        branded = overlay_logo(plain, LOGO)
        branded_path = IMG / branded_name
        branded.save(branded_path, dpi=(300, 300))
        print(f"  {branded_path.name}  (로고 중앙)")


def main() -> None:
    IMG.mkdir(parents=True, exist_ok=True)
    print("카탈로그용 QR 코드 생성:")
    if not LOGO.is_file():
        print(f"  경고: 로고 없음 — {LOGO}")
    for filename, url, label in VARIANTS:
        save_pair(url, filename, label)


if __name__ == "__main__":
    main()
