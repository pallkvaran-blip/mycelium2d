# Asset spec sheet

Every prompt below is generated with the **style guide** (`STYLE_GUIDE.md`)
prepended. Provider: Replicate (FLUX). Square unless noted. Textures must be
seamless with flat even lighting; sprites need transparent backgrounds.

Status: 🟢 generated · ⚪ planned

| key | kind | size | status | purpose |
|-----|------|------|--------|---------|
| `substrate` | texture | 1024² | 🟢 | decaying organic matter, clipped to the food cells |
| `rockface` | texture | 1024² | 🟢 | rock type 1 — dark slate |
| `rockface2` | texture | 1024² | 🟢 | rock type 2 — warm iron/sandstone |
| `rockface3` | texture | 1024² | 🟢 | rock type 3 — basalt w/ glowing veins |
| `tree` | sprite | ~640 | 🟢 | surface prop — tree, shadows lifted so it reads at night |
| `grassTuft` | sprite | ~530 | 🟢 | surface prop — small grass clump |
| `house` | sprite | ~640 | 🟢 | surface prop — small cabin w/ lit window |
| `soil` | texture | — | ✖ | dropped (came out blobby; brown palette + substrate suffice) |
| `antColonyA` | sprite | ~440 | 🟢 | colony cross-section variant A (galleries) — picked per nest by column |
| `antColonyB` | sprite | ~440 | 🟢 | colony cross-section variant B (tunnels + chambers) — picked per nest by column |
| `leafOak`, `leafMaple` | sprite | ~360 tall | 🟢 | ORANGE leaf litter — NORMAL food caches (`foodKind:'cache'`, drafts Basic/Event) |
| `leafRed{Maple,Oak,Sweetgum,Japanese,Dogwood,Beech}` | sprite | ~360 tall | 🟢 | RED/autumn leaf litter — ENGINE caches (`foodKind:'cache-engine'`, drafts Engine); each pile mixes all six |
| `acorn`, `chestnut`, `pinecone` | sprite | ~360 tall | 🟢 | nut scatter — PLAYER-placed food (`foodKind:'nut'`, energy only, no draft) |
| `boulder` | sprite | 1024² | ⚪ | discrete rock props (deferred — for the map editor) |

Each connected rock formation is assigned one of the three rock textures for
variety. The earth palette is warm brown (config.render); the deep-earth look
comes from lighting, not a black base.

Sprites are generated on a plain white background then matted with BiRefMet
(`scripts/gensprite.sh`); dark silhouette props get their shadows lifted (PIL)
so they read against the night sky.

## Prompts (asset-specific part; style-guide prefix is prepended)

**soil** (texture): `seamless tileable texture of dark subterranean soil and
decaying organic matter, near-black cool brown earth, fine grain, scattered tiny
twigs and leaf-litter flecks, a few faint mint-cyan bioluminescent specks,
flat even lighting, top-down material swatch, no directional shadows, seamless
repeating edges`

**rockface** (texture): `seamless tileable texture of cold dark slate rock,
faceted cracked stone, charcoal blue-grey, faint cool rim highlights on facet
edges, flat even lighting, top-down material swatch, seamless repeating edges`

**boulder** (sprite): `a single dark slate boulder, faceted cracked stone,
charcoal blue-grey with faint cool blue rim-light, centered, transparent
background, soft self-shadow, no ground`

**antColony** (sprite): `cross-section of an underground ant nest, dark earth
chambers and tunnels carved into near-black soil, faint warm amber glow from
within the chambers, transparent background, side view`

**tree** (sprite): `a single bare tree as a dark night silhouette, deep
twilight, faint cool rim-light on the branches and a few drifting mint-cyan
bioluminescent spores, transparent background, no ground`

**grassTuft** (sprite): `a small clump of dark grass blades, night, faint cool
rim-light, a couple of tiny glowing spores, transparent background, no ground`

**house** (sprite): `a small simple cottage as a dark night silhouette, deep
twilight, one faint warm amber lit window, transparent background, no ground`

**leafRed\*** (sprites): one dry autumn leaf each, RED-shifted (vs the orange
oak/maple), flat top-down on a plain white background, painterly semi-realistic
game asset, soft warm light, subtle veins — e.g. *scarlet sugar maple*, *burgundy
red oak*, *crimson star-shaped sweetgum*, *blood-red Japanese maple*, *wine/maroon
dogwood*, *coppery-red beech*. See `scripts/gen_leaf_options.py` for the exact
prompts. Redder = the high-value ENGINE cache litter.

## Generation
`scripts/genasset.mjs` (single asset) or a batch script (e.g.
`scripts/gen_leaf_options.py` for the red leaves) calls Replicate (token in
`~/.claude/settings.json` `env.REPLICATE_API_TOKEN`, or `$REPLICATE_API_TOKEN`)
and writes the PNG into `assets/`. Transparent sprites: render on white →
**BiRefNet** matte (`men1scus/birefnet`) → quantize to palette PNG (PIL
`quantize(FASTOCTREE)` keeps alpha, matching the small existing leaf files).
After generating, add the entry to `assets/manifest.json`.
