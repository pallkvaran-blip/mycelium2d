#!/usr/bin/env python3
# Generate 3 ART OPTIONS for each disliked card, into assets/card_options/<slug>-<n>.jpg.
# New art direction: realistic, abundant WHITE/CREAM mycelium hyphae (not cartoonish,
# not heavy teal neon glow). Resumable by output-file existence. Reads REPLICATE_API_TOKEN.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OPTLOG", "/tmp/optgen.log")
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

# Three style lenses, applied to every card, all emphasising realistic white mycelium.
STYLES = [
 "realistic macro photography, abundant fine white and cream fungal mycelium hyphae threads, dark rich moist soil, natural soft light, shallow depth of field, hyper-detailed, no text",
 "cinematic realistic render, a dense web of white and pale-grey mycelium hyphae, dramatic low-key lighting, dark earthy background, hyper-detailed, atmospheric, no text",
 "naturalistic painterly illustration, threads of white cream mycelium hyphae, muted earthy palette, fine botanical detail, realistic textures, soft depth, no text",
]

# (slug, subject) — subjects rewritten to foreground realistic WHITE mycelium hyphae.
CARDS = [
 ("hyphal-extension","a spreading fan of fine white mycelium hyphae threads reaching and branching outward through dark soil toward small morsels of food"),
 ("apical-drive","a single white mycelial hyphal tip surging forward through dark earth, directed growth, a trail of fine white threads behind it"),
 ("foraging-fan","a radiating fan of fine white mycelium hyphae spreading outward in every direction through dark soil, dense searching threads"),
 ("tropic-lunge","a bundle of white mycelium hyphae reaching and lunging across a gap toward a distant morsel of food in dark soil"),
 ("saprotrophic-digest","white mycelium hyphae threading over and digesting a decaying fallen log on the forest floor, fine white fuzz of decomposition"),
 ("appressorial-punch","white fungal hyphae pressing and boring through a crack in a dark boulder, fine threads forcing into stone"),
 ("tap-root-rhizomorph","a thick white and cream rhizomorph cord of bundled mycelium driving straight down through cracked dark rock, fine roots branching"),
 ("nutrient-transmutation","white mycelium hyphae wrapping mineral grains and drawing nutrients out, fine threads over dark soil and pale minerals"),
 ("rhizomorph-lance","a spear-like bundle of white rhizomorph mycelial cord thrusting forward through dark rocky soil, dynamic, trailing fine threads"),
 ("fruiting-vigil","a single pale mushroom fruiting from dark soil with a dense mat of fine white mycelium hyphae spreading at its base"),
 ("colonizing-front","a broad advancing front of dense white mycelium hyphae overtaking dark soil, a wall of fine white threads"),
 ("sclerotial-seal","a hardened rounded sclerotium of compacted cream-white fungal tissue sealing over a cache in dark soil, protective knot of hyphae"),
 ("suberin-wall","a corky pale barrier wall of dense white fungal tissue blocking creeping grey mould in dark soil, matted hyphae"),
]

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

def save_jpg(url, dest, width=440, q=85):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","90","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

done=0; fail=[]
for slug, subject in CARDS:
    for n in (1,2,3):
        dest = OUTDIR / f"{slug}-{n}.jpg"
        if dest.exists(): log(f"skip {dest.name} (exists)"); continue
        prompt = f"{subject}, {STYLES[n-1]}"
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
        time.sleep(11)   # respect burst-of-1 pacing
log(f"OPTIONS DONE done={done} fail={fail}")
