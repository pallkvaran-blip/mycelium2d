#!/usr/bin/env python3
# Compose finished labels: generated artwork + REAL outlined type + print geometry.
#
# Why this split. A single model composing the whole label gets a cohesion that assembling
# vector parts does not, but its lettering is unreliable -- the bake-off winner spelled the
# brand "ITANDA", having absorbed the name of the falls. So the artwork is generated with
# no text and deliberate clear space, and type is set here in outlined Titan One. That also
# guarantees the three flavours carry an IDENTICAL wordmark, which separately generated
# lettering never would.
#
#   python3 scripts/label_compose.py
import base64, io, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from wordmark_proof import fetch, Face
from label_build import (FRONT_W, TRIM_H, BLEED, SAFE, fit_line, line, arc_word,
                         wordmark, measure)
RASTER = ROOT / "assets" / "tanda_options" / "raster"
OUT    = ROOT / "assets" / "tanda_options" / "labels"
OUT.mkdir(parents=True, exist_ok=True)

PANEL_W, PANEL_H = FRONT_W, TRIM_H            # 62 x 120 mm in 0.1 mm units
ART_PX_W = 1360                               # ~557 dpi at 62 mm; well past the 300 dpi bar

# Accent colours are AUTHORED, not derived from the artwork. Deriving them (field x 0.72)
# gave pineapple a muddy olive pill and left the brand fill almost invisible on yellow.
# The wordmark treatment is identical across all three -- white halo, deep outline, cream
# fill -- so the family reads as one brand and stays legible on any field.
FLAVOURS = {
    "mango":     dict(word="MANGO",     src="mango-nano-clean",
                      deep="#6B3410", accent="#C7451A"),
    "passion":   dict(word="PASSION",   src="passion-nano-clean",
                      deep="#2E2154", accent="#B31B6E"),
    "pineapple": dict(word="PINEAPPLE", src="pineapple-nano-clean",
                      deep="#2F5D18", accent="#2E8B3F"),
}

def prep_art(src):
    """Crop the generated artwork to the panel's aspect and resample to print resolution."""
    im = Image.open(RASTER / f"{src}.png").convert("RGB")
    target = PANEL_W / PANEL_H
    w, h = im.size
    if w / h > target:                         # too wide -> trim sides
        nw = int(h * target); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:                                      # too tall -> trim from the BOTTOM, keeping
        nh = int(w / target)                   # the reserved clear space at the top
        im = im.crop((0, 0, w, nh))
    im = im.resize((ART_PX_W, int(ART_PX_W / target)), Image.LANCZOS)
    return im

def field_colour(im):
    """Average of the reserved top band -- the flat colour the wordmark will sit on."""
    band = im.crop((0, 0, im.width, int(im.height * 0.10)))
    px = band.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return px

def shade(rgb, f):
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(c * f))) for c in rgb)

def data_uri(im):
    buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def compose(key):
    spec = FLAVOURS[key]
    im = prep_art(spec["src"])
    fld = field_colour(im)
    ink, outline, pill = "#FFF6E2", spec["deep"], spec["accent"]
    faces = {k: Face(fetch(*v)) for k, v in
             {"brand": ("Titan One", None), "body": ("Inter", 400), "bodyb": ("Inter", 700)}.items()}
    x0, y0 = BLEED, BLEED
    cx = x0 + PANEL_W / 2
    inner = PANEL_W - 2 * SAFE
    g = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {PANEL_W} {PANEL_H}" '
         f'width="{PANEL_W/10}mm" height="{PANEL_H/10}mm">',
         f'<image x="{x0}" y="{y0}" width="{PANEL_W}" height="{PANEL_H}" '
         f'href="{data_uri(im)}" preserveAspectRatio="xMidYMid slice"/>',
         '<g id="type">']
    g.append(arc_word(faces["brand"], "TANDA", cx, y0 + 252, inner, 1100,
                      [(34, "#FFFFFF"), (21, outline), (0.001, ink)]))
    t, _ = fit_line(faces["bodyb"], "SPARKLING JUICE", cx, y0 + 318, inner * 0.74, ink, tracking=320)
    g.append(t)
    # flavour name in a banner, so it stays legible where it crosses into the artwork
    fw = inner * 0.86
    g.append(f'<rect x="{cx-fw/2:.1f}" y="{y0+352}" width="{fw:.1f}" height="118" rx="59" '
             f'fill="{pill}" stroke="{ink}" stroke-width="6"/>')
    t, _ = fit_line(faces["brand"], spec["word"], cx, y0 + 448, fw * 0.80, ink, tracking=20)
    g.append(t)
    base = y0 + PANEL_H
    band_h = 196
    g.append(f'<rect x="{x0}" y="{base-band_h}" width="{PANEL_W}" height="{band_h}" '
             f'fill="{outline}"/>')
    sys.path.insert(0, str(ROOT / "scripts"))
    from gen_tanda_label import flag
    t, _ = fit_line(faces["bodyb"], "330 ml", cx - 92, base - 108, 158, ink, tracking=110); g.append(t)
    g.append(flag(cx + 44, base - 158, 94))
    t, _ = fit_line(faces["body"], "TROPICAL TASTE  ·  AUTHENTIC UGANDAN", cx, base - 42,
                    inner * 0.92, ink, tracking=180); g.append(t)
    g += ["</g>", "</svg>"]
    f = OUT / f"tanda-{key}-label.svg"
    f.write_text("\n".join(g))
    print(f"{key}: art {im.size}, field #{fld[0]:02x}{fld[1]:02x}{fld[2]:02x}, "
          f"{f.stat().st_size//1024}KB")
    return f

if __name__ == "__main__":
    for k in FLAVOURS: compose(k)
