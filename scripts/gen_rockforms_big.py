#!/usr/bin/env python3
"""BIG rock formations — Replicate renders only, NO cutting/toning.

The owner's brief: many more rockform sprites, "mostly large ones I can lay over up to half of the
map", VERY irregular silhouettes, on-theme, 2D side-on platformer style, and — the hard rule — NO
TOP AND NO BOTTOM, because these sit INSIDE the soil in cross-section and the level editor rotates
them freely. Six options at a time. Nothing is cut or feathered here: that is one batch pass
through rock_cut.py once ~60 are picked.

Everything is a LONG LIST. The owner keeps every round (including the ones I judged failures — they
liked round 2 best), so renders are never overwritten and never deleted: the filename carries
theme, batch, shape, STYLE VARIANT and SEED, and `--sheet` shows whatever is on disk.

  python3 scripts/gen_rockforms_big.py <theme> <batch> [var=r2] [seed=N] [name ...]
  python3 scripts/gen_rockforms_big.py crystal 2 var=r2         # batch 2, round-2 look
  python3 scripts/gen_rockforms_big.py crystal 1 --sheet        # review sheet, no renders

------------------------------------------------------------------------------------------------
WHAT FLUX DOES WRONG HERE, round by round. Read this before re-prompting: every one of these is
the opposite of the obvious fix.

R1 (seed 2255, `var=r1`) — all six unusable, three ways at once:
  1. SIX ORANGE LAVA ROCKS, no crystals, despite a twelve-item "NO lava, NO magma, NO molten, NO
     fire, NO embers" refusal. FLUX has no true negative prompt: a refusal list feeds those tokens
     to the same encoder as the positives. R1 also asked for "glowing pockets" plus "secondary
     cracks", and glowing cracks over a big stone face IS the lava-cliff prior — so the prompt
     argued for lava with one hand and against it with the other.
  2. GROUND PLANES on all six (sand floor, dirt floor, molten lake, scree skirt). Same mechanism:
     a long "no ground, no soil line, no base, no plinth, no scree" clause is mostly the word
     ground. State isolation POSITIVELY instead.
  3. LANDSCAPES, not sprites. The shape briefs were as much to blame as the aspect: massif, reef,
     bank, ridge and spine are LANDSCAPE FEATURES, and "an IMMENSE rock mass" at 21:9 is a literal
     landscape brief. Object nouns only; cap the aspect at 16:9; never the word immense. Size
     in-game is world-space width in the editor, not render scale — a half-map rock needs an
     interesting outline and dense facets, both askable without invoking scale.
     ("the whole rock is inside the picture" also put a white photo border on one. No frame words.)

R2 (seed 7710, `var=r2`) — fixed all three of those, broke two more. THE OWNER LIKES THIS LOOK, so
it is kept as a variant rather than corrected away:
  4. Every one came back a 3D-RENDERED PEBBLE: smooth shading, lit top face, dark underside,
     three-quarter view — which is the no-top-no-bottom failure itself. Cause is one phrase,
     "a cut-out sprite from a 2D game's ASSET SHEET": asset-store rock icons are overwhelmingly 3D
     renders, so it summons that prior and outvotes "flat 2D" earlier in the prompt. "A closed
     shape ... including underneath" pushed the same way by describing a solid.
  5. The crystal cavities vanished completely — too vague, and buried in the style block. A theme's
     glow detail has to ride along with the SHAPE brief to survive.
  Also: dropping "immense" (fix 3) overcorrected into pebbles; "formation" + "massive" is the safe
  middle.

R3 (seed 3140, not kept as a variant) — cavities back, but the whole STONE went lavender and the
view was still three-quarter:
  6. Colour bleed: "amethyst" twice plus a refuse clause reading "cool scheme throughout — slate
     stone, VIOLET, PURPLE and ice blue" licensed purple everywhere. Refusals must name NO hue.
  7. "Flat orthographic side elevation" is too weak against the stock "geode opened from above"
     image, whose cavities are ellipses seen from over the top. Ask for a CROSS-SECTION, state the
     camera geometrically ("no top surface visible, no underside visible" == a front view, which
     FLUX handles far better than negating an object), and say the cavities are seen EDGE-ON.

R4 (seed 5520, `var=r4`) — landed. THE FIX THAT MATTERED WAS NOT PROSE: flux-1.1-pro-ultra takes an
`image_prompt`, and the brief is literally "match our current ones". A shipped rockform, flattened
onto BLACK, at strength 0.22 transfers style without cloning composition, and corrected both the
perspective and the stone colour in one shot after three rounds of prompt surgery had failed.

Note on R2/R3: their renders were LOST to an earlier version of this script that reused filenames
per round. R2 is reproducible from `var=r2` + its seed; the recipe below is reconstructed, so
re-renders may not be pixel-identical to the originals.
"""
import os, sys, json, time, base64, io, subprocess
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))   # rock_silhouette lives beside this
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CA = "/root/.ccr/ca-bundle.crt"
TOKEN = os.environ.get("REPLICATE_API_TOKEN", "").strip()
MODEL = "black-forest-labs/flux-1.1-pro-ultra"
CANNY = "black-forest-labs/flux-canny-pro"
KEEP_LONG = 1600        # committed copy's long side: 2.5x the 640px finals, ~1/6 the bytes of raw
REF_STRENGTH = 0.22     # style transfers, composition does not; >~0.4 clones the reference

# ---------------------------------------------------------------------------------------------
# STYLE VARIANTS. Each is a complete, frozen recipe so any look stays reproducible forever.
# ---------------------------------------------------------------------------------------------
R2_LEAD = ("flat 2D game-art rock sprite, hand-painted cel-shaded vector look, crisp clean edges, "
           "big flat angular facets separated by dark crack lines, LOW detail, NO photoreal "
           "texture, NO grain, NO film noise, matte. ")
R4_LEAD = ("FLAT 2D vector game art, hand-painted cel-shaded, solid flat areas of colour separated "
           "by hard-edged dark crack lines, crisp clean edges, LOW detail, matte. NO 3D rendering, "
           "NO smooth gradients, NO ambient occlusion, NO glossy specular highlights, NO photoreal "
           "texture, NO grain, NO film noise. "
           # failure 7 — the single clause that decides whether a render is usable
           "A single large rock FORMATION drawn as a flat CROSS-SECTION seen dead-on from the SIDE "
           "at eye level, perfectly perpendicular with ZERO perspective: no top surface visible "
           "and no underside visible, the way rock is drawn in a 2D side-scrolling video game. "
           "Built of big flat angular facets. ")

VARIANTS = {
    # Reconstructed from the round-2 script state. Keeps failure 4 (the 3D-ish pebble look) on
    # purpose — that is what the owner picked out — and so also keeps its lit-top/dark-underside
    # tell, which is in tension with the free-rotation rule.
    "r2": dict(
        lead=R2_LEAD, ref=None, feature=False,
        tail=("Bioluminescent deep-underground feel, cool and dim. Flat orthographic side "
              "elevation. No text, no watermark, no border, no characters"),
        isolation=("One single detached piece of rock all by itself, floating in the middle of "
                   "completely empty pure BLACK space, hex 000000. Empty black is visible on every "
                   "side of it and also directly underneath it, because the rock floats freely and "
                   "touches nothing at all. A cut-out sprite from a 2D game's asset sheet: just the "
                   "one object, centred, with a clear margin of black around its whole outline. The "
                   "rock is a closed shape, equally rocky and equally detailed all the way round "
                   "including underneath, with its glowing details scattered over every side"),
        dense=("Densely detailed stone: many facets of differing size over its whole extent, "
               "subdivided by finer cracks, with its glowing details recurring at three or four "
               "separate places spread across it, so it stays interesting seen close up"),
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, so it reads correctly turned any way up. Not isometric, not a 3D render, not "
               "a floating island"),
    ),
    # The landed recipe: matches the shipped rockform1-14 and honours no-top-no-bottom.
    "r4": dict(
        lead=R4_LEAD, ref=True, feature=True,
        tail=("Bioluminescent deep-underground feel, cool and dim. "
              "No text, no watermark, no border, no characters"),
        isolation=("The formation floats alone in the middle of completely empty pure BLACK space, "
                   "hex 000000, with empty black on every side of it and empty black directly "
                   "underneath it too — it rests on nothing and touches nothing. Nothing else is "
                   "in view, and there is a clear margin of black all the way around its outline"),
        dense=("A massive formation, densely detailed: many facets of differing size over its "
               "whole extent, subdivided by finer cracks, so it still reads as detailed stone "
               "blown up very large. Not a small smooth pebble, not a single round boulder"),
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, with the stone equally rocky and the glowing details equally scattered on "
               "every side, so it reads correctly turned any way up. Not isometric, not a "
               "three-quarter view, not a 3D render"),
    ),
}

# ---------------------------------------------------------------------------------------------
# THEMES — transcribed from the SHIPPED sprites so new rocks sit beside them:
#   crystal = rockform3/7/13/14   ember = rockform2/6/9/12   fungal = rockform4/8/11
#   veined  = rockform1/5 (from the batch-1 block that originally landed)
# `body` is per variant where the wording differs; `feature` rides with the shape brief (fix 5).
# ---------------------------------------------------------------------------------------------
THEMES = {
    "crystal": dict(
        ref="rockform7",
        feature=("with two or three ragged crystal cavities broken into its side, each seen edge-on "
                 "and packed with a cluster of glowing violet and ice-blue crystal points"),
        body={
            "r2": ("The stone is dark desaturated SLATE BLUE-GREY, almost navy, with paler "
                   "blue-grey facet faces. Broken open into the stone are AMETHYST GEODE cavities: "
                   "hollows lined with dense clusters of VIOLET and deep PURPLE amethyst crystal "
                   "points mixed with pale ICE-BLUE quartz shards, glowing softly with violet "
                   "light that washes onto the stone around each hollow. Small violet amethyst "
                   "crystals also stud the bare rock. "),
            "r4": ("The stone is DARK desaturated charcoal NAVY BLUE-GREY, dim and almost black, "
                   "with slightly paler cool grey facet faces. Cavities are broken into it, each "
                   "seen EDGE-ON as a ragged hole in the rock's face, ringed by a darker rim and "
                   "lined with a dense cluster of glowing VIOLET and pale ICE-BLUE crystal points "
                   "fanning outwards, spilling violet light onto the rim. The stone itself STAYS "
                   "DARK BLUE-GREY throughout — the violet colour appears ONLY inside the cavities "
                   "and in a few small crystals on the rock face; the body of the rock is never "
                   "purple or lavender. "),
        },
        refuse={"r2": ("Strictly a COOL colour scheme throughout — slate blue-grey stone, violet, "
                       "purple and ice blue crystal, nothing else. No warm hues anywhere in the "
                       "image"),
                "r4": "Strictly a COOL, dim, desaturated palette. No warm hues anywhere in the image"},
    ),
    "ember": dict(
        ref="rockform2",
        feature="with thick glowing orange seams running deep through its fissures",
        body={"*": ("The stone is dark charcoal-grey and rust-brown. A branching network of thick "
                    "GLOWING ORANGE seams runs across the facets, brightest deep in the fissures "
                    "and fading to amber, and patches of crusted orange mineral growth cling to "
                    "the rock. ")},
        refuse={"*": "Strictly a WARM, dim palette. No cool hues anywhere in the image"},
    ),
    "fungal": dict(
        ref="rockform11",
        feature="with clumps of small glowing mint-green mushrooms sprouting from it in several places",
        body={"*": ("The stone is very dark desaturated TEAL-GREY. Clusters of small glowing "
                    "MINT-GREEN and pale CYAN mushrooms with rounded caps and thin stalks sprout "
                    "from it in clumps of differing size, with irregular patches of glowing green "
                    "moss and lichen and a scatter of tiny cyan spore specks. ")},
        refuse={"*": "Strictly a COOL, dim, desaturated palette. No warm hues anywhere in the image"},
    ),
    "veined": dict(
        ref="rockform1",
        feature="with thin branching electric-cyan glowing veins tracing across its facets",
        body={"*": ("The stone is deep desaturated NAVY-TEAL slate (dark blue-green grey). Thin "
                    "BRANCHING ELECTRIC-CYAN glowing veins trace across the facets like luminous "
                    "cracks, irregular MINT-GREEN glowing moss and lichen patches cling to the "
                    "stone, and tiny cyan pinpoint specks scatter over it. ")},
        refuse={"*": "Strictly a COOL, dim, desaturated palette. No warm hues anywhere in the image"},
    ),
}

# ---------------------------------------------------------------------------------------------
# Briefs: (name, aspect, geometric shape description).
# Orientation words are avoided on purpose — "one long side", never top/bottom — since the shape
# must not imply which way up it goes.
# ---------------------------------------------------------------------------------------------
# Batch 2 answers "much more irregular — maybe copy the rough shapes of some countries". The
# country is NAMED (it is a strong, specific silhouette prior) but ALWAYS after a full geometric
# description of the same outline, so the shape still lands if the name is ignored — and because
# naming a recognisable thing is exactly what tipped earlier rounds into scene mode. Countries
# picked for irregularity plus useful proportions: no archipelagos (they break "one single
# object") and nothing so thin it becomes a sliver.
NOT_A_MAP = "This is one solid piece of rock. It is not a map, not a chart, and has no water"
BATCHES = {
    # Blocky / elongated / rounded / tapered — the range check that landed the style.
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
    2: [
        ("norway", "16:9",
         "a long tapering limb of stone, thick at one end and narrowing along its length, with a "
         "row of eight or nine deep narrow parallel notches cut into one long side like the teeth "
         "of a comb, while the other long side stays smoother and unbroken — the silhouette of "
         "NORWAY, fjords and all"),
        ("greece", "3:2",
         "a compact craggy mass of stone with four long ragged limbs of differing length trailing "
         "away from one side of it, the gaps between the limbs deep and empty, and one limb ending "
         "in a broad blunt paddle — the silhouette of mainland GREECE and its peninsulas"),
        ("turkey", "16:9",
         "a broad blocky mass of stone about four times wider than it is thick, its long sides "
         "stepped and uneven, one end squared off and heavy, the other end drawn out into a "
         "narrower snout with a stubby spur beneath it — the silhouette of TURKEY"),
        ("iceland", "4:3",
         "a squat rounded mass of stone whose entire rim is deeply crenellated, bitten all the way "
         "round by narrow ragged notches of differing depth so no part of the outline is smooth — "
         "the silhouette of ICELAND"),
        ("croatia", "16:9",
         "a long curving crescent of stone, heavy and blocky through one end, then hooking away "
         "into a long slender arm that tapers to a point, the inner edge of the curve deeply "
         "ragged and frayed — the silhouette of CROATIA"),
        ("vietnam", "16:9",
         "a long stone S-curve, swelling into a broad mass at each of its two ends and pinched "
         "very narrow through the middle, bending twice along its length — the silhouette of "
         "VIETNAM"),
    ],
    # Batch 2 named the country as the SUBJECT ("— the silhouette of NORWAY") and FLUX drew six
    # MAPS: recognisable geography, no slate, no violet, no glow, two on white grounds, Greece and
    # Vietnam as multi-island sets (unusable — a sprite is one object), and red map markers on
    # Turkey. NOT_A_MAP did nothing, exactly as failures 1 and 2 predict of any negation.
    # Batch 3 keeps the shapes and demotes the country to a subordinate clause about the rock's
    # EDGE, so the noun phrase FLUX renders is "a mass of stone". Runs with the style reference on,
    # which independently insists on stone. Same four countries as batch 2 to isolate the framing
    # change, plus two new broad ones for half-map coverage.
    3: [
        ("norway", "16:9",
         "a single massive mass of stone, long and tapering, whose broken outer edge happens to "
         "follow the same jagged path as the coast of Norway: eight or nine deep narrow parallel "
         "notches bitten into one long side like comb teeth, the opposite side smoother"),
        ("croatia", "16:9",
         "a single massive mass of stone whose broken outer edge happens to follow the same jagged "
         "path as the coast of Croatia: heavy and blocky through one end, then hooking away into a "
         "long slender arm that tapers to a point, the inner edge of the hook deeply frayed"),
        ("turkey", "16:9",
         "a single massive mass of stone, four times wider than it is thick, whose broken outer "
         "edge happens to follow the same stepped uneven path as the coast of Turkey: one end "
         "squared off and heavy, the other drawn out into a narrower snout with a stubby spur "
         "below it"),
        ("iceland", "4:3",
         "a single massive squat mass of stone whose broken outer edge happens to follow the same "
         "deeply crenellated path as the coast of Iceland: bitten all the way round by narrow "
         "ragged notches of differing depth, no part of the outline smooth"),
        ("mongolia", "16:9",
         "a single massive mass of stone, broad and sprawling, whose broken outer edge happens to "
         "follow the same lumpy irregular path as the border of Mongolia: bulging out into three "
         "wide lobes along its length with shallow scoops between them and one blunt spur"),
        ("myanmar", "3:2",
         "a single massive mass of stone whose broken outer edge happens to follow the same path "
         "as the coast of Myanmar: a broad heavy body at one end drawn out into one very long "
         "narrow tail that thins away to a point, the join between them pinched"),
    ],
    # Batch 4 stops asking FLUX for the shape. Batches 2 and 3 proved prose cannot hold an
    # irregular silhouette and the style at once, so the outline becomes a canny CONTROL IMAGE
    # (scripts/rock_silhouette.py, Natural Earth 110m, public domain) and the prompt carries only
    # the style. Entries are (name, aspect, country). Trade-off worth knowing: flux-canny-pro takes
    # no image_prompt, so this mode gives up the r4 style reference — shape control XOR style
    # reference, not both. Also tested and rejected: flux-fill-pro continued the black context
    # inside the mask and painted almost nothing; flux-depth-pro read the flat silhouette as "a
    # mass somewhere in the middle" and painted a scene on a ground plane.
    6: [
        ("norway", "16:9", "Norway"),
        ("croatia", "16:9", "Croatia"),
        ("greece", "3:2", "Greece"),
        ("iceland", "4:3", "Iceland"),
        ("mongolia", "16:9", "Mongolia"),
        ("myanmar", "3:2", "Myanmar"),
    ],
    5: [
        ("norway", "16:9", "Norway"),
        ("croatia", "16:9", "Croatia"),
        ("greece", "3:2", "Greece"),
        ("iceland", "4:3", "Iceland"),
        ("mongolia", "16:9", "Mongolia"),
        ("myanmar", "3:2", "Myanmar"),
    ],
    4: [
        ("norway", "16:9", "Norway"),
        ("croatia", "16:9", "Croatia"),
        ("greece", "3:2", "Greece"),
        ("iceland", "4:3", "Iceland"),
        ("mongolia", "16:9", "Mongolia"),
        ("myanmar", "3:2", "Myanmar"),
    ],
}
# Batch 5 = batch 4's shapes, tuned. Batch 4 nailed the silhouettes but canny reproduced the white
# control STROKE as a glowing violet rim (and a white one on grey for Iceland), plus turned the
# cavities into decorative rosettes. Fixes: a much thinner control line so the boundary is a hint
# rather than a drawn object, lower guidance so adherence is looser, and CANNY_EDGE to say
# positively what the edge is made of.
# Batch 6 = the same shapes with a FILLED silhouette as the control instead of an outline stroke.
# flux-canny-pro runs its own edge detection on whatever you hand it, so a STROKE gives it TWO
# edges (one per side of the line) and it dutifully paints a line — which is where batch 4's
# glowing violet rim and batch 5's white rim came from. A filled shape yields ONE boundary. Batch 5
# also showed that thinning the stroke and lowering guidance to 18 only loosened the silhouette
# while keeping the rim, so batch 6 goes back to default guidance.
CANNY_BATCHES = {4, 5, 6}     # shape comes from a control image, not the text
FILLED_CTL = {6}              # filled silhouette (one clean edge) rather than an outline stroke
COUNTRY_BATCHES = {2}          # batches whose briefs name a country as the SUBJECT -> add NOT_A_MAP


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

    Flattened onto BLACK because the alpha would otherwise composite to white and teach it a
    white background — the renders have to come back on black to be keyable later.
    """
    im = Image.open(ROOT / "assets" / f"{key}.png").convert("RGBA")
    flat = Image.new("RGB", im.size, (0, 0, 0))
    flat.paste(im, (0, 0), im)
    buf = io.BytesIO()
    flat.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def curl_post(model, inp):
    """POST a prediction. Body goes in on STDIN — a data: URI is far too big for an argv."""
    r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA,
                        "-H", f"Authorization: Bearer {TOKEN}",
                        "-H", "Content-Type: application/json", "--data-binary", "@-",
                        f"https://api.replicate.com/v1/models/{model}/predictions"],
                       input=json.dumps({"input": inp}), capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"_raw": r.stdout[:300]}


def create(prompt, aspect, seed, ref=None):
    inp = {"prompt": prompt, "aspect_ratio": aspect, "raw": False,
           "output_format": "png", "safety_tolerance": 6, "seed": seed}
    if ref:
        inp["image_prompt"] = ref
        inp["image_prompt_strength"] = REF_STRENGTH
    return curl_post(MODEL, inp)


CANNY_EDGE = ("Its outer edge is bare broken stone in exactly the same dark blue-grey as the rest "
              "of the rock, chipped and faceted, with no line drawn around it and nothing glowing "
              "along its rim")


def create_canny(prompt, control_uri, seed, guidance=None):
    inp = {"prompt": prompt, "control_image": control_uri,
           "output_format": "png", "safety_tolerance": 6, "seed": seed}
    if guidance:
        inp["guidance"] = guidance
    return curl_post(CANNY, inp)


def poll(geturl):
    for _ in range(180):
        d = curl_json(["-H", f"Authorization: Bearer {TOKEN}", geturl])
        if d.get("status") in ("succeeded", "failed", "canceled"):
            return d
        time.sleep(2)
    return {"status": "timeout"}


CANNY_SUBJECT = ("A single massive formation of stone filling the drawn outline, its facets and "
                 "cracks arranged to follow that outline's own irregular edges and points")


def build_prompt(theme, batch, shape, var):
    v = VARIANTS[var]
    th = THEMES[theme]
    body = th["body"].get(var) or th["body"]["*"]
    refuse = th["refuse"].get(var) or th["refuse"]["*"]
    if batch in CANNY_BATCHES:
        shape = CANNY_SUBJECT if batch == 4 else CANNY_SUBJECT + ". " + CANNY_EDGE
    shape_full = f"{shape}, {th['feature']}" if v["feature"] else shape
    parts = [shape_full]
    if batch in COUNTRY_BATCHES:
        parts.append(NOT_A_MAP)
    parts += [v["isolation"], v["lead"] + body + v["tail"], v["dense"], refuse, v["light"]]
    return ". ".join(parts)


def content_box(im, pad=12):
    """Bounding box of the rock within its black frame — review-sheet framing only.

    The renders arrive at several aspect ratios with wide black margins, so pasting them whole
    makes the rocks small and hard to compare. Crops to the lit pixels so silhouettes sit at
    comparable size. Does NOT touch the saved asset — nothing is cut in this script.
    """
    g = im.convert("L")
    bg = sorted([g.getpixel((x, 2)) for x in range(0, g.width, max(1, g.width // 60))])
    bbox = g.point(lambda v, t=bg[len(bg) // 2] + 12: 255 if v > t else 0).getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad),
                    min(im.width, r + pad), min(im.height, b + pad)))


def sheet(theme, outdir, only_batch=None):
    """Review sheet from whatever is on disk — the long list, uncut."""
    files = sorted(outdir.glob(f"{theme}{only_batch or ''}*.png"))
    if not files:
        log("nothing to sheet"); return None
    cols = 2 if len(files) <= 8 else 3
    cw, ch, pad = (940, 560, 20) if cols == 2 else (660, 430, 16)
    rows = (len(files) + cols - 1) // cols
    im_sheet = Image.new("RGB", (cols * cw, rows * ch + 34), (14, 14, 16))
    from PIL import ImageDraw
    d = ImageDraw.Draw(im_sheet)
    for i, p in enumerate(files):
        im = content_box(Image.open(p).convert("RGB"))
        s = min((cw - 2 * pad) / im.width, (ch - pad - 26) / im.height)
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
        x = (i % cols) * cw + (cw - im.width) // 2
        y = (i // cols) * ch + 26 + ((ch - 26 - pad) - im.height) // 2
        im_sheet.paste(im, (x, y))
        d.text(((i % cols) * cw + 14, (i // cols) * ch + 7),
               p.stem.split("-", 1)[1], fill=(238, 238, 244))
    d.text((14, rows * ch + 10), f"{theme} long list — {len(files)} raw renders, "
           f"not cut or feathered yet", fill=(150, 150, 160))
    out = ROOT / "scratchpad" / f"sheet-{theme}{only_batch or ''}.png"
    im_sheet.save(out)
    log(f"sheet -> {out}  ({len(files)} renders)")
    return out


def main():
    if len(sys.argv) < 3:
        log(__doc__); sys.exit(1)
    theme, batch = sys.argv[1], int(sys.argv[2])
    rest = sys.argv[3:]
    var = next((a.split("=")[1] for a in rest if a.startswith("var=")), "r4")
    seed_arg = next((a for a in rest if a.startswith("seed=")), None)
    ref_arg = next((a for a in rest if a.startswith("ref=")), None)
    only = [a for a in rest if not a.startswith(("var=", "seed=", "ref="))]
    outdir = ROOT / "assets" / "rock_options" / "big" / theme
    outdir.mkdir(parents=True, exist_ok=True)

    if "--sheet" in only:
        sheet(theme, outdir, batch if "--all" not in only else None)
        return

    briefs = [b for b in BATCHES[batch] if not only or b[0] in only]
    # Default seeds are per (batch, variant) so a re-run of the same command is idempotent and a
    # deliberate re-roll just needs seed=.
    seed = int(seed_arg.split("=")[1]) if seed_arg else {"r2": 7710, "r4": 5520}.get(var, 2255) + batch - 1
    rawdir = ROOT / "scratchpad" / f"big_raw_{theme}{batch}_{var}{seed}"
    rawdir.mkdir(parents=True, exist_ok=True)
    if not TOKEN:
        log("no REPLICATE_API_TOKEN"); sys.exit(1)

    v = VARIANTS[var]
    canny = batch in CANNY_BATCHES
    refkey = None if canny else (ref_arg.split("=")[1] if ref_arg
                                 else (THEMES[theme]["ref"] if v["ref"] else None))
    ref = None if refkey in (None, "off") else ref_datauri(refkey)
    log(f"{theme} batch {batch}  {'canny' if canny else 'ultra'}  var={var}  seed={seed}  "
        f"ref={refkey or 'none'}{f' @ {REF_STRENGTH}' if ref else ''}")

    jobs = []
    for name, aspect, shape in briefs:
        prompt = build_prompt(theme, batch, shape, var)
        (rawdir / f"{name}.txt").write_text(prompt)
        if canny:
            # `shape` is a country name here; the outline IS the shape instruction.
            from rock_silhouette import edgemap, silhouette
            em = (silhouette(shape, aspect, blur=0) if batch in FILLED_CTL
                  else edgemap(shape, aspect, seed=seed, width=2 if batch == 5 else 5))
            ctl = rawdir / f"{name}-ctl.png"
            em.save(ctl)
            buf = io.BytesIO(); em.convert("RGB").save(buf, format="PNG")
            d = create_canny(prompt, "data:image/png;base64," +
                             base64.b64encode(buf.getvalue()).decode(), seed,
                             guidance=18 if batch == 5 else None)
        else:
            d = create(prompt, aspect, seed, ref)
        url = (d.get("urls") or {}).get("get")
        log(f"submit {name} ({aspect}) -> {d.get('status')} "
            f"{'' if url else json.dumps(d)[:200]}")
        if url:
            jobs.append((name, url))
        time.sleep(1)

    done = 0
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
        # theme + batch + shape + VARIANT + SEED: nothing on the long list can ever be overwritten
        tag = "cny" if batch in CANNY_BATCHES else var
        keep.save(outdir / f"{theme}{batch}-{name}-{tag}{seed}.png")
        log(f"{name}: {im.size} -> kept {keep.size}")
        done += 1

    if done:
        sheet(theme, outdir, batch)
    log(f"done: {done}/{len(briefs)}")


if __name__ == "__main__":
    main()
