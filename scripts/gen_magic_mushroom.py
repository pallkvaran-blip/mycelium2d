#!/usr/bin/env python3
# Portrait options for the "Magic Mushroom" (Psilocybe cubensis) species — the reddit
# bonus-competition winner. Photorealistic cubensis with a RAINBOW behind and a few
# TINY ELVES / DWARFS peeking at the camera from behind the mushroom stems. FLUX 1.1
# PRO ULTRA + raw. Output -> assets/species_options/psilocybe-cubensis-o<n>.jpg +
# a labelled contact sheet. Owner picks the winner -> assets/species/psilocybe-cubensis.jpg.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("MAGICLOG", "/tmp/magic_mushroom.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = ("professional nature photography, shot on a full-frame DSLR, natural light, "
         "realistic shallow depth of field, true-to-life textures, crisp fine detail, "
         "photorealistic, highly detailed, no text, no watermark, no border")

# Psilocybe cubensis: tall slender stems, golden-brown to caramel domed/bell caps.
SUBJECT = ("a photorealistic close-up photograph of a cluster of Psilocybe cubensis "
           "magic mushrooms with tall slender pale stems and glossy golden-brown "
           "caramel domed caps growing from rich damp mossy woodland earth, a bright "
           "vivid full colour rainbow arcing across the soft-focus sky in the "
           "background, and a few tiny mischievous elves and dwarfs in little pointed "
           "hats hiding and peeking out from behind the mushroom stems, peeking "
           "curiously at the camera from various spots among the mushrooms, whimsical "
           "fairytale scene yet entirely photorealistic")

VARIANTS = [
    ("golden hour warm dreamy light, the tallest mushroom the clear hero", 5100),
    ("cool fresh misty morning light after rain, dewy caps, the rainbow bold and bright", 5310),
    ("low ground-level worms-eye angle looking up past the caps to the rainbow sky", 5520),
    ("lush deep-green mossy forest glade, sun rays through the trees, two elves clearly peeking", 5730),
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
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"3:4","raw":True,
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

def save_jpg(url, dest, width=560, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","150","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width != width:
        im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

def gen_one(n, variant, seed):
    dest = OUTDIR / f"psilocybe-cubensis-o{n}.jpg"
    if dest.exists(): log(f"skip o{n} (exists)"); return dest
    prompt = f"{SUBJECT}, {variant}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt*911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get:
            log(f"o{n}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save_jpg(url, str(dest)); log(f"OK o{n} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e: log(f"o{n}: dl error {e}")
        else:
            log(f"o{n}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL o{n}"); return None

def label(im, text):
    d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except Exception: font = ImageFont.load_default()
    d.rectangle([0,0,min(im.width, 12+len(text)*14), 36], fill=(0,0,0))
    d.text((8,5), text, fill=(255,255,255), font=font)
    return im

def sheet():
    cells = []
    for n in range(1,5):
        p = OUTDIR / f"psilocybe-cubensis-o{n}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB")
        cw = 300; im = im.resize((cw, round(im.height*cw/im.width)), Image.LANCZOS)
        cells.append(label(im, f"MAGIC #{n}"))
    if not cells: return None
    ch = max(c.height for c in cells); cw = 300
    sh = Image.new("RGB", (cw*len(cells)+6*(len(cells)+1), ch+12), (18,18,20))
    for i,c in enumerate(cells): sh.paste(c, (6+i*(cw+6), 6))
    out = OUTDIR / "_sheet_magic.png"; sh.save(out, "PNG"); log(f"SHEET -> {out}"); return out

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n,(variant,seed) in enumerate(VARIANTS, start=1):
        gen_one(n, variant, seed); time.sleep(2)
    sheet()
    log("MAGIC MUSHROOM DONE")

if __name__ == "__main__":
    main()
