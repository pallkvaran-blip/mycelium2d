#!/usr/bin/env python3
# Paint two gnomes peeking over the mushroom CAPS, at HIGH RESOLUTION.
#
# v1 inpainted them at the portrait's native size, where each gnome is only ~76x84 px — the
# faces came out smudged. So this works on the cap region upscaled 4x (1120x760), giving FLUX
# ~300x340 px per gnome to render a face into, and writes:
#
#   scratchpad/capcrop-plain.png   the upscaled crop, untouched      -> video start_image
#   scratchpad/capcrop-up.png      the same crop with heads up       -> video end_image
#   scratchpad/caps-up.jpg         full-frame 560x740 heads-up plate -> stills / reference
#
# Only the masked boxes are composited back, so every pixel outside them is the original photo.
import os, sys, json, time, base64, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "species" / "psilocybe-cubensis.jpg"
WORK = ROOT / "scratchpad"
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
MODEL = "black-forest-labs/flux-fill-pro"

CROP = (190, 130, 470, 320)          # cap region; must match the video + layer builders
UPSCALE = 4
# Straddling each cap's top edge, in PORTRAIT coords (head above the edge, body behind it).
BOXES = [(213, 158, 291, 249),
         (376, 203, 451, 284)]

PROMPT = (
    "A small painted ceramic garden gnome figurine peeks over the top edge of the mushroom "
    "cap — only its head and shoulders show above the cap. Tall red pointed conical hat, "
    "round rosy cheeks, clear bright eyes, big fluffy white beard, small green jacket, tiny "
    "hands resting on the cap edge. Crisp sharp focus on the face, fine detail, glossy "
    "painted ceramic surface, exactly the same garden-gnome figurine style and scale as the "
    "other gnomes in this photograph. Macro nature photograph, soft natural daylight."
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


def fill(img, boxes, prompt):
    ip = tempfile.mktemp(suffix=".png"); img.save(ip, "PNG")
    m = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(m)
    for b in boxes:
        d.rectangle(b, fill=255)
    mp = tempfile.mktemp(suffix=".png"); m.save(mp, "PNG")
    body = {"input": {"prompt": prompt, "image": data_uri(ip, "image/png"),
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
    return got.resize(img.size, Image.LANCZOS) if got.size != img.size else got


def main():
    if not TOKEN:
        log("NO TOKEN"); sys.exit(1)
    orig = Image.open(SRC).convert("RGB")
    crop = orig.crop(CROP)
    big = crop.resize((crop.width * UPSCALE, crop.height * UPSCALE), Image.LANCZOS)
    big.save(WORK / "capcrop-plain.png", "PNG")
    log(f"plain crop {big.size} -> capcrop-plain.png")

    # boxes: portrait coords -> upscaled-crop coords
    ub = [tuple(int((v - CROP[i % 2]) * UPSCALE) for i, v in enumerate(b)) for b in BOXES]
    log(f"masks in upscaled crop: {ub}")
    gen = fill(big, ub, PROMPT)

    # keep everything outside the masks identical to the upscaled crop
    m = Image.new("L", big.size, 0)
    d = ImageDraw.Draw(m)
    for b in ub:
        d.rectangle((b[0] + 8, b[1] + 8, b[2] - 8, b[3] - 8), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(10))
    up = big.copy(); up.paste(gen, (0, 0), m)
    up.save(WORK / "capcrop-up.png", "PNG")
    log("heads-up crop -> capcrop-up.png")

    # full-frame plate (downscaled back into the portrait) for stills / eyeballing
    full = orig.copy()
    full.paste(up.resize(crop.size, Image.LANCZOS), (CROP[0], CROP[1]))
    full.save(WORK / "caps-up.jpg", "JPEG", quality=95)
    log("full plate -> caps-up.jpg")


if __name__ == "__main__":
    main()
