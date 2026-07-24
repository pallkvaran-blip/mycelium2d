#!/usr/bin/env python3
# Five "troll rockface" sprite options for the Magic Mushroom (Psilocybe cubensis)
# level-1 UNLOCK object. A natural boulder whose cracks/hollows happen to suggest a
# subtle troll face (Nordic folklore pareidolia rock). FLUX 1.1 PRO ULTRA + raw
# (most photoreal). Output -> assets/rock_options/troll-r<n>.jpg (raw) +
# troll-r<n>.png (soft-edged circular alpha cutout, ready to drop into soil) +
# a labelled contact sheet. Owner picks the winner; it gets promoted to
# assets/rockface/troll.png separately.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "rock_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("ROCKLOG", "/tmp/troll_rock.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = ("professional macro nature photography, shot on a full-frame DSLR, natural "
         "soft daylight, realistic shallow depth of field, true-to-life stone and moss "
         "texture, crisp fine detail, National Geographic style, photorealistic, no "
         "illustration, no CGI, no carving, no text, no watermark, no border, no people")

# The pareidolia boulder: a natural rock that merely SEEMS to have a face in it.
SUBJECT = ("a single weathered rounded granite boulder resting on dark damp woodland "
           "soil, patched with green and grey moss and lichen, the rock's own natural "
           "cracks shadowed hollows and bumps happen to form the subtle suggestion of "
           "a grumpy old troll's face - two deep shadowed hollows like sunken eyes, a "
           "jutting weathered ridge like a broad nose, a long horizontal crevice like a "
           "downturned mouth - an ancient Nordic folklore troll stone, natural "
           "pareidolia, the face is subtle and accidental not sculpted, the mossy "
           "boulder is the single clear hero of the image, centered, plain dark "
           "out-of-focus earthy background")

VARIANTS = [
    ("eye-level straight-on, the face reads clearly head-on, even overcast light", 4100),
    ("slight three-quarter angle, warm low side light raking across the stone to deepen the eye hollows", 4270),
    ("more moss and lichen creeping like eyebrows and a beard around the face, soft misty forest light", 4440),
    ("a craggier angular granite boulder, harder shadows carving a sterner troll scowl, cool blue-grey daylight", 4610),
    ("a rounder smoother river boulder, gentler kinder troll face, dappled golden woodland light", 4780),
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","120","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"1:1","raw":True,
                                "output_format":"png","safety_tolerance":6,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(150):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def save_png(url, dest, size=640):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","150","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    # square center-crop then downscale
    s = min(im.width, im.height)
    im = im.crop(((im.width-s)//2, (im.height-s)//2, (im.width-s)//2+s, (im.height-s)//2+s))
    im = im.resize((size, size), Image.LANCZOS)
    im.save(dest, "PNG"); os.remove(tmp)
    return im

def soft_cutout(im, dest):
    """Radial alpha vignette -> a soft-edged circular sprite that drops into soil
    with no hard rectangle edge (final in-game glow is drawn separately)."""
    size = im.size[0]
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    # opaque out to ~44% radius, fading to 0 by ~50%
    d.ellipse([size*0.06, size*0.06, size*0.94, size*0.94], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(size*0.045))
    out = im.convert("RGBA"); out.putalpha(mask)
    out.save(dest, "PNG")

def gen_one(n, variant, seed):
    raw = OUTDIR / f"troll-r{n}.jpg"
    png = OUTDIR / f"troll-r{n}.png"
    if png.exists(): log(f"skip troll-r{n} (exists)"); return png
    prompt = f"{SUBJECT}, {variant}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt*911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get:
            log(f"troll-r{n}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try:
                im = save_png(url, str(raw).replace('.jpg','.png').replace('troll-r','_full-troll-r'))
                Image.open(str(raw).replace('.jpg','.png').replace('troll-r','_full-troll-r')).convert("RGB").save(raw,"JPEG",quality=90)
                soft_cutout(im, str(png))
                log(f"OK troll-r{n} {png.stat().st_size//1024}KB"); return png
            except Exception as e: log(f"troll-r{n}: dl error {e}")
        else:
            log(f"troll-r{n}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL troll-r{n}"); return None

def label(im, text):
    d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except Exception: font = ImageFont.load_default()
    d.rectangle([0,0,min(im.width, 12+len(text)*14), 36], fill=(0,0,0))
    d.text((8,5), text, fill=(255,255,255), font=font)
    return im

def sheet():
    cells = []
    for n in range(1,6):
        p = OUTDIR / f"troll-r{n}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB")
        cw = 340; im = im.resize((cw, round(im.height*cw/im.width)), Image.LANCZOS)
        cells.append(label(im, f"ROCK #{n}"))
    if not cells: return None
    ch = max(c.height for c in cells); cw = 340
    per = min(len(cells), 5)
    sh = Image.new("RGB", (cw*per+6*(per+1), ch+12), (18,18,20))
    for i,c in enumerate(cells): sh.paste(c, (6+i*(cw+6), 6))
    out = OUTDIR / "_sheet_troll.png"; sh.save(out, "PNG"); log(f"SHEET -> {out}"); return out

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n,(variant,seed) in enumerate(VARIANTS, start=1):
        gen_one(n, variant, seed); time.sleep(2)
    sheet()
    log("TROLL ROCK DONE")

if __name__ == "__main__":
    main()
