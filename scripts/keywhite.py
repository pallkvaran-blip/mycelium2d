#!/usr/bin/env python3
# Key out a plain white/grey background from a generated sprite, locally.
#
#   keywhite.py <in.png> <out.png> [transp=0.80] [opaque=0.62] [maxdim=512]
#
# Background = bright AND desaturated (white + soft grey drop-shadow); foreground
# (dark shapes, saturated bioluminescent glows) is kept. Uses bg = value*(1-sat)
# so bright-but-saturated cyan glow survives while white/grey is removed. Then
# crops to the opaque bbox and downsizes so the sprite is tight and light.
import sys
from PIL import Image

inp, outp = sys.argv[1], sys.argv[2]
TR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.70   # bg-ness >= TR -> transparent
OP = float(sys.argv[4]) if len(sys.argv) > 4 else 0.54   # bg-ness <= OP -> opaque
MAX = int(sys.argv[5]) if len(sys.argv) > 5 else 512

im = Image.open(inp).convert("RGBA")
if max(im.size) > MAX:
    s = MAX / max(im.size)
    im = im.resize((round(im.size[0] * s), round(im.size[1] * s)), Image.LANCZOS)

px = im.load()
W, H = im.size
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        mx = max(r, g, b)
        mn = min(r, g, b)
        v = mx / 255.0
        sat = 0.0 if mx == 0 else (mx - mn) / mx
        bg = v * (1.0 - sat)               # ~1 for white/grey, low for dark or saturated
        if bg >= TR:
            al = 0
        elif bg <= OP:
            al = 255
        else:
            al = int(255 * (TR - bg) / (TR - OP))
        px[x, y] = (r, g, b, 0) if al == 0 else (r, g, b, al)

bbox = im.getchannel("A").getbbox()
if bbox:
    im = im.crop(bbox)
im.save(outp)
print("keyed", im.size)
