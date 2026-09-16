#!/usr/bin/env python3
# "Choose growth vs protect the status quo", drawn in the networked-nodes style on white.
#
# The mesh is not decoration here -- it carries the argument. The LEFT side is an irregular,
# sprawling network whose edges wander: many possible futures, unevenly connected. The RIGHT
# side is a strict regular lattice: predictable, every cell the same. The decision sits where
# the figure was, as a single dense hub both sides connect back to.
#
#   python3 scripts/gen_nodes_diagram.py
import math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial import Delaunay

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from wordmark_proof import fetch, Face
OUT = ROOT / "assets" / "diagram_options"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1600, 700
LINK   = "#BCCBD9"      # structural links, quiet so labels stay on top
NODE   = "#7C95B2"
TEAL   = "#1B7F76"      # the source colour-codes outcomes: teal positive...
AMBER  = "#C4651A"      # ...amber negative. Worth keeping, it is the only semantics there.
DARK   = "#22364B"
GREY   = "#6C7C8C"
GHOST  = "#CBE2DF"      # the big question mark, behind everything

LABELS_L = [  # (text, x, y, colour)
    ("COMPETITION",       298, 112, AMBER), ("INDUSTRIALIZATION", 232, 172, TEAL),
    ("PROSPERITY",         88, 236, TEAL),  ("CONFLICT",          108, 300, AMBER),
    ("PEACE",             152, 362, TEAL),  ("SECURITY",          136, 422, TEAL),
    ("JOBS",              372, 418, TEAL),  ("TRANSFORMATION",     84, 482, TEAL),
    ("INFIGHTING",        338, 480, AMBER), ("DISAPPOINTMENT",    134, 546, AMBER),
]

def rng(seed=11):
    s = seed
    def r():
        nonlocal s
        s = (1103515245 * s + 12345) % (1 << 31)
        return s / (1 << 31)
    return r

# ---------------------------------------------------------------- meshing
def delaunay_edges(pts, inside=None, max_edge=None):
    """Triangulate, then drop triangles whose centroid falls outside the shape and edges
    longer than max_edge -- without both, a concave form gets bridged straight across."""
    if len(pts) < 4: return set()
    tri = Delaunay(pts)
    edges = set()
    for s in tri.simplices:
        if inside is not None and not inside(pts[s, 0].mean(), pts[s, 1].mean()):
            continue
        for i in range(3):
            u, v = sorted((int(s[i]), int(s[(i + 1) % 3])))
            if max_edge is None or math.hypot(*(pts[u] - pts[v])) <= max_edge:
                edges.add((u, v))
    return edges

def mask_mesh(mask, step, jitter=0.30, seed=5):
    """Jittered triangular lattice clipped to a raster mask, plus its outline, triangulated."""
    a = np.asarray(mask) > 127
    Hm, Wm = a.shape
    r = rng(seed)
    pts = []
    rows = int(Hm / (step * math.sqrt(3) / 2)) + 2
    for row in range(rows):
        y = row * step * math.sqrt(3) / 2
        off = step / 2 if row % 2 else 0
        for c in range(int(Wm / step) + 2):
            x = c * step + off + (r() - .5) * 2 * step * jitter
            yy = y + (r() - .5) * 2 * step * jitter
            xi, yi = int(round(x)), int(round(yy))
            if 0 <= xi < Wm and 0 <= yi < Hm and a[yi, xi]:
                pts.append((x, yy))
    if len(pts) < 4: return np.zeros((0, 2)), set()
    pts = np.array(pts)
    ins = lambda x, y: 0 <= int(y) < Hm and 0 <= int(x) < Wm and a[int(y), int(x)]
    return pts, delaunay_edges(pts, ins, step * 1.85)

def glyph_mask(ch, px, font_path):
    f = ImageFont.truetype(str(font_path), px)
    box = f.getbbox(ch)
    im = Image.new("L", (box[2] - box[0] + 8, box[3] - box[1] + 8), 0)
    ImageDraw.Draw(im).text((4 - box[0], 4 - box[1]), ch, font=f, fill=255)
    return im

def anchor_mask(w=280, h=310):
    """Anchor: ring, shank, crossbar, and a swept arc with two flukes."""
    im = Image.new("L", (w, h), 0); d = ImageDraw.Draw(im)
    cx, t = w // 2, 30
    d.ellipse([cx - 40, 6, cx + 40, 86], outline=255, width=t)
    d.rectangle([cx - t // 2, 60, cx + t // 2, h - 48], fill=255)
    d.rectangle([cx - 96, 108, cx + 96, 108 + t], fill=255)
    d.arc([cx - 112, h - 212, cx + 112, h - 10], start=15, end=165, fill=255, width=t)
    for sx in (-1, 1):
        d.polygon([(cx + sx * 112, h - 118), (cx + sx * 162, h - 158),
                   (cx + sx * 116, h - 56)], fill=255)
    return im

# ---------------------------------------------------------------- svg emit
def draw_mesh(pts, edges, node_col, link_col, rmin=2.2, rmax=4.6, seed=3, dx=0, dy=0, op=1.0):
    r = rng(seed)
    o = [f'<g opacity="{op}">', f'<g stroke="{link_col}" stroke-width="1.15" fill="none">']
    o += [f'<path d="M{pts[u][0]+dx:.1f},{pts[u][1]+dy:.1f}L{pts[v][0]+dx:.1f},{pts[v][1]+dy:.1f}"/>'
          for u, v in edges]
    o.append("</g>")
    o.append(f'<g fill="{node_col}">')
    o += [f'<circle cx="{x+dx:.1f}" cy="{y+dy:.1f}" r="{rmin + (rmax-rmin)*r()**1.7:.2f}"/>'
          for x, y in pts]
    o += ["</g>", "</g>"]
    return "\n".join(o)

def text(face, s, x, y, size, colour, anchor="start", tracking=0, halo=0):
    glyphs, adv = face.word(s, tracking)
    w = adv * size / face.upem
    if anchor == "middle": x -= w / 2
    elif anchor == "end":  x -= w
    sc = size / face.upem
    body = "".join(f'<path d="{d}" transform="translate({gx},0)"/>' for d, gx in glyphs)
    tf = f'transform="translate({x:.1f},{y:.1f}) scale({sc:.5f},{-sc:.5f})"'
    out = ""
    if halo:   # knocks the mesh back behind the letterforms
        out += (f'<g {tf} fill="#FFFFFF" stroke="#FFFFFF" stroke-width="{halo/sc:.1f}" '
                f'stroke-linejoin="round">{body}</g>')
    return out + f'<g {tf} fill="{colour}">{body}</g>', w

def arrow(x1, y, x2, colour, head=17):
    d = 1 if x2 > x1 else -1
    xs = x2 - d * head
    return (f'<g stroke="{colour}" stroke-width="3.4" fill="none" stroke-linecap="round">'
            f'<path d="M{x1},{y}L{xs},{y}"/></g>'
            f'<path d="M{x2},{y}L{xs},{y-9.5}L{xs},{y+9.5}Z" fill="{colour}"/>')

# ---------------------------------------------------------------- assembly
def build():
    bold = Face(fetch("Inter", 700))
    reg  = Face(fetch("Inter", 400))
    bold_ttf = fetch("Inter", 700)
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
         f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>']

    # ---- LEFT: irregular sprawl. Density falls off from the centre and edges are capped,
    # so the network frays at its rim -- unevenly connected, which is the whole point.
    r = rng(31)
    pts = [(x, y) for _, x, y, _ in LABELS_L]
    cxl, cyl, rx, ry = 285, 340, 292, 268
    while len(pts) < 190:
        a, rad = r() * 2 * math.pi, r() ** 0.62
        x, y = cxl + math.cos(a) * rad * rx, cyl + math.sin(a) * rad * ry
        if 40 < x < 560 and 60 < y < 640: pts.append((x, y))
    pts = np.array(pts)
    edges = delaunay_edges(pts, max_edge=96)
    o.append(draw_mesh(pts, edges, NODE, LINK, 2.0, 4.2, seed=7))

    # ---- RIGHT: strict regular lattice. No jitter, uniform edges, every cell identical.
    step = 34
    lp = []
    for row in range(13):
        y = 236 + row * step * math.sqrt(3) / 2
        off = step / 2 if row % 2 else 0
        for c in range(10):
            x = 1238 + c * step + off
            if x <= 1536: lp.append((x, y))
    lp = np.array(lp)
    le = delaunay_edges(lp, max_edge=step * 1.15)
    o.append(draw_mesh(lp, le, "#9FB4C8", "#D5E0EA", 2.6, 2.6, seed=2, op=0.85))

    # anchor, meshed, over the lattice
    am = anchor_mask()
    ap, ae = mask_mesh(am, 13, jitter=0.14, seed=13)
    o.append(draw_mesh(ap, ae, TEAL, "#7FBDB6", 2.2, 3.8, seed=4,
                       dx=1387 - am.width / 2, dy=452 - am.height / 2))

    # ---- centre hub, where the figure was: one dense knot both sides answer to
    hp = []
    rh = rng(5)
    for _ in range(26):
        a, rad = rh() * 2 * math.pi, rh() ** 0.5 * 52
        hp.append((800 + math.cos(a) * rad, 356 + math.sin(a) * rad * 0.95))
    hp = np.array(hp)
    o.append(draw_mesh(hp, delaunay_edges(hp, max_edge=60), DARK, "#8FA4B8", 2.6, 5.4, seed=6))
    o.append(f'<circle cx="800" cy="356" r="9" fill="{DARK}"/>')

    # ---- the open question, meshed, in the clear space above the growth arrow
    qm = glyph_mask("?", 240, bold_ttf)
    qp, qe = mask_mesh(qm, 8.5, jitter=0.16, seed=21)
    o.append(draw_mesh(qp, qe, "#3E9B92", "#9BCFC9", 2.2, 3.6, seed=9,
                       dx=650 - qm.width / 2, dy=172 - qm.height / 2))

    # ---- arrows + their labels
    o.append(arrow(736, 356, 600, DARK))
    o.append(arrow(864, 356, 1200, DARK))
    t, _ = text(bold, "CHOOSE GROWTH", 655, 322, 21, DARK, "middle", 40, halo=5); o.append(t)
    t, _ = text(bold, "PROTECT STATUS QUO", 1045, 322, 21, DARK, "middle", 40, halo=5); o.append(t)

    # ---- labels: each sits on its own larger node, colour-coded as in the source
    for s, x, y, col in LABELS_L:
        o.append(f'<circle cx="{x}" cy="{y}" r="7.5" fill="{col}"/>')
        o.append(f'<circle cx="{x}" cy="{y}" r="13" fill="none" stroke="{col}" '
                 f'stroke-width="1.6" opacity="0.45"/>')
        t, _ = text(bold, s, x + 22, y + 7, 20, col, tracking=18, halo=5); o.append(t)

    # ---- right-hand block copy
    t, _ = text(bold, "CERTAINTY", 1387, 190, 42, TEAL, "middle", 30, halo=6); o.append(t)
    for i, ln in enumerate(("PREDICTABLE OUTCOMES,", "LIMITED CHANGE")):
        t, _ = text(reg, ln, 1387, 214 + i * 22, 15, GREY, "middle", 60, halo=5); o.append(t)
    o.append("</svg>")
    return "\n".join(o)

if __name__ == "__main__":
    f = OUT / "growth-vs-certainty.svg"
    f.write_text(build())
    print(f"{f}  {f.stat().st_size//1024}KB")
