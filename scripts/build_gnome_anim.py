#!/usr/bin/env python3
# Build the ANIMATED portrait layers (animated WebP) for Magic Mushroom from the Kling clips.
#
# Contract for every layer: a full-frame 560x740 image whose alpha is a soft blob around ONE
# gnome. That way it inherits the portrait's object-fit:cover geometry and can never drift,
# and only the blob animates — the photograph underneath stays perfectly still.
#
#   g1, g2  the two gnomes that are really IN the photo, down among the stems (clip: gnomevid2)
#
# The clip was generated with start_image == end_image, which bounds the model's drift and
# makes the loop seamless.
import glob, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SPECIES = ROOT / "assets" / "species"
SCRATCH = ROOT / "scratchpad"
GROW, BLUR, FPS = 7, 5.0, 12

# clip -> the region of the portrait it was generated from
CLIPS = {
    "gnomevid2": (158, 452, 434, 684),
}
# layer -> (clip, gnome box, rotation)  rotation: 0 | "hidden" | ("hidden", extra_fraction)
LAYERS = [
    (1, "gnomevid2", (199, 506, 239, 600), 0),
    (2, "gnomevid2", (344, 550, 393, 652), 0),
]
# g3/g4 (the cap-top gnomes) are built by scripts/build_cap_gnomes.py instead: the video
# model refused to give them a hidden phase, so those are animated deterministically.


def blob(size, box):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rectangle((box[0] - GROW, box[1] - GROW, box[2] + GROW, box[3] + GROW), fill=255)
    return m.filter(ImageFilter.GaussianBlur(BLUR))


def mean_delta(a, b, region):
    d = ImageChops.difference(a, b).convert("L").crop(region)
    h = d.histogram(); n = sum(h)
    return sum(i * c for i, c in enumerate(h)) / n


def plates_for(clip, orig):
    """Each clip frame scaled back into its place in the full portrait."""
    frames = sorted(glob.glob(str(SCRATCH / clip / "f-*.png")))
    if not frames:
        print(f"no frames for {clip} — run its gen_*.py first"); sys.exit(1)
    crop = CLIPS[clip]
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    out = []
    for p in frames:
        f = Image.open(p).convert("RGB").resize((cw, ch), Image.LANCZOS)
        pl = orig.copy(); pl.paste(f, (crop[0], crop[1]))
        out.append(pl)
    return out


def main():
    orig = Image.open(SPECIES / "psilocybe-cubensis.jpg").convert("RGB")
    cache = {}
    for n, clip, box, rot in LAYERS:
        if clip not in cache:
            cache[clip] = plates_for(clip, orig)
            print(f"{clip}: {len(cache[clip])} frames @{FPS}fps ({len(cache[clip])/FPS:.1f}s loop)")
        plates = cache[clip]

        # motion extent, so we can confirm the blob contains it
        acc = None
        for pl in plates[1:]:
            d = ImageChops.difference(plates[0], pl).convert("L")
            acc = d if acc is None else ImageChops.lighter(acc, d)
        mb = acc.crop(box).point(lambda v: 255 if v > 28 else 0).getbbox()

        order = list(range(len(plates)))
        if rot != 0:
            frac = rot[1] if isinstance(rot, tuple) else 0.0
            # most-hidden frame = the one closest to the untouched photo inside this box
            k = min(order, key=lambda i: mean_delta(orig, plates[i], box))
            k = (k + int(frac * len(plates))) % len(plates)
            order = order[k:] + order[:k]
            print(f"  g{n}: starts on frame {k} (hidden; delta {mean_delta(orig, plates[k], box):.2f})")

        a = blob(orig.size, box)
        keep = a.point(lambda v: 255 if v > 0 else 0)
        black = Image.new("RGB", orig.size, (0, 0, 0))
        layers = []
        for i in order:
            rgb = Image.composite(plates[i], black, keep)   # zero RGB outside the blob -> compresses away
            l = rgb.convert("RGBA"); l.putalpha(a)
            layers.append(l)
        out = SPECIES / f"psilocybe-cubensis-g{n}.webp"
        layers[0].save(out, "WEBP", save_all=True, append_images=layers[1:],
                       duration=int(1000 / FPS), loop=0, quality=82, method=6)
        print(f"  g{n}: {out.stat().st_size // 1024} KB  motion bbox in box={mb}")



if __name__ == "__main__":
    main()
