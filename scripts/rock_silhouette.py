#!/usr/bin/env python3
"""Country outlines -> control-image silhouettes for the rockform generator.

Why this exists: two full batches proved prose cannot deliver an irregular silhouette AND the
shipped rock style at the same time. Naming a country as the subject ("the silhouette of NORWAY")
got the shapes and drew six MAPS — no slate, no glow, white grounds, map markers. Demoting it to a
clause about the rock's edge got the style back and lost the shapes completely. So the shape stops
being a prompt and becomes a CONTROL IMAGE: flux-fill-pro / flux-depth-pro take the silhouette,
the text prompt only has to carry the style.

Geometry is Natural Earth 110m admin-0 (PUBLIC DOMAIN, so no licence question — and nothing from
the dataset reaches the game anyway; only the outline shape guides a render).

  python3 scripts/rock_silhouette.py Norway 16:9 out.png
"""
import json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "scratchpad" / "ne110.geojson"
GEO_URL = ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
           "ne_110m_admin_0_countries.geojson")
ASPECTS = {"21:9": (1792, 768), "16:9": (1600, 900), "3:2": (1536, 1024),
           "4:3": (1440, 1080), "1:1": (1280, 1280)}
MARGIN = 0.09      # keep the shape well clear of the frame: the cut samples a border ring, and a
                   # silhouette touching the edge is a clipped silhouette


def rings(name):
    """Every outer ring of a country, in lon/lat."""
    if not GEO.exists():
        sys.exit(f"missing {GEO} — curl --cacert /root/.ccr/ca-bundle.crt -o {GEO} {GEO_URL}")
    data = json.loads(GEO.read_text())
    for f in data["features"]:
        p = f["properties"]
        if name.lower() in (str(p.get("NAME", "")).lower(), str(p.get("NAME_LONG", "")).lower()):
            g = f["geometry"]
            polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
            return [poly[0] for poly in polys]
    sys.exit(f"country not found: {name}")


def _area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2


def biggest_ring(name):
    """The mainland only. Islands would make the sprite several disconnected objects."""
    return max(rings(name), key=_area)


def to_xy(ring):
    """Equirectangular with a cos(lat) correction, so the shape reads the familiar way."""
    lat0 = sum(p[1] for p in ring) / len(ring)
    k = math.cos(math.radians(lat0))
    return [(p[0] * k, -p[1]) for p in ring]          # negate lat: image y grows downward


def align(pts):
    """Rotate the principal axis horizontal — longest across the frame, best for a half-map rock."""
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    q = [(x - cx, y - cy) for x, y in pts]
    sxx = sum(x * x for x, _ in q); syy = sum(y * y for _, y in q)
    sxy = sum(x * y for x, y in q)
    th = 0.5 * math.atan2(2 * sxy, sxx - syy)          # principal axis angle
    c, s = math.cos(-th), math.sin(-th)
    return [(x * c - y * s, x * s + y * c) for x, y in q]


def silhouette(name, aspect="16:9", blur=6, invert_axis=False):
    """White filled mainland on black, centred with a margin, at the render's output size."""
    W, H = ASPECTS[aspect]
    pts = align(to_xy(biggest_ring(name)))
    if invert_axis:                                    # stand it up instead of laying it down
        pts = [(y, x) for x, y in pts]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    w = max(xs) - min(xs) or 1.0
    h = max(ys) - min(ys) or 1.0
    s = min(W * (1 - 2 * MARGIN) / w, H * (1 - 2 * MARGIN) / h)
    ox = (W - w * s) / 2 - min(xs) * s
    oy = (H - h * s) / 2 - min(ys) * s
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).polygon([(x * s + ox, y * s + oy) for x, y in pts], fill=255)
    # A little blur: a hard-edged binary mask reads as a cut-out decal, a soft one lets the model
    # break the edge into facets of its own.
    return im.filter(ImageFilter.GaussianBlur(blur)) if blur else im


def ring_px(name, aspect="16:9", invert_axis=False):
    """The mainland ring in pixel coordinates, aligned and fitted to the frame."""
    W, H = ASPECTS[aspect]
    pts = align(to_xy(biggest_ring(name)))
    if invert_axis:
        pts = [(y, x) for x, y in pts]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    w = max(xs) - min(xs) or 1.0
    h = max(ys) - min(ys) or 1.0
    s = min(W * (1 - 2 * MARGIN) / w, H * (1 - 2 * MARGIN) / h)
    ox = (W - w * s) / 2 - min(xs) * s
    oy = (H - h * s) / 2 - min(ys) * s
    return [(x * s + ox, y * s + oy) for x, y in pts], (W, H)


def roughen(poly, step=16, amp=7.0, seed=11):
    """Subdivide and jitter the outline so it reads as BROKEN ROCK, not a polygon.

    Natural Earth at 110m is coarse and straight-edged; traced literally by canny it comes back
    looking like a cut gemstone. Jittering perpendicular to each edge adds the small-scale
    raggedness the owner is asking for, on top of the country's large-scale irregularity.
    """
    import random
    rnd = random.Random(seed)
    out = []
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        d = math.hypot(bx - ax, by - ay)
        k = max(1, int(d / step))
        nx, ny = (-(by - ay) / (d or 1), (bx - ax) / (d or 1))     # edge normal
        for j in range(k):
            t = j / k
            o = rnd.uniform(-amp, amp) if j else 0.0               # keep the real vertices exact
            out.append((ax + (bx - ax) * t + nx * o, ay + (by - ay) * t + ny * o))
    return out


def edgemap(name, aspect="16:9", rough=True, width=5, seed=11, invert_axis=False):
    """White outline on black — a canny control image.

    Outline ONLY: a first test also drew internal chords hoping to guide the facets, and
    flux-canny-pro reproduced them literally as flat black strokes over flat colour, killing the
    cel shading. Left free, the model paints its own facets inside the boundary.
    """
    poly, (W, H) = ring_px(name, aspect, invert_axis)
    if rough:
        poly = roughen(poly, seed=seed)
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).line(poly + [poly[0]], fill=255, width=width)
    return im


if __name__ == "__main__":
    name = sys.argv[1]
    aspect = sys.argv[2] if len(sys.argv) > 2 else "16:9"
    out = sys.argv[3] if len(sys.argv) > 3 else f"scratchpad/sil-{name.lower()}.png"
    im = silhouette(name, aspect)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    print(out, im.size)
