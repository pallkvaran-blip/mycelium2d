#!/usr/bin/env python3
# Whole-label generation. The code-assembled approach tops out at "clean but stiff":
# a single model composing the entire label at once gets cohesion -- consistent lighting,
# density and style -- that assembling parts does not.
#
# Two corrections over the owner's original Gemini prompt:
#  - Ask for FLAT LABEL ARTWORK, never a can. The original came back as a photographic can
#    mockup, so the label was wrapped round a cylinder, lit, and unusable as artwork.
#  - Name ITANDA FALLS. The brand is named for a real rapid on the Nile at Jinja, Uganda --
#    wide, churning whitewater over dark rock, not the generic tall tropical waterfall.
#
#   python3 scripts/gen_label_raster.py bakeoff        # one flavour, three models
#   python3 scripts/gen_label_raster.py all <model>    # three flavours, chosen model
import json, os, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets" / "tanda_options" / "raster"
OUT.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()

FLAVOURS = {
    "mango":     ("MANGO",     "ripe golden mangoes", "warm golden-orange, mango yellow and deep amber"),
    "passion":   ("PASSION",   "purple passion fruit cut open showing golden seedy pulp",
                  "deep violet-purple, magenta and golden yellow"),
    "pineapple": ("PINEAPPLE", "ripe pineapples with spiky crowns",
                  "bright sunshine yellow, golden amber and fresh green"),
}

BASE = ("Flat rectangular label artwork for a 330 ml slim can of TANDA sparkling juice from "
        "Uganda, drawn as flat 2D packaging print artwork laid out square to the page. "
        "The centrepiece is a cartoon illustration of ITANDA FALLS, the wide powerful "
        "whitewater rapids on the River Nile at Jinja in Uganda: broad churning white water "
        "rushing over dark rounded rocks, framed by lush layered green tropical foliage and "
        "palms. {fruit} and glossy leaves decorate the border densely. The colour scheme is "
        "{palette}, taken from the fruit. Bold rounded playful brand lettering reads TANDA "
        "across the top, with SPARKLING JUICE and {name} beneath it. Vibrant and appetising, "
        "bold clean outlines, rich saturated colour, densely detailed, professional beverage "
        "packaging illustration.")

# Text-free variant. The bake-off winner lettered the brand "ITANDA" -- it absorbed the
# name of the falls -- and generated lettering is unreliable and unfixable anyway. So the
# artwork is generated with NO text and deliberate clear space, and real outlined type is
# set over it afterwards. That also keeps the three flavours perfectly consistent, which
# separately generated lettering never would be.
CLEAN_TAIL = (" Absolutely no lettering, words, letters or numbers anywhere in the image. "
              "Leave the upper third as a calm open area of flat colour with no detail, "
              "clear space reserved for a brand name to be added later.")

MODELS = {
    "nano":     ("google/nano-banana-pro",        {"aspect_ratio": "9:16", "resolution": "4K", "output_format": "png"}),
    "ideogram": ("ideogram-ai/ideogram-v3-quality",{"aspect_ratio": "1:2", "style_type": "Design", "magic_prompt_option": "Off"}),
    "seedream": ("bytedance/seedream-5-pro",      {"aspect_ratio": "9:16", "size": "2K", "output_format": "png"}),
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
        print(f"{tag}: {r.get('status')} {str(r.get('error'))[:90]}"); return None
    o = r["output"]; url = o if isinstance(o, str) else o[0]
    subprocess.run(["curl","-sS","--max-time","300","--cacert",CA,"-o",str(dest),url], check=True)
    print(f"OK {tag} {dest.stat().st_size//1024}KB")
    return dest

def prompt_for(flav, clean=False):
    name, fruit, palette = FLAVOURS[flav]
    p = BASE.format(name=name, fruit=fruit.capitalize(), palette=palette)
    if clean:
        p = p.replace("Bold rounded playful brand lettering reads TANDA across the top, "
                      "with SPARKLING JUICE and %s beneath it. " % name, "")
        p += CLEAN_TAIL
    return p

if __name__ == "__main__":
    if not TOKEN: sys.exit("REPLICATE_API_TOKEN not set")
    mode = sys.argv[1] if len(sys.argv) > 1 else "bakeoff"
    if mode == "bakeoff":
        for mk in MODELS:
            gen(f"bakeoff-mango-{mk}", mk, prompt_for("mango"))
    else:
        mk = sys.argv[2] if len(sys.argv) > 2 else "nano"
        clean = "--clean" in sys.argv
        for flav in FLAVOURS:
            gen(f"{flav}-{mk}{'-clean' if clean else ''}", mk, prompt_for(flav, clean))
