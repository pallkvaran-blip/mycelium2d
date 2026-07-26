#!/usr/bin/env python3
# VEINED rock formations, batch 3 — shape variety with NO base and NO orientation.
#
# Batch 2 (gen_veined_rocks2.py) failed the STYLE, not the cut: FLUX returned isometric
# mobile-icon "floating islands" with ORANGE lava veins, grass tufts on top, flat bottoms and
# drop shadows. Three causes, all fixed here:
#
#   1. The negatives were stated FIRST, so the positive look lost positional weight. Now the
#      order is shape -> STYLE (copied from batch 1, which landed) -> constraints.
#   2. Naming letters ("U-SHAPED", "X-SHAPED") made it draw typography. Shapes are described
#      only geometrically now.
#   3. "glowing veins" alone reads as lava. NO_WARM names the wrong colours explicitly.
#
# Owner's two hard rules for this batch: no bottom (these sit INSIDE soil in cross-section,
# there is no ground line) and no up/down (the editor rotates freely, so every side must be
# equally rocky — no mossy crown, no scree skirt).
import os, sys, json, time, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from PIL import ImageChops

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "rock_options"
RAWDIR = ROOT / "scratchpad" / "veined_raw3"
OUTDIR.mkdir(parents=True, exist_ok=True); RAWDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("ROCKLOG", "/tmp/veined_rocks3.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

# Verbatim from batch 1 (the eight approved options) — this is the part that worked.
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
# Batch 2 came back orange/magenta: "glowing veins in rock" is a lava trope unless refused.
NO_WARM = (
    "The glow is ONLY cyan and mint green: absolutely NO orange, NO amber, NO yellow, NO red, "
    "NO lava, NO magma, NO molten rock, NO fire, NO embers, NO purple, NO magenta, NO pink"
)
# No base, no top — the sprite is buried in soil and gets rotated freely by the level editor.
NO_GROUND = (
    "A free-floating chunk in empty space with NOTHING beneath it: no ground, no soil line, no "
    "flat bottom, no base, no plinth, no scree, no rubble, no gravel, no pebbles at its foot, "
    "no dirt, no grass, no plants, no tufts, no sky, no horizon, no drop shadow, no reflection, "
    "no glow halo behind it, no vignette. Equally rocky and equally detailed on every side so "
    "it reads correctly rotated any way up, with moss scattered over all sides rather than only "
    "on top. Flat orthographic side elevation, NOT isometric, NOT a 3D render, NOT a floating "
    "island, NOT a letter or logo or typography"
)

# (id, aspect, geometric shape brief — no letter names, punch_holes, seed)
#
# Round 1 (seed 4110) landed the STYLE but only A/C/G landed the SHAPE — fork, radial, elbow and
# antler all collapsed into the same generic lumpy mound, because "a stem that splits" reads to
# FLUX as "a rock". The re-rolls name a MAN-MADE analogue (tuning fork, crossed swords,
# carpenter's square, bare tree branch) and state what must NOT touch, which is what finally
# forced a silhouette. Round 1's two colour failures are re-rolled too: serpentine came back with
# lime-yellow veins and honeycomb lit its holes with orange fire.
SEED = 4110          # the seed batch 1's approved options came from
SEED_B = 8820        # batch 1's other good seed, for the re-rolls
SILHOUETTE = ("The overall SILHOUETTE is the whole point and must read instantly at a glance, "
              "with large areas of EMPTY BACKGROUND inside the outline. Not a lump, not a mound, "
              "not a boulder, not a pile of rocks")
BRIEFS = [
    ("horseshoe", "3:2",  "a thick horseshoe of rock: two heavy parallel arms joined at one end "
                          "by a rounded bend, the long gap between the arms open empty space", False, SEED),
    ("fork",      "3:2",  "a thick stem of rock that splits into two diverging prongs of "
                          "different lengths, the wedge of space between the prongs empty", False, SEED),
    ("pierced",   "1:1",  "a closed irregular loop of rock, lumpy and uneven, with one large "
                          "ragged hole punched clean through the middle of it", True, SEED),
    ("radial",    "1:1",  "a chunky knot of rock with four thick blunt arms reaching outward in "
                          "four different directions, empty space in the gaps between the arms", False, SEED),
    ("serpentine","16:9", "a long snaking band of rock curving lazily side to side, thicker at "
                          "the bends and pinched thinner between them", False, SEED),
    ("elbow",     "3:2",  "one long limb of rock meeting a shorter stubbier limb at a sharp "
                          "angled corner, like a bent length of broken stone", False, SEED),
    ("starburst", "1:1",  "a dense knotted core of rock with seven splintered spurs of differing "
                          "length stabbing outward in every direction, including downward", False, SEED),
    ("blade",     "9:16", "a long narrow blade of rock with a dog-leg kink partway along it, "
                          "tapering to a rough point at BOTH ends", False, SEED),
    ("honeycomb", "16:9", "a broad slab of rock riddled with five or six holes of differing size "
                          "eaten right through it, a stone sieve, ragged around its whole rim", True, SEED),
    ("antler",    "3:2",  "a branching rock like coral or antlers: a stout core throwing off four "
                          "or five thinning limbs that themselves split, wide open space between", False, SEED),

    # -- re-rolls -----------------------------------------------------------------------------
    ("fork2",     "3:2",  f"a colossal stone TUNING FORK: one short thick stalk at the bottom "
                          f"from which TWO long separate stone prongs rise and splay apart, a "
                          f"huge triangular void of empty space between the two prongs. The "
                          f"prongs touch each other ONLY at the stalk. {SILHOUETTE}", False, SEED_B),
    ("radial2",   "1:1",  f"FOUR long straight beams of stone all crossing through one central "
                          f"knot, like four crossed swords or a four-pointed star, four wide "
                          f"empty wedges of background between the beams. {SILHOUETTE}", False, SEED_B),
    ("elbow2",    "3:2",  f"one single long straight beam of stone that bends ONCE through a "
                          f"sharp ninety-degree corner, like a carpenter's square or a bent "
                          f"girder — two straight arms, one corner, nothing else. {SILHOUETTE}",
                          False, SEED_B),
    ("antler2",   "3:2",  f"a stone BARE TREE BRANCH: one thick stalk dividing again and again "
                          f"into ever thinner twigs that fan out, mostly empty space between the "
                          f"twigs, spindly and skeletal. {SILHOUETTE}", False, SEED_B),
    ("serpentine2","16:9", "a long snaking ribbon of rock winding side to side through three "
                          "bends, thick at the bends and pinched thin between them. The glowing "
                          "veins along it are ELECTRIC CYAN and ICE BLUE — definitely NOT yellow, "
                          "NOT lime, NOT gold", False, SEED_B),
    ("honeycomb2","16:9", "a broad slab of rock with five or six holes of differing size eaten "
                          "clean through it, a stone sieve. The holes are EMPTY UNLIT BLACK "
                          "openings you can see straight through — nothing glows inside them, no "
                          "fire, no furnace, no light source behind the slab", True, SEED_B),

    # -- round 3 ------------------------------------------------------------------------------
    # Round 2's SILHOUETTE clause backfired: "large areas of EMPTY BACKGROUND inside the outline"
    # plus a man-made analogue (bridge, carpenter's square, lightning bolt) put FLUX into
    # illustration mode and it painted whole SCENES — cliff walls, water, a horizon — which no
    # cutout can rescue. Round 1's plain formula never once did that, so these go back to it and
    # push on the shape with counts and proportions instead of similes.
    ("fork3",     "3:2",  "a rock shaped like two thick separate columns of stone that lean apart "
                          "from a common thick root, so the mass is narrow at the bottom and wide "
                          "at the top with a deep V-shaped notch cut down the middle between the "
                          "two columns", False, 2255),
    ("elbow3",    "3:2",  "a rock in two straight parts at right angles to each other: one part "
                          "long and horizontal, the other short and vertical, joined at one sharp "
                          "corner, and NOTHING in the fourth quarter of the shape", False, 2255),
    ("antler3",   "3:2",  "a rock made of five or six thin stone limbs branching apart from one "
                          "thick root, each limb thinner than the last, spindly and skeletal like "
                          "stone coral, mostly gaps", False, 2255),
    ("zigzag2",   "3:2",  "a rock that is one narrow band of stone folded back and forth four "
                          "times into a hard zigzag, each fold a sharp angular corner, with deep "
                          "notches biting in alternately from above and from below", False, 2255),
    # radial2's X was the best shape of round 2 but it is UNKEYABLE: the beams came out RGB
    # (3,48,74) against a (10,53,83) vignette — 10-15 apart, and one sample brighter than the
    # backdrop. No threshold or colour distance separates that, so the shape gets re-rendered on
    # seed 2255 (every round-3 render landed a near-black background) with the backdrop spelled out.
    ("radial3",   "1:1",  "a rock made of four long straight stone beams that all cross through "
                          "one thick central knot and reach out to four corners, with wide empty "
                          "gaps between the beams. The background behind the rock is PURE FLAT "
                          "BLACK, hex 000000, unlit and completely empty — no vignette, no "
                          "gradient, no blue glow, no light spill behind the stone", False, 2255),

    # -- two more shapes, for range ------------------------------------------------------------
    ("zigzag",    "3:2",  f"a stone LIGHTNING BOLT: one narrow band of rock kinking sharply back "
                          f"and forth four times in a hard zigzag, empty space in every notch. "
                          f"{SILHOUETTE}", False, SEED_B),
    ("span",      "21:9", f"a long thin natural stone BRIDGE: a slender horizontal span of rock "
                          f"held up at each end by a short stubby pier, one enormous empty arch "
                          f"of background beneath the middle of the span. {SILHOUETTE}", False, SEED_B),
]

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

def border_median(L):
    """Background luminance, from a ring just inside the frame."""
    w, h = L.size; lp = L.load()
    vals = []
    for x in range(0, w, max(1, w // 200)):
        vals += [lp[x, 2], lp[x, h - 3]]
    for y in range(0, h, max(1, h // 200)):
        vals += [lp[2, y], lp[w - 3, y]]
    vals.sort()
    return vals[len(vals) // 2]

def otsu(L):
    """Threshold that best splits the luminance histogram in two — background vs subject.

    Needed because the polarity varies per render: serpent in batch 2 came back on a PALE
    background, and "keep pixels brighter than the corners" erased the rock down to its lit
    crust (14% opaque). Otsu finds the split without assuming which side the rock is on.
    """
    hist = L.histogram(); tot = sum(hist)
    sum_all = sum(i * c for i, c in enumerate(hist))
    wB = sumB = 0.0; best = (-1.0, 127)
    for t in range(256):
        wB += hist[t]
        if wB == 0: continue
        wF = tot - wB
        if wF == 0: break
        sumB += t * hist[t]
        var = wB * wF * ((sumB / wB) - ((sum_all - sumB) / wF)) ** 2
        if var > best[0]: best = (var, t)
    return best[1]

def _mean_over(L, mask, n):
    """Mean luminance of L where mask is 255. Histogram of a masked copy — C speed."""
    st = ImageChops.multiply(L, mask)
    hist = st.histogram()
    hist[0] = 0                                # masked-out pixels landed in bucket 0
    tot = sum(i * c for i, c in enumerate(hist))
    return tot / max(1, n)

def cutout(im, key_side=1280, margin=20, close=7, feather=1.0, pad=6,
           punch_holes=False, hole_tol=14, hole_min=0.006):
    """Polarity-aware cutout with genuine holes preserved.

    FLUX ignores "pure black background" often enough that the key has to be derived from the
    frame: batch 2's serpent came back on a LIGHT background, so a brighter-than-background
    test erased the whole rock. Polarity is detected, then enclosed pockets are punched out
    only when they are background-COLOURED (a real hole) rather than merely dark (a shadowed
    facet), which is what tells a stone ring apart from a dark rock body.

    Keying happens on a `key_side` copy — the sprite ships at 640 on the long side, so paying
    per-pixel Python for a 4 MP render is minutes of nothing (the first attempt never finished).

    punch_holes is OPT-IN because a rock's own interior shadow reads the same as a hole: run on
    the approved batch-1 options it ate the dark middle out of spire1's shaft. Shapes whose gaps
    open to the silhouette (horseshoe, fork, starburst...) need nothing — the border flood-fill
    already leaves them clear. Only a fully enclosed hole needs this.
    """
    im = im.convert("RGB")
    full = im.size
    if max(full) > key_side: im = fit(im, key_side)
    w, h = im.size
    L = im.convert("L")
    bg = border_median(L); T = otsu(L)
    light_bg = bg > T
    # Otsu decides POLARITY ONLY. It is far too high to threshold with: it splits dark-rock-body
    # from lit-facet, so keying on it chewed the stone away and left floating veins. The cut has
    # to hug the BACKGROUND level instead — which is what batch 1's bg+margin did.
    if light_bg: fg = L.point(lambda v: 255 if v < bg - margin else 0)
    else:        fg = L.point(lambda v: 255 if v > bg + margin else 0)
    fg = _ero(_dil(fg, close), close)          # seal hairline cracks that reach the silhouette

    # Everything the background can walk to from the frame is outside; the rest is rock-or-hole.
    work = fg.copy(); wl = work.load()
    seeds = [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2),
             (w // 2, 1), (w // 2, h - 2), (1, h // 2), (w - 2, h // 2)]
    for sx, sy in seeds:
        if wl[sx, sy] == 0: ImageDraw.floodfill(work, (sx, sy), 128, thresh=0)
    solid = work.point(lambda v: 0 if v == 128 else 255)   # rock + every enclosed pocket

    punched = 0
    if punch_holes:
        # Enclosed pockets big enough to matter, then keep only the background-coloured ones.
        enclosed = ImageChops.subtract(solid, fg)
        scan = _dil(_ero(enclosed, 5), 5)      # opening: drops crack lines and dark facet slivers
        holes = Image.new("L", (w, h), 0)
        area = w * h
        step = max(2, min(w, h) // 200)
        sl = scan.load()
        for y in range(0, h, step):
            for x in range(0, w, step):
                if sl[x, y] != 255: continue
                ImageDraw.floodfill(scan, (x, y), 200, thresh=0)
                comp = scan.point(lambda v: 255 if v == 200 else 0)
                n = comp.histogram()[255]
                if n / area >= hole_min and abs(_mean_over(L, comp, n) - bg) <= hole_tol:
                    holes = ImageChops.lighter(holes, comp); punched += 1
                scan = ImageChops.subtract(scan, comp)     # 200 - 255 clamps to 0: component done
                sl = scan.load()
        solid = ImageChops.subtract(solid, holes)
    a = solid.filter(ImageFilter.GaussianBlur(feather))
    out = im.convert("RGBA"); out.putalpha(a)
    bb = solid.getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        out = out.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    return out, {"bg": bg, "otsu": T, "light_bg": light_bg, "holes": punched}

def despeckle(im, min_frac=0.05, pad=2):
    """Drop detached fragments much smaller than the main mass, then re-crop.

    Serves the no-base rule directly: FLUX keeps scattering loose shards and pebbles along the
    bottom edge, and a scatter of rubble under a rock IS the "sitting on the ground" read the
    owner asked to lose. Also clears the corner slivers of any backdrop plate the key let through.
    """
    a = im.getchannel("A")
    mask = a.point(lambda v: 255 if v > 128 else 0)
    scan = mask.copy(); sl = scan.load()
    w, h = mask.size
    comps = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if sl[x, y] != 255: continue
            ImageDraw.floodfill(scan, (x, y), 200, thresh=0)
            comp = scan.point(lambda v: 255 if v == 200 else 0)
            comps.append((comp.histogram()[255], comp))
            scan = ImageChops.subtract(scan, comp); sl = scan.load()
    if not comps: return im, 0
    biggest = max(c[0] for c in comps)
    keep = Image.new("L", (w, h), 0)
    dropped = 0
    for n, comp in comps:
        if n >= biggest * min_frac: keep = ImageChops.lighter(keep, comp)
        else: dropped += 1
    out = im.copy()
    out.putalpha(ImageChops.multiply(a, keep))
    bb = keep.getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        out = out.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    return out, dropped

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

def process(name, punch):
    """Cut + tone an already-downloaded raw. Split out so a re-cut needs no new render."""
    raw = RAWDIR / f"v3-{name}.png"
    im = Image.open(raw)
    cut, info = cutout(im, punch_holes=punch)
    clean, dropped = despeckle(fit(cut))
    toned, g = tone(clean)
    toned.save(OUTDIR / f"v3-{name}.png")
    log(f"{name}: {im.size} -> {toned.size}  gamma {g:.2f}  -{dropped} frags  {info}")

def main():
    only = sys.argv[1:]
    if only and only[0] == "--recut":
        for name, _, _, punch, _ in BRIEFS:
            if len(only) > 1 and name not in only[1:]: continue
            if (RAWDIR / f"v3-{name}.png").exists(): process(name, punch)
        return
    if not TOKEN:
        log("no REPLICATE_API_TOKEN"); sys.exit(1)
    jobs = []
    for name, aspect, brief, punch, seed in BRIEFS:
        if only and name not in only: continue
        prompt = f"{brief}. {STYLE}. {NO_WARM}. {NO_GROUND}"
        d = create(prompt, aspect, seed)
        url = (d.get("urls") or {}).get("get")
        log(f"submit {name} ({aspect}) -> {d.get('status')} {'' if url else json.dumps(d)[:200]}")
        if url: jobs.append((name, url, punch))
        time.sleep(1)
    n = 0
    for name, url, punch in jobs:
        d = poll(url)
        if d.get("status") != "succeeded":
            log(f"{name}: {d.get('status')} {str(d.get('error'))[:160]}"); continue
        out = d.get("output"); src = out[0] if isinstance(out, list) else out
        raw = RAWDIR / f"v3-{name}.png"
        for attempt in range(3):
            subprocess.run(["curl", "-sS", "--cacert", CA, "-o", str(raw), src], check=False)
            try:
                Image.open(raw).load(); break
            except Exception as e:
                log(f"{name}: download retry {attempt + 1} ({e})"); time.sleep(2)
        try: process(name, punch)
        except Exception as e: log(f"{name}: process failed {e}"); continue
        n += 1
    log(f"done: {n} options")

if __name__ == "__main__":
    main()
