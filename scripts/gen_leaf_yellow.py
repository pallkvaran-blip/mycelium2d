#!/usr/bin/env python3
# YELLOW-leaf litter OPTIONS for the low-value "duff" pile. The duff pile was the
# orange oak/maple leaves tinted brown — which melted into the brown soil. This
# generates a set of golden/yellow autumn leaves (the new DOMINANT colour of the
# duff heap) plus a couple of brown / dark-brown leaves to mix in as the minority.
# Same sprite pipeline as gen_leaf_options.py: flux-1.1-pro renders one leaf on a
# plain white background, BiRefNet mattes it to a clean transparent PNG (falls back
# to a local white-key if matting is unavailable). Outputs to assets/leaf_options/
# plus a contact sheet on dark soil.
#   python3 scripts/gen_leaf_yellow.py
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "leaf_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"

def load_token():
    t = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if t:
        return t
    try:
        d = json.load(open(os.path.expanduser("~/.claude/settings.json")))
        return d.get("env", {}).get("REPLICATE_API_TOKEN", "").strip()
    except Exception:
        return ""

TOKEN = load_token()
GEN_MODEL = "black-forest-labs/flux-1.1-pro"
RMBG_MODEL = "men1scus/birefnet"

# Matches the existing leafOak/leafMaple look: one painterly, semi-realistic dry
# leaf, flat top-down, isolated on white, soft warm light, subtle veining.
STYLE = ("single dry autumn leaf, top-down flat lay, isolated on a plain solid white background, "
         "painterly semi-realistic game asset, soft warm studio lighting, subtle leaf veins, high detail, "
         "one leaf only, centered, naturally curled edges, no other leaves, no hands, no text, no watermark")

PROMPTS = {
  # --- yellow / gold (the new DOMINANT duff colour) ---
  "yellow_aspen":    f"a bright golden-yellow quaking aspen leaf, small rounded heart shape with fine teeth, warm buttery yellow, {STYLE}",
  "yellow_birch":    f"a clear yellow birch leaf, oval with a pointed tip and serrated edges, vivid lemon-gold, {STYLE}",
  "yellow_ginkgo":   f"a golden-yellow ginkgo leaf, fan-shaped with a fluted edge and radiating veins, rich amber-gold, {STYLE}",
  "yellow_hickory":  f"a yellow-gold hickory leaflet, elongated oval, deep saffron yellow shading to light gold, {STYLE}",
  "yellow_poplar":   f"a golden tulip-poplar leaf, four-lobed and broad, bright honey-yellow with green-gold veins, {STYLE}",
  "yellow_maple":    f"a golden-yellow sugar maple leaf with five pointed lobes, glowing amber-yellow fading to gold, {STYLE}",
  "yellow_elm":      f"a yellow elm leaf, oval with a lopsided base and strong parallel veins, warm mustard-gold, {STYLE}",
  # --- brown / dark-brown (the MINORITY mixed into the heap) ---
  "brown_oak":       f"a dry mid-brown oak leaf with rounded lobes, warm tan-brown, slightly curled and crisp, {STYLE}",
  "darkbrown_beech": f"a dark chocolate-brown beech leaf, oval with a pointed tip and straight parallel veins, deep rotted brown, {STYLE}",
}

def log(m): print(m, flush=True)

def curl_json(a):
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA] + a, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"_raw": r.stdout[:300]}

AUTH = ["-H", f"Authorization: Bearer {TOKEN}", "-H", "Content-Type: application/json"]

def gen_white(prompt):
    body = json.dumps({"input": {"prompt": prompt, "aspect_ratio": "1:1", "output_format": "png",
                                 "safety_tolerance": 5, "prompt_upsampling": True}})
    d = curl_json(AUTH + ["-H", "Prefer: wait", "-d", body,
                          f"https://api.replicate.com/v1/models/{GEN_MODEL}/predictions"])
    if d.get("status") != "succeeded":
        u = d.get("urls", {}).get("get")
        if u:
            d = poll(u)
    return out_url(d), d.get("status")

def birefnet_version():
    d = curl_json(AUTH + [f"https://api.replicate.com/v1/models/{RMBG_MODEL}"])
    return (d.get("latest_version") or {}).get("id", "")

def matte(url, ver):
    body = json.dumps({"version": ver, "input": {"image": url}})
    d = curl_json(AUTH + ["-H", "Prefer: wait", "-d", body, "https://api.replicate.com/v1/predictions"])
    if d.get("status") != "succeeded":
        u = d.get("urls", {}).get("get")
        if u:
            d = poll(u)
    return out_url(d), d.get("status")

def poll(u):
    for _ in range(120):
        d = curl_json(["-H", f"Authorization: Bearer {TOKEN}", u])
        if d.get("status") in ("succeeded", "failed", "canceled"):
            return d
        time.sleep(2)
    return {"status": "timeout"}

def out_url(d):
    o = d.get("output")
    if isinstance(o, str): return o
    if isinstance(o, list) and o: return o[0]
    return None

def download(url, dest):
    subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA, "-o", dest, url], check=True)

def finalize_png(src, dest, height=360):
    """Crop to the leaf's alpha bbox and resize to the game's leaf height."""
    im = Image.open(src).convert("RGBA")
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    w = round(im.width * height / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    im.save(dest, "PNG", optimize=True)

if not TOKEN:
    raise SystemExit("No REPLICATE_API_TOKEN (env or ~/.claude/settings.json).")

ver = birefnet_version()
log(f"BiRefNet version: {ver or '(none — will white-key)'}")
made = []
for slug, prompt in PROMPTS.items():
    dest = OUTDIR / f"{slug}.png"
    if dest.exists():
        log(f"skip {dest.name}"); made.append(dest); continue
    gurl, gst = None, None
    for attempt in range(4):
        gurl, gst = gen_white(prompt)
        if gurl: break
        log(f"  gen retry {slug} ({gst})"); time.sleep(5)
    if not gurl:
        log(f"FAIL gen {slug} ({gst})"); continue
    raw = tempfile.mktemp(suffix=".png")
    ok = False
    if ver:
        murl, mst = matte(gurl, ver)
        if murl:
            download(murl, raw); ok = True
        else:
            log(f"  matte failed {slug} ({mst}) — white-key fallback")
    if not ok:
        rawg = tempfile.mktemp(suffix=".png"); download(gurl, rawg)
        subprocess.run(["python3", str(ROOT / "scripts" / "keywhite.py"), rawg, raw], check=True)
        os.remove(rawg)
    finalize_png(raw, dest); os.remove(raw)
    log(f"OK  {dest.name}"); made.append(dest)
    time.sleep(8)  # respect low-credit burst throttle

# Contact sheet on dark soil so the leaves read as they will in-game.
if made:
    cols = 3
    rows = (len(made) + cols - 1) // cols
    cw, ch = 300, 320
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (58, 40, 28, 255))
    for i, pth in enumerate(made):
        im = Image.open(pth).convert("RGBA")
        im.thumbnail((cw - 60, ch - 70))
        x = (i % cols) * cw + (cw - im.width) // 2
        y = (i // cols) * ch + (ch - 60 - im.height) // 2 + 10
        sheet.alpha_composite(im, (x, y))
    sheet.convert("RGB").save(OUTDIR / "_contact_yellow.png", "PNG")
    log(f"contact sheet -> {OUTDIR / '_contact_yellow.png'}")
log(f"DONE {len(made)} leaves")
