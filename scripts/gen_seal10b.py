#!/usr/bin/env python3
# Sclerotial Seal round 6 — realistic forest floor: a dark hardened sclerotium /
# sealed cache among autumn leaves, WITH a mushroom nearby and a trail of ants
# passing by (the card seals a cache against ants). 10 varied options.
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OPTLOG", "/tmp/seal10b.log")
def log(m):
    with open(LOG,"a") as f: f.write(m+"\n")
    print(m, flush=True)

BASE = "realistic naturalistic forest-floor photography, soft natural light, shallow depth of field, highly detailed, no text"
SLUG = "sclerotial-seal"
P = [
 f"a hard dark rounded fungal sclerotium sealing a cache among fallen autumn oak and maple leaves, a small brown mushroom beside it, a trail of ants marching past on the soil, {BASE}",
 f"autumn leaves on damp earth with a dark hardened fungal seal and a little toadstool, a line of ants walking by, {BASE}",
 f"macro of a dark sclerotium among red and orange fallen leaves, a mushroom nearby, a column of ants crossing the frame, {BASE}",
 f"a mushroom and a dark hardened sclerotium nestled together in autumn leaves, a trail of ants passing by, forest floor, {BASE}",
 f"close-up forest-floor scene: a sealed dark cache, golden autumn leaves, a small mushroom, a busy line of ants walking past, {BASE}",
 f"a dark fungal seal protecting a cache under autumn leaves, a mushroom to one side, an ant trail curving past in the foreground, {BASE}",
 f"overhead view of autumn leaves with a mushroom, a dark sclerotium and a line of ants crossing the soil, {BASE}",
 f"a realistic mushroom growing beside a hard dark sclerotium in a bed of autumn leaves, ants marching by in a trail, damp earth, {BASE}",
 f"moody forest floor with a dark hard sclerotium and a mushroom among crimson autumn leaves, ants trailing past, {BASE}",
 f"a sealed cache marked by a dark sclerotium with a mushroom and scattered autumn leaves, a busy ant trail passing in the foreground, macro, {BASE}",
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
log(f"SEAL10B DONE done={done} fail={fail}")
