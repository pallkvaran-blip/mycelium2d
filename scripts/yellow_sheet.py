#!/usr/bin/env python3
# Labeled comparison sheet of ALL yellow leaf options on dark soil, so the owner
# can pick which go into the duff pile. Marks the 5 currently-in-piles ones.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
OPT = ROOT / "assets" / "leaf_options"
OUT = "/tmp/claude-0/-home-user-mycelium2d/e43b2131-64d6-51a4-b68f-76b2b5524080/scratchpad/yellow_options.png"

# (file, label, in_piles_now)
ITEMS = [
  ("yellow_ginkgo.png",  "Ginkgo",      True),
  ("yellow_maple.png",   "Maple",       True),
  ("yellow_poplar.png",  "Poplar",      True),
  ("yellow_aspen.png",   "Aspen",       True),
  ("yellow_elm.png",     "Elm",         True),
  ("yellow_birch.png",   "Birch",       False),
  ("yellow_hickory.png", "Hickory",     False),
  ("yellow6_cottonwood.png", "Cottonwood", False),
  ("yellow6_sycamore.png",   "Sycamore",   False),
  ("yellow6_willow.png",     "Willow",     False),
  ("yellow6_katsura.png",    "Katsura",    False),
  ("yellow6_hazel.png",      "Hazel",      False),
  ("yellow6_linden.png",     "Linden",     False),
]

def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(p).exists():
            return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

COLS = 4
CW, CH = 300, 300
LABEL_H = 46
rows = (len(ITEMS) + COLS - 1) // COLS
W, H = COLS * CW, rows * CH
sheet = Image.new("RGBA", (W, H), (58, 42, 30, 255))   # dark soil brown
d = ImageDraw.Draw(sheet)
f = font(30); fs = font(20)
for i, (fn, label, now) in enumerate(ITEMS):
    cx = (i % COLS) * CW
    cy = (i // COLS) * CH
    # cell background: slightly lighter for current pile members
    d.rectangle([cx+4, cy+4, cx+CW-4, cy+CH-4], fill=(70,52,36,255) if now else (52,38,28,255),
                outline=(120,200,140,255) if now else (90,74,56,255), width=3)
    p = OPT / fn
    if p.exists():
        im = Image.open(p).convert("RGBA")
        im.thumbnail((CW-70, CH-LABEL_H-40))
        x = cx + (CW - im.width)//2
        y = cy + 14 + (CH-LABEL_H-40 - im.height)//2
        sheet.alpha_composite(im, (x, y))
    tag = label + ("  ✔ in piles" if now else "")
    col = (150,235,170,255) if now else (225,220,210,255)
    tw = d.textlength(tag, font=fs)
    d.text((cx + (CW-tw)//2, cy + CH - LABEL_H + 8), tag, font=fs, fill=col)
sheet.convert("RGB").save(OUT, "PNG")
print("wrote", OUT, "size", sheet.size)
