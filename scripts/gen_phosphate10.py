#!/usr/bin/env python3
# Phosphate Tap — 10 varied options. The card harvests PHOSPHORUS from rock:
# mycelium tapping glowing violet/magenta phosphate mineral veins in dark stone.
# On-theme dark bioluminescent fungal fantasy (the liked look). Varied compositions.
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OPTLOG", "/tmp/phos10.log")
def log(m):
    with open(LOG,"a") as f: f.write(m+"\n")
    print(m, flush=True)

STYLE = "dark bioluminescent fungal-fantasy card illustration, painterly, highly detailed, dark background, no text"
SLUG = "phosphate-tap"
P = [
 f"pale mycelium hyphae threading into a glowing violet phosphate mineral vein in dark rock, drawing out nutrients, {STYLE}",
 f"extreme macro of fungal hyphae dissolving glowing violet phosphorescent crystals in cracked dark stone, {STYLE}",
 f"a glowing violet mineral node embedded in dark rock, wrapped by fine white mycelium threads tapping the phosphorus, {STYLE}",
 f"luminous violet phosphate crystals in a dark cavern wall, mycelial cords tapping in, faint teal accents, {STYLE}",
 f"a cross-section of dark rock revealing a bright violet phosphate seam being mined by mycelial cords, {STYLE}",
 f"fungal threads piercing a cracked geode lined with glowing violet-magenta phosphorescent minerals, dramatic, {STYLE}",
 f"a dark rock face veined with glowing violet phosphate, a network of mycelium spreading across it drawing energy, {STYLE}",
 f"macro of a single glowing mycelial tip drilling into a violet phosphorescent mineral crystal, {STYLE}",
 f"a cluster of violet phosphorescent crystals in dark stone with fine white hyphae wrapping and feeding on them, {STYLE}",
 f"an underground mineral vein glowing violet and magenta, a mycelium network tapping the phosphate, warm amber accents, {STYLE}",
]

def cj(a):
    r=subprocess.run(["curl","-sS","--max-time","60","--cacert",CA]+a,capture_output=True,text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw":r.stdout[:200]}
def create(p):
    body=json.dumps({"input":{"prompt":p,"aspect_ratio":"4:3","num_outputs":1,"output_format":"png"}})
    return cj(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,
               "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"])
def poll(u):
    for _ in range(90):
        d=cj(["-H",f"Authorization: Bearer {TOKEN}",u]); st=d.get("status")
        if st=="succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}
def save(url,dest,width=440,q=85):
    tmp=tempfile.mktemp(suffix=".png"); subprocess.run(["curl","-sS","--max-time","90","--cacert",CA,"-o",tmp,url],check=True)
    im=Image.open(tmp).convert("RGB"); im=im.resize((width,round(im.height*width/im.width)),Image.LANCZOS)
    im.save(dest,"JPEG",quality=q,optimize=True); os.remove(tmp)

done=0; fail=[]
for i,pr in enumerate(P,start=1):
    dest=OUTDIR/f"{SLUG}-{i}.jpg"
    if dest.exists(): log(f"skip {dest.name}"); continue
    for _ in range(6):
        d=create(pr)
        if str(d.get("status"))=="429": ra=int(d.get("retry_after",10)); log(f"429 wait {ra+2}"); time.sleep(ra+2); continue
        break
    get=(((d.get("urls") or {}).get("get")) or "")
    if not get: log(f"FAIL create {dest.name}: {json.dumps(d)[:150]}"); fail.append(dest.name); continue
    r=poll(get); out=r.get("output"); url=out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
    if not url: log(f"FAIL poll {dest.name}: {r.get('status')}"); fail.append(dest.name); continue
    try: save(url,str(dest)); done+=1; log(f"wrote {dest.name}")
    except Exception as e: log(f"FAIL save {dest.name}: {e}"); fail.append(dest.name)
    time.sleep(11)
log(f"PHOS10 DONE done={done} fail={fail}")
