#!/usr/bin/env python3
# Handshake icon rendered in the "networked nodes" style of the owner's reference image:
# a low-poly constellation mesh -- small circular dots of varying size joined by thin
# straight edges into triangles -- in muted STEEL BLUE on a deep NAVY field.
#
# Options land in assets/handshake_options/ + a numbered contact sheet for the owner to
# pick from (same authoring pattern as gen_spore.py / gen_card_options.py). Nothing is
# wired into the game by this script.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "handshake_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("HSLOG", "/tmp/handshake.log")
MODEL = "black-forest-labs/flux-1.1-pro"

# Reference palette, sampled from the owner's image: field #062a56, nodes #6d8db3.
STYLE = ("Flat 2D vector network-graph illustration: the whole shape is built from small "
         "solid circular DOTS of varying size joined by THIN STRAIGHT LINES into a web of "
         "slender triangles, like a constellation map or a molecular lattice. Muted "
         "steel-blue and slate-blue dots and hairline links glowing softly against a deep "
         "solid navy-blue field. Even flat colour, crisp clean geometry, generous empty "
         "navy space around the emblem, centred composition, plain graphic emblem only.")

SUBJECT = ("A HANDSHAKE icon: two hands clasped together in a firm handshake, seen from the "
           "side, wrists entering from the left and the right, thumbs up, fingers wrapped "
           "around each other -- the classic agreement handshake symbol, instantly readable "
           "as two shaking hands. {v}")

VARIANTS = [
    "The dots sit on the knuckles, fingertips and wrist edges and the links trace the outline of both hands",
    "A dense fine mesh fills the hands completely, dots small and numerous",
    "A sparse airy lattice, few large dots and long thin links, minimal and elegant",
    "The mesh is bold and simple so it reads clearly at small icon size, thick links and large dots",
    "The clasped hands are a solid triangulated low-poly mesh with brighter dots at every corner",
    "A few loose stray dots and links drift off the silhouette into the surrounding navy, as if the network extends beyond the hands",
    "Symmetrical mirrored mesh, the left hand and right hand built from matching node patterns",
    "The links brighten towards the point where the two hands meet, the grip glowing brightest",
]

# --- ROUND 2 -----------------------------------------------------------------
# Round 1 read as glowing neon tech: bright cyan, a drawn outline stroke around the
# hands, and amber/skin tones leaking in. The reference is the opposite -- QUIET.
# Muted desaturated slate blue on deep navy, matte flat, hairline links, and the
# silhouette described BY the nodes rather than by an outline. Per the FLUX notes in
# CLAUDE.md the corrections are stated positively and the one refusal is a single
# short clause that names none of the banned words.
STYLE2 = ("Flat 2D vector network-graph illustration. Every part of the shape is built "
          "from small solid circular DOTS of assorted sizes joined by HAIRLINE straight "
          "links into a web of slender triangles, like a constellation chart or a "
          "molecular lattice. The dots are a muted desaturated slate blue, the links a "
          "slightly darker dusty blue, all of it sitting quietly on a deep solid navy "
          "field. Even matte colour throughout, restrained and low contrast, corporate "
          "and understated. The form is described purely by where the dots and links "
          "fall. Keep to blue alone. Centred emblem with generous plain navy space "
          "around it.")

SUBJECT2 = ("A HANDSHAKE icon: two hands clasped in a firm handshake, seen from the side, "
            "wrists entering from the left and the right, thumbs uppermost, fingers "
            "wrapped around each other -- the classic agreement handshake symbol, "
            "instantly readable as two shaking hands. {v}")

VARIANTS2 = [
    "A full triangulated mesh covers both hands evenly, dots at every corner",
    "The mesh is denser and the dots larger along the knuckles and the grip, thinning out towards the wrists",
    "A sparse airy lattice, widely spaced dots and long hairline links, minimal",
    "Bold and simple so it reads at small icon size, chunky dots and clear links",
    "The lattice spills past the hands into the surrounding navy as a few drifting dots and links",
    "Mirrored construction, the left and right hand built from matching node patterns",
    "Fine dense mesh of many tiny dots, intricate and lacy",
    "Medium mesh with a handful of noticeably larger dots scattered through it as accents",
]

# --- ROUND 3 -----------------------------------------------------------------
# Round 2 fixed the palette to blue-only but still ran BRIGHT (near-white cyan) and
# kept drawing a glowing contour stroke around each hand, which the reference has
# none of. Round 3 pushes for the reference's actual register: one flat dusty ink,
# printed rather than lit, contour marked by a line of DOTS instead of a stroke.
STYLE3 = ("Flat 2D vector network-graph illustration, printed in a single dusty ink. "
          "The entire shape is made of small solid circular DOTS of assorted sizes "
          "joined by HAIRLINE straight links into a web of slender triangles, like a "
          "constellation chart or a molecular lattice. The ink is a muted chalky "
          "blue-grey, greyed and desaturated, laid on a deep solid navy field in even "
          "matte colour at low contrast -- quiet, corporate, understated, like a "
          "diagram in an annual report. Every contour is marked by a line of dots and "
          "links. Centred emblem with generous plain navy space around it.")

VARIANTS3 = [
    "A full triangulated mesh covers both hands evenly, dots at every corner",
    "The mesh is denser and the dots larger along the knuckles and the grip, thinning towards the wrists",
    "Bold and simple so it reads at small icon size, chunky dots and clear links",
    "Medium mesh with a handful of noticeably larger dots scattered through it as accents",
    "A full triangulated mesh, and a few loose dots and links drift off into the surrounding navy",
    "Fine dense mesh of many small dots, intricate and lacy",
    "A sparse airy lattice, widely spaced dots and long hairline links, minimal",
    "Mirrored construction, the left and right hand built from matching node patterns",
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": (r.stdout or r.stderr)[:300]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"1:1","output_format":"png",
                                "safety_tolerance":5,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(90):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def download_png(url, dest, width=1024):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","180","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width:
        h = round(im.height*width/im.width); im = im.resize((width,h), Image.LANCZOS)
    im.save(dest, "PNG"); os.remove(tmp)

def gen_one(idx, rnd=1):
    tag = "opt" if rnd == 1 else f"r{rnd}"
    dest = OUTDIR / f"handshake_{tag}_{idx}.png"
    if dest.exists(): log(f"skip {tag} {idx}"); return dest
    if rnd == 1:
        prompt = SUBJECT.format(v=VARIANTS[idx % len(VARIANTS)]) + " " + STYLE
        seed = 5100 + idx*67
    elif rnd == 2:
        prompt = SUBJECT2.format(v=VARIANTS2[idx % len(VARIANTS2)]) + " " + STYLE2
        seed = 8200 + idx*71
    else:
        prompt = SUBJECT2.format(v=VARIANTS3[idx % len(VARIANTS3)]) + " " + STYLE3
        seed = 11500 + idx*83
    for attempt in range(3):
        d = create(prompt, seed + attempt*907)
        geturl = (d.get("urls") or {}).get("get")
        if not geturl: log(f"{idx}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(4); continue
        r = poll(geturl); out = r.get("output")
        if r.get("status")=="succeeded" and out:
            url = out[0] if isinstance(out, list) else out
            try: download_png(url, dest); log(f"OK {tag} {idx} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e: log(f"{idx}: dl error {e}")
        else: log(f"{idx}: {r.get('status')} {r.get('error') or ''}"); time.sleep(3)
    log(f"FAIL {tag} {idx}"); return None

def sheet(n, cols=4, cell=380, rnd=1):
    tag = "opt" if rnd == 1 else f"r{rnd}"
    files = [OUTDIR/f"handshake_{tag}_{i}.png" for i in range(n)]
    files = [f for f in files if f.exists()]
    if not files: return None
    rows = (len(files)+cols-1)//cols
    pad, lab = 12, 26
    W = cols*(cell+pad)+pad; H = rows*(cell+pad+lab)+pad
    sh = Image.new("RGB", (W,H), (12,14,20)); dr = ImageDraw.Draw(sh)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 18)
    except Exception: font = ImageFont.load_default()
    for i,f in enumerate(files):
        r,c = divmod(i, cols)
        x = pad + c*(cell+pad); y = pad + r*(cell+pad+lab)
        im = Image.open(f).convert("RGB"); im.thumbnail((cell,cell), Image.LANCZOS)
        sh.paste(im, (x+(cell-im.width)//2, y+(cell-im.height)//2))
        dr.text((x+4, y+cell+4), f.stem.split("_")[-1].join(["#",""]), fill=(220,225,235), font=font)
    out = OUTDIR/f"contact_sheet_{tag}.png"; sh.save(out, "PNG"); return out

if __name__ == "__main__":
    if not TOKEN: sys.exit("REPLICATE_API_TOKEN not set")
    n = int(sys.argv[1]) if len(sys.argv)>1 else len(VARIANTS)
    rnd = 3 if "--round3" in sys.argv else (2 if "--round2" in sys.argv else 1)
    if "--sheet" not in sys.argv:
        for i in range(n): gen_one(i, rnd)
    s = sheet(n, rnd=rnd)
    log(f"sheet -> {s}")
