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
    "capvid2":   (190, 130, 470, 320),
}
# Clips that only play one way (nothing -> heads up) are mirrored to make the loop rise,
# hold, sink and stay hidden.
MIRROR = {"capvid2"}
# layer -> (clip, gnome box, rotation)  rotation: 0 | "hidden" | ("hidden", extra_fraction)
LAYERS = [
    (1, "gnomevid2", (199, 506, 239, 600), 0),
    (2, "gnomevid2", (344, 550, 393, 652), 0),
    (3, "capvid2",   (242, 170, 294, 252), 0),
    (4, "capvid2",   (390, 222, 435, 290), ("hidden", 0.32)),
]


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
    if clip in MIRROR:
        frames = frames + frames[-2:0:-1]      # play forward then back -> seamless loop
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

        # motion extent, so we can confirm the blob contains it (crop-only: full-frame diffs
        # over a mirrored 120-frame clip are far too slow)
        acc = None
        ref = plates[0].crop(box)
        for pl in plates[1:]:
            d = ImageChops.difference(ref, pl.crop(box)).convert("L")
            acc = d if acc is None else ImageChops.lighter(acc, d)
        mb = acc.point(lambda v: 255 if v > 28 else 0).getbbox()

        order = list(range(len(plates)))
        if rot != 0:
            frac = rot[1] if isinstance(rot, tuple) else 0.0
            # most-hidden frame = the one closest to the untouched photo inside this box
            k = min(order, key=lambda i: mean_delta(orig, plates[i], box))
            k = (k + int(frac * len(plates))) % len(plates)
            order = order[k:] + order[:k]
            print(f"  g{n}: loop starts on frame {k} (delta {mean_delta(orig, plates[k], box):.2f}; "
                  f"offset by {frac:.0%} to desync)")

        # Only the blob's neighbourhood can ever be non-transparent, so build each frame by
        # pasting that tile onto a transparent full-frame canvas rather than compositing
        # 560x740 every time. Same output, a fraction of the work.
        a = blob(orig.size, box)
        pad = GROW + int(3 * BLUR) + 2
        bb = (max(0, box[0] - pad), max(0, box[1] - pad),
              min(orig.width, box[2] + pad), min(orig.height, box[3] + pad))
        a_tile = a.crop(bb)
        layers = []
        for i in order:
            tile = plates[i].crop(bb).convert("RGBA")
            tile.putalpha(a_tile)
            l = Image.new("RGBA", orig.size, (0, 0, 0, 0))
            l.paste(tile, (bb[0], bb[1]))
            layers.append(l)
        out = SPECIES / f"psilocybe-cubensis-g{n}.webp"
        layers[0].save(out, "WEBP", save_all=True, append_images=layers[1:],
                       duration=int(1000 / FPS), loop=0, quality=82, method=4)
        print(f"  g{n}: {out.stat().st_size // 1024} KB  motion bbox in box={mb}")

        # prefers-reduced-motion still. g1/g2's come from the untouched photo
        # (build_gnome_layers.py) so they keep full fidelity; the cap gnomes only exist in the
        # clip, so use the frame where this one is most visible — heads up.
        if clip != "gnomevid2":
            k = max(range(len(plates)), key=lambda i: mean_delta(orig, plates[i], box))
            tile = plates[k].crop(bb).convert("RGBA"); tile.putalpha(a_tile)
            st = Image.new("RGBA", orig.size, (0, 0, 0, 0)); st.paste(tile, (bb[0], bb[1]))
            sp = SPECIES / f"psilocybe-cubensis-g{n}.png"
            st.save(sp, "PNG", optimize=True)
            print(f"  g{n}: still <- frame {k} ({sp.stat().st_size // 1024} KB)")



if __name__ == "__main__":
    main()
