# Mycelium — Project Checkpoint

_Living status + knowledge doc. Last updated: 2026-07-05 (opening hand · always-on carousel · camera clamp)._

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
  - **Water (W)** — gates growth + substrate cards. Starts at 7, soft cap 20.
  - **Phosphorus (P)** — gates digest/defense/work cards. Starts at 3, soft cap 10;
    harvested from rock via Phosphate Tap.
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

- **Top HUD** — one compact glowing **resource pill** (⚡ / W / P). A **Log**
  button drops the event log down; it **auto-opens on player errors** (`openLog()`,
  e.g. insufficient resources). No turn/step/vitality rows.
- **Bottom action bar** — three groups, one row, glowing frame:
  - **left:** `Show Hand` ⇄ `Hide Hand` toggle (label reflects state; no chevron,
    no card-count badge).
  - **centre:** `Draw 3` / `16⚡` and `Skip` / `12⚡`.
  - **right:** `Play Card` — bright accent when a card is armed (shows that card's
    ⚡/W/P cost on the second row), a readable dim button when nothing is selected.
  - Every button is **two rows** (function on top, cost below). Empty cost rows
    collapse (`.bcost:empty { display:none }`) so single-label buttons stay centred.
- **Hand carousel** — a horizontal **drag-scroll** row on phone *and* desktop
  (touch scrolls natively; mouse uses `_enableDragScroll`, which suppresses the
  click after a >6px drag so a drag never arms a card). **No ‹ › nav buttons.**
  Identical cards **stack** (grouped by name with a count). Filter chips above.
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

- **(this change)** Map framing + bottom buffer: (1) a fresh run now **centres the
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

- Refresh `README.md` to describe the card layer (or point to this doc).
- Broader card-art coverage / consistency pass across the full active deck.
- Balance pass on the card economy (draw/skip costs, engine clamps, win rate).
- Later phases (per original design): generational cycle, autonomous decay,
  meta-progression, 3D view — the state already holds a **list of networks** so
  these extend rather than replace.
