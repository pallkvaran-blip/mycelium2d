# Mycelium — Project Checkpoint

_Living status + knowledge doc. Last updated: 2026-07-09 (engine ledger + actions menu shipped · grow-card mechanic fixes · batched renderer LOD · raised caps · game-vision note §21)._

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
  basics**.
- **Win:** a fruiting body reaches the **goal zone** (`checkGoalReached`).
  **Lose (stall):** card-dry and broke — no draw/skip/play/draft possible.
- **Art:** each card face uses `assets/cards/<slug>.jpg` (see §7 art pipeline).

---

## 5. Substrate food types (visual + conceptual split)

`substrate.js` cell flag **`foodKind`**: `'' | 'cache' | 'nut'`.

- **`cache`** — map-placed food (leaf litter). Rendered as **oak/maple leaf**
  sprites. Finishing a cache pile grants a **card draft**. Set in `drop()`.
- **`nut`** — player-placed food (Acorn Cache etc.). Rendered as **acorn / chestnut
  / pine-cone** sprites, denser + smaller than leaves. Gives **energy only, no
  card**. Set in `deposit()` (never downgrades an existing `cache`).

Rendering lives in `main.js drawSubstrateLeaves`: `MAXP = isNut ? 8 : 11`,
`base = cs * (isNut ? 0.26 : 0.64)`, sprite chosen by a stable hash so tiles are
stable across frames; nut piles are muted via `ctx.filter`/`globalAlpha`.
Leaf/humus cards are defined but **shelved** (kept out of the active decks).

---

## 6. UI / interaction model (current)

All UI is built in `src/render/ui.js`; all CSS is inline in `index.html`.
Both menus are dark, on-theme, with glowing green borders.

- **Top HUD** — one compact glowing **resource pill** (⚡ / W / P), each with an
  inline SVG mark (bolt / drop / spark, same size, centre-aligned) and its **per-round
  income range** beside the stock, e.g. `265 +4` · `301 +0–1` · `302 +1`. A **Log**
  button drops the event log down; it **auto-opens on player errors** (`openLog()`).
  No turn/step/vitality rows.
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
- **Hand carousel** — a horizontal **drag-scroll** row on phone *and* desktop
  (touch scrolls natively; mouse uses `_enableDragScroll`, which now adds **inertial
  momentum** on release so a mouse drag glides like a phone swipe, and suppresses the
  click after a >6px drag so a drag never arms a card). Browser view also has **‹ ›
  nav arrows** flanking the row (`_updateHandNav` shows them only when the hand
  overflows; CSS hides them on phones). Desktop shows **~7–8 cards** (cards 150px,
  list capped at `min(88vw,1400px)`). Identical cards **stack** (grouped by name with
  a count). Filter chips above. The hand + bottom action bar sit **at the bottom**
  (`.handbar` ~98px, `.actionbar` 16px) on desktop, matching the phone layout.
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

- **TEMP test scaffolding — REVERT before release.** For card testing the run boots with
  (1) `initCards(state, 'testall')` in `main.js` `begin()` — a hand of **5× of every
  non-archived card** — and (2) **300 of each resource** (Water/Energy/Phosphorus set in
  the `'testall'` branch of `initCards`). Revert to `initCards(state)` and remove the
  `'testall'` branch to restore the normal opening hand + resources. (The old
  `seedDemoActions` demo-abilities scaffold has been **removed** — the Actions menu is now
  populated by playing real `action`-type cards.)
- **Suberin Wall's "block reinfection for 2 rounds"** is now implemented via `cell.mouldProof`
  (set in radius 80, decremented each tick; `threats.js cellProofed` skips warded nodes in both
  the contact and the along-filament spread vectors). Note it wards the AREA's nodes against
  fresh infection — the rot can still creep in from an adjacent *unwarded* node, so it's
  strong-but-not-absolute protection for the 2 rounds (acceptable v1).
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
