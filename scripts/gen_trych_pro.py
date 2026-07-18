#!/usr/bin/env python3
# Extra Trichoderma options via FLUX 1.1 PRO — FULLY REALISTIC, true-to-life green
# mould (not the stylised coral/brain look). Saves trichoderma_pro_0..N alongside the
# originals and builds a labelled contact sheet for review. Does NOT touch the
# picked assets/tutorial/trichoderma.jpg — a human picks the winner afterwards.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "tutorial_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
if not TOKEN:
    tf = Path("/tmp/claude-0/-home-user-mycelium2d/e43b2131-64d6-51a4-b68f-76b2b5524080/scratchpad/.replicate_token")
    if tf.exists(): TOKEN = tf.read_text().strip()
LOG = os.environ.get("THREATLOG", "/tmp/trych_pro.log")

MODEL = "black-forest-labs/flux-1.1-pro"

BASE = ("Fully realistic, true-to-life extreme macro photograph of Trichoderma green "
        "mould, {v}, vivid emerald and lime-green powdery sporulating fungal colony "
        "with soft fuzzy white mycelial edges, fine green spore dust, dense velvety "
        "texture, damp organic substrate, natural soft diffused light, shallow depth "
        "of field, hyperrealistic photographic detail, accurate natural colour, "
        "nature-documentary macro photography, subtle dark earthy background, "
        "no text, no watermark, not an illustration, photorealistic")

VARIANTS = [
    "spreading in a thick fuzzy colony across damp decaying wood and bark",
    "colonising moist forest-floor soil and leaf litter",
    "a thick sporulating colony forming concentric green rings with a white advancing margin",
    "engulfing a wet rotting log in a velvety green bloom",
    "creeping over damp dark soil, dense green spore heads bristling upward",
    "a bright green mould patch with a downy white growing frontier on decaying matter",
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"4:3",
                                "output_format":"png","safety_tolerance":5,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(90):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def download_png(url, dest, width=720):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width:
        h = round(im.height*width/im.width)
        im = im.resize((width,h), Image.LANCZOS)
    im.save(dest, "PNG")
    os.remove(tmp)

def gen_one(idx):
    dest = OUTDIR / f"trichoderma_pro_{idx}.png"
    if dest.exists(): log(f"skip pro_{idx} (exists)"); return dest
    prompt = BASE.format(v=VARIANTS[idx % len(VARIANTS)])
    seed = 4200 + idx * 53
    for attempt in range(3):
        d = create(prompt, seed + attempt*777)
        geturl = (d.get("urls") or {}).get("get")
        if not geturl:
            log(f"pro_{idx}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(4); continue
        r = poll(geturl)
        out = r.get("output")
        if r.get("status")=="succeeded" and out:
            url = out[0] if isinstance(out, list) else out
            try:
                download_png(url, dest); log(f"OK pro_{idx} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e:
                log(f"pro_{idx}: dl error {e}")
        else:
            log(f"pro_{idx}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(3)
    log(f"FAIL pro_{idx}")
    return None

def contact_sheet(paths):
    imgs = [(i, Image.open(p).convert("RGB")) for i, p in enumerate(paths) if p and p.exists()]
    if not imgs: return
    cw = 480
    cells = []
    for i, im in imgs:
        h = round(im.height*cw/im.width)
        im = im.resize((cw, h), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        label = f"TRYCH PRO {chr(65+i)}"
        try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
        except Exception: font = ImageFont.load_default()
        d.rectangle([0,0,232,46], fill=(0,0,0))
        d.text((10,7), label, fill=(255,255,255), font=font)
        cells.append(im)
    cols = 3
    rows = (len(cells)+cols-1)//cols
    ch = max(c.height for c in cells)
    sheet = Image.new("RGB", (cw*cols+6*(cols+1), ch*rows+6*(rows+1)), (18,18,20))
    for i, c in enumerate(cells):
        x = (i%cols)*(cw+6)+6; y = (i//cols)*(ch+6)+6
        sheet.paste(c, (x,y))
    out = OUTDIR / "_sheet_trichoderma_pro.png"
    sheet.save(out, "PNG")
    log(f"SHEET -> {out}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    N = int(os.environ.get("N", "6"))
    paths = [gen_one(i) for i in range(N)]
    contact_sheet(paths)
    log("DONE")

if __name__ == "__main__":
    main()
