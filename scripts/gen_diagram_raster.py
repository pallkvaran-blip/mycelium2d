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
import json, os, subprocess, sys, time
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
    d = curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                   "-d",body,f"https://api.replicate.com/v1/models/{slug}/predictions"])
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
    if mode.startswith("scale"):
        body, tail = SUBJECT_SCALE, TEXT_SCALE
    else:
        body, tail = SUBJECT, (CLEAN if mode == "clean" else TEXT)
    for mk in (sys.argv[2:] or MODELS):
        gen(f"{mode}-{mk}", mk, STYLE + " " + body + tail)
