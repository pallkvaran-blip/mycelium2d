#!/usr/bin/env python3
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"
CA = "/root/.ccr/ca-bundle.crt"; TOKEN = os.environ.get("REPLICATE_API_TOKEN","").strip()
LOG = "/tmp/ganoderma3.log"; MODEL = "black-forest-labs/flux-1.1-pro"
PROMPT = ("A hard woody perennial bracket fungus, Ganoderma applanatum the artist's conk, growing "
          "from the side of a living tree trunk, natural side three-quarter view. It is a THICK, HARD, "
          "blunt-edged semicircular shelf as solid as a plank of wood, with a dull matte knobbly "
          "grey-brown and reddish-brown upper crust lightly dusted with rust-brown spore powder and a "
          "little green algae, a thick rounded cream-white blunt margin, and a flat smooth chalk-white "
          "poreless-looking underside. Single solid heavy shelf. "
          "NOT wavy, NOT thin, NOT frilly-edged, NOT gilled, NOT a stem, NOT bright concentric rings, "
          "NOT turkey tail, NOT a rosette. Candid documentary field photo, overcast daylight, matte, "
          "realistic, muted colours, not glossy, not lacquered, not CGI, no text, no watermark, no border")
def log(m):
    open(LOG,"a").write(m+"\n"); print(m, flush=True)
def cj(a):
    r=subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+a,capture_output=True,text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}
def create(seed):
    body=json.dumps({"input":{"prompt":PROMPT,"aspect_ratio":"3:4","output_format":"png","safety_tolerance":5,"seed":seed}})
    return cj(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,f"https://api.replicate.com/v1/models/{MODEL}/predictions"])
def poll(u):
    for _ in range(90):
        d=cj(["-H",f"Authorization: Bearer {TOKEN}",u]); st=d.get("status")
        if st=="succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}
def save(url,dest,width=560,q=88):
    tmp=tempfile.mktemp(suffix=".png"); subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url],check=True)
    im=Image.open(tmp).convert("RGB")
    if im.width>width: im=im.resize((width,round(im.height*width/im.width)),Image.LANCZOS)
    im.save(dest,"JPEG",quality=q,optimize=True); os.remove(tmp)
def gen(n,seed):
    dest=OUTDIR/f"ganoderma-applanatum-{n}.jpg"
    for a in range(3):
        d=create(seed+a*911); g=((d.get("urls") or {}).get("get")) or ""
        if not g: log(f"{dest.name}: create fail"); time.sleep(4); continue
        r=poll(g); out=r.get("output"); url=out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save(url,str(dest)); log(f"OK {dest.name} {dest.stat().st_size//1024}KB"); return
            except Exception as e: log(f"{dest.name} dl err {e}")
        else: log(f"{dest.name}: {r.get('status')}"); time.sleep(3)
    log(f"FAIL {dest.name}")
def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    open(LOG,"w").write("")
    for n in (10,11,12): gen(n, seed=8800+n*211); time.sleep(1)
    log("GANODERMA3 DONE")
if __name__=="__main__": main()
