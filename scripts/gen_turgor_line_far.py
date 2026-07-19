#!/usr/bin/env python3
# Turgor LINE redo: a SINGLE long white hyphal line receding into the distance (the card is a
# "line"). 4 options -> assets/card_options/turgor-line-x<n>.jpg
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("TLFARLOG", "/tmp/turgor_line_far.log")
MODEL = "black-forest-labs/flux-1.1-pro"

STYLE = ("dark deep-earth soil cross-section, luminous pure WHITE mycelium as the single brightest "
         "element, one bright glowing white fungal thread, cool near-black soil, only faint minimal "
         "cool bioluminescent ambience, naturalistic macro-photographic rendering, realistic and "
         "detailed, clean simple composition, NOT painterly, not stylized, subtle soft glow, "
         "ONLY a single thread-like fungal hypha tapering to a fine sharp POINTED TIP, "
         "no mushroom, no mushroom cap, no stem, no gills, no fruiting body, not a mushroom, "
         "no coloured tint on the hypha, keep the hypha white, no text, no watermark, no border")

SUBJECT = ("a SINGLE long straight WHITE mycelial hyphal LINE running far off into the distance "
           "across dark earth, one taut pressurised filament receding toward a distant vanishing "
           "point, tiny dew droplets beaded along it, ending in a fine pointed thread tip a great "
           "distance away, a long supply line stretching into the depths")

LENS = [
    "dramatic one-point perspective, the single line receding to a distant vanishing point, deep depth of field",
    "long horizontal composition, one straight white filament crossing from the near foreground into the far dark distance",
    "the single white line stretching away into deep darkness, strong sense of great distance and length",
    "clean minimal wide shot, one very long straight strand disappearing into the distance, lots of dark negative space",
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

def gen_one(n, seed):
    dest = OUTDIR / f"turgor-line-x{n}.jpg"
    prompt = f"{SUBJECT}, {LENS[n-1]}, {STYLE}"
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
    for n in (1,2,3,4):
        gen_one(n, seed=9100 + n*31); time.sleep(2)
    log("TURGOR LINE FAR DONE")

if __name__ == "__main__":
    main()
