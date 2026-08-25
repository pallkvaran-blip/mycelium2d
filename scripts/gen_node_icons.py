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
    # Rejected subject, lessons kept: a SPEEDOMETER was tried and discarded by the owner.
    # What it taught, and what every subject below now starts from:
    #  - A subject with a strong photoreal prior (a gauge reads as a real instrument)
    #    overpowers a TRAILING style block -- it came back as glossy hubs and lens shading
    #    with not one link. Lead with STYLE3 (style_first) for anything object-like.
    #  - STIPPLE is the default failure: clouds of dots with no links. The cure is to say
    #    every dot sits at a CORNER where links meet. Dots in fields is what stipple IS.
    #  - Tick marks, numerals and other instrument furniture arrive uninvited; don't name
    #    small repeated markings at all.
    #  - The family signature is a SOLID triangulated BODY filling a silhouette (both icons
    #    the owner picked are that). Thin strokes and rings never matched. Describe the
    #    subject as broad solid shapes so there is a body to triangulate.
    "flexibility": {
        "seed": 47000,
        "stages": [
            (14, ("Drawn in this way: a THREE-WAY ARROW symbol meaning flexibility -- one "
                  "broad upright stem rising from the bottom of the frame which splits "
                  "near the middle into three thick arms. The middle arm carries straight "
                  "on up and ends in a big arrowhead pointing UP. The second arm bends out "
                  "to the left and ends in a big arrowhead pointing LEFT. The third arm "
                  "bends out to the right and ends in a big arrowhead pointing RIGHT. "
                  "Three arrowheads in all, one up, one left, one right. Every arm is a "
                  "wide heavy band, filled right across with the web of links and corner "
                  "dots. A plain flat emblem seen straight on, centred, solid throughout. "
                  "{v}"), True),
            (8, ("Drawn in this way: a THREE-WAY ARROW symbol meaning flexibility -- exactly "
                 "three broad arrows radiating outwards from one shared centre, evenly "
                 "spread: one pointing straight UP, one pointing RIGHT, one pointing LEFT. "
                 "Three arrows only. Each arm is a wide solid band ending in a big solid "
                 "triangular arrowhead, the arms thick and reaching out to fill the frame, "
                 "filled right across with the web of links and corner dots. A plain flat "
                 "emblem seen straight on, centred, solid throughout. {v}"), True),
            (0, ("Drawn in this way: a THREE-WAY ARROW symbol meaning flexibility -- "
                        "a single broad stem rising from the bottom centre which divides "
                        "into three broad arrows fanning apart, one continuing straight up, "
                        "one bending out to the right, one bending out to the left, each "
                        "ending in a big solid triangular arrowhead. The stem and all three "
                        "arms are broad solid bands, filled right across with the web of "
                        "links and corner dots. A plain flat emblem seen straight on, "
                        "centred, solid throughout. {v}"), True),
        ],
        "variants": [
            "The whole symbol is spanned corner to corner by slender triangles, dots at every corner",
            "Every dot sits at a corner where several links meet, an even web filling the stem and all three arms",
            "Bold and simple so it reads at small icon size: few, large triangles and chunky corner dots",
            "A dense even web of slender triangles throughout, dots of assorted sizes at the corners",
            "Slender triangles throughout, growing denser towards the three arrowheads",
            "An even lattice of triangles, and a few loose dots and links drift off the arrowheads into the navy",
            "Fine dense mesh of small corner dots joined by many hairline links, intricate and lacy",
            "An open airy web of long links meeting at corner dots, the three arrowheads picked out by larger dots",
            # 8+ : second round. Round 1 split two ways -- the results with the right
            # three-way structure came out thin and stippled, while the best TRIANGULATION
            # by far was a four-armed compass whose arms were broad and radiated from a
            # hub. So: keep that geometry, state the count as exactly three, and make the
            # arms wide enough to fill the frame -- a broad arm has a body to triangulate,
            # a thin one collapses to stipple (the same lesson the gauge needle taught).
            "The whole symbol is spanned corner to corner by slender triangles, dots at every corner",
            "Every dot sits at a corner where several links meet, an even web filling all three arms",
            "Bold and simple so it reads at small icon size: few, large triangles and chunky corner dots",
            "A dense even web of slender triangles fills the arms, dots of assorted sizes at the corners",
            "Slender triangles throughout, growing denser towards the three arrowheads",
            "An even lattice of triangles, and a few loose dots and links drift off the arrowheads into the navy",
            # 14+ : third round. Round 2's "radiating from one shared centre" cost the
            # subject entirely -- stars, diamonds and chevrons, no three-direction read.
            # Round 1's trident (one stem splitting into three) was the correct geometry
            # all along; its only fault was thin, stippled arms. So: that geometry back,
            # every arrowhead direction named outright so the count cannot drift, and the
            # arms made heavy bands so there is a body to triangulate.
            "The whole symbol is spanned corner to corner by slender triangles, dots at every corner",
            "Every dot sits at a corner where several links meet, an even web filling the stem and all three arms",
            "Bold and simple so it reads at small icon size: few, large triangles and chunky corner dots",
            "A dense even web of slender triangles fills stem and arms, dots of assorted sizes at the corners",
            "Slender triangles throughout, growing denser towards the three arrowheads",
            "An even lattice of triangles, the three arrowheads picked out by slightly larger corner dots",
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
    v = spec["variants"][idx % len(spec["variants"])]
    # Prompt staging. A subject may refine its framing across rounds; the last stage whose
    # start index <= idx wins. style_first leads with STYLE3 instead of trailing it -- for
    # subjects with a strong photoreal prior (a gauge reads as a real instrument), a
    # trailing style block loses to the noun.
    stage = None
    # `or`, not a dict default: the fallback indexes spec["noun"], which a
    # stages-only subject does not define, and a default argument is evaluated eagerly.
    for start, tmpl, style_first in spec.get("stages") or [(0, spec["noun"], False)]:
        if idx >= start: stage = (tmpl, style_first)
    tmpl, style_first = stage
    prompt = (STYLE3 + " " + tmpl.format(v=v)) if style_first else (tmpl.format(v=v) + " " + STYLE3)
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
