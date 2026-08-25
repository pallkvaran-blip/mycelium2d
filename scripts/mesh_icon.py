#!/usr/bin/env python3
# Draw a node-mesh icon DETERMINISTICALLY, in the family's exact palette.
#
# Why this exists: FLUX draws the family's look well for organic, solid subjects (the
# handshake, the location pin) but fights geometric ones. Across three rounds the
# three-way arrow came back either correctly triangulated with the wrong arm directions,
# or with the right directions in thin stipple -- never both. Geometry is exactly what
# code is good at, so the silhouette is drawn as polygons and the mesh is built over it:
# a jittered triangular lattice inside the shape plus resampled contour points, Delaunay
# triangulated, with triangles outside the (concave) silhouette discarded.
#
#   python3 scripts/mesh_icon.py flexibility            # -> assets/node_icon_options/finals/
#   python3 scripts/mesh_icon.py flexibility --density 34 --slug flex-nodes-arrows-fine
import sys, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import Delaunay

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "node_icon_options" / "finals"
OUT.mkdir(parents=True, exist_ok=True)

# Same palette as node_icon_finalize.py, sampled from the owner's reference image.
BG   = (6, 42, 87)
INK  = (124, 155, 190)
LINK = (86, 116, 152)      # links sit a touch back from the dots, as in the reference
SS   = 3                   # supersample factor; downsampled at the end for clean edges
SIZES = (1024, 512, 256, 128, 64)

def arrow_poly(tip, ang, length, half_w, head_w, head_len):
    """A band of half-width half_w running from `tip` back along `ang`, ending in a head."""
    ca, sa = math.cos(ang), math.sin(ang)
    px, py = -sa, ca                                   # perpendicular
    def P(d, o): return (tip[0] - ca*d + px*o, tip[1] - sa*d + py*o)
    return [tip, P(head_len,  head_w), P(head_len,  half_w), P(length,  half_w),
                 P(length,  -half_w), P(head_len, -half_w), P(head_len, -head_w)]

def quad(p0, p1, p2, n=64):
    """Quadratic Bezier, sampled."""
    return [((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t*t*p2[0],
             (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t*t*p2[1])
            for t in (i/(n-1) for i in range(n))]

def band(path, hw):
    """Offset a path by +/- hw along its normals to make a solid band polygon."""
    left, right = [], []
    for i, (x, y) in enumerate(path):
        j = min(i+1, len(path)-1); k = max(i-1, 0)
        dx, dy = path[j][0]-path[k][0], path[j][1]-path[k][1]
        n = math.hypot(dx, dy) or 1.0
        px, py = -dy/n*hw, dx/n*hw
        left.append((x+px, y+py)); right.append((x-px, y-py))
    return left + right[::-1]

def trim(path, d):
    """Drop the last `d` of arc length from a path. The band is trimmed by the head
    length so the arrowhead sits BEYOND the band instead of overlapping it -- overlapping
    merges the two into a blob and the arrow stops reading."""
    out, acc = list(path), 0.0
    while len(out) > 2:
        seg = math.hypot(out[-1][0]-out[-2][0], out[-1][1]-out[-2][1])
        if acc + seg > d: break
        acc += seg; out.pop()
    return out

def head(path, hw_head, ln):
    """Arrowhead at the end of a path, square to its final tangent."""
    (x, y) = path[-1]; (xp, yp) = path[-min(6, len(path))]
    dx, dy = x-xp, y-yp; n = math.hypot(dx, dy) or 1.0
    ux, uy = dx/n, dy/n; px, py = -uy, ux
    b = (x - ux*ln, y - uy*ln)
    return [(x, y), (b[0]+px*hw_head, b[1]+py*hw_head), (b[0]-px*hw_head, b[1]-py*hw_head)]

def flexibility_shape(S):
    """Three-way arrow meaning flexibility: one stem rising from the bottom that fans into
    three straight arrows -- UP, UP-LEFT and UP-RIGHT.

    Two geometries were tried and rejected first. Arms curving out horizontally (closest
    to the owner's reference) read as a branching plant once meshed, because the mesh
    softens the elbows. Straight left/right arms read as a plus sign. A symmetric fan is
    unmistakably three directions and stays clean at icon size. Bands are wide so the mesh
    has a body to fill, and each band is trimmed by the head length so the arrowhead sits
    beyond it rather than merging into a blob."""
    w, hw, hl = S*0.070, S*0.150, S*0.155
    c, fork = S*0.50, S*0.615
    arms = [
        [(c, S*0.955), (c, S*0.130)],                    # stem + up arrow, one straight run
        [(c, fork), (S*0.845, S*0.255)],                 # up-right
        [(c, fork), (S*0.155, S*0.255)],                 # up-left
    ]
    return [poly for path in arms
                 for poly in (band(trim(path, hl*0.90), w), head(path, hw, hl))]

def trident_shape(S):
    """The composition the owner picked out of the renders: a stem rising from the bottom
    that divides into an UP arm and two arms curving outward AND upward, heads pointing up
    and out at roughly 45 degrees.

    Note this is the curved-arm geometry rejected in flexibility_shape -- the difference is
    where the arms END. Arms flattening to HORIZONTAL read as a branching plant; arms still
    climbing as they leave read as a trident, which is what the renders found and the owner
    chose. Bands stay wide enough for a few triangles across, since the render's own thin
    arms are exactly why it came back as stipple and missed the set."""
    # Proportions follow the render the owner picked: slender bands, a long stem, arms
    # leaving it high and sweeping out, and modest heads. An earlier pass with wider
    # spread and chunkier heads read stubby beside it.
    w, hw, hl = S*0.058, S*0.122, S*0.132
    c = S*0.50
    up    = [(c, S*0.960), (c, S*0.120)]
    right = quad((c, S*0.690), (S*0.700, S*0.520), (S*0.800, S*0.278))
    left  = quad((c, S*0.690), (S*0.300, S*0.520), (S*0.200, S*0.278))
    return [poly for path in (up, right, left)
                 for poly in (band(trim(path, hl*0.90), w), head(path, hw, hl))]

SHAPES = {"flexibility": flexibility_shape, "trident": trident_shape}

def build_mask(shape, S):
    m = Image.new("L", (S, S), 0); d = ImageDraw.Draw(m)
    for poly in shape(S): d.polygon([(float(x), float(y)) for x, y in poly], fill=255)
    return m

def contour_points(mask, step):
    """Resample the silhouette edge so the outline reads as a line of dots, as the
    picked handshake and pin both do."""
    a = np.asarray(mask) > 127
    edge = a & ~(
        np.pad(a[1:, :], ((0,1),(0,0))) & np.pad(a[:-1, :], ((1,0),(0,0))) &
        np.pad(a[:, 1:], ((0,0),(0,1))) & np.pad(a[:, :-1], ((0,0),(1,0))))
    ys, xs = np.nonzero(edge)
    pts = np.stack([xs, ys], 1).astype(float)
    if len(pts) == 0: return pts
    keep, taken = [], np.zeros(len(pts), bool)      # greedy thinning to ~`step` spacing
    order = np.argsort(np.arctan2(pts[:,1]-pts[:,1].mean(), pts[:,0]-pts[:,0].mean()))
    for i in order:
        if taken[i]: continue
        keep.append(pts[i])
        taken |= (np.hypot(pts[:,0]-pts[i,0], pts[:,1]-pts[i,1]) < step)
    return np.array(keep)

def lattice_points(mask, step, rng, inset):
    """Jittered triangular lattice clipped to the shape, inset so interior dots don't
    crowd the contour dots."""
    a = np.asarray(mask) > 127
    S = a.shape[0]; pts = []
    rows = int(S/(step*math.sqrt(3)/2)) + 2
    for r in range(rows):
        y = r*step*math.sqrt(3)/2
        off = (step/2) if r % 2 else 0.0
        for cix in range(int(S/step)+2):
            x = cix*step + off
            x += rng.uniform(-step*0.30, step*0.30); y2 = y + rng.uniform(-step*0.30, step*0.30)
            xi, yi = int(round(x)), int(round(y2))
            if not (inset <= xi < S-inset and inset <= yi < S-inset): continue
            if not a[yi, xi]: continue
            # drop points sitting right on the rim; the contour ring covers that band
            y0, y1 = max(0,yi-inset), min(S,yi+inset+1)
            x0, x1 = max(0,xi-inset), min(S,xi+inset+1)
            if not a[y0:y1, x0:x1].all(): continue
            pts.append((x, y2))
    return np.array(pts) if pts else np.zeros((0,2))

def render(name, density=26, seed=7, slug=None):
    S = 1024*SS
    rng = np.random.default_rng(seed)
    mask = build_mask(SHAPES[name], S)
    step = S/density
    pts = np.vstack([p for p in (contour_points(mask, step*0.62),
                                 lattice_points(mask, step, rng, int(step*0.42))) if len(p)])
    tri = Delaunay(pts)
    a = np.asarray(mask) > 127
    edges, maxlen = set(), step*1.9
    for s in tri.simplices:
        cx, cy = pts[s,0].mean(), pts[s,1].mean()
        if not a[min(S-1,max(0,int(cy))), min(S-1,max(0,int(cx)))]: continue   # concave shape
        for i in range(3):
            u, v = sorted((s[i], s[(i+1)%3]))
            if math.hypot(*(pts[u]-pts[v])) <= maxlen: edges.add((u, v))

    im = Image.new("RGB", (S, S), BG); dr = ImageDraw.Draw(im)
    for u, v in edges:
        dr.line([tuple(pts[u]), tuple(pts[v])], fill=LINK, width=max(1, int(SS*0.9)))
    for i, (x, y) in enumerate(pts):
        r = step*(0.040 + 0.105*rng.random()**1.6)       # assorted sizes, as in the reference
        dr.ellipse([x-r, y-r, x+r, y+r], fill=INK)

    slug = slug or f"{name[:4]}-nodes-arrows"
    base = im.resize((1024,1024), Image.LANCZOS)
    made = []
    for sz in SIZES:
        f = OUT/f"{slug}-{sz}.png"; base.resize((sz,sz), Image.LANCZOS).save(f,"PNG"); made.append(f)
        rgba = np.zeros((sz,sz,4), np.uint8)
        arr = np.asarray(base.resize((sz,sz), Image.LANCZOS), dtype=np.float32)
        lum = arr.mean(2); bgl = float(np.mean(np.array(BG)))
        t = np.clip((lum-bgl)/(255-bgl), 0, 1)
        rgba[:,:,0:3] = np.array(INK, np.uint8); rgba[:,:,3] = (t*255).astype(np.uint8)
        fa = OUT/f"{slug}-{sz}-alpha.png"; Image.fromarray(rgba,"RGBA").save(fa,"PNG"); made.append(fa)
    print(f"{slug}: {len(pts)} nodes, {len(edges)} links")
    return made

if __name__ == "__main__":
    name = sys.argv[1]
    kw = {}
    if "--density" in sys.argv: kw["density"] = int(sys.argv[sys.argv.index("--density")+1])
    if "--seed"    in sys.argv: kw["seed"]    = int(sys.argv[sys.argv.index("--seed")+1])
    if "--slug"    in sys.argv: kw["slug"]    = sys.argv[sys.argv.index("--slug")+1]
    render(name, **kw)
