#!/usr/bin/env python3
# Softly blend the bottom of a rock cutout into the soil. A SHORT, SMOOTH dissolve — not a
# hard jaggy cutoff (looks "too sharp") and not a tall linear fade (washes out the whole
# bottom). Uses a smoothstep curve (no visible start-line) over the bottom (1-start) of the
# sprite, plus a mild alpha blur so the edge reads soft. Usage: feather_bottom.py IN OUT [start]
import sys
from PIL import Image, ImageFilter

def feather(src, dest, start_frac=0.84, blur=1.5):
    im = Image.open(src).convert("RGBA"); w, h = im.size
    r, g, b, a = im.split()
    if blur:
        a = a.filter(ImageFilter.GaussianBlur(blur))
    ap = a.load()
    start = int(h * start_frac)
    for y in range(start, h):
        t = (y - start) / max(1, (h - start))
        s = t * t * (3 - 2 * t)                 # smoothstep -> gentle, no hard start-line
        fac = 1.0 - s
        for x in range(w):
            ap[x, y] = int(ap[x, y] * fac)
    Image.merge("RGBA", (r, g, b, a)).save(dest, "PNG")

if __name__ == "__main__":
    src = sys.argv[1]; dest = sys.argv[2]
    start = float(sys.argv[3]) if len(sys.argv) > 3 else 0.84
    feather(src, dest, start)
    print(f"soft-blended {src} -> {dest} (start={start})")
