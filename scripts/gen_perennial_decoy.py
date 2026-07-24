#!/usr/bin/env python3
# Generate 3 ART OPTIONS for the new "Perennial Decoy" ENGINE card (the installed twin
# of Decoy Cache) via FLUX 1.1 PRO ULTRA + raw -> assets/card_options/perennial-decoy-u<n>.jpg.
# Matches the warm forest-floor CACHE family (see decoy-cache.jpg / acorn-cache.jpg), but
# reads as an ESTABLISHED, colony-tended bait station: a bigger forage mound with fine pale
# mycelial threads woven through it. Owner picks the winner -> assets/cards/perennial-decoy.jpg.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("PDLOG", "/tmp/perennial_decoy.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = ("professional macro nature photography, shot on a full-frame DSLR with a "
         "100mm macro lens, natural soft daylight, realistic shallow depth of field, "
         "true-to-life textures, crisp fine detail, tiny dew droplets, authentic "
         "damp woodland forest floor with vivid green moss and scattered autumn "
         "leaves, National Geographic style, photorealistic, no illustration, no "
         "CGI, no text, no watermark, no border, no mushroom")

LENS = [
    "eye-level macro, the mound centered and sharp, soft creamy forest bokeh behind",
    "slightly high three-quarter angle looking down on the mound on green moss, scattered leaves",
    "low three-quarter angle with warm golden-hour backlight rim-lighting the mound",
]

SUBJECT = ("a large well-established colony-tended bait station on the mossy forest "
           "floor, a generous heaped mound of mixed wild forage — hazelnuts acorns "
           "sunflower seeds and plump ripe red and purple berries — with fine pale "
           "mint-white fungal mycelial threads woven through and around the pile "
           "binding it together, fresh dewy and irresistibly appetising, the forage "
           "mound is the single clear hero of the image")

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","120","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"3:2","raw":True,
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

def save_jpg(url, dest, width=620, q=90):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","150","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width: im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

def gen_one(slug, subject, n, seed):
    dest = OUTDIR / f"{slug}-u{n}.jpg"
    if dest.exists(): log(f"skip {dest.name} (exists)"); return dest
    prompt = f"{subject}, {LENS[n-1]}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt*911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get: log(f"{dest.name}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save_jpg(url, str(dest)); log(f"OK {dest.name} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e: log(f"{dest.name}: dl error {e}")
        else: log(f"{dest.name}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL {dest.name}"); return None

def label(im, text):
    d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    except Exception: font = ImageFont.load_default()
    d.rectangle([0,0,min(im.width, 12+len(text)*15), 40], fill=(0,0,0)); d.text((8,6), text, fill=(255,255,255), font=font)
    return im

def card_sheet(slug):
    cells = []
    for n in (1,2,3):
        p = OUTDIR / f"{slug}-u{n}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB"); cw = 420; im = im.resize((cw, round(im.height*cw/im.width)), Image.LANCZOS)
        cells.append(label(im, f"{slug} ULTRA #{n}"))
    if not cells: return None
    ch = max(c.height for c in cells); cw = 420
    sheet = Image.new("RGB", (cw*len(cells)+6*(len(cells)+1), ch+12), (18,18,20))
    for i,c in enumerate(cells): sheet.paste(c, (6+i*(cw+6), 6))
    out = OUTDIR / f"_sheet_{slug}_ultra.png"; sheet.save(out, "PNG"); log(f"SHEET -> {out}"); return out

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n in (1,2,3):
        gen_one("perennial-decoy", SUBJECT, n, seed=9300 + n*17); time.sleep(2)
    card_sheet("perennial-decoy")
    log("PERENNIAL DECOY DONE")

if __name__ == "__main__":
    main()
