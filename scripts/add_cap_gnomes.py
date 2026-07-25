#!/usr/bin/env python3
# Add two MORE gnomes to the Magic Mushroom portrait, peeking over the tops of the mushroom
# caps. Unlike the two gnomes already in the photo, these don't exist — so this paints them
# in with FLUX Fill to make the "head up" plate, which then becomes the start/end frame for
# the duck-and-rise video (scripts/gen_cap_video.py).
#
# As in remove_gnomes.py, only the masked boxes are composited back over the original, so
# every pixel outside them stays byte-identical to the shipped photo.
import os, sys, json, time, base64, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "species" / "psilocybe-cubensis.jpg"
OUT = ROOT / "scratchpad" / "caps-up.jpg"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
MODEL = "black-forest-labs/flux-fill-pro"

# Straddling each cap's top edge: the head goes above the edge, the body stays hidden behind.
BOXES = [(213, 163, 289, 247),      # behind the big central cap, left of its apex
         (378, 208, 449, 282)]      # behind the cap on the right

PROMPT = (
    "A tiny painted ceramic garden gnome peeks over the top edge of the mushroom cap, only "
    "its head and shoulders showing above the cap — a red pointed conical hat, round rosy "
    "face, big white beard, exactly the same small glossy painted garden-gnome figurine "
    "style and scale as the other garden gnomes in this photograph. It is hiding behind the "
    "mushroom, peering over the cap. Macro nature photograph, soft natural daylight, "
    "shallow depth of field, blurred background."
)


def log(m): print(m, flush=True)


def curl_json(args):
    r = subprocess.run(["curl", "-sS", "--max-time", "240", "--cacert", CA] + args,
                       capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"_raw": r.stdout[:300]}


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def fill(src_img, boxes, prompt):
    """One FLUX Fill pass over `boxes`; returns the generated full frame."""
    sp = tempfile.mktemp(suffix=".jpg"); src_img.save(sp, "JPEG", quality=96)
    m = Image.new("L", src_img.size, 0)
    d = ImageDraw.Draw(m)
    for b in boxes:
        d.rectangle(b, fill=255)
    mp = tempfile.mktemp(suffix=".png"); m.save(mp, "PNG")

    body = {"input": {"prompt": prompt, "image": data_uri(sp, "image/jpeg"),
                      "mask": data_uri(mp, "image/png"), "steps": 50, "guidance": 30,
                      "safety_tolerance": 2, "output_format": "png"}}
    bp = tempfile.mktemp(suffix=".json"); Path(bp).write_text(json.dumps(body))
    d = curl_json(["-H", f"Authorization: Bearer {TOKEN}", "-H", "Content-Type: application/json",
                   "--data", f"@{bp}", f"https://api.replicate.com/v1/models/{MODEL}/predictions"])
    get = ((d.get("urls") or {}).get("get")) or ""
    if not get:
        log(f"create failed: {d.get('detail') or d.get('_raw') or d}"); sys.exit(2)
    url = ""
    for _ in range(150):
        r = curl_json(["-H", f"Authorization: Bearer {TOKEN}", get])
        st = r.get("status")
        if st == "succeeded":
            o = r.get("output")
            url = o[0] if isinstance(o, list) and o else (o if isinstance(o, str) else "")
            break
        if st in ("failed", "canceled"):
            log(f"{st}: {r.get('error')}"); sys.exit(3)
        time.sleep(2)
    if not url:
        log("timed out"); sys.exit(4)
    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl", "-sS", "--max-time", "240", "--cacert", CA, "-o", tmp, url], check=True)
    got = Image.open(tmp).convert("RGB")
    return got.resize(src_img.size, Image.LANCZOS) if got.size != src_img.size else got


def main():
    if not TOKEN:
        log("NO TOKEN"); sys.exit(1)
    src = Image.open(SRC).convert("RGB")
    gen = fill(src, BOXES, PROMPT)

    out = src.copy()
    m = Image.new("L", src.size, 0)
    d = ImageDraw.Draw(m)
    for b in BOXES:
        d.rectangle((b[0] + 3, b[1] + 3, b[2] - 3, b[3] - 3), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(3.5))
    out.paste(gen, (0, 0), m)
    out.save(OUT, "JPEG", quality=95)
    log(f"OK -> {OUT}")


if __name__ == "__main__":
    main()
