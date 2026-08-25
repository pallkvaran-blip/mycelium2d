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
    # "Odometer going fast": the rolling-digit counter an odometer literally is turns to
    # mush as a node mesh at icon size, so this is the needle GAUGE -- the readable
    # symbol for speed. Weighted towards dense triangulation with a dotted contour,
    # which is what the owner picked for both the handshake and the pin.
    "speedometer": {
        "seed": 34000,
        "noun": ("A SPEEDOMETER icon: a round gauge dial seen flat face-on, a sweep of tick "
                 "marks running along its arc, and a single straight needle pivoting from "
                 "the small hub at the centre and swung hard over to the far right at "
                 "maximum -- the classic speed gauge pegged at full speed, instantly "
                 "readable as a speedometer. {v}"),
        "variants": [
            "A full triangulated mesh covers the dial evenly, dots at every corner",
            "A dense triangulated web fills the dial face, the rim and the needle marked out by lines of dots",
            "Bold and simple so it reads at small icon size, chunky dots and clear links",
            "A dense triangulated mesh, and every tick mark around the arc is marked by its own dot",
            "A dense triangulated mesh, with a few curved trails of dots sweeping behind the needle like motion blur",
            "A dense triangulated mesh over the dial, thickening towards the needle and the top end of the arc",
            "Fine dense mesh of many small dots, intricate and lacy",
            "A dense triangulated mesh, and a few loose dots and links stream off the dial into the surrounding navy",
            # 8+ : second round, style-led (see alt_from). Round 1 came back as photoreal
            # instruments -- glossy hubs, lens shading, halftone stipple rings, numerals,
            # and not one triangulated link. A full round dial is simply too strong a prior.
            # These use a half-circle ARC gauge, which reads as a symbol rather than an
            # instrument, and spell out that the arc and the needle are themselves built
            # from dots and links.
            "The whole symbol is spanned corner to corner by slender triangles, dots at every corner",
            "The arc is a chain of evenly spaced dots, the needle a straight line of dots, and triangulated links fill the space between them",
            "Bold and simple so it reads at small icon size, chunky dots and clear links",
            "A dense triangulated web fills the fan between the arc and the needle, thinning towards the outside",
            "Triangulated links throughout, and a few curved trails of dots sweep behind the needle in the direction it has swung",
            "An even lattice of slender triangles across the whole symbol, dots of assorted sizes at the corners",
            # 14+ : third round. Round 2 got the arc and the swung needle right but stayed
            # STIPPLE -- clouds of dots with no links -- and drew the needle as a solid
            # tapered blade, so it never matched the family. Two fixes, both from the
            # phrasing that won the handshake: every dot must sit at a CORNER where links
            # meet (dots in fields is what stipple is), and the needle is itself built from
            # the mesh. Tick marks are dropped -- they were drawing the spiky radial fringe.
            "Every dot sits at a corner where several links meet, and the needle is a narrow spar of the same links and corner dots",
            "Slender triangles span the whole fan from the arc down to the centre point, the needle a narrow triangulated spar among them",
            "Bold and simple so it reads at small icon size: few, large triangles and a clear triangulated needle",
            "An even web of slender triangles across the arc, the needle picked out by slightly larger corner dots",
            "Slender triangles throughout, denser towards the right where the needle points, the needle built of the same triangles",
            "An open airy web of long links meeting at corner dots, the needle a single line of links",
            "The half-disc is spanned corner to corner by slender triangles, dots at every corner",
            "A dense even web of slender triangles fills the whole half-disc, dots of assorted sizes at the corners",
            "Bold and simple so it reads at small icon size: few, large triangles and a clear needle",
            "Slender triangles fill the half-disc, growing denser towards the right where the needle points",
            "A dense web of triangles throughout, the curved rim marked by a line of slightly larger dots",
            "An even lattice of triangles across the half-disc, and a few loose dots and links drift off the rim into the navy",
        ],
        "stages": [
            (0,  ("A SPEEDOMETER icon: a round gauge dial seen flat face-on, a sweep of tick "
                  "marks running along its arc, and a single straight needle pivoting from "
                  "the small hub at the centre and swung hard over to the far right at "
                  "maximum -- the classic speed gauge pegged at full speed, instantly "
                  "readable as a speedometer. {v}"), False),
            (8,  ("Drawn in this way: a simple flat SPEED GAUGE symbol -- a half-circle "
                  "arc opening downwards like a rainbow, and a single straight needle "
                  "rising from a point at the centre of the arc and swung up and over to "
                  "the right, near the end of the arc, showing top speed. A plain flat "
                  "emblem seen straight on. {v}"), True),
            (14, ("Drawn in this way: a simple flat SPEED GAUGE symbol -- a half-circle arc "
                  "opening downwards like a rainbow, and a single straight needle rising "
                  "from a point at the centre of the arc and swung up and over to the "
                  "right, near the end of the arc, showing top speed. The arc and the "
                  "needle are built from the same web of links and corner dots as the rest "
                  "of the emblem. A plain flat emblem seen straight on. {v}"), True),
            # 20+ : fourth round. Rounds 2-3 got the palette and (finally) the links, but
            # every result was a RING with a hollow middle, while both icons the owner
            # picked are solid triangulated BODIES filling a silhouette. A gauge has no
            # mass to fill -- unless the gauge is a filled half-disc. Same construction as
            # the handshake and the pin, so the set finally matches.
            (20, ("Drawn in this way: a simple flat SPEED GAUGE symbol -- a solid "
                  "half-circle, a semicircular fan with its flat edge along the bottom, "
                  "filled right across from edge to edge with the web of links and corner "
                  "dots, and a single straight needle rising from the middle of the flat "
                  "bottom edge and swung up and over to the right, near the rim, showing "
                  "top speed. The needle is built from the same web. A plain flat emblem "
                  "seen straight on, solid throughout. {v}"), True),
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
    for start, tmpl, style_first in spec.get("stages", [(0, spec["noun"], False)]):
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
