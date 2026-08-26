#!/usr/bin/env python3
# Feasibility test for the illustration route: does recraft-v3-svg return TRUE vector?
# Some "SVG" endpoints wrap a bitmap in an <image> tag, which would be useless for an
# editable print master -- so this checks the returned markup, not just that it renders.
import os, json, time, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets" / "tanda_options" / "recraft"
OUT.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
MODEL = "recraft-ai/recraft-v3-svg"

TESTS = [
    ("mango", "1024x1024",
     "A single ripe mango, flat vector packaging illustration, bold clean shapes, warm "
     "golden orange skin with a red blush and one green leaf, confident dark outline, "
     "simple flat colour with two-tone shading, centred on a plain background"),
    ("scene", "1024x1024",
     "A tropical waterfall in lush jungle, flat vector illustration for a juice label, "
     "layered green foliage and palm leaves framing a white waterfall falling into a "
     "turquoise pool, warm sky, bold simple shapes, limited flat colour palette"),
    ("leaves", "1024x1024",
     "A border cluster of tropical leaves and mango foliage, flat vector illustration, "
     "bold clean shapes in three shades of green, dark outline, arranged as a decorative "
     "corner element on a plain background"),
]

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","120","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": (r.stdout or r.stderr)[:300]}

def run(name, size, prompt):
    dest = OUT / f"{name}.svg"
    if dest.exists(): print(f"skip {name}"); return dest
    body = json.dumps({"input": {"prompt": prompt, "size": size, "style": "any"}})
    d = curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                   "-d",body,f"https://api.replicate.com/v1/models/{MODEL}/predictions"])
    get = (d.get("urls") or {}).get("get")
    if not get:
        print(f"{name}: create failed -> {d.get('detail') or d.get('_raw')}"); return None
    for _ in range(90):
        r = curl_json(["-H",f"Authorization: Bearer {TOKEN}",get])
        if r.get("status") in ("succeeded","failed","canceled"): break
        time.sleep(2)
    if r.get("status") != "succeeded":
        print(f"{name}: {r.get('status')} {r.get('error') or ''}"); return None
    url = r["output"] if isinstance(r["output"], str) else r["output"][0]
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",str(dest),url], check=True)
    print(f"OK {name} {dest.stat().st_size//1024}KB")
    return dest

def inspect(p):
    s = p.read_text(errors="ignore")
    import re
    paths = len(re.findall(r"<path", s))
    imgs  = len(re.findall(r"<image", s))
    b64   = "base64" in s
    verdict = "RASTER WRAPPED IN SVG" if (imgs or b64) else "true vector"
    print(f"  {p.name:12s} paths={paths:5d} image_tags={imgs} base64={b64}  -> {verdict}")

if __name__ == "__main__":
    if not TOKEN: sys.exit("REPLICATE_API_TOKEN not set")
    made = [run(*t) for t in TESTS]
    print("\n--- output inspection ---")
    for p in made:
        if p: inspect(p)
