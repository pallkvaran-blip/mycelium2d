#!/usr/bin/env python3
# Realistic portraits of the two REAL starter species (Marasmius oreades,
# Armillaria ostoyae) via Replicate FLUX-dev (photoreal), + rebuild the
# self-contained data-URI bundle the species-select screen inlines.
import os, sys, json, time, subprocess, tempfile, base64
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("SPECIESLOG", "/tmp/species_real.log")

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

# realistic — NO bioluminescent styling; naturalistic photography look
SPECIES = [
 ("marasmius-oreades",
  "A photorealistic close-up nature photograph of Marasmius oreades, the fairy "
  "ring champignon mushroom: small buff to tan bell-shaped caps with a broad "
  "rounded central umbo and pale slightly wavy margins, on slender tough "
  "cream-coloured stems, a cluster growing along the gentle arc of a fairy ring "
  "through short damp green grass and moss, tiny dewdrops, soft overcast morning "
  "light, shallow depth of field, dark blurred woodland-edge background, "
  "naturalistic, highly detailed, no text, no watermark"),
 ("armillaria-ostoyae",
  "A photorealistic close-up nature photograph of honey fungus Armillaria "
  "ostoyae growing in a dense crowded cluster at the base of a dark tree trunk: "
  "glossy honey-brown and caramel-tan convex caps with fine darker scales near "
  "the centre and a pale ring on the fibrous stems, overlapping fruit bodies, "
  "black shoelace-like rhizomorph cords threading through damp dark soil and "
  "bark, moody autumn woodland floor, low warm natural light, shallow depth of "
  "field, naturalistic, highly detailed, no text, no watermark"),
]

# card thumbnails still referenced by the two hands
HAND_THUMBS = ["hyphal-extension","foraging-fan","apical-drive","rhizomorph-lance"]

MODELS = ["black-forest-labs/flux-dev", "black-forest-labs/flux-schnell"]

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, model):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"3:4",
                                "num_outputs":1,"output_format":"png"}})
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

def download_jpg(url, dest, width=560, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    h = round(im.height*width/im.width)
    im = im.resize((width,h), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True)
    os.remove(tmp)

def datauri(path, width, q=82):
    im = Image.open(path).convert("RGB")
    if im.width > width:
        h = round(im.height*width/im.width)
        im = im.resize((width,h), Image.LANCZOS)
    tmp = tempfile.mktemp(suffix=".jpg")
    im.save(tmp, "JPEG", quality=q, optimize=True)
    b = base64.b64encode(Path(tmp).read_bytes()).decode()
    os.remove(tmp)
    return "data:image/jpeg;base64," + b

def gen(slug, prompt):
    dest = OUTDIR / f"{slug}.jpg"
    if dest.exists(): log(f"skip {slug} (exists)"); return
    for model in MODELS:
        for attempt in range(2):
            d = create(prompt, model)
            geturl = (d.get("urls") or {}).get("get")
            if not geturl:
                log(f"{slug}[{model}]: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(4); continue
            r = poll(geturl)
            out = r.get("output")
            if r.get("status")=="succeeded" and out:
                url = out[0] if isinstance(out, list) else out
                try:
                    download_jpg(url, dest); log(f"OK {slug} via {model} {dest.stat().st_size//1024}KB"); return
                except Exception as e:
                    log(f"{slug}: dl error {e}")
            else:
                log(f"{slug}[{model}]: {r.get('status')}"); time.sleep(3)
    log(f"FAIL {slug}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for slug, prompt in SPECIES:
        gen(slug, prompt)
    uris = {}
    for slug, _ in SPECIES:
        p = OUTDIR / f"{slug}.jpg"
        if p.exists(): uris[slug] = datauri(p, 560, 84)
    for slug in HAND_THUMBS:
        p = ROOT / "assets" / "cards" / f"{slug}.jpg"
        if p.exists(): uris["thumb-"+slug] = datauri(p, 150, 80)
    outp = ROOT / "scratchpad" / "species_datauris.json"
    outp.write_text(json.dumps(uris))
    total = sum(len(v) for v in uris.values())
    log(f"DATAURIS keys={list(uris.keys())} totalKB={total//1024} -> {outp}")

if __name__ == "__main__":
    main()
