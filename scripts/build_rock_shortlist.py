#!/usr/bin/env python3
"""Build the shortlist view for docs/rock-shortlist.html — the KEEPS only, big, and cut.

Why a second tool when rock-review.html already has a "keep" filter: that filter reads the owner's
localStorage, so it only works in the one browser they voted in, and it shows the same small triage
thumb. Reviewing a shortlist is a different job from triaging a longlist — you need the images LARGE,
you need them as they will actually appear (cut out, over soil), and you need to see whether the set
hangs together. So this reads a checked-in verdict file instead of localStorage.

Two images per keep:
  <id>.jpg      the render as it came back from FLUX, trimmed to content
  <id>-cut.jpg  the same render through scripts/rock_cut.py cut(), composited over the game's soil
                colour — i.e. roughly what it looks like as a sprite in a level

The cut is GEOMETRY ONLY (rock_cut.cut leaves colour exactly as rendered); tone grading is still the
owner's call in rock-tuner.html. So a cut here is a preview, not a shipping sprite.

  python3 scripts/build_rock_shortlist.py            # reads docs/rock-shortlist.json
"""
import json, sys, traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from PIL import Image
from rock_cut import cut

ROOT = Path(__file__).resolve().parents[1]
VERDICT = ROOT / "docs" / "rock-shortlist.json"
OUT = ROOT / "assets" / "rock_options" / "shortlist"
LONG_SIDE = 980
QUALITY = 80
SOIL = (0x4a, 0x37, 0x21)          # config.js soilTop..soilMid — the colour these sit against

# Which generator recipe each batch came from. The whole point of grouping by this: the 15 keeps are
# NOT one set. Batches 15-16 are the pre-fix canny recipe (flat cel-shaded, cold grey stone, ~1 MP);
# 17 is the first textured round; 19-20 are the settled recipe the owner kept 6 of 6. A sprite from
# 16 will not sit beside one from 19, and that is much easier to see than to be told.
# `mp` is the ORIGINAL render resolution, recorded per batch rather than measured: what is on disk is
# the KEEP_LONG=1600 working copy the generator commits, so measuring it would report ~1.4 MP for a
# 4.2 MP ultra render and make the settled recipe look like the low-res one.
RECIPES = {
    "20": dict(order=0, key="locked", mp="4 MP",
               label="Settled recipe — ultra raw · var=r11 · ref rockform2",
               note="batch 20: same recipe as 19, with the shapes described so they cannot stand — "
                    "which is what removed the floor, the cast shadow and the molten pool at the "
                    "base. These three came back on a BLACK backdrop, so their cuts are the ragged "
                    "ones (see the flags)"),
    "19": dict(order=0, key="locked", mp="4 MP",
               label="Settled recipe — ultra raw · var=r11 · ref rockform2",
               note="batch 19: you kept 6 of 6. Textured stone, warm seams in the cracks"),
    "17": dict(order=1, key="textured", mp="4 MP",
               label="First textured round — ultra raw · var=r10",
               note="batch 17: the round that fixed 'flat and cartoony'. Same look as 19 but a "
                    "denser, broader glow"),
    "16": dict(order=2, key="flat", mp="1 MP",
               label="Pre-fix canny recipe — var=r8 · flat, cold, 1 MP",
               note="batches 15-16: cel-shaded vector fills, cold grey stone, a quarter of the "
                    "pixels. These are the ones the texture work replaced"),
    "15": dict(order=2, key="flat", mp="1 MP",
               label="Pre-fix canny recipe — var=r8 · flat, cold, 1 MP",
               note="batches 15-16: cel-shaded vector fills, cold grey stone, a quarter of the "
                    "pixels. These are the ones the texture work replaced"),
}

# Shapes that fully ENCLOSE a patch of backdrop, so the cut has to punch it out or the sprite ships
# with an opaque blob in the middle. Opt-in per shape because punch_holes can also eat a dark recess
# that is genuinely part of the rock. `horseshoe` is in here because FLUX closed its arch: the brief
# says the gap between the arms is open, and the render bridged it.
PUNCH = ("-ring-", "-horseshoe-")


def content_box(im):
    """Trim the flat backdrop so a render is not mostly empty frame. Handles either polarity."""
    L = im.convert("L")
    w, h = L.size
    lp = L.load()
    edge = []
    for x in range(0, w, max(1, w // 120)):
        edge += [lp[x, 1], lp[x, h - 2]]
    for y in range(0, h, max(1, h // 120)):
        edge += [lp[1, y], lp[w - 2, y]]
    edge.sort()
    bg = edge[len(edge) // 2]
    box = L.point(lambda v: 255 if abs(v - bg) > 18 else 0).getbbox()
    if not box:
        return None
    bw, bh = box[2] - box[0], box[3] - box[1]
    if bw * bh < 0.02 * w * h:
        return None
    pad = round(max(bw, bh) * 0.02)
    return (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))


def fit(im, long_side=LONG_SIDE):
    w, h = im.size
    s = long_side / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS) if s < 1 else im


def main():
    doc = json.loads(VERDICT.read_text())
    keeps = doc.get("keep") or []
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.jpg"):
        old.unlink()

    items, seen_recipes = [], {}
    for k in keeps:
        src = ROOT / k["src"]
        if not src.is_file():
            print(f"MISSING {k['src']}")
            continue
        stem = src.stem
        batch = "".join(c for c in stem.split("-")[0] if c.isdigit())
        rec = RECIPES.get(batch, dict(order=9, key="other", label=f"batch {batch}", note=""))
        seen_recipes[rec["key"]] = rec

        raw = Image.open(src)
        raw.load()
        ow, oh = raw.size
        rgb = raw.convert("RGB")
        box = content_box(rgb)
        view = fit(rgb.crop(box) if box else rgb)
        view.save(OUT / f"{stem}.jpg", "JPEG", quality=QUALITY, optimize=True)

        cut_file, cut_err, risky = None, None, False
        try:
            sprite, info = cut(src, long_side=LONG_SIDE,
                              punch_holes=any(p in stem for p in PUNCH))
            plate = Image.new("RGB", sprite.size, SOIL)
            plate.paste(sprite, (0, 0), sprite)
            plate.save(OUT / f"{stem}-cut.jpg", "JPEG", quality=QUALITY, optimize=True)
            cut_file = f"{stem}-cut.jpg"
            # A DARK rock on a DARK backdrop is the low-contrast keying case, and it is the one that
            # comes out ragged — measured: the black-backdrop renders lose chunks of silhouette while
            # the white-backdrop ones in the same batch cut clean. Flag it on the card so a bad CUT
            # is never mistaken for a bad ROCK.
            risky = not info.get("light_bg") and info.get("bg", 255) < 40
            print(f"{stem}: {ow}x{oh} -> view {view.size}, cut {sprite.size} "
                  f"{info}{'  RAGGED-RISK' if risky else ''}")
        except Exception as e:
            cut_err = f"{type(e).__name__}: {e}"
            print(f"{stem}: cut FAILED — {cut_err}")
            traceback.print_exc()

        items.append({
            "id": k["id"], "stem": stem, "shape": stem.split("-")[1], "batch": batch,
            "recipe": rec["key"], "note": k.get("note") or "",
            "file": f"{stem}.jpg", "cut": cut_file, "cutError": cut_err, "cutRisk": risky,
            "w": ow, "h": oh, "mp": rec.get("mp", ""),
            "src": k["src"],
        })

    groups = [dict(key=r["key"], label=r["label"], note=r["note"], order=r["order"])
              for r in sorted(seen_recipes.values(), key=lambda r: r["order"])]
    (OUT / "index.json").write_text(json.dumps(
        {"updated": doc.get("updated", ""), "groups": groups, "items": items}, indent=1))
    kb = sum(f.stat().st_size for f in OUT.glob("*.jpg")) / 1024
    ncut = sum(1 for i in items if i["cut"])
    print(f"\n{len(items)} keeps ({ncut} cut ok), {kb / 1024:.1f} MB -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
