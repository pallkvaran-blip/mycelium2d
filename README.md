# Mycelium — Phase 1

A 2D roguelike **engine-builder** themed on the real life of a fungal colony. You
steer a living, semi-autonomous **mycelial network** through underground
substrate — shaping where its hunger goes, defending it, and fruiting it.

This repository is **Phase 1**: the basic-action backbone, fully playable, built
with the production architecture so later phases extend it rather than replace it.
A **card layer** now sits on top of that backbone (Water/Phosphorus economy,
draw/skip, a draggable hand carousel, map food-pile drafting, reach-the-goal win).
For the current state, systems, and conventions see **[`docs/CHECKPOINT.md`](docs/CHECKPOINT.md)**
— this README's "Playing" section below describes the older pre-card basic actions.
(The generational cycle, meta-progression and the 3D view come in later phases.)

## Play it (hosted)

Every push to the development branch auto-deploys the single-file build to
GitHub Pages via `.github/workflows/pages.yml` (no manual setup):

**https://pallkvaran-blip.github.io/mycelium2d/**

## Running it locally

The game is vanilla JS using **ES modules**, so it must be served over HTTP
(browsers block `import` over `file://`). From the repo root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

(or `npm start`, which runs the same server.)

### Single-file build

`npm run build` bundles every module + the CSS into one self-contained file at
`dist/index.html` (no server needed — open it directly, or host it anywhere).
It also writes `dist/artifact.html`, a body-only version for hosts that supply
their own `<head>`. The build is mechanical (strips `import`/`export`, wraps the
modules in one IIFE); the source of truth is always `src/` + `index.html`.

The bundle is touch-ready: drag to pan, **pinch** to zoom, **double-tap** to
refit. On phone-sized screens the secondary panels start collapsed.

## Playing

You tend one network. Each turn you have **3 moves**; every action costs a move
**and** Energy.

| Action | What it does |
| --- | --- |
| **Grow** | Releases the network — every tip extends toward food it senses. |
| **Add Substrate** | Click underground to place food and *lure* growth where you want. |
| **Amputate** | Click a strand to cut it (and everything downstream) — stop growth toward danger or remove infected parts. |
| **Express** | Induce a genetic defence trait organism-wide (Melanize / Antifungal / Antipredator), leveled. |
| **Digest** | Over-digest occupied substrate for a burst of Energy now (depletes it faster). |
| **Fruit** | Push fruiting bodies up through reachable **soil** to release Spores, then the life cycle ends. Shaded soil yields more. |

- **Energy** comes in passively each turn from the substrate you occupy (it
  depletes), plus a small trickle. **Spores** come from Fruit.
- **Trichoderma** (green mold) spreads toward food and damages strands it
  touches; it avoids firmly-held ground. Counter it with Amputate, Antifungal,
  and Melanize.
- Fruiting only works beneath **soil** (not concrete/rock/water), so steer
  growth under soil near the surface before you fruit.

Controls: **drag** to pan, **scroll** to zoom, **F** to refit, **Space** to end
turn, **Esc** to cancel a targeted action.

## Dev tools

The dev panel (bottom-right, marked for removal before release) has cheat
buttons and live sliders for the key tunables. There is also a pinned
**"What we're testing"** panel listing the Phase 1 design questions.

## Architecture

Strict separation of **simulation** (renderer-agnostic) from **rendering**, so a
later 3D view can be driven from the same state.

```
index.html
src/main.js              # wiring: input -> actions -> renderers
src/config.js            # CONFIG: every gameplay number, plus the dev sliders
src/engine/rng.js        # seedable PRNG (deterministic sim)
src/engine/state.js      # holds the LIST of networks; the active one
src/engine/substrate.js  # substrate field + surface line (soil/shade)
src/engine/network.js    # the Network object: nodes, growth, vitality, traits
src/engine/threats.js    # Trichoderma
src/engine/actions.js    # the six basic actions (data-driven)
src/engine/turn.js       # move/turn loop + end-turn resolution
src/render/camera.js     # world<->screen, pan/zoom
src/render/substrate.js  # cross-section terrain (baked)
src/render/network.js    # reusable per-network renderer (baked + animated)
src/render/ui.js         # HUD, action bar, log, legend, dev panel, testing panel
test/smoke.test.js       # headless engine test (node test/smoke.test.js)
```

The state holds a **list of networks** (only one active in Phase 1) and each
`Network` is a self-contained object, so the generational / autonomous-decay
system drops in later without a rewrite.

## Tests

```bash
npm test   # node test/smoke.test.js — drives the engine headlessly
```
