#!/usr/bin/env python3
# Build the gnome-free BASE plate for the animated Magic Mushroom portrait.
# The two garden gnomes are inpainted out with FLUX Fill (Replicate), then ONLY the
# masked regions are composited back over the untouched original — so every pixel
# outside the gnome patches stays byte-identical to the shipped photo.
import os, sys, json, time, base64, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "species" / "psilocybe-cubensis.jpg"
OUT = ROOT / "assets" / "species" / "psilocybe-cubensis-base.jpg"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
MODEL = "black-forest-labs/flux-fill-pro"

# Gnome bounding boxes in the 560x740 portrait (a few px of margin around each).
GNOMES = [(199, 506, 239, 600),      # A — wedged in the gap between two stems
          (344, 550, 393, 652)]      # B — standing just right of a stem

PROMPT = ("macro nature photograph of smooth pale cream mushroom stems rising out of "
          "green forest moss, clean unbroken stems, soft dark shadowed gaps between the "
          "stems, mossy forest floor with small dry leaves, natural daylight, "
          "no figures, no people, no gnomes, no statues, no faces, no toys")


def log(m): print(m, flush=True)


def curl_json(args):
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA] + args,
                       capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"_raw": r.stdout[:300]}


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(Path(path).read_bytes()).decode()


def build_mask(size, boxes, dest):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for b in boxes:
        d.rectangle(b, fill=255)
    m.filter(ImageFilter.GaussianBlur(0)).save(dest, "PNG")
    return dest


def main():
    if not TOKEN:
        log("NO TOKEN"); sys.exit(1)
    src = Image.open(SRC).convert("RGB")
    mask_p = tempfile.mktemp(suffix=".png")
    build_mask(src.size, GNOMES, mask_p)

    body = {"input": {"prompt": PROMPT,
                      "image": data_uri(SRC, "image/jpeg"),
                      "mask": data_uri(mask_p, "image/png"),
                      "steps": 50, "guidance": 30, "safety_tolerance": 2,
                      "output_format": "png", "prompt_upsampling": False}}
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
        log("no output"); sys.exit(4)

    tmp = tempfile.mktemp(suffix=".png")
    subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA, "-o", tmp, url], check=True)
    fill = Image.open(tmp).convert("RGB")
    if fill.size != src.size:
        fill = fill.resize(src.size, Image.LANCZOS)

    # Composite ONLY the gnome boxes back (feathered) so the rest is the original photo.
    out = src.copy()
    m = Image.new("L", src.size, 0)
    d = ImageDraw.Draw(m)
    for b in GNOMES:
        d.rectangle((b[0] + 3, b[1] + 3, b[2] - 3, b[3] - 3), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(3.5))
    out.paste(fill, (0, 0), m)
    out.save(OUT, "JPEG", quality=95)
    log(f"OK -> {OUT}")


if __name__ == "__main__":
    main()
