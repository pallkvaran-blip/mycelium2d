#!/usr/bin/env python3
# TANDA label builder. Emits a print-ready, fully editable SVG per design direction.
#
# Architecture, settled by two proofs earlier in this branch:
#   TYPE  -- real SIL OFL display faces, outlined with fontTools (wordmark_proof.py), so
#            the artwork carries no font dependency and needs no outline conversion.
#   ART   -- true-vector illustration from recraft-v3-svg (recraft_test.py proved it
#            returns real paths, not a wrapped bitmap), RECOLOURED here: Recraft ignores a
#            requested palette, so brand colour has to be applied after the fact.
#   LAYOUT-- code, for exact panel geometry, named layers and legal copy.
#
#   python3 scripts/label_build.py            # all directions
#   python3 scripts/label_build.py botanical  # one
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from wordmark_proof import fetch, Face, wordmark
ART = ROOT / "assets" / "tanda_options" / "recraft"
OUT = ROOT / "assets" / "tanda_options" / "labels"
OUT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- print geometry
# Units are 0.1 mm. Sleek 330 ml can: 58.1 mm diameter -> 182.5 mm circumference.
# THESE ARE TEXTBOOK FIGURES. The real dieline must come from the can supplier; every
# printer specifies its own bleed, seam overlap and neck/base shrink allowance.
BLEED  = 30
TRIM_W, TRIM_H = 1820, 1200
SHEET_W, SHEET_H = TRIM_W + 2*BLEED, TRIM_H + 2*BLEED
SAFE   = 45
FRONT_W = 620
FRONT_X = BLEED + (TRIM_W - FRONT_W) / 2          # front centred; seam falls at the back
SIDE_X0, SIDE_X1 = BLEED, FRONT_X
BACK_X0, BACK_X1 = FRONT_X + FRONT_W, BLEED + TRIM_W

# ---------------------------------------------------------------- colour helpers
def hexrgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))

def ramp_at(ramp, t):
    """Sample a list of hex colours as a continuous ramp."""
    cols = [hexrgb(c) for c in ramp]
    if len(cols) == 1: return cols[0]
    t = min(max(t, 0.0), 1.0) * (len(cols) - 1)
    i = min(int(t), len(cols) - 2)
    return lerp(cols[i], cols[i + 1], t - i)

def recolour(svg, ramp):
    """Remap the illustration's palette onto the brand ramp BY LUMINANCE, so its tonal
    structure survives while its hue changes. Recraft picks its own colours and ignores
    any asked for in the prompt, so this is required rather than cosmetic."""
    toks = sorted(set(re.findall(r"rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)", svg)))
    if not toks: return svg
    def lum(c):
        r, g, b = map(int, re.findall(r"\d+", c)); return 0.2126*r + 0.7152*g + 0.0722*b
    order = sorted(toks, key=lum)
    n = len(order)
    for i, c in enumerate(order):
        t = i / (n - 1) if n > 1 else 0.0
        r, g, b = ramp_at(ramp, t)
        svg = svg.replace(c, f"rgb({r},{g},{b})")
    return svg

def strip_backdrop(inner, vw, vh, eps=2.0):
    """Remove a full-canvas backdrop drawn as a <path> polygon. Recraft emits its
    background as `M 0 0 L W 0 L W H L 0 H L 0 0 z`, which no <rect> rule will catch, and
    leaving it in paints a pale box behind the artwork."""
    def is_backdrop(d):
        if re.search(r"[CQSTAcqsta]", d):        # curves -> real artwork, never a backdrop
            return False
        nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", d)]
        if not (6 <= len(nums) <= 12): return False
        xs, ys = nums[0::2], nums[1::2]
        return (min(xs) <= eps and abs(max(xs) - vw) <= eps and
                min(ys) <= eps and abs(max(ys) - vh) <= eps)
    out, pos = [], 0
    for m in re.finditer(r'<path[^>]*?d="([^"]*)"[^>]*?/>', inner):
        if is_backdrop(m.group(1)):
            out.append(inner[pos:m.start()]); pos = m.end()
    out.append(inner[pos:])
    return "".join(out)

def art(name, x, y, w, ramp, opacity=1.0, rotate=0):
    """Embed a Recraft illustration: strip its wrapper and provenance metadata, drop any
    full-canvas background rect, recolour, and place at a UNIFORM scale.

    The uniform scale matters: these files carry preserveAspectRatio="none", which would
    stretch the art to any box it is given. Re-wrapping in a plain <g> discards it."""
    s = (ART / f"{name}.svg").read_text(errors="ignore")
    vb = re.search(r'viewBox="([^"]+)"', s).group(1).split()
    vw, vh = float(vb[2]), float(vb[3])
    inner = s[s.index(">", s.index("<svg")) + 1: s.rindex("</svg>")]
    inner = re.sub(r"<metadata>.*?</metadata>", "", inner, flags=re.S)
    inner = re.sub(r'<rect[^>]*?width="(?:%d|100%%)"[^>]*?/>' % int(vw), "", inner)
    inner = strip_backdrop(inner, vw, vh)
    inner = recolour(inner, ramp)
    sc = w / vw
    rot = f" rotate({rotate})" if rotate else ""
    return (f'<g transform="translate({x:.1f},{y:.1f}){rot} scale({sc:.5f})" '
            f'opacity="{opacity}">{inner}</g>', vh * sc)

def art_block(d, name, cx, y, w, card=False, max_h=None):
    """Place an illustration centred on cx. With card=False the ramp's lightest stop is
    the panel background, so any surviving background in the art blends away; with
    card=True it sits on a deliberate rounded panel, which reads as intentional."""
    _, probe = art(name, 0, 0, w, d["ramp"])
    if max_h and probe > max_h:                 # scale down rather than collide
        w *= max_h / probe
    g, h = art(name, cx - w / 2, y, w, d["ramp"])
    if not card:
        return g, h
    pad = 26
    return (f'<rect x="{cx-w/2-pad:.1f}" y="{y-pad:.1f}" width="{w+2*pad:.1f}" '
            f'height="{h+2*pad:.1f}" rx="22" fill="{d["card_colour"]}"/>' + g, h + 2 * pad)

# ---------------------------------------------------------------- type helpers
def measure(face, s, size, tracking=0):
    _, adv = face.word(s, tracking)
    return adv * size / face.upem

def line(face, s, x, y, size, colour, anchor="start", tracking=0):
    glyphs, adv = face.word(s, tracking)
    w = adv * size / face.upem
    if anchor == "middle": x -= w / 2
    elif anchor == "end":  x -= w
    sc = size / face.upem
    body = "".join(f'<path d="{d}" transform="translate({gx},0)"/>' for d, gx in glyphs)
    return f'<g transform="translate({x:.1f},{y:.1f}) scale({sc:.5f},{-sc:.5f})" fill="{colour}">{body}</g>', w

def fit_line(face, s, x, y, max_w, colour, anchor="middle", tracking=0, cap=None):
    """Size a line to exactly max_w. Tracking is in font units and so scales with size,
    which makes width linear in size -- measure once at 1000 and solve directly."""
    base = measure(face, s, 1000, tracking)
    size = max_w * 1000 / base if base else 10
    if cap: size = min(size, cap)
    return line(face, s, x, y, size, colour, anchor, tracking)

def paragraph(face, text, x, y, max_w, size, leading, colour, tracking=0):
    """Greedy wrap, measured from real glyph advances rather than an estimate."""
    words, out, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if measure(face, trial, size, tracking) > max_w and cur:
            out.append(cur); cur = wd
        else:
            cur = trial
    if cur: out.append(cur)
    svg = []
    for i, ln in enumerate(out):
        g, _ = line(face, ln, x, y + i * leading, size, colour, tracking=tracking)
        svg.append(g)
    return "\n".join(svg), len(out) * leading

# ---------------------------------------------------------------- directions
# Ramps run DARKEST -> LIGHTEST: recolour() maps the illustration's darkest tone to
# ramp[0] and its lightest to ramp[-1], so the art keeps its own tonal structure.
DIRECTIONS = {
    "botanical": dict(
        label="Premium botanical",
        bg="#14392B", bg2="#0E2A20", ink="#F3E7CE", accent="#D9A441", pop="#E2711D",
        rule="#D9A441",
        ramp=["#F3E7CE", "#E4CF9E", "#B79A5E", "#3E6B4E", "#14392B"], card_art=False,
        brand=("Playfair Display", 800), body=("Inter", 400), bodyb=("Inter", 700),
        hero="hero-botanical", ornament="wreath-botanical", outline=False, tracking_brand=90,
    ),
    "vivid": dict(
        label="Vivid mass-market",
        bg="#F0921F", bg2="#E07C15", ink="#FFF6E2", accent="#5B2A62", pop="#E2521B",
        rule="#FFF6E2",
        ramp=["#7A2E12", "#C4471A", "#E2521B", "#F7B23F", "#FFF6E2"], card_art=True,
        brand=("Titan One", None), body=("Inter", 400), bodyb=("Inter", 700),
        hero="mango-cluster", ornament="leaves", outline=True, tracking_brand=0,
    ),
    "modern": dict(
        label="Bold flat modern",
        bg="#F4EFE4", bg2="#F4EFE4", ink="#17110C", accent="#123F39", pop="#EE7B21",
        rule="#17110C",
        ramp=["#17110C", "#123F39", "#1E6A5C", "#EE7B21", "#F4EFE4"], card_art=False,
        brand=("Archivo Black", None), body=("Inter", 400), bodyb=("Inter", 700),
        hero="mango-flat-b", ornament="leaf-graphic", outline=False, tracking_brand=-10,
    ),
}

PLACEHOLDER = dict(
    ingredients=("Water, mango juice from concentrate (12%), sugar, carbon dioxide, "
                 "citric acid (E330), natural mango flavouring, ascorbic acid."),
    nutrition=[("Energy", "180 kJ / 43 kcal"), ("Fat", "0 g"), ("  of which saturates", "0 g"),
               ("Carbohydrate", "10.4 g"), ("  of which sugars", "10.1 g"),
               ("Protein", "0 g"), ("Salt", "0.01 g")],
    producer=["Tanda Beverages Ltd", "Plot 00, Industrial Area", "Kampala, Uganda",
              "www.example.com"],
)

for _k, _d in DIRECTIONS.items():
    _d.setdefault("card_colour", "#FFF6E2")   # a COLOUR; card_art is the boolean
    _d.setdefault("card_art", False)

def faces(d):
    out = {}
    for key in ("brand", "body", "bodyb"):
        fam, wt = d[key]
        p = fetch(fam, wt)
        out[key] = Face(p) if p else None
    return out

# ---------------------------------------------------------------- panels
def front_panel(d, f):
    """Hero panel: wordmark, descriptor, flavour, illustration, net quantity."""
    cx = FRONT_X + FRONT_W / 2
    inner_w = FRONT_W - 2 * SAFE
    g = ['<g id="front-panel">']
    if d["outline"]:
        g.append(wordmark(f["brand"], "TANDA", cx, 300, inner_w,
                          [(26, d["ink"]), (15, d["accent"]), (0.001, "#F9AE33")]))
    else:
        t, _ = fit_line(f["brand"], "TANDA", cx, 300, inner_w, d["ink"],
                        tracking=d["tracking_brand"]); g.append(t)
    g.append(f'<rect x="{cx-130}" y="342" width="260" height="4" fill="{d["rule"]}" opacity="0.75"/>')
    t, _ = fit_line(f["bodyb"], "SPARKLING JUICE", cx, 402, inner_w * 0.86, d["ink"], tracking=320)
    g.append(t)
    if d["outline"]:
        g.append(wordmark(f["brand"], "MANGO", cx, 512, inner_w * 0.80,
                          [(18, "#9C2F0B"), (0.001, d["pop"])]))
    else:
        t, _ = fit_line(f["brand"], "MANGO", cx, 512, inner_w * 0.80, d["pop"],
                        tracking=d["tracking_brand"]); g.append(t)
    hero, hh = art_block(d, d["hero"], cx, 578, FRONT_W * 0.76,
                         card=d["card_art"], max_h=(BLEED + TRIM_H - 160) - 578)
    g.append(hero)
    base = BLEED + TRIM_H
    t, _ = fit_line(f["bodyb"], "330 ml", cx, base - 105, inner_w * 0.34, d["ink"], tracking=120)
    g.append(t)
    t, _ = fit_line(f["body"], "TROPICAL TASTE  ·  AUTHENTIC UGANDAN", cx, base - 58,
                    inner_w * 0.94, d["ink"], tracking=180)
    g.append(t)
    g.append("</g>")
    return "\n".join(g)

def side_panel(d, f):
    cx = (SIDE_X0 + SIDE_X1) / 2
    inner_w = (SIDE_X1 - SIDE_X0) - 2 * SAFE
    g = ['<g id="side-panel">']
    t, _ = fit_line(f["bodyb"], "SPARKLING", cx, 190, inner_w * 0.72, d["ink"], tracking=260); g.append(t)
    t, _ = fit_line(f["bodyb"], "MANGO JUICE", cx, 246, inner_w * 0.86, d["ink"], tracking=260); g.append(t)
    orn, _ = art_block(d, d["ornament"], cx, 320, inner_w * 0.80,
                       max_h=(BLEED + TRIM_H - 270) - 320)
    g.append(orn)
    base = BLEED + TRIM_H
    t, _ = fit_line(f["body"], "Made with real fruit.", cx, base - 210, inner_w * 0.80, d["ink"]); g.append(t)
    t, _ = fit_line(f["body"], "No artificial colours.", cx, base - 160, inner_w * 0.80, d["ink"]); g.append(t)
    g.append("</g>")
    return "\n".join(g)

def back_panel(d, f):
    """Legal panel. Every value is PLACEHOLDER -- the layout and typography are real so
    actual figures drop straight in, but nothing here is a factual claim."""
    x = BACK_X0 + SAFE
    w = (BACK_X1 - BACK_X0) - 2 * SAFE
    ink, sub = d["ink"], d["ink"]
    g = ['<g id="back-panel-legal">']
    y = 150
    t, _ = line(f["bodyb"], "INGREDIENTS", x, y, 32, ink, tracking=140); g.append(t)
    p, used = paragraph(f["body"], PLACEHOLDER["ingredients"], x, y + 46, w, 29, 38, sub)
    g.append(p); y += 46 + used + 40

    t, _ = line(f["bodyb"], "NUTRITION  (per 100 ml)", x, y, 32, ink, tracking=140); g.append(t)
    y += 46
    for k, v in PLACEHOLDER["nutrition"]:
        a, _ = line(f["body"], k, x, y, 28, sub); g.append(a)
        b, _ = line(f["body"], v, x + w, y, 28, sub, "end"); g.append(b)
        g.append(f'<line x1="{x}" y1="{y+9}" x2="{x+w}" y2="{y+9}" stroke="{ink}" '
                 f'stroke-width="1" opacity="0.22"/>')
        y += 40
    y += 26

    for ln in PLACEHOLDER["producer"]:
        a, _ = line(f["body"], ln, x, y, 28, sub); g.append(a); y += 36
    y += 10
    t, _ = line(f["body"], "BEST BEFORE: see base of can", x, y, 28, sub); g.append(t); y += 46

    # barcode placeholder -- deliberately not a valid encoding, and labelled as such
    bw, bh = w * 0.62, 150
    g.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" fill="#FFFFFF"/>')
    bx = x + 14
    widths = [3, 7, 3, 3, 10, 3, 7, 5, 3, 9, 3, 3, 7, 4, 8, 3, 5, 3, 9, 4, 3, 7, 3, 6, 8, 3, 4, 9, 3, 5]
    for i, bwid in enumerate(widths):
        if i % 2 == 0:
            g.append(f'<rect x="{bx:.1f}" y="{y+12}" width="{bwid}" height="{bh-46}" fill="#000"/>')
        bx += bwid + 3
    t, _ = line(f["body"], "BARCODE PLACEHOLDER", x + bw / 2, y + bh - 14, 22, "#000", "middle", 90)
    g.append(t)
    g.append("</g>")
    return "\n".join(g)

def build(key):
    d = DIRECTIONS[key]; f = faces(d)
    defs = (f'<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{d["bg"]}"/><stop offset="1" stop-color="{d["bg2"]}"/>'
            f'</linearGradient></defs>')
    panels = [f'<rect width="{SHEET_W}" height="{SHEET_H}" fill="url(#bg)"/>']
    if key == "modern":   # flat blocks instead of a field
        panels.append(f'<rect x="0" y="0" width="{SHEET_W}" height="565" fill="{d["accent"]}"/>')

    panels += [side_panel(d, f), front_panel(d, f), back_panel(d, f)]
    # panel divisions + trim marks, on their own layer so they can be deleted for print
    guides = (f'<g id="guides" opacity="0.30">'
              f'<rect x="{BLEED}" y="{BLEED}" width="{TRIM_W}" height="{TRIM_H}" fill="none" '
              f'stroke="{d["ink"]}" stroke-width="2" stroke-dasharray="14 10"/>'
              f'<line x1="{FRONT_X}" y1="{BLEED}" x2="{FRONT_X}" y2="{BLEED+TRIM_H}" '
              f'stroke="{d["ink"]}" stroke-width="2" stroke-dasharray="6 8"/>'
              f'<line x1="{BACK_X0}" y1="{BLEED}" x2="{BACK_X0}" y2="{BLEED+TRIM_H}" '
              f'stroke="{d["ink"]}" stroke-width="2" stroke-dasharray="6 8"/></g>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SHEET_W} {SHEET_H}" '
           f'width="{SHEET_W/10}mm" height="{SHEET_H/10}mm">{defs}'
           + "\n".join(panels) + guides + "</svg>")
    (OUT / f"tanda-{key}-wrap.svg").write_text(svg)

    # front panel alone, for comparing directions at a legible size
    fsvg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{FRONT_X} {BLEED} {FRONT_W} {TRIM_H}" '
            f'width="{FRONT_W/10}mm" height="{TRIM_H/10}mm">{defs}'
            f'<rect x="{FRONT_X}" y="{BLEED}" width="{FRONT_W}" height="{TRIM_H}" fill="url(#bg)"/>'
            + (f'<rect x="{FRONT_X}" y="{BLEED}" width="{FRONT_W}" height="535" '
               f'fill="{d["accent"]}"/>' if key == "modern" else "")
            + front_panel(d, f) + "</svg>")
    (OUT / f"tanda-{key}-front.svg").write_text(fsvg)
    return key

if __name__ == "__main__":
    keys = sys.argv[1:] or list(DIRECTIONS)
    for k in keys:
        print("built", build(k))
