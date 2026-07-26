#!/usr/bin/env python3
# New rock FORMATIONS for the VEINED theme (the thinnest category — only rockform1 + rockform5).
#
# Style read off those two: deep desaturated navy-teal slate, cracked into big flat facets by
# darker crack lines, thin BRANCHING ELECTRIC-CYAN glow veins, mint-green glowing moss/lichen
# patches, a scatter of tiny cyan pinpoints. Flat cel-shaded game art, crisp silhouette, no
# gradients beyond broad soft shading, black background.
#
# Four SHAPE briefs, deliberately far apart in size and outline, because a campaign level uses
# one theme throughout and needs range: a long low ridge, a tall spire, an enormous complex
# massif with an arch (meant to be scaled to a third of the map), and a small angular chunk.
# Two seeds each -> 8 options in assets/rock_options/ for the owner to pick 4 from.
import os, sys, json, time, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "rock_options"
RAWDIR = ROOT / "scratchpad" / "veined_raw"
OUTDIR.mkdir(parents=True, exist_ok=True); RAWDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("ROCKLOG", "/tmp/veined_rocks.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = (
    "flat 2D game-art rock sprite, hand-painted cel-shaded vector look, crisp clean edges, "
    "big flat angular facets separated by dark crack lines, LOW detail, NO photoreal texture, "
    "NO grain, NO film noise, matte. Colour: deep desaturated NAVY-TEAL slate stone (dark "
    "blue-green grey), cool and dim. Glowing details: thin BRANCHING ELECTRIC-CYAN glowing "
    "veins tracing across the facets like luminous cracks, irregular MINT-GREEN glowing moss "
    "and lichen patches clinging to the stone, and a light scatter of tiny cyan pinpoint "
    "specks. Bioluminescent deep-underground feel. Side-on view, single rock formation, "
    "centred, isolated on a solid pure black background, no ground, no cast shadow, no text, "
    "no watermark, no border, no characters"
)

# (name, aspect, shape brief)
BRIEFS = [
    ("ridge",  "21:9",
     "an EXTREMELY LONG and LOW horizontal ridge of rock — a shallow slab spine running far "
     "side to side, only a little tall, with a bumpy uneven crest and a flat underside"),
    ("spire",  "9:16",
     "a TALL NARROW jagged standing pillar of rock, far taller than it is wide, leaning "
     "slightly, with stepped ledges and a broken splintered tip"),
    ("massif", "16:9",
     "an ENORMOUS complex multi-lobed rock massif with a natural ARCH hole punched through it "
     "and deep overhangs — an intricate silhouette with several peaks, clefts and shelves, "
     "the kind of landmark that would dominate a whole map"),
    ("chunk",  "3:2",
     "a SMALL compact angular broken wedge of rock, chunky and simple, with two or three "
     "fractured shards resting at its base"),
]
SEEDS = [4110, 8820]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA] + args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:300]}

def create(prompt, aspect, seed):
    body = json.dumps({"input": {"prompt": prompt, "aspect_ratio": aspect, "raw": False,
                                 "output_format": "png", "safety_tolerance": 6, "seed": seed}})
    return curl_json(["-H", f"Authorization: Bearer {TOKEN}", "-H", "Content-Type: application/json",
                      "-d", body, f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(180):
        d = curl_json(["-H", f"Authorization: Bearer {TOKEN}", geturl])
        st = d.get("status")
        if st == "succeeded" or st in ("failed", "canceled"): return d
        time.sleep(2)
    return {"status": "timeout"}

# ---- cutout: same adaptive approach as gen_troll_rock2 --------------------------------
# FLUX does not reliably honour "pure black background", so the threshold is derived from the
# CORNER luminance rather than fixed. A fixed low threshold treats a grey backdrop as
# foreground and hands back a fully opaque rectangle.
def _dil(m, it):
    for _ in range(it): m = m.filter(ImageFilter.MaxFilter(5))
    return m
def _ero(m, it):
    for _ in range(it): m = m.filter(ImageFilter.MinFilter(5))
    return m

def cutout(im, margin=20, close=7, feather=1.0, pad=6):
    im = im.convert("RGB"); w, h = im.size
    L = im.convert("L"); lp = L.load()
    corners = [lp[3, 3], lp[w - 4, 3], lp[3, h - 4], lp[w - 4, h - 4]]
    corners.sort(); bg = corners[1]
    T = bg + margin
    fg = Image.new("L", (w, h), 0); fp = fg.load()
    for y in range(h):
        for x in range(w):
            if lp[x, y] > T: fp[x, y] = 255
    # close: seals crack gaps that open to the silhouette, so soil can't show through them
    fg = _ero(_dil(fg, close), close)
    work = fg.copy(); wl = work.load()
    for sx, sy in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2),
                   (w // 2, 1), (w // 2, h - 2), (1, h // 2), (w - 2, h // 2)]:
        if wl[sx, sy] == 0: ImageDraw.floodfill(work, (sx, sy), 128, thresh=0)
    solid = Image.eval(work, lambda v: 0 if v == 128 else 255)
    a = solid.filter(ImageFilter.GaussianBlur(feather))
    out = im.convert("RGBA"); out.putalpha(a)
    bb = solid.getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        out = out.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    return out

def finish(im, long_side=640):
    """Match the shipped rockforms: flat, slightly desaturated, longest side 640."""
    im = ImageEnhance.Color(im).enhance(0.92)
    im = ImageOps.posterize(im.convert("RGB"), 6).convert("RGBA") if False else im
    w, h = im.size
    sc = long_side / max(w, h)
    return im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)

def main():
    if not TOKEN:
        log("no REPLICATE_API_TOKEN"); sys.exit(1)
    jobs = []
    for name, aspect, brief in BRIEFS:
        for si, seed in enumerate(SEEDS):
            prompt = f"{brief}. {STYLE}"
            d = create(prompt, aspect, seed)
            url = (d.get("urls") or {}).get("get")
            log(f"submit {name}-{si + 1} ({aspect}, seed {seed}) -> {d.get('status')} {'' if url else json.dumps(d)[:200]}")
            if url: jobs.append((f"{name}{si + 1}", url))
            time.sleep(1)
    made = []
    for tag, url in jobs:
        d = poll(url)
        if d.get("status") != "succeeded":
            log(f"{tag}: {d.get('status')} {str(d.get('error'))[:160]}"); continue
        out = d.get("output")
        src = out[0] if isinstance(out, list) else out
        raw = RAWDIR / f"veined-{tag}.png"
        subprocess.run(["curl", "-sS", "--cacert", CA, "-o", str(raw), src], check=False)
        try:
            im = Image.open(raw)
        except Exception as e:
            log(f"{tag}: bad image {e}"); continue
        cut = finish(cutout(im))
        dest = OUTDIR / f"veined-{tag}.png"
        cut.save(dest)
        log(f"{tag}: {im.size} -> {cut.size}  {dest.relative_to(ROOT)}")
        made.append(dest)
    log(f"done: {len(made)} options")

if __name__ == "__main__":
    main()
