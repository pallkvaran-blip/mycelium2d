#!/usr/bin/env python3
# Round-3 redos. Key fix: the GROWTH cards are about vegetative MYCELIUM (hyphae),
# NOT fruiting — so NO mushrooms / fruiting bodies, only fine white thread networks.
# Sclerotial Seal features the game's autumn leaves. → assets/card_options/<slug>-<n>.jpg
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OPTLOG", "/tmp/redo3.log")
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

# vegetative-mycelium style: threads only, explicitly no mushrooms
HYPHAE = "realistic soft white and cream vegetative fungal mycelium, fine thread-like hyphae and filaments only, absolutely NO mushrooms, NO fruiting bodies, NO caps or stems, just a web of threads, dark rich soil, subtle bioluminescent teal and warm amber glow as faint background accents, atmospheric fungal-fantasy card illustration, painterly, highly detailed, dark background, no text"
DECAY  = "realistic atmospheric illustration, fine white mycelium threads (no mushrooms, no fruiting bodies) decomposing dark rotting organic matter, naturalistic earthy textures, subtle bioluminescent glow, moody cinematic lighting, highly detailed, dark background, painterly, no text"
LEAF   = "atmospheric fungal-fantasy card illustration featuring fallen autumn oak and maple leaves prominently, dark soil, faint teal and amber glow, painterly, highly detailed, dark background, no text"

REDOS = {
 "hyphal-extension": [
   f"a top-down radiating web of fine white vegetative mycelium hyphae spreading outward across dark soil toward several small glowing amber food specks, {HYPHAE}",
   f"fine white mycelium hyphae reaching and branching horizontally toward a single glowing amber morsel of food, side view, dark soil, {HYPHAE}",
   f"extreme macro of ultra-fine white and cream mycelial filaments branching through dark earth toward tiny amber food motes, {HYPHAE}",
 ],
 "apical-drive": [
   f"one bold white mycelial cord of bundled hyphae driving forward in a single direction through dark soil, a thread-like growing tip and trailing fine white filaments, strong momentum, {HYPHAE}",
   f"extreme macro of a single fine white hyphal growing tip pushing forward through dark earth, faint teal glow ahead, {HYPHAE}",
   f"a directed bundle of white mycelium threads thrusting diagonally toward a distant amber glow through dark soil, {HYPHAE}",
 ],
 "saprotrophic-digest": [
   f"a realistic rotting log on a dark forest floor, wrapped and threaded with a fine white web of mycelium decomposing the bark, subtle teal glow seeping from the cracks, {DECAY}",
   f"extreme macro of fine white mycelium threads digesting dark decaying wood and leaf matter, rich realistic textures, faint amber glow, {DECAY}",
   f"an atmospheric dark forest floor of decomposing wood and leaf litter laced with a fine white network of mycelium, moody, faint glowing spores drifting, {DECAY}",
 ],
 "sclerotial-seal": [
   f"a hardened rounded sclerotium, a compacted dark tan knot of fungal tissue, sealing and protecting a glowing amber food cache, nestled among a pile of fallen autumn oak and maple leaves on dark soil, {LEAF}",
   f"close-up of a crusty hardened protective fungal seal guarding a cache, half-buried in orange and brown autumn leaves, faint teal glow at the edge, {LEAF}",
   f"a warm glowing cache sealed beneath a blanket of autumn leaves by a dark hardened sclerotium knot, dark soil, atmospheric, {LEAF}",
 ],
}

def curl_json(a):
    r=subprocess.run(["curl","-sS","--max-time","60","--cacert",CA]+a,capture_output=True,text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw":r.stdout[:200]}
def create(p):
    body=json.dumps({"input":{"prompt":p,"aspect_ratio":"4:3","num_outputs":1,"output_format":"png"}})
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
    tmp=tempfile.mktemp(suffix=".png"); subprocess.run(["curl","-sS","--max-time","90","--cacert",CA,"-o",tmp,url],check=True)
    im=Image.open(tmp).convert("RGB"); im=im.resize((width,round(im.height*width/im.width)),Image.LANCZOS)
    im.save(dest,"JPEG",quality=q,optimize=True); os.remove(tmp)

done=0; fail=[]
for slug,prompts in REDOS.items():
    for i,p in enumerate(prompts,start=1):
        dest=OUTDIR/f"{slug}-{i}.jpg"
        if dest.exists(): log(f"skip {dest.name}"); continue
        for _ in range(6):
            d=create(p)
            if str(d.get("status"))=="429": ra=int(d.get("retry_after",10)); log(f"429 wait {ra+2}"); time.sleep(ra+2); continue
            break
        get=(((d.get("urls") or {}).get("get")) or "")
        if not get: log(f"FAIL create {dest.name}: {json.dumps(d)[:150]}"); fail.append(dest.name); continue
        r=poll(get); out=r.get("output"); url=out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if not url: log(f"FAIL poll {dest.name}: {r.get('status')}"); fail.append(dest.name); continue
        try: save_jpg(url,str(dest)); done+=1; log(f"wrote {dest.name}")
        except Exception as e: log(f"FAIL save {dest.name}: {e}"); fail.append(dest.name)
        time.sleep(11)
log(f"REDO3 DONE done={done} fail={fail}")
