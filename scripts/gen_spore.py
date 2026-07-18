#!/usr/bin/env python3
# Spore-PRINT icon options (FLUX 1.1 Pro). A spore print = the radial gilled pattern a
# mushroom cap drops gills-down. Glowing bioluminescent teal/blue on pure black so it
# mattes cleanly (max-channel key) for use as the Spores currency mark. Saved as
# spore_opt_0..N + a contact sheet. Placement/wiring done separately.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "spore_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("SPORELOG", "/tmp/spore.log")
MODEL = "black-forest-labs/flux-1.1-pro"

BASE = ("A MUSHROOM SPORE PRINT icon: {v}. The delicate radial pattern a mushroom cap "
        "leaves when set gills-down — a perfectly circular starburst of many fine "
        "radiating gill lines from a small central hub out to the rim, symmetric and "
        "centered. Glowing bioluminescent teal-and-cyan light, the gills lit like "
        "filaments, a soft aqua glow at the core. Clean flat graphic emblem, single "
        "centered object on a pure solid BLACK background, high detail, crisp, "
        "no text, no watermark, not a photo.")

VARIANTS = [
    "hundreds of fine delicate gill lines, dense and lacy",
    "medium radial gills with a few forking near the rim",
    "a raised glowing central boss with gills radiating out",
    "bolder, slightly fewer gills reading clearly small",
    "gilled disc fringed with a soft halo of scattered spore dust",
    "an intricate glowing mandala of concentric rings and radial gills",
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"1:1","output_format":"png","safety_tolerance":5,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(90):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def download_png(url, dest, width=512):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width:
        h = round(im.height*width/im.width); im = im.resize((width,h), Image.LANCZOS)
    im.save(dest, "PNG"); os.remove(tmp)

def gen_one(idx):
    dest = OUTDIR / f"spore_opt_{idx}.png"
    if dest.exists(): log(f"skip {idx}"); return dest
    prompt = BASE.format(v=VARIANTS[idx % len(VARIANTS)]); seed = 3300 + idx*53
    for attempt in range(3):
        d = create(prompt, seed + attempt*811)
        geturl = (d.get("urls") or {}).get("get")
        if not geturl: log(f"{idx}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(4); continue
        r = poll(geturl); out = r.get("output")
        if r.get("status")=="succeeded" and out:
            url = out[0] if isinstance(out, list) else out
            try: download_png(url, dest); log(f"OK {idx} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e: log(f"{idx}: dl error {e}")
        else: log(f"{idx}: {r.get('status')}"); time.sleep(3)
    log(f"FAIL {idx}"); return None

def contact_sheet(paths):
    imgs = [(i, Image.open(p).convert("RGB")) for i,p in enumerate(paths) if p and p.exists()]
    if not imgs: return
    cw = 300; cells = []
    for i, im in imgs:
        im = im.resize((cw, cw), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
        except Exception: font = ImageFont.load_default()
        d.rectangle([0,0,150,42], fill=(0,0,0)); d.text((10,6), f"SPORE {chr(65+i)}", fill=(255,255,255), font=font)
        cells.append(im)
    cols=3; rows=(len(cells)+cols-1)//cols
    sheet = Image.new("RGB", (cw*cols+6*(cols+1), cw*rows+6*(rows+1)), (18,18,20))
    for i,c in enumerate(cells):
        x=(i%cols)*(cw+6)+6; y=(i//cols)*(cw+6)+6; sheet.paste(c,(x,y))
    out = OUTDIR / "_sheet_spore.png"; sheet.save(out, "PNG"); log(f"SHEET -> {out}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    N = int(os.environ.get("N","6"))
    paths = [gen_one(i) for i in range(N)]; contact_sheet(paths); log("DONE")

if __name__ == "__main__": main()
