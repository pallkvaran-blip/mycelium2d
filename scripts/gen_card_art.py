#!/usr/bin/env python3
# Generate per-card art for the Mycelium deck via Replicate (FLUX schnell).
# Art direction: mixed, keyed to each card's mood. Output: assets/cards/<slug>.jpg
# Resumable: skips slugs that already have a jpg. Reads REPLICATE_API_TOKEN from env.
import os, sys, json, time, base64, io, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "cards"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("ARTLOG", "/tmp/artgen.log")
def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

# tone -> style suffix (shared palette; no text on the art)
STYLE = {
 "dark":  "dark bioluminescent fungal fantasy card illustration, teal-green and warm amber glow, moody atmospheric, painterly, highly detailed, dark background, no text",
 "bright":"naturalistic botanical fantasy card illustration, soft daylight, lush green forest floor, vibrant, highly detailed, shallow depth of field, no text",
 "cyan":  "luminous fungal fantasy card illustration, cool cyan and teal water glow, dewy droplets, atmospheric, highly detailed, dark background, no text",
 "violet":"fungal mineral fantasy card illustration, glowing violet and teal crystalline minerals, dark cavern, atmospheric, highly detailed, no text",
 "amber": "energetic fungal fantasy card illustration, radiant warm amber and gold glow, dark background, dramatic light, painterly, highly detailed, no text",
}

# (slug, tone, subject)
CARDS = [
 ("hyphal-extension","dark","a spreading fan of luminous mycelial hyphae threads reaching out through dark soil toward glowing food motes"),
 ("leaf-litter-cache","bright","a small pile of fallen autumn leaves and leaf litter on a sunlit mossy forest floor"),
 ("acorn-cache","bright","a small hoard of ripe brown oak acorns and glossy reddish-brown chestnuts piled on a sunlit mossy forest floor, autumn nuts, shallow depth of field"),
 ("acorn-fall","bright","ripe brown acorns and glossy chestnuts tumbling and scattering onto a sunlit mossy forest floor, a fresh autumn mast fall, warm daylight"),
 ("apical-drive","dark","a single glowing hyphal tip surging forward through dark earth, directed growth, trailing light"),
 ("foraging-fan","dark","a radiating fan of glowing mycelium spreading outward in every direction through dark soil"),
 ("tropic-lunge","dark","a strand of glowing mycelium lunging across a gap toward a distant glowing morsel of food, dark soil"),
 ("humus-bed","bright","rich dark crumbly humus soil teeming with life on a sunlit forest floor, tiny sprouts"),
 ("mycorrhizal-mat","bright","a lush mycorrhizal network woven around tree roots, symbiotic fungal mat, dappled daylight"),
 ("saprotrophic-digest","dark","glowing enzymes digesting a rotting log, bioluminescent decay, dark forest, teal and amber glow"),
 ("appressorial-punch","dark","fungal hyphae boring and punching through a cracked boulder, glowing pressure point, dark"),
 ("sclerotial-crust","dark","a hardened armored sclerotium crust of compacted fungal tissue, protective shell, dark, faint glow"),
 ("hyphal-imbibition","cyan","fungal hyphae drinking water at the glowing edge of a dark underground pool, cyan glow, droplets"),
 ("phosphate-tap","violet","glowing fungal hyphae tapping into a vein of violet phosphorescent mineral crystals in dark rock"),
 ("condense","cyan","dew droplets condensing on a delicate web of luminous fungal threads, cool cyan light, macro"),
 ("rhizomorph-trunkline","amber","a thick glowing rhizomorph cord trunk pulsing with warm amber energy running through dark soil"),
 ("osmotic-cashout","amber","a burst of radiant golden energy erupting from a swelling fungal cell, turgor pressure, dark"),
 ("septal-pore-flux","dark","extreme macro of glowing septal pores inside a translucent fungal hypha, cellular, teal light, dark"),
 ("aquaporin-channels","cyan","water flowing through glowing channels in a translucent fungal membrane, cyan and teal, droplets, dark"),
 ("phosphatase-cushion","violet","a soft bloom of violet phosphorescent mineral dust on a cushion of fungal tissue, dark, glowing"),
 ("mineralizing-saprobe","dark","decaying matter mineralizing into glowing motes of dust, saprophytic fungi, teal and violet glow, dark"),
 ("tap-root-rhizomorph","dark","a deep glowing taproot rhizomorph cord drilling straight down through cracked dark rock, faint glow"),
 ("constricting-ring","dark","a fungal constricting ring snaring a nematode worm, ominous trap, bioluminescent, dark soil"),
 ("rehydration-pulse","cyan","a radiant pulse of water reviving withered fungal strands, cyan healing glow, droplets, dark"),
 ("nutrient-transmutation","dark","alchemical transmutation of glowing mineral into shimmering water, swirling fungal energy, dark"),
 ("rhizomorph-lance","dark","a spear of glowing rhizomorph mycelial cord lancing forward through dark rocky soil, dynamic, spores"),
 ("fruiting-vigil","dark","a single luminous bioluminescent mushroom fruiting from dark soil, glowing teal mycelium below, amber cap, golden spores"),
 ("leading-cord","dark","a bright leading mycelial cord extending purposefully through dark earth, guiding light"),
 ("forager-bloom","bright","a blooming radial burst of pale mushrooms and hyphae on a sunlit forest floor"),
 ("questing-front","dark","a questing advancing front of glowing hyphae reaching across dark soil, searching tendrils"),
 ("humus-cache","bright","a rich reserve cache of dark humus and compost on a sunlit forest floor, fertile"),
 ("symbiont-weave","bright","an intricate symbiotic weave of fungal threads around plant rootlets, mutualism, dappled daylight"),
 ("enzyme-priming","dark","glowing digestive enzymes priming and dissolving organic matter, bioluminescent, dark, teal glow"),
 ("boring-corps","dark","a corps of fungal hyphae boring in formation through solid dark rock, glowing tips"),
 ("crust-reserve","dark","a stacked reserve of hardened fungal crust plates, armored, dark, faint teal glow"),
 ("capillary-runners","cyan","fine capillary runners of fungal thread wicking glowing water, cyan droplets along the strands, dark"),
 ("prospecting-cords","violet","fungal cords prospecting and creeping along glowing violet mineral veins in dark rock"),
 ("dew-traps","cyan","a spider-web-like net of fungal threads studded with glistening dew traps at dawn, cool light"),
 ("colonizing-front","dark","a broad colonizing front of dense glowing mycelium overtaking dark soil, advancing wall of threads"),
 ("leaf-fall","bright","autumn leaves gently falling onto a mossy sunlit forest floor, warm daylight, litter gathering"),
 ("sclerotial-seal","dark","a hardened sclerotium seal encasing and protecting a food cache from ants, dark, faint glow"),
 ("suberin-wall","dark","a corky suberin wall of fungal tissue blocking creeping grey mould, barrier, dark, teal edge glow"),
]

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","60","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"4:3","num_outputs":1,"output_format":"png"}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,"https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"])

def poll(geturl):
    for _ in range(60):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def download_jpg(url, dest, width=520, q=86):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","90","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    h = round(im.height*width/im.width)
    im = im.resize((width,h), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True)
    os.remove(tmp)

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    only = set(sys.argv[1:])  # optional: regenerate only these slugs
    todo = [c for c in CARDS if (not only or c[0] in only)]
    done = 0; fail = []
    for slug, tone, subject in todo:
        dest = OUTDIR / f"{slug}.jpg"
        if dest.exists() and not only:
            log(f"skip {slug} (exists)"); continue
        prompt = f"{subject}, {STYLE[tone]}"
        for attempt in range(3):
            d = create(prompt)
            geturl = (d.get("urls") or {}).get("get")
            if not geturl:
                log(f"{slug}: create fail ({d.get('detail') or d.get('_raw')}) retry {attempt}"); time.sleep(5); continue
            r = poll(geturl)
            out = r.get("output")
            if r.get("status")=="succeeded" and out:
                try:
                    download_jpg(out[0], dest); done += 1
                    log(f"OK {slug} ({done}/{len(todo)}) [{tone}] {dest.stat().st_size//1024}KB"); break
                except Exception as e:
                    log(f"{slug}: dl error {e}")
            else:
                log(f"{slug}: {r.get('status')} retry {attempt}"); time.sleep(4)
        else:
            fail.append(slug)
    log(f"DONE done={done} fail={fail}")

if __name__ == "__main__":
    main()
