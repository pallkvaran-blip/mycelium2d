#!/usr/bin/env python3
# Vector rebuild of the TANDA sparkling-juice can label, emitted as a single
# dependency-free SVG.
#
# Two things shape the approach:
#  - The source is a photographic can MOCKUP, not flat art, so nothing here is traced.
#    Every element is redrawn: this is an interpretation at print quality, not a copy.
#  - Type is drawn from a small built-in STROKE FONT (skeleton paths given a thick round
#    cap/join), so the file needs no installed font and no outline conversion. It also
#    gives the layered wordmark for free -- the same skeleton stroked three times at
#    decreasing widths IS the white/plum/orange outline stack on the TANDA logo.
#
#   python3 scripts/gen_tanda_label.py            -> assets/tanda_options/tanda-label.svg
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT  = ROOT / "assets" / "tanda_options"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 600, 1600            # front-panel artwork; see README note on full-wrap sizing

# ---------------------------------------------------------------- palette
ORANGE_HI   = "#F7B23F"
ORANGE_MID  = "#F0921F"
ORANGE_LO   = "#E07C15"
PLUM        = "#5B2A62"
CREAM       = "#FFF6E2"
MANGO_RED   = "#E2521B"
LEAF_DARK   = "#1F5C33"
LEAF_MID    = "#2E7D3C"
LEAF_LIGHT  = "#5CA84C"

# ---------------------------------------------------------------- stroke font
# Each glyph: (list of subpaths, advance width). Coordinates run 0..1 across and
# 0 (cap line) .. 1 (baseline) down, so a glyph scales by cap height alone.
G = {
 "A": (["M0,1 L0.5,0 L1,1", "M0.19,0.66 H0.81"], 1.00),
 "C": (["M1,0.22 C0.88,0.06 0.71,0 0.5,0 C0.2,0 0,0.2 0,0.5 C0,0.8 0.2,1 0.5,1 C0.71,1 0.88,0.94 1,0.78"], 1.00),
 "D": (["M0,0 V1", "M0,0 H0.42 C0.83,0 1,0.21 1,0.5 C1,0.79 0.83,1 0.42,1 H0"], 1.02),
 "E": (["M1,0 H0 V1 H1", "M0,0.5 H0.78"], 0.90),
 "G": (["M1,0.24 C0.88,0.07 0.7,0 0.5,0 C0.2,0 0,0.2 0,0.5 C0,0.8 0.2,1 0.5,1 C0.81,1 1,0.84 1,0.6 H0.56"], 1.06),
 "H": (["M0,0 V1", "M1,0 V1", "M0,0.5 H1"], 1.02),
 "I": (["M0.17,0 V1"], 0.34),
 "J": (["M0.86,0 V0.7 C0.86,0.9 0.71,1 0.48,1 C0.28,1 0.12,0.92 0.04,0.77"], 0.90),
 "K": (["M0,0 V1", "M0.98,0 L0.06,0.57", "M0.36,0.4 L1,1"], 0.98),
 "L": (["M0,0 V1 H0.88"], 0.88),
 "M": (["M0,1 V0 L0.5,0.63 L1,0 V1"], 1.16),
 "N": (["M0,1 V0 L1,1 V0"], 1.02),
 "O": (["M0.5,0 C0.81,0 1,0.2 1,0.5 C1,0.8 0.81,1 0.5,1 C0.19,1 0,0.8 0,0.5 C0,0.2 0.19,0 0.5,0 Z"], 1.06),
 "P": (["M0,1 V0 H0.48 C0.85,0 1,0.13 1,0.31 C1,0.49 0.85,0.61 0.48,0.61 H0"], 0.98),
 "R": (["M0,1 V0 H0.48 C0.85,0 1,0.12 1,0.29 C1,0.46 0.85,0.57 0.48,0.57 H0", "M0.44,0.57 L1,1"], 1.00),
 "S": (["M0.96,0.19 C0.85,0.05 0.66,0 0.48,0 C0.21,0 0.05,0.12 0.05,0.28 C0.05,0.45 0.26,0.5 0.5,0.54 C0.79,0.59 0.96,0.66 0.96,0.79 C0.96,0.93 0.75,1 0.5,1 C0.28,1 0.1,0.94 0,0.82"], 0.98),
 "T": (["M0,0 H1", "M0.5,0 V1"], 0.96),
 "U": (["M0,0 V0.62 C0,0.86 0.2,1 0.5,1 C0.8,1 1,0.86 1,0.62 V0"], 1.02),
 "3": (["M0.06,0.13 C0.22,0 0.52,-0.02 0.72,0.06 C0.95,0.16 0.93,0.43 0.5,0.49 C0.95,0.55 0.99,0.85 0.73,0.95 C0.5,1.04 0.2,1 0.05,0.87"], 0.88),
 "0": (["M0.5,0 C0.78,0 0.95,0.2 0.95,0.5 C0.95,0.8 0.78,1 0.5,1 C0.22,1 0.05,0.8 0.05,0.5 C0.05,0.2 0.22,0 0.5,0 Z"], 0.92),
 "l": (["M0.17,0 V1"], 0.34),
 "m": (["M0,1 V0.45", "M0,0.58 C0.07,0.46 0.42,0.42 0.48,0.58 V1", "M0.48,0.58 C0.55,0.46 0.92,0.42 1,0.58 V1"], 1.12),
 "e": (["M0.05,0.72 H0.95 C0.95,0.55 0.79,0.44 0.53,0.44 C0.24,0.44 0.05,0.58 0.05,0.74 C0.05,0.9 0.24,1 0.53,1 C0.74,1 0.87,0.95 0.95,0.87"], 0.96),
 " ": ([], 0.44),
}

def text_width(s, size, tracking):
    n = max(len(s) - 1, 0)
    return sum(G[c][1] for c in s) * size + n * tracking

def fit(s, target_w, track_ratio=0.12):
    """Cap height that makes `s` exactly `target_w` wide, tracking scaling with it.
    Sizing by width rather than by eye is what keeps every line inside the panel."""
    n = max(len(s) - 1, 0)
    size = target_w / (sum(G[c][1] for c in s) + n * track_ratio)
    return size, size * track_ratio

def text_layer(s, cx, y, size, tracking, colour, width, cap="round", opacity=1.0):
    """One stroked pass of a word, centred on cx with its cap line at y."""
    x = cx - text_width(s, size, tracking) / 2
    out = [f'<g fill="none" stroke="{colour}" stroke-width="{width/size:.4f}" '
           f'stroke-linecap="{cap}" stroke-linejoin="round" opacity="{opacity}">']
    for ch in s:
        paths, adv = G[ch]
        if paths:
            out.append(f'<g transform="translate({x:.2f},{y:.2f}) scale({size:.4f})">')
            out += [f'<path d="{d}"/>' for d in paths]
            out.append("</g>")
        x += adv * size + tracking
    out.append("</g>")
    return "\n".join(out)

def word(s, cx, y, size, tracking, layers):
    """Layered stroke stack -- widest first -- which is what makes the outlined logo."""
    return "\n".join(text_layer(s, cx, y, size, tracking, c, w) for w, c in layers)

# ---------------------------------------------------------------- ornaments
def mango(x, y, s, rot=0):
    """Asymmetric, wider than tall, one shoulder fuller -- a round body plus a leaf just
    reads as an orange, which is what the first pass produced."""
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            '<path d="M0.70,-0.08 C0.80,0.20 0.50,0.50 0.10,0.53 '
            'C-0.32,0.56 -0.72,0.32 -0.74,-0.02 C-0.76,-0.32 -0.44,-0.52 -0.06,-0.52 '
            'C0.32,-0.52 0.62,-0.34 0.70,-0.08 Z" '
            'fill="url(#gMango)" stroke="#8A3D10" stroke-width="0.045"/>'
            '<path d="M-0.44,-0.24 C-0.24,-0.42 0.00,-0.46 0.20,-0.40" fill="none" '
            'stroke="#FFF0B8" stroke-width="0.07" stroke-linecap="round" opacity="0.9"/>'
            '<path d="M0.34,0.30 C0.56,0.14 0.66,-0.06 0.62,-0.24" fill="none" '
            'stroke="#C6431A" stroke-width="0.10" stroke-linecap="round" opacity="0.45"/>'
            '<path d="M-0.06,-0.52 C0.04,-0.74 0.28,-0.82 0.44,-0.74 '
            'C0.34,-0.54 0.14,-0.46 -0.06,-0.52 Z" '
            f'fill="{LEAF_MID}" stroke="#17471F" stroke-width="0.04"/></g>')

def leaf(x, y, s, rot=0, fill=LEAF_MID):
    return (f'<g transform="translate({x},{y}) rotate({rot}) scale({s})">'
            '<path d="M0,-0.5 C0.34,-0.32 0.38,0.18 0,0.5 C-0.38,0.18 -0.34,-0.32 0,-0.5 Z" '
            f'fill="{fill}" stroke="#17471F" stroke-width="0.05"/>'
            '<path d="M0,-0.42 V0.42" fill="none" stroke="#17471F" stroke-width="0.045" opacity="0.7"/></g>')

def flag(x, y, w):
    h = w * 2 / 3
    bands = ["#000000", "#FCDC04", "#D90000", "#000000", "#FCDC04", "#D90000"]
    b = "".join(f'<rect x="0" y="{i*h/6:.2f}" width="{w}" height="{h/6:.2f}" fill="{c}"/>'
                for i, c in enumerate(bands))
    return (f'<g transform="translate({x},{y})">{b}'
            f'<circle cx="{w/2}" cy="{h/2}" r="{h*0.30:.2f}" fill="#FFFFFF"/>'
            # crowned crane, reduced to a legible silhouette at this size
            f'<g transform="translate({w/2},{h/2}) scale({h*0.30/10:.3f})" fill="#3B3B3B">'
            '<path d="M-5,3 C-3,-1 1,-2 4,-4 L6,-6 L4.6,-6.6 C3,-5.6 0,-4.4 -2,-3.6 '
            'C-5,-2.4 -6.6,0.4 -6,3 Z"/><path d="M5.4,-6.4 L7.4,-7.6 L6.6,-5.6 Z"/>'
            '<path d="M-3.4,2.6 L-2.6,6.4 M-0.6,2 L0.2,6.4" stroke="#3B3B3B" stroke-width="0.9" fill="none"/>'
            '</g></g>')

def bubbles(seed=3):
    """Deterministic scatter -- an LCG rather than random, so rebuilds are identical."""
    s, out = seed, []
    def rnd():
        nonlocal s
        s = (1103515245 * s + 12345) % (1 << 31)
        return s / (1 << 31)
    for _ in range(46):
        x, y, r = 40 + rnd() * (W - 80), 300 + rnd() * 1050, 3 + rnd() * 9
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#FFFFFF" '
                   f'opacity="{0.10 + rnd()*0.16:.2f}"/>')
    return "\n".join(out)

# ---------------------------------------------------------------- jungle scene
def scene(x, y, w, h):
    """Waterfall vignette, painted back to front: sky, sun, three ridge bands, VALLEY FLOOR,
    gorge, falls, pool, river, bank rocks, palms, foreground.

    The valley floor matters. Without it the ridges stop mid-frame and the lower third
    shows through as pale sky, so the rocks look like slabs floating in fog -- which is
    exactly what the first two passes did."""
    def X(f): return f * w
    def Y(f): return f * h
    return f"""<g transform="translate({x},{y})" clip-path="url(#clipScene)">
  <rect width="{w}" height="{h}" fill="url(#gSky)"/>
  <circle cx="{X(0.74)}" cy="{Y(0.12)}" r="{X(0.095)}" fill="#FFF3C4" opacity="0.8"/>
  <path d="M0,{Y(0.32)} L{X(0.16)},{Y(0.16)} L{X(0.30)},{Y(0.28)} L{X(0.46)},{Y(0.11)}
           L{X(0.62)},{Y(0.26)} L{X(0.78)},{Y(0.14)} L{X(0.92)},{Y(0.27)} L{w},{Y(0.21)}
           V{Y(0.44)} H0 Z" fill="#5C9B6F" opacity="0.6"/>
  <path d="M0,{Y(0.38)} L{X(0.20)},{Y(0.23)} L{X(0.38)},{Y(0.35)} L{X(0.54)},{Y(0.19)}
           L{X(0.72)},{Y(0.33)} L{X(0.88)},{Y(0.23)} L{w},{Y(0.35)} V{Y(0.54)} H0 Z" fill="#347A4D"/>
  <path d="M0,{Y(0.47)} C{X(0.16)},{Y(0.37)} {X(0.32)},{Y(0.49)} {X(0.5)},{Y(0.43)}
           C{X(0.70)},{Y(0.37)} {X(0.86)},{Y(0.50)} {w},{Y(0.43)} V{Y(0.62)} H0 Z" fill="#256240"/>
  <path d="M0,{Y(0.58)} C{X(0.22)},{Y(0.52)} {X(0.36)},{Y(0.60)} {X(0.5)},{Y(0.60)}
           C{X(0.66)},{Y(0.60)} {X(0.80)},{Y(0.52)} {w},{Y(0.57)} V{h} H0 Z" fill="#1E5636"/>
  <g fill="#6B6157">
    <path d="M{X(0.30)},{Y(0.38)} L{X(0.435)},{Y(0.35)} L{X(0.445)},{Y(0.70)}
             L{X(0.26)},{Y(0.72)} Z"/>
    <path d="M{X(0.565)},{Y(0.35)} L{X(0.70)},{Y(0.39)} L{X(0.74)},{Y(0.71)}
             L{X(0.555)},{Y(0.70)} Z"/>
  </g>
  <g fill="#8A7F70">
    <path d="M{X(0.30)},{Y(0.38)} L{X(0.435)},{Y(0.35)} L{X(0.44)},{Y(0.45)} L{X(0.29)},{Y(0.47)} Z"/>
    <path d="M{X(0.565)},{Y(0.35)} L{X(0.70)},{Y(0.39)} L{X(0.705)},{Y(0.48)} L{X(0.56)},{Y(0.45)} Z"/>
  </g>
  <g stroke="#4E453C" stroke-width="{X(0.007)}" fill="none" opacity="0.55">
    <path d="M{X(0.33)},{Y(0.46)} L{X(0.35)},{Y(0.66)} M{X(0.39)},{Y(0.44)} L{X(0.40)},{Y(0.68)}"/>
    <path d="M{X(0.62)},{Y(0.46)} L{X(0.63)},{Y(0.67)} M{X(0.68)},{Y(0.48)} L{X(0.69)},{Y(0.68)}"/>
  </g>
  <path d="M{X(0.445)},{Y(0.35)} H{X(0.565)} L{X(0.552)},{Y(0.645)} H{X(0.458)} Z" fill="#EAF7FC"/>
  <path d="M{X(0.462)},{Y(0.36)} V{Y(0.635)} M{X(0.505)},{Y(0.355)} V{Y(0.64)} M{X(0.545)},{Y(0.36)} V{Y(0.635)}"
        stroke="#A6E0F2" stroke-width="{X(0.010)}" fill="none" stroke-linecap="round" opacity="0.95"/>
  <ellipse cx="{X(0.505)}" cy="{Y(0.655)}" rx="{X(0.125)}" ry="{Y(0.032)}" fill="#FFFFFF" opacity="0.95"/>
  <path d="M{X(0.395)},{Y(0.66)} C{X(0.415)},{Y(0.78)} {X(0.425)},{Y(0.90)} {X(0.43)},{h}
           H{X(0.585)} C{X(0.59)},{Y(0.90)} {X(0.60)},{Y(0.78)} {X(0.62)},{Y(0.66)} Z" fill="url(#gWater)"/>
  <path d="M{X(0.46)},{Y(0.73)} C{X(0.47)},{Y(0.83)} {X(0.47)},{Y(0.92)} {X(0.465)},{h}
           M{X(0.55)},{Y(0.73)} C{X(0.545)},{Y(0.83)} {X(0.55)},{Y(0.92)} {X(0.555)},{h}"
        stroke="#FFFFFF" stroke-width="{X(0.012)}" fill="none" opacity="0.8" stroke-linecap="round"/>
  <g fill="#6E6459">
    <path d="M{X(0.30)},{Y(0.74)} L{X(0.40)},{Y(0.72)} L{X(0.41)},{Y(0.80)} L{X(0.28)},{Y(0.81)} Z"/>
    <path d="M{X(0.61)},{Y(0.73)} L{X(0.72)},{Y(0.76)} L{X(0.71)},{Y(0.84)} L{X(0.60)},{Y(0.81)} Z"/>
    <path d="M{X(0.34)},{Y(0.88)} L{X(0.42)},{Y(0.87)} L{X(0.42)},{Y(0.94)} L{X(0.33)},{Y(0.94)} Z"/>
  </g>
  {palm(X(0.13), Y(0.66), X(0.32))}
  {palm(X(0.88), Y(0.68), X(0.32), flip=True)}
  <g fill="{LEAF_DARK}">
    <ellipse cx="{X(0.03)}" cy="{Y(0.95)}" rx="{X(0.30)}" ry="{Y(0.16)}"/>
    <ellipse cx="{X(0.98)}" cy="{Y(0.96)}" rx="{X(0.28)}" ry="{Y(0.15)}"/>
  </g>
  <g fill="{LEAF_MID}" opacity="0.95">
    <ellipse cx="{X(0.14)}" cy="{Y(1.02)}" rx="{X(0.24)}" ry="{Y(0.12)}"/>
    <ellipse cx="{X(0.86)}" cy="{Y(1.03)}" rx="{X(0.24)}" ry="{Y(0.12)}"/>
  </g>
  <rect width="{w}" height="{h}" fill="none" stroke="{PLUM}" stroke-width="5" rx="34" opacity="0.5"/>
</g>"""

def palm(bx, by, size, flip=False):
    """Trunk plus six curved fronds. Straight spokes read as a spider, so each frond is a
    closed curve with a bowed midrib."""
    d = -1 if flip else 1
    fronds = []
    for ang, ln in ((-172, 1.10), (-140, 1.26), (-105, 1.04), (-62, 1.10), (-32, 1.24), (-6, 1.02)):
        fronds.append(f'<g transform="rotate({ang*1.0}) scale({ln:.2f})">'
                      '<path d="M0,0 C0.34,-0.20 0.72,-0.18 1.02,0.04 '
                      'C0.70,0.22 0.30,0.20 0,0 Z"/></g>')
    return (f'<g transform="translate({bx},{by}) scale({d},1)">'
            f'<path d="M0,0 C{-size*0.10},{-size*0.5} {-size*0.04},{-size*0.9} {size*0.06},{-size*1.15}" '
            f'fill="none" stroke="#5A452C" stroke-width="{size*0.09:.2f}" stroke-linecap="round"/>'
            f'<g transform="translate({size*0.06},{-size*1.15}) scale({size*0.60:.2f})" '
            f'fill="{LEAF_LIGHT}" stroke="#17471F" stroke-width="0.035">{"".join(fronds)}</g></g>')

# ---------------------------------------------------------------- assembly
def build():
    p = []
    p.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
    p.append(f'''<defs>
 <linearGradient id="gBg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{ORANGE_HI}"/><stop offset="0.45" stop-color="{ORANGE_MID}"/>
  <stop offset="1" stop-color="{ORANGE_LO}"/>
 </linearGradient>
 <linearGradient id="gMango" x1="0" y1="-0.5" x2="0.3" y2="0.5">
  <stop offset="0" stop-color="#FFE066"/><stop offset="0.55" stop-color="#F7A522"/>
  <stop offset="1" stop-color="#E4671A"/>
 </linearGradient>
 <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#DCEFF0"/><stop offset="1" stop-color="#F2F7E9"/>
 </linearGradient>
 <linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#CFEBF7"/><stop offset="1" stop-color="#8FD0EA"/>
 </linearGradient>
 <clipPath id="clipScene"><rect width="440" height="470" rx="34"/></clipPath>
</defs>''')
    p.append(f'<rect width="{W}" height="{H}" fill="url(#gBg)"/>')
    p.append(f'<g id="bubbles">{bubbles()}</g>')

    # top garland
    p.append('<g id="top-fruit">')
    for x, y, s, r in [(70,150,116,-18),(300,120,104,8),(520,158,120,20),
                       (175,235,84,26),(420,232,88,-24)]:
        p.append(mango(x, y, s, r))
    for x, y, s, r, f in [(150,95,74,-40,LEAF_MID),(232,175,66,30,LEAF_LIGHT),(390,92,72,35,LEAF_MID),
                          (472,205,64,-28,LEAF_LIGHT),(45,258,60,55,LEAF_DARK),(556,262,60,-52,LEAF_DARK),
                          (300,232,58,0,LEAF_LIGHT)]:
        p.append(leaf(x, y, s, r, f))
    p.append('</g>')

    # wordmark + type. Every line is sized BY WIDTH so it cannot overflow the panel.
    sz, tr = fit("TANDA", 448, 0.30)
    p.append(f'<g id="wordmark">{word("TANDA", W/2, 372, sz, tr, [(sz*0.62, CREAM), (sz*0.50, PLUM), (sz*0.34, "#F9AE33")])}</g>')

    sz, tr = fit("SPARKLING JUICE", 356, 0.16)
    p.append(text_layer("SPARKLING JUICE", W/2, 556, sz, tr, CREAM, sz*0.16))

    sz, tr = fit("MANGO", 380, 0.15)
    p.append(word("MANGO", W/2, 620, sz, tr, [(sz*0.34, "#9C2F0B"), (sz*0.24, MANGO_RED)]))

    # scene + side fruit
    p.append(scene(80, 762, 440, 470))
    p.append('<g id="side-fruit">')
    for x, y, sc, r in [(56,842,112,-24),(548,898,116,22),(50,1132,104,30),(552,1168,108,-26)]:
        p.append(mango(x, y, sc, r))
    for x, y, sc, r, f in [(58,972,66,58,LEAF_MID),(544,1032,64,-56,LEAF_MID),
                           (74,1262,62,-18,LEAF_LIGHT),(526,1276,62,20,LEAF_LIGHT)]:
        p.append(leaf(x, y, sc, r, f))
    p.append('</g>')

    # footer. Laid out from measured widths so the volume, the estimated sign and the
    # flag cannot collide -- the first pass overlapped all three.
    p.append('<g id="footer">')
    vsz, vtr = fit("330ml", 150, 0.10)
    esz, etr = fit("e", 30, 0.0)
    vw, ew, gap, flag_w = text_width("330ml", vsz, vtr), text_width("e", esz, etr), 16, 80
    block = vw + gap + ew + 46 + flag_w
    x0 = (W - block) / 2
    p.append(text_layer("330ml", x0 + vw/2, 1352, vsz, vtr, CREAM, vsz*0.17))
    p.append(text_layer("e", x0 + vw + gap + ew/2, 1352, esz, etr, CREAM, esz*0.13))
    p.append(flag(x0 + vw + gap + ew + 46, 1338, flag_w))
    for i, line in enumerate(("TROPICAL TASTE", "AUTHENTIC UGANDAN")):
        sz, tr = fit(line, 300 if i == 0 else 360, 0.16)
        p.append(text_layer(line, W/2, 1444 + i*56, sz, tr, CREAM, sz*0.15))
    p.append('</g>')
    p.append("</svg>")
    return "\n".join(p)

if __name__ == "__main__":
    svg = build()
    f = OUT / "tanda-label.svg"
    f.write_text(svg)
    print(f"{f}  ({len(svg)//1024} KB)")
