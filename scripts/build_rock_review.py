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
    yield ("crystal-big", "Crystal — big renders", "raw renders, not yet cut",
           sorted((OPT / "big" / "crystal").glob("*.png")))
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
