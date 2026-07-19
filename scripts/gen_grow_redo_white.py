#!/usr/bin/env python3
# REDO art for 3 grow cards the owner rejected: turgor-thrust, translocation-cord,
# explorer-cord. Owner brief: "more options, less stylized, WHITE mycelium hyphae."
# So: white (not mint) hyphae as the one bright element, naturalistic / macro-photographic
# render (NOT painterly, not stylized), on the same deep-earth ground. 4 options each ->
# assets/card_options/<slug>-w<n>.jpg (kept separate from the old -N options).
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("REDOLOG", "/tmp/grow_redo_white.log")
MODEL = "black-forest-labs/flux-1.1-pro"

# WHITE + LESS-STYLIZED style. White hyphae are the one bright element; realistic macro
# render, not painterly. Same "hyphae, never mushrooms" hard constraint.
STYLE = ("dark deep-earth soil cross-section, luminous pure WHITE mycelium hyphae as the "
         "single brightest element, bright glowing white fungal threads, cool near-black "
         "soil background, only faint minimal cool bioluminescent ambience, naturalistic "
         "macro-photographic rendering, realistic and detailed, clean simple composition, "
         "NOT painterly, not stylized, subtle soft glow, "
         "ONLY thread-like fungal hyphae that taper to fine sharp POINTED TIPS, "
         "no mushroom, no mushroom cap, no stem, no gills, no fruiting body, not a mushroom, "
         "no coloured tint on the hyphae, keep the hyphae white, no text, no watermark, no border")

LENS = [
    "clean macro photograph, shallow depth of field, dark out-of-focus background",
    "wide detailed establishing shot with depth, realistic lighting",
    "extreme macro close-up on the advancing growing tips, crisp focus",
    "side profile with strong forward motion, minimal composition, lots of dark negative space",
]

CARDS = [
    ("turgor-thrust",
     "a single taut swollen WHITE mycelial hypha driven forward by turgor pressure through "
     "dark earth, hydrostatic pressure ramming the filament ahead as it tapers to one sharp "
     "pointed thread tip, tiny dew-like water droplets along it"),
    ("translocation-cord",
     "a thick differentiated WHITE mycelial cord of bundled parallel hyphae running in bulk "
     "along its length across dark soil, the cord fanning out at its far end into many fine "
     "pointed white thread tips, long-distance transport"),
    ("explorer-cord",
     "a persistent standing WHITE mycelial cord repeatedly sending long exploratory runner "
     "hyphae into dark soil, a white cord with many fine pointed thread tips fanning ahead "
     "across the earth, a permanent foraging network"),
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"3:2","output_format":"png","safety_tolerance":5,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(120):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def save_jpg(url, dest, width=620, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width: im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

def gen_one(slug, subject, n, seed):
    dest = OUTDIR / f"{slug}-w{n}.jpg"
    prompt = f"{subject}, {LENS[n-1]}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt*911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get:
            log(f"{dest.name}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save_jpg(url, str(dest)); log(f"OK {dest.name} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e: log(f"{dest.name}: dl error {e}")
        else:
            log(f"{dest.name}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL {dest.name}"); return None

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for ci,(slug,subject) in enumerate(CARDS):
        for n in (1,2,3,4):
            gen_one(slug, subject, n, seed=4200 + ci*131 + n*17)
            time.sleep(2)
    log("REDO WHITE DONE")

if __name__ == "__main__":
    main()
