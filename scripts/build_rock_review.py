#!/usr/bin/env python3
"""Build the review set for docs/rock-review.html — downscaled thumbs + an index.

Why thumbs: the longlist is ~100 renders at up to 4 MP (44 MB for the crystal batch alone).
Triage doesn't need full res, and the tool has to be HOSTED for the owner to use it.

Where they go: `assets/rock_options/review/`. That path sits under a `*_options` folder, which
build.mjs's asset copy already excludes — so these never reach `dist/assets/` and therefore never
reach the itch zip (which ships only index.html + assets/). build.mjs copies this folder
separately to `dist/review-thumbs/`, a dist-ROOT folder, exactly like the owner-tool HTML pages.

Re-run any time new renders land: `python3 scripts/build_rock_review.py`
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OPT = ROOT / "assets" / "rock_options"
OUT = OPT / "review"
LONG_SIDE = 620
QUALITY = 82
SOIL = (0x4a, 0x37, 0x21)          # game soil (config.js soilTop..soilMid), for cutouts

# (group id, human label, note, iterable of source paths)
def sets():
    # Newest batch first so it isn't buried under the 52 already-reviewed options. Batch 9 is the
    # density-push run (var=r8) on the six silhouettes the owner kept; both seeds are included
    # because the first (cny2263) crazed the backdrop and the second (cny5527) fixed it, and the
    # per-image density difference between them is seed noise worth judging by eye.
    yield ("ember-b19", "Ember — batch 19 (NEW: textured, few seams)",
           "texture kept, violet gone, but the orange came back — is warm actually wrong?",
           sorted((OPT / "big" / "ember").glob("ember19-*.png")))
    yield ("ember-b17", "Ember — batch 17 (NEW: textured surface)",
           "the flat/cartoony fix: real stone grain, 4 MP, ultra raw — brought lava back with it",
           sorted((OPT / "big" / "ember").glob("ember17-*.png")))
    yield ("ember-b18", "Ember — batch 18 (NEW: cold reference)",
           "cold reference killed the lava AND the texture, and added magenta — vote it down freely",
           sorted((OPT / "big" / "ember").glob("ember18-*.png")))
    yield ("ember-b16", "Ember — batch 16 (filled control)",
           "chile is the look; rim glow persists on the rest",
           sorted((OPT / "big" / "ember").glob("ember16-*.png")))
    yield ("ember-b15", "Ember — batch 15 (first ember round)",
           "no lava rocks, no plateaus — india puts fire in a crack",
           sorted((OPT / "big" / "ember").glob("ember15-*.png")))
    yield ("fungal-b14", "Fungal — batch 14 (described shapes, flat ref)",
           "prose shapes + rockform1 reference — shapes read, projection still isometric",
           sorted((OPT / "big" / "fungal").glob("fungal14-*.png")))
    yield ("fungal-b13", "Fungal — batch 13 (described shapes)",
           "your shape list, described geometrically — best fungi yet, but isometric blocks",
           sorted((OPT / "big" / "fungal").glob("fungal13-*.png")))
    yield ("fungal-b12", "Fungal — batch 12 (bracket fungi)",
           "noun swap to fix the top-down view — did NOT work, vote anyway",
           sorted((OPT / "big" / "fungal").glob("fungal12-*.png")))
    yield ("fungal-b11", "Fungal — batch 11 (first fungal round)",
           "colour landed; came back as top-down plateaus",
           sorted((OPT / "big" / "fungal").glob("fungal11-*.png")))
    yield ("crystal-b10", "Crystal — batch 10 (continents + island clusters)",
           "whole continents and archipelagos — does more coastline buy more detail?",
           sorted((OPT / "big" / "crystal").glob("crystal10-*.png")))
    yield ("crystal-b9", "Crystal — batch 9 (density push)", "9 of 12 kept — the current best recipe",
           sorted((OPT / "big" / "crystal").glob("crystal9-*.png")))
    yield ("crystal-big", "Crystal — big renders", "raw renders, not yet cut",
           sorted(p for p in (OPT / "big" / "crystal").glob("*.png")
                  if not p.name.startswith(("crystal9-", "crystal10-"))))
    yield ("veined-cut", "Veined — cut finalists", "cut + ready to ship",
           sorted((ROOT / "assets" / "rock_candidates").glob("*.png")))
    yield ("veined-b3", "Veined — batch 3 shapes", "shape exploration (U/ring/X/S/…)",
           sorted(OPT.glob("v3-*.png")))
    yield ("veined-b1", "Veined — batch 1", "these were briefly shipped as rockform15-22",
           sorted((OPT / "toned").glob("veined-*.png")))
    yield ("veined-b2", "Veined — batch 2", "off-style (orange veins / 3D icon look)",
           sorted(OPT.glob("v2-*.png")))

def has_alpha(im):
    if im.mode not in ("RGBA", "LA"):
        return False
    a = im.getchannel("A")
    return a.getextrema()[0] < 250

def content_box(im, alpha):
    """Bounding box of the actual rock, so the thumb isn't mostly empty frame.

    Several raw batches put a small rock in a big black field (measured: the rock is ~10% of the
    pixels), which reviews as an almost-blank tile. Cutouts use the alpha bbox; opaque renders key
    off the border luminance. Returns None when the result looks implausible, so a full-frame
    render is never cropped to junk.
    """
    w, h = im.size
    if alpha:
        box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    else:
        L = im.convert("L")
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
    if bw * bh < 0.02 * w * h:            # nothing meaningful found
        return None
    pad = round(max(bw, bh) * 0.03)
    return (max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad))

def thumb(src, dest):
    im = Image.open(src)
    im.load()
    ow, oh = im.size                   # ORIGINAL render size — what the index reports
    alpha = has_alpha(im)
    if alpha:
        im = im.convert("RGBA")
        box = content_box(im, True)
        if box: im = im.crop(box)
        bg = Image.new("RGBA", im.size, SOIL + (255,))
        bg.alpha_composite(im)
        im = bg.convert("RGB")
    else:
        im = im.convert("RGB")
        box = content_box(im, False)
        if box: im = im.crop(box)
    w, h = im.size
    sc = LONG_SIDE / max(w, h)
    if sc < 1:
        im = im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)
    im.save(dest, "JPEG", quality=QUALITY, optimize=True)
    return {"w": ow, "h": oh, "alpha": alpha, "trimmed": (w, h) != (ow, oh)}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.jpg"):
        old.unlink()
    groups, items = [], []
    for gid, label, note, paths in sets():
        paths = [p for p in paths if p.is_file()]
        if not paths:
            continue
        groups.append({"id": gid, "label": label, "note": note, "count": len(paths)})
        for p in paths:
            iid = gid + "/" + p.stem
            fname = (gid + "-" + p.stem).replace("/", "-") + ".jpg"
            meta = thumb(p, OUT / fname)
            items.append({
                "id": iid, "group": gid, "label": p.stem, "file": fname,
                "src": str(p.relative_to(ROOT)), "w": meta["w"], "h": meta["h"], "cut": meta["alpha"],
                "trimmed": meta["trimmed"],
            })
        print(f"{label}: {len(paths)}")
    (OUT / "index.json").write_text(json.dumps({"groups": groups, "items": items}, indent=1))
    kb = sum(f.stat().st_size for f in OUT.glob("*.jpg")) / 1024
    print(f"\n{len(items)} thumbs, {kb/1024:.1f} MB -> {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    main()
