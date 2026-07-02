# Mycelium — 3D

The 3D version of the Mycelium game: the same roguelike engine-builder rules as
the 2D Phase 1 game (one level up in this repo), ported into a **true 3D
simulation** — and played from inside the earth. The main UI is a **fly-through**:
you glide through the dark underground like a space sim, inspecting your strands,
the rock, the food caches and the threats up close before deciding your next action.

Everything lives in this folder; the 2D game is untouched and the two share no code.

## Play it (hosted)

The Pages workflow deploys both games to the same site — the 2D game at the
root, this one alongside it:

**https://pallkvaran-blip.github.io/mycelium2d/mycelium3d/**

## Running it locally

Vanilla JS ES modules (three.js is vendored — no CDN, no build step, no network
needed). Serve the **repo root** over HTTP and open the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/mycelium3d/
```

## The world

An underground **volume** (x: west→east, y: depth, z: breadth), voxel substrate,
seen from inside. The soil surface is the ceiling above you; the sunlit **goal
soil** glows green at the far eastern end (a light shaft marks it, and a screen
arrow points to it when it's off-view).

- Your colony seeds at the **western edge** and must cross underground to the
  goal, then **Fruit** at the surface there. Fruiting ends the life cycle —
  that's the win.
- **Rock curtains** span the full breadth from the surface down — you must dig
  *under* them (some have a single eroded porthole as a risky shortcut).
- A **lake** hangs from the surface as a bowl of impassable water; route under
  or around its rim.
- **Food** is sparse glowing caches strung along the route. Energy is a real
  constraint: passive income only flows from substrate you've colonised.

## Flying

Click the view to take the controls (Esc releases the mouse).

| Input | Effect |
| --- | --- |
| Mouse | look |
| W A S D | glide where you're looking / strafe |
| Space / C | rise / sink |
| Shift | boost |
| Scroll | targeting-cursor distance |
| 1–7 | actions |
| H | fly home · **G** face the goal |

## Acting

Same seven actions and economy as the 2D game; every action advances the whole
world one step (threats move, income flows, the rot races).

- **Grow** — tips extend toward sensed food (3D space colonization).
- **Add Substrate** — aim the glowing cursor (scroll = distance), click to drop
  a lure and steer growth.
- **Amputate** — cut every strand inside the cursor sphere; the only cure once
  the rot is inside you.
- **Attack Ants** — bomb a nest near the cursor.
- **Excrete** — sticky mucus hits every nematode near your strands (3 hits kill).
- **Digest** — burst of Energy from occupied substrate (depletes it faster).
- **Fruit** — press twice to confirm: fruiting bodies break the goal soil,
  release Spores, and end the run. Shaded soil pays more.

## The threats (fly up to them and look)

- **Trichoderma** — green mould clouds that creep toward food (or you), devour
  whole caches, and infect on touch; the rot then races along your filaments
  until you amputate the branch. A cloud camped on your growth frontier will
  eat every lure you drop — stop feeding it, let it commit, cut out the breach.
- **Ants** — surface nests run a marching trail (impassable to your growth)
  down to the nearest food and harvest it cache by cache. Race them, go around,
  or bomb the nest.
- **Nematodes** — pale worms that wander until a strand enters their line of
  sight, then crawl in fast, eat strands whole, and multiply while feeding.

## Architecture

Strict separation of simulation from rendering, same shape as the 2D game:

```
mycelium3d/
  index.html            # import map + HUD styles
  vendor/               # three.js r185 + bloom addons (vendored, MIT)
  src/config.js         # every gameplay number
  src/engine/           # renderer-agnostic sim (substrate, network, threats,
                        #   ants, nematodes, actions, turn, state, rng)
  src/render/           # three.js view (scene, terrain, strands, creatures,
                        #   flight controls + targeting cursor, DOM HUD)
  src/main.js           # wiring: input -> actions -> renderers
  test/smoke.test.js    # headless engine test  (node mycelium3d/test/smoke.test.js)
  test/playtest.mjs     # autonomous playtest bot (node mycelium3d/test/playtest.mjs)
```

The playtest bot plays whole runs headlessly (lure east, grow, digest, amputate
infection, excrete worms, bomb trail-cutting nests, bait camped mould, fruit at
the goal) — all 8 test seeds are winnable.
