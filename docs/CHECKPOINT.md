# Mycelium — Project Checkpoint

_Living status + knowledge doc. Last updated: 2026-07-15 (**CAMPAIGN: 11 procedural levels with per-level threat scaling** — win a level to carry your deck+resources to the next; beat L11 to win; clearing a level unlocks species (saved in localStorage); death → species picker · **start-of-run SPECIES PICKER gates every run** — pick a real mushroom species seeded with its exact starting hand + resources; a temporary "Dev quick-start" button, or `#dev`, skips it and runs the old `testall` scaffold (300E/W/P + 5× every card) · **draft economy: basics infinite/3-copies + events infinite/1-copy, engines unique; normal drafts weighted ~60/40 to basics** · draft panel minimizes to a glowing chip & LOCKS play until chosen · nematodes fan out, eat every tick, breed 0.8 — wiping the colony ends the run with a defeat overlay · engine-cache draft = a distinct RED-leaf litter pile · directional grows use a press-and-drag aim, press away to pan · Foraging Fan grows from ALL strands)._

A running record of **where the project is**, **how it's built**, and **what we
know** — so any session (human or Claude) can pick up without re-deriving
context. Update the "Recent work log" and "Backlog" sections as work lands.

This doc covers **architecture, UI/interaction, operations, and status**. It does
**not** own the game-design decisions — those live in the docs below, which remain
authoritative. Where they overlap, defer to them.

### Related docs (where each kind of decision lives)

| Doc | Owns |
| --- | --- |
| **[`docs/cards-design.md`](cards-design.md)** | **Authoritative** card-system design: vision, core loop, §2 *Locked design decisions*, rules/balance framework, versioned rulings (current: **v10**, two-resource W/P). The source of truth for card behaviour & economy. |
| [`docs/cards-review.md`](cards-review.md) | Rolling per-card playtest verdicts (👍/👎) and the cross-cutting rulings (R1–R12) they generated. |
| `docs/cards.json` / `docs/cards.csv` | Card **data** (source). `src/cards-data.js` is generated from `cards.json`. |
| [`docs/STYLE_GUIDE.md`](STYLE_GUIDE.md) | Art direction (bioluminescent deep-earth): mood, palette, lighting, prompt prefix. |
| [`docs/ASSETS.md`](ASSETS.md) | Asset spec sheet + per-asset prompts + generation status. |
| **this doc** | Architecture, file map, UI/interaction model, conventions, testing, work log, caveats, backlog. |

When a **card-design** decision is made, record it in `cards-design.md` (and
`cards-review.md` if it's a per-card verdict), not here. Record **UI/interaction,
architecture, or process** decisions here.

---

## 1. What it is

**Mycelium** — a 2D, side-on **roguelike engine-builder** themed on the life of a
fungal colony. You steer a living, semi-autonomous **mycelial network** through
underground substrate: shaping where its hunger goes, feeding it, defending it,
and driving it to a goal. Presentation: HTML + `<canvas>` + **vanilla ES
modules** (no framework, no build-time deps for the game itself).

- **Hosted:** https://pallkvaran-blip.github.io/mycelium2d/ (auto-deploys on every
  push to the dev branch via `.github/workflows/pages.yml`).
- **Status:** Phase 1 backbone **plus a working card layer** on top (design owned by
  [`cards-design.md`](cards-design.md), v10). The root `README.md` still describes
  the pre-card "no cards" Phase 1 — it is stale on that point; this doc is the
  current source of truth for **architecture & UI**.

---

## 2. Run / build / deploy

```bash
# Run locally (ES modules require HTTP; file:// blocks import + manifest.json)
python3 -m http.server 8000      # or: npm start
# open http://localhost:8000/index.html

# Single-file bundle (source of truth is always src/ + index.html)
node build.mjs                   # or: npm run build
#   -> dist/index.html    (self-contained: inlined JS + CSS, open directly)
#   -> dist/artifact.html (body-only, for hosts that supply their own <head>)
#   -> copies assets/ -> dist/assets/

npm test                         # node test/smoke.test.js (headless engine test)
node test/cards.test.js          # card-engine test
```

**Important:** `dist/` is generated. After editing `src/` or `index.html`, run
`node build.mjs` and commit the regenerated `dist/` alongside the source, or the
hosted build won't reflect the change.

---

## 3. Architecture

Strict separation of **simulation** (renderer-agnostic) from **rendering**, so a
later 3D view can be driven from the same state. Everything gameplay-tunable
lives in `src/config.js` (`CONFIG`).

```
index.html                  # markup + ALL CSS (inlined); the game canvas + #ui overlay
build.mjs                   # mechanical bundler: strips import/export, wraps in one IIFE
src/main.js                 # wiring: input -> handlers -> engine -> renderers; window.__game debug hook
src/config.js               # CONFIG: every gameplay number incl. the `cards:` block
src/cards-data.js           # GENERATED from docs/cards.json (CARD_DATA, CARD_BY_NAME) — do not hand-edit
src/species.js              # starter-species roster: id/name/latin/vibe/blurb/portrait + starting hand ({name,count}) + resources; shared by the picker AND run seeding

src/engine/                 # pure simulation (no DOM)
  rng.js                    # seedable PRNG (deterministic sim)
  state.js                  # holds the list of networks; the active one; log
  substrate.js              # substrate field, surface line, cell flags (see §5)
  network.js                # the Network: nodes, growth, vitality, traits, harvest/dig primitives
  threats.js                # Trichoderma (green mould)
  ants.js                   # ant colonies + trails
  nematodes.js              # predatory worms
  actions.js                # the six basic actions (data-driven) — used when card layer is OFF
  turn.js                   # move/turn loop + end-turn resolution (tickWorld)
  cards.js                  # CARD RUNTIME: initCards, drawCard, skipRound, playCard, EFFECTS, offers/rewards
  puzzle.js                 # puzzle-mode setups

src/render/                 # rendering (canvas), driven from state
  camera.js                 # world<->screen, pan/zoom
  substrate.js              # cross-section terrain (baked)
  network.js                # per-network renderer (baked + animated)
  ui.js                     # HUD, action bar, hand carousel, log dropdown, offers, dev panel
  species_select.js         # start-of-run species picker overlay (#speciesSelect / .ss-* — namespaced; card faces derived from CARD_DATA)
  assets.js                 # sprite loading via assets/manifest.json
  lighting.js, noise.js     # visual helpers

test/smoke.test.js, test/cards.test.js
docs/                       # cards-design.md, cards-review.md, cards.json (SOURCE), cards.csv, ASSETS.md, STYLE_GUIDE.md
```

`window.__game` (set in `main.js`) is an invisible debug hook exposing
`state`, `draw()`, `skip()`, `play(i,ctx)`, `chooseCard(name)`, `botToGoal` —
used by Playwright tests and self-play. Not shown on screen.

---

## 4. Card layer — runtime summary

> **Design authority: [`docs/cards-design.md`](cards-design.md) (v10).** This section
> is a quick *implementation/runtime* map for the code, not the design spec. If the
> two ever disagree, `cards-design.md` wins and this should be corrected.

Turn on via `CONFIG.cards.enabled` (currently `true`). When on, the card layer
**replaces** the six basic action buttons.

- **Currencies:**
  - **Energy (⚡)** — the action currency. **Draw** costs `drawCostEnergy` (16) and
    pulls `drawCount` (3) cards; **Skip** costs `skipCostEnergy` (12) and advances
    the world without drawing. Passive income from occupied substrate + engines.
  - **Water (W)** — gates growth + substrate cards. Starts at 7, soft cap **999**.
  - **Phosphorus (P)** — gates digest/defense/work cards. Starts at 3, soft cap **999**;
    harvested from rock via Phosphate Tap.
  - **Soft caps** (`config.cards.softCapWater/Phosphorus`, both 999) are applied via a
    `gain(cur, amt, cap)` helper in `cards.js` = `max(cur, min(cap, cur+amt))` — it adds
    up to the cap but **never reduces** a pool that's already above it (a plain
    `min(cap, …)` used to slash Water/P down to the cap; that was the "Imbibition
    dropped my Water to 20" bug). Harvest cards report the *actual* gain and refuse
    ("… is already full") at the cap so the card isn't wasted.
  - (Spores exist in the pre-card mode only.)
- **Playing a card:** `cardBlockedReason` gates on run-over / dead / affordability
  only. Some effects are **affordable but can still no-op** (e.g. Hyphal Extension
  "No food within sensing range", Phosphate Tap off-rock, Constricting Ring with no
  worms) — `playCard` returns `{ok:false}`, logs the reason, and leaves the card in
  hand without charging. `main.js onPlayCard` returns the real `ok` so the UI only
  deselects on a genuine play (the carousel stays visible either way).
- **Targeted cards** (`EFFECTS[name].target`) need a map tap to aim; non-targeted
  resolve immediately.
- **Installed engines vs actions (the two HUD corners):**
  - `engine`-type cards → `state.cards.engines[]` (passive **income / timed / modifier**),
    shown in the **left ledger**. `EFFECTS` uses `engine(produce, msg)` → `{install}`.
  - `action`-type cards → `state.cards.actions[]` (**installed repeatable abilities**),
    shown in the **right Actions menu** with a **Use** button. `EFFECTS` uses
    `action(spec, run)` → `{installAction}`. Gating (`spec`): `every` (once-per-N-round
    cooldown → `cd`), `cost`+`res` (per-activation price), `per`+`used` (uses/round),
    `target` (aim a map point). `activateAction(state, i, ctx)` checks `actionUsable`,
    returns `{needTarget}` when a targeted action needs its point (main.js arms
    `ui.pendingAction`; the next map tap re-calls with `{x,y}`), then pays cost / starts
    `cd` / spends a use **only on a successful resolve**. `produceCardEngines` (each world
    tick) resets `used=0` and ages `cd` down.
  - **Action install cost = Energy only** — `playCard` / `cardBlockedReason` skip W/P for
    `type==='action'` cards (a card's W/P is its *per-activation* cost); the card face
    hides its W/P pip and the hand never greys it for W/P. Duplicate `action` installs are
    blocked ("Already installed").
  - `event` / `basic` / `extender` → one-shot (play → discard / shuffle).
- **Traps & wards:** Constricting Ring lays a snare into `state.traps[]` (`{x,y,r,reward}`);
  `resolveTraps` (turn.js, each tick after `stepNematodes`) digests a worm whose **swept
  path** (prev→current) crosses a trap for +Phosphorus, then spends the trap; `drawTraps`
  (main.js) renders a pulsing ring. Suberin Wall sets `cell.mouldProof` (a per-cell ward
  aged down each tick **after** infection resolves, so N = N rounds); `threats.js
  cellProofed` skips warded nodes in both infection vectors.
- **Growth never crosses rock:** `Network._segmentClear` samples each growth segment
  (~⅓ cell) so a strand stops at rock instead of hopping/grazing over it — only a
  punch/dig (`cell.bored`) may pass through rock. Used by `growDirected`, `_reachableSteps`,
  **and `_fanRing`** (Foraging Fan / `growRadial` — it previously checked only the ray's
  endpoint cell, so a ray could clip across a rock).
- **Opening hand:** `initCards` deals a free `drawCount` (3) off the top of the
  draw deck so turn 1 starts with cards in hand (no Energy charged for it; deck
  drops from 15 → 12). See `cards-design.md` §18.1.
- **Starter deck:** built from `CARD_DATA[].startCopies` (e.g. 5× Acorn Cache).
  Basics have `buyCostEnergy: 0` (you pay Energy to *draw* them).
- **Draw engines** (`DRAW_ENGINES` in cards.js): premium cards that shuffle 5
  copies of a basic into the draw deck (e.g. Acorn Fall → Acorn Cache). The UI
  shows a **text-only preview** of what they add when armed.
- **Card drafting:** finishing a **map food pile** (`foodKind === 'cache'`) offers a
  free pick of cards. Draft pool = `TUTORIAL_POOL` = tutorial cards **excluding
  basics**. The offer carries the pile's world `center`/`cells` and the reveal is
  animated (glyph rises at the pile → morph/expand into the panel — see §9).
- **Win:** a fruiting body reaches the **goal zone** (`checkGoalReached`).
  **Lose (stall):** card-dry and broke — no draw/skip/play/draft possible.
- **Art:** each card face uses `assets/cards/<slug>.jpg` (see §7 art pipeline).

---

## 5. Substrate food types (visual + conceptual split)

`substrate.js` cell flag **`foodKind`**: `'' | 'cache' | 'cache-engine' | 'nut'`.

- **`cache`** — map-placed NORMAL food (leaf litter). Rendered as **orange oak/maple
  leaf** sprites. Finishing a cache pile drafts a **Basic/Event** card. Set in
  `drop()` with `kind='normal'` (its `foodPiles` entry has `kind:'normal'`).
- **`cache-engine`** — map-placed ENGINE food, a rarer high-value pile. Rendered as
  a mix of **6 RED/autumn leaf** sprites (`leafRed{Maple,Oak,Sweetgum,Japanese,
  Dogwood,Beech}`, see `RED_LEAF_KEYS` in main.js) so it reads as a distinct, redder
  litter. Finishing it drafts an **Engine** card. Placed mostly near the SURFACE
  (config `substrate.engine{ClusterCount,ClusterRadius,SurfaceRows,DeepChance}`,
  ~3–5/map) so the player must climb UP to reach these. Set in `drop()` with
  `kind='engine'` (`foodPiles` entry `kind:'engine'`); the draft glyph reads RED
  (offer `kind:'engine'`). Colonise + digest exactly like a normal pile — there is
  no standing map icon (an earlier free-standing red 3-card marker was replaced by
  this leaf pile as more natural/on-theme).
- **`nut`** — player-placed food (Acorn Cache etc.). Rendered as **acorn / chestnut
  / pine-cone** sprites, denser + smaller than leaves. Gives **energy only, no
  card**. Set in `deposit()` (never downgrades an existing `cache`).

Rendering lives in `main.js drawSubstrateLeaves` → `_drawLeafHeap(sets, col, row,
kind, alpha)` which picks the sprite set by `foodKind` (`_leafSets()` returns
`{leaves, red, nuts}`): `count = isNut ? 8 : 11`, `base = cs * (isNut ? 0.26 :
0.64)`, sprite chosen by a stable hash so tiles are stable across frames (the
per-piece pick naturally makes each engine pile a varied mix of the 6 red leaves);
nut piles are muted via `ctx.filter`/`globalAlpha`. Leaf/humus cards are defined
but **shelved** (kept out of the active decks). Draft offers (`cards.js
pushCardDraft`) are split by `displayCategory`: a NORMAL pile offers Basic/Event, an
ENGINE pile offers Engine (`offerPileReward` picks by pile `kind`). **Basics + Events are
INFINITE** (always offerable, repeatable across drafts) — a basic grants
`cards.draftBasicCopies` = 3 copies, an event grants 1. Normal offers weight each slot
~60/40 toward basics (`cards.draftBasicWeight`, via `weightedNormalChoices`) so the few
basics aren't drowned out by the many events. **Engines are UNIQUE**, held in
`state.cards.draftable` (one of each per run) — `chooseOffer` removes a chosen engine from
that pool (+1 copy), while offered-but-unchosen engines stay and can reappear later.
Simultaneous pending offers reserve each other's engines so none is double-granted; if the
engine pool runs dry an engine pile falls back to basics.

---

## 6. UI / interaction model (current)

All UI is built in `src/render/ui.js`; all CSS is inline in `index.html`.
Both menus are dark, on-theme, with glowing green borders.

- **Top HUD** — one compact glowing **resource pill** (⚡ / W / P), each with an
  inline SVG mark (bolt / drop / spark, same size, centre-aligned) and its **per-round
  income range** beside the stock, e.g. `265 +4` · `301 +0–1` · `302 +1`. A **Log**
  button drops the event log down; it **auto-opens on player errors** (`openLog()`).
  No turn/step/vitality rows. The pill also carries a **red-bordered Actions pill**
  (top-right on phone / desktop) — a red pickaxe (inline SVG) + a **red ready-count
  badge**, no label. **Both pills are collapsible on click** (`ledgerOpen`/`actionsOpen`);
  they start **open on desktop**, **closed on phone**. On a phone the Log / ledger /
  Actions drop-downs are **mutually exclusive** and a tap anywhere outside an open one
  dismisses it (`_onTapAway`).
- **Two corner panels (card layer):** the **engine ledger** (top-left, under the pill)
  lists installed **engines** grouped by resource with per-round **income ranges**; the
  **Actions menu** (top-right dock) lists installed **actions** (each a **Use** button,
  red to match) plus any **auto** abilities (amber "AUTO" tag + countdown). Panel CSS:
  `.engledger` / `.actionsdock` / `.actmenu`; render: `_renderEngines` / `_renderActions`
  (+ `summarizeEngines` / `actionRowHTML` / `autoActionRowHTML`) in `ui.js`.
- **Bottom action bar** — the Show Hand · Draw · Skip · Play Card controls, text-only
  (icons dropped). **Desktop:** a **vertical tray to the right of the carousel**
  (`flex-direction: column`, pinned bottom-right). **Phone:** a horizontal one-row
  strip across the bottom. Legacy zone structure (below) still describes the grouping:
  - **left:** `Show Hand` ⇄ `Hide Hand` toggle (label reflects state; no chevron,
    no card-count badge).
  - **centre:** `Draw 3` / `16⚡` and `Skip` / `12⚡`.
  - **right:** `Play Card` — bright accent when a card is armed (shows that card's
    ⚡/W/P cost on the second row), a readable dim button when nothing is selected.
  - Every button is **two rows** (function on top, cost below). Empty cost rows
    collapse (`.bcost:empty { display:none }`) so single-label buttons stay centred.
- **Fixed CCG card shape** — every card face (hand + draft offer) is a locked **5:7**
  aspect (`.cardbtn`/`.offercard aspect-ratio:5/7`, `align-self:flex-start` so the flex
  row can't stretch them) with a **uniform 3:2 art window** (`.cart aspect-ratio:3/2`,
  `.caimg pointer-events:none` + `draggable=false` so dragging the picture scrolls the
  carousel instead of ghost-dragging the image). The rules box flex-fills; font/size are
  tuned so every current card's full text shows (longest ≈110 chars; keep new cards under
  that). Shape takes priority over card count → desktop now shows ~6.
- **Hand carousel** — a horizontal **drag-scroll** row on phone *and* desktop
  (touch scrolls natively; mouse uses `_enableDragScroll`, which adds **inertial
  momentum** on release so a mouse drag glides like a phone swipe, and suppresses the
  click after a >6px drag so a drag never arms a card). Browser view also has faint
  **transparent ‹ › nav arrows** flanking the row (no button chrome; `_updateHandNav`
  shows them only when the hand overflows; CSS hides them on phones). Identical cards
  **stack** (grouped by name with a count). Filter chips above. **Desktop layout:** the
  bottom **action bar is a vertical tray pinned bottom-right** and the carousel fills the
  space to its left (`.handbar left:12 right:192 bottom:16`). **Phone layout:** carousel
  above a horizontal bottom action strip.
  **Always visible by default** on every screen (`handOpen` starts `true`); the
  game never auto-hides or auto-shows it — the only toggle is the **Show/Hide
  Hand** button in the action bar (`toggleHand`). (The old
  `collapseHand`/`expandHand`/`_isNarrow`/`_watchViewport` auto-minimize plumbing
  was removed.)
- **Select → play flow (name-based):** tapping a card **highlights** it
  (`armCard`, toggles by name — tap again to deselect). `Play Card` runs
  `playArmed`, which resolves the hand index **by name at play time** (never a
  stored index, which can go stale after the hand splices). A successful play
  **deselects** the card but leaves the carousel visible. There is **no Cancel
  button**; the only popup is the +5 draw-engine text preview.
- **Aiming chip** — when a targeted card is waiting for a map tap, a "Aiming: X ✕"
  chip shows in the hand header; its ✕ cancels the aim. (Aiming no longer hides
  the carousel; tap the map anywhere outside the tray to aim, or Hide Hand first.)
- **Responsive:** narrow = `max-width:760px` **or** landscape `max-height:520px`
  (media queries in `index.html`). The tray body shows via the `.handbar.open`
  class on every screen.
- **Map view / camera clamp** — `main.js begin()` calls
  `camera.setWorldBounds(0, 0, worldWidth, substrate.viewHeight)` (the painted map
  rect: sky at `y=0` down to `viewHeight`, full world width). `Camera.clamp()` (run
  after every pan/zoom/viewport change) keeps the visible rect **inside** that
  box and enforces a `minZoomForBounds()` floor = `max(viewW/w, viewH/h)`, so you
  can neither pan nor zoom out far enough to reveal the empty `#05070d`
  background beyond the map. `fitBounds` clamps too, so refit/framing never
  over-zooms out. When the map is smaller than the view along an axis, that axis
  is centred.
- **Initial view = the colony** — a fresh sandbox run centres the camera on the
  colony's root node (`networks[0].nodes[0]`) at zoom ~0.85 (not the old whole-map
  overview), so the player sees their network immediately. Puzzle mode still fits
  the whole level.
- **Bottom dirt buffer** — `substrate.worldHeight` is the CONTENT region (grid +
  all generation/engine bounds stay inside it). `substrate.viewHeight =
  worldHeight + config.world.bottomBuffer` (2160) adds empty dirt below it that the
  **camera + renderer** use, so the player can scroll the deepest content clear of
  the bottom UI without minimizing the carousel. It's sized deliberately: on a
  phone portrait "fully zoomed out" is a *height-limited* min-zoom with no vertical
  scroll, so the buffer must be tall enough that, at that zoom, the buffer alone
  fills the carousel-covered band — leaving ALL content above the carousel. (Rule:
  `buffer ≥ worldHeight · bottomUIHeight / (viewportH − bottomUIHeight)`; worst
  measured case ~1406 on a 360×740 phone, so 1800 clears every phone with margin.)
  Nothing is generated in the buffer; the renderer paints seamless deep-soil brown
  down through it and `SubstrateRenderer._bakeBottomFade()` fades it to the void
  colour (`#05070d`, solid at the deepest band) so the map's end reads clearly.

### Network rendering systems (`render/network.js`, `render/lighting.js`)

- **LOD:** `_strokeStructure` (per-node detail, iterates every node/frame) vs
  `_strokeBatched` (baked `Path2D` per width bucket, ~4 stroke calls). `_rebuildCaches`
  runs on `structureDirty` and **self-heals** if `_builtNodeCount !== nodes.length`.
  `simplify` (batched) kicks in when `detailAmt <= 0.02` (zoomed out or ≳1900 nodes).
- **Animated growth (render-only):** a grow adds all nodes to the sim instantly (income /
  collision / infection / win-checks unchanged); only the DRAW is delayed. `draw()` detects
  freshly-grown nodes by **identity** (per-node `_revSeen` flag — robust to a grow + a
  same-frame threat removal that compacts the array) and stamps each new node's `_appearAt`
  staggered **base→tip** over `count*55 ms` clamped to `[1000, 2400]`. `_strokeStructure`
  draws a not-yet-arrived node as a partial line that extends + fades over `REVEAL_SEG`
  (340 ms). `revealFactor(node, time)` (0…1; 1 in batched LOD) is the single source of truth,
  used by `_strokeStructure`, the nutrient-pulse ring (skips strands still growing in), and
  **`lighting.compose`** — the network glow + sensing aura follow the reveal (skip un-started
  nodes, move + fade each light with the growing tip; the sensing `sparseBoost` is
  reveal-weighted) so the colony never **flashes its end state** before animating.
- **WYSIWYG solid rock (`main.js solidifyRock`)** — every rock TYPE is drawn as a sprite
  larger than its cell footprint, so mycelium in the open soil a sprite covers used to look
  like it grew ON the rock. Once per map (guarded by `sub._rockSolidified`, called in `frame()`
  before the rock draws) `solidifyRock` stamps EVERY sprite — boulders (`drawBoulder`),
  formations (`formationRect`), columns (`drawRockColumns` geometry). `stampSolid` samples the
  sprite's **opaque silhouette** (alpha, rotation-aware; per-image mask built once + cached in
  `_alphaMaskCache`) and marks each covered soil cell `rock` + `rockFill`. `rockFill` cells are
  excluded from `rockGroups` (never re-drawn as their own boulder); food / water / above-surface
  cells are skipped. **Winnability is deliberately NOT protected** (the old `pathClear` corridor
  exception was removed) — the owner verifies maps directly.

---

## 7. Conventions

- **Branch:** all work on `claude/mycelium-phase-1-build-urvq5e` (repo
  `pallkvaran-blip/mycelium2d`). Never push elsewhere without permission. **No PR
  unless explicitly asked.**
- **Commits:** clear messages; footer lines
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and
  `Claude-Session: <url>`. Never put the model identifier in commits/PRs/code.
  Push with `git push -u origin <branch>` + retry/backoff on network errors.
- **Card data flow:** edit `docs/cards.json` (source) → regenerate
  `src/cards-data.js` (`node scripts/gen-carddata.mjs`). Do not hand-edit the
  generated file.
- **Art pipeline (card faces + sprites):** Replicate **FLUX schnell** for card
  illustrations (see `scripts/gen_*.py`), **BiRefNet matting** (`gensprite.sh`) for
  transparent sprites. Candidate options land in `assets/card_options/`; winners
  are promoted to `assets/cards/<slug>.jpg`. New sprites need a `assets/manifest.json`
  entry. **Secrets:** `REPLICATE_API_TOKEN` lives only in the scratchpad
  `.replicate_token` (read via env) — never commit it.
- **Outbound HTTPS** goes through the agent proxy (CA `/root/.ccr/ca-bundle.crt`);
  never disable TLS.

---

## 8. Testing & verification

- **Headless engine:** `test/smoke.test.js` (86 assertions incl. "colony can be
  routed to the goal" winnability) + `test/cards.test.js`.
- **Visual / interaction:** Playwright (`node_modules/playwright-core`,
  Chromium at `/opt/pw-browsers/chromium`) driving `dist/` served over
  **HTTP** on `:8199` — `file://` blocks `manifest.json` (CORS) so sprites won't
  load. Tests use `window.__game.state` to inject scenarios (e.g. a known card in
  hand) and `window.__game.skip()` to force a UI re-render, then assert DOM state.
  Deterministic no-op card for "affordable but does nothing" tests:
  **Constricting Ring** with `state.nematodes = []`.
- **Adversarial review workflow:** for larger diffs, run a Workflow that fans out
  review dimensions → **independently verifies each finding** (skeptics try to
  refute) → only confirmed bugs get fixed. This caught the stale-index and
  effect-level-no-op-minimize bugs.

---

## 9. Recent work log (most recent first)

- **Title screen** (`src/render/title_screen.js` — new; `main.js` boot, `species.js resetProgress`,
  `build.mjs` MODULES, `index.html` `#titleScreen`/`.ts-*` CSS). Procedural white **MYCELIUM** on
  black: a self-contained **space-colonization** growth fills the letter glyphs with a DENSE mat of
  fine white filaments — the letters are made **entirely of strands** (no fill/ghost/second colour;
  legibility comes from strand density) — and each letter edge is fringed with short branch-tipped
  stray strands. Growth animation: **each letter blooms from its own single RANDOM point** (one seed
  per letter x-band), all at once, paced by a fractional step accumulator (`STEP_RATE` ~1.4/frame).
  Fine seg + short attraction radius keeps the grid cheap. Menu is DOM (layout/a11y/grayed states),
  canvas overlays it (`pointer-events:none`); title sits at `titleY≈0.47H`. Contents: **Survival** —
  large **New / Old**; **Campaign** — New / Old (grayed) + "coming soon". (Words are big,
  `clamp(40px,7vw,84px)`, tight `letter-spacing:.02em`; NEW/OLD are both 3 letters → naturally
  symmetric.) **Vertical layout is symmetric about the title** (`positionMenu()`, run from `layout()`):
  both NEW/OLD rows sit the same distance `D` from the title centre, and SURVIVAL / CAMPAIGN sit the
  same distance `G` outside their row — computed from measured row heights, so it's exact on any
  viewport (the blocks are JS-positioned around `titleY`, NOT edge-pinned). "coming soon" is tucked
  ~3px under CAMPAIGN and deliberately excluded from the symmetry. Horizontal centring: `.ts-actions`
  is a **`minmax(0,1fr) minmax(0,1fr)`** grid with the left word right-aligned / right word
  left-aligned around a centred `column-gap`, so the **gap centre = SURVIVAL centre = screen centre**
  at every width (plain `1fr 1fr` let a wider word grow its track and shove the gap left).
  Pressing New/Old (`consume()`, at +300ms `growButtonWord()`) grows the mycelium word out of the
  title in **TWO bell-paced phases**:
  - **STRAND** — ONLY a branching strand is laid; it climbs (coarse seg) from the nearest MYCELIUM
    node to the word's MIDDLE letter (E in NEW, L in OLD). Nothing else grows yet, so the word doesn't
    start filling early. Rate ramps `STRAND_MIN`→`STRAND_PEAK` (`sin` quarter-wave) — nice and slow.
  - **BLOOM** — the instant the strand reaches the letter (`frame()` detects it via a cheap running
    `g.minY`, with a `STRAND_MAX` time fallback), the glyph/fringe/strays + **connector strands** to
    the other letters are added and each letter is **burst-seeded** as it's reached; the other letters
    fire **one at a time** (staggered) so the word unfurls middle-outward. This phase runs on its OWN
    bell (`BLOOM_DUR`/`BLOOM_MIN`/`BLOOM_PEAK`, `sin` over 0..π): slow again as it hits the letter →
    full speed → eases off at the end. `BLOOM_PEAK` is deliberately LOW so the fill is rate-limited
    (bell-controlled) — otherwise front-multiplication blasts through the attractors at the peak and
    there's no visible slow-down at the end.
  Strand climbs at a coarse seg (must stay < bridge spacing or the wander lets `kill2` eat the next
  attractor and the strand stalls); letters fill at a fine seg so they read like the title. Glyph is
  supersampled (`sampleWord`, ×2 → ~1px sampling); casing follows the button's `text-transform`
  (canvas `fillText` ignores CSS → uppercase it explicitly). The transition (`finishFn`) is scheduled
  relative to bloom-start (`BLOOM_DUR - 150`), with a safety cap in `consume`. Keep attractor count
  modest — each `step()` iterates ALL of them, so an over-dense supersample throttles the frame rate
  and the strand crawls. **New** = `resetProgress()` (wipe unlocks) → picker; **Old** = keep unlocks →
  picker. Boots before the picker (default boot only; `#dev`/`#puzzle`/`#notrich` still skip it).
  `prefers-reduced-motion` → grows synchronously.
  **Gotcha:** pixel-mask sampling MUST step the loop by an integer (fractional index into the typed
  array → `undefined` → no attractors → nothing grows).

- **Campaign: level progression 1→11 + species unlocks** (`src/species.js`,
  `src/render/species_select.js`, `src/main.js`, `src/render/ui.js`, `index.html`; commit `0989061`).
  A run is now a ladder of **11 procedurally-generated levels**; maps stay procedural, only the
  **threat counts scale per level** (owner table in `species.js LEVEL_THREATS`: e.g. L1 = 1 ant /
  1 nematode / 1 mould … L11 = 6/6/6). `main.js configForLevel(level)` clones CONFIG and sets
  `ants.nestCount` / `nematodes.initialCount` / `trichoderma.initialPatches`.
  - **Carry between levels:** winning a level transplants the whole `state.cards` (hand/draw/discard/
    engines/actions/draftable) + resource pools onto the next map (`snapshotCarry`/`applyCarry`;
    `carryOver` beats `initCards` in `begin()`). Round + pendingOffers reset; engines are pure income
    data (no map anchor) so they carry cleanly. Beat L11 → **game won** (`showGameWon`).
  - **End-of-run routing:** all `state.runOver` sites funnel through `presentRunOver()` (guarded by
    `_runOverPresented`). A **win** → `showLevelComplete({level,maxLevel,unlocked,onNext})` — a
    congratulatory panel; if the cleared level unlocks species it shows "Congratulations! You unlocked
    a new species — available on your next run" + the species as **inspectable cards**, then "Descend
    to level N+1". A **death** → `ui.showOverlay` whose button now returns to the species picker
    (`handlers.onBackToPicker` → `backToPicker()`).
  - **Unlocks persist + STAGGER per clear-count** in `localStorage` (`mycelium.progress.v2` =
    `{clears: {level: count}}`; `loadProgress`/`recordLevelCleared`/`clearsFor`/`isUnlocked`/
    `newlyUnlockedByClear`). The **k-th species** pinned to a tier unlocks on the **(k+1)-th clear**
    of that level — so clearing level 1 the first time grants Common Earthball, a second clear
    (another run) grants Bleeding Tooth, a third grants nothing. An unlocked species **stays in its
    tier row** (playable in place, no LOCKED badge) — it is NOT promoted to "Available now", which
    holds only ungated species. Only **Complete level 1** pins real species today; other tiers are "?".
  - **Level-complete overlay** (`showLevelComplete`): a "🍄 Level N of 11 cleared" badge, then (if a
    species unlocked) an elevated "✦ New species unlocked" headline + subline + the inspectable card,
    then a **"Next level →"** button. No verbose title/paragraph. Threat spawn depth (trichoderma +
    nematodes) is capped at 60% of map depth (40% shallower). Spawn placement is centralised in
    **`Substrate.findSpawnSpot(rng, {root,minDist,avoidFood,i,count})`** (used by `openSpot`/
    `pickOpenSpot`): it (a) keeps a **4-cell clearance from rock** (`rockNear`) because rock SPRITES
    render several cells past their flagged cells and `solidifyRock()` only fills that true footprint
    at render time — a bare `cell.rock` check let threats land on top of rocks; and (b) spreads spawns
    **evenly across horizontal bands** (`i`/`count`) — without banding, the shallow cap + rock density
    piled almost every enemy onto the one clear strip near the goal (measured 33/42 worms in the last
    20%). Falls back shallow→deep→anywhere so a band still gets a spawn. Verified ~243 spawns: 0 on
    rock, even x-spread (mean ~0.63).
  - **Picker chrome** is intentionally minimal: header is just "MYCELIUM" + "Select your species"
    (no eyebrow tag / lede paragraph); the first row is "STARTER SPECIES" (ungated only); gated tiers
    are labelled just "COMPLETE LEVEL N" + a divider (no lock glyph, no "Unlock ·", no "N species"
    hint); locked cards show a plain "Locked" chip (no 🔒). **Gotcha:** the species DETAIL overlay
    (`.ss-detail`) is a fixed-max-height grid with `overflow:hidden`, so its scrolling body needs
    `grid-template-rows:minmax(0,1fr)` + `.ss-d-body{min-height:0}` — without it, a species with >3
    card types grew the row past the panel and clipped the Cancel/Start buttons out of reach.
  - **HUD:** a small `#levelChip` ("Level N / 11") top-centre; hidden in puzzle mode. A temporary
    **"Dev: win level ▸"** button (top-right, amber dashed) instantly clears the level to test the flow.
  - **Debug hooks** on `window.__game`: `winLevel()` (= the dev button) / `killColony()`.
  - Verified end-to-end in the build: L1 threats 1/1/1 → carry 30E/30W + 20-card Fairy Ring hand to
    L2 (1/2/2); L1 clear unlocks 2 species (persist across reload); death → picker; 0 errors; tests green.

- **Start-of-run SPECIES PICKER + dev quick-start** (`src/species.js`, `src/render/species_select.js`,
  `src/main.js`, `src/engine/cards.js`, `index.html`, `build.mjs`; commit `ac4de85`).
  - **Boot flow:** a normal sandbox boot now shows the species-selection screen FIRST (main.js boot
    block) instead of calling `start()` immediately. `showSpeciesSelect({onPick,onDev})` renders the
    overlay; `onPick(sp)` sets module var `chosenSpecies` and starts the run, `onDev()` clears it and
    starts the default run. `begin()` then does `chosenSpecies ? initCards(state,'species',chosenSpecies)
    : initCards(state,'testall')`. **Restarts (New Map) reuse the last pick.** Hash bypasses:
    `#dev` skips the picker (default run); `#puzzle` / `#notrich` / `#ants` unchanged.
  - **`initCards(state, mode, species)`** gained a `'species'` mode (`engine/cards.js`): deals the
    species' exact hand (`for {name,count}` → push copies, guarded by `CARD_BY_NAME` + `isArchived`)
    and sets `net.energy/water/phosphorus` from `species.res`. The normal `startCopies` **draw deck is
    kept** so Draw + the depletion clock still work — the species defines the opening HAND, not the deck.
  - **Roster (`src/species.js`)** — single source of truth for BOTH the picker and run seeding:
    - Playable now: **Fairy Ring Champignon** *(Marasmius oreades)* — Foraging Fan ×8, Hyphal Extension ×6,
      Acorn Cache ×6 · 30E/30W. **Honey Fungus** *(Armillaria ostoyae)* — Apical Drive ×10, Rhizomorph
      Lance ×5 · 100E/25W.
    - Locked (unlock `'Complete level 1'`, shown as dimmed lock-badged previews — inspectable, Start
      disabled): **Common Earthball** *(Scleroderma citrinum, spore vibe)* — Sclerotial Crust ×2,
      Amputate ×2 (both P-gated), Apical Drive ×5, Hyphal Extension ×3, Acorn Cache ×3 · 50E/30W/5P.
      **Bleeding Tooth Fungus** *(Hydnellum peckii, aqua vibe)* — Aquaporin Channels ×1 (free engine),
      Hyphal Extension ×5, Apical Drive ×5, Foraging Fan ×5, Acorn Cache ×3 · 50E/20W.
    - `LOCKED_TIERS`: level 1/3/5/7 = 2 each, level 10 = 1, then a communal "?" row of 8.
  - **Auto-consistency with the game:** the picker's card faces (effect, type, play-cost W/P pips, art)
    are looked up LIVE from `CARD_DATA` + `assets/cards/<cardSlug>.jpg` — the same data/art the in-game
    hand uses — so changing a card's cost/description/art (via `cards.json` → `gen-carddata.mjs` → rebuild,
    or swapping the jpg) updates the picker automatically. Only card **names** are referenced from
    `species.js` by hand, so a rename/removal needs a `species.js` touch (guarded: unknown names drop).
  - **Portraits** (realistic, FLUX-dev): `assets/species/{marasmius-oreades,armillaria-ostoyae,
    scleroderma-citrinum,hydnellum-peckii}.jpg` (gen scripts `scripts/gen_species_real*.py`,
    `gen_earthball_redo.py`). Copied to `dist/assets/` by the build like all art.
  - **CSS** lives in `index.html` `<style>` (build's CSS source of truth), **fully namespaced under
    `#speciesSelect` / `.ss-*`** so it can't collide with the game's own `.card` / `.overlay`.
  - **Render-loop guard:** `frame()` early-returns (keeps requesting frames) while `state` is null, so
    the loop doesn't throw before the first run is created (the picker sits over the un-revealed canvas).
  - There is ALSO a standalone design mock at `docs/species-select.html` (published as an Artifact,
    data + images INLINED) — a frozen snapshot; it does NOT track card/data changes. The in-game picker
    is the living version.
  - Verified in the built `dist/`: picker shows 2 available + 2 locked-level-1 + `?` tiers; Fairy Ring →
    30E/30W/0P + {Foraging Fan 8, Hyphal Extension 6, Acorn Cache 6}; Honey Fungus → 100E/25W + {Apical
    Drive 10, Rhizomorph Lance 5}; Dev button → 300E/W/P + 5× every card (260-card hand); game reveals &
    plays; 0 console/page errors; build clean.

- **Floating "+N⚡" energy labels over food piles** (`main.js`, `engine/cards.js`).
  - **Tap a food pile** → its CURRENT energy value floats up over it (remaining nutrient ×
    `incomeEfficiency`, green number + a bolt icon), then fades. Wired into the tap handler
    (`showPileEnergyAt`, after the worm/mould inspect) — finds the nearest food cell within a
    forgiving tolerance, sums its registered pile (or a flood-fill of a loose cache).
  - **Finish a pile** → a "+N⚡" pops slightly ABOVE where it was (so it clears the rising draft
    glyph) then fades quickly. `offerPileReward` stamps `pile.finishEnergy` (surviving cells ×
    efficiency) + `pile.center`; `spawnFinishFloaters` (per frame) pops it once (`pile._floated`).
  - Render: `drawFloaters` draws the number + the HUD's `RES_ICON` bolt (as a `Path2D`).
    **Style (final, `54a9b73`):** the number is **green** (`#7fe6a3`, the top-pill `--accent`) and
    the bolt stays **gold** (`#f4c22e`, matching `RES_ICON.energy`); the font + icon were shrunk to
    match the pill (default size 13, tap/finish 14 — down from ~20/21).
    Two gotchas found + fixed: (1) it must **pin the base DPR transform + `source-over`** — a
    prior world-space/`'lighter'` pass otherwise flung the text off-screen / composited it away;
    (2) aging is **frame-based** (`age`/`life`), not wall-clock, so erratic rAF timestamps can't
    skip or freeze it, and the fade-in is near-instant so it's never a full frame at alpha 0.
  - Verified: build clean (0 import leaks), 101 smoke + 60 card green, a 4-check engine harness
    (finishEnergy = cells × 50 × 0.6; mould-eaten pile = 0), and browser screenshots ("210⚡" green
    over a tapped pile; "+43⚡" on finish) with 0 console errors.

- **Mould eating slowed another 3×** (`config.js`): `trichoderma.leavesPerRound` 0.67 → **0.22**
  (~2/9 cells/round, ≈1 leaf every ~4–5 rounds). A ~29-leaf pile now clears in ~132 rounds
  (was ~44). One config knob; smoke test still green (clear + size-scaling).

- **Threat tuning: hide ant HP bars, calmer worms, wider worm sight, slower mould eating** (branch same).
  - **Ant nest HP bars removed** (`main.js` `drawAnts`) — nest health is no longer surfaced.
  - **Nematode wriggle ~50% slower** (`main.js` `drawNematodes`): the writhe frequency `time*0.007`
    → `time*0.0035` (render-only; less frantic).
  - **Nematode sight range 360 → 500** (`config.js`) to match the mould's `sightRadius`.
  - **Mould eats food ~3× slower** (`config.js`, `engine/threats.js`): `trichoderma.leavesPerRound`
    2 → **0.67** (avg cells/round). Eating is now a fractional per-cloud "bite budget"
    (accumulate `leavesPerRound`/round, capped at 2 so a roaming cloud can't hoard, spend only the
    whole cells actually eaten); `eatUnder` returns the CELL COUNT. A ~29-leaf pile now clears in
    ~44 rounds (was ~15). Smoke test updated to the fractional rate (≤1 leaf in round 1; fully
    cleared but in ≥ start/leavesPerRound rounds).

- **Threat behaviour: worms shadow ant trails; mould prefers you + eats slowly** (branch same).
  - **Nematodes** (`engine/nematodes.js`) — new movement priority: (1) a colony strand in
    sight (clear LOS) → crawl to it and feed/breed as before; (2) else the nearest **ant TRAIL**
    cell within `sightRadius` (clear LOS) → drift toward it (they shadow the ants' foraging
    lines but never touch the ants); (3) else **hold position** — they no longer wander
    aimlessly. Trail cells are gathered once per tick (set by `stepAnts` earlier in `tickWorld`).
    New `nearestPointInRange()` helper; `w.trailing` flag. `wanderSpeed` is now unused.
  - **Trichoderma** (`engine/threats.js`, `config.js`): (a) movement now **prefers mycelium** —
    if any strand is in sight it heads there even when a food pile is closer; only with no strand
    in range does it target the nearest visible food. (b) food-eating is **rate-limited**:
    `eatUnder` clears only `trichoderma.leavesPerRound` (2) food cells ("leaves") per round,
    nearest-first, so finishing a pile scales with its size instead of vanishing in one gulp.
  - Test updated: the old "whole pile gone in ≤9 actions" case now asserts the new rate
    (exactly `leavesPerRound` cleared in round 1; pile fully cleared but in ≥ start/leavesPerRound
    rounds) with the colony disabled so it doesn't lure the mould off the pile.
  - Verified: build clean (0 import leaks), **101** smoke + 60 card green, and an 8-check headless
    harness (worm holds / trails / colony-trumps-trail; mould picks the colony over closer food).

- **Follow-up polish: tinier start, unified resource icons** (branch same).
  - `growth.startDepth` 58→**20** — an even smaller opening sprout (~3 nodes).
  - The left income ledger and the Nutrient Transmutation picker now use the SAME
    resource marks as the top pill (the `RES_ICON` SVGs — gold bolt / blue drop /
    purple spark) instead of mismatched emoji, at a uniform, slightly-smaller size,
    vertically centred so the icons line up. `.erow .eval.lead` is now an
    `inline-flex` (number + icon share one baseline); the picker tints each mark to
    its pill colour.

- **Card + HUD fixes: transmute choice, ledger layout/size, warded blue, smaller start, seal text** (branch same).
  - **Warded strands now a DEEP BLUE** (`config.js` `render.warded` `#5cd9e6`→`#2f5fe6`) — the cyan read too
    close to the mint colony; deep blue separates cleanly.
  - **Nutrient Transmutation now lets you CHOOSE the resource to gain** (`cards.js`, `render/ui.js`,
    `main.js`). Was auto (bigger pool → smaller). Now `resourcePick:true` on the action → `activateAction`
    returns `needResourcePick` (like `needTarget`) → `ui.showResourcePicker(i)` (reuses the ability-picker
    overlay: "Gain 1 Water −2 Phosphorus" / "Gain 1 Phosphorus −2 Water", disabled when the source pool < 2)
    → `onPickResource` re-activates with `ctx.res`. The per-round use isn't spent on the ask.
  - **Left income ledger row re-laid-out** (`render/ui.js` `_renderEngines`, `index.html`). The income
    (`+2⚡` etc., resource-tinted) now LEADS the row — it replaces both the old glowing dot AND the old
    right-aligned value; the name follows, cadence lights stay right. New `.erow .eval.lead` CSS.
  - **Left ledger no longer balloons** (`render/ui.js` `_syncPanelHeights`). It used to force the income
    pill to the height of the (tall) Actions menu, so installing engines/actions grew a big empty box.
    Now each corner panel sizes to its own content (CSS `max-height` still caps + scrolls).
  - **Smaller starting colony** (`config.js` `growth.startDepth` 130→58) — a short sprout (~4 nodes) instead
    of a long filament, matching the requested opening look.
  - **Fruiting Vigil is now a BASIC card** (`cards-data.js` + `docs/cards.json`: type/displayCategory
    event→basic) — drafts from the basic pool (infinite, 3 copies).
  - **Sclerotial Seal card text** → "seal any food pile" (was "the nearest food pile"); in-code action label
    matches. (Functionally it already seals whichever pile you aim at, within a generous reach.)
  - **Forager Bloom investigated — NO code bug**: a 6-seed headless diff proved its grow output is
    byte-identical to Foraging Fan (both call `growRadial`), and the action path refreshes the renderer the
    same way. The only real differences are the intended action semantics: a `every:6` cooldown and that
    using an action doesn't advance the world (a card play does). A pending DRAFT also blocks action use
    (the draft-lock), which can read as "nothing happened".
  - Verified: build clean (0 import leaks), 100 smoke + 60 card green, a 10-check headless harness
    (transmute both directions + insufficient-source + no-spend-on-ask, Fruiting Vigil basic, seal text,
    warded colour, start depth), and a browser pass (0 console errors; ledger 92px not ballooned, income
    leads each row, no "/rd"; transmute picker shows; start colony = 4 nodes) + screenshots.

- **Defense-card pass: seal fix, timed immunity, warded colour, pill lights, staggered pile fade** (branch same).
  - **Sclerotial Seal now works + is forgiving + reroutes ants** (`engine/cards.js`, `engine/ants.js`).
    Was: tap had to land exactly on a nutrient cell (`cellAtWorld(...).nutrient>0`) or nothing happened,
    and a sealed pile just made the nest idle in place. Now: seals the WHOLE nearest food pile within a
    generous reach (`cards.sealReach` 8 cells ≈ 288 px) plus loose food in a 3-cell radius, then calls the
    new exported `recalibrateAnts(state)` — `buildTrail` skips `antProof` food and `stepAnts` retargets a
    nest whose target is sealed, so the column reroutes to other food immediately. Seal stays permanent
    (`antProof = 9999`); the pile is consumed anyway.
  - **Harden/immune are now TIMED (10 rounds), not permanent** (`cards.js`, `config.js`, `turn.js`,
    `substrate.js`). New `cell.hardened` (eating immunity) is a round COUNTER like `mouldProof` (both aged
    in `turn.js` after threats act, check-then-age); worm/ant eat checks read `hardened > 0`. New shared
    `hardenPatch(state, ctx, r, rounds, eat)` sets `mouldProof` (+ `hardened` when `eat`) to
    `cards.immuneRounds` (10). Applies to Sclerotial Crust, Sclerotial Rind, Crust Reserve (infection
    only), Suberin Wall (infection only). Card `effect` text updated in `cards-data.js` **and**
    `docs/cards.json` (e.g. Crust Reserve → "…immune to infection for 10 rounds").
  - **Protected part of the colony is recoloured** (`render/network.js`, `config.js`, `main.js`). Renderer
    now takes the substrate; on each structure rebuild (fires after every play/tick) it tags nodes on a
    hardened/immune cell (`hardened>0 || mouldProof>0`, NOT Rehydration's hidden grace) `n._protected` and
    strokes them in a new cool-cyan `render.warded` (`#5cd9e6`) — a "crust" sheen distinct from the pale
    colony and yellow-green mould, in both the batched-LOD and detail paths.
  - **Rehydration Pulse: +50% radius + hidden anti-reinfection grace** (`cards.js`, `threats.js`,
    `substrate.js`). Radius 60→90 (`cards.rehydrateRadius`); cured cells get `cell.reinfectGrace = 1`
    (new field, aged in `turn.js`) so the mould can't re-take the patch on the very next tick.
    `cellProofed` checks `mouldProof>0 || reinfectGrace>0`. Grace is NOT tinted (kept invisible per the ask).
  - **Top-left ledger + right actions pill: steady rows show an always-on light, not "/rd"**
    (`render/ui.js`). `cadenceLightsHTML` renders one lit `.clight.on` (resource-tinted) for `cad<=1`.
  - **Food piles fade one-by-one with their own draft** (`main.js`, `cards.js`). `offerPileReward` links
    `offer.pile` and sets `pile.draftHeld`; `drawSubstrateLeaves` keeps a held pile's heap FULL until its
    draft's glyph rises (`updateDraftIntro` clears `draftHeld` + stamps `pile._fadeAt`), then fades from
    that moment. So several piles finished in one round vanish as each is drafted, not all at once.
  - Verified: build clean (0 import leaks), 100 smoke + 60 card green, a 19-check headless engine harness
    (10-round decay to 0, timed eat immunity, seal whole-pile + ant reroute, grace lapse, draftHeld link),
    and a browser check (0 console errors; ledger renders the light + no "/rd"; Sclerotial Crust warded
    7/9 nodes cyan) + a zoomed screenshot confirming the colour reads.

- **Grow SFX trails less after growth stops** (`render/sfx.js`, branch same).
  - Symptom: the grow sound kept ringing well after strands stopped appearing. Two causes:
    (1) `assets/sfx/grow.wav` is a **long, sustained** swell (~2.4 s, loud most of the way — not a
    decaying tail), so even one hit rang ~2.4 s; (2) `playGrowBurst` staggered its layers across the
    whole reveal `spread` (up to 2.4 s), so the LAST hit started ~2.4 s in and *then* rang on.
  - Fix, both without cutting a sound mid-body:
    - **Front-load the stagger**: `const stagger = Math.min(spread * 0.45, 0.7)` (was the full
      `spread`) used in the jitter + `when` calc, so even a big fan fires all its hits within ~0.7 s
      near the start — the latest growths' sound now leads the reveal's tail instead of chasing it.
    - **Release each hit**: new `HOLD_S` (1.3 s full-gain body) + `RELEASE_S` (0.4 s) gain envelope in
      `hit()` — hold, then `linearRampToValueAtTime(0.0001)` and `src.stop` — so a single hit rings
      ~1.7 s (was ~2.4 s) and settles with a gentle ramp, never an abrupt mid-sample cut.
  - Verified: build clean (0 import leaks), 100 smoke + 60 card green, headless boot 0 console errors
    (audio *feel* to be confirmed in-app by owner — headless can't judge timing by ear).

- **Start economy tuned + normal drafts weighted toward basics** (branch same).
  - Real start economy set to `energy.start` 120→**50**, `cards.startWater` 7→**10**,
    `cards.startPhosphorus` 3→**0** (turn-1 verified viable: playable grows in the opening hand,
    P-gated cards wait for Phosphate Tap, ~3 draws / 4 skips before you must feed). NOTE: the
    `'testall'` dev scaffold is **still ON** (owner is re-testing every card), which overrides these
    with 300/300/300 — flip `main.js` to `initCards(state)` to see the real opening.
    _(Superseded: `testall` is now behind the species picker's **Dev quick-start** button; a species pick
    seeds that species' own hand/resources instead. See the picker entry at the top of §9.)_
  - Normal (basic/event) drafts now **weight ~60/40 toward basics** (`cards.draftBasicWeight` 0.6)
    via `weightedNormalChoices()` — was uniform over the 6 basics + 16 events (~27% basic), so basics
    were too rare. Verified: ~60% basic across a large sample; test asserts the band.

- **Draft economy: infinite basics (3 copies) + events (1 copy); unique engines** (branch same).
  - Was: every draft re-sampled the full category pool, so cards could be drafted repeatedly and
    basics gave only 1 copy. Now: **basics** are infinite → drafting one grants
    `cards.draftBasicCopies` (3) copies. **Events** are infinite too (repeatable) but grant 1 copy.
    **Engines** are UNIQUE — one of each per run, held in `state.cards.draftable` (built in
    `initCards` from `uniqueDraftNames()`, engines only); `chooseOffer` removes a chosen engine
    permanently (+1 copy), while offered-but-unchosen engines are never removed so they can reappear
    in a later draft. `pushCardDraft` reserves engines already in other pending offers (no
    double-grant) and falls back to basics if the engine pool runs dry. Helpers:
    `basicDraftNames()` / `eventDraftNames()` / `uniqueDraftNames()` / `draftCat()` (replaced
    `draftPool()`); `chooseOffer` returns `copies`.
  - Tests: basic → 3 copies & infinite; event → 1 copy, infinite, re-draftable; engine → 1 copy &
    leaves the pool; un-chosen engines stay; a drafted engine never reappears (real flow). Verified
    in-browser (double-click a basic → hand +3). 58 card + 100 smoke green.

- **Defeat now fires when the colony is EATEN (not just starved)** (branch same).
  - Bug: the death check (`turn.js`, "colony consumed") lived inside `for (const net of
    state.networks) { if (!net.alive) continue; ... }`. Worms (`stepNematodes`) and ants run
    BEFORE that loop and `_removeNodes` flips `net.alive = false` the instant the last strand is
    eaten — so the loop `continue`d past the death block and the run never ended (no "colony has
    died" overlay). Starvation/infection deaths happen inside the loop, so those worked.
  - Fix: a catch-all after the loop — if the ACTIVE colony is wiped (`nodes.length === 0 ||
    healthyCount() === 0`) and `!runOver`, set `runOver` + `runResult.died` + log. `resolveCardOp`
    already surfaces the death overlay on `runOver`. Also relevant now that worms eat every tick +
    breed at 0.8. Smoke test: a worm on every strand → run ends in defeat, colony wiped.

- **Nematodes more dangerous** (branch same): `eatEveryTicks` 2→0 (a feeding worm eats a strand
  every tick), `breedChance` 0.35→0.8 (swarms explode). Exposed `eatEveryTicks` as a "Worm Eat
  Cooldown" slider (0–5). (A tick = one world-advancing action; the game is turn-based.)

- **Nematode swarms fan out instead of bunching** (branch same).
  - Cause: every worm's movement target was `nearestVisibleNode(..., null)` — the plain nearest
    strand — so the whole swarm converged on ONE node. Fix (`nematodes.js stepNematodes`): a per-tick
    `targeted` Set; each worm heads for the nearest in-sight strand **no other worm has already picked
    this tick**, falling back to the plain nearest only when every visible strand is taken (more worms
    than strands). Worms now store `w.targetId` (their chosen strand — also handy for a future
    locked-on render). Eating is unchanged (still claims a distinct strand per worm/tick).
  - Test: new smoke case — 4 clustered worms + 4 spread strands → 4 DISTINCT targets. Also hardened
    the puzzle-route winnability test, which shared one RNG stream with the threats via `tickWorld`
    (so ANY worm-behaviour tweak perturbed its seed-sensitive growth): it now drops all threats
    (no respawn) and does a deterministic final grow straight at the chest, so it purely checks the
    route is growable / chest reachable. 97 smoke + 45 card green.

- **Draft panel: minimize to a chip; no Draft button; locks play until chosen** (branch same).
  - Removed the "Draft Card" button — **double-click** a card drafts it (single click previews).
  - Added a **▾ minimize** button (top-left of `.offerbox`, `#offerminbtn`) that sets the draft aside:
    the panel hides and a small **glowing 3-card chip** (`.offermin`, white / red for engine drafts)
    parks at the **left, just above the carousel** so the player can study their hand + the map.
    Clicking the chip reopens the panel. State: `ui._offerMin`; `minimizeOffer`/`restoreOffer`/
    `_updateOfferMin`/`_positionOfferMin` (positioned off the handbar rect; repositions on resize;
    reset on each fresh reveal in `releaseOffer`).
  - **Lock:** while a draft is pending, `main.js draftLocked()` blocks `onPlayCard`/`onActivateAction`/
    `onDraw`/`onSkip` and toasts "Finish your draft first…". When the panel is open it's a full-screen
    modal so those paths are already unreachable; the guard enforces the lock once minimized. Map
    taps only pan/inspect during a draft (no card/action can be armed to fire).
  - Verified (Playwright): panel has minimize + no Draft button; minimize → chip above carousel-left;
    a card-play attempt while locked is blocked + toasts; chip reopens; double-click drafts and clears
    the lock. 95 smoke + 45 card green.

- **Directional grows use a press-and-drag aim; press away from the colony to pan** (branch same).
  - The four directional grows (**Apical Drive, Rhizomorph Lance, Fruiting Vigil, Leading Cord**)
    used to guess their start from a single tap (nearest strand), so growth often erupted from the
    wrong place. Now you **press** to pick where in the colony growth starts and **drag** to pick the
    direction; a live line shows origin + projected reach + aim; dragging past `aimCancelPx()` cancels
    (red ✕). Engine side: `cards.js dirFrom()` honours a press origin (`ctx.srcX/srcY`); new
    `directional()` helper marks the cards `aim:'drag'` + a `reachFn`; `cardUsesDragAim`/`dragAimReach`
    exports drive the UI. Gesture owned by `main.js beginAim/updateAim/fireAim` + `drawAimLine`.
  - **Refinement (pan vs aim):** a press **within `AIM_NEAR_PX` (90 screen px) of the nearest strand**
    starts an aim; a press **farther away PANS** the map — so you can reposition the view without
    cancelling the armed card first (replaces the old "cancel → pan → re-arm" trade-off). `beginAim`
    no-ops (leaves `aim=null`) on a far press so the normal pan path runs; `endPointer` guards the
    single-tap play path with `if (armedDragTarget()) return;` so a stray far *tap* can't play the card.
    Two-finger / Esc still abort; pinch-zoom unaffected. Verified (Playwright): near press-drag grows &
    doesn't pan; far press-drag pans, doesn't grow, stays armed.
  - **Arming flow (for reference):** single-tap a hand card = SELECT (`ui.armed`, enables Play);
    double-tap / Play = `playArmed → onPlayCard`, which for a target card calls `setPendingCard`
    (`ui.pendingCard`) + shows the aim hint. `armedDragTarget()` reads `pendingCard`, not `armed`.

- **Engine-cache draft = a distinct RED-leaf litter pile** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - **Goal:** normal substrate piles draft only Basic/Event cards; a rarer, high-value pile drafts
    **Engine** cards. Went through a few shapes before landing on the final one (below):
    1. First cut: engine piles were food piles marked with a **standing red 3-card canvas icon**
       (`drawEngineCacheMarkers`/`drawThreeCardIcon` in main.js) hovering over them.
    2. Owner feedback → made them **free-standing** objects (`sub.engineCaches = [{x,y,r,rewarded}]`,
       `cards.js checkEngineCaches`) triggered by growing a node within reach; static, below-surface;
       marker handed off to the draft glyph on reveal (`offer.engineCache._drafted`).
    3. **Final (current):** owner asked for a **red-leaf substrate** instead — so engine caches are
       **real food piles again** (`kind:'engine'`, cells `foodKind:'cache-engine'`) that you colonise
       and digest like any pile; clearing raises the **red** draft glyph → Engine draft. The
       free-standing system + standing icon were **removed**. This is §5's current model — see there
       for the data/render details.
  - **Art:** 6 red/maple-red + autumn-brown leaf sprites generated via Replicate
    (`scripts/gen_leaf_options.py`: flux-1.1-pro on white → BiRefNet matte → transparent PNG,
    quantized to palette PNG), baked to `assets/leafRed{Maple,Oak,Sweetgum,Japanese,Dogwood,Beech}.png`
    + manifest; options kept in `assets/leaf_options/`. Each engine pile mixes **all six** (the heap's
    per-piece hash pick) so every pile looks like its own varied red litter. Distinct from the ORANGE
    oak/maple of normal piles.
  - **Draft pools** split in `cards.js draftPool(engine)` by `displayCategory` (basic/event vs engine);
    `offerPileReward` picks the pool from `pile.kind`. Config: `substrate.engine{ClusterCount:4,
    ClusterRadius:1,SurfaceRows:2,DeepChance:0.25}` → ~3–5 piles/map, ~83% near surface.
  - Verified (Playwright): red pile renders distinct from orange; digesting it fires an engine-kind
    draft of 3 red-bordered Engine cards; 3 engine + ~12 normal piles/map; no console errors.
    Tests: 95 smoke + **45** cards green; the engine test asserts red-leaf food piles (foodKind
    `cache-engine`, near surface) that draft Engine on digest, normal piles keep `cache`.

- **Normal draft-reveal glyph recolored WHITE; engine glyph RED** (branch same).
  - The rising 3-card draft glyph (`.draftmorph`) was mint green for all piles. Now the **normal**
    (basic/event) glyph is **white** (`.draftmorph` base border/glow + the `G` colour object in
    `ui.js _draftMorphToSlots`); the **engine** glyph stays **red** (`.draftmorph.engine`). Size
    unchanged. Covers both the morph path and the phone-portrait icon-then-expand path (CSS-driven).

- **5 predation cards + art** (branch same). New anti-pest cards grounded in real fungal biology
  (see `scripts/gen_predation_options.py` prompts): **Constricting Snap** (event, digest nearest worm
  +3 P), **Toxocyst Burst** (event, clear worms in radius, +1 P each), **Toxocyst Array** (engine,
  standing worm-clear field), **Cordyceps Bloom** (event, destroy an ant nest in sensing range),
  **Cordyceps Stroma** (engine, perennial nest-destroyer). New sim helpers in `cards.js`
  (`killWormsInRadius`, `nestInSensingRange`, `eruptNearestNest`; `import { attackNest } from
  './ants.js'`). Art baked to `assets/cards/`. **Bundler caveat (see §10):** the `attackNest` import's
  trailing comment once broke `build.mjs`'s import-stripping — keep import lines comment-free.
- **Foraging Fan grows from ALL strands** (branch same). `network.js growRadial` rewritten: was 8
  fixed compass rays that crowd-locked so a big colony grew from only 1–2 tips; now **each original
  tip fans OUTWARD** (direction = away from its parent, centroid fallback) as short bounded chains
  along a fixed arc, relaxed spacing, straight-out-first with wider dodges if blocked. `_fanRing`
  removed. Smoke test asserts growth from two separated strands.
- **Carousel control-row + hints polish** (branch same).
  - Removed the bottom **action menu** (Show/Hide/Skip/Play). Show/hide is now a small **▾/▴ arrow**
    (`.handtoggle`), skip is a small round **"» N⚡" chip** (`.skipchip`) on the right of the filter
    row; **double-click** plays a card (no Play button). The whole control row (minimize · filters ·
    skip) sits at the **BOTTOM** of the carousel; soft **edge-fade** gradients mask the filter row and
    the left/right nav overlays (no overlit corners).
  - **All energy icons unified** to the gold pill version: `RES_ICON.energy` SVG now has a hardcoded
    gold fill (used in the pill, card cost pips, and the skip chip).
  - Blocking contextual **hints** moved to float **above** the carousel (positioned off the handbar's
    rect) and **auto-dismiss** after ~4 s (`ui.js setHint`, `#ui > .hint { pointer-events:none }`).

- **Fade-in polish + tempo (haste) upgrade cards** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - **Fade-in**: `revealMap` duration 0.7s → **1.4s**, and the reveal now fires from the render
    loop AFTER the first fully-drawn frame post-asset-load (`_revealPending`), not directly on
    asset load. This fixes warm-cache **refresh** popping in instead of fading (the reveal used to
    beat the first frame, fading a blank canvas). begin()/boot/safety-net all set `_revealPending`.
  - **6 new "tempo" upgrade cards** (`engine`-type modifiers, left ledger, tiered cost 10/18/28⚡,
    draftable): permanently shorten the "every N rounds" wait on installed abilities, min 1.
    - Action set (speed up right-menu ACTIONS): **Quickened Reflex** (−1), **Impulse Relay** (−2),
      **Hair-Trigger Hyphae** (−3) → `actionHaste`.
    - Engine set (speed up left-pill resource ENGINES): **Brisk Metabolism** (−1), **Enzyme
      Overclock** (−2), **Metabolic Surge** (−3) → `engineHaste`.
  - **Mechanism**: `C.actionHaste`/`C.engineHaste` totals in `state.cards`. On install, `applyAction/
    EngineHaste` MUTATE each installed ability's `every` in place (min 1); a later-installed ability
    inherits the running total in `playCard`. Because cooldowns, cadence, and the UI meters all read
    `every`, no downstream plumbing was needed. Shown in the ledger "Modifiers" section
    (`summarizeEngines` → `mods`). Data in `docs/cards.json` (regen → `cards-data.js`); EFFECTS via
    `engine({actionHaste|engineHaste: N})`.
  - New cards have NO art yet → `assets/cards/<slug>.jpg` 404s (benign: `.caimg onerror` hides the
    img, leaving the dark art window). Generate art later via `scripts/gen_card_art.py`.
  - Verified: 15/15 haste checks (reduce existing + later installs, stack, clamp min 1, engines⊥
    actions), in-browser install renders reduced cadence + Modifier rows; fade 1.4s bundled.
    94 smoke + 30 cards green.

- **Crash-proof render loop** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - Symptom: the game occasionally FROZE with a half-drawn / torn canvas. Cause: `frame()`
    ended with `requestAnimationFrame(frame)`, so ANY throw in the draw path killed the loop
    permanently and left the partial frame on screen (very likely a transient 0-size viewport on
    mobile — address-bar show/hide / rotation — making a light/canvas buffer 0-wide and throwing
    on `drawImage`).
  - Fix (`main.js`): split the body into `renderFrame(time)`; `frame()` now wraps it in
    try/catch and ALWAYS reschedules rAF, so one bad frame can't freeze the game — it logs once
    (console + in-game Log, throttled by error signature) and keeps animating. `render/lighting.js`
    `compose()` returns early when `viewW/viewH <= 0` (the specific 0-wide-buffer throw).
  - NOTE: an initial version also had `renderFrame` bail on `window.innerHeight/Width <= 0`. That
    BROKE the boot fade on mobile — `innerHeight` can transiently read 0 during load / address-bar
    settling even when the canvas is validly sized, so the reveal could fire across skipped frames
    and fade in a blank/stale canvas. Removed it; the try/catch + lighting guard already crash-proof
    the 0-size case without skipping otherwise-valid frames.
  - The log line ("Render hiccup (recovered): …") is the diagnostic hook — if it recurs, the Log
    panel now names the actual error so we can fix the true root cause.
  - Verified headless: injecting a per-frame throw kept rAF running (loop alive, page responsive,
    error logged exactly once) and the loop fully recovered once the fault was removed.

- **Draw-engine extenders → installed engines / actions (every 6 rounds)** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - The old "extender" cards each shuffled 5 copies of a basic into the draw deck. With the Draw
    button gone that mechanic was dead, so the 10 active extenders are now INSTALLED cards that
    repeat the granted basic's effect every 6 rounds, all **8⚡ to install**:
    - **Triggered ACTIONS** (right menu, `action({every:6,cost,res,target})`): Leading Cord
      (grow 2 directional, aim, 1 W), Forager Bloom (fan out, 1 W), Questing Front (lunge to
      food, 1 W), Colonizing Front (grow toward all food, 1 W), Acorn Fall (bury cache, aim,
      1 W), Boring Corps (bore rock, aim, 2 P), Crust Reserve (harden + clear mould, aim, 1 P).
    - **Passive ENGINES** (left ledger, `engine({water|phosphorus, every:6})`): Capillary Runners
      & Dew Traps (+3 Water/6), Prospecting Cords (+3 Phosphorus/6) — the harvest ones, free.
  - Reuses the existing engine-cadence + action-cooldown runtime entirely (no new mechanics);
    each converted card's `run` mirrors the corresponding basic's effect. `DRAW_ENGINES` now holds
    only the archived leftovers. Data patched in `docs/cards.json` (type action/engine, 8⚡,
    per-use W/P, "Once per 6 rounds…" text, `tutorial:true` so they're draftable) → regenerated
    `src/cards-data.js`. Owner chose: triggered-ability model for the targeted/growth ones, free
    resource engines for the harvest ones.
  - Verified: 13/13 engine-level checks (install as engine/action, +3 on round 6, aim → grow →
    charge → 6-round cooldown), plus in-browser install (ledger + Actions menu render with
    cadence meters); no console errors. 94 smoke + 30 cards green.

- **Food piles keep a fixed shape and fade on consume** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - Bug: a leaf/nut pile changed shape/arrangement as it was eaten. `_drawLeafHeap` (main.js)
    scaled its piece count by live `frac` (so it lost pieces) AND biased piece positions off
    the LIVE `nb.nutrient > 0` footprint (so pieces shifted as neighbours drained).
  - Fix: **fixed piece count** (11 leaves / 8 nuts) and **bias from the ORIGINAL footprint**
    (`nb.maxNutrient > 0`), so the heap is identical at any fill level. `drawSubstrateLeaves`
    now draws the full heap at alpha 1 while ANY nutrient remains, then TIME-fades it out
    (`cell._leafGone` timestamp, `LEAF_FADE_MS` 460ms) once the cell hits 0 — because a
    colonised pile empties in ~2 ticks (`passiveIncomeRate 25` on ~50/cell), a frac-based fade
    would be a 2-step pop, so the fade is time-based.
  - Retired the draft **leaf-ghost** (`drawDraftGhostLeaves` + `draftIntro.ghostAlpha`): the
    per-cell consume-fade now covers "leaves fade away to reveal the icon" uniformly for every
    pile, so the intro is just wait-for-grow → brief beat → glyph rises.
  - Verified headless: full-nutrient and half-nutrient piles are pixel-identical (no reshape);
    on consume the same heap fades out then clears; no console errors. 94 smoke + 30 cards green.

- **Draft/card-flow simplification** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - **Removed the Draw button** (`render/ui.js`): cards now enter the hand ONLY by drafting
    them (choosing after a finished food pile). Skip stays as the pass/advance-a-round control.
    Engine `drawCard`/`drawDeck` are left intact (unused by UI; still on the `__game` debug hook).
  - **Double-click / double-tap a draft card drafts it straight to hand** (`pickOffer`) — mirrors
    the hand's double-tap-to-play; single click still selects, and the "Draft Card" button still
    confirms a selection.
  - **Draft cards are now the same size as hand cards.** `.offercard` was wider than `.cardbtn`
    at every breakpoint (base 210 vs 172, phone-portrait `min(56vw,220px)` vs `min(46vw,172px)`,
    landscape 150 vs 132) — worst on phone portrait. Matched width + fonts to `.cardbtn` at all
    breakpoints (merged `.offercard` into the responsive `.cardbtn` cn/crules selectors).
  - **Draft window text is just "Choose one"** — dropped the "Pile digested…" h2, the subtitle,
    and the "N more drafts waiting" note.
  - Verified headless at 390×844: bar = Hide Hand · Skip · Play Card (no Draw); draft-card width
    == hand-card width (172); heading "Choose one", 0 subtitle paragraphs; double-click drafts
    (offers 1→0, hand +1); no console errors. 94 smoke + 30 cards green.

- **Food-pile card-draft intro animation** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - Finishing a colonised map pile plays a sequenced beat before the draft panel:
    (1) WAIT for any played card's grow reveal to finish, (2) the leaf pile lingers then
    FADES away where it stood, (3) a small glowing 3-card glyph rises there, then (4) **each
    of its three cards flies + grows + de-rotates into one of the three draft cards**, its
    face revealing inside the glowing frame — the draft panel materialises out of the icon.
    (The icon-card borders and the draft-card borders are the same shape, so it reads as one
    thing transforming.)
  - **Offer carries its footprint** (`engine/cards.js` `offerPileReward(state, pile)`): the
    pile's world `center` + `cells` are stamped onto the offer, so each queued draft animates
    from its own pile (pure world coords; no view state in the engine).
  - **Reveal signal** (`render/network.js` `isRevealing(time)`): true while any node's
    `_appearAt` is within `REVEAL_SEG` — lets the intro hold until a grow completes.
  - **Controller in `main.js`** (`updateDraftIntro`, per-frame at the top of `frame()`):
    phases `wait → leaf → handoff`. `wait` ends when a seen reveal finishes, or `DRAFT_START_GRACE`
    (500ms) with no reveal, or a `DRAFT_WAIT_MAX` (4.2s) cap. `leaf` fades the ghost
    (`draftIntro.ghostAlpha`, drawn via a refactored `_drawLeafHeap()` shared with
    `drawSubstrateLeaves`); then it calls `ui.releaseOffer(screenPoint)` once and the UI owns
    the glyph + morph.
  - **Per-card morph in `render/ui.js`** (`releaseOffer` → `_playDraftMorph`): builds the panel
    (cards laid out but held at opacity 0), measures each `.offercard` rect, then for each spawns
    a `.draftmorph` frame (fixed, glowing mint border + dark body) containing a clone of that
    card. A FLIP over `left/top/width/height` + `transform:rotate` (NOT transform-scale, so the
    border stays crisp at icon size) flies it from the fan at the pile (`_draftFanCards`, the
    "Standard" 16° glyph) into the slot; the clone's opacity reveals the face; the glow relaxes.
    **Per-keyframe easing** (linear hold, eased fly) — a global ease-out raced through the hold
    in wall-time and collapsed the icon beat. At the end the real cards cross-fade in and the
    frames are removed (`_finishDraftMorph`). `holdOffer` gates the panel hidden during the wait;
    `_renderOffer` builds once per offer (`_offerBuiltFor`).
  - **The glyph shows on EVERY screen** (`_playDraftReveal`): it measures whether all three
    draft slots fit on screen (`allFit`). Desktop/landscape (all fit) → the per-card morph
    (`_draftMorphToSlots`). Phone PORTRAIT, where `.offerrow` scrolls and slots 2–3 sit off the
    right edge (`allFit` false) → the icon holds at the pile and the whole panel expands out of
    it (`_draftIconThenExpand` → `_playOfferExpand`). (The earlier `< 760px` gate skipped the
    glyph entirely on phones — that was the "no icon on my phone" bug.) Reduced-motion just shows
    the panel. `.dmclone` defaults to `opacity:0` so the icon reads as a glowing outline until the
    face reveals.
  - Verified headless (Playwright): small glyph at the pile → cards fly into the slots (faces
    revealing) → landed panel; WAAPI duration honoured (940ms); no console errors. Build
    ~475 KB; 94 smoke + 30 cards green.

- **Audio + card-UI polish pass** (branch `claude/mycelium-phase-1-build-urvq5e`; the work
  between the growth/rock passes and the draft animation above).
  - **Grow SFX** (`render/sfx.js`, NEW): decodes `assets/sfx/grow.wav` once (Web Audio) and
    `playGrowBurst(count, spreadMs)` layers ONE hit per `STRANDS_PER_HIT` (10) new strands,
    staggered across the reveal window — a lone tendril is one soft hit, a big fan a layered
    swell. Hard caps: `MAX_LAYERS` (6) per grow, `MAX_VOICES` (8) global, per-hit gain
    `0.55/√layers`, a DynamicsCompressor bus + master lowpass → dark/slow/cavernous. Called from
    `NetworkRenderer`'s reveal block. `initSfx()` decodes lazily + gesture-unlocks after boot;
    not in the image manifest.
  - **Lazy background music** (`render/music.js`, NEW): HTMLAudio, ONE random track streamed
    (`assets/music/*.mp3`, ~13MB) so boot isn't blocked — the game loads and plays first, a
    track fades in when ready and plays the next on `ended`. Volume 0.32, persisted mute
    (`localStorage 'mycMuted'`), gesture-unlock. `initMusic()`/`toggleMusic()`/`isMusicMuted()`;
    `#mutebtn` 🔊/🔇 in the resource pill. (⚠ the current tracks are copyrighted — confirm usage
    rights before any public release.) Both new modules are wired into `build.mjs` MODULES
    (`music.js` before `ui.js`, `sfx.js` before `network.js`) and `main.js` boot.
  - **Sensing-range brightness** cut hard in `render/lighting.js`: the visible glow is the
    per-node **network glow** (`k = bright * 0.3`, down from 0.9), not the frontier aura
    (`senseAlpha 0.06`, measured to contribute ≈0). A/B'd with a temporary `window.__glowK` knob
    (per-build random maps make cross-build compares unreliable).
  - **Card-hand filters are multi-membership** (`render/ui.js` `cardGroups(c)` → array): every
    installable card lists under **Engine**, extenders under **Draw**, everything else under
    **Action**, plus effect tags (Grow/Substrate/Water/Mineral/Energy/Defense). "Other" is gone.
  - **Click an installed card (either panel) to preview it** as a popup (`_showCardPopup`) — a
    real `.cardbtn` face on a `.cardpop` backdrop, identical to a hand card but with a smaller
    art window (`.cardpop-card .cart { aspect-ratio:5/2 }`); click away to dismiss.
  - **Right-hand actions menu**: charge-meter lights (`every - cd`) start **ON** (usable on
    install); left/right dropdowns share one `cadenceLightsHTML()` and are sized to avoid
    scrollbars (`min-height`, not clipped `height`). Septal Pore Flux → "Install. Drawing cards
    costs 3 less energy."

- **ALL visible rock is now solid — no rock type can be grown over** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - **Foraging Fan (`growRadial`/`_fanRing`) checked only the ray's *endpoint* cell**
    (`_placeOk`), so a ray could clip across a rock. Now uses `_segmentClear` like the
    directed-grow cards — the whole ray must be clear (real edge-crossings 8→0 in repro).
  - **WYSIWYG rock (the real cause):** every rock TYPE — scattered boulders (`drawBoulder`,
    up to ~3.3 cells for a 1-cell rock), big formations (`drawRockFormations`), and vertical
    columns (`drawRockColumns`) — is drawn as a SPRITE larger than its cell footprint, so
    mycelium in the open soil a sprite visually covered *looked* like it was on the rock. New
    one-shot `solidifyRock()` (main.js, called in `frame()` before the rock draws) stamps EVERY
    rock sprite: `stampSolid()` samples the sprite's **opaque silhouette** (alpha, rotation-aware
    — the mask is built once per image and cached) and marks each covered soil cell `rock`. So
    the whole visible rock blocks growth; transparent sprite margins stay passable soil. Solidified
    cells are tagged `cell.rockFill` so they're never re-drawn as their own boulder (excluded from
    `rockGroups`). Guarded by `sub._rockSolidified`; skips food/water/above-surface cells.
  - **Winnability is NOT protected here (by design, per the owner):** the earlier `pathClear`
    corridor exception was removed — solidify now fills rock over the guaranteed corridor too, so
    the visible rock is *fully* solid everywhere. (Hundreds of playtests under the "all rocks solid"
    assumption never produced an unbeatable map; the map owner verifies winnability directly.)
- **Animated mycelium growth (render-only)** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - Grow actions now **reveal over ~1–2.4 s** instead of snapping in, but the **sim is untouched**:
    every node is still added to `net.nodes` instantly, so income, collision, infection and
    win-checks all resolve on the same tick as before — only the *draw* is delayed. This keeps
    it cheap (no extra batch rebuilds, no sim rework).
  - `NetworkRenderer.draw` detects freshly-grown nodes by **identity** (a per-node `_revSeen`
    flag), not by a node-count delta, and stamps each new node's `_appearAt` staggered
    **base→tip** across a spread of `count*55 ms` clamped to
    `[REVEAL_SPREAD_MIN 1000, REVEAL_SPREAD_MAX 2400]`. Identity-keying is robust to a grow and
    a threat-removal landing in the **same frame** (the action appends nodes, then `tickWorld`
    lets nematodes/ants/starvation prune others and `_removeNodes` compacts the array) — a
    count/index scheme would mis-schedule and flash part of the new growth.
  - `_strokeStructure` draws a not-yet-arrived node as a partial line from its parent
    (`rev = (now - _appearAt)/REVEAL_SEG`, `REVEAL_SEG 340 ms`) that extends + fades in, then
    snaps to the normal quadratic once `rev>=1`. **Batched/simplify mode** (zoomed out or
    >~1900 nodes) intentionally shows instant — the per-node reveal only runs in the detail path.
  - **No end-state flash.** The other render passes that read the whole node set now follow the
    reveal via `NetworkRenderer.revealFactor(node, time)` (0 = not started … 1 = done; 1 in
    batched LOD): the **lighting** network-glow + sensing-aura skip un-started nodes and move +
    fade each light with its growing tip (the sensing `sparseBoost` is weighted by reveal so a
    grow doesn't dim the existing aura), and the **nutrient-pulse ring** skips strands that are
    still growing in (else it painted a bright arc in empty earth ahead of the filament).
- **Growth-through-rock fix + review hardening** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - **Directed growth (Tropic Lunge, Rhizomorph Lance, Apical Drive, …) no longer crosses
    rock.** Growth checked only each segment's *endpoint* cell, so a strand could hop over
    or graze a rock cell (ends in adjacent free cells, line clips the rock between). New
    `Network._segmentClear` samples the whole segment (~⅓-cell steps) and is used by
    `growDirected` + `_reachableSteps`, so only a punch/dig (`bored` cells) may cross rock.
  - From an adversarial review of the 4-card change: **Suberin Wall ward off-by-one** — the
    `mouldProof` decrement ran *before* `infectNetwork`, so a "2 round" ward protected only 1;
    moved the decrement to *after* infection resolves (check-then-age, like `antProof`).
    **Constricting Ring**: trap now rejects placement on rock/out-of-bounds, and `resolveTraps`
    tests the worm's **swept path** (prev→current) so a fast worm can't step across the
    radius uncaught. **Ward rim**: Suberin wards a hair wider than it cures so no cured node
    is left unwarded. **Action-card affordability**: the hand no longer greys an action card
    for W/P it doesn't need to install (installs for Energy only; matches `cardBlockedReason`).
- **Fixed CCG card shape + 4 card redefinitions** (branch `claude/mycelium-phase-1-build-urvq5e`).
  - **Card shape:** every card (hand + draft offer) is now a **fixed 5:7 CCG shape** on phone
    AND desktop (`.cardbtn`/`.offercard` `aspect-ratio:5/7`), with a **uniform 3:2 art window**
    (`.cart aspect-ratio:3/2`) and a rules box that flex-fills and **always shows all text**
    (`align-self:flex-start` stops the flex row stretching cards; width/font tuned so the
    longest card doesn't clip). Shape takes priority over how many cards fit (desktop now ~6).
  - **4 cards' text shortened + mechanics realigned to the new text** (src/engine/cards.js,
    src/cards-data.js, docs/cards.json):
    - **Tap-Root Rhizomorph** — was an *auto* dig-engine; now an installed **action** (type
      engine→action): once per 5 rounds, pay **2 P**, tap an in-range rock → bore through it
      (`punchThrough`). Shows a Use button (no longer an AUTO row).
    - **Constricting Ring** — now a **trap** (free, once per 6): tap empty ground → lay a snare;
      the first nematode to enter is digested for **+2 P** (`state.traps` + `resolveTraps` in
      turn.js, rendered as a pulsing ring by `drawTraps`).
    - **Sclerotial Seal** — cooldown 3→**4**; 1 P; seal a food pile from ants.
    - **Suberin Wall** — once per 3: clear all infection in radius 80 **and ward the cells
      against reinfection for 2 rounds** (`cell.mouldProof`; `threats.js` `cellProofed` skips
      warded nodes in both infection vectors; turn.js decrements the ward each tick). This
      implements the previously-deferred reinfection clause.
- **HUD refinements** (branch `claude/mycelium-phase-1-build-urvq5e`): (1) dropped the icons
  from the bottom action buttons on every screen (text-only, matches phone); (2) **desktop**
  action bar is now a **vertical tray to the right of the carousel** (phone keeps the
  horizontal bottom strip); (3) the resource-pill icons are now all same-size, centre-aligned
  SVGs (energy bolt added to match the water drop / phosphorus spark); (4) the pill shows each
  resource's **per-round income range** beside the stock (`265 +4`, `301 +0–1`, …) via
  `summarizeEngines` in `update()`.
- **Browser HUD polish** (branch `claude/mycelium-phase-1-build-urvq5e`): (1) hand + bottom
  action bar moved **all the way to the bottom** on desktop (matches phone); (2) mouse
  carousel drag now has **inertial momentum** so it glides like a phone swipe (+ desktop
  **‹ › nav arrows**, auto-hidden when the hand doesn't overflow); (3) carousel widened to
  show **~7–8 cards** (was ~4.5) — cards 150px, list `min(88vw,1400px)`; (4) the top-left
  resource pill and top-right Actions pill are now **collapsible on click** on every screen
  (both start open on desktop, closed on phone; `ledgerOpen`/`actionsOpen` drive the panels).
- **Action cards route to the Actions menu as installed abilities** (branch `claude/mycelium-phase-1-build-urvq5e`).
  Wired the two HUD corners to the real card taxonomy (cards-design §14 types):
  - **`engine` → left ledger** = resource income (energy/water/phosphorus ranges) +
    economy modifiers (draw discount). Its **timed dig abilities** (Tap-Root Rhizomorph)
    render in the **Actions menu** instead — they act on the world, so they read as an
    ability, shown as an **auto** row (amber `AUTO` tag + `every N · in M` countdown, no
    Use button since they fire on their own cadence).
  - **`action` → right Actions menu**, now **installed as repeatable abilities** (was
    wrongly one-shot). A new `action(spec, run)` helper in `cards.js` returns
    `{installAction}`; `playCard` pushes it into `state.cards.actions[]`. Gating per the
    card's effect text: **Constricting Ring** (1✦, every 6, tap a nematode → +2✦),
    **Nutrient Transmutation** (once/round, convert 2→1, instant), **Sclerotial Seal**
    (1✦, every 3, tap a pile → ant-proof 3 rds), **Suberin Wall** (every 3, tap → cure mould).
  - **`event`/`basic`/`extender` → one-shot** (play → discard/shuffle) — unchanged.
  - **Activation-time targeting:** `activateAction(state, i, ctx)` returns `{needTarget}`
    on the first call (Use button) so `main.js` arms a map-aim (`ui.pendingAction`); the
    map tap resolves it. Cost/cooldown/per-round-use are spent **only on a successful
    resolve**. `produceCardEngines` resets `used=0` and ticks `cd` down each world tick.
  - **Install cost model:** action cards pay **Energy only** to install; their W/P is a
    **per-activation** cost (in the spec), not an install gate — so `playCard`/`cardBlockedReason`
    skip W/P for `action`-type cards, and the card face hides W/P pips for them.
  - **Guards (from an adversarial review pass):** aim states are mutually exclusive and
    cleared on Draw/Skip/Play/restart + the card-resolve tap (no stranded action firing on a
    later tap); duplicate action installs are blocked (`Already installed`) so cooldowns
    can't be bypassed; the phone "Aiming … ✕" chip + Escape cancel a pending action.
  - Removed the demo `seedDemoActions` scaffolding — the menu reflects the real deck.
    Verified via Playwright (routing, targeted activation, per-activation P, dup-block,
    stale-aim) + both suites green.
- **Engine ledger (top-left) + Actions menu (top-right)** (branch `claude/mycelium-phase-1-build-urvq5e`).
  Installed engine cards now have a **permanent, on-theme home**, and player-triggered
  abilities get their own menu. Both live only with the card layer on.
  - **Engine ledger** — hangs under the resource pill. Groups installed engines by output
    resource and shows per-round income as a **range** when cadences mix: steady producers
    set the floor, cadenced ones (`every N`) add the ceiling — e.g. `+1/rd` plus
    `+1 every 2` reads **+1–2**; all-steady reads a single number; cadenced-only reads
    from its floor (**+0–1**). Duplicate engines collapse to `×N` rows; `⛏ Timed`
    (dig engines) and `Modifiers` (draw discount) get their own footer blocks.
    (`_renderEngines` + `summarizeEngines` in `render/ui.js`.)
  - **Actions menu** — a top-right dock: a `⛏ Actions` pill button with a mint **ready-count
    badge**, dropping a list of installed abilities, each with a **Use** button. An action
    (`state.cards.actions[]`) is gated by a **cooldown** (`every N` → `cd` counts down), a
    **resource price** (`cost` of `res`), and/or **uses per round** (`per`/`used`). Using one
    does **not** tick the world; a world tick (draw/skip/play → `produceCardEngines`) resets
    `used=0` and decrements `cd`. Runtime: `actionUsable` / `activateAction` in
    `engine/cards.js`; handler `onActivateAction` in `main.js`; render `_renderActions` +
    `actionRowHTML` in `render/ui.js`.
  - **Layout:** desktop pins both corners open and `_syncPanelHeights()` equalises their
    heights; a phone taps the pill to drop the ledger and the Actions button to drop the
    menu, with **Log / ledger / Actions mutually exclusive** (one drop-down at a time).
    Corner panels sit at `z-index:30` so they overlay the hand carousel cleanly.
    The Actions pill is **icon-only** — a **red inline-SVG pickaxe** (`PICK_SVG`, not the
    `⛏` emoji, which renders as a fixed-colour glyph and ignores CSS `color` on Android) —
    and is **locked to the resource pill's height** (both `40px`) so they read as a pair
    and never crowd each other in portrait. **Tap-away:** on a phone, a `pointerdown`
    anywhere outside an open drop-down and its toggle (the map, a card, the bottom bar)
    dismisses it (`_onTapAway`, capture phase).
    CSS in `index.html` (`.engledger` / `.actionsdock` / `.actmenu` etc.). Verified via
    Playwright (desktop + phone screenshots; Use-button flips to disabled + badge decrements
    after activation) and both test suites green.
- **Grow-card mechanic fixes + perf + caps** (branch `claude/mycelium-phase-1-build-urvq5e`).
  Card behaviour now owned by `cards-design.md` where it overlaps; the runtime lives in
  `engine/network.js` + `engine/cards.js`:
  - **Renderer perf (LOD):** big colonies were ~250ms/frame stroking one path *per node*.
    `NetworkRenderer` now bakes the structure into a few batched `Path2D`s (per width
    bucket + infected) and strokes them in ~4 calls when zoomed out / large (the batched
    path self-heals if the node count drifts from the cache). Network draw JS ≈ 0ms.
  - **maxNodes 2500 → 6000** with a clear "colony has reached its maximum size" message on
    all grow cards at the cap.
  - **Foraging Fan:** grows **partial** (every open frontier tip fans out even if rock
    walls off others); `_fanRing` now **shuffles tips + fans ray-by-ray** so the burst
    spreads across the *whole* frontier instead of the near/dense side hogging the node
    budget; honest failure messages (at-cap / walled-in / packed-too-tight).
  - **Tropic Lunge:** targets only **unreached** food (excludes `colonized` cells so it
    doesn't chase the pile it's on); considers **all (tip, food) pairs** and lunges from
    the closest approach that can actually reach the food or get a full clear runway — so a
    walled nearest pile falls through to the next tip *or* the next pile instead of erroring.
  - **Appressorial Punch:** works on **any rock** (boulder / formation / column; not
    lakes); bores a **passable channel** — rock stays drawn, the strand overlays it
    (cell `bored` flag; `_placeOk` treats bored cells as open); aims toward the **clicked
    point** (not the rock centroid) and stops at the clicked feature's far edge **along
    that ray** (was following a column's whole length). Food right on the far side is
    picked up by the colonisation pass.
  - **Resource caps → 999 + never-drop harvest** (see §4 currencies).
- **(earlier)** Map framing + bottom buffer: (1) a fresh run now **centres the
  camera on the colony's entry** at zoom ~0.85 instead of the whole-map overview
  (§6); (2) added a **content-free dirt buffer** below the map
  (`config.world.bottomBuffer`, `substrate.viewHeight`) that **fades to black**, so
  the deepest content can be scrolled clear of the bottom UI — no rocks/food/etc.
  generate there (§5/§6). Verified via Playwright (camera-on-colony, buffer
  scroll, fade screenshots) + `smoke.test.js` green.
- **`f088229`** Three UX fixes: (1) `initCards` deals a **free 3-card opening
  hand** so the game no longer starts with an empty hand (§4, cards-design §18.1);
  (2) the **hand carousel is always visible** — removed all auto-minimize/expand
  (`collapseHand`/`expandHand`/`_isNarrow`/`_watchViewport`, the on-play/on-aim/
  on-draw calls), leaving only the Show/Hide button (§6); (3) **camera clamp** —
  `Camera.setWorldBounds` + `clamp()` + `minZoomForBounds()` stop panning/zooming
  past the map edges so the empty background is never shown (§6). Verified
  headlessly (14 Playwright checks) + `cards.test.js`/`smoke.test.js` green.
- **`841cb38`** Show/Hide Hand toggle label (chevron removed); empty cost rows
  collapse so button text centres.
- **`3d5cffb`** Bottom action-bar redesign: 3 groups (Show Hand · Draw/Skip ·
  Play Card), two-row buttons w/ cost, drag-scroll carousel (nav buttons removed),
  Cancel removed, Play-Card disabled contrast fixed.
- **`b978de1`** Fixed 3 adversarial-review findings: onPlayCard returns real
  result (no wrongful minimize on no-op), collapsed handbar `pointer-events:none`,
  narrow→wide resize re-opens the carousel.
- **`6272e22`** Menu redesign: compact resource pill + log dropdown (auto-open on
  error), Hand button moved to action bar, minimize-on-play, denser nut piles.
- **`211caa6`** Fixed stale card-selection index (name-based selection).
- Earlier: carousel play/cancel footer + highlight-to-select; card art regen for
  ~14 cards (white-hyphae growth cards, autumn-leaf Sclerotial Seal, Phosphate Tap);
  full-deck & art-picker review tools.

---

## 10. Known caveats / watch-items

- **Bundler strips imports by regex — keep `import` lines comment-free.** `build.mjs` inlines
  `src/` into a non-module `<script>` in `dist/index.html` by stripping `import ...;` lines with a
  regex anchored at `;\s*\n`. A **trailing comment** on an import line (e.g. `import { attackNest }
  from './ants.js';  // ...`) defeats it → the raw `import` survives into the non-module bundle →
  `"Cannot use import statement outside a module"` breaks the WHOLE game. Node tests pass regardless
  (native ESM), so it slips through. **Always** verify `grep -cE '^\s*import[ {]' dist/index.html` == 0
  after building. Put comments on their own line.
- **Art generation (Replicate).** Token lives in `~/.claude/settings.json` `env.REPLICATE_API_TOKEN`
  (OUTSIDE the repo, never committed — owner-authorized, low-value account). Two pipelines:
  card art = `flux-1.1-pro` (jpg, warm/reliable, `scripts/gen_*options.py`); **transparent sprites**
  (leaves, rocks, nuts) = `flux-1.1-pro`/`flux-schnell` on a **white** background → **BiRefNet**
  matte (`men1scus/birefnet`) → PNG, with a local white-key fallback (`scripts/keywhite.py` /
  `scripts/gensprite.sh`). Curl must be proxy-aware (`--cacert /root/.ccr/ca-bundle.crt`). Quantize
  sprites to palette PNG (PIL `quantize(FASTOCTREE)` preserves alpha) to match existing small assets.
  Option intermediates live in `assets/{card,leaf}_options/` (shipped to `dist/`, matching the
  existing `card_options` precedent).
- **Playwright verify quirks (this env):** `deviceScaleFactor:4` reliably TIMES OUT — use 2/3. A
  background `http.server` must be spawned in the SAME node process as the run (a separately-launched
  server dies when its launching Bash command ends). Avoid `pkill` (exit 144 aborts compound cmds).
  Transient draft-glyph frames are best caught by polling for a live `.draftmorph` element.
- **Dev card-testing scaffold (now behind the picker's "Dev quick-start" button).** The `'testall'`
  scaffold — **5× of every card + 300 of each resource** — is no longer the default: the start-of-run
  **species picker** gates every sandbox run (see §9). Picking a species runs `initCards(state,'species',sp)`
  (that species' real hand + resources); the **Dev quick-start button** (or `#dev`) runs the old
  `initCards(state,'testall')` scaffold. Neither path uses the "real" tutorial opening
  (`initCards(state)` — free 3-card draw off the `startCopies` deck) or the config start economy
  (`energy.start` 50, `cards.startWater` 10, `cards.startPhosphorus` 0), so those values still aren't
  what you see in a species/dev run. **For real balancing, seed via a species (or wire the picker's
  Start to a proper opening).** (The old `seedDemoActions` demo-abilities scaffold was removed — the
  Actions menu is populated by playing real `action`-type cards.)
- **Suberin Wall's "block reinfection for 2 rounds"** is now implemented via `cell.mouldProof`
  (set in radius 80, decremented each tick; `threats.js cellProofed` skips warded nodes in both
  the contact and the along-filament spread vectors). Note it wards the AREA's nodes against
  fresh infection — the rot can still creep in from an adjacent *unwarded* node, so it's
  strong-but-not-absolute protection for the 2 rounds (acceptable v1).
- **Rock is WYSIWYG-solid but winnability is NOT auto-guaranteed anymore.** `solidifyRock`
  (main.js) fills rock under **every** rock sprite's silhouette, including over the generator's
  cleared entry→goal corridor — so a *newly generated* map is no longer provably routable by the
  gen carve alone. This was an explicit owner decision (they verify maps by playing; hundreds of
  maps under the "all rocks solid" assumption were never unbeatable). The `cell.pathClear` flag
  is still set at gen (documents the intended corridor) but is **no longer read** by solidify —
  re-honour it there if auto-winnability ever needs restoring.
- **README.md is stale** on the "no cards" claim (Phase-1 pre-card text).
- On phone, a targeted-card **aim** cannot currently be verified via a synthetic
  Playwright canvas tap (harness quirk, not a code bug) — inject/splice state to
  test the resolve path.
- `dist/` must be rebuilt + committed after any `src/`/`index.html` change.
- `Math.random()`/`Date.now()` are avoided in the deterministic sim path (RNG is
  seeded via `engine/rng.js`).
- Draft-offer error paths (`chooseOffer`) don't `state.log` their message; they
  surface via hint only. Not user-reachable through normal clicks today, but note
  it if the offer UI changes.

---

## 11. Backlog / next steps (not yet done)

- **Campaign / level progression + species unlocks — BUILT** (see §9, commit `0989061`). 11
  procedural levels, per-level threat-count scaling (`LEVEL_THREATS`), carry deck+resources
  between levels, death → picker, localStorage unlock persistence. Follow-ups: only **Complete
  level 1** currently pins real unlock species (Earthball + Bleeding Tooth) — the level 3/5/7/10
  tiers still need species assigned; consider a difficulty/balance pass now that a full-deck carry
  makes late levels easier; and a fully-cleared tier currently falls back to a "?" (cosmetic).

**Agreed sequencing (planning note):** _polish what exists first_ — more **UI design + bug
testing on the CURRENT content** (current cards, enemy/ant/mould behavior, the installed-
engines HUD once built) — **then** build out more cards toward the game vision in
[`cards-design.md` §21](cards-design.md). Don't start net-new card content before the
current layer is solid.

- **Installed-engines HUD** — design explored (3 options; recommended = "Mycelial Ledger"
  hybrid: on-pill per-round deltas + resource-grouped drawer + O(1) collapsed strip on
  phone). Not yet implemented in `render/ui.js`. Engines live in `state.cards.engines[]`.
- Continue UI polish + bug-testing pass on current cards / enemy behavior / ants / mould.
- Refresh `README.md` to describe the card layer (or point to this doc).
- Broader card-art coverage / consistency pass across the full active deck.
- Balance pass on the card economy (draw/skip costs, engine clamps, win rate).
- **Game vision (cards-design.md §21, not built):** many distinct ENGINES = parallel routes
  to each map's goal, chosen at draft (TM-style); mushroom **species** = corp bonuses;
  **Survival mode first** (campaign + 1v1 later); escalating maps; ants as a food-supply
  modifier; between-map retention (engines + X others); CCG meta — keep 1 card between runs
  to bring into the next draft.
- Later phases (per original design): generational cycle, autonomous decay, 3D view — the
  state already holds a **list of networks** so these extend rather than replace.
