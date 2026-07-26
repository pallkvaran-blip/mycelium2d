# `docs/levels/` — hand-authored campaign maps

Drop a level exported from the **level editor** (`docs/level-editor.html`, hosted at
`<site>/level-editor.html`) into this folder, then:

```bash
node scripts/gen-levels.mjs    # docs/levels/*.json -> src/levels-data.js (GENERATED)
node build.mjs                 # bundle it into dist/
```

A level whose `campaignLevel` is a number **replaces the procedural map for that
campaign level** — everything else about the run (economy, cards, threat behaviour,
carry-over, Spores) is unchanged. A level with `campaignLevel: null` is parked here
and never loaded by the game; the editor can still open it.

`scripts/gen-levels.mjs` fails loudly if two files claim the same `campaignLevel`,
so a slot can never be silently double-booked.

## Authoring loop

1. Open the editor, drag assets onto the map, resize/rotate them.
   Pan with a **right-drag** (or middle-drag, or space+drag); zoom with the wheel.
   **⛰ Generate surface** rolls mountains, one lake and city skylines using the game's own
   placement rules — press it until the shape reads well, then nudge things by hand. It
   replaces every mountain / lake / city on the map and leaves rocks, piles and threats
   alone; it's a single undo step.
2. **▶ Test in game** — plays the current draft immediately (no rebuild, no commit);
   it stashes the JSON in `localStorage` and opens the game on `#level`. The
   playtest run uses the dev scaffold (300 of each resource, 5× every card) so you
   can probe the geometry rather than fight the economy.
3. **Save .json** (download) or **Copy JSON** (clipboard, to paste into a chat).
4. Set **Campaign level** in the editor before exporting if the map should go live.

## Format

The document shape and the loader live in [`src/engine/level.js`](../../src/engine/level.js);
`test/level.test.js` pins the behaviour. In short:

```jsonc
{
  "format": "mycelium-level", "version": 1,
  "name": "Deep crossing", "campaignLevel": 3,
  "world":  { "width": 2600, "height": 1500, "surfaceY": 380, "cellSize": 36 },
  "layout": { "startCols": 2, "goalCols": 6, "summerCols": 7, "clearChannels": true },
  "objects": [
    { "t": "boulder",     "key": "rockSlate",  "x": 700, "y": 700, "w": 90, "h": 72, "rot": 0.4 },
    { "t": "formation",   "key": "rockform3",  "x": 1250, "y": 820, "w": 300, "h": 170 },
    { "t": "lake",        "key": "lake2",      "x": 1550, "w": 396, "h": 140 },
    { "t": "reservoir",   "key": "reservoir1", "x": 2050, "y": 1150, "r": 95 },
    { "t": "food",        "kind": "duff",      "x": 300, "y": 560, "r": 1, "energy": 2 },
    { "t": "ant",         "x": 1150 },
    { "t": "nematode",    "x": 1000, "y": 900 },
    { "t": "trichoderma", "x": 1450, "y": 700, "r": 46 },
    { "t": "mountain",    "key": "mountain4", "x": 700, "w": 160 },
    { "t": "city",        "key": "skyline3",  "x": 500, "w": 360 },
    { "t": "prop",        "key": "tree",      "x": 820, "h": 124 }
  ]
}
```

Coordinates are **world units** (the grid is `cellSize` = 36 per cell, rows measured
down from `surfaceY`), except a food pile's `r`, which is a radius in **cells**.

## Rock-formation themes

The 14 formations fall into four themes, tagged in `assets/manifest.json` (each rockform entry
carries a `theme`) — one place, read by both the editor's filter chips and the game via
`assets.js assetMeta()`:

| theme | look | keys |
|---|---|---|
| `veined` | plain dark slate, mint/cyan glow veins, green moss | 1, 5 |
| `crystal` | dark slate hosting blue/purple gem clusters | 3, 7, 10, 13, 14 |
| `ember` | red-brown rock split by orange lava cracks | 2, 6, 9, 12 |
| `fungal` | dark rock crowned with glowing mushroom caps | 4, 8, 11 |

The palette orders formations by theme and the chips above the grid filter to one. A campaign
level is meant to use a single theme throughout. (`main.js COLUMN_STYLES` is a narrower list —
just the themes whose sprites are chunky enough to stack into a rock column.)

## What is and isn't placeable

Everything the game draws from a level document is in the palette. The sprites deliberately
**not** placeable, so nobody "fixes" it later:

- `moon`, `range1/2` — sky backdrop, positioned by the game across the whole map.
- `goalhill` — the goal zone's fixed backdrop.
- `acorn`, `chestnut`, `pinecone` — drawn *inside* food piles, not standalone.
- `antColonyA/B` — a nest alternates art by column on its own; the `ant` object needs no key.
- `troll` — the level-1 Magic Mushroom rock, placed by `main.js placeRockface()`.

## Surface skylines

The `city` object is a **sky backdrop** — it changes no cell and no surface flag, so it never
affects collision or growth. Two rules:

- **Placing any `city` takes over.** A map with at least one city object gets exactly the
  skylines it names, in the art it names. A map with none keeps the automatic behaviour (the
  game draws a skyline over every run of plain surface ≥ 5 cells wide), so maps authored
  before cities existed are unchanged.
- **Keep them off mountains and lakes.** Those columns carry their own surface flag and art;
  a skyline placed over one just sits on top of it. The generator never does this, and the
  editor shows the overlap plainly.

## Surface props

`prop { key, x, h, flip }` stands a decor sprite on the soil line — `tree`, `goalbush` or
`house`. Decor only: no collision, no cell changes. Worth knowing **why it exists**: procedural
maps scatter trees over open fruitable soil, and an authored map's non-goal surface is all
`concrete`, so without placing them by hand an authored map has no surface greenery at all.

## Two things worth knowing

- **Rocks are not baked into cells.** They ship as a sprite list; the game stamps
  collision from each sprite's *opaque silhouette* at exactly the size and rotation
  you placed it (`main.js solidifyRock`). So collision always matches the drawn art —
  a strand threads a gap you can see and stops at an edge you can see.
- **There is no guaranteed corridor.** A procedural map always carves a winnable
  route under its barriers; an authored one does not. The route is whatever you left
  open, so **playtest every map** before wiring it into the campaign. The entry and
  goal channels are the only dug-clear ground (toggle: `layout.clearChannels`).
