#!/usr/bin/env python3
# Sclerotial Seal — 10 more options: realistic forest-floor sclerotia among autumn leaves.
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OPTLOG", "/tmp/seal10.log")
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

BASE = "realistic naturalistic forest-floor photography, shallow depth of field, soft natural light, highly detailed, no text"
SLUG = "sclerotial-seal"
PROMPTS = [
 f"a hard dark rounded fungal sclerotium nestled among fallen autumn oak and maple leaves on damp forest soil, {BASE}",
 f"a knobbly black sclerotium half-buried under a blanket of orange and brown autumn leaves, {BASE}",
 f"macro close-up of a dark hardened sclerotium resting on a bed of golden autumn leaves with dew, {BASE}",
 f"a dark compact sclerotium tuber among crisp fallen leaves and twigs on a moody forest floor, {BASE}",
 f"a rounded hard fungal sclerotium sealing a small hollow, ringed by red and orange maple leaves and damp earth, {BASE}",
 f"a dark sclerotium sitting in a curl of dry autumn leaves in soft morning light, {BASE}",
 f"a hardened dark sclerotium knot amid scattered oak leaves and a few acorns on dark soil, {BASE}",
 f"overhead view of a dark irregular sclerotium ringed by a wreath of autumn leaves on the forest floor, {BASE}",
 f"a hard black sclerotium partly wrapped in decaying autumn leaves with fine white mycelial threads at its base, {BASE}",
 f"a dark sclerotium tucked beneath autumn leaves with a faint warm amber glow of a protected cache seeping from beneath it, {BASE}",
]

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
for i,p in enumerate(PROMPTS,start=1):
    dest=OUTDIR/f"{SLUG}-{i}.jpg"
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
log(f"SEAL10 DONE done={done} fail={fail}")
