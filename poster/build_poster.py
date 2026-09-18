#!/usr/bin/env python3
"""Compose light A4 print poster for Nitro Sumo and emit PDF."""

from pathlib import Path

import img2pdf
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ART = ROOT / "art.png"
LOGO = ROOT / "Nitrowise New Logo_Nitrowise_Blue_text_40.png"
OUT_PNG = ROOT / "nitro-sumo-poster-a4.png"
OUT_PDF = ROOT / "nitro-sumo-poster-a4.pdf"

# A4 at 300 DPI
DPI = 300
W = int(210 / 25.4 * DPI)  # 2480
H = int(297 / 25.4 * DPI)  # 3508

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_COND = "/usr/share/fonts/truetype/ubuntu/Ubuntu-C.ttf"

INK = "#1a2330"
MUTED = "#4a5566"
RULE_BLUE = "#3d8fd4"
RULE_RED = "#e25555"
PAPER = (244, 241, 236)
BAND = (236, 232, 226)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def fit_cover(img: Image.Image, tw: int, th: int) -> Image.Image:
    iw, ih = img.size
    scale = max(tw / iw, th / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def draw_centered(draw: ImageDraw.ImageDraw, text: str, y: int, fnt, fill, stroke=0, stroke_fill=None):
    bbox = draw.textbbox((0, 0), text, font=fnt, stroke_width=stroke)
    tw = bbox[2] - bbox[0]
    x = (W - tw) // 2
    draw.text((x, y), text, font=fnt, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
    return bbox[3] - bbox[1]


def main() -> None:
    base = fit_cover(Image.open(ART).convert("RGB"), W, H)

    # Soft paper wash on top and bottom so type stays crisp when printed
    overlay = Image.new("RGB", (W, H), PAPER)
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    md.rectangle((0, 0, W, int(H * 0.36)), fill=210)
    md.rectangle((0, int(H * 0.84), W, H), fill=190)
    mask = mask.filter(ImageFilter.GaussianBlur(70))
    base = Image.composite(Image.blend(base, overlay, 0.72), base, mask)

    draw = ImageDraw.Draw(base)

    title_f = font(FONT_BOLD, 176)
    sub_f = font(FONT_REG, 48)
    rule_f = font(FONT_COND if Path(FONT_COND).exists() else FONT_REG, 44)
    small_f = font(FONT_REG, 34)

    y = int(H * 0.07)
    y += draw_centered(draw, "NITRO SUMO", y, title_f, INK) + 22

    bar_w, bar_h = 420, 10
    bx = (W - bar_w * 2 - 24) // 2
    draw.rounded_rectangle((bx, y, bx + bar_w, y + bar_h), radius=4, fill=RULE_BLUE)
    draw.rounded_rectangle((bx + bar_w + 24, y, bx + bar_w * 2 + 24, y + bar_h), radius=4, fill=RULE_RED)
    y += 46

    for line in (
        "Két korong. Zsugorodó aréna.",
        "Lökd le az ellenfelet a pályáról.",
    ):
        y += draw_centered(draw, line, y, sub_f, MUTED) + 12

    band_top = int(H * 0.86)
    draw.rectangle((0, band_top, W, H), fill=BAND)
    draw.line((int(W * 0.12), band_top, int(W * 0.88), band_top), fill=RULE_BLUE, width=3)
    draw.line((int(W * 0.12), band_top + 4, int(W * 0.88), band_top + 4), fill=RULE_RED, width=3)

    y = band_top + 36
    y += draw_centered(draw, "2 játékos  ·  1 gép  ·  60 másodperc", y, rule_f, INK) + 18
    y += draw_centered(
        draw,
        "Mozgás: D-pad   ·   Lökés: B   ·   Horgony: A   ·   Új kör: START",
        y,
        small_f,
        MUTED,
    ) + 22

    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA")
        # Wide wordmark: size by width for light footer
        lw = 980
        lh = int(logo.height * (lw / logo.width))
        logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
        lx = (W - lw) // 2
        ly = H - lh - 48
        base.paste(logo, (lx, ly), logo)

    base.save(OUT_PNG, "PNG", dpi=(DPI, DPI))

    a4_pts = (img2pdf.mm_to_pt(210), img2pdf.mm_to_pt(297))
    layout = img2pdf.get_layout_fun(a4_pts)
    with open(OUT_PDF, "wb") as f:
        f.write(img2pdf.convert(str(OUT_PNG), layout_fun=layout))

    print(f"Wrote {OUT_PNG}")
    print(f"Wrote {OUT_PDF} ({W}x{H} px @ {DPI} DPI)")


if __name__ == "__main__":
    main()
