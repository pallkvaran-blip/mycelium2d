#!/usr/bin/env python3
# SIX NEW yellow-leaf variations for the low-value "duff" pile, so the owner can
# pick which yellows go into the heap. Distinct species/shapes from the current
# set (Ginkgo, Maple, Poplar, Aspen, Elm). Same pipeline as gen_leaf_yellow.py:
# flux-1.1-pro renders one leaf on white, BiRefNet mattes to transparent PNG
# (white-key fallback), crop + resize to the game's leaf height.
#   python3 scripts/gen_leaf_yellow6.py
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "leaf_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"

def load_token():
    t = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if t: return t
    try:
        d = json.load(open(os.path.expanduser("~/.claude/settings.json")))
        return d.get("env", {}).get("REPLICATE_API_TOKEN", "").strip()
    except Exception:
        return ""

TOKEN = load_token()
GEN_MODEL = "black-forest-labs/flux-1.1-pro"
RMBG_MODEL = "men1scus/birefnet"

STYLE = ("single dry autumn leaf, top-down flat lay, isolated on a plain solid white background, "
         "painterly semi-realistic game asset, soft warm studio lighting, subtle leaf veins, high detail, "
         "one leaf only, centered, naturally curled edges, no other leaves, no hands, no text, no watermark")

# Six NEW yellow/gold variants (shapes distinct from the current five).
PROMPTS = {
  "yellow6_cottonwood": f"a broad triangular deltoid cottonwood leaf, glossy bright golden-yellow, coarse blunt teeth along the edge, {STYLE}",
  "yellow6_sycamore":   f"a large three-lobed palmate sycamore plane leaf, warm yellow-gold with tan veins, wide and shallow lobes, {STYLE}",
  "yellow6_willow":     f"a long slender lance-shaped willow leaf, soft pale lemon-yellow, gently curved with a fine tip, {STYLE}",
  "yellow6_katsura":    f"a small rounded heart-shaped katsura leaf, warm apricot butter-gold, scalloped edge, delicate, {STYLE}",
  "yellow6_hazel":      f"a rounded doubly-serrated oval hazel leaf, rich honey-gold, soft downy texture, {STYLE}",
  "yellow6_linden":     f"a heart-shaped linden basswood leaf with a pointed tip, clear glowing lemon-gold, fine even teeth, {STYLE}",
}

def log(m): print(m, flush=True)
def curl_json(a):
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA] + a, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:300]}
AUTH = ["-H", f"Authorization: Bearer {TOKEN}", "-H", "Content-Type: application/json"]

def gen_white(prompt):
    body = json.dumps({"input": {"prompt": prompt, "aspect_ratio": "1:1", "output_format": "png",
                                 "safety_tolerance": 5, "prompt_upsampling": True}})
    d = curl_json(AUTH + ["-H", "Prefer: wait", "-d", body,
                          f"https://api.replicate.com/v1/models/{GEN_MODEL}/predictions"])
    if d.get("status") != "succeeded":
        u = d.get("urls", {}).get("get")
        if u: d = poll(u)
    return out_url(d), d.get("status")

def birefnet_version():
    d = curl_json(AUTH + [f"https://api.replicate.com/v1/models/{RMBG_MODEL}"])
    return (d.get("latest_version") or {}).get("id", "")

def matte(url, ver):
    body = json.dumps({"version": ver, "input": {"image": url}})
    d = curl_json(AUTH + ["-H", "Prefer: wait", "-d", body, "https://api.replicate.com/v1/predictions"])
    if d.get("status") != "succeeded":
        u = d.get("urls", {}).get("get")
        if u: d = poll(u)
    return out_url(d), d.get("status")

def poll(u):
    for _ in range(120):
        d = curl_json(["-H", f"Authorization: Bearer {TOKEN}", u])
        if d.get("status") in ("succeeded", "failed", "canceled"): return d
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
    im = Image.open(src).convert("RGBA")
    bb = im.getbbox()
    if bb: im = im.crop(bb)
    w = round(im.width * height / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    im.save(dest, "PNG", optimize=True)

if not TOKEN:
    raise SystemExit("No REPLICATE_API_TOKEN.")

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
        if murl: download(murl, raw); ok = True
        else: log(f"  matte failed {slug} ({mst}) — white-key fallback")
    if not ok:
        rawg = tempfile.mktemp(suffix=".png"); download(gurl, rawg)
        subprocess.run(["python3", str(ROOT / "scripts" / "keywhite.py"), rawg, raw], check=True)
        os.remove(rawg)
    finalize_png(raw, dest); os.remove(raw)
    log(f"OK  {dest.name}"); made.append(dest)
    time.sleep(8)
log(f"DONE {len(made)} leaves")
