#!/usr/bin/env python3
# Art options (3 each) for the 5 predation cards. Uses flux-1.1-pro (warm, reliable).
# Prompts are grounded in the REAL biology each card models:
#   constricting-snap : Drechslerella constricting ring (3 turgid cells noose a worm)
#   toxocyst-burst    : Pleurotus (oyster) toxocysts — poison droplet glands paralyse worms
#   toxocyst-array    : a standing field of those droplet glands (engine)
#   cordyceps-bloom   : Ophiocordyceps zombie-ant fungus erupting from an ant / nest
#   cordyceps-stroma  : a perennial graveyard of cordyceps-infected ants (engine)
# Run:  export REPLICATE_API_TOKEN=... ; python3 scripts/gen_predation_options.py
import os, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "card_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
MODEL = "black-forest-labs/flux-1.1-pro"
STYLE = "dark underground scene, bioluminescent teal and amber accents, atmospheric fungal-fantasy card art, painterly, highly detailed, cinematic macro, no text, no words, no watermark"

PROMPTS = {
 "constricting-snap": [
   f"extreme macro of a fungal constricting-ring trap: three swollen pale hyphal cells inflated into a tight noose clamped hard around the body of a translucent roundworm (nematode) caught mid-writhe, fine white mycelial threads radiating around it, dark wet soil, {STYLE}, no mushrooms, no fruiting bodies",
   f"microscopic Drechslerella nematode snare — a ring of three turgid fungal cells snapping shut around a pale nematode worm, the trapped worm bulging and limp, threadlike white hyphae on dark agar, {STYLE}, no mushrooms, no caps",
   f"a single glowing fungal ring trap throttling a caught roundworm on dark earth, the constricting hoop of pale cells cinched tight, the worm slack, delicate mycelium web, amber embers in the gloom, {STYLE}, no mushrooms",
 ],
 "toxocyst-burst": [
   f"extreme macro of oyster-mushroom mycelium: fine white hyphae studded with glistening spherical poison droplet glands (toxocysts), a translucent nematode worm paralysed and slumped across the threads with a clear toxic droplet on its skin, dark soil, {STYLE}, no mushroom caps",
   f"a field of white fungal threads bristling with tiny glassy poison droplets, several roundworms stilled and draped limp among them, a faint burst of pale toxin mist, dark underground, {STYLE}, no fruiting bodies",
   f"microscopic toxocyst attack — beads of paralytic droplet glands along pale hyphae, a nematode frozen mid-crawl, wet dark agar, luminous droplets catching the light, {STYLE}, no caps, no stems",
 ],
 "toxocyst-array": [
   f"a dense standing array of pale fungal hyphae covered in rows of glistening toxic droplet glands, a defensive field, two or three paralysed roundworms caught across it, dark soil, steady bioluminescent glow, {STYLE}, no mushroom caps",
   f"wide macro of a permanent toxocyst battery — many white threads each tipped with a clear poison droplet, arrayed like a glistening minefield across dark earth, worms stilled among them, {STYLE}, no fruiting bodies",
   f"a lush recharging field of mycelium beaded with countless clear paralytic droplets ready to kill, roundworms slumped between the threads, moody underground scene, {STYLE}, no mushrooms",
 ],
 "cordyceps-bloom": [
   f"a dead ant on the forest floor with slender bright-orange Ophiocordyceps fungal fruiting stalks erupting dramatically from its head and body, the classic zombie-ant fungus, spores drifting, dark damp soil, shallow depth of field, {STYLE}",
   f"an ant nest overrun by cordyceps — several ant corpses gripping twigs with orange club-shaped fungal stalks bursting from them, a fungal epidemic sweeping the colony, dark earth, {STYLE}",
   f"extreme macro of an Ophiocordyceps stroma: a glowing orange fungal club erupting from a zombie ant's head above a ruined anthill, a haze of spores in the air, dark forest floor, {STYLE}",
 ],
 "cordyceps-stroma": [
   f"a graveyard of cordyceps-infected ants across a dark forest floor, many dead ants each sprouting slender orange fungal fruiting stalks, a perennial fungal stroma blanketing a ruined ant nest, spores drifting, {STYLE}",
   f"a dense colony-wide zombie-ant fungus outbreak — dozens of ant corpses on twigs tipped with bright orange Ophiocordyceps clubs, a self-renewing fungal graveyard over an anthill, {STYLE}",
   f"a standing field of orange cordyceps stalks rising from a carpet of infected dead ants above a destroyed nest, ongoing infection, dark damp earth, dramatic depth, {STYLE}",
 ],
}

def log(m): print(m, flush=True)
def curl_json(a):
    r = subprocess.run(["curl","-sS","--max-time","120","--cacert",CA]+a, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:300]}
def create(p):
    body = json.dumps({"input":{"prompt":p,"aspect_ratio":"4:3","output_format":"jpg","safety_tolerance":5,"prompt_upsampling":True}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json","-H","Prefer: wait",
                      "-d",body,f"https://api.replicate.com/v1/models/{MODEL}/predictions"])
def poll(u):
    for _ in range(120):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",u]); st = d.get("status")
        if st in ("succeeded","failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}
def out_url(d):
    o = d.get("output")
    if isinstance(o, str): return o
    if isinstance(o, list) and o: return o[0]
    return None
def save_jpg(url, dest, width=520, q=86):
    tmp = tempfile.mktemp(suffix=".img")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    im = im.resize((width, round(im.height*width/im.width)), Image.LANCZOS)
    im.save(dest, "JPEG", quality=q, optimize=True); os.remove(tmp)

if not TOKEN:
    raise SystemExit("Set REPLICATE_API_TOKEN in the environment first.")
done, fail = 0, []
for slug, prompts in PROMPTS.items():
    for i, p in enumerate(prompts, start=1):
        dest = OUTDIR / f"{slug}-{i}.jpg"
        if dest.exists(): log(f"skip {dest.name}"); continue
        okd = False
        for attempt in range(4):
            d = create(p)
            u = d.get("urls", {}).get("get")
            if d.get("status") == "succeeded" or out_url(d): d = d
            elif u: d = poll(u)
            url = out_url(d)
            if url:
                try: save_jpg(url, dest); okd = True; log(f"OK  {dest.name}"); done += 1; break
                except Exception as e: log(f"save-fail {dest.name}: {e}")
            else:
                log(f"retry {dest.name} attempt {attempt+1}: {d.get('status')} {d.get('_raw','')[:120]}")
                time.sleep(3)
        if not okd: fail.append(dest.name)
log(f"\nDONE {done} generated; FAILED: {fail}")
