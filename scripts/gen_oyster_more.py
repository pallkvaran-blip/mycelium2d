#!/usr/bin/env python3
# More Oyster (Pleurotus ostreatus) portrait options, tuned for a REAL photograph look
# (less glossy/CGI). Writes pleurotus-ostreatus-4..9 to assets/species_options/.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"; OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("OYLOG", "/tmp/oyster_more.log")
MODEL = "black-forest-labs/flux-1.1-pro"

# Push toward authentic amateur/field photography: real camera cues, natural light,
# blemishes and debris, muted colour — steer away from the over-rendered CGI sheen.
NEG = ("candid amateur field photograph, shot on a DSLR with a 100mm macro lens, natural "
       "overcast daylight, true-to-life muted colours, realistic imperfections, small blemishes, "
       "specks of soil and bark debris, faint insect nibbles, matte damp surface, subtle grain, "
       "realistic depth of field, documentary mushroom field-guide photo, unretouched, "
       "not glossy, not CGI, not rendered, no text, no watermark, no border")

PROMPTS = [
    ("A wild clump of oyster mushrooms (Pleurotus ostreatus) growing from the side of a mossy "
     "fallen beech log in a temperate woodland, overlapping shelf-like grey-brown caps, white "
     "gills, damp bark, forest litter, " + NEG),
    ("Close-up of oyster mushrooms (Pleurotus ostreatus) on decaying wood, tiered pale grey caps "
     "with slightly torn wavy edges, one cap chewed by slugs, morning dew, soft diffuse light, "
     + NEG),
    ("A modest cluster of young oyster mushrooms (Pleurotus ostreatus) emerging from a crack in "
     "dead oak wood, muted fawn and dove-grey caps, deep shaded forest, low natural light, " + NEG),
]

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
def gen(n, prompt, seed):
    dest = OUTDIR / f"pleurotus-ostreatus-{n}.jpg"
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
    # 6 new options (4..9): two seeds per prompt variant.
    n = 4
    for si, seed in enumerate((3110, 6820)):
        for pi, prompt in enumerate(PROMPTS):
            gen(n, prompt, seed=seed + pi * 271); n += 1; time.sleep(1)
    log("OYSTER_MORE DONE")
if __name__ == "__main__": main()
