#!/usr/bin/env python3
# Re-cut the troll rockface from an already-generated opaque JPG. The rock is DARK on a
# near-black bg, so the old RGB flood-fill (thresh 34) climbed from bg (lum ~8) up into
# the rock's facets (lum ~40) and ate a third of the body. Fix: flood-fill a BINARY
# mask (dark <= T vs lit) so the first lit facet is a hard wall; interior dark cracks that
# aren't reachable from the border stay solid; then fill any residual interior holes.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]

def luma(im):
    return im.convert("L")  # PIL L uses ITU-R 601-2 luma — good enough here

def dilate(mask, it):
    for _ in range(it):
        mask = mask.filter(ImageFilter.MaxFilter(5))
    return mask

def erode(mask, it):
    for _ in range(it):
        mask = mask.filter(ImageFilter.MinFilter(5))
    return mask

def cutout(src, dest, T=13, pad=8, feather=1.2, close=9):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    L = luma(im)
    lp = L.load()
    # binary foreground: 255 = lit rock (> T), 0 = dark (bg / crack / shadow)
    fg = Image.new("L", (w, h), 0)
    fp = fg.load()
    for y in range(h):
        for x in range(w):
            if lp[x, y] > T:
                fp[x, y] = 255
    # morphological CLOSE: dilate then erode by the same amount. This SEALS the crack
    # gaps that open to the rock edge (so brown soil can't show through) WITHOUT growing
    # the outer silhouette — a rock is a solid shape, its cracks are dark texture, not holes.
    fg = erode(dilate(fg, close), close)
    # "outside" = background reachable from the border through fg's 0-region. Everything
    # else (the rock and any enclosed gaps the close missed) stays opaque.
    work = fg.copy()
    seeds = [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2),
             (w // 2, 1), (w // 2, h - 2), (1, h // 2), (w - 2, h // 2)]
    SENT = 128
    for s in seeds:
        if work.load()[s[0], s[1]] == 0:
            ImageDraw.floodfill(work, s, SENT, thresh=0)
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load(); wp = work.load()
    for y in range(h):
        for x in range(w):
            if wp[x, y] == SENT:   # only the border-connected outside is transparent
                ap[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    bbox = out.getbbox()
    if bbox:
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(w, bbox[2] + pad), min(h, bbox[3] + pad))
        out = out.crop(bbox)
    out.save(dest, "PNG")
    # report interior transparency to catch leaks
    ow, oh = out.size
    op = out.load()
    x0, x1, y0, y1 = int(ow * .2), int(ow * .8), int(oh * .2), int(oh * .8)
    t = tot = 0
    for y in range(y0, y1, 3):
        for x in range(x0, x1, 3):
            tot += 1
            if op[x, y][3] < 40:
                t += 1
    print(f"{dest}: size={out.size} interior-transparent={t/tot:.3f}")

if __name__ == "__main__":
    n = sys.argv[1] if len(sys.argv) > 1 else "4"
    T = int(sys.argv[2]) if len(sys.argv) > 2 else 13
    src = ROOT / "assets" / "rock_options" / f"troll-r{n}.jpg"
    dest = ROOT / "assets" / "rock_options" / f"troll-r{n}.png"
    cutout(str(src), str(dest), T=T)
