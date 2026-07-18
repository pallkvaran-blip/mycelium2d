#!/usr/bin/env python3
# Trichoderma options that people RECOGNISE — the flat powdery green mould you see in
# a Petri dish, on bread, on fruit — NOT extreme nature-macro. FLUX 1.1 Pro. Saved as
# trichoderma_dish_0..N + a labelled contact sheet, for a human to pick. Does NOT
# change the live assets/tutorial/trichoderma.jpg.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "tutorial_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
if not TOKEN:
    tf = Path("/tmp/claude-0/-home-user-mycelium2d/e43b2131-64d6-51a4-b68f-76b2b5524080/scratchpad/.replicate_token")
    if tf.exists(): TOKEN = tf.read_text().strip()
LOG = os.environ.get("THREATLOG", "/tmp/trych_dish.log")

MODEL = "black-forest-labs/flux-1.1-pro"

# Each prompt aims at the COMMON, instantly-recognisable green mould — flat + powdery,
# whole colony/patch in frame (a plain snapshot, NOT an artful extreme macro).
PROMPTS = [
    ("A plain realistic photograph of a Trichoderma green mould culture in a round "
     "glass Petri dish, a flat circular colony with concentric rings of powdery green "
     "sporulation and a fuzzy white growing edge on pale agar, top-down view, even "
     "lighting, the ordinary green lab mould everyone recognises, photorealistic, "
     "true colour, whole dish in frame, not extreme macro, no text, no watermark"),
    ("A plain realistic photograph of fuzzy green mould growing on a slice of old "
     "white bread, spreading patches of powdery green and white Trichoderma mould "
     "across the bread, everyday household food mould, flat lighting, snapshot, "
     "photorealistic, true colour, the whole slice visible, not extreme macro, "
     "no text, no watermark"),
    ("A plain realistic photograph of common green mould on a rotting orange, a round "
     "patch of powdery bright green Trichoderma sporulation ringed by a soft white "
     "fuzzy margin on the citrus peel, the familiar green fruit mould, natural light, "
     "photorealistic, true colour, not extreme macro, no text, no watermark"),
    ("A plain realistic photograph of a Petri dish with a Trichoderma fungal colony, "
     "dark green powdery sporulating centre fading out to a white cottony edge, clear "
     "concentric zonation on agar, laboratory culture, top-down, clean even light, "
     "photorealistic, true colour, whole dish in frame, not extreme macro, "
     "no text, no watermark"),
    ("A plain realistic photograph of green mould on stale bread, flat patches of "
     "powdery vivid green and grey-green Trichoderma mould with white fuzzy edges "
     "spreading over the crust and surface, everyday mouldy food snapshot, soft "
     "indoor light, photorealistic, true colour, not extreme macro, no text, no watermark"),
    ("A plain realistic photograph of a Trichoderma green mould colony on a damp piece "
     "of cardboard, a flat powdery vivid green patch with a downy white advancing "
     "fringe, the common green mould you see on damp paper, ordinary snapshot, natural "
     "light, photorealistic, true colour, not extreme macro, no text, no watermark"),
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","90","--cacert",CA]+args,
                       capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"4:3",
                                "output_format":"png","safety_tolerance":5,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body,
                      f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(90):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def download_png(url, dest, width=720):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","120","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    if im.width > width:
        h = round(im.height*width/im.width)
        im = im.resize((width,h), Image.LANCZOS)
    im.save(dest, "PNG")
    os.remove(tmp)

def gen_one(idx):
    dest = OUTDIR / f"trichoderma_dish_{idx}.png"
    if dest.exists(): log(f"skip dish_{idx} (exists)"); return dest
    prompt = PROMPTS[idx % len(PROMPTS)]
    seed = 7300 + idx * 61
    for attempt in range(3):
        d = create(prompt, seed + attempt*641)
        geturl = (d.get("urls") or {}).get("get")
        if not geturl:
            log(f"dish_{idx}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(4); continue
        r = poll(geturl)
        out = r.get("output")
        if r.get("status")=="succeeded" and out:
            url = out[0] if isinstance(out, list) else out
            try:
                download_png(url, dest); log(f"OK dish_{idx} {dest.stat().st_size//1024}KB"); return dest
            except Exception as e:
                log(f"dish_{idx}: dl error {e}")
        else:
            log(f"dish_{idx}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(3)
    log(f"FAIL dish_{idx}")
    return None

def contact_sheet(paths):
    imgs = [(i, Image.open(p).convert("RGB")) for i, p in enumerate(paths) if p and p.exists()]
    if not imgs: return
    cw = 480
    cells = []
    for i, im in imgs:
        h = round(im.height*cw/im.width)
        im = im.resize((cw, h), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        label = f"TRYCH DISH {chr(65+i)}"
        try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
        except Exception: font = ImageFont.load_default()
        d.rectangle([0,0,246,44], fill=(0,0,0))
        d.text((10,7), label, fill=(255,255,255), font=font)
        cells.append(im)
    cols = 3
    rows = (len(cells)+cols-1)//cols
    ch = max(c.height for c in cells)
    sheet = Image.new("RGB", (cw*cols+6*(cols+1), ch*rows+6*(rows+1)), (18,18,20))
    for i, c in enumerate(cells):
        x = (i%cols)*(cw+6)+6; y = (i//cols)*(ch+6)+6
        sheet.paste(c, (x,y))
    out = OUTDIR / "_sheet_trichoderma_dish.png"
    sheet.save(out, "PNG")
    log(f"SHEET -> {out}")

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    N = int(os.environ.get("N", "6"))
    paths = [gen_one(i) for i in range(N)]
    contact_sheet(paths)
    log("DONE")

if __name__ == "__main__":
    main()
