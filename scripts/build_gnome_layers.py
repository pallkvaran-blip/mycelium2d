#!/usr/bin/env python3
# Build the animated-portrait plates for Magic Mushroom.
#
#   psilocybe-cubensis-base.jpg  the photo with both gnomes inpainted away (static plate)
#   psilocybe-cubensis-g1.png    full-frame copy of the ORIGINAL photo, alpha = soft blob
#   psilocybe-cubensis-g2.png    around gnome A / gnome B respectively
#
# Why full-frame layers instead of small positioned sprites: the detail view renders the
# portrait with object-fit:cover in a box whose size/aspect varies, so any absolutely
# positioned overlay would drift. Same-size layers get the identical cover geometry for
# free and stay pinned at every size.
#
# Seamlessness: the base plate differs from the original ONLY inside the two gnome boxes
# (remove_gnomes.py composites just those back), so each blob's feathered edge sits in a
# region where the two plates are pixel-identical — fading a layer in/out can't reveal a
# seam, only the gnome itself.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SPECIES = ROOT / "assets" / "species"
ORIG = SPECIES / "psilocybe-cubensis.jpg"
BASE_SRC = SPECIES / "psilocybe-cubensis-base.jpg"   # written by remove_gnomes.py

# Must match remove_gnomes.py GNOMES (the only regions where base != original).
BOXES = [(199, 506, 239, 600), (344, 550, 393, 652)]
GROW, BLUR = 7, 5.0          # blob = box grown by GROW px, then blurred -> soft falloff


def blob(size, box):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rectangle((box[0] - GROW, box[1] - GROW, box[2] + GROW, box[3] + GROW), fill=255)
    return m.filter(ImageFilter.GaussianBlur(BLUR))


def main():
    orig = Image.open(ORIG).convert("RGB")
    base = Image.open(BASE_SRC).convert("RGB")
    assert base.size == orig.size, (base.size, orig.size)

    for i, box in enumerate(BOXES, start=1):
        a = blob(orig.size, box)
        layer = orig.copy().convert("RGBA")
        # zero the RGB wherever the layer is fully transparent so the PNG compresses to
        # ~the blob's worth of pixels instead of carrying a whole hidden photo.
        black = Image.new("RGB", orig.size, (0, 0, 0))
        keep = a.point(lambda v: 255 if v > 0 else 0)
        rgb = Image.composite(orig, black, keep)
        layer = rgb.convert("RGBA")
        layer.putalpha(a)
        p = SPECIES / f"psilocybe-cubensis-g{i}.png"
        layer.save(p, "PNG", optimize=True)
        print(f"{p.name}: {p.stat().st_size//1024} KB")

    # --- validate: base + both layers at full opacity must reconstruct the original ---
    comp = base.convert("RGBA")
    for i in (1, 2):
        comp = Image.alpha_composite(comp, Image.open(SPECIES / f"psilocybe-cubensis-g{i}.png").convert("RGBA"))
    comp = comp.convert("RGB")
    op, cp = orig.load(), comp.load()
    worst = 0; nbad = 0
    for y in range(0, orig.height):
        for x in range(0, orig.width):
            d = max(abs(op[x, y][k] - cp[x, y][k]) for k in range(3))
            if d > worst: worst = d
            if d > 12: nbad += 1
    print(f"reconstruction vs original: worst channel delta={worst}, px>12={nbad}")


if __name__ == "__main__":
    main()
