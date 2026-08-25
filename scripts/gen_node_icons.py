#!/usr/bin/env python3
# Node-mesh icon set generator. Reuses the recipe the owner PICKED for the handshake
# (gen_handshake_nodes.py round 3, variant 0 -- "full triangulated mesh, dots at every
# corner"), so every icon in the family comes out of the same style block and reads as a
# set. Only the SUBJECT changes.
#
#   REPLICATE_API_TOKEN=... python3 scripts/gen_node_icons.py location [n]
#   python3 scripts/gen_node_icons.py location --sheet     # rebuild contact sheet, no renders
#
# Finish a pick with the same palette pass the handshake used:
#   python3 scripts/node_icon_finalize.py assets/<subject>_options/<subject>_<i>.png <slug>
import os, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# STYLE3 is the winning lead -- imported rather than copied so the family can never drift.
from gen_handshake_nodes import STYLE3, curl_json, poll, download_png, MODEL, CA, log
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

# Per-subject: the noun phrase, a seed base (kept distinct so subjects never collide),
# and mesh variants phrased for that shape. Variant 0 of every subject mirrors the
# handshake's winning variant -- an even full triangulation with dots at every corner.
SUBJECTS = {
    "location": {
        "seed": 21000,
        "noun": ("A MAP LOCATION PIN icon: the classic teardrop map marker -- a round "
                 "balloon head with broad shoulders narrowing to a single sharp point at "
                 "the bottom, standing upright and centred, the familiar 'you are here' "
                 "map pin, instantly readable as a location marker. {v}"),
        "variants": [
            "A full triangulated mesh covers the pin evenly, dots at every corner",
            "A full triangulated mesh covers the pin, with a clean round hole at its centre ringed by dots",
            "Bold and simple so it reads at small icon size, chunky dots and clear links",
            "The mesh is denser and the dots larger around the round head, thinning towards the point",
            "A full triangulated mesh, and a few loose dots and links drift off into the surrounding navy",
            "Fine dense mesh of many small dots, intricate and lacy",
            "A sparse airy lattice, widely spaced dots and long hairline links, minimal",
            "A full triangulated mesh, with a ring of dots and links spreading on the ground beneath the point like a locating pulse",
            # 8+ : second round. The classic GPS pin wants the centre hole, but the ringed
            # renders above came back stippled -- dots without the visible hairline triangles
            # that give the picked handshake its construction. These ask for the hole AND the
            # triangulation together, and mark the contour with dots so no solid stroke appears.
            "A clean round hole at the centre ringed by dots, and the rest of the pin filled edge to edge with a triangulated web of hairline links, dots at every corner",
            "A round hole at the centre, bold clear triangles across the whole pin, chunky dots at the corners so it reads at small icon size",
            "A round hole at the centre ringed by dots, dense triangulated links over the head, the mesh narrowing to a few long links at the point",
            "A round hole at the centre, an even lattice of slender triangles filling the pin, dots of assorted sizes at the corners",
            "A round hole at the centre, triangulated links throughout, and the dots along the outer contour slightly larger than those inside",
            "A round hole at the centre, an airy open triangulation with long hairline links and well-spaced dots",
        ],
    },
}

def outdir(subject):
    d = ROOT / "assets" / f"{subject}_options"
    d.mkdir(parents=True, exist_ok=True)
    return d

def create(prompt, seed):
    import json
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"1:1","output_format":"png",
                                "safety_tolerance":5,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def gen_one(subject, idx):
    spec = SUBJECTS[subject]
    dest = outdir(subject) / f"{subject}_{idx}.png"
    if dest.exists(): log(f"skip {subject} {idx}"); return dest
    prompt = spec["noun"].format(v=spec["variants"][idx % len(spec["variants"])]) + " " + STYLE3
    seed = spec["seed"] + idx*83
    for attempt in range(3):
        d = create(prompt, seed + attempt*907)
        geturl = (d.get("urls") or {}).get("get")
        if not geturl: log(f"{idx}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(4); continue
        r = poll(geturl); out = r.get("output")
        if r.get("status")=="succeeded" and out:
            url = out[0] if isinstance(out, list) else out
            try: download_png(url, dest); log(f"OK {subject} {idx} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e: log(f"{idx}: dl error {e}")
        else: log(f"{idx}: {r.get('status')} {r.get('error') or ''}"); time.sleep(3)
    log(f"FAIL {subject} {idx}"); return None

def sheet(subject, n, cols=4, cell=380):
    files = [outdir(subject)/f"{subject}_{i}.png" for i in range(n)]
    files = [f for f in files if f.exists()]
    if not files: return None
    rows = (len(files)+cols-1)//cols
    pad, lab = 12, 26
    sh = Image.new("RGB",(cols*(cell+pad)+pad, rows*(cell+pad+lab)+pad),(12,14,20)); dr = ImageDraw.Draw(sh)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    except Exception: font = ImageFont.load_default()
    for i,f in enumerate(files):
        r,c = divmod(i, cols); x = pad + c*(cell+pad); y = pad + r*(cell+pad+lab)
        im = Image.open(f).convert("RGB"); im.thumbnail((cell,cell), Image.LANCZOS)
        sh.paste(im,(x+(cell-im.width)//2, y+(cell-im.height)//2))
        dr.text((x+4, y+cell+4), "#"+f.stem.split("_")[-1], fill=(220,225,235), font=font)
    out = outdir(subject)/"contact_sheet.png"; sh.save(out,"PNG"); return out

if __name__ == "__main__":
    subject = sys.argv[1]
    if subject not in SUBJECTS: sys.exit(f"unknown subject {subject!r}; have {list(SUBJECTS)}")
    n = next((int(a) for a in sys.argv[2:] if a.isdigit()), len(SUBJECTS[subject]["variants"]))
    if "--sheet" not in sys.argv:
        if not TOKEN: sys.exit("REPLICATE_API_TOKEN not set")
        for i in range(n): gen_one(subject, i)
    log(f"sheet -> {sheet(subject, n)}")
