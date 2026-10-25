"""Generate the catotag icon set from the wordmark ("cato" white + "tag" lime on the app's dark background).

Requires Pillow and the Inter variable font (SIL Open Font License):
https://github.com/google/fonts/tree/main/ofl/inter

Usage: python make_icons.py <path to Inter[opsz,wght].ttf> frontend/public
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT_PATH, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

BG = (7, 9, 13, 255)          # ink-950, page background
WHITE = (244, 246, 250, 255)  # body text color
LIME = (198, 244, 50, 255)    # accent
SUPERSAMPLE = 4


def font(size):
    f = ImageFont.truetype(FONT_PATH, size)
    f.set_variation_by_name("ExtraBold")
    return f


def canvas(size, rounded):
    """Square background; rounded corners (transparent outside) or full bleed."""
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if rounded:
        draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.22), fill=BG)
    else:
        draw.rectangle([0, 0, big, big], fill=BG)
    return img, draw


def fit_font(lines, max_w, max_h, gap_ratio):
    """Largest font size where the stacked lines fit in max_w x max_h (ink bounds)."""
    size = 10
    while True:
        f = font(size + 2)
        boxes = [f.getbbox(t) for t, _ in lines]
        w = max(b[2] - b[0] for b in boxes)
        h = sum(b[3] - b[1] for b in boxes) + gap_ratio * size * (len(lines) - 1)
        if w > max_w or h > max_h:
            return font(size)
        size += 2


def draw_lines(img, draw, lines, box_w, box_h, gap_ratio, tracking=0.0):
    big = img.width
    f = fit_font(lines, box_w * big, box_h * big, gap_ratio)
    gap = gap_ratio * f.size
    boxes = [f.getbbox(t) for t, _ in lines]
    total_h = sum(b[3] - b[1] for b in boxes) + gap * (len(lines) - 1)
    y = (big - total_h) / 2
    for (text, color), b in zip(lines, boxes):
        w = b[2] - b[0]
        x = (big - w) / 2
        draw.text((x - b[0], y - b[1]), text, font=f, fill=color)
        y += (b[3] - b[1]) + gap


def wordmark(size, rounded, box_w, box_h):
    img, draw = canvas(size, rounded)
    draw_lines(img, draw, [("cato", WHITE), ("tag", LIME)], box_w, box_h, gap_ratio=0.16)
    return img.resize((size, size), Image.LANCZOS)


def monogram(size):
    """'ct' for tiny favicons where the full word cannot be read."""
    img, draw = canvas(size, rounded=True)
    big = img.width
    f = fit_font([("ct", WHITE)], 0.74 * big, 0.62 * big, 0)
    bc, bt = f.getbbox("c"), f.getbbox("t")
    full = f.getbbox("ct")
    x0 = (big - (full[2] - full[0])) / 2 - full[0]
    y0 = (big - (full[3] - full[1])) / 2 - full[1]
    draw.text((x0, y0), "c", font=f, fill=WHITE)
    draw.text((x0 + f.getlength("c"), y0), "t", font=f, fill=LIME)
    return img.resize((size, size), Image.LANCZOS)


# Home screen / install icons
wordmark(180, rounded=False, box_w=0.66, box_h=0.58).convert("RGB").save(OUT / "apple-touch-icon.png", optimize=True)
for s in (192, 512):
    wordmark(s, rounded=True, box_w=0.70, box_h=0.60).save(OUT / f"android-chrome-{s}x{s}.png", optimize=True)
# Maskable: content inside the central safe circle (radius 40%)
wordmark(512, rounded=False, box_w=0.56, box_h=0.46).save(OUT / "maskable-512x512.png", optimize=True)

# Browser tab icons
for s in (16, 32):
    monogram(s).save(OUT / f"favicon-{s}x{s}.png", optimize=True)
monogram(256).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

print("written:", sorted(p.name for p in OUT.iterdir()))
