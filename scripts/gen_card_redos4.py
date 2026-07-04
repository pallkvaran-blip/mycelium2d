#!/usr/bin/env python3
# Round-4 redos with per-card notes:
#  hyphal-extension : petri-dish-inspired, 10 VARIED options (very common card)
#  apical-drive     : a single hyphal strand reaching far
#  saprotrophic-digest : more digestion / energy focused
#  sclerotial-seal  : more realistic (keep autumn leaves)
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OPTLOG", "/tmp/redo4.log")
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

NOMUSH = "vegetative white and cream fungal mycelium, fine thread-like hyphae only, absolutely no mushrooms, no fruiting bodies, no caps or stems"

REDOS = {
 # 10 varied petri-dish-inspired takes — radial white mycelium cultures
 "hyphal-extension": [
   f"top-down view of a round petri dish, a circular colony of {NOMUSH} radiating outward across dark agar, feathery white growth front, macro photography, highly detailed, no text",
   f"a petri dish culture of white mycelium with delicate concentric growth rings spreading to the rim, dark agar, soft studio light, scientific macro, {NOMUSH}, no text",
   f"extreme macro of the advancing margin of a white mycelial colony on dark agar, fine cottony hyphae front creeping outward, {NOMUSH}, shallow depth of field, no text",
   f"a glowing petri dish, {NOMUSH} radiating from the centre with subtle bioluminescent teal and amber accents in the agar, dark background, atmospheric fungal-fantasy card art, painterly, no text",
   f"overhead shot of a white cottony mycelium colony filling a dark culture dish, rich fine detail, naturalistic, {NOMUSH}, no text",
   f"a petri dish where white mycelium radiates outward toward tiny glowing amber food specks around the rim, dark agar, macro, {NOMUSH}, no text",
   f"several small white mycelial colonies merging into one across a dark petri dish, fine hyphae bridging the gaps, macro, {NOMUSH}, no text",
   f"a dramatic dark petri dish with a luminous fine white mycelial web spreading edge to edge, moody lighting, atmospheric card art, {NOMUSH}, no text",
   f"a pristine circular white mycelium colony on black agar, perfect radial symmetry, delicate filaments, elegant scientific macro, {NOMUSH}, no text",
   f"a half-grown white mycelium culture spreading across a dark dish, one dense side and a fine reaching front on the other, macro, {NOMUSH}, no text",
 ],
 "apical-drive": [
   f"a single long white hyphal strand of mycelium stretching and reaching far across dark soil toward a distant faint amber glow, elongated, directional, {NOMUSH}, atmospheric, dark background, no text",
   f"macro of one lone white mycelial thread extending a long way into the darkness, its fine growing tip reaching forward, dark soil, {NOMUSH}, no text",
   f"a single white hyphal cord reaching dramatically across a wide dark gap toward a far point of light, dynamic long composition, {NOMUSH}, no text",
 ],
 "saprotrophic-digest": [
   f"white mycelium enveloping and dissolving dark decaying matter, glowing amber energy being drawn up the {NOMUSH} threads, digestion and energy release, dark background, atmospheric fungal-fantasy card art, painterly, no text",
   f"extreme macro of enzymatic digestion — {NOMUSH} breaking down rotting organic matter with glowing amber nutrient droplets seeping out and flowing up the threads, realistic, no text",
   f"warm amber energy surging up a network of {NOMUSH} from a dark decomposing log, a sense of nutrients converted to energy, glowing, atmospheric, dark background, no text",
 ],
 "sclerotial-seal": [
   f"realistic photograph of a hard dark irregular fungal sclerotium (a compacted tuber-like knot) half-buried among fallen autumn oak and maple leaves on damp forest soil, naturalistic, detailed, shallow depth of field, no text",
   f"realistic macro of a hardened dark sclerotium sealing over a food store, surrounded by orange and brown autumn leaves and damp earth, natural light, photographic, no text",
   f"a realistic hard knobbly fungal sclerotium nestled in a bed of autumn leaves, protecting a cache, dark rich soil, naturalistic forest-floor photography, detailed, no text",
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
log(f"REDO4 DONE done={done} fail={fail}")
