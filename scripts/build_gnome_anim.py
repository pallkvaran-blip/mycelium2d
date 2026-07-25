#!/usr/bin/env python3
# Turn the Kling clip into the two ANIMATED portrait layers (animated WebP) that replace the
# static -g1/-g2 PNGs. Same contract as build_gnome_layers.py: each layer is a full-frame
# 560x740 image whose alpha is a soft blob around one gnome, so it inherits the portrait's
# object-fit:cover geometry and can never drift. Only the blob animates; everything outside
# is transparent, so the photo underneath stays perfectly still.
#
# The clip was generated from an upscaled CROP of the portrait with start_image == end_image,
# which both bounds the model's drift (measured background delta ~1.5/255, i.e. static) and
# makes the loop seamless.
import glob, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SPECIES = ROOT / "assets" / "species"
FRAMES = sorted(glob.glob(str(ROOT / "scratchpad" / "gnomevid2" / "f-*.png")))
CROP = (158, 452, 434, 684)          # the region of the portrait the clip was generated from
BOXES = [(199, 506, 239, 600), (344, 550, 393, 652)]   # per-gnome; must match remove_gnomes.py
GROW, BLUR = 7, 5.0
FPS = 12


def blob(size, box):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rectangle((box[0] - GROW, box[1] - GROW, box[2] + GROW, box[3] + GROW), fill=255)
    return m.filter(ImageFilter.GaussianBlur(BLUR))


def main():
    if not FRAMES:
        print("no frames — run scratchpad/gen_gnome_video2.py first"); sys.exit(1)
    orig = Image.open(SPECIES / "psilocybe-cubensis.jpg").convert("RGB")
    cw, ch = CROP[2] - CROP[0], CROP[3] - CROP[1]

    # Each clip frame, scaled back down into its place in the full portrait.
    plates = []
    for p in FRAMES:
        f = Image.open(p).convert("RGB").resize((cw, ch), Image.LANCZOS)
        plate = orig.copy()
        plate.paste(f, (CROP[0], CROP[1]))
        plates.append(plate)
    print(f"{len(plates)} frames -> {FPS}fps ({len(plates)/FPS:.1f}s loop)")

    # Where did the gnomes actually move? Confirms the blobs contain the motion.
    acc = None
    for pl in plates[1:]:
        d = ImageChops.difference(plates[0], pl).convert("L")
        acc = d if acc is None else ImageChops.lighter(acc, d)
    bb = acc.point(lambda v: 255 if v > 28 else 0).getbbox()
    print(f"motion bbox across clip: {bb}  (blobs cover {BOXES})")

    for i, box in enumerate(BOXES, start=1):
        a = blob(orig.size, box)
        keep = a.point(lambda v: 255 if v > 0 else 0)
        black = Image.new("RGB", orig.size, (0, 0, 0))
        layers = []
        for pl in plates:
            rgb = Image.composite(pl, black, keep)      # zero RGB outside the blob -> compresses away
            l = rgb.convert("RGBA"); l.putalpha(a)
            layers.append(l)
        out = SPECIES / f"psilocybe-cubensis-g{i}.webp"
        layers[0].save(out, "WEBP", save_all=True, append_images=layers[1:],
                       duration=int(1000 / FPS), loop=0, quality=82, method=6)
        print(f"{out.name}: {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
