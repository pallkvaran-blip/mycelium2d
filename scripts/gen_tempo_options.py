#!/usr/bin/env python3
# Generate 5 ART OPTIONS for each of the 6 TEMPO cards via Replicate (FLUX schnell),
# matching the deck's dark bioluminescent fungal-fantasy look.
#   action tempo cards -> electric teal-green SIGNAL glow (speed of reaction)
#   engine tempo cards -> radiant warm AMBER/gold glow (metabolism running hot)
# Output: assets/card_options/<slug>-<n>.jpg (n=1..5). Resumable (skips existing).
# Reads REPLICATE_API_TOKEN from env. Same call/poll/save path as gen_card_options.py.
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("TEMPOLOG", "/tmp/tempogen.log")
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

ACTION = "dark bioluminescent fungal fantasy card illustration, electric teal-green signal glow, crackling energy pulses racing along glowing mycelial cords, moody atmospheric, painterly, highly detailed, dark background, no text"
ENGINE = "dark bioluminescent fungal fantasy card illustration, radiant warm amber and gold glow, dramatic energetic light, painterly, highly detailed, dark background, no text"

# five composition lenses -> five distinct options
LENS = [
 "wide atmospheric establishing composition, depth",
 "dramatic extreme macro close-up, shallow depth of field, deep shadows",
 "dynamic diagonal motion composition, streaking light trails, sense of speed",
 "radial burst composition, energy emanating from a bright glowing core",
 "stylized painterly composition, soft glow accents, atmospheric background",
]

# (slug, style, subject)
CARDS = [
 ("quickened-reflex","action","a bright bioluminescent nerve-like signal pulse racing along a glowing teal mycelial cord through dark soil, fast reflex, trailing light"),
 ("impulse-relay","action","a chain of glowing teal impulses relaying along branching mycelial cords, each junction node flaring bright as the pulse passes, dark soil"),
 ("hair-trigger-hyphae","action","taut coiled mycelial hyphae primed like a trigger, crackling with electric teal-green energy about to snap forward, tense, dark soil"),
 ("brisk-metabolism","engine","glowing enzymes cycling briskly through a warm amber fungal cell, energy turning over quickly, streaks of gold light, dark background"),
 ("enzyme-overclock","engine","an overclocked fungal cell, enzymes blazing with intense warm amber and gold light, catalysis running hot, sparks of energy, dark"),
 ("metabolic-surge","engine","a fungal colony surging with heat, radiant amber and gold energy pouring through every glowing cord at full tilt, dark soil"),
]
STYLE = {"action": ACTION, "engine": ENGINE}

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","60","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"4:3","num_outputs":1,"output_format":"png"}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,"https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"])

def poll(geturl):
    for _ in range(90):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def save_jpg(url, dest, width=520, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","90","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

if not TOKEN:
    log("NO TOKEN"); raise SystemExit(1)

done=0; fail=[]
for slug, style_key, subject in CARDS:
    for n in (1,2,3,4,5):
        dest = OUTDIR / f"{slug}-{n}.jpg"
        if dest.exists(): log(f"skip {dest.name}"); continue
        prompt = f"{subject}, {LENS[n-1]}, {STYLE[style_key]}"
        d = {}
        for attempt in range(6):
            d = create(prompt)
            if str(d.get("status"))=="429":
                ra=int(d.get("retry_after",10)); log(f"429 wait {ra+2}"); time.sleep(ra+2); continue
            break
        get = (((d.get("urls") or {}).get("get")) or "")
        if not get: log(f"FAIL create {dest.name}: {json.dumps(d)[:160]}"); fail.append(dest.name); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if not url: log(f"FAIL poll {dest.name}: {r.get('status')}"); fail.append(dest.name); continue
        try: save_jpg(url, str(dest)); done+=1; log(f"wrote {dest.name}")
        except Exception as e: log(f"FAIL save {dest.name}: {e}"); fail.append(dest.name)
        time.sleep(7)
log(f"TEMPO OPTIONS DONE done={done} fail={fail}")
