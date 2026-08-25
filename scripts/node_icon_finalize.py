#!/usr/bin/env python3
# Recolour a chosen node-mesh icon render onto the owner's EXACT reference palette and
# cut icon sizes. Shared by every subject in the icon family (handshake, location, ...). FLUX gets the node-mesh drawing right but not the tone -- it lights the
# mesh near-white. This maps the render's luminance onto a single navy->slate ramp
# sampled from the reference image, which kills the glow and the near-white contour
# stroke in one pass, then emits an opaque icon and a transparent-background variant.
#
#   python3 scripts/node_icon_finalize.py assets/handshake_options/handshake_r3_0.png handshake-nodes-mesh
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
# Lives under an *_options folder so build.mjs's SKIP_ASSET_DIR keeps it out of
# dist/ and the itch zip -- this is an authoring deliverable, not a game asset.
OUT = ROOT / "assets" / "node_icon_options" / "finals"
OUT.mkdir(parents=True, exist_ok=True)

# Sampled from the owner's reference: deep navy field, muted steel-blue nodes/links.
BG   = np.array([  6,  42,  87], dtype=np.float32)   # #062a57
INK  = np.array([124, 155, 190], dtype=np.float32)   # #7c9bbe  (mid-tones land ~#6d8db3)
SIZES = (1024, 512, 256, 128, 64)

def ink_amount(im, gamma=0.9, knee=0.07):
    """Per-pixel 0..1 'how much mesh is here', from luminance over the render's own
    background floor. Percentile ceiling so one hot pixel can't flatten the ramp; the
    knee clamps the field to true background, since FLUX gives its navy a gradient and
    without it the whole frame lifts off the reference navy."""
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    lum = 0.2126*a[:,:,0] + 0.7152*a[:,:,1] + 0.0722*a[:,:,2]
    floor = np.percentile(lum, 62.0)          # the navy field dominates the frame
    ceil  = np.percentile(lum, 99.6)
    if ceil - floor < 1e-3: ceil = floor + 1.0
    t = np.clip((lum - floor) / (ceil - floor), 0.0, 1.0)
    t = np.clip((t - knee) / (1.0 - knee), 0.0, 1.0)
    return t ** gamma

def recolour(src, gamma=0.9):
    im = Image.open(src)
    t = ink_amount(im, gamma)[:, :, None]
    flat = (BG[None,None,:] + t * (INK - BG)[None,None,:]).astype(np.uint8)
    opaque = Image.fromarray(flat, "RGB")
    rgba = np.zeros(t.shape[:2] + (4,), dtype=np.uint8)
    rgba[:,:,0:3] = INK.astype(np.uint8)[None,None,:]
    rgba[:,:,3]   = (t[:,:,0] * 255).astype(np.uint8)
    return opaque, Image.fromarray(rgba, "RGBA")

def square(im):
    w, h = im.size
    if w == h: return im
    s = min(w, h)
    return im.crop(((w-s)//2, (h-s)//2, (w-s)//2+s, (h-s)//2+s))

def emit(src, slug, gamma=0.9):
    opaque, alpha = recolour(src, gamma)
    opaque, alpha = square(opaque), square(alpha)
    made = []
    for s in SIZES:
        o = opaque.resize((s, s), Image.LANCZOS); o.save(OUT/f"{slug}-{s}.png", "PNG"); made.append(OUT/f"{slug}-{s}.png")
        a = alpha.resize((s, s), Image.LANCZOS);  a.save(OUT/f"{slug}-{s}-alpha.png", "PNG"); made.append(OUT/f"{slug}-{s}-alpha.png")
    return made

def compare(pairs, out, cell=340):
    """Contact sheet: each source render above its recoloured result."""
    pad, lab = 12, 24
    W = len(pairs)*(cell+pad)+pad; H = 2*(cell+lab+pad)+pad
    sh = Image.new("RGB",(W,H),(12,14,20)); dr = ImageDraw.Draw(sh)
    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
    except Exception: font = ImageFont.load_default()
    for i,(src,slug) in enumerate(pairs):
        x = pad + i*(cell+pad)
        for row,im in enumerate([square(Image.open(src).convert("RGB")),
                                 Image.open(OUT/f"{slug}-1024.png").convert("RGB")]):
            im = im.copy(); im.thumbnail((cell,cell), Image.LANCZOS)
            y = pad + row*(cell+lab+pad)
            sh.paste(im,(x+(cell-im.width)//2, y))
            dr.text((x+4, y+cell+4), (Path(src).stem if row==0 else slug+" (final)"), fill=(220,225,235), font=font)
    sh.save(out,"PNG"); return out

if __name__ == "__main__":
    src, slug = sys.argv[1], sys.argv[2]
    gamma = float(sys.argv[3]) if len(sys.argv) > 3 else 0.9
    for f in emit(src, slug, gamma): print(f)
