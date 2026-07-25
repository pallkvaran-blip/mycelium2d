#!/usr/bin/env python3
# Troll rockface BATCH 4 — owner: batch 3 was "too dark and too high definition compared
# to the rest of our assets." Match the in-game rocks (rockMossy / rockBasalt / rockSlate):
# MEDIUM grey (NOT near-black), SOFT painterly low-detail with big chunky facets (NOT
# photoreal fine texture, NOT sharp deep cracks), gentle moss, very subtle face.
# FLUX 1.1 PRO ULTRA raw:false + heavy flatten post (downscale to kill grain, posterize,
# lift toward mid-grey). Saves RAW crops to scratchpad so post can be re-tuned offline.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "rock_options"
RAWDIR = ROOT / "scratchpad" / "troll_raw"
OUTDIR.mkdir(parents=True, exist_ok=True); RAWDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("ROCKLOG", "/tmp/troll_rock2.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

# Flat, medium-grey, low-detail hand-painted GAME rock (match rockBasalt/rockMossy) on black.
STYLE = ("hand-painted 2D game-art boulder sprite, flat cel-shaded soft airbrushed shading, "
         "VERY LOW detail, big smooth chunky rounded facets, NO fine texture, NO grain, NO "
         "photoreal detail, NO sharp deep cracks, matte finish, a MEDIUM neutral GREY stone "
         "(mid-grey weathered granite, NOT black, NOT dark, NOT charcoal), soft gentle "
         "shading, patches of soft dark-green moss on top like a mossy underground boulder, "
         "simple mobile-game rock look, solid pure black background, centered, single rock, "
         "no text, no watermark, no border, no people")

# Barely-there face — a plain mossy grey boulder that only might hint at a sleepy look.
SUBJECT = ("an ordinary plain medium-grey mossy boulder, essentially just a normal soft "
           "underground rock; at most the faintest soft shadow between its facets could be "
           "imagined as a calm sleeping face, but NO eyes, NO glowing eyes, NO carved nose "
           "or mouth, nothing golem-like or monstrous — a player should simply see a soft "
           "grey mossy rock. The face is almost invisible")

VARIANTS = [
    ("a plain rounded grey boulder, big soft facets, no discernible face", 7100),
    ("a chunky grey boulder, gentle facet shadows, only the faintest sleepy hint", 7280),
    ("a soft rounded mossy grey boulder, extremely subtle calm impression", 7460),
    ("a broad grey boulder, moss over the crown, nearly featureless face", 7640),
    ("a smooth grey river-worn boulder, the calmest faint sleeping suggestion", 7820),
    ("a squat grey boulder, soft chunky planes, moss skirt, face barely there", 8000),
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","120","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"1:1","raw":False,
                                "output_format":"png","safety_tolerance":6,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body, f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(150):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

# ---- flatten: push a photoreal FLUX render toward the game's flat low-detail look ----
def flatten(im, down=210, bright=1.12, contrast=0.92, color=0.50, poster=6):
    small = im.resize((down, down), Image.BILINEAR)          # kill high-freq grain
    im = small.resize((480, 480), Image.BILINEAR)
    im = im.filter(ImageFilter.GaussianBlur(0.8))            # soften facet edges
    im = ImageEnhance.Brightness(im).enhance(bright)         # lift toward mid-grey
    im = ImageEnhance.Contrast(im).enhance(contrast)         # flatten tonal range
    im = ImageEnhance.Color(im).enhance(color)               # slight desaturate
    im = ImageOps.posterize(im, poster)                      # cel-shaded stepped tones
    return im

# ---- solid-silhouette cutout (binary threshold + morphological close), reused from recut ----
def _dil(m,it):
    for _ in range(it): m=m.filter(ImageFilter.MaxFilter(5))
    return m
def _ero(m,it):
    for _ in range(it): m=m.filter(ImageFilter.MinFilter(5))
    return m
def cutout(im, dest, T=None, pad=8, feather=1.2, close=9, margin=22):
    im = im.convert("RGB"); w,h = im.size
    L = im.convert("L"); lp = L.load()
    # ADAPTIVE threshold: FLUX doesn't always honour "pure black background" — sometimes it
    # renders a mid-grey backdrop. Sample the corner luminance and key just above it, so the
    # cutout works whether the bg is near-black (~8) or grey (~60). A fixed low T would treat
    # a grey backdrop as foreground and leave the whole image opaque.
    corners = [lp[3,3], lp[w-4,3], lp[3,h-4], lp[w-4,h-4]]
    corners.sort(); bg_lum = corners[1]              # median-ish of the 4 corners
    Teff = (bg_lum + margin) if T is None else T
    fg = Image.new("L",(w,h),0); fp=fg.load()
    for y in range(h):
        for x in range(w):
            if lp[x,y] > Teff: fp[x,y]=255
    fg = _ero(_dil(fg,close),close)
    work = fg.copy(); wl=work.load()
    seeds=[(1,1),(w-2,1),(1,h-2),(w-2,h-2),(w//2,1),(w//2,h-2),(1,h//2),(w-2,h//2)]
    for s in seeds:
        if wl[s[0],s[1]]==0: ImageDraw.floodfill(work,s,128,thresh=0)
    # SOLID = rock + its interior holes (everything the border-flood did NOT reach)
    solid = Image.eval(work, lambda v: 0 if v == 128 else 255)
    # keep ONLY the largest/central blob — drops disconnected debris (e.g. loose grass-skirt
    # fragments) that would otherwise float beside the rock.
    sp = solid.load(); sx=sy=cnt=0
    for y in range(0,h,3):
        for x in range(0,w,3):
            if sp[x,y]==255: sx+=x; sy+=y; cnt+=1
    if cnt:
        cx,cy = sx//cnt, sy//cnt
        if sp[cx,cy]!=255:                       # snap seed onto the blob if centroid lands in a hole
            best=None
            for yy in range(0,h,2):
                for xx in range(0,w,2):
                    if sp[xx,yy]==255:
                        d=(xx-cx)**2+(yy-cy)**2
                        if best is None or d<best[0]: best=(d,xx,yy)
            if best: cx,cy=best[1],best[2]
        ImageDraw.floodfill(solid,(cx,cy),128,thresh=0)   # main blob -> 128
    alpha = Image.eval(solid, lambda v: 255 if v==128 else 0)
    alpha=alpha.filter(ImageFilter.GaussianBlur(feather))
    out=im.convert("RGBA"); out.putalpha(alpha)
    bb=out.getbbox()
    if bb:
        bb=(max(0,bb[0]-pad),max(0,bb[1]-pad),min(w,bb[2]+pad),min(h,bb[3]+pad)); out=out.crop(bb)
    out.save(dest,"PNG")

def save_variants(url, n):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","150","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    s = min(im.width, im.height)
    im = im.crop(((im.width-s)//2,(im.height-s)//2,(im.width-s)//2+s,(im.height-s)//2+s)).resize((480,480), Image.LANCZOS)
    im.save(RAWDIR / f"raw-{n}.jpg","JPEG",quality=92)        # keep raw for offline re-tune
    flat = flatten(im)
    flat.save(OUTDIR / f"troll-r{n}.jpg","JPEG",quality=90)
    cutout(flat, str(OUTDIR / f"troll-r{n}.png"))
    os.remove(tmp)

def gen_one(n, variant, seed):
    prompt = f"{SUBJECT}, {variant}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt*911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get: log(f"r{n}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save_variants(url, n); log(f"OK r{n}"); return
            except Exception as e: log(f"r{n}: dl error {e}")
        else: log(f"r{n}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL r{n}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n,(variant,seed) in enumerate(VARIANTS, start=1):
        gen_one(n, variant, seed); time.sleep(2)
    log("BATCH 4 DONE")

if __name__ == "__main__":
    main()
