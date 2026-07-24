#!/usr/bin/env python3
# Troll rockface for the Magic Mushroom unlock — BATCH 3 (owner feedback: batch 2 was
# too bright, too high-detail, and too much face). Target = the DARK, simple in-game rock
# sprites (assets/rockMossy.png is dark charcoal, low-detail). So: near-black charcoal
# boulder, soft flat low-detail painterly shading, and the face almost invisible — mostly
# just a plain dark mossy rock. FLUX 1.1 PRO ULTRA, raw:false. Output ->
# assets/rock_options/troll-r<n>.jpg/.png (proper bg-keyed cutout) + a contact sheet.
import os, sys, json, time, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUTDIR = ROOT / "assets" / "rock_options"
OUTDIR.mkdir(parents=True, exist_ok=True)
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
LOG = os.environ.get("ROCKLOG", "/tmp/troll_rock.log")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

# Dark, simple, low-detail game rock (match rockMossy) on a pure-black background.
STYLE = ("simple 2D game-art rock sprite, soft flat low-detail painterly shading (NOT "
         "photoreal, NOT high-detail, NOT crisp, no fine texture), a DARK near-black "
         "charcoal-grey boulder like a dim underground stone, muted desaturated deep-earth "
         "palette, sparse patches of dark olive moss, gentle soft shadow, matches a plain "
         "dark 2D side-scroller game boulder, solid pure black background, centered, "
         "no text, no watermark, no border, no people")

# Almost no face — a plain dark rock that only MIGHT hint at a sleeping face.
SUBJECT = ("an ordinary plain dark charcoal boulder, essentially just a normal dim mossy "
           "underground rock; at most the faintest accidental shadow in its facets could "
           "be imagined as a sleeping face, but there are NO eyes, NO glowing eyes, NO "
           "nose or mouth, nothing golem-like or monstrous, no character — a player should "
           "simply see a dark rock. The face is almost completely invisible and unimportant")

VARIANTS = [
    ("a plain rounded dark boulder, no discernible face at all, just dim stone and moss", 6100),
    ("a dark angular boulder, only the very faintest shadow hollows, no real face", 6270),
    ("a dim mossy boulder, at most a sleepy suggestion in the shadows, extremely subtle", 6440),
    ("a dark craggy boulder, moss creeping over any hint of a face, nearly featureless", 6610),
    ("a smooth dark river boulder, the calmest faintest sleeping impression, mostly plain", 6780),
]

def log(m):
    with open(LOG, "a") as f: f.write(m + "\n")
    print(m, flush=True)

def curl_json(args):
    r = subprocess.run(["curl","-sS","--max-time","120","--cacert",CA]+args, capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {"_raw": r.stdout[:200]}

def create(prompt, seed):
    body = json.dumps({"input":{"prompt":prompt,"aspect_ratio":"1:1","raw":False,
                                "output_format":"png","safety_tolerance":6,"seed":seed}})
    return curl_json(["-H",f"Authorization: Bearer {TOKEN}","-H","Content-Type: application/json",
                      "-d",body, f"https://api.replicate.com/v1/models/{MODEL}/predictions"])

def poll(geturl):
    for _ in range(150):
        d = curl_json(["-H",f"Authorization: Bearer {TOKEN}",geturl])
        st = d.get("status")
        if st == "succeeded": return d
        if st in ("failed","canceled"): return d
        time.sleep(2)
    return {"status":"timeout"}

def bg_cutout(im, dest):
    """Flood-fill the (near-uniform) background from the borders to a clean transparent
    silhouette — works for both light and dark backgrounds (keyed by the corner colour)."""
    im = im.convert("RGB")
    w, h = im.size
    work = im.copy()
    SENT = (255, 0, 255)
    seeds = [(1,1),(w-2,1),(1,h-2),(w-2,h-2),(w//2,1),(w//2,h-2),(1,h//2),(w-2,h//2)]
    for s in seeds:
        ImageDraw.floodfill(work, s, SENT, thresh=34)
    px = work.load()
    alpha = Image.new("L", (w, h), 255); ap = alpha.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == SENT: ap[x, y] = 0
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.5))
    out = im.convert("RGBA"); out.putalpha(alpha)
    bbox = out.getbbox()
    if bbox:
        pad = 8
        bbox = (max(0,bbox[0]-pad), max(0,bbox[1]-pad), min(w,bbox[2]+pad), min(h,bbox[3]+pad))
        out = out.crop(bbox)
    out.save(dest, "PNG")

def save_variants(url, n):
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl","-sS","--max-time","150","--cacert",CA,"-o",tmp,url], check=True)
    im = Image.open(tmp).convert("RGB")
    s = min(im.width, im.height)
    im = im.crop(((im.width-s)//2, (im.height-s)//2, (im.width-s)//2+s, (im.height-s)//2+s)).resize((560,560), Image.LANCZOS)
    im = ImageEnhance.Brightness(im).enhance(0.82)     # nudge darker to sit with the dim in-game rocks
    im = ImageEnhance.Color(im).enhance(0.85)          # slightly desaturate
    im.save(OUTDIR / f"troll-r{n}.jpg", "JPEG", quality=90)
    bg_cutout(im, str(OUTDIR / f"troll-r{n}.png"))
    os.remove(tmp)

def gen_one(n, variant, seed):
    prompt = f"{SUBJECT}, {variant}, {STYLE}"
    for attempt in range(4):
        d = create(prompt, seed + attempt*911)
        get = ((d.get("urls") or {}).get("get")) or ""
        if not get: log(f"troll-r{n}: create fail ({d.get('detail') or d.get('_raw')})"); time.sleep(5); continue
        r = poll(get)
        out = r.get("output"); url = out[0] if isinstance(out,list) and out else (out if isinstance(out,str) else "")
        if r.get("status")=="succeeded" and url:
            try: save_variants(url, n); log(f"OK troll-r{n}"); return
            except Exception as e: log(f"troll-r{n}: dl error {e}")
        else: log(f"troll-r{n}: {r.get('status')} ({r.get('error') or ''})"); time.sleep(4)
    log(f"FAIL troll-r{n}")

def label(im, text):
    d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except Exception: font = ImageFont.load_default()
    d.rectangle([0,0,min(im.width, 12+len(text)*14), 36], fill=(0,0,0)); d.text((8,5), text, fill=(255,255,255), font=font)
    return im

def sheet():
    cells = []
    for n in range(1,6):
        p = OUTDIR / f"troll-r{n}.jpg"
        if not p.exists(): continue
        im = Image.open(p).convert("RGB"); cw = 340; im = im.resize((cw, round(im.height*cw/im.width)), Image.LANCZOS)
        cells.append(label(im, f"ROCK #{n}"))
    if not cells: return None
    ch = max(c.height for c in cells); cw = 340; per = min(len(cells), 5)
    sh = Image.new("RGB", (cw*per+6*(per+1), ch+12), (18,18,20))
    for i,c in enumerate(cells): sh.paste(c, (6+i*(cw+6), 6))
    out = OUTDIR / "_sheet_troll.png"; sh.save(out, "PNG"); log(f"SHEET -> {out}"); return out

def main():
    if not TOKEN: log("NO TOKEN"); sys.exit(1)
    for n in range(1,6):
        for ext in ('jpg','png'):
            p = OUTDIR / f"troll-r{n}.{ext}"
            if p.exists(): p.unlink()
    for n,(variant,seed) in enumerate(VARIANTS, start=1):
        gen_one(n, variant, seed); time.sleep(2)
    sheet()
    log("TROLL ROCK DONE")

if __name__ == "__main__":
    main()
