#!/usr/bin/env python3
# Generate 3 ART OPTIONS for each disliked card → assets/card_options/<slug>-<n>.jpg.
# TWO art directions, so white mycelium is FEATURED only where the player asked:
#   • 'white' cards (the 7 labeled "more white mycelium"): realistic WHITE/CREAM
#     hyphae are the hero, set in the on-theme dark fungal world with subtle teal/
#     amber glow + food motes as accents — featured, not the whole card.
#   • 'theme' cards (the rest): the liked dark bioluminescent fungal-fantasy look,
#     each card's own subject, NO forced white mycelium.
# 3 composition lenses per card = variety. Resumable. Reads REPLICATE_API_TOKEN.
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

STYLE = {
 # white hyphae are the HERO but the scene stays on-theme (dark soil, glow accents)
 "white": "the mycelium threads rendered as realistic soft WHITE and cream fungal hyphae (matte, not glowing), set in dark rich soil, with subtle bioluminescent teal-green and warm amber glow as background accents, atmospheric fungal fantasy card illustration, painterly, highly detailed, dark background, no text",
 # the liked look — glowing bioluminescent fungal fantasy, no white emphasis
 "theme": "dark bioluminescent fungal fantasy card illustration, teal-green and warm amber glow, moody atmospheric, painterly, highly detailed, dark background, no text",
}
LENS = [
 "wide atmospheric establishing composition, depth",
 "dramatic extreme macro close-up, shallow depth of field, deep shadows",
 "stylized painterly composition, warm amber glow accent, soft focus background",
]

# (slug, style_key, subject)
CARDS = [
 # --- white mycelium FEATURED alongside on-theme elements ---
 ("hyphal-extension","white","a fan of white mycelium hyphae reaching and branching through dark soil toward small glowing amber food motes"),
 ("apical-drive","white","a single driving hyphal tip surging forward through dark earth, a bright bundle of white mycelium hyphae trailing behind it, faint teal glow"),
 ("foraging-fan","white","a radiating fan of white mycelium hyphae spreading in every direction through dark soil, scattered glowing amber food motes"),
 ("tropic-lunge","white","a bundle of white mycelium hyphae lunging across a dark gap toward a distant glowing amber morsel of food"),
 ("rhizomorph-lance","white","a spear-like rhizomorph cord tipped with a burst of white mycelium hyphae lancing through dark rocky soil, dynamic motion, teal and amber glow accents"),
 ("fruiting-vigil","white","a luminous mushroom fruiting from dark soil with an amber cap and golden spores, its base wreathed in a dense mat of white mycelium hyphae"),
 ("colonizing-front","white","a broad advancing colonizing front of white mycelium hyphae overtaking dark soil, dense threads with teal glow accents behind"),
 # --- 'too cartoonish' → on-theme + realistic ---
 ("saprotrophic-digest","theme","glowing enzymes dissolving a decaying fallen log on a dark forest floor, realistic bioluminescent decay, teal and amber glow, rich detailed textures, not cartoonish"),
 # --- no note → fresh varied takes of the card's own subject, on-theme (no white) ---
 ("appressorial-punch","theme","fungal hyphae boring and punching through a cracked dark boulder, a concentrated glowing teal pressure point where they force into the stone, dramatic"),
 ("tap-root-rhizomorph","theme","a thick glowing rhizomorph taproot cord drilling straight down through cracked dark rock, warm amber and teal glow along its length, deep and dramatic"),
 ("nutrient-transmutation","theme","alchemical transmutation of glowing violet mineral crystals into shimmering teal water, swirling fungal energy and light, dark cavern, magical"),
 ("sclerotial-seal","theme","a hardened rounded sclerotium of compacted fungal tissue sealing and protecting a glowing amber food cache from ants, dark soil, faint teal edge glow"),
 ("suberin-wall","theme","a corky protective wall of dense fungal tissue holding back creeping grey mould, a defensive barrier lit by a faint teal edge glow, dark soil"),
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
for slug, style_key, subject in CARDS:
    for n in (1,2,3):
        dest = OUTDIR / f"{slug}-{n}.jpg"
        if dest.exists(): log(f"skip {dest.name}"); continue
        prompt = f"{subject}, {LENS[n-1]}, {STYLE[style_key]}"
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
        time.sleep(11)
log(f"OPTIONS DONE done={done} fail={fail}")
