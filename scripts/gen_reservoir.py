#!/usr/bin/env python3
# Underground WATER RESERVOIR sprite options for the map (FLUX 1.1 Pro). A pocket of
# glowing subterranean water the mycelium can touch for water income. Painterly
# deep-earth style to match the game's lakes/rock art. Saved as reservoir_opt_0..N
# + a contact sheet, for a human to pick. Placement/render wired separately.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "reservoir_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
if not TOKEN:
    tf = Path("/tmp/claude-0/-home-user-mycelium2d/e43b2131-64d6-51a4-b68f-76b2b5524080/scratchpad/.replicate_token")
    if tf.exists(): TOKEN = tf.read_text().strip()
LOG = os.environ.get("RESLOG", "/tmp/reservoir.log")
MODEL = "black-forest-labs/flux-1.1-pro"

BASE = ("FLAT 2D side-scroller game sprite, hand-painted, simple flat shading, "
        "side-on cross-section view of an UNDERGROUND WATER POCKET: {v}. A small "
        "rounded pocket of calm muted teal water enclosed in dark flat-shaded earth "
        "and simple rounded rocks, a flat still waterline, soft aqua glow, a couple of "
        "small flat pebbles, muted dark-teal and deep-green palette like a 2D "
        "platformer cave. Storybook vector-painting look, clean flat colours, minimal "
        "detail, NOT 3D, not a 3D render, no isometric view, no dramatic volumetric "
        "lighting, no photorealism. Centered single object on a plain solid black "
        "background, no text, no watermark, not a photo")

VARIANTS = [
    "a rounded pocket of still teal water in dark earth with a flat waterline",
    "a small oval water pocket rimmed by a few simple flat rocks",
    "a shallow wide underground puddle between smooth dark stones",
    "a deep round water pocket glowing faintly from below",
    "a teardrop water pocket with a couple of tiny glowing plants",
    "a small hidden pool nestled in soft flat-shaded cavern rock",
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

def download_png(url, dest, width=640):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width:
        h = round(im.height*width/im.width); im = im.resize((width,h), Image.LANCZOS)
    im.save(dest, "PNG"); os.remove(tmp)

def gen_one(idx):
    dest = OUTDIR / f"reservoir_opt_{idx}.png"
    if dest.exists(): log(f"skip {idx}"); return dest
    prompt = BASE.format(v=VARIANTS[idx % len(VARIANTS)]); seed = 5100 + idx*47
    for attempt in range(3):
        d = create(prompt, seed + attempt*613)
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
    cw = 420; cells = []
    for i, im in imgs:
        h = round(im.height*cw/im.width); im = im.resize((cw,h), Image.LANCZOS)
        d = ImageDraw.Draw(im); label = f"RESERVOIR {chr(65+i)}"
        try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
        except Exception: font = ImageFont.load_default()
        d.rectangle([0,0,232,44], fill=(0,0,0)); d.text((10,7), label, fill=(255,255,255), font=font)
        cells.append(im)
    cols=3; rows=(len(cells)+cols-1)//cols; ch=max(c.height for c in cells)
    sheet = Image.new("RGB", (cw*cols+6*(cols+1), ch*rows+6*(rows+1)), (18,18,20))
    for i,c in enumerate(cells):
        x=(i%cols)*(cw+6)+6; y=(i//cols)*(ch+6)+6; sheet.paste(c,(x,y))
    out = OUTDIR / "_sheet_reservoir.png"; sheet.save(out, "PNG"); log(f"SHEET -> {out}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    N = int(os.environ.get("N","6"))
    paths = [gen_one(i) for i in range(N)]; contact_sheet(paths); log("DONE")

if __name__ == "__main__": main()
