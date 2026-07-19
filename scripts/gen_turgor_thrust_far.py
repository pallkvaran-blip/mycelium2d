#!/usr/bin/env python3
# Round-3 redo for turgor-thrust only. Owner: "more options, white mycelium STRETCHING FAR."
# So: a single long white hypha reaching a great distance across dark earth, white as the one
# bright element, naturalistic (not stylized). 4 options -> assets/card_options/turgor-thrust-x<n>.jpg
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("FARLOG", "/tmp/turgor_far.log")
MODEL = "black-forest-labs/flux-1.1-pro"

STYLE = ("dark deep-earth soil cross-section, luminous pure WHITE mycelium as the single "
         "brightest element, bright glowing white fungal thread, cool near-black soil, only "
         "faint minimal cool bioluminescent ambience, naturalistic macro-photographic "
         "rendering, realistic and detailed, clean simple composition, NOT painterly, not "
         "stylized, subtle soft glow, "
         "ONLY thread-like fungal hyphae that taper to a fine sharp POINTED TIP, "
         "no mushroom, no mushroom cap, no stem, no gills, no fruiting body, not a mushroom, "
         "no coloured tint on the hyphae, keep the hypha white, no text, no watermark, no border")

SUBJECT = ("a single long slender WHITE mycelial hypha STRETCHING FAR across dark earth, thrust "
           "a great distance forward by turgor pressure, an elongated white filament spanning a "
           "long reach and tapering to one sharp pointed thread tip at the far end, a strong "
           "sense of distance and forward extension, tiny dew droplets along the strand")

LENS = [
    "wide panoramic side view, the hypha spanning the full width of the frame, lots of dark negative space, great sense of distance",
    "long horizontal composition, the white filament stretching from the near foreground into the deep dark distance, shallow depth of field",
    "the far-reaching white thread receding toward a distant vanishing point across the soil, dramatic depth",
    "clean minimal macro of one very long white filament crossing the whole frame, dark background",
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
    dest = OUTDIR / f"turgor-thrust-x{n}.jpg"
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
        gen_one(n, seed=7300 + n*29)
        time.sleep(2)
    log("TURGOR FAR DONE")

if __name__ == "__main__":
    main()
