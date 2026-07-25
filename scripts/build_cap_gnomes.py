#!/usr/bin/env python3
# Build the two CAP-TOP gnome layers (g3/g4) for the Magic Mushroom portrait: nothing above
# the cap, then a gnome lifts its head up, looks around, and sinks back out of sight.
#
# No video model here, deliberately. Kling kept the heads up for the whole clip (no hidden
# phase) and re-rendered the caps; this instead animates the gnome painted in by
# add_cap_gnomes.py, so the result is exact:
#   * the gnome silhouette comes from diff(caps-up, original) — only pixels the inpaint
#     actually added, so no re-rendered background is ever drawn;
#   * that silhouette's BOTTOM CONTOUR is where the cap cut the gnome off, i.e. the cap's
#     own edge. Sliding the gnome down and clipping at that contour makes it sink behind the
#     cap along the right curve, and far enough down it vanishes completely;
#   * the layer therefore contains gnome pixels ONLY, so every other pixel of the photograph
#     is untouched — no seam is possible and there is no drift.
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SPECIES = ROOT / "assets" / "species"
ORIG = SPECIES / "psilocybe-cubensis.jpg"
UP = ROOT / "scratchpad" / "caps-up.jpg"        # heads-up plate from add_cap_gnomes.py

BOXES = {3: (213, 163, 289, 247), 4: (378, 208, 449, 282)}   # must match add_cap_gnomes.py
PHASE = {3: 0.0, 4: 0.5}          # fraction of the loop to offset, so they don't rise together
FPS, THRESH = 12, 40

# One loop: hidden, rise, hold (with a tiny bob), sink, hidden.
HIDDEN_A, RISE, HOLD, SINK, HIDDEN_B = 18, 8, 22, 8, 4      # frames @12fps -> 60 (5.0s)


def ease_out(t): return 1 - (1 - t) ** 3
def ease_in(t): return t ** 3


def clean(mask):
    """Close small holes, then keep only the largest blob."""
    m = mask
    for _ in range(2):
        m = m.filter(ImageFilter.MaxFilter(3))
    for _ in range(2):
        m = m.filter(ImageFilter.MinFilter(3))
    w, h = m.size
    work = m.point(lambda v: 255 if v > 127 else 0)
    px = work.load()
    best, seen = None, set()
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y] != 255 or (x, y) in seen:
                continue
            stack, blob = [(x, y)], []
            while stack:
                cx, cy = stack.pop()
                if not (0 <= cx < w and 0 <= cy < h) or (cx, cy) in seen or px[cx, cy] != 255:
                    continue
                seen.add((cx, cy)); blob.append((cx, cy))
                stack += [(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)]
            if best is None or len(blob) > len(best):
                best = blob
    out = Image.new("L", (w, h), 0)
    if best:
        op = out.load()
        for (cx, cy) in best:
            op[cx, cy] = 255
    return out


def bottom_contour(mask):
    """Per column, the lowest opaque row — the contour where the cap cuts the gnome off."""
    w, h = mask.size
    px = mask.load()
    col = []
    for x in range(w):
        b = -1
        for y in range(h - 1, -1, -1):
            if px[x, y] > 127:
                b = y; break
        col.append(b)
    return col


def main():
    if not UP.exists():
        print("missing scratchpad/caps-up.jpg — run scripts/add_cap_gnomes.py first"); sys.exit(1)
    orig = Image.open(ORIG).convert("RGB")
    up = Image.open(UP).convert("RGB")
    diff = ImageChops.difference(orig, up).convert("L")
    W, H = orig.size

    for n, box in BOXES.items():
        # --- gnome silhouette: only what the inpaint added, inside its box ---
        m = Image.new("L", (W, H), 0)
        m.paste(diff.crop(box).point(lambda v: 255 if v > THRESH else 0), (box[0], box[1]))
        m = clean(m)
        bb = m.getbbox()
        if not bb:
            print(f"g{n}: no gnome found"); sys.exit(2)
        gh = bb[3] - bb[1]
        col = bottom_contour(m)
        hide = gh + 8                      # slide far enough that nothing clears the contour

        # static clip: for each column, everything at or above that column's contour
        clip = Image.new("L", (W, H), 0)
        cd = ImageDraw.Draw(clip)
        for x, b in enumerate(col):
            if b >= 0:
                cd.line([(x, 0), (x, b)], fill=255)

        gn = up.copy()                     # RGB source for the gnome pixels

        offsets = ([hide] * HIDDEN_A
                   + [round(hide * (1 - ease_out((i + 1) / RISE))) for i in range(RISE)]
                   + [(-1 if HOLD // 2 <= i < HOLD // 2 + 4 else 0) for i in range(HOLD)]   # tiny bob
                   + [round(hide * ease_in((i + 1) / SINK)) for i in range(SINK)]
                   + [hide] * HIDDEN_B)
        k = int(PHASE[n] * len(offsets))
        offsets = offsets[k:] + offsets[:k]

        frames, hidden_frames = [], 0
        for dy in offsets:
            a = ImageChops.multiply(m.transform(m.size, Image.AFFINE, (1, 0, 0, 0, 1, -dy),
                                                resample=Image.BILINEAR), clip)
            a = a.filter(ImageFilter.GaussianBlur(0.7))
            if not a.getbbox():
                hidden_frames += 1
            rgb = gn.transform(gn.size, Image.AFFINE, (1, 0, 0, 0, 1, -dy), resample=Image.BICUBIC)
            keep = a.point(lambda v: 255 if v > 0 else 0)
            rgb = Image.composite(rgb, Image.new("RGB", (W, H), (0, 0, 0)), keep)
            f = rgb.convert("RGBA"); f.putalpha(a)
            frames.append(f)

        out = SPECIES / f"psilocybe-cubensis-g{n}.webp"
        frames[0].save(out, "WEBP", save_all=True, append_images=frames[1:],
                       duration=int(1000 / FPS), loop=0, quality=82, method=6)
        still = frames[max(range(len(frames)), key=lambda i: offsets[i] == 0)]
        still.save(SPECIES / f"psilocybe-cubensis-g{n}.png", "PNG", optimize=True)
        print(f"g{n}: {len(frames)} frames, {out.stat().st_size//1024} KB, gnome {bb[2]-bb[0]}x{gh}px, "
              f"slide {hide}px, {hidden_frames} fully-hidden frames")
        if hidden_frames == 0:
            print(f"  WARNING g{n}: never fully hides")


if __name__ == "__main__":
    main()
