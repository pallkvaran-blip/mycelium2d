#!/usr/bin/env python3
# Perennial Decoy — BATCH 3 (ACORN-FOCUSED, real-life). Owner: keep it real-life + acorn
# themed, but distinct from Decoy Cache (which is a mixed berry/nut pile). So this batch is
# PREDOMINANTLY ACORNS — a generous established acorn hoard with just a hint of pale
# mycelial thread (the colony-engine signal). -> assets/card_options/perennial-decoy-c<n>.jpg
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("PDLOG", "/tmp/perennial_decoy_c.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = ("professional macro nature photography, shot on a full-frame DSLR with a "
         "100mm macro lens, natural soft daylight, realistic shallow depth of field, "
         "true-to-life textures, crisp fine detail, tiny dew droplets, authentic "
         "damp woodland forest floor with dark soil, moss and scattered oak leaves, "
         "National Geographic style, photorealistic, no illustration, no CGI, no "
         "text, no watermark, no border, no mushroom")

LENS = [
    "eye-level macro, the acorn hoard centered and sharp, soft creamy forest bokeh behind",
    "slightly high three-quarter angle looking down on the hoard, scattered oak leaves around it",
    "low three-quarter angle with warm woodland light rim-lighting the glossy acorns",
]

# PREDOMINANTLY ACORNS — clearly an acorn hoard, not a berry mix.
SUBJECT = ("a large established acorn hoard, a generous heaped cache of many glossy "
           "brown oak acorns most still wearing their textured cupule caps, tightly "
           "piled together with only a few small hazelnuts tucked in, lightly bound "
           "with a few fine pale mycelial threads, resting on dark damp mossy forest "
           "soil, fresh and dewy, the acorn hoard is the single clear hero of the image")

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
    dest = OUTDIR / f"{slug}-c{n}.jpg"
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

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n in (1,2,3):
        gen_one("perennial-decoy", SUBJECT, n, seed=21200 + n*31); time.sleep(2)
    log("PERENNIAL DECOY C DONE")

if __name__ == "__main__":
    main()
