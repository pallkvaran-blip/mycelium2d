# Mycelium — Project Checkpoint

_Living status + knowledge doc. Last updated: 2026-07-05._

A running record of **where the project is**, **how it's built**, and **what we
know** — so any session (human or Claude) can pick up without re-deriving
context. Update the "Recent work log" and "Backlog" sections as work lands.

---

## 1. What it is

**Mycelium** — a 2D, side-on **roguelike engine-builder** themed on the life of a
fungal colony. You steer a living, semi-autonomous **mycelial network** through
underground substrate: shaping where its hunger goes, feeding it, defending it,
and driving it to a goal. Presentation: HTML + `<canvas>` + **vanilla ES
modules** (no framework, no build-time deps for the game itself).

- **Hosted:** https://pallkvaran-blip.github.io/mycelium2d/ (auto-deploys on every
  push to the dev branch via `.github/workflows/pages.yml`).
- **Status:** Phase 1 backbone **plus a working card layer** on top. (The root
  `README.md` still describes the pre-card "no cards" Phase 1 — it is stale on
  that point; this doc is the current source of truth for the card layer & UI.)

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

## 4. Card layer (the current gameplay model)

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
  minimizes/deselects on a genuine play.
- **Targeted cards** (`EFFECTS[name].target`) need a map tap to aim; non-targeted
  resolve immediately.
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
- **Select → play flow (name-based):** tapping a card **highlights** it
  (`armCard`, toggles by name — tap again to deselect). `Play Card` runs
  `playArmed`, which resolves the hand index **by name at play time** (never a
  stored index, which can go stale after the hand splices). On a successful play
  the carousel **minimizes** on phones (`collapseHand`) so the map result shows.
  There is **no Cancel button**; the only popup is the +5 draw-engine text preview.
- **Aiming chip** — when a targeted card is waiting for a map tap, a "Aiming: X ✕"
  chip shows in the hand header; its ✕ cancels the aim.
- **Responsive:** narrow = `max-width:760px` **or** landscape `max-height:520px`
  (`_isNarrow`). Phones start with the hand collapsed; a `matchMedia` listener
  re-opens it if the viewport crosses to wide. A collapsed handbar is
  `pointer-events:none` (its aiming chip stays interactive) so it never eats map
  taps.

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
