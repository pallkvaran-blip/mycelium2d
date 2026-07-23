# Mycelium — Project Checkpoint

_Living status + knowledge doc. Last updated: 2026-07-22 (**SHIPPED — first public release on itch.io**
(free HTML5 build; global Supabase leaderboard live). Launch-polish pass since: hand tray capped at ~40%
screen height on short screens via container-query card scaling (no distortion); title New/Old captions
tucked against the letters; **HIGH SCORES** heading enlarged + close-✕ halved; the level-intro title now
grows as the procedural mycelium wordmark ("LEVEL ONE" … "LEVEL ONE HUNDRED"); visible Dev buttons removed
again for the release zip (invisible `window.__game` hook kept). itch build = `index.html` + `assets/` at the
zip root, no editor/tool HTML, ~22 MB. See §9. NOTE the **first-run tutorial is once-per-browser** — see
§10. — earlier: **boot loading screen**: all art is now
preloaded + decoded behind a minimal centered "%"→"Click" overlay before the game opens, so nothing pops
in lazily mid-play (the "Click" also unlocks audio); the dist deploy was slimmed 61 MB→~22 MB by excluding
unused authoring-candidate folders. See §9. — earlier: **per-species starting level**: higher-tier
species begin their run deeper in the campaign instead of always level 1 — fixed at the unlock level for
most (Slippery Jack/Bleeding Tooth 3 · Wine Cap 5 · Violet Webcap/Dry Rot 7), and a player-adjustable
"Lvl: X" stepper for the memory colonies (Split Gill 2–5, Artist's Conk 3–10); the picker's "Complete
level N" row headers now show "Starts on level N" far-right. See §9. — earlier: **music = menu vs level
tracks** + a mobile
autoplay-unlock hardening pass: `backrooms-vol29` is the title/species-picker theme (its intro was
**permanently trimmed** so it plays from 0:20 with a quick fade-in and loops), a random one of vol7/10/23
takes over the moment a level starts, and the first-tap unlock now retries across pointer/touch/click/keydown
on both window+document with a wall-clock volume ramp so it can't stick at 0. See §9. NOTE: a device on
system mute stays silent regardless — that was the "no music on my phone" report, not a code bug. — earlier:
the **species-editor balance pass** + **five feel tweaks** (win/lose waits for the last grow, no Dev:tutorial
button, darker enemy sight, grow-into-mould infection burst, Artist's Conk "?" title → `15+2`). See §9. —
earlier: **final species — Artist's Conk** (Ganoderma
applanatum, Complete level 10): the upgraded "memory" colony — curate **15 basic/event cards + 2 engine
cards** from your last run (two separate caps) plus a fixed 5× Apical Drive. Extends the Split-Gill memory
system with an engine-draft pool. Picker roster is now full through level 10. See §9. — earlier:
**three double-engine species:** Wine Cap
(Stropharia rugosoannulata, Cord Capillary + Mineralizing Saprobe, lvl 5), Violet Webcap (Cortinarius
violaceus, Phosphatase Reserve + Aquaporin Channels, lvl 7) and Dry Rot (Serpula lacrymans, Aquaporin
Channels + Cord Capillary, lvl 7) — each starts able to install BOTH engines turn 1; realistic FLUX
portraits. See §9. — earlier: **two new starter species:** added **Oyster
Mushroom** (#3 — first/strongest energy engine the player can start with, Cord Capillary) and **Slippery
Jack** (#4 — first/strongest phosphorus engine, Prospecting Cords) as Complete-level-1 unlocks; **Common
Earthball** + **Bleeding Tooth** bumped to Complete level 3 (now #5/#6). Realistic FLUX portraits. See §9.
— earlier: **grow-card family:** added a paid directional
aimed-grow family — 4 basics (Guerrilla Runners / Turgor Thrust / Vesicle Surge / Translocation Cord) + 5
installed engines (Explorer Cord / Turgor Line / Vesicle Supply Line / Bulk-Flow Cord / Rhizomorph Cable) —
plus buffs so the free grows keep pace (Apical Drive→3 steps, Hyphal Extension→2, Leading Cord→3, Colonizing
Front→2) and a Rhizomorph Lance nerf (now 2⚡+2W). New art via FLUX 1.1 Pro. See §9. — earlier:
**level-intro screen:** every level now opens
on a BLACK "Level N" card that names the threats waiting on the map — ant / nematode / trichoderma, each a
white-glow square (tutorial art, head-focused crops) with an ×count — then fades the map in on any click;
the first-run tutorial is deferred to fire only after it clears. `src/render/level_intro.js` +
`main.js begin/revealMap`. See §9. — earlier: **experimental side-strand branching:** every
grow type now sprouts extra fuzz — each growth step has a 60% chance to sprout a small 2–3-segment
side-strand from a random point along the strand, in a random direction; drawn from a SEPARATE
deterministic RNG (`network.js _branchRng`) so it's purely additive and never shifts the main
food-seek/collision path. See §9. — earlier: **card-name mycology pass:** 7 owner-approved
renames for fungal accuracy — Nutrient Transmutation→**Metabolic Reroute**, Suberin Wall→**Melanized Wall**,
Mycorrhizal Mat→**Humic Mat**, Symbiont Weave→**Cord Weave**, Phosphatase Cushion→**Phosphatase Reserve**,
Tap-Root Rhizomorph→**Sinker Rhizomorph**, Hyphal Imbibition→**Hyphal Osmosis** — plus Mineralizing Saprobe
reflavored to phosphate. Names are load-bearing: each moved in lockstep across cards.json, the
`EFFECTS`/`DRAW_ENGINES`/`ARCHIVED` maps in `engine/cards.js`, tests, art slugs, `cards-data.js` + `dist/`;
61/61 tests + a 20-check per-card engine pass green — see §9. — earlier: **first-run tutorial:** a scripted
10-step B&W popup walkthrough (`src/render/tutorial.js`) fires ONCE on the first NEW of a real species run —
zooms the camera to each subject, FORCES the first grow (double-click Apical Drive → drag), and shows
FLUX-generated threat portraits (ant D / nematode B / a relatable moldy-bread trichoderma). Now with
**portrait-phone** support (minimise carousel, zoom out ~50%, frame the subject in the top half), a **TEMP
dev launcher** button on the title, and **no map-dimming** during the tutorial. `#tutorial` hash or
`window.__game.startTutorial()` replays it. — earlier: **energy + threat tune:** leaf Energy trimmed
another step to 🟡 duff **1–2** / 🟠 orange **2–3** / 🔴 red **3–4** (per-map counts unchanged: 5–7 / 5–7 /
1–3); **new enemy curve** (`species.js LEVEL_THREATS`, ants/nematodes/mould): L1 1/1/1 → L11 6/11/11, ants
ramp slowest (cap 6) — see §9. — earlier: **punch aimer + yellow duff leaves:** the
rock-punch cards/actions (Appressorial Punch, Sinker Rhizomorph) now use the SAME press-and-drag aimer
as the grow cards — `punchThrough` takes a separate aim point (press seeds the rock search along the aim
ray, drag sets the bore direction); single-tap still works. Low-value **duff** leaf piles are now
ALL YELLOW (5 `leafYellow*` sprites — Hophornbeam/Sassafras/Mulberry/Redbud/Sycamore; the earlier
brown/dark-brown mix was removed), so they read against the brown soil — see §9. — earlier: **economy/collision pass:** map food piles pay a small FIXED Energy each — decoupled from nutrient (`cell.energyPerNutrient`), so attraction/threats/colonisation are unchanged. **Per-map (2026-07-17 tune):** 🟡 YELLOW duff **5–7** (Energy 1–2, no draft) · 🟠 ORANGE cache **5–7** (Energy 2–3, Basic/Event draft) · 🔴 RED engine **1–3** (Energy 3–4, Engine draft); **no per-turn trickle** (`baselineTrickle` 0 — income only from colonising food) · **FIRM, FINE rock collision** — growth-collision is a ¼-cell (9px) `_fineSolid` mask baked from the sprite silhouettes (`solidifyRock`→`substrate.solidAtWorld`), so a strand stops exactly at the visible rock edge and threads any real gap but can't skim edges or squeeze between touching rocks (no `rockOverlap` knob); the grow cards' generous dodge routes around it · **ant trails are neutral** to mycelium (no block, no eating) · title "New" shows an erase-progress confirm; picker border/buttons are white/B&W · procedural MYCELIUM wordmark reused on the picker + level-win, with grow-SFX. — earlier: **CAMPAIGN: 11 procedural levels with per-level threat scaling** — win a level to carry your deck+resources to the next; beat L11 to win; clearing a level unlocks species (saved in localStorage); death → species picker · **start-of-run SPECIES PICKER gates every run** — pick a real mushroom species seeded with its exact starting hand + resources; a temporary "Dev quick-start" button, or `#dev`, skips it and runs the old `testall` scaffold (300E/W/P + 5× every card) · **draft economy: basics infinite/3-copies + events infinite/1-copy, engines unique; normal drafts weighted ~60/40 to basics** · draft panel minimizes to a glowing chip & LOCKS play until chosen · nematodes fan out, eat every tick, breed 0.8 — wiping the colony ends the run with a defeat overlay · engine-cache draft = a distinct RED-leaf litter pile · directional grows use a press-and-drag aim, press away to pan · Foraging Fan grows from ALL strands)._

A running record of **where the project is**, **how it's built**, and **what we
know** — so any session (human or Claude) can pick up without re-deriving
context. Update the "Recent work log" and "Backlog" sections as work lands.

This doc covers **architecture, UI/interaction, operations, and status**. It does
**not** own the game-design decisions — those live in the docs below, which remain
authoritative. Where they overlap, defer to them.

### Related docs (where each kind of decision lives)

| Doc | Owns |
| --- | --- |
| **[`docs/cards-design.md`](cards-design.md)** | **Authoritative** card-system design: vision, core loop, §2 *Locked design decisions*, rules/balance framework, versioned rulings (current: **v11** — two-resource W/P + `buyCostPhosphorus` install gate, §23). The source of truth for card behaviour & economy. |
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
  tutorial.js               # first-run scripted B&W walkthrough overlay (#tutorial / .tut-*)
  level_intro.js            # per-level black "Level N" + threat-roster screen shown before the map fades in (#levelIntro / .li-*)
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
  - **Action install cost = Energy (+ optional `buyP` Phosphorus buy-in)** — `playCard` /
    `cardBlockedReason` skip *play* W/P for `type==='action'` cards (a card's play W/P is its
    *per-activation* cost); the card face hides its play-W/P pip and the hand never greys it for
    W/P. **But `buyCostPhosphorus` (`buyP` in CARD_DATA) IS an install gate charged for every
    card type** (added v11, cards-design §23) — it's how an action gates *acquisition* on P; it's
    checked/charged next to `buyCostEnergy` and DOES draw a P pip on the face. Duplicate `action`
    installs are blocked ("Already installed").
  - `event` / `basic` / `extender` → one-shot (play → discard / shuffle).
- **Traps & wards:** Constricting Ring lays a snare into `state.traps[]` (`{x,y,r,reward}`);
  `resolveTraps` (turn.js, each tick after `stepNematodes`) digests a worm whose **swept
  path** (prev→current) crosses a trap for +Phosphorus, then spends the trap; `drawTraps`
  (main.js) renders a pulsing ring. Melanized Wall sets `cell.mouldProof` (a per-cell ward
  aged down each tick **after** infection resolves, so N = N rounds); `threats.js
  cellProofed` skips warded nodes in both infection vectors.
- **Rock collision = FINE solid mask that matches the drawn art (FIRM):** `Network._segmentClear`
  samples each growth segment (at the fine-mask resolution) and calls `_placeOk`, which blocks any
  point that is under drawn rock — `substrate.solidAtWorld(x,y)`, a ¼-cell (9px) `_fineSolid` mask
  baked by `main.js solidifyRock` from the sprite silhouettes (see §9 head + "WYSIWYG solid rock"
  below). A strand may **never sit under drawn rock** (no edge-skim, no squeezing between two touching
  rocks), but it **threads any real gap** you can see between rocks and stops exactly at the visible
  edge — WYSIWYG. There is **no `rockOverlap` knob** (removed; firmness is inherent). Only a punch/dig
  (`cell.bored`) fully passes through rock. Routing around firm rock is handled by the grow cards'
  generous dodge/offset search — `growDirected` (the "grow around rock edge" DODGE, out to ~65–80°),
  `growRadial` (Foraging Fan ARC), `_growStep` (Hyphal Extension offsets). **Ant trails do NOT block
  growth** (and don't eat the colony) — mycelium and ant trails are independent; ants stay a food rival.
  - **Directional grows don't false-block:** `growDirected` prefers the aimed tip but falls through
    to any frontier tip whose first step is clear, so an aimed lance toward open ground succeeds from
    a capable strand instead of erroring when the exact strand you aimed from is boxed by a rock.
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

`substrate.js` cell flag **`foodKind`**: `'' | 'cache' | 'cache-engine' | 'duff' | 'nut'`.

- **`cache`** — map-placed NORMAL food (leaf litter). Rendered as **orange oak/maple
  leaf** sprites. Finishing a cache pile drafts a **Basic/Event** card. Set in
  `drop()` with `kind='normal'` (its `foodPiles` entry has `kind:'normal'`).
- **`duff`** — map-placed LOW-VALUE food (decayed leaf mould). Rendered from a dedicated
  **all-yellow/gold** autumn-leaf set (`YELLOW_LEAF_KEYS` in main.js — Hophornbeam/Sassafras/
  Mulberry/Redbud/Sycamore), kept vivid (`saturate(1.08) brightness(1.03)`) against the brown
  soil; a slightly smaller/flatter heap (9 pieces vs 11, base 0.52 vs 0.64) so it reads as
  spent, lower-value litter. (The earlier brown-pushed / brown-mixed look was removed.)
  **Energy only — NO card draft** (`cards.js
  checkPileRewards` skips `kind==='duff'`); yields a smaller fixed **1–2 Energy** vs the
  drafting piles' 2–4. Not placed directly: `drop()` still stamps every route/feature
  cache as `kind='normal'`, then a **DUFF PASS** in `generate()` down-tiers a fraction
  (`substrate.duffClusterFraction` = 0.5, ~5–7/map) of the normal piles to `kind='duff'`
  — spread evenly left→right so low- and high-value piles alternate. Purpose: cut
  drafting (there were too many orange piles) without starving map Energy.
- **`cache-engine`** — map-placed ENGINE food, a rarer high-value pile. Rendered as
  a mix of **6 RED/autumn leaf** sprites (`leafRed{Maple,Oak,Sweetgum,Japanese,
  Dogwood,Beech}`, see `RED_LEAF_KEYS` in main.js) so it reads as a distinct, redder
  litter. Finishing it drafts an **Engine** card. Placed mostly near the SURFACE
  (config `substrate.engine{ClusterMin,ClusterMax,ClusterRadius,SurfaceRows,DeepChance}`,
  a random **1–3/map** — placement retries at random x with a deeper fallback so a map reliably
  gets its 1–3) so the player must climb UP to reach these. Set in `drop()` with
  `kind='engine'` (`foodPiles` entry `kind:'engine'`); the draft glyph reads RED
  (offer `kind:'engine'`). Colonise + digest exactly like a normal pile — there is
  no standing map icon (an earlier free-standing red 3-card marker was replaced by
  this leaf pile as more natural/on-theme).
- **`nut`** — player-placed food (Acorn Cache etc.). Rendered as **acorn / chestnut
  / pine-cone** sprites, denser + smaller than leaves. Gives **energy only, no
  card**. Set in `deposit()` (never downgrades an existing `cache`).

**Food ENERGY is decoupled from nutrient** (per-cell `cell.energyPerNutrient`). Every map pile is
worth a small FIXED **1–4 Energy** (`pile.energyValue`, rolled in `drop()`), spread across its cells
so draining the whole pile yields exactly that value. The **nutrient** amount (50/cell,
`foodCellNutrient`) is UNCHANGED and still solely drives **attraction, threat-eating time, and
colonisation timing** — only the Energy yield is small now. Every food→energy path multiplies drained
nutrient by `cell.energyPerNutrient` (falling back to `energy.incomeEfficiency` for player-dropped
caches, which have none set): `turn.js` passive drain, the Digest action, and the pile-tap "+N⚡"
floater + `pile.finishEnergy` display. `foodClusterCount` = 8 (route caches, before the duff down-tier + feature caches).
`drop()` merges ALL same-kind piles a drop overlaps into one (no cell shared between piles).

Rendering lives in `main.js drawSubstrateLeaves` → `_drawLeafHeap(sets, col, row,
kind, alpha)` which picks the sprite set by `foodKind` (`_leafSets()` returns
`{leaves, red, nuts}`; `cache` and `duff` share the orange `leaves` set):
`count = isNut ? 8 : isDuff ? 9 : 11`, `base = cs * (isNut ? 0.26 : isDuff ? 0.52 :
0.64)`, sprite chosen by a stable hash so tiles are stable across frames (the
per-piece pick naturally makes each engine pile a varied mix of the 6 red leaves);
nut piles are muted and **duff piles pushed brown/dark** via `ctx.filter`/`globalAlpha`. Leaf/humus cards are defined
but **shelved** (kept out of the active decks). Draft offers (`cards.js
pushCardDraft`) are split by `displayCategory`: a NORMAL pile offers Basic/Event, an
ENGINE pile offers Engine (`offerPileReward` picks by pile `kind`). **Basics + Events are
INFINITE** (always offerable, repeatable across drafts) — a basic grants
`cards.draftBasicCopies` = 3 copies, an event grants 1 (the draft "Choose one" panel shows a **×3**
corner badge on basics so the count is visible; events/engines show none). Normal offers weight each slot
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
- **Level intro (every non-puzzle level start)** — `render/level_intro.js`
  (`showLevelIntro`) drops a full-screen BLACK **"Level N"** card that names the map's
  threats (ant / nematode / trichoderma; tutorial art, head-focused square crops with a
  white glow border) with an ×count from the live threat seed, then fades itself out on a
  click anywhere — the finished map is already drawn opaque behind it, so that fade is the
  map fading in. `main.js begin()` arms `pendingLevelIntro`; `revealMap()` shows it after
  the first drawn frame (puzzle mode keeps the old direct canvas fade). The first-run
  tutorial rides `pendingLevelIntro.onContinue`, so it starts only AFTER the intro clears —
  never under the black screen. CSS `#levelIntro` / `.li-*` (z 1300, above the tutorial's
  1200); `.li-out` drops `pointer-events` on dismiss so the fading overlay can't eat a tap.
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
- **WYSIWYG solid rock (`main.js solidifyRock`)** — every rock TYPE is drawn as a sprite larger
  than its cell footprint, so collision must be derived from what's actually DRAWN, not the
  generation flags (which are just "draw a sprite here" — see §9). Once per map (guarded by
  `sub._rockSolidified`, called in `frame()` before the rock draws, only once ALL sprites decode)
  `solidifyRock` stamps EVERY sprite — boulders (`drawBoulder`), formations (`formationRect`),
  columns (`drawRockColumns` geometry) — into TWO grids via `markCoverGrid` (samples the sprite's
  **opaque silhouette**: alpha, rotation-aware; per-image mask cached in `_alphaMaskCache`):
  (1) a COARSE per-cell cover → reconciled into `cell.rock`/`rockFill` (for LoS / spawn / rendering;
  `rockFill` cells are excluded from `rockGroups` so they're never re-drawn as their own boulder);
  (2) a FINE ¼-cell (9px) `_fineSolid` mask → the GROWTH collision (`substrate.solidAtWorld` ←
  `_placeOk`), which tracks the visible sprite far more closely than 36px cells. Lake water is baked
  solid in both; the guaranteed winnable corridor (`pathClear`) is kept OPEN in both. Food /
  above-surface cells are skipped.

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

- **High-score name entry moved from the death card to New Game.** You now type your display name in a
  black-and-white popup when you press **New** on the title (`render/title_screen.js` `newGameDialog`, which
  also folds in the erase-progress warning when there's saved progress; pre-filled with your last name via
  the new `playerName` option). Stored in localStorage `mycelium.playername.v1` (`highscores.js`
  `loadPlayerName`/`savePlayerName`) and reused for every score until you start another New Game. The
  run-over card no longer has a name input: on a death that cracks the top 10 it records the score
  automatically under that name and just shows **"TOP 10 SCORE"** + a clickable **"High Scores"** link
  (`ui.js` `.ov-hs-badge`/`.ov-hs-link`; `main.js` presentRunOver records via `loadPlayerName()` then passes
  only `{onView}`). Verified in the built game (popup saves the name, death shows the badge+link with no
  input, score recorded under the entered name, link opens the board).

- **INVESTIGATION (on hold — owner will send video): "food piles appear out of nowhere."** Chased the §11
  bug with the owner's repro (northern tip, orange cache, big grow). **RULED OUT: solidifyRock overwriting
  food** — probed 15 fresh maps / 195 piles for cells that are BOTH `rock` and food (`maxNutrient>0`/`foodKind`):
  **0 found** (`scratchpad/food_rock_probe.mjs`). And rock density does NOT scale with level (`main.js
  configForLevel` only sets ants/nematodes/trich counts), so that generalises to all levels. **Proposed cause
  (owner says NOT it): off-screen piles** — at the default play zoom (~1.35, the short map pins the zoom floor)
  the view shows only ~948×533 of the 2600×1500 world, so **~55% of piles are off-screen**
  (`scratchpad/pile_visibility.mjs`); the camera never follows growth, and `colonizeReachablePiles` auto-claims
  any pile within `sensingRadius` (135px ≈ 3.75 cells) of a strand + bridges runners to it. Owner rejected this
  — awaiting a video/screenshots.

- **Release prep (again): removed the visible DEV buttons + cut a fresh itch zip.** Re-applied the release
  removal (the "Dev buttons restored" entry below was for hosted-build dev; now reversed for the itch cut):
  dropped the species-picker "Dev quick-start" (`#ssDev`) + "Dev: unlock all" (`#ssDevUnlock`) from
  `species_select.js`, and re-gated the in-game "Dev: win level" (`#devWin`, `main.js updateDevWinBtn`)
  behind `config.dev.enabled` (false for release). Title "Dev: tutorial" stays un-passed (`onDevTutorial`
  unused). INVISIBLE `window.__game` hook (incl. `winLevel()`) kept for tests. Verified via Playwright: no
  `#tsDevTut`/`#ssDev`/`#ssDevUnlock`/`#devWin` render, hook intact, and the packaged zip boots + runs a
  level error-free. Packaged `dist/index.html` (as `index.html`) + `dist/assets/` at the zip root (no
  editor/artifact HTML), ~22 MB. This zip includes the all-real 11-species photos (incl. the L'Agence Du
  Bois Dry Rot) + the Split Gill ↔ Artist's Conk swap.

- **Dry Rot photo replaced (owner-supplied).** Swapped `assets/species/serpula-lacrymans.jpg` for a vivid
  orange-pored *Serpula lacrymans* shot from **L'Agence Du Bois** (`https://lagencedubois.fr/`,
  `wp-content/uploads/2024/10/serpula-lacrymans.jpg.webp`). Source is 750×1000 (aspect 0.75 ≈ our 560×720
  0.778), so it's a near-1:1 crop (full width, ~36px trimmed off height, 1.34× downscale = sharp). Earlier
  iNaturalist crop (David Orlovich) was too zoomed-in/grainy. `render/credits.js` Dry Rot line updated to
  L'Agence Du Bois. Rebuilt + verified in the built game.

- **All 11 species portraits → real photos; Credits lists all 11; Split Gill ↔ Artist's Conk role swap.**
  Replaced every AI portrait with a real CC-licensed iNaturalist photo (owner-supplied URLs + photographers),
  cover-cropped 560×720 (`scratchpad/reshape_all.py`; Dry Rot reframed with a zoom to drop a "leave for
  trap" note). `render/credits.js` `PHOTO_CREDITS` now lists all 11 (name · latin → linked artist), incl.
  a Cyrillic name. **Species swap:** Split Gill (`schizophyllum`) and Artist's Conk (`ganoderma`) traded
  `{unlock, memPick, memEngines, startLevelMin/Max, res, hand}` + blurb memory-clause — Split Gill is now
  the **L10 top prize** (memPick 15 + memEngines 2, res 20/52/16, hand 5× Apical, start 3–10), Artist's Conk
  the **L5** simpler memory colony (default 8 pick, res 10/37/6, hand Aquaporin + 5× Apical, start 2–5).
  Identity (id/name/latin/img/vibe) kept; memory system is data-driven (no id special-casing) so the swap is
  pure data. LOCKED_TIERS counts unchanged (L5=2, L10=1). Verified via Playwright: picker portraits, both
  detail cards (Split Gill shows 15+2 @ L10, Conk shows Choose 8 @ L5), credits 11+music.
  **Push saga:** the origin session's env-runner creds broke mid-turn (git-proxy `Unauthorized`; 0-byte
  signing key), so the binary commit couldn't be pushed. RECOVERED via the text-only branch
  `claude/species-photos-b64` (images base64-encoded + sha256 manifest, decoded + verified + rebuilt and
  landed by a follow-up session — the transfer/probe branches were deleted after landing). **Original
  photo provenance / re-download spec** — redownload each (`curl --cacert
  /root/.ccr/ca-bundle.crt <url> -o x`), cover-crop 560×720 (`scratchpad/reshape_all.py`; Dry Rot uses
  zoom=1.5/fy=0.92 to drop a "leave for trap" note), copy to `assets/species/<img>.jpg`, and set
  `credits.js PHOTO_CREDITS` (name · latin → artist + `inaturalist.org/people/<handle>`):
  - Fairy Ring Champignon / Marasmius oreades — David Harbour / david3613 — photos/140237375/original.jpeg
  - Honey Fungus / Armillaria ostoyae — Jenn Wren / jennwren — photos/332141087/original.jpg
  - Common Earthball / Scleroderma citrinum — Will Kuhn / willkuhn — photos/163759592/original.jpeg
  - Oyster Mushroom / Pleurotus ostreatus — Павлик Лисицын / lisopavlik — photos/442323380/original.jpeg
  - Slippery Jack / Suillus luteus — Daniel Seth Jackson / stonescottages — photos/228147257/original.jpeg
  - Bleeding Tooth Fungus / Hydnellum peckii — Morten Ross / morten — photos/110612066/original.jpg
  - Split Gill / Schizophyllum commune — Alan Rockefeller / alan_rockefeller — photos/356956707/original.jpg
  - Wine Cap / Stropharia rugosoannulata — Hector Hind / rotceh_dnih — photos/419536157/original.jpeg
  - Violet Webcap / Cortinarius violaceus — Alan Rockefeller / alan_rockefeller — photos/587984783/original.jpg
  - Dry Rot / Serpula lacrymans — **REPLACED** (see below); was David Orlovich / davidorlovich (iNat 619091268)
  - Artist's Conk / Ganoderma applanatum — Derek / calloftheloon — photos/6069315/original.jpeg
  (base URL: `https://inaturalist-open-data.s3.amazonaws.com/`). Swap: Split Gill gets
  `unlock:'Complete level 10', memPick:15, memEngines:2, startLevelMin:3,startLevelMax:10, res{20,52,16},
  hand[Apical Drive×5]`; Artist's Conk gets `unlock:'Complete level 5', (no memPick/memEngines),
  startLevelMin:2,startLevelMax:5, res{10,37,6}, hand[Aquaporin Channels×1, Apical Drive×5]` — plus each
  blurb's memory clause swapped.

- **Dev buttons restored (post-release, for dev on the hosted build).** Reversed the visible-button part
  of the release-prep pass: the species picker again renders "Dev quick-start" (`#ssDev`) + "Dev: unlock
  all" (`#ssDevUnlock`) (`species_select.js`), and the in-game "Dev: win level" (`#devWin`,
  `main.js updateDevWinBtn`) is back to plain `cardsCampaign()` gating (the `config.dev.enabled` gate is
  gone again). CSS for all three was never removed, so no style changes. Verified via Playwright in the
  built game: both picker buttons render, quick-start enters a run with `#devWin` showing, and clicking it
  wins the level (spore payout + reveal overlay). Cards test green; smoke = pre-existing ant-trail FAIL
  only. REMEMBER for the next itch cut: re-remove these (this entry's inverse — see the release-prep
  entries below + §Release in CLAUDE.md).

- **Credits button + popup (title screen).** New `render/credits.js` (`showCredits`) + a plain-white
  **"Credits"** text button bottom-right of the title (`.ts-credits`, mirrors the centered `.ts-hs` High
  Scores button; wired via `showTitleScreen({onCredits})` → `main.js`). Opens a B&W popup reusing the
  `.hs-wrap`/`.hs-card` shell — **the wrap positioning rule was made class-based** (`#hsOverlay.hs-wrap` →
  `.hs-wrap`) so both overlays share the full-screen fixed backdrop (the id-scoped version left the credits
  overlay unstyled). Sections "Species photography" + "Music"; each row's artist NAME is a `target="_blank"`
  link (opens in a new tab inside the itch iframe). Data lives in `credits.js` (`PHOTO_CREDITS`/`MUSIC_CREDITS`):
  Slippery Jack → Daniel Seth Jackson (inat/stonescottages), Bleeding Tooth → Morten Ross (inat/morten),
  Soundtrack → Sascha Ende (ende.app). New module added to `build.mjs`. Verified via Playwright.
  **Portraits swapped in:** `suillus-luteus.jpg` (Daniel Seth Jackson) + `hydnellum-peckii.jpg` (Morten
  Ross) now use real CC-licensed iNaturalist photos, cover-cropped 560×720 (`scratchpad/reshape.py`) — the
  AI-accuracy-complaint fix. Verified both render in the picker detail. Gotcha: **pasted images aren't
  written to disk in this env** — get a URL and `curl --cacert /root/.ccr/ca-bundle.crt` it (owner supplied
  the two inaturalist-open-data S3 links).

- **Release prep (again): removed the visible DEV buttons + cut a fresh itch zip.** Re-applied the same
  removal as the earlier release-prep pass (later reverted for campaign dev): dropped the species-picker
  "Dev quick-start" (`#ssDev`) + "Dev: unlock all" (`#ssDevUnlock`) from `species_select.js`, and re-gated
  the in-game "Dev: win level" (`#devWin`, `main.js updateDevWinBtn`) behind `config.dev.enabled` (false).
  Title "Dev: tutorial" stays un-passed (`onDevTutorial` unused). INVISIBLE `window.__game` hook (incl.
  `winLevel()`) kept for tests. Verified via Playwright: no `#tsDevTut`/`#ssDev`/`#ssDevUnlock`/`#devWin`
  render, hook intact. Packaged the itch build as `index.html` (bundled `dist/index.html`) + `assets/` at
  the zip root (no editor/tool HTML), ~22 MB / 165 files. Cards 61/0; smoke pre-existing ant-trail only.

- **Level-intro title is now the procedural mycelium wordmark ("LEVEL ONE", …).** `render/level_intro.js`
  no longer prints plain "Level N" — it spells the level in words (`levelWord()` handles 1..100:
  ONE…NINETEEN, TWENTY…NINETY [+ ones], ONE HUNDRED; numeral fallback outside) and grows
  `growMyceliumTitle(titleWrap, { word: 'LEVEL ' + levelWord(level) })` into the `.li-level` box
  (`width:min(720px,92vw); height:clamp(84px,14vh,128px)` — the wordmark auto-sizes to `min(H·0.72,
  width-cap)`, ~80px for short names). The controller is torn down (`killMyc`) on both dismiss-fade
  (`finishOut`) and programmatic `destroy()`; container keeps a `role=img` + `aria-label="Level N"` for
  accessibility. Reuses the existing `mycelium_title.js` module (already bundled) — no build.mjs change.

- **Desktop hand tray capped at ~40% height on short screens (no card distortion).** On screens shorter
  than ~740px the whole hand tray was eating too much of the map. The hand card (`.cardbtn`) is now
  `width: min(172px, calc(28.5vh - 39px))` and a **query container** (`container-type: inline-size`); every
  internal (`.cart` margin/radius, `.pips`, `.cplate` padding, `.cn`/`.ct`/`.crules`/`.cc` font-sizes) is
  re-expressed in **cqw** (each = original-px ÷ 1.72), so the whole card scales UNIFORMLY — pixel-identical
  at 172px, no distortion. The tray = card + ~55px fixed chrome (filter-chip row + padding); capping card
  height at 40vh−55px ⇒ card_w ≤ 28.5vh−39px, which locks 172px at ~740px tall. Result (Playwright,
  1200-wide): 620px→tray 40.0% (card 138×193), 720px→40.0% (166×233), 1000px→tray 30% (card locked 172×241,
  "less, as it is now"); aspect stays 5/7 (0.714) throughout. `container-type: inline-size` does NOT contain
  the block axis, so `aspect-ratio: 5/7` still drives height. Phone/landscape media queries (max-width 760 /
  max-height 520) still override with their own widths, unchanged.

- **Title screen: tiny faint captions above Survival New/Old.** "start a new game" above **New**,
  "continue last game" above **Old** (lowercase, ~10px, faint grey). Each button is wrapped in a `.ts-act`
  span so a `.ts-cap` can float absolutely above it (doesn't disturb the 3-col grid or `positionMenu`
  height math); the grid's `justify-self` end/start was re-applied to the `.ts-act` wrappers. Only the
  active Survival row; the grayed Campaign row is untouched. The caption is positioned `bottom:84%` of the
  button-height containing block (not `100%`) so it hugs the LETTER tops rather than the tall button box —
  NEW/OLD carry a big leading + ~0.19em ink gap above the caps, so `100%` floated the caption ~15px clear;
  `84%` tucks it ~3px above the caps and, being a %, scales with the clamped font.

- **Fixed the map "flash" when leaving a run for the picker.** `#titleScreen` has an opaque bg, so while
  it's up the game canvas is hidden — but pressing New/**Old** fades the title's opacity to 0 over ~0.55s,
  which briefly revealed the game `#game` canvas behind it still holding the FINISHED run's map at opacity 1
  (revealed by `revealMap`), then the picker covered it — a one-frame flash of the old map. Fix: a
  `hideCanvas()` helper (transition-none `opacity:0`) called at the top of `showMainMenu` and `showPicker`,
  so entering the title/picker instantly hides any stale map; `begin()`→`revealMap()` re-reveals it for the
  next run. Verified via Playwright: canvas opacity is 0 on the title and 1 during a run.

- **Species prices raised (steeper unlock curve).** Replaced the old `1000·2^rank` doubling
  (1000/2000/4000/8000/16000) with an explicit per-tier map — **`TIER_COST` in `species.js`: L1 1 000 ·
  L3 5 000 · L5 10 000 · L7 25 000 · L10 50 000** — so the top species are a real grind rather than a few
  runs. `unlockCost` now looks up `TIER_COST[unlockLevel]` (explicit `sp.cost` still overrides; off-tier
  levels fall back to the nearest tier ≤ level). Mirrored in `docs/species-editor.html`'s reimplementation.
  For reference, a run that reaches level 7 banks ≈ 2 450 Spores (clears 1–6 = 2 100, die on 7 = +350), so
  at that rate: L1 ≈ 1 run · L3 ≈ 2 · L5 ≈ 5 · L7 ≈ 11 · L10 ≈ 21 (and the L7/L10 tiers additionally require
  actually *clearing* levels 7/10 to reveal, not just reaching them). `UNLOCK_TIER_BASE`/`tierLevels`-rank
  logic removed from the cost path.

- **High-score name entry moved INLINE into the run-over card (no separate popup).** The qualifying-run name
  entry is now a section inside `ui.showOverlay` (the "Your run has ended" card) instead of its own overlay:
  "You reached level N as X — a top 10 run." + a name input + a **Save** button. Pressing **Save** records
  the score (local always + global when enabled) and the button relabels to **View**; pressing **View** opens
  the normal high-scores list (`showHighScores`). No exclamation marks. Wiring: `render/highscores.js` dropped
  `maybeHighScore`/`showEntry` for **`checkHighScore()`** (async → returns a qualify context or null) +
  **`recordHighScore()`**; `main.js finish()` calls `checkHighScore` then `ui.showOverlay(r, hs)`; `ui.js`
  renders the inline block from `hs` callbacks (no new import → build order untouched). Verified via Playwright
  (local + mock-backend): inline entry coexists with New run/Main menu, Save→View→list, Save POSTs the right
  body to the backend. CSS `.ov-hs`. Cards 61/0; smoke 100/1 (pre-existing).

- **High-scores polish.** Title-screen "High Scores" is now **plain clickable white text** (small, no
  button/pill chrome; `.ts-hs`), and the leaderboard heading renders "HIGH SCORES" as the **procedural
  mycelium wordmark** (`growMyceliumTitle` into a `.hs-title-myc` container, destroyed on close) instead of
  plain text — matches the title screen. Supabase URL/anon key wired in + verified live (read + insert +
  level-cap reject all confirmed via curl against the real project). Later sizing pass: the wordmark's size
  is capped by its container height (`titleSize = min(H·0.72, …)`), so `.hs-title-myc` height was raised
  48→84px to let it grow to the card-width limit (~52px, was ~34px); the close **✕** (`.hs-close`) was
  halved to 16×16 / 8px (flex-centred) so it's a small corner mark.

- **High scores went GLOBAL (Supabase, `net_scores.js`).** The board can now be a shared leaderboard instead
  of per-device. `net_scores.js` talks straight to Supabase's PostgREST from the browser (no server code):
  `fetchGlobalBoards()` = two GETs (weekly = `created_at=gte.<7d>`, all-time; both `order=level.desc,created_at.asc&limit=10`);
  `submitGlobalScore()` = a POST with the anon key. Config lives in two consts at the top of `net_scores.js`
  (URL + PUBLIC anon key — safe to commit; gated by RLS) OR `globalThis.MYCELIUM_SUPABASE` at runtime; empty
  = disabled → local board. `render/highscores.js` is now global-aware: `showHighScores` shows the global
  board with a "Global" note (falls back to local + "Offline" note on fetch failure); `maybeHighScore`
  (replaces the old direct qualify+prompt) fetches the live board, qualifies via `beatsBoard` (new pure
  export from `highscores.js`), prompts, then records **locally always + globally when enabled**. Local
  `highscores.js` is retained as the offline fallback + history. Setup is documented in
  **`docs/leaderboard-setup.md`** (create table + read/insert RLS policies with a level≤100 sanity cap; paste
  URL+anon key; rebuild). Caveat: client-submitted scores are inherently spoofable (RLS caps the absurd).
  **Build fix:** `build.mjs`'s `EXPORT_DECL_RE` now matches `export async function` (it didn't — the two
  async exports silently weren't registered → "fetchGlobalBoards is not a function" until fixed). Verified
  via Playwright against a stateful mock PostgREST: GET populates the board (CORS ok), a qualifying death
  POSTs the right snake_case body, the re-fetch shows the new row; and the disabled path still uses local.

- **High scores — local WEEKLY + ALL-TIME top 10 (`highscores.js` + `render/highscores.js`).** A run's score
  is the campaign LEVEL it reached; on death, if it cracks the top 10 of EITHER board the player is prompted
  for a name (before the run-over card), then sees the board with their fresh row highlighted. A small plain
  B&W **"High Scores"** button sits centred at the bottom of the title screen (`title_screen.js` new
  `onHighScores`; wired in `main.js showMainMenu`). Boards show **rank · name · level · species**.
  - **Storage is per-device** (`localStorage` key `mycelium.highscores.v1`) — this is a static browser game
    with **no backend**, so there's no shared/global leaderboard; this is the local foundation for one.
    `qualifies(level)` = would place in weekly (rolling 7-day) OR all-time top 10; `recordScore()` prunes to
    last-week ∪ all-time-top-60 so storage stays bounded. Data layer has no DOM (unit-tested in node).
  - `main.js finish()` (death path only, `cardsCampaign() && r.died && chosenSpecies`) calls
    `promptHighScoreEntry({level, species, speciesName, onDone: ()=>ui.showOverlay(r)})`; dev/testall runs
    (no `chosenSpecies`) don't score. Overlays namespaced `#hsOverlay`/`.hs-*`, plain B&W (index.html CSS).
  - **GOTCHA (cost me a boot-breaking bundle):** `build.mjs`'s import stripper does NOT support aliased
    imports — `import { x as y }` leaks `as` into the bundle and throws "Unexpected identifier 'as'". Use a
    plain `import { x }`. Both new modules were added to the `build.mjs` file list. Verified end-to-end via
    Playwright: title button → empty board; death → name prompt → save → highlighted row → Continue →
    run-over card; entry persists with the right species. Cards 61/0; smoke 100/1 (pre-existing ant-trail).

- **Dev buttons: removed for the itch release build, then restored for continued dev.** An itch HTML build
  was packaged with the visible dev affordances stripped — the species-picker "Dev quick-start" (`#ssDev`) /
  "Dev: unlock all" (`#ssDevUnlock`) and the in-game "Dev: win level" (`#devWin`). That removal was then
  **reverted** so they're back in the working tree for building the campaign. **Release procedure for future
  builds:** before cutting a public zip, strip those three (drop the two `species_select.js` picker buttons +
  their listeners; gate `main.js updateDevWinBtn` behind `config.dev.enabled`, which is already false). The
  dev cheats/sliders panel is already `config.dev.enabled`-gated (off), and the title "Dev: tutorial" button
  is already un-passed. The itch zip = `dist/index.html` + `assets/` only (index.html at the zip root; no
  editor/tool HTML), ~22 MB.

- **Menu → level music now FADES OUT fast (was a hard cut).** Starting the first level swapped the single
  `<audio>` element's `src` instantly, which killed the menu theme (vol29) mid-note. `playLevelMusic()` now,
  when the menu theme is audible, first ramps its volume to 0 over **`MENU_FADE_OUT_MS` = 550 ms**, THEN
  swaps to the random level track and fades THAT in (`LEVEL_FADE_MS`). `ramp()` gained an optional `onDone`
  callback (fires only when a fade reaches its target, never when a newer fade supersedes it) to sequence
  the out→swap→in. Also moved the `playLevelMusic()` call from the TOP of `main.js begin()` to the END —
  after the one-time `initCards`/`buildRenderers`/`resize` — so the wall-clock fade ramp isn't starved by
  that synchronous work. Verified via Playwright with a small viewport (so the headless software renderer
  doesn't peg the CPU and starve the sampler): vol29 ramps 0.29→0.035, swaps to vol7, which eases 0→0.32
  (`scratchpad/music_fadeout_verify.mjs`). (Full-size headless can't show it — software rendering pegs the
  main thread; real GPU-accelerated devices fade smoothly.) Cards 61/0; smoke 100/1 (pre-existing ant-trail).

- **Boot LOADING SCREEN — preload + decode everything up front (kills in-game pop-in).** The game used to
  reveal the menu immediately and load art lazily, so card faces / species portraits / threat portraits
  popped in on screen. Now a minimal overlay (`render/loading.js`, `#loadscreen`) shows a **small centered
  white % counter** while ALL art is fetched AND `img.decode()`'d up front, then a **small centered "Click"**
  — that click both dismisses the loader and serves as the **user gesture that unlocks audio autoplay** (so
  music starts reliably, including mobile). What's preloaded: canvas sprites (`loadAssets`, now with an
  `onProgress` callback) **+** every card face, every species portrait, the 3 threat portraits, and the
  spore icon (`preloadImages`, new). The menu/picker/hash-route is deferred behind the click via a new
  `enterGame()` in `main.js` (`frame()` already idles on null state, so the loop just sits behind the
  opaque overlay); a **12s safety net** enters anyway if a fetch hangs. The `%` is **monotonic** (the two
  progress sources settle at different times, so backward ticks are ignored).
  - **URL unification (was a latent bug):** the boot preload, the in-game hand (`ui.js cardArt`), and the
    picker (`species_select cardImg`) now ALL request the same cache-bust `?v=` card-face url — previously
    `cardArt` had no query, so the picker's decoded copies sat unused and the hand still popped in (and
    in-game card art ignored the deploy version). The spore icon keeps its no-query url; the preload matches.
  - **Dist deploy slimmed 61 MB → ~22 MB:** `build.mjs` now EXCLUDES the authoring-candidate folders
    (`assets/*_options`, `card_art_archive`) from the `dist/assets` copy — nothing in `manifest.json` or the
    UI ever fetched them, so they were pure deploy bloat. Source `assets/` is untouched; the version hash
    (top-level files only) is unaffected. (`rmSync` the dist copy first so trimmed folders don't linger.)
  - Verified via Playwright (`scratchpad/loadscreen_verify.mjs`): % climbs 0→…→Click, menu hidden until the
    click, loader dismisses + menu enters on click, zero page errors; dist has 0 `_options` folders. New
    module registered in `build.mjs` file list. CSS `#loadscreen`/`.ld-pct` (index.html). Cards 61/0; smoke 100/1.

- **Per-species STARTING LEVEL (higher tiers skip the early grind).** A species now begins its run on a
  campaign level tied to its tier instead of always level 1. **Fixed-start species open on their unlock
  level:** Slippery Jack / Bleeding Tooth → **3**, Wine Cap → **5**, Violet Webcap / Dry Rot → **7** (the
  L1 species + the two ungated starters stay on **1**). The two **memory colonies get a player-adjustable
  range**, dialled in with a **"Lvl: X" − / + stepper next to the Start game button**: **Split Gill 2–5**
  (default 5), **Artist's Conk 3–10** (default 10) — the toggle only ever dials DOWN from the tier level.
  Each tier row on the picker shows the tier's start-level SPAN far-right on its **"Complete level N"**
  header — a single level for fixed tiers ("Complete level 3 ──── Starts on level 3") and a RANGE where a
  memory colony can dial it ("Complete level 5 ──── Starts on level 2-5"; "Complete level 10 ──── Starts on
  level 3-10"). Starter/L1 rows in mint, gated tiers dimmed; the communal "?" row shows none. Implementation:
  - `species.js`: new optional `startLevelMin`/`startLevelMax` on a species (only Split Gill + Conk set
    them) + exports `startLevelRange(sp)` → `{min,max,adjustable}` and `defaultStartLevel(sp)` (fixed =
    unlock level; adjustable = unlock level clamped into the range). No field needed for fixed species.
  - `render/species_select.js`: the 'start' inspector builds the stepper for adjustable species (clamped,
    − / + disabled at the ends) and carries the chosen level through `onStart(lvl)` → `onPick(sp, lvl)`;
    a `startTag(level)` badge is appended after the `.ss-rule` on every real tier-row header.
  - `main.js onPick(sp, startLevel)`: sets `currentLevel = max(1, startLevel)` before seeding, so
    `configForLevel` scales threats to that level and `begin()` stamps `state.level`. Winning still
    advances `currentLevel+1` up to `MAX_LEVEL`.
  - `docs/species-editor.html`: `clone`/`norm`/`serialize` preserve + emit the two fields (with editable
    "Start lvl min/max" inputs in the memory block) so an edit-export-paste can't silently strip them.
  - **Consequences (intentional):** starting above level 1 **skips the first-run tutorial** (it only fires
    at `currentLevel === 1`) and pays `sporesForLevel(startLevel)` (=100×level) per clear. CSS `.ss-startlvl`
    + `.ss-lvlstep`/`.ss-lvlpm`/`.ss-lvllbl` (index.html, on-theme B&W). Verified via Playwright
    (`scratchpad/startlevel_verify.mjs`): row badges 1/1/3/**2-5**/7/**3-10** + blank communal; Split Gill stepper
    clamps 2–5 (default 5), Conk 3–10 (default 10), Wine Cap has none; editor exports both ranges
    (`scratchpad/editor_startlevel_check.mjs`). Cards 61/0; smoke 100/1 (pre-existing ant-trail).

- **Campaign extended to 100 levels (`species.js`).** `MAX_LEVEL` 11 → **100**. The `LEVEL_THREATS`
  table still hand-authors the early curve (levels 1..11, unchanged); `threatsForLevel` now COMPUTES
  anything past it so no 100-row table is needed: **nematodes = Trichoderma = level number** (as before),
  and **ant nests keep climbing but cap at `MAX_ANT_NESTS` = 8** (new const). Ant continuation from L11's
  6: ~+1 every 4 levels → L12–14 = 6, L15–18 = 7, **L19+ = 8 (capped)**. Spore income is unchanged
  (`sporesForLevel` = 100 × level, already a formula, so it keeps scaling to 10 000 at L100). Only the
  win gate (`main.js` `cleared >= MAX_LEVEL`) and the (already display-unused) `maxLevel` prop consume
  `MAX_LEVEL`, so no UI/HUD change was needed. `dist/` rebuilt.
- **Music split into MENU vs LEVEL tracks (`render/music.js` reworked).** `backrooms-vol29` ("the backrooms
  music vol 29") is now the dedicated **menu theme**. Rather than seek to 0:20 at runtime (unreliable — a
  non-range host / autoplay-blocked start can't seek forward), the **file itself was permanently trimmed**: the
  first ~19s intro was cut and a fresh Xing/VBR header rebuilt so the duration reads correctly and it loops
  cleanly (`scripts/trim_mp3.py`, pure-stdlib MP3 frame parser — no ffmpeg here; original preserved in git
  history). So the menu track just plays from the top with a **quick ~1.2s fade-in**, loops, and plays
  **continuously across title → species picker** (`playMenuMusic()` is
  idempotent — no restart when the same track is already the menu track). The moment a **level** starts, a
  RANDOM track from the OTHER three (`vol7/vol10/vol23`) takes over (`playLevelMusic()` from `begin()`); vol29
  is NEVER used in-level, and a level track keeps playing across level→level transitions (only re-picks when
  the previous track ends, via the `ended` handler). New exports `playMenuMusic` / `playLevelMusic`; `initMusic`
  is now just setup (ensure `<audio>` + gesture retry) and no longer force-plays a random track. Wired in
  `main.js`: `showMainMenu` + `showPicker` → `playMenuMusic()`, `begin()` → `playLevelMusic()`. Verified via
  Playwright request-logging (`scratchpad/music_verify.mjs`): title requests vol29 only; `#dev` (straight to a
  level) requests a non-vol29 track.
  - **Mobile autoplay-unlock hardening (follow-up).** A "no music on my phone" report turned out to be the
    **device's system mute switch** (OS-level — no web code can override it), but the unlock path was hardened
    anyway: `bindGesture()` now retries `tryPlay()` across `pointerdown / pointerup / touchstart / touchend /
    click / keydown` on BOTH `window` (capture) and `document` (iOS is picky about which event counts), and
    `playMenuMusic()` eases in on a **wall-clock `ramp()`** timer rather than waiting on a `'playing'` event, so
    the volume always reaches full even if that event never fires. Desktop-verified (`scratchpad/music_final.mjs`).
    The in-game **Music** toggle (`mycMuted` in localStorage, `ui.js set-mute`) is per-device and can also
    silence one device independently of the code.

- **Five polish/feel tweaks (owner batch).**
  1. **Win/lose waits for the last grow to finish animating.** `presentRunOver()` now defers while
     `anyRevealing(lastTime)` is true (reusing the draft-intro reveal check), retried every frame from
     `renderFrame` (`if (state.runOver && !_runOverPresented) presentRunOver()`), with a `REVEAL_START_GRACE`
     (450 ms, so a reveal has time to *start*) and a `REVEAL_END_WAIT` hard cap (2800 ms, so a stuck/never-
     starting reveal can't hang the ending). `_runOverAt` timer reset in `begin()`. Verified no soft-lock (a
     forced `killColony` still presents within ~1.5 s).
  2. **Removed the Dev:tutorial title button** — `showMainMenu` no longer passes `onDevTutorial`, so
     title_screen.js (guarded by `if (onDevTutorial)`) renders nothing; the `tutorialDevForce` plumbing is left
     dormant.
  3. **Enemy field-of-vision darker / more legible** — `drawOccludedSight` wash `edgeA*0.32`→`*0.55`; mould
     sight `150,190,70 @0.10`→`120,155,45 @0.28` (dying 0.05→0.12), worm sight `165,205,115 @0.10`→
     `130,165,80 @0.28`.
  4. **Can't outrun Trichoderma with a big grow.** New `config.trichoderma.growInfectBurst` (18 ≈ 6 grow-steps,
     SLIDER): `infectStrandsInMould` now `infectAround(node, growInfectBurst, chance 1)` from every strand
     caught in the mould, so a grow-6 that pushes its tip past a cloud has the whole strand (tip included)
     claimed at once instead of leaving a white tip to run on. Headless-verified (seed 18 rings away → 21 nodes
     rot; burst 0 = old 1-node behavior). Only the grow-INTO-mould path bursts; passive cloud contact keeps
     `contactChunk` 4.
  5. **Artist's Conk "?" card title** `Choose 15 + 2 engines`→**`15+2`** (species_select.js `chooseFiveFace`).
  Cards 61/0; smoke 100/1 (pre-existing). Import-leak 0, rebuilt `dist/`.

- **Species balance pass (owner, authored via the species-editor).** Roster-wide water buffs (most species now
  **35–52 W**), P/E tweaks, and hand redesigns — Oyster → Cord Capillary + 3 Foraging Fan + **12 Turgor Thrust**;
  Slippery Jack → Prospecting Cords + 8 Apical Drive + 6 Vesicle Surge + 3 Fruiting Vigil; Bleeding Tooth → +6
  Rhizomorph Lance; Wine Cap → +Guerrilla Runners/Constricting Snap/Apical Drive; Violet Webcap → +Guerrilla
  Runners/Fruiting Vigil/Vesicle Surge; Dry Rot → +Rhizomorph Lance/Turgor Thrust/Amputate; Earthball → 7 Apical
  Drive / 5 Hyphal Extension; trimmed the Oyster/Suillus/Dry-Rot blurbs. All 11 seed cleanly (headless-verified
  hand sizes + every card name resolves; `scratchpad/species_seed_check.mjs`). Cards 61/0; smoke 100/1 (pre-existing).
  **Tier swap (follow-up, owner):** to actually surface Earthball at picker slot #3, its `unlock` was changed
  `Complete level 3`→`Complete level 1` and — cascading everything back one — Slippery Jack went `Complete level
  1`→`Complete level 3`. Net: L1 = **Earthball, Oyster** (Earthball reveals first / 1000 Spores), L3 = **Slippery
  Jack, Bleeding Tooth** (2000). Array within-tier order already matched, so it was two `unlock` edits. Picker now
  reads #3 Earthball · #4 Oyster · #5 Slippery Jack · #6 Bleeding Tooth · #7 Split Gill · #8 Wine Cap · #9 Violet
  Webcap · #10 Dry Rot · #11 Artist's Conk. (Reminder: picker order = unlock tier, THEN within-tier array order;
  the raw cross-tier array order is irrelevant to the display.)

- **Species editor tool (`docs/species-editor.html`).** A standalone authoring page to review + edit the whole
  roster: per species it exposes name/latin/vibe/unlock-tier/art-slug, **starting resources (E/W/P)**, the
  **blurb**, the **starting hand** (card-thumbnail chips with count inputs + remove, and an "add a card"
  picker), and **order** (▲▼ move buttons); memory species also show `memPick`/`memEngines`. It **live-imports**
  `../src/species.js` (SPECIES/LOCKED_TIERS/unlockCost) and `../src/cards-data.js` at runtime (ES modules), so
  it never goes stale — unlike `card-editor.html`, which inlines its data. Edits persist to localStorage;
  toolbar exports a ready-to-paste `export const SPECIES = […]` block (strings via `JSON.stringify` → valid
  JS), a human-readable change summary, or JSON. **Deployed + local:** `build.mjs` bakes the current roster +
  a slim card list into the page's `#injectedData` tag and writes `dist/species-editor.html`, so it's live at
  **`<site>/species-editor.html`**; when that tag is empty (running from `docs/` in the source tree) the page
  live-imports `../src` instead and prefixes assets `../assets/` vs `assets/`. `unlockCost` is reimplemented in
  the page so it needs no runtime import. Verified via Playwright both ways (`scratchpad/species_editor_verify.mjs`
  from repo root; `scratchpad/species_editor_dist.mjs` from `dist/`): 11 species load in order, portraits + hand
  chips render, the dist copy makes ZERO `/src/` fetches, export contains all ids + the conk's memory fields,
  reorder works.

- **Final species — Artist's Conk (`Ganoderma applanatum`), the upgraded MEMORY colony (Complete level 10).**
  Like Split Gill it curates its opening hand from the LAST run's drafts — but bigger, and now with engines:
  **pick up to 15 basic/event cards + 2 engine cards** drafted last run (two independent caps), plus a fixed
  **5× Apical Drive**. Fills the last non-communal picker slot (#11 tile; 16000 Spores, tier rank 4). Theme:
  a perennial polypore whose stacked annual tube layers are a living archive of past seasons (factual). The
  memory system was extended to carry engines:
  - `engine/cards.js chooseOffer` now tallies ENGINE-category drafts into a NEW `state.cards.runDraftedEngines`
    map (parallel to `runDrafted`); both are init in `initCards` and ride `snapshotCarry`/`applyCarry` across
    levels for free (the whole `state.cards` object is carried).
  - `species.js`: new `lastDraftEngines` progress pool + `lastDraftEnginesFor` / `saveLastDraftEngines`
    (parallel to lastDrafts). Species gained optional **`memPick`** (non-engine cap, default 8) and
    **`memEngines`** (engine cap, default 0). Split Gill keeps the defaults → unchanged.
  - `render/loadout_select.js`: generalized — `maxPick` / `maxEngines` / `enginePool` params, TWO independent
    caps (a card dims/locks when ITS category cap is hit), counter reads "`N/15 cards · M/2 engines`" (or plain
    "`N/8`" when there's no engine pool). The engine pool is only merged when `memEngines > 0`.
  - `main.js`: `startRunWithLoadout` offers both pools (picker shows if either is non-empty); `runEndThen`
    records both; `effectiveSpecies` merges the curated loadout (basics/events + engines) into the opening
    hand exactly as before (engines are just cards by name → dealt to hand → installable).
  - `render/species_select.js chooseFiveFace(sp)` reads the species' counts for the "?" placeholder card
    ("Choose 15 + 2 engines" for Artist's Conk; "Choose 8" for Split Gill).
  - **Verified (Playwright, `scratchpad/memory_verify.mjs`):** the loadout picker enforces both caps (reached
    `5/15 cards · 2/2 engines`; a 3rd engine click is blocked), and the confirmed opening hand =
    `{Apical Drive:5, Condense:5, Cord Capillary:1, Rhizomorph Trunkline:1}` (fixed + curated cards + curated
    engines). Split Gill regression intact (mid "Choose 8 cards", counter "0 / 8", no engine pool). Realistic
    FLUX portrait (concentric-ring top-down; `scripts/gen_ganoderma.py`, 3 options in `assets/species_options/`).
    Cards 61/0; smoke 100/1 (pre-existing ant-trail fail). Import-leak 0, rebuilt `dist/`.

- **Three "double-engine" species (fill the level-5/7 tiers).** Owner-specified engine pairings; I chose
  factually-accurate real mushrooms + generated realistic FLUX portraits. Each starts with enough resources to
  install BOTH its engines on turn 1 (headless-verified, `scratchpad/species_install2.mjs`):
  - **Wine Cap** (`Stropharia rugosoannulata`, id `stropharia`, `warm`) — **Complete level 5**, slot 2 (beside
    Split Gill). Openers **Cord Capillary** (+1⚡/rd) + **Mineralizing Saprobe** (+1P/5rd). A vigorous
    saprotroph that decomposes (energy) and mineralises phosphate; its acanthocyte-bearing mycelium really does
    snare nematodes. Start `20⚡/20W/8P` (installs = 4⚡+2W+6P and 14⚡). Hand: the 2 engines + Hyphal Ext ×5,
    Foraging Fan ×4, Acorn Cache ×3.
  - **Violet Webcap** (`Cortinarius violaceus`, id `cortinarius`, `spore`/violet border) — **Complete level 7**,
    slot 1. Openers **Phosphatase Reserve** (+2P/8rd) + **Aquaporin Channels** (+1W/6rd). Ectomycorrhizal
    nutrient-miner: secretes phosphatases to free bound phosphate, shuttles water to its host. Start
    `34⚡/18W/8P` (installs = 12⚡ and 20⚡+6P). Hand: 2 engines + Apical Drive ×5, Hyphal Ext ×5, Acorn Cache ×3.
  - **Dry Rot** (`Serpula lacrymans`, id `serpula`, `warm`) — **Complete level 7**, slot 2. Openers **Aquaporin
    Channels** (+1W/6rd) + **Cord Capillary** (+1⚡/rd). True dry rot literally translocates water through its
    cords to rot dry timber for energy — cords-pipe-water + wood-energy. Start `26⚡/18W/14P` (installs =
    20⚡+6P and 4⚡+2W+6P). Hand: 2 engines + Apical Drive ×5, Hyphal Ext ×5, Acorn Cache ×3.
  - Appended to `SPECIES` (between-tier order is irrelevant to the picker; within-tier order gives the slots).
    No card-data changes. Picker now full through level 7: #1 Fairy Ring · #2 Honey Fungus · #3 Oyster · #4
    Slippery Jack · #5 Earthball · #6 Bleeding Tooth · #7 Split Gill · #8 Wine Cap · #9 Violet Webcap · #10 Dry
    Rot (only Complete level 10 + the communal "?" row remain empty). Costs: lvl 5 = 4000, lvl 7 = 8000 Spores.
  - **Art:** `scripts/gen_species_batch3.py` (field-photo prompt); 3 options each in `assets/species_options/`,
    winners promoted to `assets/species/{stropharia-rugosoannulata,cortinarius-violaceus,serpula-lacrymans}.jpg`.
    Verified live picker order + all detail cards via Playwright (`scratchpad/species_shot3.mjs`). Cards 61/0;
    smoke 100/1 (pre-existing ant-trail fail). Import-leak 0, rebuilt `dist/`.

- **Two new starter species + level-1/3 roster reshuffle (the "first economy engine" on-ramp).** Added two
  brand-new gated species to `species.js`, both unlocking at **Complete level 1**:
  - **#3 Oyster Mushroom** (`Pleurotus ostreatus`, id `pleurotus`, vibe `warm`) — opens with **Cord Capillary**
    (`+1⚡/round`). It's the *weakest* energy engine in the whole set, but it's the player's **first** starting
    energy engine, so at this progression point it's their strongest energy build (framing per owner). Themed as
    a vigorous wood-rotter that "keeps the lights on." Start `8⚡/20W/7P` → installs Cord Capillary (`4⚡+2W+6P`)
    turn 1. Hand: Cord Capillary ×1, Foraging Fan ×5, Hyphal Extension ×4, Acorn Cache ×4.
  - **#4 Slippery Jack** (`Suillus luteus`, id `suillus`, vibe `spore`) — opens with **Prospecting Cords**
    (`+1P / 8 rounds`), the weakest P engine but their first P engine. Mycorrhizal flavor: it **trades sugar for
    phosphate**, so it starts energy-rich (`14⚡/22W/2P`) and spends `12⚡` to install the P engine turn 1. Hand:
    Prospecting Cords ×1, Apical Drive ×5, Hyphal Extension ×5, Acorn Cache ×3.
  - **Common Earthball** and **Bleeding Tooth** moved from Complete level 1 → **Complete level 3** (unchanged
    otherwise; now picker #5 and #6, and cost **2000** Spores as the tier-2 price vs 1000). **Split Gill**
    (level 5) untouched.
  - **Impl note:** between-tier array order is irrelevant to the picker — it renders tier-by-tier, filtering
    `SPECIES` by `unlock` label — so this took only 2 inserts (after Honey Fungus) + 2 `unlock`-label flips
    (`Complete level 1`→`Complete level 3` on scleroderma/hydnellum). No card-data change (both signature engines
    already exist). Neither new species is a `memory` species.
  - **Art:** realistic FLUX-1.1-pro portraits matching the house style (photoreal macro, shallow DoF), generator
    `scripts/gen_species_new.py`; options in `assets/species_options/`, winners promoted to
    `assets/species/pleurotus-ostreatus.jpg` + `suillus-luteus.jpg`.
  - **Verified:** live picker order via Playwright (`scratchpad/species_shot.mjs`) = #3 Oyster · #4 Slippery Jack ·
    #5 Earthball · #6 Bleeding Tooth · #7 Split Gill; both detail cards render correct hand/resources/blurb;
    headless install check (`scratchpad/species_install.mjs`) confirms each installs its engine turn 1. Cards
    tests 61/0; smoke 100/1 (the one fail — "growth through an ant trail" — is **pre-existing on HEAD**,
    unrelated). Import-leak 0, rebuilt `dist/`.

- **Level-intro threat order → Ants · Trichoderma · Nematodes (trich in the middle).** Owner: reads nicer with
  the Trichoderma portrait centred. Swapped the nematode/trich rows in `main.js levelThreatList()` (the array
  the level-intro screen renders in order, filtered to count > 0). Purely cosmetic.

- **Substrate colonisation reads more like mycelium: bendy runner + inward-leaning mat** (`network.js
  colonizeReachablePiles` + `_bridgeInto`). Owner: the strands reaching into food piles were too straight and
  the bends pointed away from the food. Two changes: (1) **`_bridgeInto`** (the runner from the colony to a
  pile) was a dead-straight line — now it WANDERS with a wobble but RE-AIMS at the food each step
  (`bridgePull` 0.42), so the bends lean toward the pile; the wobble (`bridgeWobble` 0.55) calms as it nears,
  and each step tries the bendy heading then a dead-straight fallback so it still threads gaps / never fails to
  reach an in-range pile. (2) The in-pile **mat burst** was a random outward star of single straight spokes —
  now a few short (1–2 seg) curved tendrils per cell (`matStrandCurve` 0.4) whose base heading is biased TOWARD
  the pile centroid (`matStrandSpread` 1.5 wide so cells still fill), so the mat reaches INTO the food instead
  of spiking outward. Node count per pile is similar (`strands ≈ entryBurst×0.6`, up to 2 nodes each). Config
  (`config.growth`): `bridgeWobble/bridgePull/matStrandSpread/matStrandCurve`. Verified geometry
  (`scratchpad/colonize_render.mjs`). Tests green; import-leak 0.

- **Organic COMPANION strands on directed grows — TEST wired to Rhizomorph Lance only.** Owner wants normal
  grows to feel more like mycelium: an occasional runner that branches off, SHADOWS the main heading toward the
  goal for a while, then tapers off to one side. Impl: `network.js _sproutCompanionStrand(substrate, from,
  baseAng, len)` — branches off at ±0.2–0.5 rad, eases back onto `baseAng` for the first `companionFollow`
  (0.6) of its length (runs alongside the cord), then peels away over the tail (`companionDrift` 1.1). Nodes
  flagged `.side` (excluded from seek/crowd buckets, like `_sproutSideStrand`) **and** `.companion` (diagnostic
  tag). Drawn only from `_branchRng` so it never perturbs the main path. `growDirected` gained an opt-in 9th
  param `companion=false`; when true it rolls `companionChance` (0.22) per step and throws a runner of
  `companionMin..Max` (4..9) segments. **Currently OFF everywhere** — Rhizomorph Lance's `companion` arg was
  flipped back to `false` (owner is evaluating the curved twigs ALONE first); the machinery stays in place, so
  re-enabling is a one-flag change (cards.js Rhizomorph Lance last arg → `true`). The other directed grows
  (Apical Drive, Fruiting Vigil, Leading Cord, Tropic Lunge) never had it. Config knobs (`config.growth`): `companionChance/Min/Max/Follow/Drift`. Verified geometry
  (`scratchpad/lance_render.mjs` — white cord / blue companions / dim side-twigs): companions shadow the
  cord then peel off, as intended. Tests green; import-leak 0. If approved, enable `companion=true` on the
  other directed-grow effects.

- **`_sproutSideStrand` reworked to look more organic (ALL grows).** Owner: the random side-twigs looked "too
  random and too straight." Now they (1) head in the SAME GENERAL DIRECTION as the local growth (heading =
  parent→node, offset ±`sideStrandSpread` 0.8 — was a fully-random 0–2π direction that shot twigs backwards),
  (2) ARC via a steady per-twig bend `sideStrandCurve` (0.25 rad/step) instead of running straight, and (3) are
  FEWER (`sideStrandChance` 0.6→0.4; `sideStrandMin` 1→2 so the bend has room to show). Applies to every grow
  that sprouts side-strands (directed + undirected). Verified in `lance_render.mjs`.
  - **Owner approved (twigs-only, companions off) and asked to apply to all normal grow cards / engine
    actions — CONFIRMED already global** (the rework is in the shared `_sproutSideStrand`, so no per-card
    change was needed): all directed grows (Apical Drive, Rhizomorph Lance, Fruiting Vigil, Leading Cord,
    Explorer/Turgor/Vesicle/Bulk-Flow/Rhizomorph Cable, Tropic Lunge, Questing Front) and undirected grows
    (Hyphal Extension, Colonizing Front) carry the curved forward twigs. Verified on 3 non-Lance cards
    (`scratchpad/grow_render.mjs`). Intentionally NOT twigged: the FAN cards (Foraging Fan / Forager Bloom —
    they have their own organic bifurcating fan) and the PUNCH/bore cards (Appressorial Punch, Sinker
    Rhizomorph — they thread a single strand through rock). Companion runners remain OFF everywhere.

- **Foraging Fan + Forager Bloom → AIMED directional fan (was omni "every direction").** Owner: aim it like
  any other growth card and fan out 3 steps in the chosen direction ("looks like the current fan played 3× but
  one direction — pretty + thematic"). New effect text: Foraging Fan = "Grow 3 steps: choose a direction and
  fan out."; Forager Bloom = "Once per 6 rounds: pay 1 W to grow 3 steps, fanning out in a chosen direction."
  Impl: new engine method **`network.js growFanDirected(substrate,rng,dx,dy,steps,startTip)`**. Owner asked
  for progressively denser fans ("fuller" → "triple it" → "much, much denser, triple it") toward a dense
  coral/sea-fan. Final algorithm = a **BREADTH-FIRST bifurcating front** (grows like coral/dendrites, gives a
  UNIFORM dense fill — the earlier RECURSIVE-fork version gave sparse main branches with clumps only where it
  colonised piles, because siblings collided unevenly). A front of tips (seeded by `fanRays`/`fanSpread` around
  the aim) advances ONE segment per round toward the aim; each round a tip may **bifurcate** (`fanForkChance`
  0.41, first half) into two branches spreading ±`fanForkAngle` (0.4); every heading is clamped to within
  ±`fanMaxDev` (1.2 rad) of the aim so it stays a forward wedge. Runs `fanSteps × fanReach` (~10) rounds; tips
  landing on rock or within **`fanSpacing` (3 px, tiny)** of existing tissue are pruned, self-limiting density;
  **`fanForkTaper` (0.21)** multiplies the fork rate PAST THE MIDPOINT (outer-half rate = fanForkChance × this)
  — the base forks at full rate (dense), the outer half thins but doesn't go bare (owner iterated: dense →
  "half after the middle" ×2 → then rebalanced −25% before / +25% after; an earlier ramp-to-zero taper made it
  "way too thin"). **`fanBudget` (700)** is the hard ceiling (a full fan is a few-hundred segments — dense,
  matching the look the owner approved). NB `fanBudget` sizes the FAN only; a play's total node bump can be
  larger when the dense fan sweeps over food piles (`colonizeReachablePiles` colonises each). `fanSpacing`
  well below `minTipSpacing` lets the base branches pack (bigger = airier). **IMPORTANT wiring gotcha (fixed):** the fan knobs live in
  **`config.CARDS`** (next to `fanSteps`) but `growFanDirected` originally read them from `config.growth`
  (`g.fan*`) → all `undefined` → it silently ran on the hardcoded fallbacks (budget 700 etc.), so several
  rounds of owner "half it" tuning did NOTHING in-game. Now `growFanDirected` reads them via `cf =
  this.config.cards`. If you re-tune, edit them under `cards:` and they take effect. Verify pure fan geometry
  (no game/pile confound) with `scratchpad/fan_render.mjs`; fan-only counts with `scratchpad/fan_count.mjs`.
  Knobs (all `config.cards`): `fanSteps/fanReach/fanRays/fanSpread/fanForkChance/fanForkTaper/fanForkAngle/
  fanMaxDev/fanSpacing/fanBudget`; old `foragingFanCells` kept as a legacy note. `cards.js`: Foraging Fan is now `directional((s)=>fanSteps, …)`
  (press-and-drag, `target:true`, `aim:'drag'`); Forager Bloom's installed action gained
  `target/aim:'drag'/reachFn` and calls growFanDirected. `growRadial`/`fanBlockReason` are now unused (left in
  place). Verified in a real run (Playwright): playing it grows a rich branching fan in the aimed direction that
  colonises reached piles (triggers the draft). Tests green; import-leak 0. Tune the look via the config knobs.

- **BUG (ON HOLD — awaiting repro specifics): food piles sometimes INVISIBLE until you grow into them.**
  Owner report: "sometimes food piles are not visible on the map until I grow into them, then they magically
  appear" — and crucially **not just hard to spot: not visible AT ALL** until they "appear out of nowhere when
  I grew into them," and (unsure) "so far only relatively close to the finish line." **Root cause NOT yet
  found.** Owner will provide specifics next time it happens (screenshot / what the pile was next to / which
  card revealed it). What's been done so far:
  - **REJECTED fix — do NOT re-add:** a food self-glow (config `render.foodLightRadius`/`foodLightAlpha` +
    repopulating `substrateRenderer.foodLightPoints` in `_bakeDynamic`, drawn in `lighting.js compose`).
    Committed (`ede2808`) then **REVERTED** (`b11f922`). Owner: "this was not the issue and the fix makes the
    food piles look very off." The piles were genuinely invisible, not dim — a glow doesn't address that.
  - **Ruled out (with evidence):** (1) food generated under rock — `substrate.js drop()` refuses `cell.rock`
    and keeps a `foodRockBuffer` (2.2) clearance; reservoirs (placed last) treat `maxNutrient>0` as unmovable,
    so they never overwrite food. (2) Rock-SPRITE occlusion as the *goal-specific* cause — 40-map headless
    analysis (`scratchpad/food_occlusion.mjs`): occlusion is ~uniform across the map, if anything **lower**
    near the goal (boulders stop at `goalStart-2`; formations/columns exclude the summer+goal zone). (3) Goal
    hill / goal props — drawn ABOVE the soil line, don't cover underground. (4) Camera auto-follow — the camera
    never pans on growth (`camFocus`/`focusWorld` fire only on win/death/level-intro), so piles don't scroll
    in. (5) Lighting — reverted, and `sensingLightOn` is false so compose adds no local grow-reveal anyway.
  - **Confirmed:** food piles **do render normally** in general (verified via real-run screenshots). A full
    pile (`nutrient>0`, not rock, on-screen) is ALWAYS drawn by `drawSubstrateLeaves` — the only draw-gate that
    can flip hidden→shown is `cell.rock` going false (dig/`punchThrough`), but generation never puts food on
    rock. So the mechanism is still open.
  - **One unconfirmed oddity:** engine/feature caches can spill a column or two INTO the goal zone (saw an
    engine-cache centroid at col 67 with `goalStart=66`) — a plausible "near the finish line" lead.
  - **Next-step idea (not yet built):** a `#dbgfood` debug overlay that outlines EVERY food-pile cell in the
    same frame (same camera, no cull, no occlusion, drawn over everything) to distinguish occluded vs culled vs
    truly-absent. Harnesses live in `scratchpad/`: `real_run.mjs` (boots a real run + dumps pile positions),
    `food_occlusion.mjs` (headless occlusion stats).

- **Browser tab: title → "Mycelium", favicon → a black organic mycelium mark (dark-mode auto-inverting).**
  Title dropped the "— Phase 1" suffix. Favicon is **`assets/favicon.svg`** — an *organic radial colony*
  (8 irregular forked filaments + a centre node) hand-built as a recursive-branch SVG, **transparent**
  background, round caps. **Colour = `currentColor`** driven by an in-SVG style block
  `svg{color:#000}@media(prefers-color-scheme:dark){svg{color:#fff}}` → **black on light tabs, white on dark
  tabs** (Chrome/Firefox honour media queries in SVG favicons; Safari falls back to black). Two rejected
  attempts first: (1) a circular crop of the Forager Bloom card art — too detailed to read tiny + the photo's
  black/feathered disc showed instead of transparency; (2) a teal `#1ec08f` symmetric 6-branch vector —
  owner wanted black. Owner picked "organic colony (8 arms)" from a 5-option A–E preview grid
  (`scratchpad/fav_black.mjs` regenerates it; A radial-6 / B organic-8 *chosen* / C hypha-tree / D dense-disc /
  E upward-fan, each shown 16–64px on white/grey/dark). Title + favicon are set in **`build.mjs`** (its own
  `<head>` template — NOT inherited from `index.html`): title literal + the SVG inlined as a base64 **data
  URI** so `dist/index.html` is self-contained; `index.html` (source) references `assets/favicon.svg`.
  Verified 16–64px on light AND dark tabs (`scratchpad/fav_verify.mjs`, `colorScheme` light/dark) — invert
  confirmed. Rebuilt; media query survives the base64 inline.

- **Settings-menu + softlock fixes (owner batch).**
  - **"Force Fruiting (abandon run)"** added to the gear settings menu (`ui.js` `#set-forcefruit`,
    warm-tinted `.setitem-danger`). Wired to `main.js` handler `onForceFruit` → new `forceFruitAbandon()`
    which ends the run via the normal campaign-death path (`presentRunOver`: forced-fruit celebration +
    run-over card with half-Spores, and the loadout picker for a memory species). `__game.killColony` now
    routes through the same function.
  - **Sensing-range lighting toggle REMOVED from the menu** (owner: leave it off, no button). Menu is now
    Event log · Music · Replay tutorial · Force Fruiting. `sensingLightOn` is hard-**false** in `main.js`
    (was `loadSettings().lighting !== false`); the `isLightingOn`/`setLightingOn` handlers are gone. Render
    already handles the off state (redraw colony bright, no earth aura).
  - **Hyphal Extension no longer reads as playable with no food in range** (it grows *toward food in
    sensing range*, so with none it no-ops — and being "playable" kept a card-dry, Energy-dry player from
    ever registering a stall → **soft-lock**). New `Network.canGrowToFood(substrate)` (mirrors `_growStep`'s
    attractor test: a food cell above `attractorThreshold` within `sensingRadius` of a live, uninfected,
    non-side strand). `cardBlockedReason` now returns "No food within sensing range." for cards in the new
    `FOOD_SEEK_CARDS` set (**Hyphal Extension** only — Foraging Fan fans into open ground, the directional
    grows aim into open ground, so they're NOT gated). The UI hand now greys via `cardBlockedReason` (single
    source of truth; `isPlayable(g)` = `!cardBlockedReason`), and the stall-death check (already on
    `cardBlockedReason`) now fires correctly instead of soft-locking. Verified headless: Hyphal Extension
    blocks with no food in range, Apical Drive / Foraging Fan stay playable. 101+61 tests green; `dist`
    rebuilt (import-leak 0).

- **New species: Split Gill (Schizophyllum commune) — a "memory" species that curates its starting hand
  at the START of each run.** First of a planned family (the mechanic is reusable via a `memory:true` flag).
  - **Kit:** 10⚡ / 25W / **6P**, fixed opener **1× Aquaporin Channels + 5× Apical Drive**, PLUS up to **8
    cards the player hand-picks WHEN STARTING a run** from the NON-ENGINE (basic+event) cards they **drafted
    on their last run** with it. First run is bare (6 cards) by design; builds out over runs.
  - **Data/flow (two-store, run-START selection):** `species.js` — roster entry `id:'schizophyllum'`,
    `memory:true`, **gated `unlock:'Complete level 5'`** (first/only species in that tier → revealed on the
    first level-5 clear, then bought with Spores). Progress store (`mycelium.progress.v2`): **`lastDrafts:
    {id:[{name,count}]}`** = the pool a run leaves behind (its non-engine drafts), recorded at RUN END by
    `main.js runEndThen` (no UI now); **`loadouts:{id:[…]}`** = the pick that SEEDS the run. On picking the
    species (`main.js startRunWithLoadout`), if `lastDraftsFor(id)` is non-empty the loadout picker shows
    (pool = last run's drafts) → `saveLoadout(id, picked)` → `startRun` → `effectiveSpecies` merges the pick
    into the seeded hand. (Earlier iteration ran the picker at run END; moved to run START per owner — makes
    more sense.) TEMP `devUnlockAll()` reveals+buys every gated species (picker "Dev: unlock all" button).
    `engine/cards.js` —
    `chooseOffer` tallies non-engine drafts (by **copies**) into `state.cards.runDrafted` (carried across
    levels with the cards object; reset each run in `initCards`, which now inits `runDrafted:{}`).
    `main.js` — `effectiveSpecies(sp)` merges the saved loadout into the seeded hand for memory species;
    `runEndThen(next)` just **remembers** this run's drafts to `lastDrafts` at every run-end EXIT (death
    "New run"/"Main menu", game-won "New run") — no UI. The picker is shown at run START by
    `startRunWithLoadout`.
  - **UI:** new `src/render/loadout_select.js` (`showLoadoutSelect`, namespaced `#loadoutSelect`/`.lo-*`,
    CSS in `index.html`). No top title/subtitle (removed per owner). Two carousels that **REUSE the in-game
    hand carousel** — same `.cardbtn` faces (`cardFaceHTML`/`catClass`, now exported from `ui.js`) and same
    `.fchip` filter bar per row (`cardGroups`/`GROUP_ORDER`): UPPER = "Your starting hand" (fixed opener
    **locked** + selected), LOWER = "Drafted last run" pool with copy counts. Single-click a lower card →
    move ONE copy up; click a selected upper card → move it back; cap **8** copies (`MAX_PICK`; lower greys
    via `.unaff` at the cap); centered
    **"Choose 8 cards for this run"** + an X/8 counter; both lists support **mouse drag-to-scroll**
    (`enableDragScroll`, inertial glide, a >6px drag cancels the click so it doesn't add a card) plus native
    touch/trackpad scroll, so a large drafted pool is fully browsable. Plain **black-&-white Confirm** button (no
    gradient/icon). The species-detail inspector (`species_select.js`) shows a 3rd **"Choose Eight"**
    placeholder card (a dashed "?" face: "Any combination of 8 basic and event cards **drafted during your
    last run**.") for memory species.
  - **Art:** `assets/species/schizophyllum-commune.jpg` (FLUX 1.1 Pro, `scripts/gen_species_splitgill.py`,
    3 options in `assets/species_options/`, option 3 picked — clearest split gills). Registered in
    `build.mjs` module list.
  - **Verified:** headless — persistence round-trips, merged seed = 6 fixed + loadout at 10⚡/25W,
    draft-tally records the basic (3 copies) and excludes engines; a Playwright DOM test of the loadout
    screen (mount, click-to-move, 5-cap, confirm returns the picked copies) and a real-picker Playwright
    (Split Gill is the 3rd starter, inspector shows the fixed opener, portrait loads, no errors). 101+61
    tests green; `dist` rebuilt (import-leak 0).

- **Documented the draft-pool odds (no code change).** Recorded in `cards-design.md` §18.3 the current,
  authoritative draft mechanics after an owner question. Key load-bearing fact: the Basic-vs-Event split
  is a **FIXED weight** (`config.cards.draftBasicWeight` = 0.6 → 60% Basic / 40% Event per slot,
  `engine/cards.js weightedNormalChoices`) — it does **NOT** scale with pool size, so adding the grow-card
  basics did **not** change the ratio (only diluted each specific basic). Normal offer of 3 ~ Binomial(3,
  0.6); live playable pools = 10 basics / 15 events / 35 unique engines. To shift the ratio, change
  `draftBasicWeight`.

- **Reservoirs no longer get boulders/formations rendered on top of them.** The reservoir carve
  (`substrate.js` 2c-iv) cleared rock cells in a halo of `reservoirClearCells` (**2**) around the pocket,
  but that halo assumed rock sprites spill only ~1.5 cells — whereas a large boulder renders up to **3.3
  cells** tall (`drawBoulder`: `bh = cs·(1.35 + h1²·2)`) → ~2-cell reach from its cell centre, and
  formation sprites overhang their footprint too. So a rock cell just OUTSIDE the halo still spilled its
  sprite onto the pool (owner screenshots). Fix: **decouple** the two concerns — keep `reservoirClearCells`
  (2) as the lake/column/food-free halo needed for PLACEMENT (so pockets still fit), and add
  `reservoirRockClearCells` (**4**) as the radius in which BOULDERS + FORMATIONS are carved to soil (must
  exceed max sprite spill). The carve loop now runs to `R = rad + max(BUF, ROCKCLR)`; water teardrop is
  unchanged (still within `rad`). Columns are structural (`sub.rockColumns`, never carved) but are already
  avoided by the placement halo. Verified headless over 200 seeds / 405 reservoirs: **0** rock sprites of
  any type can reach a pool — worst-case clearance margins boulder **1.67**, formation **2.47**, column
  **0.69** cells; reservoirs still place (~2/map). 101+61 tests green; `dist` rebuilt (import-leak 0). New
  config: `substrate.reservoirRockClearCells` (4) — lower it for tighter soil banks, raise if any rock
  still grazes a pool.

- **Lake bottoms smoothed: clip the lake art to an ELLIPSE bowl, not the per-column water depths.**
  The earlier "clip to the actual water cells" fix (`main.js drawLakes`) built the bottom of the clip
  path as a polyline through each column's integer water depth — so the bottom came out as an ugly
  **notched / staircase** edge (owner: "the bottoms don't look nice"). Since the sim carves the lake as a
  **semi-ellipse** (`substrate.js`: `d = maxDepth·√(1−t²)`), `drawLakes` now clips to that analytic bowl
  with a single `ctx.ellipse(cx, waterline, sw/2, ry, 0, 0, π)` — a clean rounded bottom that still lines
  up with the sim's water. A small vertical **overshoot** (`ry = sh + 0.35·cs·z`, art drawn to the same
  height) guarantees every water cell stays covered and lets the feathered art edge blend softly into the
  soil below (no hard cut, no phantom-water complaint). Verified geometrically vs a real lake's water
  cells (seed 1, cols 43–55, maxD 5): the ellipse envelopes the bowl cells where the old staircase
  notched between them. 101+61 tests green; `dist` rebuilt (import-leak 0). Reservoirs are unchanged
  (they use the teardrop `RESERVOIR_OPAQUE` box, a separate path).

- **Level 2 = the Trichoderma gauntlet: BOTH clouds seed UNDER the green goal hill.** A deliberate
  teaching gate (owner request) — one cloud just under the hill's bottom-LEFT corner + one CENTRED under
  the hill sitting slightly deeper, so it's very hard to fruit without an answer to mould. Clouds are
  seeded via a scripted-**anchor** system in `engine/threats.js seedTrichoderma` (`pickSpotNearAnchor` — a
  **deterministic expanding Chebyshev-ring** search for the nearest OPEN, non-rock, non-food cell; keeps
  `config.trichoderma.guardAnchorRockGap`=**1** cell clear of rock, auto-relaxed if none). Consumes **no
  RNG**, so the roam clouds and every other level's seed are byte-identical to before. Anchors support two
  frames: world-relative `{xFrac,depthFrac}` OR **goal-hill-relative** `{goalRelX (0=hill left edge,
  1=right), depthCells (rows below surface)}` — the goal hill is the `.goal` surface span (drawn by
  `drawGoalBackdrop` from the first goal column to the map's right edge; `goalColSpan()` finds it). NOTE:
  the earlier world-fraction attempt (`xFrac 0.15/0.56`) put the clouds mid-map — WRONG, because the
  owner's reference screenshot was zoomed into the goal region; goal-hill-relative is the correct frame.
  `main.js configForLevel` sets for level 2: `guardAnchors = [{goalRelX:0.0,depthCells:3},
  {goalRelX:0.5,depthCells:6}]` (`null` otherwise; cleared under `#notrich`). Total cloud count unchanged
  (level 2 is `trych:2` → 2 gates, 0 roamers), so the intro "×N" still reads right. Verified headless
  across seeds: goal hill spans cols 59–71 (13 wide) and the clouds land at **col 59/row 3** (hill-left,
  shallow) and **col 65/row 6** (hill-centre, deeper) — 6 cols apart, well separated. 101+61 tests green;
  `dist` rebuilt (import-leak 0). New config: `trichoderma.guardAnchors` (null) + `guardAnchorRockGap`
  (1). `goalRelX`/`depthCells` are one-line-tunable to nudge either gate.

- **Card cost pills more legible on bright art.** The top-left resource-cost chips (`.cc` in
  `index.html`) had only a faint translucent *colour* tint, so on bright card faces (Acorn Cache,
  Sclerotial Crust, …) the cost read poorly. Added a dark base via `background-color: rgba(6,11,9,0.5)`
  on `.cc` and moved each per-resource tint to `background-image` so the two layers compose — the dark
  backing now carries the contrast, the colour tint still codes the resource. Dark-art cards are visually
  unchanged. Rebuilt `dist/`.

- **Grow-card family expansion + tempo rebalance (owner batch).** Rhizomorph Lance was auto-best, so
  added a paid **directional aimed-grow family** to compete with it and buffed the free grows to keep pace.
  - **Buffs:** Apical Drive **2→3** steps, Hyphal Extension **1→2** steps; their installed twins match —
    **Leading Cord** 2→3 (shares `config.cards.directionalSteps`, now **9**) and **Colonizing Front** 1→2
    (`config.cards.foodSeekSteps` **2** — the food-seek effects now run 2 `grow()` passes). **Rhizomorph
    Lance** now costs **2⚡ + 2W** (`buyCostEnergy` 1→2).
  - **4 new BASIC directional grows** (press-and-drag aim; `aimedGrow` helper in `cards.js`): **Guerrilla
    Runners** (5 steps · 1⚡1W1P), **Turgor Thrust** (4 · 2⚡1W), **Vesicle Surge** (4 · 3⚡1P),
    **Translocation Cord** (5 · 2⚡2P) — the E/W/P mix flexes with the resources you have. Themes are real
    mycology: guerrilla foraging growth form, turgor-pressure tip growth, the Spitzenkörper vesicle-supply
    centre, bulk-flow cord translocation.
  - **5 new grow ENGINES** (installed actions — "every 6 rounds: pay ⟨res⟩, drag-aim, grow N steps";
    `aimedGrowAction` helper): **Explorer Cord** (5 · install 17⚡3P · 1W/use), **Turgor Line** (4 · 13⚡3P ·
    1W), **Vesicle Supply Line** (4 · 10⚡3P · 1P), **Bulk-Flow Cord** (5 · 14⚡4P · 1P), **Rhizomorph Cable**
    (6 · 20⚡4P · 2W — the installed twin of Rhizomorph Lance). W-route install ladder is a clean **+4⚡/step**
    (Leading Cord 9 → 13 → 17 → 20); each same-reach W/P pair is non-dominated (cheap-Water-per-use vs
    scarce-Phosphorus-per-use). New segment knobs `config.cards.grow4Segments` **12** / `grow5Segments` **15**
    (1 step = 3 segments); grow-6 reuses `reachSegments` 18. Energy cost note: for basics/events the ⚡ price
    is `buyCostEnergy` (`playCostEnergy` is dropped by `gen-carddata` and unused); for the engines the ⚡+P
    install is `buyCostEnergy`+`buyCostPhosphorus` and the per-use ⟨res⟩ lives in the `EFFECTS` action spec.
  - **Data/flow:** `docs/cards.json` (source) → `node scripts/gen-carddata.mjs` → `node build.mjs`. Basics
    draft from the infinite basic pool (3 copies); engines are unique from the RED engine caches. **Art:**
    FLUX 1.1 Pro (`scripts/gen_grow_cards.py`), 3 options/card in `assets/card_options/`, winners promoted to
    `assets/cards/<slug>.jpg` (owner review = a published artifact gallery). Kept to the **"mycelium, not
    mushrooms"** brief — strands end in fine, pointed / thread-like hyphal tips, never a cap (a few FLUX
    options that drifted into mushrooms were rejected; Turgor Thrust was regenerated).
  - **Final art picks (owner review, this batch).** After three redo rounds the applied
    `assets/cards/<slug>.jpg` are: **Guerrilla Runners** ← `translocation-cord-1`, **Turgor Thrust** ←
    `turgor-thrust-x4` (long-reach white), **Vesicle Surge** ← `vesicle-surge-1`, **Translocation Cord** ←
    `translocation-cord-w4` (white), **Explorer Cord** ← `translocation-cord-w2` (white), **Turgor Line** ←
    `turgor-line-x2` (single line into the distance), **Vesicle Supply Line** ← `turgor-line-x3` (a spare
    single-line option re-homed), **Bulk-Flow Cord** ← `bulk-flow-cord-1`, **Rhizomorph Cable** ←
    `rhizomorph-cable-1`. Some faces borrow a `translocation-cord`/`turgor-line` option because those
    generations read best as "reaching cord / long line" — the source option is preserved in
    `assets/card_options/`, only the winner is copied to `assets/cards/`.
  - **Owner-facing art-review tooling (reusable for any future card-art batch).**
    `scripts/gen_newcards_review.mjs` emits a self-contained **Artifact-body** picker: each named card's real
    in-game face beside its FLUX option thumbnails, with **editable** description/costs, a free-text comment
    box, and an **Export** button that dumps the owner's picks+edits as markdown to paste back. Env:
    `NC_CARDS` (comma-separated card names), `NC_SUFFIX` (`''`→`<slug>-N.jpg`, `w`→`-wN`, `x`→`-xN`;
    `NC_WHITE=1` aliases `w`). `scripts/gen_newcards_gallery.mjs` is the read-only counterpart — the nine
    final faces with a caption of which option won, plus an optional **"spare art to place"** callout
    (`SPARE_FILE`/`SPARE_LABEL`) used to re-home an unused option onto another card. FLUX redo scripts from
    this batch: `gen_grow_redo_white.py` (white-hyphae redo), `gen_turgor_thrust_far.py` (long-reach),
    `gen_turgor_line_white.py` + `gen_turgor_line_far.py` (single-line-into-the-distance) — all share the
    "white mycelium, naturalistic macro, NOT painterly, hyphae not mushrooms" brief and write `-w<n>`/`-x<n>`
    suffixed options.
  - **Verified:** 101 + 61 tests green; a headless effect harness and a real-`dist`-bundle Playwright pass
    confirm each card grows/installs and charges the exact ⚡/W/P and every new face renders. An adversarial
    review **Workflow** (correctness / balance / data / integration → verify) caught + fixed the
    Explorer-Cord install-ladder inversion that had squeezed Turgor Line.

- **Level-intro screen: a black "Level N" + threat-roster card shown before every level's map fades in.**
  New `src/render/level_intro.js` (`showLevelIntro({level, threats, onDone})`) renders a full-screen
  BLACK overlay — big serif **"Level N"**, then the three threats waiting on this map (ant / nematode /
  trichoderma), each a **square portrait with a white glow border** (matching the tutorial figures) and
  an **×count**, plus a faint "click anywhere to begin" hint. **No container / no buttons** — content
  sits straight on black, per the request. A click ANYWHERE fades the overlay's own opacity out (1.4s);
  because the finished map is already drawn behind it at full opacity, **that fade IS the map fading in**.
  Threat art is REUSED from the first-run tutorial (`assets/tutorial/{ant,nematode,trichoderma}.jpg`); the
  ant/nematode squares use `object-position` crops (`.li-pic--ant/-nematode`) that keep the **head as the
  focus without cropping to only the head** (ant head+mandibles centred; nematode mouth centred; both still
  show body). Counts come from the LIVE state (`state.ants/nematodes/clouds.length` == the per-level
  `LEVEL_THREATS` seed, before any tick), filtered to >0 (so a trich-free `#notrich` sandbox just omits it).
  - **Wiring (`main.js`):** `begin()` arms `pendingLevelIntro = {level, threats, onContinue}` for every
    non-puzzle level; `revealMap()` (fired after the first fully-drawn frame) shows the intro instead of the
    plain canvas fade — it snaps the canvas opaque behind the black overlay and lets the overlay fade itself
    out. Puzzle mode keeps the old direct fade. A superseding `begin()` drops any unshown/lingering intro.
  - **Tutorial now DEFERRED behind the intro:** the first-run tutorial (level 1 only) used to start
    synchronously in `begin()`; it now rides `pendingLevelIntro.onContinue`, so its camera zooms / popups
    begin **only after** the black screen clears — never under it. `markTutorialSeen()` still fires up-front
    so it can't re-trigger. Verified in the real game (HTTP Playwright, external hosts stubbed to keep
    headless Chromium off the music/SSL storm): intro mounts on level start with the right counts, click
    fades the real map in and the game is immediately playable, and `tutorialPresentUnderIntro=false` →
    tutorial appears 1s after dismiss. `.li-out` also drops `pointer-events` the instant it's dismissed so a
    fading (not-yet-removed) overlay can never swallow a map tap. All CSS in `index.html` (`#levelIntro` /
    `.li-*`, z 1300 — above the tutorial's 1200); module registered in `build.mjs`; 101 tests green.

- **Lake art now CLIPPED to its water cells (strands stop at the visible pool, not inside it).**
  Same class of art/cell mismatch as reservoirs, but for lakes: the sim's lake water is a
  semi-ellipse **bowl** (`substrate.js`: deep centre, shallow edges), while each lake ART image
  has its own baked bowl that can be fuller/narrower — so a strand hugging the water cells (which
  it does correctly; collision is solid, verified 0 nodes-in-water) appeared to poke into empty
  teal (fuller arts) or stop short (narrower arts). Fix is render-only: `main.js drawLakes` now
  **clips the art to the actual water-cell bowl** (flat top at the waterline; bottom follows each
  column's water depth) before drawing, so the visible pool == the water cells for ALL three lake
  arts. Verified with an HTTP Playwright capture (teal fills the water-cell outlines exactly; the
  water-seek strands hug the bowl's lower edge). No engine/test change; reservoirs use their own
  teardrop+opaque-box fix (below).

- **Reservoir water CELLS now match the drawn pool (fixes phantom Aquifer Tap + short helper).**
  Root cause of "income far from the water / helper won't reach it": the reservoir's `cell.water`
  was a full CIRCULAR disc, but the teardrop art only fills ~50–72% of its 640² image (measured
  from the PNG alpha) — so stretched over the disc's square bbox the visible pool sat ~1 cell
  INSIDE the water cells on every side. Strands stopped against (and income fired on) invisible
  water in the corners. Two matching fixes: (1) `substrate.js` carves the reservoir water as the
  **teardrop shape** (`reservoirHalfWidth`/`RESERVOIR_PROFILE`, not a circle); (2) `main.js
  drawReservoirs` scales each art so its **opaque box** (`RESERVOIR_OPAQUE`, per-art, measured from
  the alpha) maps onto the water footprint + a 0.4-cell overhang — so the visible pool COVERS
  exactly the water cells. Now income pays only when a strand is inside the visible pool, and the
  water-seek helper reaches into it. Verified with an HTTP-served Playwright capture (water-cell
  outlines sit inside the drawn pool) at rad 2 and 3. No RNG/repro impact (reservoir carve is last).

- **Fruiting celebration = a gentle calm breeze; both outcomes persist; new low-water text.**
  Reworked the win/death spore drift (`main.js emitSpores`/`drawWinCelebration`): **~25% fewer
  spores** (`CELE_MAX_SPORES` 2600→1950, per-puff `3+rand4`→`2+rand4`) and **~half the drift
  speed** so the wind reads clearly, plus a slower/wider sway and a gentler travelling wave for a
  lazy breeze. A **DEATH** no longer puffs omni-directionally — the wind now carries spores **LEFT
  AND RIGHT** (`vx = ±speed`, 50/50; the `omni` flag now means "both ways"; edge-fade at whichever
  horizontal edge). A **WIN** streams them **RIGHT** and — new — **also persists** (`persist:true`
  for both), so the spores keep sailing after the win card appears (cleared only when the next
  run/level calls `begin()`/`backToPicker`). Low-water warning popup text updated to: *"Water is
  running low. Your colony will be forced to fruit if you run out, ending your run. Grow into a
  water source or play water income cards to get more water."*

- **Campaign win/death UX + rules batch (implemented earlier; verified & finalized this session).**
  A set of 8 requests that landed together — recorded here so they're findable:
  - **Win/lose hill framed in the TOP THIRD on desktop** (`main.js` celebration `focusWorld(…,
    anchorY)` = 0.32 desktop / 0.6 phone) so the fruiting hill never sits under the card carousel.
  - **Low-resource warning is a click-to-dismiss POPUP** (`ui.js warningPopup`), clean B&W, red
    "Warning" heading (CSS `.warnpop*` in index.html); fired from `main.js checkWater` at ≤5 water.
  - **Death overlay: no fade to black** — the death hill + spores persist under the run-over card
    (`persist`, above); overlay has a **Main menu** button (`onMainMenu`) and **no icon on "New
    run"** (`ui.js showOverlay`, `campaignDeath` branch).
  - **Constricting Ring costs 4 P to install** (`buyCostPhosphorus:4` in cards.json) on top of its
    3 P per-activation cost.
  - **Harvest + draft finish BEFORE the victory sequence** (`cards.js checkGoalReached` →
    `finishOccupiedHarvest` + `checkPileRewards`; a pending draft sets `state.winPending` and
    `main.js maybeFinalizePendingWin` waits for it before `presentRunOver`).
  - **Infected strands can't win** (`checkGoalReached` runs `infectStrandsInMould` FIRST, then the
    goal loop skips `n.infected` nodes) — growing through goal-line Trichoderma infects and voids
    the fruiting body.
  - **Aquifer Tap doesn't carry between levels** (`main.js applyCarry` filters `_waterSource`
    engines) — you re-earn the trickle by growing into a new water body each level.
  - Bug caught this session: the breeze rework left `emitSpores`' param named `omni` while the body
    used `bothWays` → `ReferenceError` every puff, freezing the celebration mid-render; renamed the
    param. (See the crash repro note in the water-seek work.)

- **Water-seek helper: more generous — up to a few strands per pool, keyed off SENSING range.**
  Follow-up to the hug-the-water fix below: the helper now triggers whenever a tip is within the
  colony's **sensing radius** (`growth.sensingRadius`, 135) of a water body — replacing the old
  `waterSeekReach` — and a pool fills up to **`waterHelperMaxStrands`** (=3) helper strands as the
  colony nears from different tips (one new strand per grow, `_waterBodiesTouched`→
  `_waterBodyTouchCounts` gates on the per-body count), instead of just one. Enough free help to
  reliably tap the water without matting it; still edge-hugging (never overlaps), deterministic.
  Verified headless: with tips ringing a pool it grows ≥2 strands and caps at 3, none inside water.

- **Water-seek helper now VISIBLY hugs the water + income only pays on visible contact.**
  The Aquifer Tap trickle was turning on while the colony was still a clear gap from the pool
  (income contact 22px, but the helper's "already hugging" skip was ~40px from the water edge —
  so a strand could sit in the 22–40px band paying income with no visible touch). Reworked
  `network.js reachForWater`: (1) dedupe per water BODY — skip any body a live node already
  touches, so **at most one strand ever enters each pool** (no "many strands in the water");
  (2) new `_growToWaterEdge` grows the strand then **creeps the tip right up to the solid water
  face** (`_placeOk` fails inside water) so the colony visibly reaches it — measured ≤7px gap
  across seeds/bodies/approach angles, never overlapping. Tightened `waterContactDist` 22→**14**
  (income + the helper's dedupe use the same measure), so income pays **exactly when a strand you
  can see hugs the water**. Verified headless: income off at 40px → on after the helper hugs;
  2nd `reachForWater` call makes 0 nodes (one strand per body). `config.js` waterContactDist=14.

- **Experimental side-strand branching (EVERY grow type sprouts extra fuzz).** New: as a strand grows,
  **each step has a 60% chance to sprout a small side-strand from a RANDOM point along the strand so
  far, in a RANDOM direction** (owner-chosen params: per-step roll, 1–3 segments; a full-length
  offshoot may fork ONE extra length-1 twig — otherwise non-recursive).
  Applies to **all** grow primitives — `growDirected` (Apical Drive / Rhizomorph Lance / Fruiting
  Vigil), `growRadial` (Foraging Fan), `growToNearestFood` (Tropic Lunge) and the undirected
  `grow`/`_growStep` (Hyphal Extension). Config knobs in `config.js growth`: `sideStrandChance` (0.6),
  `sideStrandMin` (1), `sideStrandMax` (3) — set chance to 0 to disable. A side-strand that grows out
  to the **full max length** (3) then forks one extra **length-1 twig** off itself with probability
  `sideStrandForkChance` (0.5) — a single level of extra branching, drawn from `_branchRng` only
  (`_sproutSideStrand`'s `forceLen` arg builds that twig and blocks it from forking again).
  - **Key design decision — a SEPARATE deterministic RNG (`network.js` `this._branchRng`, seeded
    `0x9e3779b9`).** Branching draws ALL its randomness from this stream, never the main sim `rng`, so
    side-strands are **purely additive**: the main food-seeking / collision trajectory is byte-identical
    to the no-branching baseline. The first attempt drew from the shared `rng` and shifted the whole
    deterministic path — the undirected food-seek then reached col 3 instead of col 8 (fewer main nodes,
    and the ant-trail smoke test failed). The separate stream fixed it (OFF 56 nodes / crossed vs ON 69
    nodes / crossed — same main reach, more fuzz). See `_sproutSideStrand` / `_ancestryStrand`.
  - **Side-strand nodes carry `node.side = true`** and are **excluded from `_growStep`'s seek/crowd
    buckets** (`if (n.side) continue;`) so accumulated fuzz never seeks food nor blocks the structural
    frontier via `minTipSpacing`. They ARE real nodes (colonise / feed threats / render + animate via
    the normal reveal path) and still count as growable tips for aimed plays. Collision-aware: an
    offshoot that can't place (rock/edge/surface) simply doesn't grow. All 162 tests green.

- **Card rebalancing pass + new `buyCostPhosphorus` install gate + Acorn Cache = drag-aim.**
  - **New cost dimension `buyCostPhosphorus` (→ `buyP` in CARD_DATA).** Cards could gate install on
    Energy only; several rebalance requests were "should ALSO cost N P to buy". Added a Phosphorus
    buy-in charged at install for ANY card type (crucially, installed ACTIONS — whose play-W/P is a
    per-activation cost, not an install gate). Wired end-to-end: `gen-carddata.mjs` emits `buyP`;
    `cards.js cardBlockedReason` gates on it (`Not enough Phosphorus (need N)`) and `playCard`
    charges `net.phosphorus -= c.buyP` alongside `buyCostEnergy` for all types; `ui.js gateChips`
    draws it as a phosphorus pip on EVERY card face (right after the buy-⚡ pip, unlike play-W/P
    which stays off action faces); the card editor (`build_cardeditor.mjs`) gained a **Buy P** field
    + face pip (`COST_FIELDS` now includes `buyCostPhosphorus`). buyP set on: Leading Cord 3,
    Forager Bloom 1, Crust Reserve 3, Colonizing Front 1, Acorn Fall 1, Sclerotial Seal 1,
    Melanized Wall 2, Sclerotial Rind 2, Toxocyst Array 3.
  - **~30 cost/text edits** applied via `docs/cards.json` (regen → build). Energy/Phosphorus buy &
    play costs retuned across the set (e.g. Aquaporin Channels 10→25⚡ +7P play, Capillary Runners
    9→30⚡ +7P, Rhizomorph Dynamo 15→9⚡ +3W +19P, Cordyceps Bloom 14→7⚡). Constricting Ring now
    costs **3 P per activation** (`action({…cost:3,res:'phosphorus'})`, was free). Rhizomorph
    Trunkline gained 6 P play cost.
  - **Acorn Cache placement = drag-aim like grow cards** (was single-tap `targeted`). Now
    `directional((s)=>sensingRadius/segmentLength, …)` so you aim a direction and it drops the
    (still fixed-2⚡) nut cache at the sensing edge. Effect text uses the ⚡ glyph: "…drop a small
    (2⚡) nut cache…".
  - **Constricting Snap** text/msg dropped "throttled and" → "…digested for +3 P". **Toxocyst
    Burst** now caps Phosphorus income at **10** while still killing every nematode in radius
    (`gain = Math.min(n, 10)`); text "…digested (+1 P each, max 10 P)".
  - Tests updated for the new costs (Trunkline 6P play, Aquaporin 7P play, Osmotic Cashout 4→5P,
    Toxocyst Array 3P buy-in). `node --test test/*.test.js` green; headless-verified buyP gate +
    charge + Acorn Cache directional drop.
  - **FOLLOW-UP — water-engine tier normalised to fire every 6 rounds** (supersedes the
    Aquaporin/Capillary numbers above): all three water engines now share a `every: 6` cadence
    for a clean **+1/+2/+3 Water per 6 rounds** ladder at escalating cost — **Aquaporin Channels**
    +1/6 (20⚡ · 6P play), **Dew Traps** +2/6 (25⚡ · 12P play), **Capillary Runners** +3/6 (30⚡ ·
    16P play). Cadence lives in the `engine({water,every})` spec in `cards.js`; the Aquaporin
    engine-cadence test now checks 5 silent off-rounds → +1 on the 6th. cards-design §23 amended.
  - **Follow-up — water-engine tier all fires every 6 rounds** (supersedes the Aquaporin/Capillary
    numbers above): the three water engines now share a `+N Water every 6` cadence at a clean cost
    ladder — **Aquaporin Channels** +1/6 (20⚡ · 6P play), **Dew Traps** +2/6 (25⚡ · 12P play),
    **Capillary Runners** +3/6 (30⚡ · 16P play). Cadence lives in each `engine({water,every:6})`
    spec (cards.js); P is the engine's `playCostPhosphorus` play gate. Aquaporin's engine-cadence
    test now checks 5 silent off-rounds → +1 on the 6th. See cards-design §23.

- **Acorn Cache = fixed 2⚡ + sense-toggle keeps the colony bright.**
  - **Acorn Cache now digests to exactly 2⚡** (was the default per-nutrient rate ≈ lots).
    `substrate.deposit()` gained an optional `energyTotal` arg — it spreads a per-nutrient rate
    over the cells it wrote so the whole nut pile yields exactly that total; `depositAtSensingEdge`
    threads it; `EFFECTS['Acorn Cache']` passes `config.cards.acornCacheEnergy` (=2). Description
    (cards.json → regen) now reads "…drop a SMALL **2⚡** nut cache…". Verified: pile totals 2.000
    across seeds (4–5 cells). Other deposit callers pass no `energyTotal` → unchanged.
  - **Sense-range lighting OFF now shows the colony exactly like its LIT self, minus the halo.**
    The toggle gates BOTH the sensing aura AND the colony's own mint glow (`render/lighting.js`), so
    with it off nothing lights the earth. Instead of a white strand overlay (which recoloured only
    the structure strands → white trunks but the fuzz/fan TIPS stayed dimmed cream, a mismatch),
    `main.js` now RE-DRAWS the whole colony at full brightness after the lighting multiply via new
    `NetworkRenderer.redrawBright(ctx,camera,time,1.15)` — it reuses `draw()`'s structure pass
    verbatim (strands + fuzz + fan, in the colony's normal colours; batched LOD when zoomed out),
    minus the reveal scheduling + dynamic layer (draw() already ran those). So the colony reads in
    one consistent colour (tips and trunks alike), at its natural lit brightness, with the earth
    around it left dark — no glow bleed. (Supersedes the white-overlay approach.) `redrawBright`
    also lays a mint SHEEN on top — an additive (`lighter`) mint (`config.render.networkLight`)
    stroke along the strands, α 0.31, ~0.8px feather each side — so the colony gets the lit glow's
    soft mint sheen while the light stays hugging the strands (no earth halo). The sheen is stroked
    PER-NODE reveal-aware (`revealFactor`, same math as the base structure) so it animates in sync
    with a growing strand — NOT off the static batched skeleton (which would pop in early); only the
    zoomed-out batched LOD uses the static path, matching that LOD's own non-animated strands.

- **Left "home" hill + death fruiting + reworded death card + half-Spores on death.**
  - **Home hill (LEFT):** `drawHomeBackdrop()` + `drawHomeProps()` (main.js) draw half a green
    mound hugging the left frame over the colony start — the goal-hill art flipped, its peak
    off-frame left (clipped by `withWorldClip`), right slope descending into the map — with one
    small tree. Width from `homeHillCols()` (= `sub.startCols + 4`, min 6; `startCols` now stored
    on the substrate). Drawn right after `drawMoon`/before the goal backdrop, and its tree after
    `drawSurfaceProps`. **Cities/mountains never overlap it:** `sub.homeCols` (= the render's
    `homeHillCols`) is the shared keep-clear width; `cityRuns()` starts its skyline scan at
    `homeCols`, and `drawMountains` clips the background range and skips/shrinks foreground peaks
    (like the lake clamp) so nothing renders left of the hill's right edge `homeR`. All render-side —
    the substrate RNG stream (seed reproducibility) is untouched.
  - **Death fruiting celebration:** `startWinCelebration` refactored into `startCelebration(side,…)`
    with `startWinCelebration`='goal' (right meadow) and `startDeathCelebration`='home' (left hill).
    The home variant places mushrooms on a LEFT-peaking slope profile and frames the left hill; a
    campaign DEATH now runs it before the run-over card ("forced to fruit and spore").
  - **Death card copy:** campaign death (any cause) now reads **"Your run has ended"** / *"You ran
    out of playable cards or resources to continue expanding your colony and were forced to fruit
    and spore."* (`render/ui.js`).
  - **Half-Spores on death:** `presentRunOver`'s finish pays `floor(sporesForLevel(currentLevel)/2)`
    into the wallet + run total on a campaign death, then ends the run. Verified: level-1 death →
    wallet 0→50, card shows "50 Spores earned this run", correct title/body, no errors.

- **Ant harvest 2× + one red engine cache + tutorial red-leaf step + card editor tool.**
  - **Ants eat piles ~twice as fast:** `config.js ants.harvestRate` 20 → 40 (nutrient a nest
    carries off its target cell per action). Halves the time to strip a pile.
  - **Exactly one RED engine cache per map:** `config.js engineClusterMax` 3 → 1 (min already 1),
    so `substrate.js` places a single engine cache. (Engine caches = the rare red maple/autumn
    leaf piles that draft an ENGINE card; normal orange piles draft basics/events.)
  - **Tutorial "orange vs red leaves" step** (`render/tutorial.js`, new step right after the
    "grow into substrate" one): frames the map's red engine cache and reads *"Orange leaves let
    you draft basic action cards and event cards. Red leaves give you engine cards — very rare."*
    New `enginePile()` dep in `main.js` (centroid of the `foodPiles` pile with `kind==='engine'`);
    the step `skip`s cleanly if a map somehow has no engine cache.
  - **Card cost/description editor** (`scripts/build_cardeditor.mjs` → `docs/card-editor.html`,
    also copied into `dist/` by `build.mjs` → live at `<site>/card-editor.html`).
    A self-contained, directly-openable tool (full standalone HTML, unlike the Artifact-fragment
    review tools) that inlines the live `docs/cards.json` **and shows each card's REAL in-game face**
    (art + cost pips + name + rules, using the game's own `.cardbtn` markup/CSS from index.html;
    art inlined as data: URIs). The face updates LIVE as you edit — pips from the cost fields
    (mirrors `ui.js gateChips`: buy ⚡ gate + non-action play 💧/P), rules from the `effect` field.
    Lets you edit every card's costs (buy ⚡, play ⚡/💧/P) + description (`effect`) + `flavor`.
    Shows only **in-game cards** (the `ARCHIVED` set is parsed from `engine/cards.js` and
    filtered out — 50 of 60). The 2-column grid uses `repeat(2,minmax(0,1fr))` (+ `overflow-x`
    guard) so it never forces a horizontal scrollbar on a laptop; each card also has a **Comment**
    box (dashed, stored separately from edits, never written to cards.json) for change requests
    beyond cost/text — it flows into the "Copy changes" export as `COMMENT:`.
    Edited fields glow amber, edits
    persist in `localStorage`, and there are two round-trips: **Download cards.json** (drop over
    `docs/cards.json`, then `node scripts/gen-carddata.mjs && node build.mjs`) or **Copy changes**
    (a per-card diff to paste back to a session). Regenerate with `node scripts/build_cardeditor.mjs`
    after any `cards.json` change. (GOTCHA fixed during build: filter-control refs must be grabbed
    BEFORE the render loop, since `refreshCard()`→`applyFilter()` runs during it.)

- **Win celebration — fruiting + spore drift before the banner** (`src/main.js`, render-only).
  On a card-mode win, `presentRunOver` runs `startWinCelebration(finish)` before the success
  banner: `focusWorld` frames the green goal meadow, then **~46 small white mushrooms** pop up with
  an `easeOutBack` bounce (staggered) spread **across the hill** — placed up a `dome` mound profile
  by a random depth `d` so ones higher up the slope sit smaller (`depthS`), for distance/depth. They
  avoid the two goal bushes (`treeZones` = `drawGoalProps` clusters at `g0+4`/`g0+9`; `underTree(x)`
  retry-then-skip) so nothing fruits on top of a tree. Matured caps puff **spores** — cached
  `sporeSprite()` soft glow, additive, up to `CELE_MAX_SPORES` (2600), each tiny — that drift right,
  rise, and **weave on a coherent world-x + time wind wave** (`5.5·sin(wx·0.03 − time·0.004 + …)`),
  then fade off the right edge. `drawWinCelebration(time)` runs each frame from `renderFrame` (after
  floaters); the banner fires at `CELE_BANNER_AT` (5.2s) and its soft vignette lets the last spores
  sail on behind it; `winCele` cleared in `begin()`. Puzzle wins skip it. (Dev "win level" button
  triggers it too.) Timeline: mushrooms 0.12–~1.9s, spores 1.4–4.6s, banner 5.2s.

- **Win banner copy + white spore icon.** The level-complete / game-won banners now read
  **"You fruited and spored +N 🍄"** (`species_select.js showLevelComplete`/`showGameWon`) — the
  earned Spores fold into the one line with the spore icon inline; the separate chip, the word
  "Spores", and the "· N banked" total are gone. The **spore-print icon renders white everywhere**
  (`.spore-ic { filter: brightness(0) invert(1) … }` in `index.html`, matching the buy-button and
  B&W death-card overrides) instead of its native teal.

- **Spore-print currency icon** (`src/render/ui.js`, `assets/spores/spore-print.png`). `SPORE_ICON`
  is now an `<img>` of a matted mushroom spore-print (Replicate; `scripts/gen_spore.py`,
  `assets/spore_options/`) instead of the layered-circle SVG. See §5's spore-icon note.

- **Species unlock costs double per tier** (`species.js unlockCost`): `UNLOCK_TIER_BASE` 1000 →
  after lvl 1 = 1000, lvl 3 = 2000, lvl 5 = 4000, lvl 7 = 8000, lvl 10 = 16000 (rank = the unlock
  level's index in `tierLevels()`; explicit `sp.cost` still overrides). Dropped the per-species
  100/250 overrides.

- **Spores unlock economy + higher enemy spawns** (`src/species.js`, `src/render/species_select.js`,
  `src/render/ui.js`, `src/main.js`, `index.html`, `src/engine/substrate.js`, `assets/spores/`).
  - **Two-step species unlock (reveal → buy).** Clearing the required level now only **REVEALS** a
    gated species — its "?" tile flips to a viewable-but-unplayable **Locked** card (was: directly
    playable). To play it you **spend Spores**. `species.js` split the old `isUnlocked` into
    `isRevealed` (cleared enough — same k-th/(k+1)-clear stagger) and `isPlayable`
    (`isRevealed && isPurchased`); `newlyUnlockedByClear` → `newlyRevealedByClear`. Purchases persist
    in `progress.purchased` (`purchaseSpecies` deducts + records; `unlockCost` DOUBLES per unlock
    tier from `UNLOCK_TIER_BASE` (1000) — after lvl 1 → 1000, lvl 3 → 2000, lvl 5 → 4000, lvl 7 →
    8000, lvl 10 → 16000; rank = the unlock level's index in `tierLevels()`; explicit `sp.cost`
    still overrides. Earn rate for context: `sporesForLevel` = 100×level → ~6600 per full 11-level run).
  - **Spores = a persistent wallet** in `mycelium.progress.v2` (added `spores`, `purchased`;
    back-compat defaults for old saves). Earned by finishing levels — `sporesForLevel` = **100 × level**
    (`main.js onLevelWon` → `addSpores`, also tallied into a per-run `runSpores`). Picker header shows a
    **Spores counter**; a revealed-locked tile shows a blue Spore **cost badge** and opens a **buy sheet**
    (`openSpeciesDetail` mode `'purchase'`) that spends Spores and re-renders in place.
  - **Messages.** Level-complete now reads **"New species available for purchase!"** and shows
    **"+N Spores · N banked"**; the death overlay shows **"N Spores earned this run"** (via
    `presentRunOver` → `result.runSpores`; kept flat B&W — spore icon desaturated).
  - **Spore icon** = `SPORE_ICON` (ui.js, exported → species_select) — now an `<img class="spore-ic"
    src="assets/spores/spore-print.png">` of a real mushroom SPORE PRINT (Replicate FLUX, matted to glow
    on transparency; `scripts/gen_spore.py`, options in `assets/spore_options/`). Referenced by relative
    `assets/` path like the picker's card/species images (copied to `dist/` by the build). `.spore-ic`
    (index.html) sizes it 16–18px with a blue drop-shadow glow; the death card grayscales it to stay B&W.
    (Was an inline layered-circle SVG cluster; the old `assets/spores/spore-*.svg` variants are unused.)
  - **Enemies spawn higher** (`substrate.js findSpawnSpot`): shallow band tightened 0.6→**0.45** of depth
    and the vertical pick biased to the top (`pow(rng(),1.8)`), so nematodes/mould seed in the upper soil
    instead of piling against the deep floor. Verified: worms/clouds now land at depth-fraction ~0.05–0.25.
  - Verified with Playwright: fresh wallet "0 Spores"; seeded reveal→buy (300→200, marked purchased);
    win banner + death line render; spawn heights. 101 smoke + 61 card tests green.

- **Reservoir matte/placement, Metabolic Reroute text, trich vanish-after-infect.**
  - **Reservoirs**: matte is now AGGRESSIVE (`matte_reservoir.py` keys on max colour
    channel → the near-black background AND the dark rock ring drop out, leaving only the
    glowing water feathered into soil — no dark box). Placement moved to run LAST (after
    food) and now sits each pocket in a clear soil spot just BELOW the corridor (the
    shallow zone above it has no room): a downward scan of the few rows under the corridor
    finds a disc whose cells are clear of rock/lake/food/corridor and whose 1-cell ring is
    clear of lake/food (rock may sit against it). Result: 1–3 per map on every map, all
    impassable (rock+water, like a lake), 0 food/rock OVERLAP, 1–4 rows below the corridor
    (reachable). `drawReservoirs` overdraw stays for the feathered edges.
  - **Metabolic Reroute** effect text: "…gain 1 of it." → "…gain 1 of the other." (edit
    `docs/cards.json`, regen `cards-data.js`).
  - **Trichoderma** now VANISHES the round after it infects you (`threats.js`): a cloud
    that touches the colony sets `vanishNext`, and the next `spreadTrichoderma` drops it
    entirely instead of lingering a `fadeTurns` fade on top of the colony it just rotted.

- **Archived Tropic Lunge + Questing Front; death button → "New run"** (`cards.js`
  ARCHIVED set + `test/cards.test.js` ARCHIVED_TEST, `ui.js`). The auto-lunge-to-food
  pair is pulled (player can't steer it → reads as the colony wandering off); both keep
  their EFFECTS/data for a round-trip but are filtered from deck/drafts/hands. The
  campaign-death overlay button now reads **"New run ↻"** (was "Back to species picker").

- **Water-survival polish + HUD/UX fixes** (many files). Follow-up pass on the water
  overhaul:
  - **Tropic Lunge no longer reads as growing over rock** (`network.js`): the lunge is
    now a STRAIGHT no-dodge shot (`growDirected(..., noDodge=true)`, capped at the clear
    reachable run) that stops at the rock face instead of curving ±80° around/along it.
  - **Skip now costs 3⚡** (`config.skipCostEnergy`, was 1).
  - **Stall = death, action-aware** (`cards.js checkGoalReached`): if you can't draw,
    skip, play a card, OR use an action (and no draft is pending) the colony dies with
    `cause:'stall'` → overlay *"Colony died / Ran out of cards and resources."* The
    hand carousel also shows *"No playable cards, skip turn or use actions."* whenever
    nothing in hand is affordable (empty carousel message + a `.handhint` banner).
  - **Card play-costs now include Energy in the species picker** (`species_select.js
    costPips`): was showing only W/P, so e.g. Rhizomorph Lance hid its 1⚡. Species whose
    opener costs Energy now start with 10⚡ (Armillaria, Hydnellum in `species.js`).
  - **HUD/CSS** (`index.html`): the Skip chip stays right-aligned when the filter row
    hides (empty hand) via `margin-left:auto`; the settings gear is a smaller 32px circle
    vertically centred against the 40px pill; the species-detail scrollbar is thin with an
    inset thumb clear of the rounded corners + the ✕; **all death overlays render flat
    black-&-white** (`.card.death`, no gradients/colour accents).
  - **Water-deposit art** re-generated as flat-2D side-cut all-water pockets with
    bioluminescent creatures (`gen_reservoir.py` reprompt). THREE picks (D/E/F) matted to
    `assets/reservoir1..3.png`; `drawReservoirs` seeded-shuffles them so each of a map's
    1–3 reservoirs gets a DISTINCT art (no repeat within a map).

- **Water-survival overhaul** (`src/species.js`, `src/config.js`, `src/main.js`, `src/render/ui.js`,
  `src/engine/cards.js`, `src/engine/substrate.js`, `assets/`, `src/render/tutorial.js`). Water is now the
  colony's survival clock:
  - **Starting Energy → 0 for every species** (`species.js res.energy`); **Skip now costs 1 Energy**
    (`config.skipCostEnergy`, was 12). You bootstrap by playing the water-funded grow cards in the opening
    hand (every species has ≥1 `buyE=0` opener playable at 0 Energy — verified) to reach food and earn Energy.
    The stall-detection test premise updated (Skip 12→1, so the "no affordable move" stall now needs Energy 0).
  - **Water warning + dehydration death** (`main.js checkWater()`, called after every card op / action /
    world tick). At **≤5 Water** it toasts once per map (`state._waterWarned`): *"Warning! 5 water left…"*.
    At **≤0 Water** the colony dies with `runResult.cause:'water'`; `ui.js showOverlay` renders that as
    *"You ran out of water — Your mycelium colony shrivelled up and died."*
  - **Lake/reservoir Water income** (`cards.js`): touching open lake water OR an underground reservoir grants
    **+1 Water every 3 rounds PER source** (max +1 for the lake, +1 per distinct reservoir). Implemented as a
    synthetic engine (`_waterSource:true`, `WATER_SOURCE_NAME` = **"Aquifer Tap"**) that `updateWaterSourceEngine()`
    adds/updates/removes at the top of `produceCardEngines` — so it shows in the income pill + ledger
    automatically and vanishes when nothing is touched. `touchesLake` now excludes reservoir cells;
    `nodeTouchesWater` (lake OR reservoir) drives Hyphal Osmosis's lake-tier harvest. Income +
    the **water-seek helper** (`network.js reachForWater`, §9) both key off `cell.water` within
    `waterContactDist` (14px), so the DRAWN pool is deliberately aligned to those cells: **lakes**
    clip the art to the water-cell bowl (`drawLakes`), **reservoirs** carve a teardrop + scale the
    art by its opaque box (`reservoirHalfWidth` + `RESERVOIR_OPAQUE`) — so "touching" always means
    *visibly* touching, and a helper strand ends at the visible edge. See §9 for both fixes.
  - **Underground reservoirs** (`substrate.js` §2c-iv + `cell.reservoir` flag): 1–3 small impassable water
    pockets (`config.reservoirCount/Radius*`) placed one row ABOVE the winnable corridor (guaranteed
    reachable, never blocking the path). Marked `rock+water+reservoir` so they're solid + baked into the
    growth mask like lakes. Rendered by `main.js drawReservoirs()` from the matted `assets/reservoir.png`
    (chosen art; `scripts/gen_reservoir.py` generated the 6 options, `scripts/matte_reservoir.py` feathers
    the pick into the sprite). Fallback: bare cells (no procedural bowl — reservoirs set no surface barrier).
  - **Tutorial water step** (`tutorial.js`, after the "grow into substrate" step): frames the nearest
    reservoir with *"Touch water to get Water income. Your colony will die if you run out of water."*
    (`deps.reservoir()` in `main.js`; a `skip(s)` predicate drops the step on the rare map with no reservoir).

- **Settings gear menu + sensing-range lighting toggle** (`src/render/ui.js`, `src/main.js`, `index.html`).
  The top-left resource pill now holds ONLY resources; a **gear button** to its right (`.gearbtn` in a
  `.hudtop` flex row) opens a settings menu (`_wireSettings`) with **Event log · Music · Sensing-range
  lighting · Replay tutorial** — Log + Mute moved out of the pill into here. The **Sensing-range lighting**
  toggle sets `lighting.senseAura` each frame (`main.js sensingLightOn`, persisted in
  `localStorage 'mycelium.settings.v1'`, via handlers `isLightingOn`/`setLightingOn`); it gates BOTH the
  mycelium's light passes in `lighting.compose` — the sense-aura loop AND the network mint-glow halo around
  the colony — while ambient darkening (`ambientLight` 0.62) and hazard glow ALWAYS run, so OFF = a flat,
  evenly-lit earth with NO colony halo (not a whole-scene change; an even earlier version wrongly skipped
  the entire compose). Modest perf lever (drops the per-node/per-tip glow draws); the two full-canvas
  composite blits stay — see §10 for the real phone lever (DPR cap). **Replay tutorial** → `handlers.onReplayTutorial`
  = `beginTutorial()`. Mute/lighting are in-place toggles (menu stays open, On/Off chip updates); log/replay
  close the menu; a capture-phase pointerdown click-away closes it.

- **Card-name mycology pass — 7 renames + 1 reflavor.** A mushroom-accuracy review flagged names that
  weren't true to fungal biology; owner-approved changes: **Nutrient Transmutation → Metabolic Reroute**,
  **Suberin Wall → Melanized Wall**, **Mycorrhizal Mat → Humic Mat** (archived), **Symbiont Weave → Cord
  Weave** (archived), **Phosphatase Cushion → Phosphatase Reserve**, **Tap-Root Rhizomorph → Sinker
  Rhizomorph**, **Hyphal Imbibition → Hyphal Osmosis**; plus **Mineralizing Saprobe** reflavored from
  ammonium/nitrogen → phosphate (no rename). **Card names are load-bearing** — a rename must move in lockstep
  across: `docs/cards.json` (name + any cross-refs, e.g. Cord Weave's "Shuffle 5 copies of Humic Mat"),
  the `EFFECTS` keys + `DRAW_ENGINES` key&value + `ARCHIVED` set in `src/engine/cards.js` (a name with no
  matching `EFFECTS` key silently becomes **unplayable** — `playable()` gates on it), `test/cards.test.js`
  `ARCHIVED_TEST`, the art slug `assets/cards/<slug>.jpg` (git-mv'd), and regenerated `src/cards-data.js`
  (`scripts/gen-carddata.mjs`) + `dist/`. Internal identifiers were left alone (e.g. the `suberinRadius`
  config key). Verified: 61/61 card tests + a targeted 20-check pass playing every renamed active card
  through the engine. Review tool that drove the picks: `scratchpad/card-name-review.html` (Artifact).
  (Kept as-is per owner: the metaphor-heavy tempo names, Acorn Cache/Fall, Cordyceps text, the set-wide
  "Cache" abstraction.)

- **First-run TUTORIAL** (`src/render/tutorial.js` NEW, `src/main.js`, `src/engine/substrate.js`,
  `index.html` CSS, `assets/tutorial/`, `scripts/gen_tutorial_threats.py`). A scripted 10-step B&W
  popup walkthrough that fires **ONCE**, the first time NEW is pressed on a real species run (guarded by
  `localStorage 'mycelium.tutorial.v1'`; `tutorialSeen`/`markTutorialSeen`). Steps zoom the camera to
  whatever they describe (`focusWorld`/`focusBounds` eased tween in main.js, advanced by `updateCamFocus`)
  and, on two steps, **force an interaction** before advancing: double-click Apical Drive (armed), then
  drag-to-grow (gated on node count rising). `startTutorial(deps)` returns a controller `{tick,destroy,
  active}`; main.js `tutorialDeps()` supplies the live camera/state/DOM hooks and `threats()` /
  `colonyRoot()` / `goalPoint()` / `duffPile()` anchor points. `begin()` injects the two scripted props
  via `injectTutorialHelpers()`: an **Apical Drive** into the opening hand + a guaranteed low-value
  **yellow duff pile** in clear soil near the root (`substrate.injectDuffPile`). Overlay root is
  `pointer-events:none` so the game stays live on forced steps; a `.tut-catcher` handles click-anywhere
  on explanatory steps. Threat portraits (`assets/tutorial/{ant,nematode,trichoderma}.jpg`) are FLUX-
  generated into `assets/tutorial_options/` (contact sheets `_sheet_*`), owner-picked: **ant D / nematode B**
  (from `scripts/gen_tutorial_threats.py`, flux-dev, 4 options each). **Trichoderma** was re-picked to a
  RELATABLE flat green-mould look (petri-dish/bread, not nature-macro): the live `trichoderma.jpg` is
  `trichoderma_dish_4` (**option E**, moldy bread) from `scripts/gen_trych_relatable.py` (**FLUX 1.1 Pro**);
  `scripts/gen_trych_pro.py` holds an earlier realistic-macro set (`trichoderma_pro_*`) that was rejected.
  To re-pick: process an option to 680×529 JPG into `assets/tutorial/<slug>.jpg`, rebuild.
  Test/replay hooks: `#tutorial` hash forces it; `window.__game.startTutorial()` / `.resetTutorial()`.
  **Portrait phone:** `tutorial.js phonePortrait()` MINIMIZES the hand carousel on every step that
  doesn't need it (steps carrying `hand:'open'` — the hand + drag steps — keep it open) and maximizes
  it again in `finish()`; an `index.html` `@media (max-width:720px) and (orientation:portrait)` block
  shrinks the pics (146px) + text (14px) and pushes the popup clear of the top resource pill / minimized
  carousel. On portrait the camera (`main.js focusWorld`, `isPortraitPhone()`) also **zooms out ~50%**
  (wider view) and **frames the subject in the TOP HALF** (anchor ~0.28 for bottom-popup steps, 0.5 for
  top-popup steps — passed by `tutorial.js enter()` off `step.place`) so the bottom popup never covers it.
  **Desktop (wide, ≥900px):** the popup goes to the TOP HALF on the LEFT or RIGHT (`.tut-pop--side`),
  OPPOSITE the subject — `focusWorld` frames the subject in the opposite top quadrant (`anchorX` 0.25/0.75
  + `anchorY` 0.25, side chosen by the subject's world-x vs map centre) so popup + subject each own a top
  quadrant, clear of the top pill and the bottom carousel.
  The map is **never dimmed** (`.tut-catcher` is transparent — it only catches click-to-advance); there's
  **no pointer arrow** (removed — just the pulsing ring); the card-play step selects the **Grow** hand
  filter (`step.filter`→`ui.setHandFilter`, reset to 'all' on finish) to showcase the growth cards; and the
  drag-to-grow demo pulls **down into the soil** (not up at the sky). The Trichoderma step ends "**Not
  good.**" (was "Run or hide."); the final step is still "Good luck." **TEMP dev title button**
  ("Dev: tutorial ▸", bottom-right of `title_screen.js`, only shown
  when `onDevTutorial` is passed): jumps straight into a level-1 tutorial run with a RANDOM `SPECIES`,
  via `tutorialDevForce` (fires the tutorial WITHOUT `markTutorialSeen`, so the real first-run flow is
  unaffected). Remove the button + flag when the tutorial ships.
  **Portrait phone:** `tutorial.js` MINIMIZES the hand carousel (`setHandOpen(false)`) on every step that
  doesn't need the hand — steps carry `hand:'open'` for the two that do (the hand + drag steps) — and
  MAXIMIZES it again in `finish()`. A `@media (max-width:720px) and (orientation:portrait)` block shrinks
  the pics (`.tut-fig img` max-height 146px) + text (14px) and hugs the popup to the edges: bottom steps sit
  just above the minimized carousel, top steps drop below the top-left resource pill. Gated behind
  `phonePortrait()` so wider screens are untouched.

- **Energy trim + new threat curve** (`src/config.js`, `src/species.js`). Follow-up pass on the tune
  below: leaf Energy lowered another step (counts unchanged) to 🟡 duff Energy **1–2** (`duffEnergyMin/Max`
  2–4→1–2), 🟠 orange Energy **2–3** (`foodEnergyMin/Max` 3–5→2–3), 🔴 red engine Energy **3–4**
  (`engineEnergyMin/Max` 4–7→3–4). Counts still 🟡 5–7 / 🟠 5–7 / 🔴 1–3; verified across 50 seeds
  (yellow avg 1.5 E, orange 2.5, red 3.4; counts in range). **New enemy progression** (`LEVEL_THREATS`,
  ants/nematodes/mould): L1 1/1/1, L2 2/2/2, L3 3/3/3, L4 3/4/4, L5 3/5/5, L6 4/6/6, L7 4/7/7, L8 4/8/8,
  L9 5/9/9, L10 5/10/10, L11 6/11/11 — ants ramp slowest (cap 6), worms + mould climb to 11.

- **Economy tune + no trickle** (`src/config.js`, `src/engine/substrate.js drop()`). Per-map food
  counts + Energy tightened to: 🟡 duff **5–7** / Energy **2–4**, 🟠 orange **5–7** / Energy **3–5**,
  🔴 red engine **1–3** / Energy **4–7**. Levers: `foodClusterCount` 11→8, `duffClusterFraction`
  0.55→0.5 (even yellow/orange split), `foodEnergyMin/Max` 1–8→3–5, `duffEnergyMin` 1→2, new
  `engineEnergyMin/Max` 4–7 (drop() now rolls Energy per-KIND). **Removed the per-turn baseline Energy
  trickle** (`energy.baselineTrickle` 1→0) — income is now purely colonising food. Verified across 50
  seeds: every colour's count + Energy lands in range (orange avg 5.7, yellow 6.3, red 2.1). Also swapped
  duff art to the yellowest leaf set (Hophornbeam/Sassafras/Mulberry/Redbud/Sycamore); title CAMPAIGN row
  centred with "coming soon" beneath; mountains fixed via embed+size (bury base, show peak) not side-fade.

- **Drag-aimer on the rock-punch cards + YELLOW duff leaves** (`src/engine/network.js punchThrough`,
  `src/engine/cards.js`, `src/main.js _leafSets/_drawLeafHeap`, `assets/`, `scripts/gen_leaf_yellow.py`).
  - **Rock-punch cards/actions now use the SAME press-and-drag aimer as the grow cards.** Appressorial
    Punch (card) and Sinker Rhizomorph (action) were single-tap targets; they're now `directional` /
    `aim:'drag'` (Punch via the `directional` helper; Tap-Root gains `aim:'drag'` + `reachFn` in its
    `action` spec), so the player presses on a strand and drags to point the bore, with the identical
    green aim arrow (`main.js armedDragTarget`/`beginAim`/`drawAimLine` are all shared, unchanged).
    `punchThrough(sub,rng,x,y,aimX,aimY)` gained a separate aim point: the press `(x,y)` (ctx.srcX/srcY)
    seeds the rock search by walking the aim RAY (so the drag can start on a strand and cross the rock),
    and the drag `(aimX,aimY)` (ctx.x/y) sets the bore direction (anchor→aim). Single tap still works —
    `aimX/aimY` default to `x/y`, giving the old radial rock-find + tap-direction behaviour. New helper
    `cards.js punchAt(state,ctx)` wires the drag ctx into both effects. Verified: 10/10 headless (drag
    bores through a wall, single-tap fallback, Tap-Root drag path); 101 smoke + 60 card tests green;
    in-game the Punch card arms + is a drag target.
  - **Duff (low-value) leaf piles are now DOMINANTLY YELLOW.** They were the orange oak/maple leaves
    tinted brown, which melted into the brown soil. Generated 5 gold leaves (ginkgo/maple/poplar/aspen/
    elm) + a dark-brown beech via Replicate FLUX + BiRefNet (`scripts/gen_leaf_yellow.py`), promoted to
    `assets/leafYellow{Ginkgo,Maple,Poplar,Aspen,Elm}.png` + `assets/leafDuffBrown.png` (manifest
    entries added; `_leafSets` returns a `yellow` set + `duffDark`). `_drawLeafHeap`'s duff branch now
    draws mostly yellow (slightly vivified), with ~19% pieces tinted mid-brown and ~15% the dark beech,
    so the heap keeps decayed-litter variety yet reads clearly against soil. Value ladder stays
    colour-coded: **red (engine) > orange (cache/draft) > yellow (duff)**. Verified in-game: duff piles
    render as bright gold clusters that pop against the brown background (Playwright screenshot).
    TUNABLE: the yellow/mid-brown/dark split thresholds in `_drawLeafHeap`; `YELLOW_LEAF_KEYS`.

- **FINE rock collision — a ¼-cell solid mask that matches the drawn art** (`src/main.js solidifyRock`
  → `src/engine/substrate.js solidAtWorld` → `network.js _placeOk/_segmentClear`). The 36px cell grid
  was too coarse to match the sprites: a cell could fall in the seam between two touching rocks (a false
  GAP you grew through — "grew over the red rocks, no visible gap") OR cover a real sub-cell channel (a
  false WALL — "couldn't grow through the obvious gap"). Nudging `rockOverlap` can't fix both at once.
  Fix: `solidifyRock` now stamps every drawn sprite into TWO masks — the COARSE per-cell cover (→
  `cell.rock`, unchanged, for LoS/spawn/rendering) AND a FINE mask at 9px (K=4, `sub._fineSolid`, with
  lake water baked solid + the pathClear corridor open). Growth collision (`_placeOk`) now tests
  `substrate.solidAtWorld(x,y)` against the fine mask instead of the coarse `cell.rock`, and
  `_segmentClear` samples at the fine resolution so it can't hop a thin sliver. Net: collision tracks the
  visible sprite — if you can see brown between rocks you can grow through it; if they visually touch you
  can't. `rockOverlap` is GONE (no overlap knob; firmness is inherent). **USER-CONFIRMED working in-game**
  (fixed both the "grew over touching red rocks" and "blocked at the obvious blue/green gap" cases).
  Also verified pure-Node (solid wall blocks, real 36px channel threads, 0 nodes ever under rock).
  TUNABLE: `K` in solidifyRock (4=9px; raise for finer/more-WYSIWYG, lower for firmer-on-thin-seams). If a
  future map has ambiguous hairline seams between formations that should read as a barrier, the levers are
  (a) lower K, (b) dilate `_fineSolid` by ~1 fine cell to close sub-~27px gaps, or (c) fix GENERATION to
  place formations so they clearly overlap or clearly separate (no hairline seams).
- **Rock collision = EXACTLY what's drawn (no more invisible walls)** (`src/main.js solidifyRock`).
  ROOT CAUSE of the recurring "gap won't let me through" bug: generation flags cells `rock`
  (+`column`/`formation`) as FILLED shapes — a column is a 2-wide strip, a formation a filled
  ellipse — but the renderer draws an IRREGULAR sprite over them, and the old `solidifyRock` only
  ADDED collision under the sprite (`rockFill`), never REMOVING the original flags. So every flagged
  cell the sprite's silhouette didn't actually cover (ellipse corners, the gap between two nearby
  formations, thin spots in a column) stayed a rock cell with NO art over it — an invisible wall.
  Measured ~**55 of 225 flagged cells (24%) were invisible** on a sample map.
  FIX: `stampSolid` → `markCover` writes the drawn silhouette into a coverage MASK; then once every
  sprite has decoded, `solidifyRock` RECONCILES: `cell.rock = covered-by-a-sprite` (+ lake water stays
  solid, the `pathClear` winnable corridor stays open). Generation flags are now "where to draw" only;
  they never block growth on their own. Runs once all sprites decode (until then the original SUPERSET
  flags stand, so nothing is ever wrongly passable early). No place-then-hide-then-overlay — one source
  of truth; what you see is exactly what blocks. Verified: reconciliation truth-table 24/24 on 6 real
  seeds (covered→rock, water kept, corridor open, uncovered-formation→cleared, rockFill only on
  soil-overhang). Diagnostic left in: `__game.state.substrate._rockReclaimed`. CAVEAT to watch: columns
  now block only where their sprites actually cover — if a column's stacked sprites leave a visible gap,
  it's now (correctly) passable; if columns read as too leaky, thicken the column DRAW (more overlap),
  don't re-add invisible rock.
  - FOLLOW-UP (same effort): once collision matched the art, strands started reading as growing OVER
    rocks. Fixed the formation `markCover` geometry: it stamped `[topW, baseY]` but the sprite is DRAWN
    over `[topW, topW+dh]`; for a surface-CLAMPED formation baseY<topW+dh, so its deep half got no
    collision (a hole). Now stamps the full drawn box (`center=topW+dh/2, height=dh`).
  - FIRM EDGES policy (`config.growth.rockOverlap` 18→6→**0**): the old "soft edge margin" let strands
    skim into rock and squeeze between two BARELY-touching rocks (the seam is sub-cell, so a few px of
    overlap bridged it). Now rockOverlap=0 — a strand may NEVER sit in a rock cell at all (`_placeOk`
    returns false for any rock: `m>0 && openWithin` with m=0 ⇒ false). Barely-touching rocks block; no
    edge-skim. To keep growth flowing, the "grow around rock edge assistant" — the `growDirected` DODGE —
    was made GENEROUS (try aim, then wider offsets out to ~65°/~80° in fine steps, smallest-first,
    soil-only). Verified (pure-Node, /tmp firm_test): a solid 2-cell wall blocks both cards, 0 nodes ever
    inside rock; an aligned aim threads a real 1-cell gap, ±10° threads a 2-cell gap. Trade-off: the
    smallest threadable gap is ~1 cell (36px) and tight gaps want a roughly-aligned aim (players drag-aim
    at the gap, so that's the norm). Residual visual: art extends ~½ cell past cell-quantised collision +
    network draws over rocks, so a strand may still visually kiss a rock edge; true fix = draw rocks after
    the network (z-order), deferred.
- **Directional grow now DODGES around rock corners** (`src/engine/network.js growDirected`).
  Apical Drive / Rhizomorph Lance / Fruiting Vigil used to follow the exact aim vector and
  hard-stop the instant a segment clipped rock ("Blocked — nothing grew"), even when a wide
  gap sat just off the aim line — Foraging Fan (`growRadial`) already had a dodge, directional
  grows didn't. Now each step tries the aim first, then progressively wider angular offsets
  (smallest deviation wins, so growth stays dead-on-aim in the open and only bends the minimum
  needed to keep advancing): a `straight` lance bends ≤~0.5 rad (stays lance-like), a jittery
  grow ≤~0.7 rad. Tip-selection likewise now accepts any tip that can take a first step (straight
  OR dodged). Measured: this widens the range of aim angles that thread a gap by ~40–60% for the
  Lance (e.g. 7/21 → 11/21 aims through a 2-cell gap in a 3-cell wall); never regresses (NEW ≥ OLD
  in every synthetic case). NOTE: also investigated a suspected collision-vs-art *offset* — an
  on-canvas overlay of the stamped rock cells (dots at each cell centre = the point `stampSolid`
  tests) confirmed collision MATCHES the visible rock (boulders block only their centre cell;
  formations are solid across their art). So there is no stamp/draw misalignment — the earlier
  "filled-square" overlay was misleading (full-cell squares spill half a cell past art edges).
- **Third food tier — low-value "duff" piles (energy only, no draft)** (`src/config.js`,
  `src/engine/substrate.js`, `src/engine/cards.js`, `src/main.js`). The map was wall-to-wall
  **orange** drafting piles → too many card drafts. Added a THIRD map food type, **duff** (decayed
  brown leaf mould), that gives Energy but **no card draft**, and reads as lower-value than the
  orange (basic/event) and red (engine) piles. Value ladder is now color-coded: **red > orange >
  brown**.
  - **Generation** (`substrate.js generate()`): unchanged placement — every route/column/lake cache
    still drops as `kind:'normal'`. A new **DUFF PASS** then down-tiers a fraction
    (`substrate.duffClusterFraction` = 0.55) of ALL normal piles to `kind:'duff'`, chosen by an
    even-distribution over their x-sorted order so low/high-value piles alternate across the map.
    Down-tiered piles re-roll a smaller Energy value (`duffEnergyMin/Max` = 1–4 vs the drafting
    piles' `foodEnergyMin/Max` = 1–8) and set every cell `foodKind='duff'` + its `energyPerNutrient`.
    Result across seeds: ~7 duff / ~5–6 orange / 1–3 red — drafting piles roughly **halved**.
  - **No draft** (`cards.js checkPileRewards`): `kind==='duff'` piles are skipped, so they never
    offer a card. Energy still flows through normal digestion (per-cell `energyPerNutrient`), and
    tap-inspect (`main.js showPileEnergyAt`) shows the correct lower value.
  - **Render** (`main.js _drawLeafHeap`): duff reuses the orange oak/maple sprites pushed BROWN via
    `ctx.filter = 'brightness(0.6) saturate(0.5) sepia(0.6)'`, in a slightly smaller/flatter heap
    (9 pieces / base 0.52). A couple of pieces per heap (~2 of 9, chosen by a per-piece hash <0.26)
    are pushed almost to BLACK (`brightness(0.26) saturate(0.4) sepia(0.55)`) so the otherwise-uniform
    brown pile gains internal contrast and lifts off the brown soil instead of melting into it.
    Verified in-browser: an adjacent duff+orange pair renders as clearly distinct brown vs orange
    heaps (cross-kind piles don't merge — generalised the `drop()` anti-cannibalise guard to "never
    overwrite a DIFFERENT-kind cache cell").
  - Also: `deposit()` (player food) now never downgrades ANY map cache (was 'cache'-only).
    Tests green (101 smoke + 60 card); bundle rebuilt (0 import leaks). Tunables:
    `substrate.duffClusterFraction`, `duffEnergyMin/Max`, `foodEnergyMin/Max`.

- **Directional grow no longer false-blocks near rocks** (`src/engine/network.js`, `src/config.js`).
  A straight lance (Rhizomorph Lance / Apical Drive) aimed past a boulder was erroring "Blocked —
  the lance hit rock" even with open ground right there, because it grew ONLY from the exact aimed
  tip and hard-failed if that one strand was boxed. Fix: `growDirected` now prefers the aimed tip but
  **falls through to any frontier tip whose first step is clear** (ordered by projection along the
  aim), so an aimed grow toward open ground succeeds from a capable strand instead of failing.
  Also re-tuned `growth.rockOverlap` **10 → 18** — 10 was over-tightened (couldn't graze boulder
  edges/corners); 18 lets a lance skim past a rock's edge while a rock body >~1 cell still blocks its
  core (no growing across a rock; the probe confirms 0 deep crossings at any of these values).
  Verified: aimed-tip-boxed → grows from the clear tip; corner-graze → grows; 3-cell wall → approaches
  but does not cross.

- **Soft rock edges · action-use error toast · pile-tap energy fix · fewer red caches**
  (`src/config.js`, `src/engine/substrate.js`, `src/engine/network.js`, `src/render/ui.js`,
  `src/main.js`, `test/cards.test.js`).
  - **Soft rock overlap (all grow cards):** growth may now overlap a rock by up to
    `growth.rockOverlap` px (22) — `_placeOk` allows a rock point as long as open ground is within
    that margin (new `substrate.openWithin`). So a strand can **skim rock edges / thread tiny gaps**
    (rocks ≲1 cell thick pass), but a **wide rock's core** (and two touching rocks with no gap) still
    block — you can no longer grow clear across a big rock. Applies to `_segmentClear` (directional /
    fan / lunge) and `_growStep` (Hyphal Extension). Tune via `rockOverlap`.
  - **Action "Use" error toast:** the Use button in the Actions menu is no longer `disabled` when you
    can't afford it — every `.use` is wired, so clicking an unusable action toasts the reason
    (`activateAction` already returns e.g. "Need 1 more Water." / "On cooldown — …").
  - **Pile-tap energy fixed:** tapping a food pile now floats its value via each cell's
    `energyPerNutrient` (the 1–8 rebalance), not the old `nutrient × incomeEfficiency` — so the
    inspect number matches what harvesting actually gives (`main.js showPileEnergyAt`).
  - **Red (engine) caches → random 1–3/map** (`engineClusterMin/Max` replace `engineClusterCount`);
    placement retries at fresh random x (deeper fallback) so a map reliably gets its 1–3. Test forces
    a fixed count where it needs one.

- **Draft ×3 badge · Foraging-Fan escapes rightward · grow through ant trails · food-energy rebalance**
  (`src/render/ui.js`, `src/engine/network.js`, `src/engine/ants.js`, `src/engine/substrate.js`,
  `src/engine/turn.js`, `src/engine/actions.js`, `src/engine/cards.js`, `src/config.js`, `test/smoke.test.js`).
  - **Draft ×3 badge:** the draft "Choose one" panel now shows a **×3** corner badge on BASIC cards
    (drafting a basic grants `cards.draftBasicCopies` = 3 copies); events/engines show none. `_renderOffer`
    passes the copy count to the existing `cardFaceHTML(name, c, count)` `.stackn` badge.
  - **Foraging-Fan escape hatch now starts on the RIGHT:** the escape sweep iterates colony nodes
    rightmost-first (largest x = closest to the goal) and tries eastward rays first, so a boxed colony
    fans toward the goal instead of back-left.
  - **Grow through ant trails (no mutual impact):** ant trails no longer block growth (removed `antTrail`
    from `_placeOk` / `_growStep` / the colonise sweep) AND no longer chew the colony (removed
    `eatStrandsOnTrail`). Trails are still stamped (for their look + nematode following) and ants remain a
    FOOD rival (a nest still harvests nutrient). Smoke test flipped to assert growth crosses a trail.
  - **Food-energy rebalance:** `foodClusterCount` 14 → 11 (~25% fewer route caches). Each map pile now
    yields a small FIXED **1–8 Energy** (per-pile `energyValue`), spread across its cells as
    `cell.energyPerNutrient` so draining the pile totals exactly that value. Nutrient amounts (50/cell)
    are UNCHANGED, so attraction, threat-eating, colonisation timing and the draft trigger are all
    identical — only the Energy yield drops. All food→energy paths use the per-cell rate (`turn.js`
    passive drain, `Digest` action, `Saprotrophic Digest`, the pile's `finishEnergy` "+N⚡"); player-dropped
    caches (no `energyPerNutrient`) keep the old `incomeEfficiency`. Also fixed a latent merge bug so a
    drop bridging two piles folds them all into one (no cell shared between piles).
  - Verified: 5-seed headless check (every pile energyValue∈[1,8], pile total == value, nutrient still
    50/cell); tests green; boxed-colony repro still escapes; in-game draft shows ×3 on a basic / none on an
    event, 0 errors.

- **More forgiving rock edges — grow cards don't dead-end against rock** (`src/engine/network.js`).
  A colony that had grown its frontier up against a rock cluster could get soft-locked: Foraging
  Fan reported "no space" and Hyphal Extension "no food in range" even with open ground nearby.
  - **Hyphal Extension** (`_growStep`): when the straight step toward sensed food lands on a rock
    cell, it now noses AROUND the edge — tries progressively wider angle offsets (up to ~±97°) and
    takes the first clear one — so food tucked just behind a rock is reachable (over `stepsPerGrow`
    steps it curves past the edge) instead of the card giving up.
  - **Foraging Fan** (`growRadial`): added an ESCAPE HATCH — if the outward fan finds nowhere (every
    frontier tip walled by rock in front and its own mass behind), ANY colony node with open,
    un-crowded ground beside it sprouts a fresh branch (bounded to ~6 new branches). So a colony
    boxed against rock on its frontier can still fan into open space elsewhere (e.g. back the way it
    came / to the side) — matching the card's "grow every direction". Rock/ant-trail segment-clearing
    is still enforced (no growing THROUGH rock).
  - Verified with a headless boxed-colony repro: fully-walled frontier + open ground behind →
    growRadial now grows (was 0); food behind a rock wall → grow noses around it (was 0). Full test
    suite green; dev-run in-game Foraging Fan grows 3→146 nodes, 0 errors.

- **B&W picker buttons · centered card carousel · removed level chip** (`index.html` CSS,
  `src/main.js`).
  - **Species detail buttons** (`.ss-btn`) are now plain **black & white, no gradients**: Cancel
    (`.ghost`) = black fill / white border+text; Start game (`.primary`) = white fill / black text.
    Dropped the mint gradient + glow and the per-vibe (`warm`/`aqua`/`spore`) tinted-primary overrides.
  - **Hand carousel** (`.handlist`) `justify-content: flex-start → safe center` — cards center when
    there are only a few (looked odd left-justified); `safe` keeps a full hand fully scrollable
    (centering an overflowing flex row otherwise clips/hides the start).
  - **Removed** the top-centre "Level N / 11" chip: deleted `#levelChip` CSS and gutted
    `main.js updateLevelChip()` to just clean up any stray node.

- **Title "New" erase-progress confirm + picker cleanup** (`src/render/title_screen.js`,
  `src/render/species_select.js`, `index.html` CSS).
  - **Confirm on New (Survival):** pressing **New** wipes all unlock progress (`main.js onNew →
    resetProgress`), so `title_screen.js` now guards it — if there's saved progress
    (`loadProgress().clears` non-empty) it shows a plain **black-and-white** modal (`.ts-confirm`,
    no gradients): "Are you sure? Starting a new game will erase all previous progress." **Yes** runs
    the normal consume→onNew; **Cancel** / backdrop-click / **Esc** dismiss. No progress → straight
    through, no prompt. **Old** (Continue) is unaffected (it keeps progress).
  - **Picker:** removed the small green "MYCELIUM" eyebrow + its trailing rule line
    (`.ss-eyebrow` / `::after`) inside `.ss-console` — redundant now the big procedural MYCELIUM
    banner sits above the container. The container **border + glow are now white** (`.ss-console`
    border/box-shadow/inner radial `rgba(127,230,163,·) → rgba(255,255,255,·)`; the dark drop shadow
    kept). Section-divider rules + row labels stay their existing mint.

- **Grow SFX on every mycelium wordmark growth** (`src/render/mycelium_title.js`,
  `src/render/title_screen.js`). Both growth loops feed each frame's new-node count into a small
  `playGrowSfx(grew)` helper that fires the existing `playGrowBurst` (from `sfx.js`, the same organic
  "growing" swell as an in-game grow) sized to the strands grown since the last burst, throttled to
  ≥170 ms apart — so it reads as ONE swell that tracks the visible bloom. Covers: the **title** bloom
  + the **New/Old button-word** consume-grow (`title_screen.js`), and the **species-picker banner** +
  **level-win headline** (both via `growMyceliumTitle`).
  - **Bounded swell (important):** the space-colonization growth never truly terminates — the mat
    keeps wandering into scattered *unreachable* stray attractors, trickling a few new nodes ~forever
    (the RAF/compositing runs on; a latent, pre-existing churn). A naïve per-frame SFX therefore
    **looped endlessly** on the species + win screens (the title only ever shows pre-gesture, so its
    context is suspended and you never hear it). Fix: `playGrowSfx` latches OFF (`sfxDone`) once
    activity falls to a trickle (`grew < max(4, 6% of the peak grew/frame)` for ~10 frames), with a
    hard ~1.8 s time-cap backstop — so the sound is one bloom-length swell, then silence, even though
    the growth keeps trickling. `title_screen` calls `resetGrowSfx()` at the start of each button-word
    grow so that fresh growth gets its own swell after the title bloom's has latched off. Growth
    itself is untouched (visuals unchanged).
  - `playGrowBurst` self-caps (≤6 layers/burst, ≤8 voices, per-hit gain ∝1/√layers, bus compressor).
    Audio needs a user gesture (browser policy): the first cold-load title bloom is silent until the
    first tap; every later surface plays. Reduced-motion grows synchronously → no frames → no SFX.
    Verified with a headless `createBufferSource().start()` counter that the hit count now RISES then
    PLATEAUS (title 8 · button-word 16 · species +8 · win 8), instead of climbing forever.

- **Level-win minimizes the hand carousel** (`src/main.js`, `index.html` `.ss-win` CSS). Rather than
  hiding the unlock card on short screens, `onLevelWon()` collapses the carousel
  (`ui.setHandOpen(false)`) before the containerless win banner appears; `begin()` re-opens it
  (`setHandOpen(true)`) when the next level loads. The `.ss-win` bottom pad now only clears the thin
  collapsed strip (removed the big reserve + the `max-height:500px` card-hide rule), so the SUCCESS /
  YOU MADE IT headline + unlock card + Proceed fit over the map at every viewport, landscape phone
  included. Win words trimmed to "Success" / "You made it".

- **MYCELIUM wordmark on the species picker + redesigned level-win** (`src/render/mycelium_title.js`
  — new reusable module; `species_select.js`, `build.mjs` MODULES, `index.html` `.ss-title` /
  `.ss-win` / `#speciesSelect` CSS). `growMyceliumTitle(container, opts)` grows the same procedural
  mycelium wordmark (supersampled, per-letter bloom, fringe + strays) into any element and returns
  `{destroy()}`. Unlike the full title screen it **stops its RAF once the word is grown** (no
  perpetual compositing) so it's cheap to reuse. `opts`: `{word, stepRate}`.
  - **Picker:** rendered as a `.ss-title` banner ABOVE the `.ss-console` (picker root is now a flex
    **column**); `hide()` calls `title.destroy()`. (The console's small "MYCELIUM" eyebrow is now
    somewhat redundant with the banner — left as-is.)
  - **Level win (`showLevelComplete`):** NO container — a randomized headline ("Success" / "You made
    it", uppercased) grown in mycelium over a radial-glow "lighting" backdrop, then plain serif "You
    fruited and spored", then EITHER "New species available next run!" + the unlocked species card(s)
    OR nothing, and always a plain black **Proceed** button (white text, no gradient). Shown **OVER the
    won map** (translucent radial scrim, NOT opaque — the map stays visible). Body-level overlay
    (`.ss-win`) re-declares the `--ss-*` palette the embedded cards need; z-index 1004 (below the 1006
    inspector so unlocked cards can still be inspected). `.ss-win-cards .ss-card` needs an explicit
    width (grid-sized in the picker; collapses in flex). **Carousel handling:** rather than hiding the
    unlock card on short screens, `main.js onLevelWon()` **collapses the hand carousel**
    (`ui.setHandOpen(false)`) BEFORE the banner appears — so it shrinks to a thin filter strip and the
    win content always has room (card included) over the map, even on a landscape phone. `begin()`
    re-opens it (`ui.setHandOpen(true)`) when the next level loads. The `.ss-win` bottom pad only needs
    to clear that thin strip now (no giant reserve). `showGameWon` still uses `.ss-lc`.

- **Title screen** (`src/render/title_screen.js` — new; `main.js` boot, `species.js resetProgress`,
  `build.mjs` MODULES, `index.html` `#titleScreen`/`.ts-*` CSS). Procedural white **MYCELIUM** on
  black: a self-contained **space-colonization** growth fills the letter glyphs with a DENSE mat of
  fine white filaments — the letters are made **entirely of strands** (no fill/ghost/second colour;
  legibility comes from strand density) — and each letter edge is fringed with short branch-tipped
  stray strands. Growth animation: **each letter blooms from its own single RANDOM point** (one seed
  per letter x-band), all at once, paced by a fractional step accumulator (`STEP_RATE` ~1.4/frame).
  Fine seg + short attraction radius keeps the grid cheap. **Scale-invariance (phones):** strand
  density must track font size or a small (width-constrained) title renders sparse/malformed — so
  `attractorsFromText(…, scale)` **supersamples** (draws into a `scale×` buffer → effective sample
  step = px/scale) and `seedTitle` picks `S ≈ round(200/titleSize)` (1 on desktop, 2–3 on phone);
  the growth `seg` floor is low (`0.5`, was `2`) so seg scales down with the title too. (The menu
  words do the same in `sampleWord`.) Menu is DOM (layout/a11y/grayed states),
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
  1 nematode / 1 mould … L11 = 6 ants / 11 nematodes / 11 mould — ants scale slowest). `main.js
  configForLevel(level)` clones CONFIG and sets
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
  - **Level-complete overlay** (`showLevelComplete`, redesigned 2026-07-16): NO container — a
    randomized headline (**"Success"** / **"You made it"**) grown in procedural mycelium
    (`growMyceliumTitle`, with grow-SFX + a radial-glow backdrop), then serif "You fruited and spored",
    then EITHER "New species available next run!" + the inspectable unlock card OR a plain **black
    "Proceed"** button. Shown OVER the won map (translucent scrim, `.ss-win`). The hand carousel is
    collapsed (`ui.setHandOpen(false)`) before it appears and re-opened by `begin()` next level.
    Threat spawn depth (trichoderma +
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
  - **HUD:** (the old top-centre `#levelChip` "Level N / 11" has been removed.) A temporary
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
  - The left income ledger and the Metabolic Reroute picker now use the SAME
    resource marks as the top pill (the `RES_ICON` SVGs — gold bolt / blue drop /
    purple spark) instead of mismatched emoji, at a uniform, slightly-smaller size,
    vertically centred so the icons line up. `.erow .eval.lead` is now an
    `inline-flex` (number + icon share one baseline); the picker tints each mark to
    its pill colour.

- **Card + HUD fixes: transmute choice, ledger layout/size, warded blue, smaller start, seal text** (branch same).
  - **Warded strands now a DEEP BLUE** (`config.js` `render.warded` `#5cd9e6`→`#2f5fe6`) — the cyan read too
    close to the mint colony; deep blue separates cleanly.
  - **Metabolic Reroute now lets you CHOOSE the resource to gain** (`cards.js`, `render/ui.js`,
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
    only), Melanized Wall (infection only). Card `effect` text updated in `cards-data.js` **and**
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
  - From an adversarial review of the 4-card change: **Melanized Wall ward off-by-one** — the
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
    - **Sinker Rhizomorph** — was an *auto* dig-engine; now an installed **action** (type
      engine→action): once per 5 rounds, pay **2 P**, tap an in-range rock → bore through it
      (`punchThrough`). Shows a Use button (no longer an AUTO row).
    - **Constricting Ring** — now a **trap** (free, once per 6): tap empty ground → lay a snare;
      the first nematode to enter is digested for **+2 P** (`state.traps` + `resolveTraps` in
      turn.js, rendered as a pulsing ring by `drawTraps`).
    - **Sclerotial Seal** — cooldown 3→**4**; 1 P; seal a food pile from ants.
    - **Melanized Wall** — once per 3: clear all infection in radius 80 **and ward the cells
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
    economy modifiers (draw discount). Its **timed dig abilities** (Sinker Rhizomorph)
    render in the **Actions menu** instead — they act on the world, so they read as an
    ability, shown as an **auto** row (amber `AUTO` tag + `every N · in M` countdown, no
    Use button since they fire on their own cadence).
  - **`action` → right Actions menu**, now **installed as repeatable abilities** (was
    wrongly one-shot). A new `action(spec, run)` helper in `cards.js` returns
    `{installAction}`; `playCard` pushes it into `state.cards.actions[]`. Gating per the
    card's effect text: **Constricting Ring** (1✦, every 6, tap a nematode → +2✦),
    **Metabolic Reroute** (once/round, convert 2→1, instant), **Sclerotial Seal**
    (1✦, every 3, tap a pile → ant-proof 3 rds), **Melanized Wall** (every 3, tap → cure mould).
  - **`event`/`basic`/`extender` → one-shot** (play → discard/shuffle) — unchanged.
  - **Activation-time targeting:** `activateAction(state, i, ctx)` returns `{needTarget}`
    on the first call (Use button) so `main.js` arms a map-aim (`ui.pendingAction`); the
    map tap resolves it. Cost/cooldown/per-round-use are spent **only on a successful
    resolve**. `produceCardEngines` resets `used=0` and ticks `cd` down each world tick.
  - **Install cost model:** action cards pay **Energy (+ optional `buyCostPhosphorus`)** to
    install; their *play* W/P is a **per-activation** cost (in the spec), not an install gate — so
    `playCard`/`cardBlockedReason` skip *play* W/P for `action`-type cards, and the card face hides
    play-W/P pips for them. **`buyP` (v11, cards-design §23) is the exception:** a Phosphorus
    buy-in charged at install for every type, and it DOES show a P pip on the face.
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

- **First-run tutorial is ONCE-PER-BROWSER (localStorage `mycelium.tutorial.v1`), and marked seen the
  INSTANT level 1 starts.** `main.js`: `onNew` arms `tutorialPending = !tutorialSeen()`; `begin()` calls
  `markTutorialSeen()` at line ~818 — *before* the tutorial is even visible (it's deferred behind the level
  intro). So (a) it only arms from **New**, never **Old/continue**; (b) any prior start — even a few-second
  one that never reached the tutorial — consumes the flag. On **itch this bites**: itch reuses the SAME
  game-hosting subdomain across re-uploads, so a browser that touched an earlier upload already has the flag
  set and the new build correctly skips the tutorial. This was the "tutorial didn't play on my first itch
  play" report — NOT a bug (verified end-to-end with fresh localStorage: New→pick→dismiss level intro →
  `#tutorial` appears, flag flips to "1"). Replay it via the gear/settings menu → **"Replay tutorial"**
  (`onReplayTutorial`, ungated) or clear site storage / private window. If a localStorage read throws
  (sandboxed iframe/private mode), `tutorialSeen()` returns false → tutorial fires EVERY time, never never.

- **`growMyceliumTitle` (reusable wordmark) is sized by its CONTAINER, and races the font load.** Used in 4
  places now — title screen, high-scores heading (`.hs-title-myc`), species picker, and the level intro
  (`.li-level`). `titleSize = min(H·0.72, (W·0.9)/(len·0.62))`, so the wordmark grows to fit and the way to
  make it bigger/smaller is to resize the CONTAINER (height usually the binding constraint). When verifying
  in Playwright, box metrics flip during font load (the custom serif's `normal` line-height ≈1.0 vs the
  fallback's ≈1.26) — `await document.fonts.ready` and, for anything measuring the title-screen buttons,
  poll until the metric settles. Growth is RAF-based (holds when done); in `prefers-reduced-motion` it grows
  synchronously (can stall headless) — the level-intro screenshots run WITHOUT reduced-motion.

- **`#dev` quick-start CRASHES headless Chromium in this env.** The dev scaffold (`initCards(state,'testall')`
  = 300 E/W/P + 5× every card) hard-crashes the page ~0.5s after load in Playwright (no pageerror; browser
  disconnects). The game itself boots fine to the title screen. To boot a REAL run headless, drive the normal
  flow: `goto …/index.html#tutorial` (or `#notrich`) → wait `#ssAvail .ss-card` → click it → click `#ssIStart`
  → click to dismiss `#levelIntro`. Then `window.__game` is live (camera/state/etc.). See
  `scratchpad/real_run.mjs`. `deviceScaleFactor:1` and `--disable-dev-shm-usage` help stability.

- **Food-pile "invisible until grown into" bug is OPEN (see §9).** Do NOT re-add a food self-glow — that was
  tried and rejected (piles are truly invisible, not dim). Awaiting owner repro specifics.

- **The punishing early game is INTENTIONAL roguelike design — never "balance-fix" it.** (Owner canon,
  see `cards-design.md` §1a.) A first run is *meant* to die by ~level 3; the two ungated starting species
  (`species.js`) are the deliberately-weak on-ramp and are **not** meant to be viable long-run; the strong
  installed engines are **draftable but unplayable at the start** by design (their `buyCostEnergy`+
  `buyCostPhosphorus` install gates far exceed a starter's 0–10⚡/0–5P). Progression is meta: you **die a
  lot**, earn **Spores**, and unlock **increasingly powerful species** across runs. So do NOT buff the
  opening, do NOT make starters self-sufficient, and do NOT lower the top engines' install cost to be
  early-affordable — and if a "balance" review/Workflow flags "starting deck can't win / engine X
  unaffordable / species Y always loses on a fresh save", that is **expected**, not a finding. Only the
  *shape* of the curve (how steep, where the wall lands) is fair to tune, never its existence.
- **This headless env has NO GPU — canvas rendering runs in slow software (SwiftShader).** The game LOGIC
  is fine (boots in ~450ms, `node --test` fast, DOM/state readable via `page.evaluate`), but every PIXEL op
  is ~1000× slower than a real device: a single `canvas.toDataURL()` readback measured **~70 s**, and
  `page.screenshot()` reliably TIMES OUT (the continuous `requestAnimationFrame` render loop saturates the
  renderer thread so no stable paint lands in time). Freezing the loop doesn't help — the readback itself is
  that slow. So DON'T chase live game-canvas screenshots here: verify via (a) headless DOM/state assertions,
  (b) static-HTML renders of just the CSS/markup (no game canvas = fast), and (c) `node` unit tests; leave
  the final visual sign-off to on-device. **(2026-07-19 update — live game screenshots ARE sometimes
  feasible.** The worst instability turned out to be the boot's **external request storm**: `initMusic()` /
  streaming fire a burst of HTTPS calls that the agent proxy rejects (SSL-handshake errors), and the renderer
  would hard-crash mid-frame — Playwright then reports `Target page/context/browser has been closed`. In a
  Playwright context, **`ctx.route('**', …)` that `route.fulfill({status:204})`s every non-`127.0.0.1` URL**
  (music/CDN) keeps headless Chromium stable, and `page.screenshot()` then lands real game frames — this
  session captured the full map after the level-intro click that way. Launch with just `['--no-sandbox']`
  (adding `--disable-gpu`/`--disable-dev-shm-usage` made it LESS stable), `deviceScaleFactor` 2, and prefer
  `page.evaluate` DOM polling over `waitForSelector`. Screenshots can still time out on "waiting for fonts",
  so treat a captured frame as a bonus, not a guarantee; DOM/state assertions remain the reliable check.)
  (Perf note: the same lighting/composite cost that's slow here is a
  much smaller — but real — cost on a phone GPU. Biggest real-device lever = **capping `devicePixelRatio`**:
  `main.js renderDpr()` now caps it at **2** (`RENDER_DPR_CAP`) for the game canvas, so a 3× phone backs at
  2× — ~44% of the pixels, nearly halving per-frame fill work (worst-case zoomed-out); desktops at DPR 1–2
  are unaffected. If it reads too soft, bump the cap or make it a "High resolution" setting.)
- **Card NAMES are load-bearing — renaming a card is a multi-file operation.** A card's `name` is its
  primary key. The engine only plays a card if `EFFECTS[name]` exists (`playable()` in `engine/cards.js`
  gates on it), so a name that no longer matches its `EFFECTS` key silently becomes **unplayable** — no
  crash, no error, the card just vanishes from the deck. To rename a card, change ALL of, in lockstep:
  (1) `docs/cards.json` — the `name` field **and every cross-reference** (a draw-engine's effect text
  "Shuffle 5 copies of X", `produces`, design `notes`); (2) `src/engine/cards.js` — the `EFFECTS` key, and
  if it's a draw-engine the `DRAW_ENGINES` **key AND value**, and the `ARCHIVED` set membership; (3)
  `test/cards.test.js` `ARCHIVED_TEST` (mirrors ARCHIVED); (4) the art slug `assets/cards/<cardSlug(name)>.jpg`
  (`git mv` old→new; `cardSlug` = lowercase, non-alphanumeric→dash — art loads by DERIVED slug, no manifest);
  (5) regenerate `src/cards-data.js` (`node scripts/gen-carddata.mjs`) and rebuild `dist/` (prune orphaned
  old dist slugs); (6) `species.js` starting hands look cards up **by name**; (7) docs (`cards-design.md`,
  `cards-review.md`). A global full-phrase find/replace of the exact multi-word name is safe (names are
  distinctive) — but do NOT rename internal identifiers that merely allude to a card (e.g. the config key
  `suberinRadius` stays even though the card is now "Melanized Wall"). Verify by playing each renamed active
  card through the engine, not just by a passing build (a broken binding still builds).
- **Food Energy is decoupled from nutrient — keep it that way.** Map piles pay a fixed 1–4 Energy via
  per-cell `cell.energyPerNutrient` (by kind: yellow duff 1–2, orange 2–3, red engine 3–4); `nutrient`
  (50/cell) exists ONLY for attraction / threat-eating /
  colonisation timing / the draft trigger. If you ever go back to `nutrient × incomeEfficiency` for map
  piles you'll re-inflate Energy AND (if you also touch nutrient to compensate) break threat/attraction
  timing. All food→energy sites (`turn.js` drain, Digest action, `Saprotrophic Digest`, `pile.finishEnergy`,
  `main.js showPileEnergyAt`) must use `cell.energyPerNutrient ?? incomeEfficiency`.
- **Rock collision is a FINE `_fineSolid` mask, NOT an overlap margin (`rockOverlap` is gone).** The
  old `rockOverlap` px-into-rock margin was a two-sided trap (too low → false-blocks grazing a boulder;
  too high → reads as "growing over the rock") AND, on the coarse 36px grid, it couldn't be both firm on
  touching rocks and forgiving on real gaps. Replaced by `main.js solidifyRock` baking a ¼-cell (9px)
  solid mask from the sprite silhouettes → `substrate.solidAtWorld` → `_placeOk`. Collision now matches
  the visible art: firm (a strand never sits under rock, touching rocks block) AND forgiving (any visible
  gap threads). To tune firmness-vs-fidelity, change `K` in solidifyRock (higher = finer). Do NOT
  reintroduce an overlap knob. To check: `__game.state.substrate._rockReclaimed` (invisible cells cleared)
  and that no grown node satisfies `solidAtWorld`.
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
- **Melanized Wall's "block reinfection for 2 rounds"** is now implemented via `cell.mouldProof`
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
- **Water survival + underground reservoirs (the water economy).** Water is the survival
  clock: species start with **0 Energy** (except those whose opening hand has an Energy-cost
  card — Armillaria/Hydnellum start with 10), **Skip costs 3⚡**, and the colony **dies at 0
  Water** (`main.js checkWater`, `runResult.cause:'water'`; one-shot warning at ≤5). Two
  water sources refill it via a **synthetic engine** kept in `state.cards.engines` by
  `updateWaterSourceEngine` (called at the top of `produceCardEngines`): touching the **lake**
  or an **underground reservoir** grants **+1 Water / 3 rounds per source** (shown in the
  income pill/ledger as **"Aquifer Tap"**, `WATER_SOURCE_NAME`; removed when nothing is
  touched). Reservoirs are small **impassable** pockets (`cell.reservoir = id`, plus
  `rock+water` so the fine mask treats them exactly like a lake — see the WYSIWYG-solid note).
  `substrate.js` §2c-iv generates them **LAST** (after food) and scans down from just under the
  **corridor** for the shallowest spot free of the *unmovable* stuff — a lake, a path COLUMN
  (drawn from `sub.rockColumns`, not cells), or a food pile — then **CARVES a clean hollow**: the
  **teardrop** cells turn to water (`reservoirHalfWidth`/`RESERVOIR_PROFILE` shape it to the drawn
  art — NOT a full disc — so water cells line up with the visible pool; `main.js drawReservoirs`
  scales the art by its measured `RESERVOIR_OPAQUE` box to cover exactly those cells — see §9), and
  every scattered BOULDER or rock FORMATION in a `reservoirClearCells`
  (=2) halo is erased to soil (`rock/formation/rockFill=false` — both render from per-cell flags
  that skip water, so clearing removes their sprite; boulder sprites spill ~1.5 cells, hence the
  2-cell halo). The shallow zone is formation-DENSE, so carving (not avoiding) is what keeps the
  pocket near the path: 1–3 per map every map, **no rock/formation within 2 cells**, gap ≈1–4
  rows below the corridor (reachable). Note: the corridor carve leaves some cells `formation:true`
  but `rock:false`, so the clear gates on `rock || formation`.
  Three matted art variants `assets/reservoir1..3.png` (from `gen_reservoir.py` options +
  `matte_reservoir.py <LETTER> <name>` — an aggressive max-channel key that drops the black
  background/rock-ring); `main.js drawReservoirs` seeded-shuffles them so a map never repeats
  one. `touchesLake` excludes reservoir cells; `nodeTouchesWater` (lake OR reservoir) drives
  Hyphal Osmosis's lake-tier harvest. **Follow-up:** reservoirs can land up to 4 rows below the
  corridor with rock beside them (colony must fan down/around) — tighten the scan if flush-to-path is wanted.
- **Trichoderma vanishes the round AFTER it infects you** (`threats.js`). A cloud that touches
  the colony sets `cloud.vanishNext` (alongside `dying`) in `infectNetwork`; the next
  `spreadTrichoderma` drops it entirely at the top of the loop — it no longer lingers a
  `fadeTurns` fade on top of the colony it just rotted. (`dying` is still set for the
  "no-grow-while-spent" logic; the gradual-fade path is now only a fallback.)
- **Stall = death, action-aware** (`cards.js checkGoalReached`). If you can't Draw, Skip, play
  a card, OR use an installed action (and no draft is pending), the colony dies with
  `cause:'stall'` → overlay *"Colony died / Ran out of cards and resources."* The hand also
  shows *"No playable cards, skip turn or use actions."* whenever nothing in hand is affordable.
  **All death overlays** now render flat black-&-white (`.card.death` in `index.html`, no
  gradients/colour accents); the death button reads **"New run ↻"**.
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
