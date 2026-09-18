#!/usr/bin/env python3
# Whole-diagram generation for the growth-vs-certainty picture, in networked-nodes style
# on white. The code-assembled version reads mechanical; a model composing the whole frame
# at once gets cohesion that assembly does not.
#
# The risk here is TEXT: thirteen specific labels is well past where image models stay
# reliable. So this bakes off the three candidates and we look before committing --
# Ideogram was the strongest speller in the label bake-off, nano-banana-pro the highest
# resolution. If none can spell it, the fallback is to generate the artwork text-free and
# set the labels as real type, exactly as the Tanda labels ended up.
import json, os, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets" / "diagram_options" / "raster"
OUT.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

STYLE = ("Wide landscape infographic on a plain pure white background, drawn entirely in a "
         "CONSTELLATION NETWORK style: everything is built from small circular dots joined "
         "by thin straight hairline links into webs of slender triangles. Muted navy and "
         "slate blue mesh, with teal and warm amber accents. Clean, elegant, corporate, "
         "lots of white space, flat 2D vector, no photographic texture.")

SUBJECT = ("The picture shows a choice between two futures, with no people in it. "
           "On the LEFT, a large sprawling irregular network cloud of many nodes, tangled "
           "and uneven, representing many uncertain outcomes, with a big question mark also "
           "made of dots and links. On the RIGHT, a small tight perfectly regular lattice "
           "grid of dots, orderly and repetitive, with an anchor made of dots and links at "
           "its centre. In the MIDDLE, one dense hub of nodes where a decision is made, with "
           "a bold arrow pointing left and a bold arrow pointing right.")

TEXT = (" Clear bold capital lettering, correctly spelled: CERTAINTY beside the anchor on "
        "the right with the smaller line PREDICTABLE OUTCOMES, LIMITED CHANGE beneath it; "
        "CHOOSE GROWTH above the left arrow; PROTECT STATUS QUO above the right arrow. In "
        "the left cloud each of these ten words labels its own node: PROSPERITY, PEACE, "
        "SECURITY, JOBS, TRANSFORMATION and INDUSTRIALIZATION in teal, and COMPETITION, "
        "CONFLICT, INFIGHTING and DISAPPOINTMENT in warm amber. The labels are spread out "
        "and never overlap each other. Each of those ten words appears exactly ONCE in the whole picture; no word is repeated and no other words are added.")

CLEAN = (" Absolutely no lettering, words, letters or numbers anywhere in the image.")

# Scale variant: the hub-and-arrows centre becomes a two-pan balance WEIGHING the two
# futures. Kept LEVEL rather than tipping -- a tipped beam states a verdict, and the
# picture is about a choice not yet made.
SUBJECT_SCALE = (
    "The picture shows a choice between two futures being weighed, with no people in it. "
    "On the LEFT, a large sprawling irregular network cloud of many nodes, tangled and "
    "uneven, representing many uncertain outcomes, with a big question mark also made of "
    "dots and links. On the RIGHT, a small tight perfectly regular lattice grid of dots, "
    "orderly and repetitive, with an anchor made of dots and links at its centre. In the "
    "MIDDLE and slightly larger than both, a classic two-pan BALANCE SCALE built from the "
    "same dots and links: an upright central post, a horizontal beam across its top, and a "
    "shallow pan hanging by fine threads from each end of the beam. The beam is exactly "
    "level and the two pans hang at the same height, evenly balanced. The left pan hangs "
    "towards the cloud and the right pan towards the lattice. The composition has three "
    "clearly separated zones with generous empty white space between them: the cloud on "
    "the left third, the balance scale alone in the middle third surrounded by white space, "
    "and the lattice on the right third.")

TEXT_SCALE = (
    " Clear bold capital lettering, correctly spelled: CHOOSE GROWTH labelling the left pan "
    "of the balance; PROTECT STATUS QUO labelling the right pan; CERTAINTY beside the anchor "
    "on the right with the smaller line PREDICTABLE OUTCOMES, LIMITED CHANGE beneath it. In "
    "the left cloud each of these ten words labels its own node: PROSPERITY, PEACE, "
    "SECURITY, JOBS, TRANSFORMATION and INDUSTRIALIZATION in teal, and COMPETITION, "
    "CONFLICT, INFIGHTING and DISAPPOINTMENT in warm amber. The labels are spread out and "
    "never overlap each other. Each of those ten words appears exactly ONCE in the whole "
    "picture; no word is repeated and no other words are added.")

# "Economic growth is not the same thing as these three policy agendas." Brand palette
# this time: navy mesh, amber accent, white ground. Only four labels here against the
# previous diagram's thirteen, so the duplicate-word failure mode is far less likely --
# still verified at native resolution before shipping.
STYLE_BRAND = (
    "Wide landscape diagram on a plain pure white background, drawn entirely in a "
    "CONSTELLATION NETWORK style: everything is built from small circular dots joined by "
    "thin straight hairline links into webs of slender triangles. Deep navy blue mesh with "
    "warm amber gold accents. Clean, elegant, corporate, generous white space, flat 2D "
    "vector, no photographic texture, no people.")

SUBJECT_NEQ = (
    "On the LEFT, one large dense cluster of navy nodes and links forming a rising arrow "
    "climbing to the upper right, the shape of growth. In the MIDDLE, standing alone in "
    "white space and larger than everything else, a bold NOT EQUAL TO sign -- an equals "
    "sign of two horizontal bars with a diagonal stroke struck through them -- built from "
    "the same dots and links but picked out in solid warm amber gold, the strongest element "
    "in the picture. On the RIGHT, three separate smaller node clusters stacked vertically "
    "and evenly spaced, each shaped like a simple icon: the top one a balance scale, the "
    "middle one a cargo ship on a globe, the bottom one a factory with an upward arrow. "
    "Thin links run from the left cluster to the amber sign, and from the sign to each of "
    "the three clusters on the right.")

TEXT_NEQ = (
    " Clear bold capital lettering in deep navy, correctly spelled: ECONOMIC GROWTH "
    "labelling the large cluster on the left; MACROECONOMIC STABILITY beside the top right "
    "cluster; EXPORT ORIENTATION beside the middle right cluster; TARGETED INVESTMENT "
    "beside the bottom right cluster. Each phrase appears exactly once, no word is repeated "
    "and no other words are added. The labels never overlap the artwork.")

# Four-step process spine. 21:9 rather than 16:9 -- the source is a wide strip, and
# forcing it into 16:9 would stack the steps or leave dead bands top and bottom.
SUBJECT_STEPS = (
    "A horizontal FOUR-STEP process running left to right across the frame, with no people "
    "in it. One straight horizontal spine line runs the full width of the picture. Four "
    "evenly spaced diamond-shaped markers sit on that spine, each picked out in solid warm "
    "amber gold, with a small arrowhead pointing right just before each diamond. Above the "
    "spine, one icon per step, each built from the same dots and hairline links: the first "
    "a magnifying glass, the second a lightbulb, the third a pair of overlapping speech "
    "bubbles, the fourth two interlocking gears. Below the spine, a number and a short "
    "label for each step. Generous white space above and below.")

TEXT_STEPS = (
    " Clear bold capital lettering, correctly spelled. Beneath the first diamond the "
    "numeral 1 and the words FIND CHAMPION. Beneath the second the numeral 2 and the words "
    "DIAGNOSE GROWTH CONSTRAINTS. Beneath the third the numeral 3 and the words DESIGN "
    "SOLUTIONS. Beneath the fourth the numeral 4 and the word IMPLEMENT. The numerals are "
    "warm amber gold and the labels deep navy. Each phrase appears exactly once, no word is "
    "repeated and no other words are added.")

# Round 2 on the process strip. Round 1 did not match the rest of the set: the spine
# markers, the arrowheads and the numerals came back as SOLID FILLED amber shapes, and the
# icons were small and dense. In the accepted diagrams every element without exception is
# an open mesh of dots and hairline links, drawn large and airy. So this round (a) passes
# the accepted diagram in as an image_input style reference, and (b) says outright that the
# markers and numerals are meshes too -- naming the specific elements that came back solid,
# since "constellation style" alone clearly did not reach them.
SUBJECT_STEPS2 = (
    "Match the drawing style of the reference image exactly: every element without "
    "exception is built from small round dots joined by thin straight hairline links into "
    "open webs of slender triangles, drawn large and airy with clear space between the "
    "dots. Nothing is a solid filled shape. "
    "The picture is a horizontal FOUR-STEP process running left to right, with no people. "
    "One straight horizontal spine line runs the full width. Four evenly spaced diamond "
    "markers sit on that spine, and a small arrowhead points right just before each one -- "
    "the diamonds and the arrowheads are themselves open meshes of amber dots and links, "
    "with visible dots at each corner. Above the spine, one large icon per step, each an "
    "open mesh: the first a magnifying glass, the second a lightbulb, the third a pair of "
    "overlapping speech bubbles, the fourth two interlocking gears. Below the spine, a "
    "large numeral for each step, the numeral itself drawn as an open mesh of amber dots "
    "and links, with its label beneath it.")

BALANCE_STEPS = (
    " Deep navy carries almost everything: all four icons are navy meshes, each lifted by "
    "only a handful of amber dots scattered among their navy ones. Amber is reserved for "
    "the spine diamonds, the arrowheads and the four numerals. Roughly one part amber to "
    "six parts navy overall.")

TEXT_STEPS2 = (
    " Only the four labels are ordinary solid lettering, in deep navy, correctly spelled: "
    "FIND CHAMPION under the first step, DIAGNOSE GROWTH CONSTRAINTS under the second, "
    "DESIGN SOLUTIONS under the third, IMPLEMENT under the fourth. Each phrase appears "
    "exactly once, no word is repeated and no other words are added. The labels are set "
    "in bold.")

MODELS = {
    "nano":     ("google/nano-banana-pro",         {"aspect_ratio": "16:9", "resolution": "4K", "output_format": "png"}),
    "ideogram": ("ideogram-ai/ideogram-v3-quality", {"aspect_ratio": "16:9", "style_type": "Design", "magic_prompt_option": "Off"}),
    "seedream": ("bytedance/seedream-5-pro",        {"aspect_ratio": "16:9", "size": "2K", "output_format": "png"}),
}

def curl_json(a):
    r = subprocess.run(["curl","-sS","--max-time","180","--cacert",CA]+a, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": (r.stdout or r.stderr)[:300]}

def gen(tag, model_key, prompt):
    dest = OUT / f"{tag}.png"
    if dest.exists(): print(f"skip {tag}"); return dest
    slug, extra = MODELS[model_key]
    body = json.dumps({"input": dict(prompt=prompt, **extra)})
    bf = Path(tempfile.mkstemp(suffix=".json")[1])
    bf.write_text(body)
    try:
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                       "--data-binary",f"@{bf}",
                       f"https://api.replicate.com/v1/models/{slug}/predictions"])
    finally:
        bf.unlink(missing_ok=True)
    get = (d.get("urls") or {}).get("get")
    if not get: print(f"{tag}: create failed -> {d.get('detail') or d.get('_raw')}"); return None
    for _ in range(150):
        r = curl_json(["-H",f"Authorization: Bearer {TOKEN}",get])
        if r.get("status") in ("succeeded","failed","canceled"): break
        time.sleep(2)
    if r.get("status") != "succeeded":
        print(f"{tag}: {r.get('status')} {str(r.get('error'))[:80]}"); return None
    o = r["output"]; url = o if isinstance(o, str) else o[0]
    subprocess.run(["curl","-sS","--max-time","300","--cacert",CA,"-o",str(dest),url], check=True)
    print(f"OK {tag} {dest.stat().st_size//1024}KB")
    return dest

if __name__ == "__main__":
    if not TOKEN: sys.exit("REPLICATE_API_TOKEN not set")
    mode = sys.argv[1] if len(sys.argv) > 1 else "bakeoff"
    if mode.startswith("steps"):
        body, tail = SUBJECT_STEPS, TEXT_STEPS
    elif mode.startswith("neq"):
        body, tail = SUBJECT_NEQ, TEXT_NEQ
    elif mode.startswith("scale"):
        body, tail = SUBJECT_SCALE, TEXT_SCALE
    else:
        body, tail = SUBJECT, (CLEAN if mode == "clean" else TEXT)
    lead = STYLE_BRAND if mode.startswith(("neq", "steps")) else STYLE
    for mk in (sys.argv[2:] or MODELS):
        gen(f"{mode}-{mk}", mk, lead + " " + body + tail)
