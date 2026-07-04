#!/usr/bin/env python3
# Round-2 redos: 3 FRESH, deliberately-varied options for the 6 cards the player
# rejected. New prompts (not re-rolls of the same idea). White-mycelium cards lean
# into FINE white thread networks + the card's action; theme cards get more
# realistic/atmospheric, less generic takes. → assets/card_options/<slug>-<n>.jpg
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OPTLOG", "/tmp/redogen.log")
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

WHITE = "realistic soft white and cream fungal mycelium threads (matte, fine, not glowing), dark rich soil, subtle bioluminescent teal and warm amber glow as background accents, atmospheric fungal fantasy card illustration, painterly, highly detailed, dark background, no text"
THEME = "dark bioluminescent fungal fantasy card illustration, teal-green and warm amber glow, moody atmospheric, painterly, highly detailed, dark background, no text"
REAL  = "realistic atmospheric fantasy illustration, naturalistic textures, cinematic moody lighting, subtle bioluminescent glow, highly detailed, dark background, painterly, no text"

# slug -> [3 fully-distinct prompts]
REDOS = {
 "hyphal-extension": [
   f"a delicate radiating web of fine white mycelium threads stretching outward across dark soil toward several small glowing amber food specks, top-down view, {WHITE}",
   f"fine white hyphal threads reaching and branching horizontally toward a single glowing amber morsel of food, side profile, dark soil, {WHITE}",
   f"extreme macro of ultra-fine white cream mycelium filaments fanning out and branching through dark earth, tiny amber food motes, {WHITE}",
 ],
 "apical-drive": [
   f"one bold white mycelial cord driving forward in a single direction through dark soil, a bright growing tip and trailing fine white threads, strong sense of momentum, {WHITE}",
   f"extreme macro of a single glistening white hyphal growing tip pushing forward through dark earth, faint teal glow ahead, {WHITE}",
   f"a directed spear of white cream mycelium thrusting toward a glowing amber goal, dynamic diagonal composition, dark soil, {WHITE}",
 ],
 "foraging-fan": [
   f"a symmetric radial burst of fine white mycelium threads spreading in every direction from a central point across dark soil, top-down, scattered amber food motes, {WHITE}",
   f"a wide sweeping fan of white cream hyphae spreading outward and branching, dark soil, faint teal glow, {WHITE}",
   f"a dense star-burst of fine white mycelial filaments radiating outward, dramatic, dark background, small amber glows, {WHITE}",
 ],
 "saprotrophic-digest": [
   f"a realistic rotting log half-buried on a dark forest floor, soft white fungal mycelium spreading over the decaying bark, faint teal bioluminescent glow in the cracks, {REAL}",
   f"close-up of decaying wood being broken down by fungi, rich realistic textures, threads of white mycelium and faint amber glow seeping from the rot, {REAL}",
   f"an atmospheric dark forest floor with a fallen log dissolving into rich humus, subtle glowing spores drifting up, moody realistic, {REAL}",
 ],
 "appressorial-punch": [
   f"a fungal cord forcefully punching and breaching a cracked dark boulder, a burst of teal light exploding from the fracture point, dramatic impact, {THEME}",
   f"extreme close-up of a fungal hypha drilling and forcing into solid stone, splitting rock, concentrated glowing pressure point, {THEME}",
   f"a boulder splitting apart under fungal force, glowing teal and amber energy bursting through the crack, dynamic, dark, {THEME}",
 ],
 "sclerotial-seal": [
   f"a hard dark domed sclerotium shell encasing and sealing a glowing amber food cache in dark soil, protective armored knot of fungal tissue, {THEME}",
   f"close-up of a crusty hardened protective fungal seal over a cache, tiny ants turned away at the edge, faint teal glow seeping out, {THEME}",
   f"a rounded armored nodule of compacted fungal tissue guarding a warm glowing cache underground, dark soil, faint edge glow, {THEME}",
 ],
}

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","60","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}
def create(prompt):
    body=json.dumps({"input":{"prompt":prompt,"aspect_ratio":"4:3","num_outputs":1,"output_format":"png"}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,
                      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"])
def poll(u):
    for _ in range(90):
        d=curl_json(["-H",f"Authorization: Bearer {TOKEN}",u]); st=d.get("status")
        if st=="succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}
def save_jpg(url,dest,width=440,q=85):
    tmp=tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","90","--cacert",CA,"-o",tmp,url],check=True)
    im=Image.open(tmp).convert("RGB"); im=im.resize((width,round(im.height*width/im.width)),Image.LANCZOS)
    im.save(dest,"JPEG",quality=q,optimize=True); os.remove(tmp)

done=0; fail=[]
for slug,prompts in REDOS.items():
    for i,prompt in enumerate(prompts, start=1):
        dest=OUTDIR/f"{slug}-{i}.jpg"
        if dest.exists(): log(f"skip {dest.name}"); continue
        for _ in range(6):
            d=create(prompt)
            if str(d.get("status"))=="429": ra=int(d.get("retry_after",10)); log(f"429 wait {ra+2}"); time.sleep(ra+2); continue
            break
        get=(((d.get("urls") or {}).get("get")) or "")
        if not get: log(f"FAIL create {dest.name}: {json.dumps(d)[:150]}"); fail.append(dest.name); continue
        r=poll(get); out=r.get("output"); url=out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if not url: log(f"FAIL poll {dest.name}: {r.get('status')}"); fail.append(dest.name); continue
        try: save_jpg(url,str(dest)); done+=1; log(f"wrote {dest.name}")
        except Exception as e: log(f"FAIL save {dest.name}: {e}"); fail.append(dest.name)
        time.sleep(11)
log(f"REDOS DONE done={done} fail={fail}")
