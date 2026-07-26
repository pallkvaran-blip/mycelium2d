#!/usr/bin/env python3
# VEINED rock formations, batch 2. Owner corrections on batch 1:
#
#   1. NO BOTTOM. Batch 1 came back with scree pebbles, rubble aprons and grass tufts along a
#      flat base — a rock "sitting on the ground". These sprites are embedded in SOIL in a
#      side-on cross-section; there is no ground line to sit on.
#   2. NO UP OR DOWN. It should read correctly whichever way up it is placed (the editor can
#      rotate freely), so the mass has to be equally rocky on every side — no crown, no skirt,
#      no moss-only-on-top.
#   3. REAL SHAPES, not blobs: U, Y, ring, X, S-curve, L, starburst, kinked shard.
#
# Style continues rockform1/5 + the approved 15–22: deep navy-teal slate, big flat facets, thin
# branching electric-cyan glow veins, mint-green lichen, tiny cyan specks.
import os, sys, json, time, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "rock_options"
RAWDIR = ROOT / "scratchpad" / "veined_raw2"
OUTDIR.mkdir(parents=True, exist_ok=True); RAWDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("ROCKLOG", "/tmp/veined_rocks2.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

# The two hard negatives are stated up front AND repeated — batch 1 ignored a single mention.
NO_GROUND = (
    "The rock is a FREE-FLOATING chunk seen in cross-section, floating in empty space with "
    "NOTHING beneath it: absolutely NO ground, NO soil line, NO flat bottom, NO base, NO "
    "plinth, NO loose pebbles, NO scree, NO rubble pile, NO gravel, NO dirt, NO grass, NO "
    "plants, NO tufts, NO sky, NO horizon, NO cast shadow, NO reflection. "
    "It has NO top and NO bottom — rocky and detailed equally on every side, so it looks "
    "correct rotated any way up. Do not put moss only on the upper surface"
)
STYLE = (
    "flat 2D game-art rock sprite, hand-painted cel-shaded vector look, crisp clean edges, "
    "big flat angular facets separated by dark crack lines, LOW detail, NO photoreal texture, "
    "NO grain, matte. Colour: deep desaturated NAVY-TEAL slate stone, cool and dim. Glowing "
    "details spread over the WHOLE rock: thin BRANCHING ELECTRIC-CYAN glowing veins tracing "
    "the facets, small irregular MINT-GREEN glowing lichen patches on all sides, a light "
    "scatter of tiny cyan pinpoint specks. Bioluminescent deep-underground feel. "
    "Single rock formation, centred, isolated on a solid pure black background, "
    "no text, no watermark, no border, no characters"
)

# (id, aspect, shape brief)
BRIEFS = [
    ("u-arch",  "3:2",  "a thick U-SHAPED horseshoe of rock, two heavy arms joined by a curved "
                        "bend, the open mouth of the U clearly visible as empty space"),
    ("y-fork",  "3:2",  "a Y-SHAPED rock, one thick trunk splitting into two diverging prongs, "
                        "the fork between them open empty space"),
    ("ring",    "1:1",  "a RING of rock, a closed irregular loop with one big empty hole "
                        "punched clean through the middle, like a stone donut"),
    ("cross",   "1:1",  "an X-SHAPED rock, four thick arms radiating from a chunky centre, "
                        "empty space between the arms"),
    ("serpent", "16:9", "a WINDY SERPENTINE rock, a long thick S-curve snaking side to side "
                        "with a rounded kink at each bend"),
    ("elbow",   "3:2",  "an L-SHAPED rock elbow, one long limb meeting a shorter limb at a "
                        "sharp right-angled corner"),
    ("burst",   "1:1",  "a JAGGED STARBURST of rock, a dense core with six or seven splintered "
                        "spurs stabbing outward in all directions"),
    ("shard",   "9:16", "a LONG THIN kinked shard of rock, narrow and blade-like with a "
                        "dog-leg bend partway along, pointed at both ends"),
]
SEED = 3170

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
        if d.get("status") in ("succeeded", "failed", "canceled"): return d
        time.sleep(2)
    return {"status": "timeout"}

def _dil(m, it):
    for _ in range(it): m = m.filter(ImageFilter.MaxFilter(5))
    return m
def _ero(m, it):
    for _ in range(it): m = m.filter(ImageFilter.MinFilter(5))
    return m

def cutout(im, margin=20, close=7, feather=1.0, pad=6, keep_holes=True):
    """Adaptive corner-keyed cutout (FLUX doesn't reliably honour 'pure black background').

    keep_holes=False is essential for this batch: a U / ring / Y has a GENUINE hole that must
    stay transparent, and the batch-1 flood-fill treated any enclosed region as solid rock.
    """
    im = im.convert("RGB"); w, h = im.size
    L = im.convert("L"); lp = L.load()
    corners = [lp[3, 3], lp[w - 4, 3], lp[3, h - 4], lp[w - 4, h - 4]]
    corners.sort(); T = corners[1] + margin
    fg = Image.new("L", (w, h), 0); fp = fg.load()
    for y in range(h):
        for x in range(w):
            if lp[x, y] > T: fp[x, y] = 255
    fg = _ero(_dil(fg, close), close)          # seal hairline cracks that open to the edge
    if keep_holes:
        solid = fg                              # alpha follows the lit pixels: holes stay clear
    else:
        work = fg.copy(); wl = work.load()
        for sx, sy in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]:
            if wl[sx, sy] == 0: ImageDraw.floodfill(work, (sx, sy), 128, thresh=0)
        solid = Image.eval(work, lambda v: 0 if v == 128 else 255)
    a = solid.filter(ImageFilter.GaussianBlur(feather))
    out = im.convert("RGBA"); out.putalpha(a)
    bb = solid.getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        out = out.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    return out

def tone(im, target=0.235):
    """Match the shipped pair's brightness. Gamma (not a multiply) so vein cores stay bright."""
    a = im.getchannel("A")
    H, S, V = im.convert("RGB").convert("HSV").split()
    def mean_v(vch):
        vp, ap = vch.load(), a.load(); w, h = vch.size; t = n = 0
        for y in range(0, h, 3):
            for x in range(0, w, 3):
                if ap[x, y] < 200: continue
                t += vp[x, y]; n += 1
        return (t / n / 255) if n else 0
    lo, hi = 0.6, 4.0
    for _ in range(16):
        g = (lo + hi) / 2
        lut = [round(255 * ((i / 255) ** g)) for i in range(256)]
        if mean_v(V.point(lut)) > target: lo = g
        else: hi = g
    g = (lo + hi) / 2
    lut = [round(255 * ((i / 255) ** g)) for i in range(256)]
    hp = H.load(); w, hgt = H.size
    H2 = H.copy(); h2 = H2.load()
    for y in range(hgt):
        for x in range(w):
            v = hp[x, y]
            if 28 <= v <= 58: h2[x, y] = min(255, v + 18)     # yellow-green moss -> mint
    out = Image.merge("HSV", (H2, S, V.point(lut))).convert("RGB").convert("RGBA")
    out.putalpha(a)
    return out, g

def fit(im, long_side=640):
    w, h = im.size; sc = long_side / max(w, h)
    return im.resize((max(1, round(w * sc)), max(1, round(h * sc))), Image.LANCZOS)

def main():
    if not TOKEN:
        log("no REPLICATE_API_TOKEN"); sys.exit(1)
    jobs = []
    for name, aspect, brief in BRIEFS:
        prompt = f"{brief}. {NO_GROUND}. {STYLE}. {NO_GROUND}"
        d = create(prompt, aspect, SEED)
        url = (d.get("urls") or {}).get("get")
        log(f"submit {name} ({aspect}) -> {d.get('status')} {'' if url else json.dumps(d)[:200]}")
        if url: jobs.append((name, url))
        time.sleep(1)
    n = 0
    for name, url in jobs:
        d = poll(url)
        if d.get("status") != "succeeded":
            log(f"{name}: {d.get('status')} {str(d.get('error'))[:160]}"); continue
        out = d.get("output"); src = out[0] if isinstance(out, list) else out
        raw = RAWDIR / f"v2-{name}.png"
        subprocess.run(["curl", "-sS", "--cacert", CA, "-o", str(raw), src], check=False)
        try: im = Image.open(raw)
        except Exception as e: log(f"{name}: bad image {e}"); continue
        cut = fit(cutout(im))
        toned, g = tone(cut)
        toned.save(OUTDIR / f"v2-{name}.png")
        log(f"{name}: {im.size} -> {toned.size}  gamma {g:.2f}")
        n += 1
    log(f"done: {n} options")

if __name__ == "__main__":
    main()
