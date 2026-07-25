#!/usr/bin/env python3
# Build the "heads up" cap plate by CLONING one of the real gnomes already in the photograph.
#
# Two earlier attempts at inventing these gnomes failed on face quality: FLUX Fill at native
# size (~76x84 px per gnome) came out smudged, and inpainting into a 4x-upscaled crop was
# worse still — the upscale is soft, so the model matched that softness. The photo already
# contains two crisp, real ceramic gnomes, so this lifts one, scales/flips it, and sets it
# peeking over each cap edge. Real photo pixels => sharp faces and a guaranteed style match.
#
# Outputs (all full-frame 560x740 unless noted):
#   scratchpad/caps-up.jpg        heads-up plate  -> video end_image / stills
#   scratchpad/capcrop-plain.png  upscaled cap crop, untouched -> video start_image
#   scratchpad/capcrop-up.png     upscaled cap crop, heads up  -> video end_image
#   scratchpad/capedge.json       per-column cap top edge, for the layer builder's clip
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SPECIES = ROOT / "assets" / "species"
WORK = ROOT / "scratchpad"
ORIG = SPECIES / "psilocybe-cubensis.jpg"
BASE = SPECIES / "psilocybe-cubensis-base.jpg"      # gnomes inpainted away (remove_gnomes.py)

CROP = (190, 130, 470, 320)          # cap region shared with the video + layer builders
UPSCALE = 4
# where each clone goes: (centre x, cap columns to read the edge from, scale, flip)
SPOTS = {3: (268, (236, 304), 1.05, False),
         4: (412, (378, 452), 0.85, True)}
RUN = 40                             # rows of cap needed to accept an edge (rejects rainbow bands)


def cap_edge(img, x0, x1):
    """Topmost row of the cap dome per column: needs a long run of warm orange, so the
    rainbow's orange band (a thin stripe) can't be mistaken for the mushroom."""
    px = img.load()
    def capish(p):
        r, g, b = p
        return (r - g) > 38 and b < 150 and r > 150
    edge = {}
    for x in range(x0, x1):
        e = None
        for y in range(120, img.height - RUN):
            if capish(px[x, y]) and all(capish(px[x, y + k]) for k in range(0, RUN, 4)):
                e = y; break
        edge[x] = e
    # Reject outliers before smoothing. On the dome's flanks the run test can fail and latch
    # onto something far below (the left slope of the big cap reports ~321 instead of ~250),
    # which would silently disable clipping for those columns.
    xs = sorted(edge)
    vals = [edge[x] for x in xs if edge[x] is not None]
    if not vals:
        return {x: img.height for x in xs}
    med = sorted(vals)[len(vals) // 2]
    good = [x for x in xs if edge[x] is not None and abs(edge[x] - med) <= 45]
    if not good:
        return {x: med for x in xs}
    for x in xs:
        if x not in good:                       # linear fit through the nearest good columns
            near = sorted(good, key=lambda k: abs(k - x))[:10]
            if len(near) >= 2:
                n = len(near)
                sx = sum(near); sy = sum(edge[k] for k in near)
                sxx = sum(k * k for k in near); sxy = sum(k * edge[k] for k in near)
                den = n * sxx - sx * sx
                if den:
                    slope = (n * sxy - sx * sy) / den
                    edge[x] = round((sy - slope * sx) / n + slope * x)
                    continue
            edge[x] = edge[near[0]]
    sm = {}
    for x in xs:
        w = [edge[min(max(x + d, xs[0]), xs[-1])] for d in range(-4, 5)]
        sm[x] = sorted(w)[len(w) // 2]
    return sm


# Head-and-shoulders of the source gnome, in PORTRAIT coords: a hat triangle, a head/beard
# ellipse and a shoulder band. Needed because diff(orig, base) alone also lights up the stems
# and moss the inpaint re-rendered inside its box — this confines the cut to the gnome.
HAT = [(373, 558), (355, 590), (386, 590)]
HEAD = (354, 583, 388, 626)
SHOULDERS = (353, 606, 389, 629)


def gnome_sprite(orig, base):
    """The real gnome's own pixels: what the inpainted base removed, confined to its body."""
    d = ImageChops.difference(orig, base).convert("L")
    diff = d.point(lambda v: 255 if v > 30 else 0)

    region = Image.new("L", orig.size, 0)
    rd = ImageDraw.Draw(region)
    rd.polygon(HAT, fill=255)
    rd.ellipse(HEAD, fill=255)
    rd.rectangle(SHOULDERS, fill=255)

    m = ImageChops.multiply(diff, region)
    for _ in range(2):                          # close: fill pinholes inside the gnome
        m = m.filter(ImageFilter.MaxFilter(3))
    for _ in range(2):
        m = m.filter(ImageFilter.MinFilter(3))
    for _ in range(2):                          # open with a wider kernel: drops the thin pale
        m = m.filter(ImageFilter.MinFilter(5))  # stem slivers the diff picked up beside the gnome
    for _ in range(2):
        m = m.filter(ImageFilter.MaxFilter(5))
    m = ImageChops.multiply(m, region)          # morphology can bleed past the region — re-clip

    # The stem sits directly behind the gnome, so it stays connected to the silhouette and no
    # amount of morphology removes it. It is separable by colour though: bright warm tan with a
    # wide green-blue gap. The gnome's beard is neutral (G≈B), its skin and hat are far redder,
    # and its dark clothing fails the brightness test — so none of them match.
    px = orig.load(); mp = m.load()
    for y in range(orig.height):
        for x in range(orig.width):
            if mp[x, y]:
                r, g, b = px[x, y]
                if r > 110 and (r - g) < 50 and (g - b) > 32:
                    mp[x, y] = 0

    # That colour test also punches a few specks out of warm-tan spots on the hat brim and
    # cheek. Refill anything fully enclosed by the silhouette: flood the outside, then whatever
    # is still empty is an interior hole.
    work = m.point(lambda v: 255 if v else 0)
    ImageDraw.floodfill(work, (0, 0), 128, thresh=0)
    wp = work.load()
    for y in range(orig.height):
        for x in range(orig.width):
            if wp[x, y] == 0:
                mp[x, y] = 255
    bb = m.getbbox()
    rgba = orig.convert("RGBA")
    rgba.putalpha(m.filter(ImageFilter.GaussianBlur(0.6)))
    return rgba.crop(bb)


def main():
    orig = Image.open(ORIG).convert("RGB")
    base = Image.open(BASE).convert("RGB")
    sprite = gnome_sprite(orig, base)
    print(f"cloned source gnome: {sprite.size}")

    plate = orig.copy()
    edges = {}
    for n, (cx, (ex0, ex1), scale, flip) in SPOTS.items():
        e = cap_edge(orig, ex0, ex1)
        edges[n] = {"x0": ex0, "x1": ex1, "edge": [e[x] for x in range(ex0, ex1)]}
        s = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))),
                          Image.LANCZOS)
        if flip:
            s = s.transpose(Image.FLIP_LEFT_RIGHT)
        # sit it so the head clears the cap and the body tucks behind it
        edge_at_cx = e.get(cx, min(e.values()))
        x = cx - s.width // 2
        y = edge_at_cx - int(s.height * 0.78)

        # Clip to the cap: anything at or below that column's cap edge is BEHIND the mushroom.
        # Without this the sprite paints over the cap and reads as a gnome sitting on top of it
        # rather than peering over the rim — and it also hides the sprite's flat cut bottom.
        s = s.copy()
        alpha = s.split()[3]          # a COPY of the channel — must be putalpha'd back
        sa = alpha.load()
        for sx in range(s.width):
            col_edge = e.get(x + sx)
            if col_edge is None:
                continue
            for sy in range(s.height):
                if y + sy >= col_edge:
                    sa[sx, sy] = 0
        s.putalpha(alpha)

        p2 = plate.convert("RGBA"); p2.alpha_composite(s, (x, y)); plate = p2.convert("RGB")
        print(f"g{n}: {s.size} at ({x},{y}), cap edge at x={cx} is y={edge_at_cx}")

    plate.save(WORK / "caps-up.jpg", "JPEG", quality=95)
    crop_plain = orig.crop(CROP); crop_up = plate.crop(CROP)
    big = (crop_plain.width * UPSCALE, crop_plain.height * UPSCALE)
    crop_plain.resize(big, Image.LANCZOS).save(WORK / "capcrop-plain.png", "PNG")
    crop_up.resize(big, Image.LANCZOS).save(WORK / "capcrop-up.png", "PNG")
    (WORK / "capedge.json").write_text(json.dumps(edges))
    print("wrote caps-up.jpg, capcrop-plain.png, capcrop-up.png, capedge.json")


if __name__ == "__main__":
    main()
