#!/usr/bin/env python3
# Generate 3 ART OPTIONS per NEW grow card via FLUX 1.1 PRO ->
# assets/card_options/<slug>-<n>.jpg, plus a labelled contact sheet per card and a
# master grid for review. A human (owner) picks the winner; winners are promoted to
# assets/cards/<slug>.jpg separately.
#
# HARD BRIEF (owner): mycelium is NOT a mushroom. Every strand must end in fine,
# pointed / thread-like HYPHAL TIPS — never a mushroom cap or fruiting body. Themes
# are grounded in real mycelium biology (turgor tip growth, the Spitzenkorper vesicle
# supply centre, guerrilla foraging runners, rhizomorph transport cords, bulk-flow
# translocation). On-theme bioluminescent deep-earth look (docs/STYLE_GUIDE.md).
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("GROWLOG", "/tmp/grow_cards.log")
MODEL = "black-forest-labs/flux-1.1-pro"

# Shared on-theme style + the NON-NEGOTIABLE "hyphae, not mushrooms" constraint.
STYLE = ("dark bioluminescent deep-earth cross-section, luminous pale mint-green "
         "mycelium as the brightest element, cool near-black soil with faint indigo "
         "shadow, subtle teal-green and warm amber glow accents, painterly "
         "semi-realistic fungal-fantasy card illustration, highly detailed, "
         "atmospheric, soft volumetric glow, "
         "ONLY thread-like fungal hyphae that taper to fine sharp POINTED TIPS, "
         "no mushroom, no mushroom cap, no stem, no gills, no fruiting body, "
         "not a mushroom, no text, no watermark, no border")

LENS = [
    "wide atmospheric establishing composition with depth",
    "dramatic extreme macro close-up, shallow depth of field, deep shadows",
    "stylized painterly composition, strong directional forward motion, soft-focus dark background",
]

# (slug, subject) — one entry per NEW card.
CARDS = [
    ("guerrilla-runners",
     "a small bundle of pale luminous mycelial runner hyphae racing outward across "
     "dark soil, widely spaced fast exploratory filaments each ending in a fine "
     "pointed thread-like tip probing fresh ground, sparse guerrilla foraging growth form"),
    ("turgor-thrust",
     "a single taut swollen pale mycelial hypha driven forward by turgor pressure "
     "through dark earth, hydrostatic pressure ramming the filament ahead as it "
     "tapers to one sharp pointed thread tip, tiny dew-like water droplets along it"),
    ("vesicle-surge",
     "an extreme macro of a single mycelial hyphal apex, a dense luminous cloud of "
     "tiny secretory vesicles streaming into the extreme tapered pointed tip (the "
     "Spitzenkorper) laying down new cell wall, glowing mint accents, thread-fine apex"),
    ("translocation-cord",
     "a thick differentiated mycelial cord of bundled parallel hyphae channeling "
     "glowing cytoplasm in bulk along its length across dark soil, the cord fanning "
     "out at its far end into many fine pointed thread tips, long-distance transport"),
    ("explorer-cord",
     "a persistent standing mycelial cord repeatedly sending long exploratory runner "
     "hyphae into dark soil, a luminous cord with many fine pointed thread tips "
     "fanning ahead across the earth, a permanent foraging network"),
    ("turgor-line",
     "a standing mycelial supply line of turgid pale hyphae held under hydrostatic "
     "pressure, dew droplets beaded along the strands, each hypha ending in a sharp "
     "pointed thread tip pushing steadily through dark earth"),
    ("vesicle-supply-line",
     "a mycelial cord acting as a vesicle supply line, streams of tiny glowing "
     "vesicles flowing forward along parallel hyphae to feed extending pointed "
     "thread tips at the front, dark soil, mint bioluminescent glow"),
    ("bulk-flow-cord",
     "a heavy mycelial rhizomorph cord translocating glowing fluid in bulk over a "
     "long run through dark rocky soil, the cord branching into many fine pointed "
     "thread tips at the advancing growth front"),
    ("rhizomorph-cable",
     "a powerful thick mycelial rhizomorph cable, a bundled rope of hyphae, lancing "
     "a long distance through dark rocky earth and tipped with a burst of fine "
     "pointed thread-like hyphal tips, dynamic forward motion, teal and amber glow"),
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"3:2",
                                "output_format":"png","safety_tolerance":5,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(120):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def save_jpg(url, dest, width=620, q=88):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

def gen_one(slug, subject, n, seed):
    dest = OUTDIR / f"{slug}-{n}.jpg"
    if dest.exists(): log(f"skip {dest.name} (exists)"); return dest
    prompt = f"{subject}, {LENS[n-1]}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt*911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get:
            log(f"{dest.name}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save_jpg(url, str(dest)); log(f"OK {dest.name} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e: log(f"{dest.name}: dl error {e}")
        else:
            log(f"{dest.name}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL {dest.name}"); return None

def label(im, text):
    d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    except Exception: font = ImageFont.load_default()
    d.rectangle([0,0,min(im.width, 12+len(text)*15), 40], fill=(0,0,0))
    d.text((8,6), text, fill=(255,255,255), font=font)
    return im

def card_sheet(slug):
    cells = []
    for n in (1,2,3):
        p = OUTDIR / f"{slug}-{n}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB")
        cw = 420; im = im.resize((cw, round(im.height*cw/im.width)), Image.LANCZOS)
        cells.append(label(im, f"{slug}  #{n}"))
    if not cells: return None
    ch = max(c.height for c in cells); cw = 420
    sheet = Image.new("RGB", (cw*len(cells)+6*(len(cells)+1), ch+12), (18,18,20))
    for i,c in enumerate(cells): sheet.paste(c, (6+i*(cw+6), 6))
    out = OUTDIR / f"_sheet_{slug}.png"; sheet.save(out, "PNG"); return out

def master_sheet(slugs):
    rows = []
    for slug in slugs:
        s = OUTDIR / f"_sheet_{slug}.png"
        if s.exists(): rows.append(Image.open(s).convert("RGB"))
    if not rows: return
    w = max(r.width for r in rows); tot = sum(r.height+6 for r in rows)+6
    grid = Image.new("RGB", (w, tot), (10,10,12)); y=6
    for r in rows: grid.paste(r, (6, y)); y += r.height+6
    out = OUTDIR / "_sheet_grow_cards_ALL.png"; grid.save(out, "PNG"); log(f"MASTER -> {out}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for ci,(slug,subject) in enumerate(CARDS):
        for n in (1,2,3):
            gen_one(slug, subject, n, seed=1700 + ci*97 + n*13)
            time.sleep(2)
        card_sheet(slug)
    master_sheet([c[0] for c in CARDS])
    log("GROW CARDS DONE")

if __name__ == "__main__":
    main()
