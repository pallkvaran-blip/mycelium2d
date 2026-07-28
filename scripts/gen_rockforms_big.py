#!/usr/bin/env python3
"""BIG rock formations — Replicate renders only, NO cutting/toning.

The owner's brief for this run: lots of new rockform sprites, "mostly large ones I can lay over
up to half of the map", irregular silhouettes, on-theme, 2D side-on platformer style matching the
shipped rockform1-14, and — the hard rule — NO TOP AND NO BOTTOM, because these sit INSIDE the
soil in cross-section and the level editor rotates them freely. Six options at a time; nothing is
cut or feathered here (that happens in one pass at the end via rock_cut.py once ~60 are picked).

Everything the earlier batches learned the hard way is preserved:
  * order is SHAPE -> STYLE -> constraints (constraints first loses the look)
  * describe geometry ONLY. Naming a letter or a man-made analogue ("tuning fork", "bridge")
    makes FLUX draw typography or a whole SCENE, which no cutout can rescue
  * "glowing veins/crystals" reads as LAVA unless the warm colours are refused by name
  * spell the background out as pure flat black — an unkeyable render is a wasted render
  * a big mass must not touch the frame edge or the cut clips its silhouette (and rock_cut's
    border_median samples exactly that ring)

New for this run: LARGE, so the brief asks for many facets and several glow pockets. A sprite
stretched over half the map with five facets reads as an empty blob.

Usage:  python3 scripts/gen_rockforms_big.py <theme> <batch>   # e.g. crystal 1
        python3 scripts/gen_rockforms_big.py crystal 1 massif reef   # re-roll named briefs only
"""
import os, sys, json, time, subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
MODEL = "black-forest-labs/flux-1.1-pro-ultra"
KEEP_LONG = 1600          # committed copy's long side: 2.5x the 640px finals, ~1/6 the bytes of raw

# ---------------------------------------------------------------------------------------------
# STYLE per theme — transcribed from the SHIPPED sprites so new rocks sit beside them:
#   crystal = rockform3/7/13/14   ember = rockform2/6/9/12   fungal = rockform4/8/11
#   veined  = rockform1/5 (verbatim from the batch-1 block that landed)
# ---------------------------------------------------------------------------------------------
# ROUND 1 (seed 2255) failed all six, every one the same three ways, and the causes are worth
# keeping written down because they are the opposite of what the old script's comments imply:
#
#   1. ALL SIX CAME BACK ORANGE LAVA with no crystals at all, despite a twelve-item refusal
#      naming lava/magma/molten/fire/embers. FLUX has no true negative prompt — the refusal list
#      FEEDS those tokens to the same encoder as the positives. Worse, round 1's size clause asked
#      for "glowing pockets" plus "secondary cracks": glowing cracks across a big stone face IS
#      the lava-cliff prior, so the prompt argued for lava with one hand and against it with the
#      other. Fix: refuse in ONE short cool-palette clause that never says the warm words, and
#      anchor the colour POSITIVELY on "amethyst geode" — a concept that carries violet natively
#      and has no lava reading.
#   2. GROUND PLANES on all six (sand floor, dirt floor, molten lake, scree skirt). Same reason:
#      the long no-ground list is mostly the word "ground". Fix: state isolation positively —
#      floating in empty black, black visible underneath it too.
#   3. LANDSCAPES, not sprites. The shape briefs were the culprit as much as the aspect: massif,
#      reef, bank, ridge, spine are LANDSCAPE FEATURES, and "an IMMENSE rock mass" at 21:9 is a
#      literal landscape brief. Fix: object nouns only (slab, shard, chunk, splinter, lump), drop
#      "immense/colossal" altogether, cap the aspect at 16:9.
#      Size in-game is world-space width in the editor, not render scale — what a half-map rock
#      actually needs is an interesting elongated outline and dense facet detail, both of which
#      can be asked for without ever invoking scale.
#   Also: "the whole rock is inside the picture" put a white photo border on `slab`. No frame or
#   picture words anywhere.
# ROUND 2 (seed 7710) fixed all three of round 1's failures — no ground, no landscape, isolated
# single objects on black — and broke two new things:
#
#   4. Every one came back a 3D-RENDERED PEBBLE: smooth shading, a lit top face and a dark
#      underside, three-quarter view. That is the top/bottom problem itself, and it traces to one
#      phrase of mine — "a cut-out sprite from a 2D game's asset sheet". Asset-store rock icons
#      are overwhelmingly 3D renders, so that wording summons the mobile-icon prior and outvotes
#      "flat 2D" sitting earlier in the prompt. "A closed shape ... including underneath" pushed
#      the same way, by describing a solid. Fix: never say sprite/asset/icon; say "a rock
#      FORMATION seen straight from the SIDE", and refuse 3D shading in the terms that produce it
#      (gradients, ambient occlusion, specular).
#   5. The amethyst geodes vanished completely. Burying the hollows in the style block and asking
#      for "glowing details at three or four places" was too vague to survive. Fix: name the
#      geodes in the SHAPE brief, where they get positional weight.
#   Also: dropping "immense" (fix 3) overcorrected into pebbles. "Formation" plus "massive" is the
#   safe middle — it was the landscape NOUNS and 21:9 that made round 1 a landscape, not scale.
FLAT2D = ("FLAT 2D vector game art, hand-painted cel-shaded, solid flat areas of colour separated "
          "by hard-edged dark crack lines, crisp clean edges, LOW detail, matte. NO 3D rendering, "
          "NO smooth gradients, NO ambient occlusion, NO glossy specular highlights, NO photoreal "
          "texture, NO grain, NO film noise. ")
TAIL = ("Bioluminescent deep-underground feel, cool and dim. "
        "No text, no watermark, no border, no characters")
#   6. ROUND 3 (seed 3140) got the geodes back but the whole STONE turned lavender, and the view
#      was still three-quarter with a lit top face. Two more fixes:
#      - Colour bleed: "amethyst" twice plus a refuse clause reading "cool scheme throughout —
#        slate stone, VIOLET, PURPLE and ice blue" licensed purple everywhere. The refuse clause
#        now names no hue at all, and the style says outright that the violet is confined to the
#        cavities and the stone stays dark.
#      - Perspective: "flat orthographic side elevation" is not strong enough against the stock
#        "geode opened from above" image, whose cavities are ellipses viewed from over the top.
#        What the shipped sprites actually are is a CROSS-SECTION, so ask for that, state the
#        camera geometrically ("no top surface visible, no underside visible" == a front view,
#        which FLUX handles far better than negating an object), and say the cavities are seen
#        EDGE-ON as holes in the rock's face.
# Repeated because it is the single thing that decides whether the render is usable.
VIEW = ("A single large rock FORMATION drawn as a flat CROSS-SECTION seen dead-on from the SIDE at "
        "eye level, perfectly perpendicular with ZERO perspective: no top surface visible and no "
        "underside visible, the way rock is drawn in a 2D side-scrolling video game. Built of big "
        "flat angular facets. ")

THEMES = {
    "crystal": dict(
        ref="rockform7",
        feature=("with two or three ragged crystal cavities broken into its side, each seen edge-on "
                 "and packed with a cluster of glowing violet and ice-blue crystal points"),
        style=FLAT2D + VIEW + (
            "The stone is DARK desaturated charcoal NAVY BLUE-GREY, dim and almost black, with "
            "slightly paler cool grey facet faces. Cavities are broken into it, each seen EDGE-ON "
            "as a ragged hole in the rock's face, ringed by a darker rim and lined with a dense "
            "cluster of glowing VIOLET and pale ICE-BLUE crystal points fanning outwards, "
            "spilling violet light onto the rim. The stone itself STAYS DARK BLUE-GREY throughout "
            "— the violet colour appears ONLY inside the cavities and in a few small crystals on "
            "the rock face; the body of the rock is never purple or lavender. ") + TAIL,
        refuse=("Strictly a COOL, dim, desaturated palette. No warm hues anywhere in the image"),
    ),
    "ember": dict(
        ref="rockform2",
        feature=("with thick glowing orange seams running deep through its fissures"),
        style=FLAT2D + VIEW + (
            "The stone is dark charcoal-grey and rust-brown. A branching network of thick GLOWING "
            "ORANGE seams runs across the facets, brightest deep in the fissures and fading to "
            "amber, and patches of crusted orange mineral growth cling to the rock. ") + TAIL,
        refuse=("Strictly a WARM, dim palette. No cool hues anywhere in the image"),
    ),
    "fungal": dict(
        ref="rockform11",
        feature=("with clumps of small glowing mint-green mushrooms sprouting from it in several "
                 "places"),
        style=FLAT2D + VIEW + (
            "The stone is very dark desaturated TEAL-GREY. Clusters of small glowing MINT-GREEN "
            "and pale CYAN mushrooms with rounded caps and thin stalks sprout from it in clumps "
            "of differing size, with irregular patches of glowing green moss and lichen and a "
            "scatter of tiny cyan spore specks. ") + TAIL,
        refuse=("Strictly a COOL, dim, desaturated palette. No warm hues anywhere in the image"),
    ),
    "veined": dict(
        ref="rockform1",
        feature=("with thin branching electric-cyan glowing veins tracing across its facets"),
        style=FLAT2D + VIEW + (
            "The stone is deep desaturated NAVY-TEAL slate (dark blue-green grey). Thin "
            "BRANCHING ELECTRIC-CYAN glowing veins trace across the facets like luminous cracks, "
            "irregular MINT-GREEN glowing moss and lichen patches cling to the stone, and tiny "
            "cyan pinpoint specks scatter over it. ") + TAIL,
        refuse=("Strictly a COOL, dim, desaturated palette. No warm hues anywhere in the image"),
    ),
}

# The two hard rules, now stated POSITIVELY (see failure note 2 above).
# "no top, no bottom" is really two demands: nothing sitting under the rock, and no directional
# light — a bright crown over a dark underside is exactly what betrays a rotated sprite.
ISOLATION = (
    "The formation floats alone in the middle of completely empty pure BLACK space, hex 000000, "
    "with empty black on every side of it and empty black directly underneath it too — it rests on "
    "nothing and touches nothing. Nothing else is in view, and there is a clear margin of black all "
    "the way around its outline"
)
LIGHT = (
    "Evenly and ambiently lit from no particular direction, the same brightness all over, with the "
    "stone equally rocky and the glowing details equally scattered on every side, so it reads "
    "correctly turned any way up. Not isometric, not a three-quarter view, not a 3D render"
)
# What a big sprite actually needs — detail density over its whole extent — asked for without
# invoking scale in the words that turned round 1 into a landscape.
DENSE = (
    "A massive formation, densely detailed: many facets of differing size over its whole extent, "
    "subdivided by finer cracks, so it still reads as detailed stone blown up very large. Not a "
    "small smooth pebble, not a single round boulder"
)

# ---------------------------------------------------------------------------------------------
# Briefs: (name, aspect, geometric shape description).
# Orientation words are avoided on purpose — "one long edge / the other long edge", never
# top/bottom — since the shape must not imply which way up it goes.
# ---------------------------------------------------------------------------------------------
BATCHES = {
    # Round 2 of batch 1. Object nouns only, aspect capped at 16:9, no scale words — see the
    # failure note above. Blocky / elongated / rounded / tapered, so one round shows whether the
    # STYLE lands across the range of masses before pushing the silhouettes any further.
    1: [
        ("slab", "3:2",
         "a chunky detached slab of stone with seven or eight flat angular facets, its outline an "
         "irregular polygon, one corner broken clean away and a deep notch cut into one side"),
        ("splinter", "16:9",
         "a long thick splinter of stone that narrows unevenly towards each of its two ends, both "
         "of its long sides notched and stepped, with one bulge of extra mass part way along it"),
        ("lump", "4:3",
         "a fat irregular lump of stone built of five rounded masses of differing size fused into "
         "one body, with deep narrow clefts driven in between them"),
        ("bar", "16:9",
         "a long blocky bar of stone with a slight kink part way along it, chunky and thick, both "
         "of its ends broken off ragged and both of its long sides uneven and stepped"),
        ("wedge", "3:2",
         "an asymmetric wedge of stone, thick and heavy through one end and narrowing to a broken "
         "jagged point at the other, its sides notched rather than straight"),
        ("chunk", "1:1",
         "a big irregular chunk of stone, roughly rounded but lopsided, with a deep bite taken "
         "out of one side and a blunt spur jutting out from another"),
    ],
}


def log(m):
    print(m, flush=True)


def curl_json(args):
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA] + args,
                       capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"_raw": r.stdout[:300]}


def ref_datauri(key):
    """A SHIPPED rockform, flattened onto black, as a data: URI for image_prompt.

    Prose alone kept losing the flat side-on cel look to FLUX's 3D-rock-icon and
    geode-from-above priors (failure notes 4 and 6). flux-1.1-pro-ultra takes an `image_prompt`,
    which is the direct way to say "match these" — the brief IS "match our current ones". Kept
    weak (see REF_STRENGTH) so it transfers style, not composition. Flattened onto BLACK because
    the alpha would otherwise composite to white and teach it a white background.
    """
    im = Image.open(ROOT / "assets" / f"{key}.png").convert("RGBA")
    flat = Image.new("RGB", im.size, (0, 0, 0))
    flat.paste(im, (0, 0), im)
    import base64, io
    buf = io.BytesIO()
    flat.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


REF_STRENGTH = 0.22       # style transfers, composition does not; >~0.4 clones the reference


def create(prompt, aspect, seed, ref=None):
    inp = {"prompt": prompt, "aspect_ratio": aspect, "raw": False,
           "output_format": "png", "safety_tolerance": 6, "seed": seed}
    if ref:
        inp["image_prompt"] = ref
        inp["image_prompt_strength"] = REF_STRENGTH
    # The data URI is far too big for an argv, so the body goes to curl on stdin.
    body = json.dumps({"input": inp})
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA,
                        "-H", f"Authorization: Bearer {TOKEN}", "-H", "Content-Type: application/json",
                        "--data-binary", "@-",
                        f"https://api.replicate.com/v1/models/{MODEL}/predictions"],
                       input=body, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"_raw": r.stdout[:300]}


def poll(geturl):
    for _ in range(180):
        d = curl_json(["-H", f"Authorization: Bearer {TOKEN}", geturl])
        if d.get("status") in ("succeeded", "failed", "canceled"):
            return d
        time.sleep(2)
    return {"status": "timeout"}


def content_box(im, pad=12):
    """Bounding box of the rock within its black frame — review-sheet framing only.

    The renders come at six different aspect ratios with wide black margins, so pasting them
    whole makes the rocks small and hard to compare. This crops to the lit pixels so the
    silhouettes sit at comparable size. It does NOT touch the saved asset — no cutting happens
    in this script.
    """
    g = im.convert("L")
    bg = sorted([g.getpixel((x, 2)) for x in range(0, g.width, max(1, g.width // 60))])
    thr = bg[len(bg) // 2] + 12
    bbox = g.point(lambda v: 255 if v > thr else 0).getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def sheet(theme, batch, briefs, outdir):
    """Contact sheet for the owner's pick — raw renders, uncut, cropped to content."""
    cols, cw, ch, pad = 2, 940, 560, 20
    rows = (len(briefs) + cols - 1) // cols
    im_sheet = Image.new("RGB", (cols * cw, rows * ch + 34), (14, 14, 16))
    from PIL import ImageDraw
    d = ImageDraw.Draw(im_sheet)
    for i, (name, aspect) in enumerate(briefs):
        p = outdir / f"{theme}{batch}-{name}.png"
        if not p.exists():
            continue
        im = content_box(Image.open(p).convert("RGB"))
        s = min((cw - 2 * pad) / im.width, (ch - pad - 26) / im.height)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        x = (i % cols) * cw + (cw - im.width) // 2
        y = (i // cols) * ch + 26 + ((ch - 26 - pad) - im.height) // 2
        im_sheet.paste(im, (x, y))
        d.text(((i % cols) * cw + 14, (i // cols) * ch + 7),
               f"{name}   ({aspect})", fill=(238, 238, 244))
    d.text((14, rows * ch + 10),
           f"{theme} batch {batch} — raw renders, not cut or feathered yet",
           fill=(150, 150, 160))
    out = ROOT / "scratchpad" / f"sheet-{theme}{batch}.png"
    im_sheet.save(out)
    log(f"sheet -> {out}")
    return out


def main():
    if len(sys.argv) < 3:
        log(__doc__)
        sys.exit(1)
    theme, batch = sys.argv[1], int(sys.argv[2])
    rest = sys.argv[3:]
    # Re-rolls of the same brief need a different seed or they come back identical.
    seed_arg = next((a for a in rest if a.startswith("seed=")), None)
    ref_arg = next((a for a in rest if a.startswith("ref=")), None)
    only = [a for a in rest if not a.startswith("seed=") and not a.startswith("ref=")]
    if "--sheet" in only:
        only = ["--sheet"]
    briefs = [b for b in BATCHES[batch] if not only or b[0] in only]
    outdir = ROOT / "assets" / "rock_options" / "big" / theme
    rawdir = ROOT / "scratchpad" / f"big_raw_{theme}{batch}"
    outdir.mkdir(parents=True, exist_ok=True)
    rawdir.mkdir(parents=True, exist_ok=True)
    th = THEMES[theme]
    if "--sheet" in only:
        sheet(theme, batch, [(b[0], b[1]) for b in BATCHES[batch]], outdir); return
    # 2255 is the seed that reliably came back on a near-black background in the last run, and
    # keyability matters more than novelty here — every one of these gets cut later.
    seed = int(seed_arg.split("=")[1]) if seed_arg else 2255 + (batch - 1) * 100

    if not TOKEN:
        log("no REPLICATE_API_TOKEN"); sys.exit(1)

    refkey = ref_arg.split("=")[1] if ref_arg else th.get("ref")
    ref = None if refkey in (None, "off") else ref_datauri(refkey)
    log(f"style reference: {refkey or 'none'}" + (f" @ {REF_STRENGTH}" if ref else ""))

    jobs = []
    for name, aspect, shape in briefs:
        prompt = (f"{shape}, {th['feature']}. {ISOLATION}. {th['style']}. {DENSE}. "
                  f"{th['refuse']}. {LIGHT}")
        (rawdir / f"{name}.txt").write_text(prompt)
        d = create(prompt, aspect, seed, ref)
        url = (d.get("urls") or {}).get("get")
        log(f"submit {theme}{batch}-{name} ({aspect}) -> {d.get('status')} "
            f"{'' if url else json.dumps(d)[:200]}")
        if url:
            jobs.append((name, url))
        time.sleep(1)

    done = []
    for name, url in jobs:
        d = poll(url)
        if d.get("status") != "succeeded":
            log(f"{name}: {d.get('status')} {str(d.get('error'))[:160]}"); continue
        out = d.get("output")
        src = out[0] if isinstance(out, list) else out
        raw = rawdir / f"{name}.png"
        ok = False
        for attempt in range(3):
            subprocess.run(["curl", "-sS", "--cacert", CA, "-o", str(raw), src], check=False)
            try:
                Image.open(raw).load(); ok = True; break
            except Exception as e:
                log(f"{name}: download retry {attempt + 1} ({e})"); time.sleep(2)
        if not ok:
            continue
        im = Image.open(raw).convert("RGB")
        s = KEEP_LONG / max(im.size)
        keep = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS) if s < 1 else im
        keep.save(outdir / f"{theme}{batch}-{name}.png")
        log(f"{name}: {im.size} -> kept {keep.size}")
        done.append(name)

    if done:
        sheet(theme, batch, [(b[0], b[1]) for b in briefs if b[0] in done], outdir)
    log(f"done: {len(done)}/{len(briefs)}")


if __name__ == "__main__":
    main()
