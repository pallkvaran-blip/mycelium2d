#!/usr/bin/env python3
# Five "troll rockface" sprite options for the Magic Mushroom (Psilocybe cubensis)
# level-1 UNLOCK object. BATCH 2 (owner feedback): the first batch was photoreal with
# an OBVIOUS sculpted face. Now match the IN-GAME rock sprites (painterly dark-charcoal
# game-art boulders w/ moss, see assets/rockMossy.png / rockform*.png) and make the face
# VERY SUBTLE — mostly an ordinary boulder that only faintly suggests a face.
# FLUX 1.1 PRO ULTRA, raw:false (stylised, not photoreal). Output ->
# assets/rock_options/troll-r<n>.jpg + troll-r<n>.png (soft cutout) + a contact sheet.
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

# Match the in-game rock sprites: painterly game art, dark charcoal faceted stone + moss.
STYLE = ("2D hand-painted game-art rock sprite, painterly semi-realistic fungal-fantasy "
         "illustration (NOT a photograph, no photorealism), a chunky dark charcoal-grey "
         "angular boulder with crisp faceted planes and chipped edges, patches of muted "
         "olive-green and gold moss and lichen, cool near-black deep-earth palette with "
         "soft ambient shadow, clean simple side-view sprite that matches a 2D "
         "side-scroller game boulder, flat plain very dark near-black background, "
         "centered, no text, no watermark, no border, no people, no photograph")

# A mostly-ordinary boulder whose shadows only FAINTLY hint at a face (subtle pareidolia).
SUBJECT = ("a single chunky weathered angular grey boulder, first and foremost an "
           "ordinary mossy game rock; its natural facets and pooled shadow hollows only "
           "VERY FAINTLY and accidentally suggest a sleeping troll's face — the barest "
           "hint of two shadowed eye hollows and a blunt nose ridge that most players "
           "would miss at a glance. It is NOT a carved or sculpted face, there are no "
           "drawn eyes or mouth, only soft accidental shadow shapes; the boulder must "
           "read as a normal rock, the face extremely subtle and easy to overlook")

VARIANTS = [
    ("even flat game lighting, the hint of a face only in the upper facets, lots of moss", 5100),
    ("gentle top-left light, shallow shadow hollows barely reading as eyes, mossy cap", 5270),
    ("cool blue-grey shading, a craggier angular boulder, the face almost imperceptible", 5440),
    ("a rounder smoother boulder, soft rounded facets, only the faintest sleepy face", 5610),
    ("more moss and lichen creeping over the stone, the face nearly hidden under it", 5780),
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

def save_png(url, dest, size=640):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","150","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    s = min(im.width, im.height)
    im = im.crop(((im.width-s)//2, (im.height-s)//2, (im.width-s)//2+s, (im.height-s)//2+s))
    im = im.resize((size, size), Image.LANCZOS)
    im.save(dest, "PNG"); os.remove(tmp)
    return im

def soft_cutout(im, dest):
    size = im.size[0]
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([size*0.06, size*0.06, size*0.94, size*0.94], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(size*0.045))
    out = im.convert("RGBA"); out.putalpha(mask)
    out.save(dest, "PNG")

def gen_one(n, variant, seed):
    raw = OUTDIR / f"troll-r{n}.jpg"
    png = OUTDIR / f"troll-r{n}.png"
    full = OUTDIR / f"_full-troll-r{n}.png"
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
                im = save_png(url, str(full))
                im.save(raw, "JPEG", quality=90)
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
    d.rectangle([0,0,min(im.width, 12+len(text)*14), 36], fill=(0,0,0)); d.text((8,5), text, fill=(255,255,255), font=font)
    return im

def sheet():
    cells = []
    for n in range(1,6):
        p = OUTDIR / f"troll-r{n}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB"); cw = 340; im = im.resize((cw, round(im.height*cw/im.width)), Image.LANCZOS)
        cells.append(label(im, f"ROCK #{n}"))
    if not cells: return None
    ch = max(c.height for c in cells); cw = 340; per = min(len(cells), 5)
    sh = Image.new("RGB", (cw*per+6*(per+1), ch+12), (18,18,20))
    for i,c in enumerate(cells): sh.paste(c, (6+i*(cw+6), 6))
    out = OUTDIR / "_sheet_troll.png"; sh.save(out, "PNG"); log(f"SHEET -> {out}"); return out

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    # overwrite the rejected batch
    for n in range(1,6):
        for ext in ('jpg','png'):
            p = OUTDIR / f"troll-r{n}.{ext}"
            if p.exists(): p.unlink()
    for n,(variant,seed) in enumerate(VARIANTS, start=1):
        gen_one(n, variant, seed); time.sleep(2)
    sheet()
    log("TROLL ROCK DONE")

if __name__ == "__main__":
    main()
