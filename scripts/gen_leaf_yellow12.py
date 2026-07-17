#!/usr/bin/env python3
# SIX MORE leaf options for the duff pile — forced to PURE bright yellow (the earlier
# batches skewed orange/red/amber, too close to the orange cache piles). Strong
# anti-orange/red/brown wording. Same pipeline (flux-1.1-pro -> BiRefNet matte).
#   python3 scripts/gen_leaf_yellow12.py
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

# Hammer "pure yellow, NOT orange/red/amber/brown" so these separate cleanly from
# the orange cache piles.
PURE = ("PURE bright lemon-yellow, clean saturated canary yellow, entirely yellow with "
        "absolutely NO orange, NO red, NO amber, NO gold-brown and NO brown tones")
STYLE = ("single dry autumn leaf, top-down flat lay, isolated on a plain solid white background, "
         "painterly semi-realistic game asset, soft even lighting, subtle leaf veins, high detail, "
         "one leaf only, centered, naturally curled edges, no other leaves, no hands, no text, no watermark")

PROMPTS = {
  "y12_spicebush":  f"a small smooth-edged oval spicebush leaf, {PURE}, {STYLE}",
  "y12_redbud":     f"a rounded heart-shaped redbud leaf with a smooth edge, {PURE}, {STYLE}",
  "y12_mulberry":   f"a broad rounded mulberry leaf with a serrated edge, {PURE}, {STYLE}",
  "y12_hophornbeam":f"an oval doubly-serrated hophornbeam leaf with straight parallel veins, {PURE}, {STYLE}",
  "y12_walnut":     f"a single elongated pointed black-walnut leaflet, {PURE}, {STYLE}",
  "y12_sassafras":  f"a smooth three-lobed mitten-shaped sassafras leaf, {PURE}, {STYLE}",
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
log(f"BiRefNet version: {ver or '(none)'}")
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
    raw = tempfile.mktemp(suffix=".png"); ok = False
    if ver:
        murl, mst = matte(gurl, ver)
        if murl: download(murl, raw); ok = True
        else: log(f"  matte failed {slug} ({mst})")
    if not ok:
        rawg = tempfile.mktemp(suffix=".png"); download(gurl, rawg)
        subprocess.run(["python3", str(ROOT / "scripts" / "keywhite.py"), rawg, raw], check=True)
        os.remove(rawg)
    finalize_png(raw, dest); os.remove(raw)
    log(f"OK  {dest.name}"); made.append(dest)
    time.sleep(8)
log(f"DONE {len(made)} leaves")
