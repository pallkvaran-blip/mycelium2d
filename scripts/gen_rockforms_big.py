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

R10 — the one to read first, because it invalidates a premise every lead above is built on:
  8. THE PROMPT WAS COMMISSIONING THE FLAT CARTOONY LOOK. Owner verdict on ember (batches 15-16):
     "more detail, more surface texture. they look too flat, cartoony." Every lead from r2 to r9
     opens "FLAT 2D vector game art, hand-painted cel-shaded, SOLID FLAT AREAS OF COLOUR ... crisp
     clean edges, matte" — so three separate rounds of density work were arguing with my own style
     block, which forbids surface by construction. Density adds CRACKS; it cannot add SURFACE
     between them. The r6 note caught half of this and deleted only the words "LOW detail".
     The trap is one word doing two jobs: flat PROJECTION (side elevation, no top, no underside —
     keep, the editor depends on it) vs flat SHADING (solid colour, no grain — this is the
     complaint). Separate them and the fix is one deletion. r10 adds NO refusal for flatness, per
     finding 1: stop asking for it rather than start forbidding it.
  10. TEXTURE COMES FROM THE REFERENCE, NOT FROM THE PROMPT. Batches 17 and 18 share the lead, the
     density clause, raw=true, the seed, the shapes and 4 MP, and differ only in image_prompt:
     rockform2 -> gritty and granular, rockform7 -> flat cel-shaded vector art with hard outlines,
     both asking equally hard for surface texture. At 0.22 the reference OUTVOTES the whole style
     block, which is r4's finding restated. A reference's PALETTE beats a refusal too — the cool
     rockform7 put big magenta patches on all six of 18 despite a clause naming amber as the only
     colour allowed. So pick the reference to match the look you want and treat the style block as
     the smaller half; and never use a cool reference to cool a warm theme.
  11. THE "NO LAVA ROCKS" RULE (finding 1) IS MINE, NOT THE OWNER'S, AND IT CONTRADICTS THE SHIPPED
     ART. rockform2 and rockform6 are warm rust-brown with glowing orange cracks over their outer
     faces — exactly what r8's confine clause exists to prevent. The owner's only stated complaint
     about ember was flatness. Don't burn rounds enforcing a spec the game's own sprites break.
  9. Corollary — LOOK AT THE SHIPPED ART BEFORE TRANSCRIBING IT. The THEMES table claims to be
     "transcribed from the SHIPPED sprites". rockform2 is painterly, densely textured, warm, with no
     drawn outline; the style block describes flat vector fills with hard crack lines. The two never
     matched, and nobody noticed for nine variants because the check was reading prompts, not images.

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
DEPTH = "black-forest-labs/flux-depth-pro"
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

# `var=r6`: the owner's note after batch 6 — "they lack detail, I can't make these take up a big
# chunk of a map, they'll look all zoomed in". Exactly right, and the cause was in my own style
# block: FLAT2D says "LOW detail", inherited from the batch-1 prompt where it meant "not photoreal".
# But facet DENSITY and photoreal texture are different axes, and that phrase was suppressing the
# first to control the second. r6 asks for high density with explicit COUNTS and a hierarchy of
# scales (big masses -> facets -> chips -> hairline cracks -> edge grain), keeps every anti-photoreal
# term, and swaps the theme feature from two or three big cavities to eight or ten small ones —
# a few huge portholes are half of why a sprite reads as a close-up.
R6_LEAD = ("FLAT 2D vector game art, hand-painted cel-shaded, solid flat areas of colour separated "
           "by hard-edged dark crack lines, crisp clean edges, matte. DENSELY detailed. NO 3D "
           "rendering, NO smooth gradients, NO ambient occlusion, NO glossy specular highlights, NO "
           "photoreal texture, NO grain, NO film noise. "
           "A single large rock FORMATION drawn as a flat CROSS-SECTION seen dead-on from the SIDE "
           "at eye level, perfectly perpendicular with ZERO perspective: no top surface visible "
           "and no underside visible, the way rock is drawn in a 2D side-scrolling video game. ")
DENSE_HI = ("FINE DENSE DETAIL AT SEVERAL SCALES AT ONCE: forty or fifty separate flat facets "
            "across its width, each facet broken up again by smaller chips and hairline cracks, "
            "with scattered flakes, small pits and a chipped pebbly texture along every edge. Each "
            "individual facet is SMALL compared to the whole formation. Seen whole it must read as "
            "a vast expanse of stone, NOT as a close-up of one small boulder")

# `var=r7`: r6's density, run through flux-depth-pro instead of canny. Two findings behind it.
# (a) CANNY IS A LINE TRACER — hand it facet lines and it draws flat outlines on flat fills
# (stained glass, batch 8 test), hand it nothing and it fills with a few huge polygons (batch 7).
# It can impose a silhouette but can NEVER add shaded detail, which is what the owner asked for.
# depth-pro shades a height field instead of tracing edges, so a FACETED depth map
# (rock_silhouette.depthmap) finally produced dense multi-scale facets. (b) The starfield: depth-pro
# kept inventing a night sky, and the culprit was my own wording — "empty pure BLACK SPACE" reads as
# OUTER space. Naming a plain flat BACKDROP instead fixed it outright. The trade: depth-pro only
# GUIDES the silhouette where canny BINDS it, so shapes come back looser.
# `var=r8`: the owner reviewed all 52 crystal options (docs/rock-review.html) and the verdict
# reversed my batch-7-vs-8 conclusion. CANNY WON: batch 7 (canny) kept 4/6 including "this is more
# like it"; batch 8 (depth) was dropped 6/6 — depth bought detail but paid for it in the two things
# that matter more, the bound silhouette and the no-ground rule (its renders came back as cave
# scenes with a base). Batch 3 (prose) also went 0/6, reading as sketchy concept art on paper.
# So the chassis is fixed: single-stage canny, r6's lead/isolation/feature. The one surviving
# complaint is detail — "detail is low / almost too low" on five separate keeps.
#
# Why DENSE_HI wasn't enough, and what's different here. DENSE_HI argues with COUNTS ("forty or
# fifty facets"), and batch 7 still came back with big undivided plates: FLUX does not count. This
# script's own history says the lever it does obey is NOUNS — "asset sheet" drew a 3D pebble, a
# country name drew a map, landscape nouns drew landscapes. So r8 states the density as a TEXTURE
# rather than a quantity (tessellated, shattered slate, crackle glaze), makes the crack network
# recursive instead of counted, gives scale as a ratio (no object noun, which would drag its own
# form in), and closes with ONE positive clause against the actual observed failure — broad areas
# of unbroken flat colour. Guidance is deliberately left at default: batch 5 already tested 18 and
# it only loosened the silhouette without adding any detail, so it is not a detail lever.
#
# r8b scoping fix: the first r8 run raised density as intended but ALSO lightened the backdrop and
# crazed it with the same crack texture. Cause was my own wording — "no part of it is ever a broad
# area of unbroken flat colour" was unscoped, and the largest broad flat area in frame is the
# BACKGROUND, so FLUX dutifully broke that up too. Every density clause now names the STONE as its
# subject, and one positive sentence keeps the backdrop out of it.
CRACK_NET = ("The STONE's whole face is TESSELLATED all over into small angular plates, crazed like "
             "shattered slate and like the crackle in an old ceramic glaze: a branching network of "
             "hard dark crack lines splits the stone into plates, then splits every plate again "
             "into smaller plates, and again into hairline fissures, with chipped flakes and small "
             "pits crowding along every crack and every edge of the stone. The finest cracks are "
             "many times smaller than the whole formation, so every part of the ROCK'S SURFACE "
             "stays broken up, with no broad area of unbroken flat colour anywhere ON THE STONE. ")
# Split out so r10 can reuse the crack network verbatim and slot a surface clause in front of the
# backdrop guard. r8's own string is rebuilt from the two halves and is byte-identical to before —
# pinned by test_gen_rockforms.py, because a variant is a frozen recipe.
BACKDROP_GUARD = ("All of this cracking and faceting belongs to the rock alone: the empty black "
                  "background behind it stays perfectly plain, smooth and unbroken")
DENSE_R8 = CRACK_NET + BACKDROP_GUARD

# `var=r10` — the answer to "more detail, more surface texture. they look too flat, cartoony".
# THE CAUSE WAS THE STYLE BLOCK, NOT THE MODE OR THE DENSITY CLAUSE. Every lead from r2 to r9 opens
# with "FLAT 2D vector game art, hand-painted cel-shaded, SOLID FLAT AREAS OF COLOUR separated by
# hard-edged dark crack lines, crisp clean edges, matte" — i.e. it commissions the exact look the
# owner rejected. Three rounds of density work (DENSE_HI's counts, then DENSE_R8's texture nouns)
# were fighting my own prompt: "solid flat areas of colour" forbids surface by construction, so the
# density levers could add more CRACKS but never any SURFACE between them.
#
# The r6 note caught HALF of this once already ("FLAT2D says LOW detail ... that phrase was
# suppressing the first to control the second") and I deleted only the words LOW detail. The rest of
# the sentence was the bigger half.
#
# The confusion is one word doing two jobs. FLAT means two unrelated things here:
#   flat PROJECTION — orthographic side elevation, no top face, no underside.  KEEP. It is the
#     no-top-no-bottom rule the level editor depends on, and r4 proved this exact wording lands it.
#   flat SHADING — solid areas of colour, no grain, no relief.  DROP. This is the complaint.
# r10 keeps the projection sentence verbatim and deletes the shading language. Nothing else moves.
#
# Note the style block carried NO refusal list for flatness and r10 adds none: by this script's own
# first finding a refusal feeds its own tokens, so the fix is to stop asking for flat, not to start
# forbidding it. (Evidence it works that way round: the old lead ALSO said "NO photoreal texture, NO
# grain, NO film noise" and the renders came back with none — the positive tokens won, as always.)
# Also gone from r10's light clause: "not a 3D render", which was an anti-SHADING term and now
# contradicts the ask. The anti-projection terms stay — r4 landed the view with them in place.
TEXTURED_LEAD = ("Hand-painted 2D game art of real stone, RICHLY TEXTURED and dense with surface "
                 "detail: a coarse gritty rock face of dark basalt, coloured in close-packed "
                 "granular grain, micro-pitting, tiny mineral speckles and flecks, chipped flakes "
                 "and shallow worn scuffs, with deep shadow pooling in every crack and a faint "
                 "ambient sheen on the raised plates, so the whole face carries real light, shade "
                 "and relief and reads as solid gritty stone with a rough surface you could feel. "
                 # projection — the one clause the old FLAT2D block got right, kept word for word
                 "A single large rock FORMATION drawn as a flat CROSS-SECTION seen dead-on from "
                 "the SIDE at eye level, perfectly perpendicular with ZERO perspective: no top "
                 "surface visible and no underside visible, the way rock is drawn in a 2D "
                 "side-scrolling video game. ")
SURFACE_R10 = ("On TOP of all that cracking, the face of every single plate carries dense fine "
               "SURFACE TEXTURE of its own: gritty granular stone, close-packed pitting, mineral "
               "speckle, scratches and weathered patches, each plate with its own shadowed hollows "
               "and lit high points, so not one plate is ever a smooth blank panel of flat colour. ")
DENSE_R10 = CRACK_NET + SURFACE_R10 + BACKDROP_GUARD

# `var=r11` — r10 with the lava regression fixed. r10 won the texture argument outright (the owner's
# only complaint) and in doing so brought back finding 1's SIX ORANGE LAVA ROCKS plus finding 2's
# ground plane: broad molten rivers over the outer faces, a glowing puddle and a rubble skirt at the
# base of two of six. r8's confine clause had held for 12/12 renders on canny, so what beat it is
# what changed, and three things did — listed in the order I rate them:
#
#   1. THE REFERENCE IS ITSELF A LAVA ROCK. THEMES['ember']['ref'] is rockform2, which is warm
#      orange with glowing cracks across its face, and r4's note says an image_prompt corrects "the
#      perspective and the STONE COLOUR" — so at 0.22 it was pulling orange the whole time. On canny
#      that never mattered because flux-canny-pro takes no image_prompt at all. This also kills the
#      arm I had planned (0.35 to chase more texture): a stronger pull toward rockform2 is a
#      stronger pull toward lava. Run r11 with `ref=rockform7` — crystal's cool blue-grey stone,
#      textured, with its glow confined inside cavities — and let the theme text supply the amber.
#   2. "deep shadow POOLING in every crack" in my own lead. Pooling is a molten-liquid verb, and
#      what came back was a literal pool of molten light at the base of the rock.
#   3. DENSE_R10's crack network is far denser than r6/r8's, and a dense crack web plus amber IS the
#      lava-cliff prior (finding 1 again). Density is right, so it stays; instead every crack is
#      stated DARK and DRY, and only the few named seams are allowed to be lit.
TEXTURED_LEAD_DRY = TEXTURED_LEAD.replace("deep shadow pooling in every crack",
                                          "deep shadow sitting in every crack")
UNLIT_CRACKS = ("Every crack, fissure and hairline split in this stone is DARK, DRY and UNLIT — "
                "bare shadow in bare rock with no light of any kind in it — apart from the few "
                "named seams; the stone is cold and solid all the way through, nothing in it flows "
                "or drips or spills, and it does not rest in or on anything bright. ")
DENSE_R11 = CRACK_NET + SURFACE_R10 + UNLIT_CRACKS + BACKDROP_GUARD

ISO_BACKDROP = ("The formation sits alone against an absolutely PLAIN FLAT BLACK BACKDROP, hex "
                "000000, an unlit empty background of solid black with nothing in it and nothing "
                "behind the rock — no sky, no stars, no gradient, no glow, no scenery. Black "
                "surrounds the whole formation on every side and below it too; it rests on nothing")

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
    # High facet density via depth control — the best detail so far.
    "r7": dict(
        lead=R6_LEAD, ref=True, feature=True,
        tail=("Bioluminescent deep-underground feel, cool and dim. "
              "No text, no watermark, no border, no characters"),
        isolation=ISO_BACKDROP,
        dense=DENSE_HI,
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, with the stone equally rocky and the detail equally scattered on every side, "
               "so it reads correctly turned any way up. Not isometric, not a three-quarter view, "
               "not a 3D render"),
    ),
    # High facet density, for sprites meant to be stretched over a big part of the map.
    # Owner-approved chassis (canny + r6) with density restated as a texture, not a count. See the
    # DENSE_R8 note: everything except `dense` is r6 verbatim, on purpose — r6's lead, isolation
    # and 8-to-10-small-pockets feature are what the 14 keeps have in common, so they don't move.
    "r8": dict(
        lead=R6_LEAD, ref=True, feature=True,
        tail=("Bioluminescent deep-underground feel, cool and dim. "
              "No text, no watermark, no border, no characters"),
        isolation=("The formation floats alone in the middle of completely empty pure BLACK space, "
                   "hex 000000, with empty black on every side of it and empty black directly "
                   "underneath it too — it rests on nothing and touches nothing. Nothing else is "
                   "in view, and there is a clear margin of black all the way around its outline"),
        dense=DENSE_R8,
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, with the stone equally rocky and the detail equally scattered on every side, "
               "so it reads correctly turned any way up. Not isometric, not a three-quarter view, "
               "not a 3D render"),
    ),
    # `var=r9`: r8's density verbatim (it is proven — 9/12 kept on crystal), existing only so a
    # theme whose FEATURE carries an intrinsic direction can be re-worded without overwriting r8
    # and losing batch 11's reproducibility. Fungal batch 11 came back as six top-down plateaus
    # with mushrooms growing out of the upper surface — the sprite gained the top the whole brief
    # forbids. The noun was the cause: a mushroom grows UP, so it drags a horizontal ground plane in
    # with it, and my own guard ("from its sides and its underside just as much as from its top")
    # made it worse by naming the top at all. See the fungal r9 entry for the fix.
    "r9": dict(
        lead=R6_LEAD, ref=True, feature=True,
        tail=("Bioluminescent deep-underground feel, cool and dim. "
              "No text, no watermark, no border, no characters"),
        isolation=("The formation floats alone in the middle of completely empty pure BLACK space, "
                   "hex 000000, with empty black on every side of it and empty black directly "
                   "underneath it too — it rests on nothing and touches nothing. Nothing else is "
                   "in view, and there is a clear margin of black all the way around its outline"),
        dense=DENSE_R8,
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, with the stone equally rocky and the detail equally scattered on every side, "
               "so it reads correctly turned any way up. Not isometric, not a three-quarter view, "
               "not a 3D render"),
    ),
    # `var=r10`: textured surface instead of flat vector fills — see the TEXTURED_LEAD note. Runs on
    # ULTRA (4 MP) with raw=true, because the two other causes of "flat" are mechanical: canny caps
    # at ~1 MP (all 12 ember renders measured 0.98-1.04 MP, so fine grain literally cannot resolve)
    # and canny is a line tracer that "can NEVER add shaded detail" — this script's own finding (a).
    # raw=true is CLAUDE.md's documented fix for base ultra reading "too AI / plasticky" on card art;
    # it had never been tried here (`create()` hardcoded raw: False).
    "r10": dict(
        lead=TEXTURED_LEAD, ref=True, feature=True,
        tail=("Bioluminescent deep-underground feel, cool and dim. "
              "No text, no watermark, no border, no characters"),
        isolation=("The formation floats alone in the middle of completely empty pure BLACK space, "
                   "hex 000000, with empty black on every side of it and empty black directly "
                   "underneath it too — it rests on nothing and touches nothing. Nothing else is "
                   "in view, and there is a clear margin of black all the way around its outline"),
        dense=DENSE_R10,
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, with the stone equally rocky and the detail equally scattered on every side, "
               "so it reads correctly turned any way up. Not isometric, not a three-quarter view"),
    ),
    # `var=r11`: r10's texture, minus the lava it brought back. See the DENSE_R11 note.
    "r11": dict(
        lead=TEXTURED_LEAD_DRY, ref=True, feature=True,
        tail=("Bioluminescent deep-underground feel, cool and dim. "
              "No text, no watermark, no border, no characters"),
        isolation=("The formation floats alone in the middle of completely empty pure BLACK space, "
                   "hex 000000, with empty black on every side of it and empty black directly "
                   "underneath it too — it rests on nothing and touches nothing. Nothing else is "
                   "in view, and there is a clear margin of black all the way around its outline"),
        dense=DENSE_R11,
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, with the stone equally rocky and the detail equally scattered on every side, "
               "so it reads correctly turned any way up. Not isometric, not a three-quarter view"),
    ),
    "r6": dict(
        lead=R6_LEAD, ref=True, feature=True,
        tail=("Bioluminescent deep-underground feel, cool and dim. "
              "No text, no watermark, no border, no characters"),
        isolation=("The formation floats alone in the middle of completely empty pure BLACK space, "
                   "hex 000000, with empty black on every side of it and empty black directly "
                   "underneath it too — it rests on nothing and touches nothing. Nothing else is "
                   "in view, and there is a clear margin of black all the way around its outline"),
        dense=DENSE_HI,
        light=("Evenly and ambiently lit from no particular direction, the same brightness all "
               "over, with the stone equally rocky and the detail equally scattered on every side, "
               "so it reads correctly turned any way up. Not isometric, not a three-quarter view, "
               "not a 3D render"),
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
        feature={
            "*": ("with two or three ragged crystal cavities broken into its side, each seen "
                  "edge-on and packed with a cluster of glowing violet and ice-blue crystal points"),
            "r6": ("with EIGHT OR TEN SMALL crystal cavities of differing size scattered right "
                   "across it, each a narrow ragged pocket seen edge-on and packed with tiny "
                   "glowing violet and ice-blue crystal points, none of them large"),
            # Set explicitly for r8 rather than inherited: pick() falls back var -> '*' -> r4, and
            # '*' is the two-or-three-BIG-cavities wording, which is half of why a sprite reads as
            # a close-up — the exact thing the owner rejected. Same intent as r6, a touch denser.
            "r8": ("with TEN OR TWELVE SMALL crystal cavities of differing size scattered right "
                   "across the whole formation, each a narrow ragged pocket seen edge-on and "
                   "packed with tiny glowing violet and ice-blue crystal points, every one of them "
                   "small next to the formation as a whole and none of them large"),
        },
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
    # Ember r8 is deliberately built as crystal's twin, because structurally it IS one: a seam down
    # inside a fissure has no intrinsic up, exactly like a cavity, which is why crystal survived the
    # top-down prior and fungal (whose feature grows outward) did not. So r8 reuses crystal's three
    # winning moves — many SMALL features, the glow CONFINED, and the stone restated as dark — and
    # adds the one guard this theme needs.
    #
    # That guard is the batch-1 failure: six orange lava rocks. Its causes are known and both are
    # designed out here rather than argued with. (a) A twelve-item "NO lava, NO magma, NO molten"
    # refusal FED those tokens to the encoder; there is no such list here and the words never
    # appear. (b) "glowing cracks over a big stone face" IS the lava-cliff prior, and the old `*`
    # wording made it worse two ways: "thick" seams "across the facets" puts the glow on the
    # OUTER SURFACE, and "patches of crusted orange mineral growth cling to the rock" licenses
    # orange on the body. r8 puts every seam DOWN INSIDE a fissure, seen edge-on, narrow, and states
    # the outer faces are cold dark charcoal.
    # (c) The old refuse read "Strictly a WARM palette. No cool hues anywhere" — which licenses warm
    # EVERYWHERE, i.e. an orange rock. Inverted for r8: the stone is cold, only the seam interiors
    # are warm. Also answers the owner's fungal note, "the shiny things don't make sense": a glow
    # that sits deep in a crack and spills onto its lip reads as a material, a floating blob doesn't.
    "ember": dict(
        ref="rockform2",
        feature={
            "*": "with thick glowing orange seams running deep through its fissures",
            "r8": ("with TEN OR TWELVE NARROW glowing amber seams of differing length scattered "
                   "right across the whole formation, each one sunk DEEP DOWN INSIDE a fissure in "
                   "the stone and seen edge-on as a thin bright line at the bottom of the crack, "
                   "none of them thick and none of them on the outer faces of the rock"),
            # Set explicitly, never inherited: pick() falls back var -> '*' -> r4, and ember's '*'
            # is the "thick glowing orange seams" wording that produced the six lava rocks. r8's
            # confine clause is the proven one (cold grey stone on all 12 of batches 15-16), so it
            # carries over verbatim — the texture work is in the lead and the body, not here.
            "r10": ("with TEN OR TWELVE NARROW glowing amber seams of differing length scattered "
                    "right across the whole formation, each one sunk DEEP DOWN INSIDE a fissure in "
                    "the stone and seen edge-on as a thin bright line at the bottom of the crack, "
                    "none of them thick and none of them on the outer faces of the rock"),
            # r11 cuts the seam count from ten-or-twelve to FIVE OR SIX and shortens them. Ten was
            # safe at r6/r8 crack density; at r10's density the render has many times more cracks
            # for the glow to spread into, and it spread into all of them. The glow budget has to
            # come down as the crack count goes up.
            "r11": ("with just FIVE OR SIX SHORT, NARROW glowing amber seams in total, widely "
                    "separated and scattered across the whole formation, each one no longer than a "
                    "small fraction of the rock and sunk DEEP DOWN INSIDE a fissure, seen edge-on "
                    "as a thin bright line at the very bottom of the crack; every other crack in "
                    "the stone is dark and unlit, and no seam ever runs across an outer face"),
        },
        body={"*": ("The stone is dark charcoal-grey and rust-brown. A branching network of thick "
                    "GLOWING ORANGE seams runs across the facets, brightest deep in the fissures "
                    "and fading to amber, and patches of crusted orange mineral growth cling to "
                    "the rock. "),
              "r8": ("The stone is DARK desaturated charcoal GREY, cold, dim and almost black, with "
                     "slightly paler cool grey facet faces. Split into it are narrow fissures, each "
                     "seen EDGE-ON as a thin dark cleft in the rock's face with a GLOWING AMBER "
                     "seam burning far down at the bottom of it, throwing a small pool of warm "
                     "light onto the two lips of that one crack and nowhere else. The stone itself "
                     "STAYS COLD DARK CHARCOAL GREY throughout — the warm colour appears ONLY down "
                     "inside the fissures and on the narrow rim of light around each one; the body "
                     "of the rock, and every outward-facing surface of it, is never orange, never "
                     "red and never rust-coloured. "),
              # r10 = r8's confine clause with the TONAL RANGE opened up. r8 said the stone is
              # "dim and almost black, with slightly paler cool grey facet faces": near-black with a
              # slightly-paler variant has almost no range to render relief WITH, so it reads flat
              # however many cracks are drawn — texture is only ever visible as light and shade.
              # Still cold and still dark overall, so the seams stay the only warm thing in frame.
              "r10": ("The stone is dark desaturated charcoal GREY basalt, cold and dim but with a "
                      "real range of tone across it: near-black deep in its hollows, mid slate "
                      "grey over most of its face, and pale weathered grey where plates stand "
                      "proud, so its relief and its grain are clearly readable. Split into it are "
                      "narrow fissures, each seen EDGE-ON as a thin dark cleft in the rock's face "
                      "with a GLOWING AMBER seam burning far down at the bottom of it, throwing a "
                      "small pool of warm light onto the two lips of that one crack and nowhere "
                      "else. The stone itself STAYS COLD GREY throughout — the warm colour appears "
                      "ONLY down inside the fissures and on the narrow rim of light around each "
                      "one; the body of the rock, and every outward-facing surface of it, is never "
                      "orange, never red and never rust-coloured. "),
              # r11 = r10's body with the seams restated as few and short, matching the r11 feature.
              "r11": ("The stone is dark desaturated charcoal GREY basalt, cold and dim but with a "
                      "real range of tone across it: near-black deep in its hollows, mid slate "
                      "grey over most of its face, and pale weathered grey where plates stand "
                      "proud, so its relief and its grain are clearly readable. A FEW narrow "
                      "fissures are split into it, each seen EDGE-ON as a thin dark cleft with a "
                      "SHORT GLOWING AMBER seam burning far down at the bottom of it, throwing a "
                      "small pool of warm light onto the two lips of that one crack and nowhere "
                      "else. The stone itself STAYS COLD GREY throughout — the warm colour appears "
                      "ONLY down inside those few fissures and on the narrow rim of light around "
                      "each one; the body of the rock, and every outward-facing surface of it, is "
                      "never orange, never red and never rust-coloured. ")},
        refuse={"*": "Strictly a WARM, dim palette. No cool hues anywhere in the image",
                "r8": ("The rock is a cold, dim, desaturated dark grey stone and the ONLY warm "
                       "colour anywhere in the image is the amber light inside the seams themselves"),
                "r10": ("The rock is a cold, dim, desaturated dark grey stone and the ONLY warm "
                        "colour anywhere in the image is the amber light inside the seams "
                        "themselves"),
                # r11 tightens this from "no WARM colour" to "no colour": its reference is
                # rockform7, a crystal rock, so the pull is now toward cool violet rather than
                # orange, and r10's wording permitted any amount of that. Neither hue is named —
                # naming one is how R3 turned the whole stone lavender (finding 6).
                "r11": ("The rock is a cold, dim, desaturated dark GREY stone, grey from edge to "
                        "edge, and the only colour anywhere in the image at all is the amber light "
                        "down inside those few seams")},
    ),
    # Fungal r8 carries over the two things that made crystal work, plus one risk unique to this
    # theme. (a) MANY SMALL features rather than a few big ones — a few large clumps is half of why
    # a sprite reads as a close-up. (b) The glow is CONFINED and the stone is restated as dark, the
    # clause that stopped crystal's whole body going lavender; without it the rock turns green.
    # (c) The new risk: mushrooms have an intrinsic UP, so FLUX will grow them all along the top
    # edge and hand the sprite a top — which breaks the no-top-no-bottom rule the editor depends
    # on. So the feature says outright that they sprout from every side, underside included.
    "fungal": dict(
        ref="rockform11",
        feature={
            "*": "with clumps of small glowing mint-green mushrooms sprouting from it in several places",
            "r8": ("with FIFTEEN OR TWENTY SMALL clumps of glowing mint-green mushrooms scattered "
                   "right across the whole formation, each clump just a few tiny caps on thin "
                   "stalks and none of them large, sprouting outward in every direction — from its "
                   "sides and from its underside just as much as from its top, so that no one side "
                   "of the formation reads as the upward side"),
            # r9 fix: swap the NOUN, don't argue with it. A mushroom on a stalk grows UP, so it
            # brings a horizontal ground plane with it and the render becomes a top-down plateau
            # with fungus on the upper surface (all six of batch 11). A BRACKET / SHELF FUNGUS grows
            # straight out SIDEWAYS from a vertical face — the orientation a cross-section actually
            # wants — so the same theme now argues FOR the view instead of against it. The words
            # top, up and underside are gone entirely: naming them is what summoned the plane.
            "r9": ("with FIFTEEN OR TWENTY SMALL glowing mint-green BRACKET FUNGI growing straight "
                   "out SIDEWAYS from the stone, scattered right across the whole formation and "
                   "jutting horizontally from its vertical faces and out of its cracks like thin "
                   "shelves and fans — flat wedge-shaped brackets with no stalks, none of them "
                   "large, each one edge-on to the viewer and casting a small pool of green light "
                   "on the rock behind it"),
        },
        body={"*": ("The stone is very dark desaturated TEAL-GREY. Clusters of small glowing "
                    "MINT-GREEN and pale CYAN mushrooms with rounded caps and thin stalks sprout "
                    "from it in clumps of differing size, with irregular patches of glowing green "
                    "moss and lichen and a scatter of tiny cyan spore specks. "),
                "r8": ("The stone is DARK desaturated charcoal TEAL-GREY, dim and almost black, "
                       "with slightly paler cool grey facet faces. Growing out of its cracks and "
                       "ledges are small clusters of glowing MINT-GREEN and pale ICE-CYAN "
                       "mushrooms, rounded caps on thin stalks seen EDGE-ON from the side, each "
                       "clump spilling a little green light onto the stone immediately around it. "
                       "Irregular patches of glowing green moss sit in the crevices and a few tiny "
                       "cyan spore specks drift beside them. The stone itself STAYS DARK TEAL-GREY "
                       "throughout — the green colour appears ONLY in the mushroom clumps, the moss "
                       "patches and the small pool of light each one casts; the body of the rock is "
                       "never green or lime. "),
                "r9": ("The stone is DARK desaturated charcoal TEAL-GREY, dim and almost black, "
                       "with slightly paler cool grey facet faces. Thin glowing MINT-GREEN and pale "
                       "ICE-CYAN BRACKET FUNGI grow out of its cracks — flat fan-shaped shelves "
                       "seen EDGE-ON, standing out sideways from the rock face — each spilling a "
                       "little green light onto the stone right behind it. Irregular patches of "
                       "glowing green lichen cling in the crevices and a few tiny cyan spore specks "
                       "drift beside them. The stone itself STAYS DARK TEAL-GREY throughout — the "
                       "green colour appears ONLY in the brackets, the lichen patches and the small "
                       "pool of light each one casts; the body of the rock is never green or lime. ")},
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
    # Batch 7: six new outlines, run with var=r6 for facet density. Chile is nearly a line once its
    # principal axis is laid horizontal, which is exactly what a map-spanning rock wants; Japan's
    # biggest ring is Honshu alone (a long curved arc), so the archipelago problem doesn't apply.
    8: [
        ("norway", "16:9", "Norway"),
        ("greece", "3:2", "Greece"),
        ("chile", "21:9", "Chile"),
        ("italy", "16:9", "Italy"),
        ("iceland", "4:3", "Iceland"),
        ("vietnam", "16:9", "Vietnam"),
    ],
    7: [
        ("italy", "16:9", "Italy"),
        ("chile", "21:9", "Chile"),
        ("sweden", "16:9", "Sweden"),
        ("japan", "16:9", "Japan"),
        ("india", "3:2", "India"),
        ("ireland", "4:3", "Ireland"),
    ],
    # Batch 9 = the six outlines the owner actually KEPT, re-run with var=r8 for density. Only the
    # `dense` clause and the cavity count change from batch 7, so this is a clean read on whether
    # restating detail as a texture beats stating it as a number — the silhouettes are already
    # known-good, which takes shape out of the variables. Chile ("this is more like it") and
    # Mongolia are the wide map-spanning ones; Japan/Sweden are long arcs; Myanmar has the pinched
    # tail; India is the compact ragged one. Aspects match wherever the outline was rendered before.
    # Batch 11 = the FUNGAL theme, first outing on the settled recipe. Batch 10 (continents) was a
    # poor round — the owner dropped it and abandoned the rest of the set — so crystal stops at its
    # 24 keeps and batch 9's recipe is treated as final: var=r8, canny, edgemap control, and THESE
    # SIX SILHOUETTES, which are exactly the ones the owner kept from batch 9. Holding the shapes
    # fixed makes the theme the only new variable, the same discipline that isolated the density
    # win. Fungal before ember: it is the thinnest theme in the game (3 sprites) and it is a cool
    # dim palette like crystal, so the proven wording transfers; ember carries the batch-1 lava
    # prior ("six orange lava rocks") and earns its own round rather than riding along in this one.
    # Batch 13 = the owner's call: stop using country outlines, DESCRIBE the shapes instead.
    # Two of their examples are re-runs of logged failures, so both are honoured in intent and
    # dodged in wording. (a) LETTERS: "Y/U/O/D/C/S/Q" as words draws typography — the veined round
    # returned literal X, U and V glyphs from "U-SHAPED", while the same geometry described without
    # naming the letter produced real horseshoes, rings and S-curves. So each brief here states the
    # geometry and never the letter. (b) "long windy river" and "steep mountain road" are LANDSCAPE
    # nouns, the family that drew full landscapes in batch 1 (massif/reef/ridge/spine); the winding
    # and the hairpin doubling-back are described as stone geometry with no river and no road, and
    # the aspect is capped at 16:9 for the same reason.
    #
    # Mode change that comes free with this: describing the shape means no control image, so this
    # runs on ULTRA with rockform11 as an image_prompt — var=r4's mechanism, which fixed the
    # perspective in one shot when three rounds of prose could not. That directly targets fungal's
    # actual failure (batches 11 and 12 were top-down plateaus). The trade is the one r4 documented:
    # the reference GUIDES the silhouette rather than binding it, so shapes come back looser than
    # canny's.
    # Batch 15 = EMBER on the settled crystal recipe: canny + edgemap + var=r8 + the six silhouettes
    # the owner kept. Ember is the "easier theme" they asked for on structural grounds, not a hunch:
    # its feature lives INSIDE the stone like crystal's cavities, so it should inherit crystal's
    # 9/12 rather than fungal's 2/24. Holding shapes, mode and variant fixed makes the theme the
    # only variable, same as batches 9 and 11.
    # Batch 16 = ember again, one variable changed: a FILLED control instead of an outline stroke.
    # Batch 15 proved the theme (no lava rocks, cold grey stone on all six — the confine clause
    # held) but put the amber glow on the OUTER RIM of 4 of 6 instead of down in the fissures. That
    # is the artifact already logged for batches 4-5: flux-canny-pro runs its own edge detection, so
    # a white STROKE is TWO edges and it paints a line between them — which becomes a glowing rim in
    # whatever colour the theme supplies. Batch 6 fixed it with a filled silhouette (one boundary),
    # so 16 goes in FILLED_CTL. It matters more for ember than it did for crystal: an amber rim is
    # visually dominant and steals the glow budget from the seams, which are the whole theme.
    # Batches 17 + 18 = EMBER on var=r10, the textured-surface recipe. The owner's verdict on
    # batches 15-16 was 3 keeps / 9 drops with one note: "more detail, more surface texture. they
    # look too flat, cartoony." See the TEXTURED_LEAD note for the cause (my own style block) and
    # the two mechanical contributors (canny's ~1 MP cap, canny being a line tracer).
    #
    # Consequences of moving off canny, both accepted deliberately: the shape is no longer BOUND,
    # only guided by the reference at 0.22, so silhouettes come back looser than the country
    # outlines; and the shapes have to be DESCRIBED. So these reuse batch 13's six prose briefs,
    # which are the ones logged as legible (a ring read as a ring, the fork forked) — every aspect
    # is at or under 16:9, per the landscape rule and per the owner dropping all four 21:9 renders
    # across batches 15-16.
    #
    # 17 = var=r10, ref=rockform2 (the shipped ember rock) at the usual 0.22. Looking at rockform2 is
    # what settled the diagnosis: it is painterly, densely textured and has no drawn outline, i.e.
    # the style block never matched the art it claims to be transcribed from.
    # 18 = var=r11, `ref=rockform7`, same six shapes, same seed 8316. Batch 17 fixed the texture and
    # brought the lava rocks back with it; r11 is that regression fixed (reference, "pooling", and
    # the glow budget — see the DENSE_R11 note). Not a one-variable arm: all three changes serve one
    # goal and two of them are my own wording bugs, so there is nothing to learn by shipping them
    # separately. The comparison that matters is 18 against 17, whose renders are kept either way.
    # Batch 20 = PRODUCTION on batch 19's recipe, which the owner kept 6 of 6 (`var=r11`,
    # `ref=rockform2`, raw=true, ultra at 4 MP). Nothing about the recipe moves — no variant, no
    # reference, no strength, no style text. Only the shape briefs are new, for one reason:
    #
    # THE BASE/GROUND FAILURE CORRELATES WITH THE SHAPE, NOT WITH THE ISOLATION WORDING. All six of
    # batch 19 carry the same positive isolation clause, and the one clean bottom is `ring` — the only
    # CLOSED LOOP, i.e. the only brief with no downward leg and no long straight edge. `fork` and
    # `horseshoe` (two legs) and `switchback` (stacked horizontal bands, so a flat lower edge) each
    # grew a floor, a cast shadow and a glowing pool between the legs; the owner's one note on the
    # whole batch was "The bottom is no good but will still keep" on horseshoe. So a shape described
    # in a STANDING orientation summons the ground it appears to stand on, and no amount of "it rests
    # on nothing" outvotes that — the same lesson as finding 2, one level up: state the geometry so
    # the failure has nothing to attach to rather than forbidding the failure.
    #
    # This costs nothing, which is why it is the right fix: the level editor rotates these freely, so
    # the orientation a render happens to arrive in is arbitrary. Every brief below therefore points
    # its limbs SIDEWAYS or has no limbs at all, and none of them describes a long straight side that
    # could become a bottom edge. `tuning` is deliberately batch 19's worst offender (the horseshoe)
    # reoriented and nothing else, so the fix gets a direct before/after.
    # Two logged traps observed here as well: no brief names a letter or a symbol (letters draw
    # typography — and `cross` would draw a crucifix, which is why that shape is called `radial`), and
    # no brief uses a landscape noun. Aspect capped at 16:9.
    #
    # RESULT (3 of 12 rendered — Replicate throttled the rest, see curl_post): the base fix WORKS.
    # comb, crescent and chain all float clean: no cast shadow, no rubble skirt, no floor, no molten
    # pool. Reorienting the brief did in one move what the isolation clause could not.
    #
    # But the SHAPES did not survive, and that is the new finding: `comb` came back a plain
    # rectangular slab with no limbs, `crescent` a blobby wedge, `chain` one lumpy mass — each
    # filling the frame edge to edge with no margin. Batch 19's briefs (ring, horseshoe, fork) DID
    # read, so the difference is brief complexity: a single iconic geometry survives a 0.22 reference,
    # a multi-part one ("four limbs of unequal length", "three lumps joined by two necks") does not.
    # r4's note called this the trade of leaving canny — "the reference GUIDES the silhouette rather
    # than binding it" — and at this complexity guiding is indistinguishable from ignoring.
    #
    # SO THE TWO THINGS THE OWNER WANTS ARE CURRENTLY MUTUALLY EXCLUSIVE, for a tooling reason:
    # flux-canny-pro BINDS the silhouette but takes no image_prompt (and the image_prompt is what
    # supplies texture — finding 10), while ultra takes the image_prompt but only guides the shape.
    # Untested idea that would get both, if it is worth the credit: render the shape on canny first
    # (bound silhouette, flat), then feed THAT render to ultra as an image_prompt at ~0.5 — above the
    # ~0.4 where a reference starts CLONING composition, which is normally the failure mode and here
    # is exactly the goal. Two renders per sprite, so price it before committing.
    20: [
        ("comb", "16:9", "a thick bar of stone with four blunt limbs of unequal length jutting "
                         "out sideways from one of its long edges, all four reaching the same "
                         "way and the notches between them left empty"),
        ("crescent", "16:9", "a long thick crescent of stone, heaviest through its middle and "
                             "tapering to two blunt points that both curl the same way, the "
                             "hollow of the curve left open"),
        ("peanut", "16:9", "two heavy rounded lobes of stone of unequal size fused together by a "
                           "narrow pinched neck, the pair lying end to end"),
        ("claw", "3:2", "three tapering prongs of stone of unequal length curving out of one "
                        "common thick mass, all three sweeping sideways the same way"),
        ("spiral", "1:1", "a thick band of stone coiling one and a half times around itself, the "
                          "empty gap between the coils narrowing as it winds inward"),
        ("radial", "1:1", "four stubby thick arms of stone splaying out of a lumpy central mass "
                          "at uneven angles, each arm a different length and thickness, the "
                          "wedges of space between them empty"),
        ("hook", "3:2", "a long thick shaft of stone whose far end curls back on itself into a "
                        "tight blunt hook, the hollow of the hook facing sideways"),
        ("tuning", "16:9", "two long thick arms of stone running side by side, joined at one end "
                           "by a heavy rounded mass, both arms reaching out the same way with the "
                           "channel between them left empty"),
        ("lens", "4:3", "a broad slab of stone pinched to a sharp broken edge all the way around "
                        "its rim and thickest through its middle, its outline dented and uneven"),
        ("chain", "16:9", "three lumpy masses of stone of differing size fused into a line by two "
                          "short thick necks, the whole thing leaning across the frame"),
        ("teeth", "16:9", "a thick irregular slab of stone with a row of deep angular notches "
                          "bitten into one of its long edges, leaving blunt uneven teeth between "
                          "them"),
        ("knot", "4:3", "a dense knot of stone where three thick lumpy limbs meet and merge, each "
                        "limb ending in a broken blunt stump, the limbs splayed at uneven angles"),
    ],
    # Batch 19 = the combination batches 17 and 18 point at: r11's WORDING (few short seams, every
    # other crack dark and dry, nothing bright at the base) with r10's REFERENCE (rockform2).
    #
    # What 18 established, and it is the most useful finding of the round: THE TEXTURE CAME FROM THE
    # REFERENCE, NOT FROM MY PROMPT. 17 and 18 share the lead, the density clause, raw=true, the
    # seed, the shapes and 4 MP; the only material difference is rockform2 vs rockform7. 17 came back
    # gritty and granular, 18 came back flat cel-shaded vector art with hard outlines — the exact
    # look the owner rejected — while asking just as hard for surface texture. So rockform7 is a flat
    # vector sprite and rockform2 is a painterly one, and at 0.22 the image_prompt OUTVOTES the whole
    # style block. That is r4's finding restated ("the fix that mattered was NOT PROSE") and it means
    # the style block is close to decorative next to the choice of reference. Corollary: the ONLY
    # renders that have ever come back textured are the ones referencing rockform2.
    # 18 also confirmed the violet risk that its own refuse clause was written to prevent: six
    # renders with big saturated magenta patches. A reference's palette beats a refusal, so a cool
    # reference cannot be used to cool an ember rock. rockform2's orange has to be fought in the
    # prompt instead, which is what r11's glow budget is for — 18 did cut the seams to one or two and
    # cleared the molten pool and the rubble skirt, so that half of r11 works.
    #
    # RESULT OF 19, since the paragraph above was written as a prediction: half right. The texture
    # came back exactly as predicted (third confirmation that rockform2 is what supplies it) and the
    # violet went away with rockform7. But r11's glow budget did NOT hold against rockform2 — all six
    # came back with broad orange crack networks over the outer faces, and fork and horseshoe kept
    # the molten pool and rubble skirt at the base. The same wording that cut the seams to one or two
    # under rockform7 changed almost nothing under rockform2. So on this evidence texture and
    # warm-glow are COUPLED THROUGH THE REFERENCE and no prompt-side lever tried so far separates
    # them: rockform2 buys texture and orange together, rockform7 buys cold and flat together.
    #
    # WHICH RAISES A BETTER QUESTION, AND IT IS A CORRECTION TO THIS FILE: "six orange lava rocks"
    # has been finding 1 since round 1, and it is MY verdict, never the owner's. Look at the shipped
    # ember set it claims to be transcribed from — rockform2 and rockform6 are warm rust-brown rock
    # with GLOWING ORANGE CRACKS ACROSS THEIR OUTER FACES. That is the thing r8's confine clause was
    # built to prevent. So the confine clause has been fighting the theme's own shipped art, and
    # batches 17/19 are plausibly MORE on-theme than the cold grey 15/16 — of which the owner kept
    # 3 of 12, and complained about the flatness, never the colour. Do not spend another round
    # chasing the orange out until the owner has actually said it is wrong. Same lesson as finding 9:
    # look at the art, not at the prompt history.
    19: [
        ("winding", "16:9", "a long band of stone that winds from side to side through three "
                            "broad bends, thicker where it turns and pinched thinner between"),
        ("ring", "1:1", "a closed loop of stone, lumpy and uneven all the way round, with one "
                        "large ragged hole punched clean through the middle of it"),
        ("fork", "3:2", "one thick stem of stone that divides into two diverging prongs of "
                        "unequal length, the wedge of space between the prongs left empty"),
        ("horseshoe", "3:2", "a thick horseshoe of stone: two heavy arms joined at one end by a "
                             "rounded bend, the long gap between the arms left open and empty"),
        ("bulge", "4:3", "a mass of stone with one long straight side, the opposite side swelling "
                         "out in a single broad curve, so the whole reads as a heavy half-round"),
        ("switchback", "3:2", "a narrow band of stone that doubles back on itself four times in "
                              "tight hairpin turns stacked one above the next, each turn a sharp "
                              "angular corner with an empty notch biting in beside it"),
    ],
    18: [
        ("winding", "16:9", "a long band of stone that winds from side to side through three "
                            "broad bends, thicker where it turns and pinched thinner between"),
        ("ring", "1:1", "a closed loop of stone, lumpy and uneven all the way round, with one "
                        "large ragged hole punched clean through the middle of it"),
        ("fork", "3:2", "one thick stem of stone that divides into two diverging prongs of "
                        "unequal length, the wedge of space between the prongs left empty"),
        ("horseshoe", "3:2", "a thick horseshoe of stone: two heavy arms joined at one end by a "
                             "rounded bend, the long gap between the arms left open and empty"),
        ("bulge", "4:3", "a mass of stone with one long straight side, the opposite side swelling "
                         "out in a single broad curve, so the whole reads as a heavy half-round"),
        ("switchback", "3:2", "a narrow band of stone that doubles back on itself four times in "
                              "tight hairpin turns stacked one above the next, each turn a sharp "
                              "angular corner with an empty notch biting in beside it"),
    ],
    17: [
        ("winding", "16:9", "a long band of stone that winds from side to side through three "
                            "broad bends, thicker where it turns and pinched thinner between"),
        ("ring", "1:1", "a closed loop of stone, lumpy and uneven all the way round, with one "
                        "large ragged hole punched clean through the middle of it"),
        ("fork", "3:2", "one thick stem of stone that divides into two diverging prongs of "
                        "unequal length, the wedge of space between the prongs left empty"),
        ("horseshoe", "3:2", "a thick horseshoe of stone: two heavy arms joined at one end by a "
                             "rounded bend, the long gap between the arms left open and empty"),
        ("bulge", "4:3", "a mass of stone with one long straight side, the opposite side swelling "
                         "out in a single broad curve, so the whole reads as a heavy half-round"),
        ("switchback", "3:2", "a narrow band of stone that doubles back on itself four times in "
                              "tight hairpin turns stacked one above the next, each turn a sharp "
                              "angular corner with an empty notch biting in beside it"),
    ],
    16: [
        ("japan", "16:9", "Japan"),
        ("mongolia", "21:9", "Mongolia"),
        ("chile", "21:9", "Chile"),
        ("india", "3:2", "India"),
        ("sweden", "16:9", "Sweden"),
        ("myanmar", "3:2", "Myanmar"),
    ],
    15: [
        ("japan", "16:9", "Japan"),
        ("mongolia", "21:9", "Mongolia"),
        ("chile", "21:9", "Chile"),
        ("india", "3:2", "India"),
        ("sweden", "16:9", "Sweden"),
        ("myanmar", "3:2", "Myanmar"),
    ],
    # Batch 14 = batch 13's six described shapes again, with ONE thing changed: the image_prompt.
    # Batch 13's shapes came out legible (a ring read as a ring, the fork forked) but every render
    # was an isometric block with a flat fungus-covered top — the R2 "3D pebble" failure. Cause was
    # the reference, not the prose: THEMES['fungal']['ref'] is rockform11, which is itself a sloped
    # shelf with mushrooms growing on its upper surface, so the style transfer was teaching exactly
    # the projection the brief forbids. rockform1 is a flat side-on cross-section with its features
    # scattered INSIDE the stone and no top at all, so it teaches the right one. Run as
    # `fungal 14 var=r9 ref=rockform1`; at strength 0.22 the reference moves projection much more
    # than palette, and the fungal body/refuse text carries the green on its own.
    14: [
        ("winding", "16:9", "a long band of stone that winds from side to side through three "
                            "broad bends, thicker where it turns and pinched thinner between"),
        ("ring", "1:1", "a closed loop of stone, lumpy and uneven all the way round, with one "
                        "large ragged hole punched clean through the middle of it"),
        ("fork", "3:2", "one thick stem of stone that divides into two diverging prongs of "
                        "unequal length, the wedge of space between the prongs left empty"),
        ("horseshoe", "3:2", "a thick horseshoe of stone: two heavy arms joined at one end by a "
                             "rounded bend, the long gap between the arms left open and empty"),
        ("bulge", "4:3", "a mass of stone with one long straight side, the opposite side swelling "
                         "out in a single broad curve, so the whole reads as a heavy half-round"),
        ("switchback", "3:2", "a narrow band of stone that doubles back on itself four times in "
                              "tight hairpin turns stacked one above the next, each turn a sharp "
                              "angular corner with an empty notch biting in beside it"),
    ],
    13: [
        ("winding", "16:9", "a long band of stone that winds from side to side through three "
                            "broad bends, thicker where it turns and pinched thinner between"),
        ("ring", "1:1", "a closed loop of stone, lumpy and uneven all the way round, with one "
                        "large ragged hole punched clean through the middle of it"),
        ("fork", "3:2", "one thick stem of stone that divides into two diverging prongs of "
                        "unequal length, the wedge of space between the prongs left empty"),
        ("horseshoe", "3:2", "a thick horseshoe of stone: two heavy arms joined at one end by a "
                             "rounded bend, the long gap between the arms left open and empty"),
        ("bulge", "4:3", "a mass of stone with one long straight side, the opposite side swelling "
                         "out in a single broad curve, so the whole reads as a heavy half-round"),
        ("switchback", "3:2", "a narrow band of stone that doubles back on itself four times in "
                              "tight hairpin turns stacked one above the next, each turn a sharp "
                              "angular corner with an empty notch biting in beside it"),
    ],
    # Batch 12 = fungal again with var=r9: the bracket-fungus noun instead of mushrooms, same six
    # silhouettes, everything else identical to batch 11. A clean read on whether swapping the noun
    # fixes the top-down plateau, which is the only thing that went wrong in batch 11.
    12: [
        ("japan", "16:9", "Japan"),
        ("mongolia", "21:9", "Mongolia"),
        ("chile", "21:9", "Chile"),
        ("india", "3:2", "India"),
        ("sweden", "16:9", "Sweden"),
        ("myanmar", "3:2", "Myanmar"),
    ],
    11: [
        ("japan", "16:9", "Japan"),
        ("mongolia", "21:9", "Mongolia"),
        ("chile", "21:9", "Chile"),
        ("india", "3:2", "India"),
        ("sweden", "16:9", "Sweden"),
        ("myanmar", "3:2", "Myanmar"),
    ],
    # Batch 10 = whole CONTINENTS and ISLAND CLUSTERS, on the owner's hypothesis that more
    # coastline buys more detail. Same var=r8 and the same edgemap control as batch 9 (which kept
    # 9/12), so the shape family is the only new variable. rock_silhouette grew two spec prefixes
    # for this: `cluster:X` keeps every island of a country, `continent:X` unions every country on
    # a continent — rasterised filled so their shared borders dissolve, then outlined, because
    # stroking each ring would trace national borders and hand FLUX a political map.
    # Greece-as-a-cluster and Europe were tried and cut before rendering: NE 110m has no Aegean
    # islands (so Greece was just the already-rejected mainland), and Europe includes Russia, which
    # aligns into a long thin smear. Canada and Oceania replace them — Oceania is a continent that
    # is itself an island cluster, which is exactly the shape family being tested.
    10: [
        ("indonesia", "21:9", "cluster:Indonesia"),
        ("philippines", "16:9", "cluster:Philippines"),
        ("canada", "16:9", "cluster:Canada"),
        ("africa", "16:9", "continent:Africa"),
        ("southamerica", "21:9", "continent:South America"),
        ("oceania", "21:9", "continent:Oceania"),
    ],
    9: [
        ("chile", "21:9", "Chile"),
        ("mongolia", "21:9", "Mongolia"),
        ("japan", "16:9", "Japan"),
        ("sweden", "16:9", "Sweden"),
        ("myanmar", "3:2", "Myanmar"),
        ("india", "3:2", "India"),
    ],
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
CANNY_BATCHES = {4, 5, 6, 7, 9, 10, 11, 12, 15, 16}  # shape comes from a control image, not the text
FILLED_CTL = {6, 7, 16}           # filled silhouette (one clean edge) rather than an outline stroke
DEPTH_BATCHES = {8}           # faceted depth map -> shaded detail (see var=r7)
COUNTRY_BATCHES = {2}          # batches whose briefs name a country as the SUBJECT -> add NOT_A_MAP
RAW_BATCHES = {17, 18, 19, 20}   # ultra raw=true — CLAUDE.md's fix for base ultra reading "too AI"
STRENGTH = {}   # per-batch image_prompt_strength override (default REF_STRENGTH). Batch 18 was
# going to be 0.35 to chase more texture; dropped once batch 17 showed the reference is what brought
# the lava back, since a stronger pull toward rockform2 is a stronger pull toward orange.


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


def curl_post(model, inp, tries=6):
    """POST a prediction. Body goes in on STDIN — a data: URI is far too big for an argv.

    Retries on 429. Replicate silently TIGHTENS the rate limit to 6/min with a burst of 1 once the
    account drops below $5 of credit, and batch 20 lost 9 of 12 submissions to that in one run —
    the 1s spacing below is 60/min, so every request after the first was rejected. A 429 costs
    nothing but is not free to us: the batch comes back part-rendered and the shapes that failed
    are silently missing from the review sheet.
    """
    for attempt in range(tries):
        r = subprocess.run(["curl", "-sS", "--max-time", "180", "--cacert", CA,
                            "-H", f"Authorization: Bearer {TOKEN}",
                            "-H", "Content-Type: application/json", "--data-binary", "@-",
                            f"https://api.replicate.com/v1/models/{model}/predictions"],
                           input=json.dumps({"input": inp}), capture_output=True, text=True)
        try:
            d = json.loads(r.stdout)
        except Exception:
            return {"_raw": r.stdout[:300]}
        if "throttled" not in str(d.get("detail", "")).lower():
            return d
        if attempt == tries - 1:
            return d
        wait = 12 * (attempt + 1)          # 12s, 24s, 36s… comfortably under 6/min either way
        log(f"  throttled, retrying in {wait}s ({attempt + 1}/{tries - 1})")
        time.sleep(wait)


def create(prompt, aspect, seed, ref=None, raw=False, strength=REF_STRENGTH):
    inp = {"prompt": prompt, "aspect_ratio": aspect, "raw": raw,
           "output_format": "png", "safety_tolerance": 6, "seed": seed}
    if ref:
        inp["image_prompt"] = ref
        inp["image_prompt_strength"] = strength
    return curl_post(MODEL, inp)


CANNY_EDGE = ("Its outer edge is bare broken stone in exactly the same dark blue-grey as the rest "
              "of the rock, chipped and faceted, with no line drawn around it and nothing glowing "
              "along its rim")


def create_depth(prompt, control_uri, seed):
    return curl_post(DEPTH, {"prompt": prompt, "control_image": control_uri,
                             "output_format": "png", "safety_tolerance": 6, "seed": seed})


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


def pick(val, var):
    """Per-variant string, falling back to '*' then to r4's wording.

    Themes key `body`/`refuse`/`feature` by variant where the wording differs. A new variant that
    has no entry must inherit rather than KeyError, which is what adding r6 first did.
    """
    if not isinstance(val, dict):
        return val
    return val.get(var) or val.get("*") or val["r4"]


def build_prompt(theme, batch, shape, var):
    v = VARIANTS[var]
    th = THEMES[theme]
    body = pick(th["body"], var)
    refuse = pick(th["refuse"], var)
    if batch in DEPTH_BATCHES:
        shape = CANNY_SUBJECT
    elif batch in CANNY_BATCHES:
        shape = CANNY_SUBJECT if batch == 4 else CANNY_SUBJECT + ". " + CANNY_EDGE
    shape_full = f"{shape}, {pick(th['feature'], var)}" if v["feature"] else shape
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
    seed = (int(seed_arg.split("=")[1]) if seed_arg
            else {"r2": 7710, "r4": 5520, "r6": 6100, "r7": 6400,
                  "r10": 8300}.get(var, 2255) + batch - 1)
    rawdir = ROOT / "scratchpad" / f"big_raw_{theme}{batch}_{var}{seed}"
    rawdir.mkdir(parents=True, exist_ok=True)
    if not TOKEN:
        log("no REPLICATE_API_TOKEN"); sys.exit(1)

    v = VARIANTS[var]
    canny = batch in CANNY_BATCHES or batch in DEPTH_BATCHES
    refkey = None if canny else (ref_arg.split("=")[1] if ref_arg
                                 else (THEMES[theme]["ref"] if v["ref"] else None))
    ref = None if refkey in (None, "off") else ref_datauri(refkey)
    mode = "depth" if batch in DEPTH_BATCHES else "canny" if canny else "ultra"
    raw = batch in RAW_BATCHES
    strength = STRENGTH.get(batch, REF_STRENGTH)
    log(f"{theme} batch {batch}  {mode}{' raw' if raw else ''}  var={var}  seed={seed}  "
        f"ref={refkey or 'none'}{f' @ {strength}' if ref else ''}")

    jobs = []
    for name, aspect, shape in briefs:
        prompt = build_prompt(theme, batch, shape, var)
        (rawdir / f"{name}.txt").write_text(prompt)
        if canny:
            # `shape` is a country name here; the outline IS the shape instruction.
            from rock_silhouette import edgemap, silhouette, depthmap
            em = (depthmap(shape, aspect, seed=seed) if batch in DEPTH_BATCHES
                  else silhouette(shape, aspect, blur=0) if batch in FILLED_CTL
                  else edgemap(shape, aspect, seed=seed, width=2 if batch == 5 else 5))
            ctl = rawdir / f"{name}-ctl.png"
            em.save(ctl)
            buf = io.BytesIO(); em.convert("RGB").save(buf, format="PNG")
            uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
            d = (create_depth(prompt, uri, seed) if batch in DEPTH_BATCHES
                 else create_canny(prompt, uri, seed, guidance=18 if batch == 5 else None))
        else:
            d = create(prompt, aspect, seed, ref, raw=raw, strength=strength)
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
        tag = "dep" if batch in DEPTH_BATCHES else "cny" if batch in CANNY_BATCHES else var
        keep.save(outdir / f"{theme}{batch}-{name}-{tag}{seed}.png")
        log(f"{name}: {im.size} -> kept {keep.size}")
        done += 1

    if done:
        sheet(theme, outdir, batch)
    log(f"done: {done}/{len(briefs)}")


if __name__ == "__main__":
    main()
