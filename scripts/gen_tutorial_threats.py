#!/usr/bin/env python3
# Realistic, scary macro/micro images of the three tutorial threats (ant,
# nematode, trichoderma mould) via Replicate FLUX-dev — several OPTIONS each so
# a human can pick the winner. Also composes a labelled 2x2 contact sheet per
# threat for quick side-by-side review.
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
LOG = os.environ.get("THREATLOG", "/tmp/tutorial_threats.log")

N = 4  # options per threat

THREATS = [
 ("ant",
  "A terrifying extreme macro photograph of a giant menacing bull ant, enormous "
  "razor-sharp serrated mandibles gaping wide open, aggressive head-on close-up, "
  "glossy dark red-black chitin exoskeleton, huge detailed compound eyes, spiny "
  "barbed legs, shot from a low threatening angle, harsh dramatic side lighting, "
  "deep black background, hyperdetailed, sharp focus, nature-horror, cinematic, "
  "no text, no watermark"),
 ("nematode",
  "A frightening scientific microscopy photograph of a predatory nematode "
  "roundworm, long translucent pale glistening writhing body, a gaping circular "
  "sucking mouth ringed with sharp teeth and a piercing stylet aimed at the "
  "viewer, menacing extreme close-up, wet slimy sheen, ominous dark background, "
  "electron-microscope horror aesthetic, hyperdetailed, sharp focus, "
  "no text, no watermark"),
 ("trichoderma",
  "A menacing extreme macro photograph of aggressive Trichoderma mould, a "
  "creeping vivid green and white fuzzy sporulating fungal colony swelling and "
  "engulfing rotting matter, dense powdery spore heads, threatening organic "
  "tendrils spreading toward the viewer, damp glistening, ominous deep shadow "
  "background, dark nature-horror mood, hyperdetailed, sharp focus, "
  "no text, no watermark"),
]

MODELS = ["black-forest-labs/flux-dev", "black-forest-labs/flux-schnell"]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, model, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"4:3",
                                "num_outputs":1,"output_format":"png","seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,
                      f"https://api.replicate.com/v1/models/{model}/predictions"])

def poll(geturl):
    for _ in range(75):
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

def gen_one(slug, idx, prompt):
    dest = OUTDIR / f"{slug}_{idx}.png"
    if dest.exists(): log(f"skip {slug}_{idx} (exists)"); return dest
    seed = 1000 + idx * 37 + sum(ord(c) for c in slug)
    for model in MODELS:
        for attempt in range(2):
            d = create(prompt, model, seed + attempt*911)
            geturl = (d.get("urls") or {}).get("get")
            if not geturl:
                log(f"{slug}_{idx}[{model}]: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(4); continue
            r = poll(geturl)
            out = r.get("output")
            if r.get("status")=="succeeded" and out:
                url = out[0] if isinstance(out, list) else out
                try:
                    download_png(url, dest); log(f"OK {slug}_{idx} via {model} {dest.stat().st_size//1024}KB"); return dest
                except Exception as e:
                    log(f"{slug}_{idx}: dl error {e}")
            else:
                log(f"{slug}_{idx}[{model}]: {r.get('status')}"); time.sleep(3)
    log(f"FAIL {slug}_{idx}")
    return None

def contact_sheet(slug, paths):
    imgs = [Image.open(p).convert("RGB") for p in paths if p and p.exists()]
    if not imgs: return
    cw = 480
    cells = []
    for i, im in enumerate(imgs):
        h = round(im.height*cw/im.width)
        im = im.resize((cw, h), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        label = f"{slug.upper()} {chr(65+i)}"
        try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
        except Exception: font = ImageFont.load_default()
        d.rectangle([0,0,150,46], fill=(0,0,0))
        d.text((10,6), label, fill=(255,255,255), font=font)
        cells.append(im)
    ch = max(c.height for c in cells)
    sheet = Image.new("RGB", (cw*2+18, ch*2+18), (18,18,20))
    for i, c in enumerate(cells[:4]):
        x = (i%2)*(cw+6)+6; y = (i//2)*(ch+6)+6
        sheet.paste(c, (x,y))
    out = OUTDIR / f"_sheet_{slug}.png"
    sheet.save(out, "PNG")
    log(f"SHEET {slug} -> {out}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for slug, prompt in THREATS:
        paths = [gen_one(slug, i, prompt) for i in range(N)]
        contact_sheet(slug, paths)
    log("DONE")

if __name__ == "__main__":
    main()
