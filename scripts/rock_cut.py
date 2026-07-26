#!/usr/bin/env python3
"""Cut a FLUX rock render to a clean transparent sprite, and apply tuner settings.

Two jobs, deliberately separate:

  cut     raw render -> transparent PNG. Geometry only. Colour is left EXACTLY as rendered.
  finals  transparent PNG + a settings JSON from docs/rock-tuner.html -> shipping sprite.

Why the split: the previous pipeline baked a brightness/contrast pass into the cut, which
gamma-darkened every sprite and round-tripped it through HSV. That crushed the shadows and
quantised the hue, so the whole batch came back grainy and off-palette. Tone is now the
owner's call, made in the tuner against the shipped sprites, and applied here from their JSON.

THE FEATHERING FIX (the thing that was actually wrong):

  1. The matte was Gaussian-blurred BEFORE the downscale, so a 1px softness at key resolution
     became a 3px smear at 640 — visible mush around every edge.
  2. The RGBA was resized with straight (un-premultiplied) alpha. Under a transparent pixel the
     RGB still holds the FLUX backdrop, and LANCZOS happily mixes it into the edge — which is
     where the dark//pale halo came from. Premultiplying first makes the backdrop contribute
     nothing, because it is multiplied by alpha 0.

  So: key HARD at full resolution, premultiply, downscale RGB and alpha together, then
  un-premultiply. The LANCZOS downscale of a hard mask IS the antialiasing — free, correct,
  and exactly one pixel wide. No explicit feather at all unless the tuner asks for one.
"""
import json, math, sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageMath

ROOT = Path(__file__).resolve().parents[1]
RAWDIRS = [ROOT / "scratchpad" / "veined_raw3", ROOT / "scratchpad" / "veined_raw2",
           ROOT / "scratchpad" / "veined_raw"]

# ---------------------------------------------------------------- keying helpers

def border_median(L):
    w, h = L.size; lp = L.load()
    vals = []
    for x in range(0, w, max(1, w // 200)): vals += [lp[x, 2], lp[x, h - 3]]
    for y in range(0, h, max(1, h // 200)): vals += [lp[2, y], lp[w - 3, y]]
    vals.sort()
    return vals[len(vals) // 2]

def otsu(L):
    """Histogram split, used ONLY to decide which side of the threshold the rock is on."""
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

def _unpremultiply(pm, a):
    """straight = premultiplied / alpha, per channel, at C speed."""
    out = []
    ai = a.convert("I")
    for ch in pm.split():
        out.append(ImageMath.lambda_eval(
            lambda k: k["convert"](k["min"](k["c"] * 255 / k["max"](k["a"], 1), 255), "L"),
            c=ch.convert("I"), a=ai))
    return Image.merge("RGB", out)

def cut(raw, long_side=640, margin=20, close=2, punch_holes=False, shrink=1.0,
        hole_tol=14, hole_min=0.01, despeckle_frac=0.05, pad=2):
    im = Image.open(raw).convert("RGB")
    w, h = im.size
    L = im.convert("L")
    bg = border_median(L); T = otsu(L)
    light_bg = bg > T
    # Otsu picks the SIDE; the cut itself hugs the background level. Thresholding at Otsu
    # splits dark-rock-body from lit-facet instead of rock from background, which chews the
    # stone away and leaves floating veins.
    if light_bg: mask = L.point(lambda v: 255 if v < bg - margin else 0)
    else:        mask = L.point(lambda v: 255 if v > bg + margin else 0)
    # Just enough closing to seal pinholes. The old 7 iterations of a 5px kernel (~28px) rounded
    # the silhouette off and then eroded it back lumpy.
    for _ in range(close): mask = mask.filter(ImageFilter.MaxFilter(3))
    for _ in range(close): mask = mask.filter(ImageFilter.MinFilter(3))

    work = mask.copy(); wl = work.load()
    for sx, sy in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2),
                   (w // 2, 1), (w // 2, h - 2), (1, h // 2), (w - 2, h // 2)]:
        if wl[sx, sy] == 0: ImageDraw.floodfill(work, (sx, sy), 128, thresh=0)
    solid = work.point(lambda v: 0 if v == 128 else 255)

    if punch_holes:
        enclosed = ImageChops.subtract(solid, mask)
        scan = enclosed
        for _ in range(4): scan = scan.filter(ImageFilter.MinFilter(3))
        for _ in range(4): scan = scan.filter(ImageFilter.MaxFilter(3))
        holes = Image.new("L", (w, h), 0)
        # Measured against the ROCK's own area, not the frame. As a fraction of the frame the
        # bar moves with however much empty margin the render happened to leave: honeycomb2's
        # five holes came to 0.54% of a 2752x1536 canvas and missed a 0.6% floor by a hair, so
        # they shipped as opaque black recesses instead of holes.
        area = max(1, solid.histogram()[255])
        sl = scan.load(); step = max(2, min(w, h) // 200)
        for y in range(0, h, step):
            for x in range(0, w, step):
                if sl[x, y] != 255: continue
                ImageDraw.floodfill(scan, (x, y), 200, thresh=0)
                comp = scan.point(lambda v: 255 if v == 200 else 0)
                n = comp.histogram()[255]
                if n / area >= hole_min:
                    st = ImageChops.multiply(L, comp)
                    hh = st.histogram(); hh[0] = 0
                    if abs(sum(i * c for i, c in enumerate(hh)) / max(1, n) - bg) <= hole_tol:
                        holes = ImageChops.lighter(holes, comp)
                scan = ImageChops.subtract(scan, comp); sl = scan.load()
        solid = ImageChops.subtract(solid, holes)

    if despeckle_frac > 0:
        # A scatter of loose rubble under a rock IS the "sitting on the ground" read these
        # sprites must not have, so anything far smaller than the main mass goes.
        scan = solid.copy(); sl = scan.load()
        comps = []
        for y in range(0, h, 3):
            for x in range(0, w, 3):
                if sl[x, y] != 255: continue
                ImageDraw.floodfill(scan, (x, y), 200, thresh=0)
                comp = scan.point(lambda v: 255 if v == 200 else 0)
                comps.append((comp.histogram()[255], comp))
                scan = ImageChops.subtract(scan, comp); sl = scan.load()
        if comps:
            biggest = max(c[0] for c in comps)
            solid = Image.new("L", (w, h), 0)
            for n, comp in comps:
                if n >= biggest * despeckle_frac: solid = ImageChops.lighter(solid, comp)

    bb = solid.getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        box = (max(0, x0 - 2), max(0, y0 - 2), min(w, x1 + 2), min(h, y1 + 2))
        im = im.crop(box); solid = solid.crop(box); w, h = solid.size

    sc = long_side / max(w, h)
    # Erode past the render's own dark outline. FLUX paints a dark rim around the rock, and a
    # threshold that hugs the background keeps it, so the sprite ships wearing a dark halo:
    # measured, edge pixels came out 20-35 luma DARKER than the interior they belong to, where
    # the shipped rockform1/5 are ~90 BRIGHTER (their art has a bright cyan rim). `shrink` is
    # given in OUTPUT pixels and scaled up, so it means the same thing at any render size.
    er = int(round(shrink / sc))
    for _ in range(er): solid = solid.filter(ImageFilter.MinFilter(3))

    # --- premultiply -> downscale (BOX) -> un-premultiply ----------------------------------
    # Downscale with a BOX (area-average) filter, NOT LANCZOS. LANCZOS has negative lobes: on a
    # sprite with bright cyan veins right up against the transparent edge, its ringing pulls that
    # colour a pixel or two past the true silhouette and deposits faint, saturated specks in
    # empty space — and the un-premultiply then AMPLIFIES them (small value / tiny alpha). That
    # speckle halo was the "feathering". Measured, LANCZOS left ~3900 saturated floating specks
    # on horseshoe; BOX leaves ~40 (genuine partial-coverage AA, not ringing). BOX is the ideal
    # area resample for a pure downscale and rings not at all.
    sz = (max(1, round(w * sc)), max(1, round(h * sc)))
    pm = Image.merge("RGB", [ImageChops.multiply(c, solid) for c in im.split()])
    a_s = solid.resize(sz, Image.BOX)
    pm_s = pm.resize(sz, Image.BOX)
    out = _unpremultiply(pm_s, a_s).convert("RGBA")
    # Floor away the last of the sub-visible dust (a genuine 1/255 sliver reads as nothing but
    # keeps the file from carrying stray colour). Anything with real coverage is well above this.
    a_s = a_s.point(lambda v: 0 if v < 6 else v)
    out.putalpha(a_s)
    return out, {"bg": bg, "otsu": T, "light_bg": light_bg}

# ---------------------------------------------------------------- tuner settings

DEFAULTS = {"exposure": 0.0, "gamma": 1.0, "contrast": 1.0, "saturation": 1.0, "hue": 0.0,
            "feather": 0.0, "alphaLow": 0.0, "alphaHigh": 1.0}

def _box3(a, r):
    """Three box passes ~= a gaussian. Chosen over PIL's GaussianBlur so the tuner's JS and
    this can be bit-comparable — the browser has no GaussianBlur to match."""
    if r <= 0: return a
    for _ in range(3):
        a = a.filter(ImageFilter.BoxBlur(r))
    return a

def _hue_matrix(deg):
    """Same rotation CSS/SVG hue-rotate uses, so the tuner preview and this agree."""
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    ]

def apply_settings(im, s):
    """Mirror of applyOne() in docs/rock-tuner.html. Order is fixed and must not drift:
    alpha feather -> alpha levels -> exposure -> gamma -> contrast -> saturation -> hue."""
    st = dict(DEFAULTS); st.update(s or {})
    im = im.convert("RGBA")
    a = im.getchannel("A")
    if st["feather"] > 0: a = _box3(a, int(round(st["feather"])))
    lo, hi = st["alphaLow"], st["alphaHigh"]
    if lo > 0 or hi < 1:
        span = max(1e-6, hi - lo)
        a = a.point([max(0, min(255, round(255 * ((i / 255) - lo) / span))) for i in range(256)])

    ex = 2.0 ** st["exposure"]; gm = st["gamma"]; ct = st["contrast"]
    lut = []
    for i in range(256):
        v = (i / 255) * ex
        v = max(0.0, min(1.0, v)) ** gm
        v = (v - 0.5) * ct + 0.5
        lut.append(max(0, min(255, round(v * 255))))
    rgb = im.convert("RGB").point(lut * 3)

    sat, hue = st["saturation"], st["hue"]
    if sat != 1.0 or hue != 0.0:
        # saturation as a matrix too, so it composes with hue in one pass (matching the JS)
        lr, lg, lb = 0.299, 0.587, 0.114
        m = [lr + sat * (1 - lr), lg * (1 - sat), lb * (1 - sat),
             lr * (1 - sat), lg + sat * (1 - lg), lb * (1 - sat),
             lr * (1 - sat), lg * (1 - sat), lb + sat * (1 - lb)]
        if hue != 0.0:
            hm = _hue_matrix(hue)
            m = [sum(hm[row * 3 + k] * m[k * 3 + col] for k in range(3))
                 for row in range(3) for col in range(3)]
        rgb = rgb.convert("RGB", (m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0))
    out = rgb.convert("RGBA"); out.putalpha(a)
    return out

# ---------------------------------------------------------------- CLI

def find_raw(name):
    for d in RAWDIRS:
        for stem in (f"v3-{name}", f"v2-{name}", f"veined-{name}", name):
            p = d / f"{stem}.png"
            if p.exists(): return p
    return None

def main():
    if len(sys.argv) < 2:
        print(__doc__); return
    cmd = sys.argv[1]
    if cmd == "cut":
        outdir = ROOT / "assets" / "rock_candidates"
        outdir.mkdir(parents=True, exist_ok=True)
        punch = set(a[1:] for a in sys.argv[2:] if a.startswith("+"))
        for name in [a for a in sys.argv[2:] if not a.startswith("+")]:
            raw = find_raw(name)
            if not raw: print(f"{name}: no raw found"); continue
            im, info = cut(raw, punch_holes=(name in punch))
            im.save(outdir / f"{name}.png")
            print(f"{name}: {Image.open(raw).size} -> {im.size}  {info}")
    elif cmd == "finals":
        cfg = json.loads(Path(sys.argv[2]).read_text())
        src = ROOT / "assets" / "rock_candidates"
        outdir = ROOT / (sys.argv[3] if len(sys.argv) > 3 else "assets/rock_finals")
        outdir.mkdir(parents=True, exist_ok=True)
        base = cfg.get("all") or cfg.get("defaults") or {}
        for name, s in (cfg.get("perImage") or {}).items():
            p = src / f"{name}.png"
            if not p.exists(): print(f"{name}: missing candidate"); continue
            merged = dict(base); merged.update(s or {})
            apply_settings(Image.open(p), merged).save(outdir / f"{name}.png")
            print(f"{name}: tuned -> {outdir.relative_to(ROOT)}/{name}.png  {merged}")
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
