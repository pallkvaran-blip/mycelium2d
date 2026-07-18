#!/usr/bin/env python3
# Turn one chosen reservoir OPTION (assets/reservoir_options/reservoir_opt_N.png)
# into an in-game sprite. AGGRESSIVE matte: key on the brightest colour channel so the
# near-black background AND the dark rock that rings/separates the water all drop to
# transparent, leaving only the glowing water (+ its immediately-lit rim) feathered
# into the surrounding soil. Usage:
#     python3 scripts/matte_reservoir.py E              # -> assets/reservoir.png
#     python3 scripts/matte_reservoir.py D reservoir1   # -> assets/reservoir1.png
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OPTS = ROOT / "assets" / "reservoir_options"

# Key thresholds on the max colour channel: <= LO fully transparent, >= HI fully
# opaque, feathered between. Teal water keeps a high channel even where it's dark, so
# it survives; the black background / dark rock (low on every channel) is cut away.
LO, HI = 18, 74

def main():
    letter = (sys.argv[1] if len(sys.argv) > 1 else "F").strip().upper()
    name = (sys.argv[2] if len(sys.argv) > 2 else "reservoir").strip()
    DEST = ROOT / "assets" / f"{name}.png"
    idx = ord(letter) - 65
    src = OPTS / f"reservoir_opt_{idx}.png"
    if not src.exists():
        print(f"missing {src}"); sys.exit(1)
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    r, g, b, _ = im.split()
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)   # per-pixel max(R,G,B)
    lut = [0 if v <= LO else (255 if v >= HI else int(round(255 * (v - LO) / (HI - LO)))) for v in range(256)]
    keyed = mx.point(lut)
    keyed = keyed.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.010))   # soften the key edge
    # Elliptical vignette: guarantees the very corners are clean and adds a soft outer
    # falloff so whatever survives the key still blends into the earth (no hard box).
    vig = Image.new("L", (w, h), 0)
    ImageDraw.Draw(vig).ellipse([w * 0.02, h * 0.02, w * 0.98, h * 0.98], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.05))
    alpha = ImageChops.multiply(keyed, vig)
    im.putalpha(alpha)
    im.save(DEST, "PNG")
    print(f"OK {letter} -> {DEST} ({DEST.stat().st_size // 1024}KB, {w}x{h})")

if __name__ == "__main__":
    main()
