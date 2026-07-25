#!/usr/bin/env python3
# NEW portrait options for Magic Mushroom, this time with MORE gnomes — crucially including
# some peeking over the TOPS of the caps. Same recipe as the portrait in play
# (scripts/gen_magic_mushroom.py): FLUX 1.1 PRO ULTRA, raw, 3:4, photoreal cubensis + rainbow.
#
# Why generate the whole portrait again instead of adding gnomes to the existing one: gnomes
# painted in afterwards are tiny (~80px) and come out smudged, whereas gnomes the model
# composes as part of the scene are coherent and sharp — which is exactly why the FIRST
# animation worked. The owner picks one, then it gets animated the same way.
#
# Output -> assets/species_options/psilocybe-gnomes-o<n>.jpg + a labelled contact sheet.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "species_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("MAGICLOG", "/tmp/magic_gnomes.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"
W, H = 560, 740

STYLE = ("professional nature photography, shot on a full-frame DSLR, natural light, "
         "realistic shallow depth of field, true-to-life textures, crisp fine detail, "
         "sharply focused faces, photorealistic, highly detailed, no text, no watermark, "
         "no border")

SUBJECT = (
    "a photorealistic close-up photograph of a cluster of Psilocybe cubensis magic mushrooms "
    "with tall slender pale stems and glossy golden-brown caramel domed caps growing from "
    "rich damp mossy woodland earth, a bright vivid full colour rainbow arcing across the "
    "soft-focus sky behind them, and FIVE tiny mischievous garden gnome figurines in tall red "
    "pointed hats with white beards hiding among the mushrooms: TWO of them peeking over the "
    "TOP EDGE of the mushroom caps with just their heads and shoulders showing above the "
    "domed caps, and THREE more peeking out from behind the mushroom stems lower down, all of "
    "them looking curiously at the camera, whimsical fairytale scene yet entirely "
    "photorealistic, each gnome clearly in focus with a crisp detailed little face"
)

VARIANTS = [
    ("golden hour warm dreamy light, the tallest mushroom the clear hero", 8100),
    ("cool fresh misty morning light after rain, dewy caps, the rainbow bold and bright", 8310),
    ("lush deep-green mossy forest glade, sun rays through the trees", 8520),
    ("bright soft overcast daylight, very clean crisp detail on every gnome face", 8730),
    ("warm afternoon light, gnomes larger and closer to the camera, clearly visible", 8940),
    ("dreamy pastel light, a big wide rainbow, gnomes peeping over three different caps", 9150),
]


def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)


def curl_json(args):
    r = subprocess.run(["curl", "-sS", "--max-time", "120", "--cacert", CA] + args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}


def create(prompt, seed):
    body = json.dumps({"input": {"prompt": prompt, "aspect_ratio": "3:4", "raw": True,
                                 "output_format": "png", "safety_tolerance": 6, "seed": seed}})
    return curl_json(["-H", f"Authorization: Bearer {TOKEN}", "-H", "Content-Type: application/json",
                      "-d", body, f"https://api.replicate.com/v1/models/{MODEL}/predictions"])


def poll(geturl):
    for _ in range(150):
        d = curl_json(["-H", f"Authorization: Bearer {TOKEN}", geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed", "canceled"): return d
        time.sleep(2)
    return {"status": "timeout"}


def save_jpg(url, dest):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl", "-sS", "--max-time", "150", "--cacert", CA, "-o", tmp, url], check=True)
    im = Image.open(tmp).convert("RGB")
    # cover-crop to exactly the portrait size the game expects, so it's a drop-in replacement
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - W) // 2, (im.height - H) // 2
    im.crop((l, t, l + W, t + H)).save(dest, "JPEG", quality=90, optimize=True)
    os.remove(tmp)


def gen_one(n, variant, seed):
    dest = OUTDIR / f"psilocybe-gnomes-o{n}.jpg"
    if dest.exists(): log(f"skip o{n} (exists)"); return dest
    prompt = f"{SUBJECT}, {variant}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt * 911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get:
            log(f"o{n}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output")
        url = out[0] if isinstance(out, list) and out else (out if isinstance(out, str) else "")
        if r.get("status") == "succeeded" and url:
            try:
                save_jpg(url, str(dest)); log(f"OK o{n} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e:
                log(f"o{n}: dl error {e}")
        else:
            log(f"o{n}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL o{n}"); return None


def sheet():
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
    except Exception: font = ImageFont.load_default()
    cells = []
    for n in range(1, len(VARIANTS) + 1):
        p = OUTDIR / f"psilocybe-gnomes-o{n}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB")
        cw = 330; im = im.resize((cw, round(im.height * cw / im.width)), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 130, 34], fill=(0, 0, 0))
        d.text((8, 3), f"#{n}", fill=(255, 220, 120), font=font)
        cells.append(im)
    if not cells: return None
    cw = 330; ch = max(c.height for c in cells)
    cols = 3; rows = (len(cells) + cols - 1) // cols
    sh = Image.new("RGB", (cols * cw + 6 * (cols + 1), rows * ch + 6 * (rows + 1)), (18, 18, 20))
    for i, c in enumerate(cells):
        r, cc = divmod(i, cols)
        sh.paste(c, (6 + cc * (cw + 6), 6 + r * (ch + 6)))
    out = OUTDIR / "_sheet_gnomes.png"; sh.save(out, "PNG"); log(f"SHEET -> {out}"); return out


def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n, (variant, seed) in enumerate(VARIANTS, start=1):
        gen_one(n, variant, seed); time.sleep(2)
    sheet()
    log("GNOME PORTRAITS DONE")


if __name__ == "__main__":
    main()
