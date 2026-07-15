#!/usr/bin/env python3
# Realistic portraits for the two level-1 unlock species (Scleroderma citrinum,
# Hydnellum peckii) via Replicate FLUX-dev, + rebuild the full data-URI bundle
# (4 portraits + 8 card thumbnails) the species-select screen inlines.
import os, sys, json, time, subprocess, tempfile, base64
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("SPECIESLOG", "/tmp/species_real2.log")

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

NEW = [
 ("scleroderma-citrinum",
  "A photorealistic close-up nature photograph of Scleroderma citrinum, the "
  "common earthball fungus: a round firm ochre-yellow to tan fungal ball with a "
  "thick warty cracked leathery rind, a couple of them half-buried in dark mossy "
  "woodland soil among fallen leaves, damp forest floor, soft natural light, "
  "shallow depth of field, naturalistic, highly detailed, no text, no watermark"),
 ("hydnellum-peckii",
  "A photorealistic close-up nature photograph of Hydnellum peckii, the bleeding "
  "tooth fungus: a velvety white and pale pink irregular fungal cap exuding vivid "
  "blood-red liquid droplets across its surface by guttation, growing on dark "
  "mossy coniferous forest floor among pine needles, dewy, soft natural light, "
  "shallow depth of field, naturalistic, highly detailed, no text, no watermark"),
]

PORTRAITS = ["marasmius-oreades","armillaria-ostoyae","scleroderma-citrinum","hydnellum-peckii"]
THUMBS = ["hyphal-extension","foraging-fan","apical-drive","rhizomorph-lance",
          "acorn-cache","sclerotial-crust","amputate","aquaporin-channels"]
MODELS = ["black-forest-labs/flux-dev", "black-forest-labs/flux-schnell"]

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, model):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"3:4","num_outputs":1,"output_format":"png"}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,f"https://api.replicate.com/v1/models/{model}/predictions"])

def poll(geturl):
    for _ in range(75):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def download_jpg(url, dest, width=560, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB"); h = round(im.height*width/im.width)
    im.resize((width,h), Image.LANCZOS).save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

def datauri(path, width, q=82):
    im = Image.open(path).convert("RGB")
    if im.width > width:
        h = round(im.height*width/im.width); im = im.resize((width,h), Image.LANCZOS)
    tmp = tempfile.mktemp(suffix=".jpg"); im.save(tmp,"JPEG",quality=q,optimize=True)
    b = base64.b64encode(Path(tmp).read_bytes()).decode(); os.remove(tmp)
    return "data:image/jpeg;base64," + b

def gen(slug, prompt):
    dest = OUTDIR / f"{slug}.jpg"
    if dest.exists(): log(f"skip {slug}"); return
    for model in MODELS:
        for _ in range(2):
            d = create(prompt, model); geturl = (d.get("urls") or {}).get("get")
            if not geturl: log(f"{slug}[{model}] create fail"); time.sleep(4); continue
            r = poll(geturl); out = r.get("output")
            if r.get("status")=="succeeded" and out:
                url = out[0] if isinstance(out,list) else out
                try: download_jpg(url, dest); log(f"OK {slug} via {model}"); return
                except Exception as e: log(f"{slug} dl err {e}")
            else: log(f"{slug}[{model}] {r.get('status')}"); time.sleep(3)
    log(f"FAIL {slug}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for slug, prompt in NEW: gen(slug, prompt)
    uris = {}
    for slug in PORTRAITS:
        p = OUTDIR / f"{slug}.jpg"
        if p.exists(): uris[slug] = datauri(p, 560, 84)
    for slug in THUMBS:
        p = ROOT / "assets" / "cards" / f"{slug}.jpg"
        if p.exists(): uris["thumb-"+slug] = datauri(p, 150, 80)
    outp = ROOT / "scratchpad" / "species_datauris.json"; outp.write_text(json.dumps(uris))
    log(f"DATAURIS keys={list(uris.keys())} totalKB={sum(len(v) for v in uris.values())//1024}")

if __name__ == "__main__": main()
