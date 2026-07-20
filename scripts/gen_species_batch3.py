#!/usr/bin/env python3
# Portraits for the 3 double-engine species (Wine Cap / Violet Webcap / Dry Rot).
# Field-photo prompt style (natural light, imperfections) -> assets/species_options/.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"; OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("B3LOG", "/tmp/species_batch3.log")
MODEL = "black-forest-labs/flux-1.1-pro"

NEG = ("candid amateur field photograph, shot on a DSLR with a 100mm macro lens, natural "
       "overcast daylight, true-to-life muted colours, realistic imperfections, small blemishes, "
       "specks of soil and bark debris, matte damp surface, subtle grain, realistic depth of field, "
       "documentary mushroom field-guide photo, unretouched, not glossy, not CGI, not rendered, "
       "no text, no watermark, no border")

SPECIES = {
    "stropharia-rugosoannulata": (
        "A wild Wine Cap mushroom (Stropharia rugosoannulata), a large domed burgundy wine-red "
        "cap on a thick white stem with a ragged toothed ring, dark grey-purple gills, growing in "
        "a bed of wood-chip mulch and straw on a damp woodland garden floor, " + NEG),
    "cortinarius-violaceus": (
        "A wild Violet Webcap mushroom (Cortinarius violaceus), entirely deep dark violet-indigo, "
        "a dry finely scaly domed cap, violet gills and a stout swollen violet stem, growing in "
        "green moss on a damp shaded conifer forest floor, " + NEG),
    "serpula-lacrymans": (
        "Serpula lacrymans, true dry rot fungus: a rust-orange and ochre folded wrinkled pancake-"
        "like fruiting body with a thick cottony white margin, surrounded by spreading grey-white "
        "mycelial cords, growing on decaying damp timber in deep shade, " + NEG),
}

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)
def cj(args):
    r = subprocess.run(["curl", "-sS", "--max-time", "90", "--cacert", CA] + args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}
def create(prompt, seed):
    body = json.dumps({"input": {"prompt": prompt, "aspect_ratio": "3:4", "output_format": "png", "safety_tolerance": 5, "seed": seed}})
    return cj(["-H", f"Authorization: Bearer {TOKEN}", "-H", "Content-Type: application/json", "-d", body,
               f"https://api.replicate.com/v1/models/{MODEL}/predictions"])
def poll(u):
    for _ in range(90):
        d = cj(["-H", f"Authorization: Bearer {TOKEN}", u]); st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed", "canceled"): return d
        time.sleep(2)
    return {"status": "timeout"}
def save(url, dest, width=560, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl", "-sS", "--max-time", "120", "--cacert", CA, "-o", tmp, url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)
def gen(slug, prompt, n, seed):
    dest = OUTDIR / f"{slug}-{n}.jpg"
    for a in range(3):
        d = create(prompt, seed + a * 911); g = ((d.get("urls") or {}).get("get")) or ""
        if not g: log(f"{dest.name}: create fail {d.get('detail') or d.get('_raw')}"); time.sleep(4); continue
        r = poll(g); out = r.get("output"); url = out[0] if isinstance(out, list) and out else (out if isinstance(out, str) else "")
        if r.get("status") == "succeeded" and url:
            try: save(url, str(dest)); log(f"OK {dest.name} {dest.stat().st_size // 1024}KB"); return
            except Exception as e: log(f"{dest.name} dl err {e}")
        else: log(f"{dest.name}: {r.get('status')}"); time.sleep(3)
    log(f"FAIL {dest.name}")
def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for slug, prompt in SPECIES.items():
        for n in (1, 2, 3): gen(slug, prompt, n, seed=5300 + n * 149); time.sleep(1)
    log("BATCH3 DONE")
if __name__ == "__main__": main()
