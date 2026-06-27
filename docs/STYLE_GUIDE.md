# Art direction — Bioluminescent deep-earth

The fantasy: **a cross-section of the deep earth at night, lit from within by
life.** Almost everything inanimate is dark, cool and quiet; the living things
(your mycelium, fruiting bodies, spores, and each threat) are the only sources
of light. The player's glowing network should always read as the brightest,
most beautiful thing on screen.

Use this as the shared prefix for every asset prompt so the set stays cohesive.

## Mood
Mysterious, calm, slightly eerie. Deep shadow, soft volumetric glow/bloom around
anything alive. Painterly but clean — semi-realistic, no hard cartoon outlines,
subtle organic grain. Think *deep-sea bioluminescence* meets *soil terrarium*.

## Palette
- **Soil / earth** — near-black, cool: charcoal-brown `#0b0e12` → `#15110c`,
  faint indigo undertone in shadow. Desaturated, low value.
- **Bioluminescent accent (the life-light)** — mint/cyan: `#8ffce0`, `#5fe0c0`,
  glowing highlights `#c8fff0`. Used sparingly as specks, veins, rim-glow.
- **Mycelium (hero, drawn procedurally)** — luminous mint, the brightest element.
- **Rock** — cold dark slate `#1b1e24` with a faint cool blue rim-light `#3a4a5e`.
- **Threat glow signatures (keep them distinct):**
  - Trichoderma mould — sickly chartreuse green `#a6d84a`
  - Nematodes — pale bone / cold white `#e6dcc0`
  - Ant tunnels / colony — warm amber `#e0a24a` (the one warm light underground)
- **Above ground** — deep twilight/night sky `#0a1420` → `#13243a`; trees and
  buildings as dark silhouettes with the faintest cool rim-light + drifting
  bioluminescent spores. Cool, so the underground life-light pops.

## Lighting rules
- Light comes from **living things**, not the sky. No bright overhead sun.
- High contrast: deep blacks, small bright glowing accents, soft bloom.
- Inanimate matter (soil, rock, stone caps, buildings) is dark and desaturated.
- Glow is colored by its source (mint for you, amber for ants, etc.).

## Technical conventions
- **Textures** (soil, rock face): seamless/tileable, *flat even lighting* (no
  baked gradient or directional light — the game adds light), top-down material
  swatch, square (1024×1024).
- **Sprites** (props, boulders, colony): transparent background (PNG alpha),
  centered, with their own self-glow baked in where they're "alive."
- No text, no watermarks, no UI, no borders.
