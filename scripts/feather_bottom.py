#!/usr/bin/env python3
# Fade the bottom N% of a cutout's alpha to transparent so a rock's flat base dissolves
# into the soil instead of sitting on a hard edge. Usage: feather_bottom.py IN OUT [start]
import sys
from PIL import Image
def feather(src, dest, start_frac=0.70, ease=1.0):
    im = Image.open(src).convert("RGBA"); w, h = im.size
    r, g, b, a = im.split(); ap = a.load()
    start = int(h * start_frac)
    for y in range(start, h):
        t = (y - start) / max(1, (h - start)); fac = (1.0 - t) ** ease
        for x in range(w):
            ap[x, y] = int(ap[x, y] * fac)
    Image.merge("RGBA", (r, g, b, a)).save(dest, "PNG")
if __name__ == "__main__":
    src = sys.argv[1]; dest = sys.argv[2]
    start = float(sys.argv[3]) if len(sys.argv) > 3 else 0.70
    feather(src, dest, start)
    print(f"feathered {src} -> {dest} (start={start})")
