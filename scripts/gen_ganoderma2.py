#!/usr/bin/env python3
# Artist's Conk RE-ROLL (options 4..9) — accurate morphology: a big HARD WOODY SHELF
# bracket jutting from a trunk; dull matte lumpy grey-brown top dusted with rust-brown
# spore powder; flat chalk-white pore underside. NOT a glossy ringed rosette.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"; OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("GC2LOG", "/tmp/ganoderma2.log")
MODEL = "black-forest-labs/flux-1.1-pro"
NEG = ("candid amateur field photograph, shot on a DSLR macro lens, natural overcast daylight, "
       "true-to-life muted colours, hard matte woody texture, realistic imperfections, bark debris, "
       "subtle grain, documentary mushroom field-guide photo, unretouched, NOT glossy, NOT lacquered, "
       "NOT varnished, not a neat symmetrical rosette, not CGI, not rendered, no text, no watermark, no border")
PROMPTS = [
    # A — hero shelf, low 3/4 view showing top + white underside
    ("Ganoderma applanatum, the artist's conk: a single large hard woody shelf bracket projecting "
     "horizontally from a mossy hardwood tree trunk, low three-quarter angle showing both its dull "
     "lumpy grey-brown concentrically-furrowed matte top and its flat chalk-white pore underside, "
     "the top and the bark below dusted with rusty cinnamon-brown spore powder, thick and woody, " + NEG),
    # B — stacked tiers on a dead log
    ("Ganoderma applanatum artist's conk: several thick hard woody shelf brackets stacked in "
     "overlapping tiers on a fallen dead hardwood log, dull umber and grey-brown knobbly "
     "concentrically-zoned upper crusts heavily dusted with rust-brown spore powder, broad flat "
     "white pore undersides, damp shaded forest floor, " + NEG),
    # C — big single conk, white underside prominent
    ("A large mature artist's conk (Ganoderma applanatum) bracket on the base of a tree trunk, "
     "seen slightly from below so its broad flat pure chalk-white pore underside dominates, with the "
     "hard dull brown concentrically-ridged upper rim above, a thick woody perennial shelf, " + NEG),
]
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)
def cj(a):
    r = subprocess.run(["curl", "-sS", "--max-time", "90", "--cacert", CA] + a, capture_output=True, text=True)
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
    dest = OUTDIR / f"ganoderma-applanatum-{n}.jpg"
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
    n = 4
    for si, seed in enumerate((7400, 9120)):
        for pi, prompt in enumerate(PROMPTS):
            gen(n, prompt, seed=seed + pi * 337); n += 1; time.sleep(1)
    log("GANODERMA2 DONE")
if __name__ == "__main__": main()
