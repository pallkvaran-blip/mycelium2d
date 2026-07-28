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


def _clip_halfplane(poly, nx, ny, c, keep_pos):
    """Sutherland-Hodgman clip of a convex polygon by the line nx*x + ny*y = c."""
    out = []
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        da = nx * ax + ny * ay - c
        db = nx * bx + ny * by - c
        ina = (da >= 0) if keep_pos else (da <= 0)
        inb = (db >= 0) if keep_pos else (db <= 0)
        if ina:
            out.append((ax, ay))
        if ina != inb:
            t = da / (da - db) if da != db else 0.0
            out.append((ax + (bx - ax) * t, ay + (by - ay) * t))
    return out


def _shatter(poly, depth, rnd):
    """Recursively split a convex polygon with straight cuts — a faceted stone mosaic."""
    if depth <= 0 or len(poly) < 3:
        return [poly]
    th = rnd.uniform(0, math.pi)
    nx, ny = math.cos(th), math.sin(th)
    ds = [nx * x + ny * y for x, y in poly]
    lo, hi = min(ds), max(ds)
    if hi - lo < 1e-6:
        return [poly]
    c = lo + (hi - lo) * rnd.uniform(0.35, 0.65)        # cut near the middle, jittered
    a = _clip_halfplane(poly, nx, ny, c, True)
    b = _clip_halfplane(poly, nx, ny, c, False)
    out = []
    for half in (a, b):
        if len(half) >= 3:
            out += _shatter(half, depth - 1, rnd)
    return out


def facetmap(name, aspect="16:9", depth=5, extra=2, seed=11, invert_axis=False, rough=True):
    """Filled silhouette WITH an internal crack network — the control image that actually works.

    A plain filled silhouette hands canny one big region with no internal edges, so the model
    fills it with a few huge flat polygons; scaled up to span half a map that reads as a close-up
    of a small rock, which is exactly the note we got. This paints the mass white and lays a
    recursive fracture mosaic over it in black, so canny sees a silhouette AND facet boundaries at
    the density we want. `extra` re-splits a random half of the facets so the detail is
    multi-scale (big masses -> facets -> chips) rather than uniform.

    Not to be confused with the earlier failed attempt, which drew a dozen long straight WHITE
    chords on black with no fill: too few, too long and too uniform, so the model drew them as
    literal flat strokes instead of reading them as cracks.
    """
    import random
    rnd = random.Random(seed)
    poly, (W, H) = ring_px(name, aspect, invert_axis)
    if rough:
        poly = roughen(poly, seed=seed)
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    d.polygon(poly, fill=255)
    # Mosaic over the whole frame, then keep only the parts that fall on the rock.
    pad = 8
    rect = [(pad, pad), (W - pad, pad), (W - pad, H - pad), (pad, H - pad)]
    facets = _shatter(rect, depth, rnd)
    facets += [f for fc in facets if rnd.random() < 0.5 for f in _shatter(fc, extra, rnd)]
    inside = _point_tester(poly)
    for f in facets:
        n = len(f)
        for i in range(n):
            ax, ay = f[i]
            bx, by = f[(i + 1) % n]
            # draw only the stretch of this facet edge that lies on the rock
            run = []
            steps = max(2, int(math.hypot(bx - ax, by - ay) / 10))
            for k in range(steps + 1):
                t = k / steps
                p = (ax + (bx - ax) * t, ay + (by - ay) * t)
                if inside(p):
                    run.append(p)
                else:
                    if len(run) > 1:
                        d.line(run, fill=0, width=2)
                    run = []
            if len(run) > 1:
                d.line(run, fill=0, width=2)
    return im


def depthmap(name, aspect="16:9", depth=5, extra=2, seed=11, invert_axis=False, rough=True):
    """Silhouette as a FACETED HEIGHT FIELD — for flux-depth-pro.

    canny turned out to be a pure line tracer: hand it facet lines and it draws flat outlines on
    flat fills (stained glass), so it can impose a silhouette but can never add shaded detail.
    depth-pro reads depth instead of edges, and the reason it failed earlier was that I gave it a
    FLAT white blob with no internal structure, so it treated the shape as "a mass somewhere in the
    middle" and invented a scene. Filling each facet of the fracture mosaic with its own grey gives
    it real internal form to shade, with no lines to trace.

    Brighter = nearer. Background stays 0 so the surround reads as far away and empty.
    """
    import random
    rnd = random.Random(seed)
    poly, (W, H) = ring_px(name, aspect, invert_axis)
    if rough:
        poly = roughen(poly, seed=seed)
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    d.polygon(poly, fill=190)
    pad = 8
    rect = [(pad, pad), (W - pad, pad), (W - pad, H - pad), (pad, H - pad)]
    facets = _shatter(rect, depth, rnd)
    facets += [f for fc in facets if rnd.random() < 0.5 for f in _shatter(fc, extra, rnd)]
    inside = _point_tester(poly)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    layer = Image.new("L", (W, H), 190)
    dl = ImageDraw.Draw(layer)
    for f in facets:
        if len(f) < 3:
            continue
        cx = sum(p[0] for p in f) / len(f); cy = sum(p[1] for p in f) / len(f)
        if not inside((cx, cy)):
            continue
        dl.polygon(f, fill=rnd.randint(140, 235))      # each facet its own height
    layer = layer.filter(ImageFilter.GaussianBlur(3))  # soften so it shades rather than posterises
    im.paste(layer, (0, 0), mask)
    return im


def _point_tester(poly):
    """Even-odd point-in-polygon test, closed over the ring."""
    n = len(poly)

    def inside(pt):
        x, y = pt
        c = False
        j = n - 1
        for i in range(n):
            xi, yi = poly[i]
            xj, yj = poly[j]
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi):
                c = not c
            j = i
        return c
    return inside


if __name__ == "__main__":
    name = sys.argv[1]
    aspect = sys.argv[2] if len(sys.argv) > 2 else "16:9"
    out = sys.argv[3] if len(sys.argv) > 3 else f"scratchpad/sil-{name.lower()}.png"
    im = silhouette(name, aspect)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    im.save(out)
    print(out, im.size)
