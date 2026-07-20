#!/usr/bin/env python3
# Split Gill (Schizophyllum commune) species portrait options -> assets/species_options/
# Promote the best to assets/species/schizophyllum-commune.jpg.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"; OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN","").strip()
LOG = os.environ.get("SGLOG","/tmp/splitgill.log")
MODEL = "black-forest-labs/flux-1.1-pro"
PROMPT = ("A photorealistic close-up nature photograph of Schizophyllum commune, the split "
          "gill fungus: a cluster of small fan-shaped and shell-shaped brackets with a "
          "densely hairy fuzzy greyish-white to pale lilac surface, growing in overlapping "
          "rosettes on weathered dead hardwood, the undersides showing the distinctive "
          "radiating split, folded gill-like folds, damp mossy forest, soft natural light, "
          "shallow depth of field, naturalistic, highly detailed, no text, no watermark, no border")
def log(m):
    with open(LOG,"a") as f: f.write(m+"\n")
    print(m, flush=True)
def cj(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}
def create(seed):
    body = json.dumps({"input":{"prompt":PROMPT,"aspect_ratio":"3:4","output_format":"png","safety_tolerance":5,"seed":seed}})
    return cj(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,
               f"https://api.replicate.com/v1/models/{MODEL}/predictions"])
def poll(u):
    for _ in range(90):
        d = cj(["-H",f"Authorization: Bearer {TOKEN}",u]); st=d.get("status")
        if st=="succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}
def save(url, dest, width=560, q=88):
    tmp=tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im=Image.open(tmp).convert("RGB")
    if im.width>width: im=im.resize((width,round(im.height*width/im.width)),Image.LANCZOS)
    im.save(dest,"JPEG",quality=q,optimize=True); os.remove(tmp)
def gen(n, seed):
    dest=OUTDIR/f"schizophyllum-commune-{n}.jpg"
    for a in range(3):
        d=create(seed+a*911); g=((d.get("urls") or {}).get("get")) or ""
        if not g: log(f"{dest.name}: create fail {d.get('detail') or d.get('_raw')}"); time.sleep(4); continue
        r=poll(g); out=r.get("output"); url=out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save(url,str(dest)); log(f"OK {dest.name} {dest.stat().st_size//1024}KB"); return
            except Exception as e: log(f"{dest.name} dl err {e}")
        else: log(f"{dest.name}: {r.get('status')}"); time.sleep(3)
    log(f"FAIL {dest.name}")
def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n in (1,2,3): gen(n, seed=7000+n*137); time.sleep(1)
    log("SPLITGILL DONE")
if __name__=="__main__": main()
