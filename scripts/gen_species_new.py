#!/usr/bin/env python3
# New species portraits (Oyster + Slippery Jack) -> assets/species_options/
# Promote the best to assets/species/<img>.jpg. Realistic mushroom photography,
# matching the existing species house style (photoreal macro, shallow DoF, forest floor).
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"; OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("SPLOG", "/tmp/species_new.log")
MODEL = "black-forest-labs/flux-1.1-pro"

SPECIES = {
    "pleurotus-ostreatus": (
        "A photorealistic close-up nature photograph of Pleurotus ostreatus, the oyster "
        "mushroom: a cluster of overlapping fan-shaped and shell-shaped caps in soft pearly "
        "grey to tan-brown, smooth slightly wavy margins, white decurrent gills running down "
        "short off-center stems, growing in shelving tiers on a weathered dead hardwood log, "
        "damp mossy forest, soft natural light, shallow depth of field, naturalistic, highly "
        "detailed, no text, no watermark, no border"),
    "suillus-luteus": (
        "A photorealistic close-up nature photograph of Suillus luteus, the slippery jack "
        "bolete: a rounded chestnut-brown cap with a glossy slimy wet surface, a spongy pale-"
        "yellow pore layer beneath instead of gills, a pale stem with a purple-brown ring, "
        "growing on the needle-littered floor of a pine forest among fallen pine needles and "
        "damp soil, soft natural light, shallow depth of field, naturalistic, highly detailed, "
        "no text, no watermark, no border"),
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
        for n in (1, 2, 3): gen(slug, prompt, n, seed=4200 + n * 173); time.sleep(1)
    log("SPECIES_NEW DONE")

if __name__ == "__main__": main()
