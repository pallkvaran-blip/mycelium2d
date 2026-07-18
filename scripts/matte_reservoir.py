#!/usr/bin/env python3
# Turn one chosen reservoir OPTION (assets/reservoir_options/reservoir_opt_N.png)
# into the in-game sprite assets/reservoir.png: an elliptical alpha feather so the
# dark rectangular background fades to transparent and the water pocket blends into
# the surrounding soil (same idea as the matted lake art). Usage:
#     python3 scripts/matte_reservoir.py E      # letter A..F  (default F)
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OPTS = ROOT / "assets" / "reservoir_options"
DEST = ROOT / "assets" / "reservoir.png"

def main():
    letter = (sys.argv[1] if len(sys.argv) > 1 else "F").strip().upper()
    idx = ord(letter) - 65
    src = OPTS / f"reservoir_opt_{idx}.png"
    if not src.exists():
        print(f"missing {src}"); sys.exit(1)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    # Elliptical feather: fully opaque out to ~72% of each half-axis, then a soft
    # gaussian falloff to transparent at the frame edge — so corners/background drop
    # out and only the pocket (rim + water) reads, edges blending into the earth.
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    mx, my = w * 0.06, h * 0.06                 # inset the opaque ellipse a touch from the frame
    d.ellipse([mx, my, w - mx, h - my], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.06))
    im.putalpha(mask)
    im.save(DEST, "PNG")
    print(f"OK {letter} -> {DEST} ({DEST.stat().st_size // 1024}KB, {w}x{h})")

if __name__ == "__main__":
    main()
