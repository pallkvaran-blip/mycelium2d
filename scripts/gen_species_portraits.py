#!/usr/bin/env python3
# Generate two starter-species portraits for the species-select screen via
# Replicate (FLUX schnell), matching the deck's card-art look. Portraits are the
# landscape cards' left-hand image. Also emits base64 data-URIs (portraits +
# starting-hand card thumbnails) so the select screen can be a self-contained
# Artifact (its CSP blocks external hosts). Reads REPLICATE_API_TOKEN from env.
import os, sys, json, time, subprocess, tempfile, base64
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("SPECIESLOG", "/tmp/species_gen.log")

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

STYLE = ("dark bioluminescent fungal fantasy portrait illustration, moody "
         "atmospheric, painterly, highly detailed, deep near-black soil "
         "background, soft volumetric glow, subtle organic grain, no text, "
         "no watermark, no border")

# (slug, subject)
SPECIES = [
 ("glowveil-forager",
  "a broad delicate cluster of small pale bioluminescent mushrooms glowing cool "
  "mint-cyan, standing over a wide fanning web of luminous mycelial threads that "
  "spread outward in every direction through dark forest soil, tiny buried caches "
  "of acorns and chestnuts nestled among the threads, dew, patient and gentle, "
  "cool teal light"),
 ("emberdrive-pioneer",
  "a single tall bold vigorous mushroom with a warm amber-gold glowing cap, "
  "driving one thick luminous rhizomorph cord forward like a spear across open "
  "dark earth, dynamic surging directed growth, trailing sparks of golden spores, "
  "energetic and aggressive, warm gold and teal glow"),
]

# starting-hand card art already in the deck -> small thumbnails, inlined
HAND_THUMBS = ["hyphal-extension","acorn-cache","apical-drive",
               "foraging-fan","rhizomorph-lance"]

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","60","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"3:4",
                                "num_outputs":1,"output_format":"png"}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,
                      "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"])

def poll(geturl):
    for _ in range(60):
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

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for slug, subject in SPECIES:
        dest = OUTDIR / f"{slug}.jpg"
        if dest.exists():
            log(f"skip {slug} (exists)"); continue
        prompt = f"{subject}, {STYLE}"
        for attempt in range(3):
            d = create(prompt)
            geturl = (d.get("urls") or {}).get("get")
            if not geturl:
                log(f"{slug}: create fail ({d.get('detail') or d.get('_raw')}) retry {attempt}")
                time.sleep(5); continue
            r = poll(geturl)
            out = r.get("output")
            if r.get("status")=="succeeded" and out:
                try:
                    download_jpg(out[0], dest)
                    log(f"OK {slug} {dest.stat().st_size//1024}KB"); break
                except Exception as e:
                    log(f"{slug}: dl error {e}")
            else:
                log(f"{slug}: {r.get('status')} retry {attempt}"); time.sleep(4)
        else:
            log(f"FAIL {slug}")

    # emit data-URIs for a self-contained artifact
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
