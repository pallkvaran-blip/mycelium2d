# Mycelium — Card System Design

Source of truth for the card layer. Card data lives in `docs/cards.csv` (spreadsheet-editable)
and `docs/cards.json` (implementation-ready). This doc is the rules + balance framework + the
open issues to resolve before implementation.

> Status: **IMPLEMENTED (v10)** — **40 cards**. The card layer is BUILT INTO THE GAME
> (`src/engine/cards.js`) and playable: deck/hand, draw/skip/play, per-round engines, reach-the-goal win.
> **v10: TWO resources only** — WATER (grow + substrate) and PHOSPHORUS (digest/defense/utility/work,
> harvested from rocks); Nitrogen retired. **Draw pulls 3** cards for 16⚡. Entering a food pocket bursts
> to look fully colonised at once, and a pile digests in ~2 steps. **v9: pile drafting** — empty starting
> hand; draft new cards by finishing map food piles. No `rarity`; variable buy costs (cap ~40).
> CURRENT rules: §17 (v8) → §18 (v9 drafting) → **§19 (v10 two-resource — authoritative)** →
> §20 (grow-card tuning) → **§22 (installed ACTIONS menu)** → **§23 (v11 — `buyCostPhosphorus`
> install gate + rebalancing pass — authoritative for costs)**.
> §21 is the (unbuilt) long-term vision.

---

## 1. Vision & the core loop

Mycelium is a deliberate, spatial roguelike **engine-builder**. You grow a fungal network from
the left entry across the map to the sunlit summer **goal**, where you **fruit** to win the level.
A **run** is a sequence of escalating levels; you build a collection (main deck) over time and
draft a smaller **run deck** each run (3 guaranteed favourites + draft picks).

The difficulty is meant to **emerge** from deck/draw variance × a contested spatial economy ×
a depletion clock — so maps can be procedural and we do **not** hand-author challenge.

The loop in one line:
**random tools (draft) × contested spatial economy (piles vs. ants) × a depletion clock = difficulty.**

### 1a. Difficulty & progression intent — **INTENTIONAL, do not "fix"**

This is a **roguelike**. The early game is *meant to be punishing* so that the meta-progression
feels like real, earned power growth. Treat all of the following as **deliberate design, not balance
bugs** — do not buff the opening, do not make the starting species self-sufficient, and do not let a
"balance" review flag any of it as a defect:

- **The starting species are NOT meant to be viable long-run.** The two ungated starters
  (`species.js`: Fairy Ring Champignon, Honey Fungus) are the *weak* on-ramp. A first-run player
  should **not** get much past **level ~3**. Dying early is the intended experience.
- **Players are meant to die a lot.** Death is the progression engine: each finished level pays
  **Spores** into a persistent wallet, and Spores + level-clears **reveal and then unlock
  increasingly powerful species** (`species.js` tier ladder, cost doubling per tier). You claw
  forward across many runs, not within one.
- **The best engines are draftable but *unplayable at the start* — on purpose.** The strong
  installed engines carry high `buyCostEnergy` + `buyCostPhosphorus` install gates (e.g. Rhizomorph
  Cable 20⚡+4P, Bulk-Flow Cord 14⚡+4P) that dwarf a starter's 0–10⚡ / 0–5P. You *see* the powerful
  tool in the draft and can't afford to install it yet — that gap is the aspiration that pulls the
  player deeper. Do **not** lower these to make them early-affordable.
- **Corollary for reviews/workflows:** "starting deck can't reach the goal", "engine X is
  unaffordable for N levels", "species Y always loses on a fresh save" are **expected**, not
  findings. The knobs that *are* fair game to tune are the *shape* of the curve (how steep, where
  the wall lands), never its existence.

---

## 2. Locked design decisions

These were settled in design discussion and are the backbone. Numbers are in §3 (tunable).

- **Energy is the single master currency.** You spend energy ONLY on three things: **DRAW** a
  card from the draw deck, **BUY** a card at a food pile, and **SKIP** a round. You never spend
  energy to *play* a card.
- **Deck depletion is the clock.** No free reshuffle of the discard pile (it's a graveyard).
  When you run dry you operate only your installed engine + the SKIP button.
- **Hard invariant — the engine is runway, not perpetual motion.** Total energy produced per
  round by all installed engines is **always less than the SKIP cost**, so an idle, card-dry
  player is *always net-negative* and must keep moving forward. You die when energy hits zero
  while card-dry. This guarantees the race terminates.
- **Hand model = visible hand + pay-to-draw basics.** A **visible HAND** of premium cards you
  plan and time (Terraforming-Mars style). A separate **DRAW DECK** of mostly basic actions you
  pay energy to draw from. Engine/extender cards add *new* basics to the draw deck; they then go
  to the discard. The discard is not recycled.
- **Food piles are the heartbeat.** Harvesting a pile pays **energy + a draft** at once: consume
  K leaves → see N cards → keep M, paying **each kept card's own buy cost** (§13 variable cost).
  Ants race you for piles; partial harvest = partial payout. (Piles reuse the existing sparse
  food-cluster system.)
- **Variable buy cost per card** (TM-style; *superseded the earlier flat-cost idea* — see §13). Each
  premium card costs a different amount of energy to acquire, balanced to its power; a W/P/N play-gate
  is a *second* cost, so gated cards cost less energy. Basics are free. The decision is power-vs-price-
  vs-gate-vs-timing, like a Terraforming Mars card.
- **Playing is free** for most cards; some cards cost **Water / Phosphorus / Nitrogen** to play.
- **Terraforming-Mars philosophy.** Almost every card is *good*; the decision is **timing &
  opportunity cost**, never good-vs-bad. Each card should trip exactly one thought: "great but too
  expensive — save it", or "great engine but too late to repay", or "can't afford the resource
  yet — route first". No duds, no auto-includes.

### Three gated resources (locked)
| Resource | Source on the map | Themes |
|---|---|---|
| **Water (W)** | lake edges | growth, turgor, digging, traversal |
| **Phosphorus (P)** | mineral / crystal rock formations | engines, structure, barrier-break |
| **Nitrogen (N)** | eating nematodes / decay | aggression, defense, payoff (turns the worm threat into fuel) |

Each maps onto a feature already on the map, so adding resources is "tap this for X" — not a new
map system — and makes lakes, mineral rocks, and worms all double as travel objectives.

---

## 3. Quantitative framework (proposed, tunable)

Put these in a new `CONFIG.economy` + `CONFIG.pile` block (keep numbers data-driven).

**Level length:** ~12–16 rounds of active play, then 2–5 rounds of card-dry engine+SKIP bleed.
A "round" = one end-turn resolution tick. Run = 6–10 escalating levels; later levels longer and
start with decks carried forward (depleted).

- EARLY (r1–5): set up, lay first engines, route to first piles.
- MID (r6–11): harvest W/P/N, draft at piles, dig under the big barrier.
- LATE (r12–16): decks thin, push the final dig, surface and fruit.
- DRY (r17+): no cards; engine + SKIP only; pure forward bleed to goal or death.

**Energy:** start 100 (range 90–120). Carry-over clamped to start+50 = 150 so banking can't
trivialise the next level.

**Costs:** DRAW a basic = **8** energy. SKIP = **12** energy (must stay > max combined engine
energy/round). Flat BUY by rarity: **basic 0–2 · common 8 · uncommon 16 · rare 28**.

**Food pile:** full harvest yields **+40 energy** (small 25 / med 40 / large 55) AND a draft of
**see N / keep M** (small 3/1 · med 4/2 · large 5/2). Partial harvest scales linearly. ~9 piles
per map; plan to hit 4–6. A pile roughly pays for itself in energy but is strictly positive on
cards — that's why you detour.

> **AS-BUILT (2026-07-16) — supersedes the pile-energy numbers above.** Each map pile pays a
> small FIXED Energy (random per pile, `pile.energyValue`), fully decoupled from its nutrient
> (impl: per-cell `cell.energyPerNutrient`; nutrient still drives attraction / threat-eating /
> colonisation only). The draft grants **3 copies** of a basic / 1 of an event (no "see N/keep M"; you
> pick 1 of 3 shown). This is a deliberate, aggressive Energy cut (food gave "way too much") — leans
> the game toward card ENGINES for income; revisit if runs feel starved.
>
> **THREE map food tiers (2026-07-16, later pass — supersedes the counts above).** The map was
> wall-to-wall drafting piles → too much drafting, so a third, lower tier was added. Value ladder
> (color-coded): **RED** engine caches (`1–3`/map, draft an Engine, 1–8 Energy) > **ORANGE** route
> caches (draft a Basic/Event, 1–8 Energy) > **BROWN "duff"** (decayed leaf mould — **Energy only,
> NO draft**, a smaller **1–4** Energy). Placement is unchanged (every route/column/lake cache drops
> `normal`); a **duff pass** then down-tiers a fraction (`substrate.duffClusterFraction` = 0.55) of
> the normal piles to duff, giving ~**7 duff / ~5–6 orange / 1–3 red** per map — drafting piles
> roughly **halved** without cutting map Energy. Tunables: `substrate.foodClusterCount`,
> `engineClusterMin/Max`, `duffClusterFraction`, `duffEnergyMin/Max`, `foodEnergyMin/Max`.
>
> **ECONOMY TUNE (2026-07-17) — current per-map counts + Energy (supersedes above).** Tightened:
> · **RED** engine cache — **1–3**/map, Energy **3–4** (`engineClusterMin/Max`, `engineEnergyMin/Max`) — highest tier, drafts an Engine.
> · **ORANGE** route cache — **5–7**/map, Energy **2–3** (`foodEnergyMin/Max`) — drafts a Basic/Event.
> · **YELLOW** "duff" (was brown) — **5–7**/map, Energy **1–2** (`duffEnergyMin/Max`) — Energy only, NO draft.
> Counts come from `foodClusterCount = 8` route caches + one per rock column/lake, then a
> `duffClusterFraction = 0.5` even split → ~half yellow, half orange (measured 50 seeds:
> orange 5–7 avg 5.7, yellow 5–7 avg 6.3, red 1–3 avg 2.1; each colour's Energy within range —
> yellow avg 1.5 E, orange 2.5, red 3.4). Engine Energy roll is per-KIND in `substrate.drop()`.
> Also **removed the per-turn baseline Energy trickle** (`energy.baselineTrickle` 1 → 0) — income
> is now purely from colonising food.

**Resources:** harvest is one-time from routing — lake tap +3 W (~3 charges), mineral +3 P
(~3 charges), eating a nematode +2 N. Resource engines produce +1/round (rare +2). Resources
gate *plays* only: minor effect 1, strong 2–3, power 3–4 or a mix. Stockpiles small (rarely >6),
so resource cards are about **sequencing harvests**, not hoarding.

**Repay (engines):** `repay = buyCost / value-per-round`. Common engine repays ~2–3 rounds,
uncommon ~4–5, rare ~4–6 with a higher ceiling. A late-game engine that can't break even in
~2 rounds should be reframed as a one-shot PAYOFF.

---

## 4. Hard invariants (bake into a `scripts/cardlint.mjs`)

1. **Engine energy ceiling:** sum of all *installed* engines' energy/round **< SKIP (12)**;
   per-engine ≤ 4. Idle card-dry player is always ≥ −2/round. (Resource/growth/defense engines
   are exempt from the sum but still obey repay clocks.)
2. **Variable buy cost:** each premium card has its own power-balanced buy cost (§13); basics = 0.
   A W/P/N gate offsets buy cost (gate is a second cost). *(Supersedes the interim flat-cost rule.)*
3. **Free play except W/P/N:** `playCostEnergy == 0` for every card. Energy is spent only on
   draw / buy / skip.
4. **No free reshuffle:** discard is a graveyard. Cards re-enter the deck ONLY via an explicit
   extender that adds *new* basics (and that extender is not recycled).
5. **Skip > max engine:** SKIP must stay strictly greater than max combined engine energy/round,
   re-checked against skip-*reducers* (they must carry a "SKIP cannot drop below X" floor and not
   stack).
6. **Every engine has a repay clock** in its tier band (common 2–3, uncommon 4–5, rare 4–6);
   non-engines set `repayRounds = 0`.
7. **No duds / no auto-includes:** no card strictly dominated at equal buy cost; no card correct
   to buy in 100% of states (else raise cost or add a W/P/N gate).
8. **Resource-gated = non-energy power:** anything that would cost > 28 to buy must instead carry
   a W/P/N play-gate. Energy gates *access*; resources gate *power*.

---

## 5. Card taxonomy (types / fates)

- **basic** — draw-deck floor; cheap/free repeatable actions (Grow, Add Substrate, Digest…),
  drawn by paying energy. Weak individually.
- **engine** — graduates to a persistent **tableau** when played; produces something each round
  (bounded energy / a resource / growth / defense). Has a repay clock.
- **action** — once installed, a repeatable ability on a **once-per-X-rounds** cooldown.
- **event** — one-shot / exhaust; a big single effect (blow up a rock, instant tunnel, spore bloom).
- **extender** — adds basics to the draw deck / improves draw economy; your runway. Not recycled.

### Card schema (columns in `cards.csv`)
`name · type · category · rarity · buyCostEnergy · playCostEnergy · playCostWater ·
playCostPhosphorus · playCostNitrogen · timing · repayRounds · axis · threat · produces ·
effect · flavor · notes · familyKey`

---

## 6. The current set (119 cards, draft)

By type: basic 13 · engine 42 · action 14 · event 43 · extender 7
By timing: early 26 · mid 51 · late 17 · any 25
By rarity: basic 13 · common 44 · uncommon 37 · rare 25
Resource-gated plays: 57 (≈ W 16 · P 14 · N 16)

### Build archetypes the set enables
1. **Energy Engine Rush** — cheap energy engines early to slow the bleed; coast wide harvesting
   every pile. (Brown-Rot Mat, Septal Pore Flux, Cordyceps Vault, Chlamydospore Bank)
2. **Water Turgor Dig** — stack water producers to bore straight through/under the big barrier.
   (Aquaporin Channels, Riparian Mycelium, Hydraulic Boring, Monsoon Bloom)
3. **Phosphorus Structure & Barrier-Break** — mine rock, detonate columns to open wide lanes.
   (Phosphatase Reserve, Apatite Hyphae, Apatite Detonation, Boring Front)
4. **Nematode Predator / Nitrogen Aggro** — farm worm swarms as a nitrogen engine for big N plays.
   (Adhesive Web, Arthrobotrys Snare, Nematophagous Mat, GS-GOGAT Surge)
5. **Tempo Sprint** — skip the engine layer; chain cheap grow/dig bursts and cashouts, fruit near-empty.
   (Rhizomorph Lance, Spitzenkörper Focus, Sclerotial Cache, Osmotic Cashout)
6. **Goal Rush / Reach** — routing, substrate, and reach-extends to cross the map and close the final
   gap fast. (Cord Formation, Rhizomorph Lance, Spore Dispersal Vector, Fruiting Vigil) *(spores removed
   — §13; win is now binary: reach the goal & fruit = win, no score.)*
7. **Defensive Survivalist** — broad mitigation + death-insurance; grind slowly but safely.
   (Sclerotial Bunker, Anastomosis Weave, Melanized Cord, Spore Bastion)

---

## 7. Known issues to fix (before implementation) — prioritized

From the adversarial review. **Do these first in the balance pass.**

**P0 — systemic / break the clock:**
- **Enforce the engine-energy SUM, not just per-card.** Stacking Saprotrophic Mat (+3) +
  Rhizomorph Trunkline (+4) + Mycorrhizal Exchange (+2) + Fairy Ring (+4) = +13/round, exceeding
  the +10 ceiling and SKIP-12 → idle net-positive, clock broken. Fix: runtime clamp (combined
  installed energy engines capped, excess wasted) **and** a cardlint that sums an actual build.
- **Skip-reducers must carry a floor and not stack** (Anastomosis Network, Melanized Cord). Define
  *effective* SKIP = base − installed reducers (floored), and require effectiveSkip > engineSum always.
- **Strip the +2 energy off Mycorrhizal Exchange** (it pays energy AND the N/P that fuels the rest —
  bootstrap exploit). Also Laccase Cascade is an energy engine mistyped as an action — count it.

**P1 — pricing / dominance (invariant 7):**
- Re-price strict-dominance pairs: Saprotrophic Mat > Rhizomorph Trunkline; Sclerotial Cache >
  Turgor Surge/Burst; Chemotactic Foray > ATP Accelerant; Enzymatic Deep Bore > Boring Front;
  Melanized Cord > Anastomosis Network. Nerf the cheaper or buff the pricier in each pair.
- **Resource-engine repay is inconsistent with the ev rule.** Adopt a "discounted trickle" value
  (~3–4 ev for a passive +1/round resource) and recompute every resource engine's `repayRounds`.
- **Stop double-taxing:** engines that just produce energy/defense shouldn't *also* be W/P/N-gated.
  Reserve resource gates for events/payoffs.
- **Frictionless ramp engines are auto-includes** (Aquaporin Channels, Phosphatase Reserve, Cord
  Formation, Saprotrophic Mat). Give each a real opportunity cost: install-time W/P/N gate
  (route-to-feature-first, reinforces the spatial theme) or a ramp-down (early-only identity).
- Over-costed near-duds to buff/re-tier: Fruiting Primordium, Sclerotial Bunker, Protein Synthesis
  Cascade (un-castable in N-light runs). Under-costed: Septal Reinforcement, Shade-or-Sun Cap.
- Conditional cards that can be 100% blank need a guaranteed floor: Hyphal Osmosis, Turgor Pulse,
  Adhesive Network.

**P1 — coverage gaps (add these cards):**
- **Anti-ant engine** (ants have no passive engine while mould/worm do) + an ant→resource upside
  loop (e.g. Trail Hijack) so ant levels have a build identity.
- **Mould→resource conversion** (Mycoparasitic Coil → N) and a mid-tier mould engine.
- **Unconditional N producer** (a common +1 N/round) so N-gated cards aren't un-castable on
  worm-light levels.
- **Resource conversion** card (there's only one lake per map → W can be scarce; no converter
  exists → cards gated on a missing resource are dead).
- **N-basic extender** for parity with the W/P extenders; a basic P harvest (Mineral Etch).
- A late "≈2-round-repay engine", and a couple of risk/reward downside-tempo cards.

**P2 — readability / theme:**
- **Naming pass:** bind each real term to one mechanic (Hydrophobin = water-repellency, Sclerotium
  = energy storage, Anastomosis = fusion/reroute, Rhizomorph = cords, Turgor = pressure-growth);
  current overload — Anastomosis ×6, Sclerotium ×7, Hydrophobin ×6, Rhizomorph ×7, Turgor ×6.
- **Disambiguate the ~7 dig/tunnel events** with a strict terrain-capability ladder as the FIRST
  clause (open-substrate < soft-soil < boulder < formation-tile < rock-column < lake-basin).
- Two accuracy flips: "Negative Phototropism" is backwards for a colony racing a *sunlit* goal;
  the mycorrhiza cluster assumes plant roots the world doesn't have (re-theme as mineral-weathering).
- **Event density is high (~43/119)** — verify a pure-event line still runs dry (the depletion
  clock must bite); consider trimming events toward more engine decisions.

---

## 8. Open questions for the human

- **Energy-ceiling enforcement:** global runtime clamp vs. per-card mutual exclusion?
- ~~**Spore valuation**~~ — RESOLVED (§13): spores are removed from the game. Win is binary —
  reach the goal and fruit = win the level. No spore score / no fruiting yield.
- **Resource stockpile caps & overflow** (rarely >6 assumed; some engines key off thresholds).
- **Harvest charge model** for lakes/formations (several cards say "no charge consumed").
- **Run-pool / collection data model**; are drafted-but-not-kept cards gone for the level or the run?
- **Terrain taxonomy lock:** freeze boulder / formation / rock-column / soft-column / lake-basin
  in config so each dig card targets an unambiguous set.

---

## 9. Implementation notes

- Add `CONFIG.economy = { drawCostEnergy:8, skipCostEnergy:12, startEnergy:100, energyCarryCap:150,
  resourceValueEquiv:6, buyTiers:{basic:1,common:8,uncommon:16,rare:28}, engineEnergyCeiling:10 }`
  and `CONFIG.pile = { energySmall:25, energyMed:40, energyLarge:55, seeSmall:3, seeMed:4,
  seeLarge:5, keepSmall:1, keepMed:2, keepLarge:2 }`.
- Existing per-action energy costs (grow 10, digest 8, …) become the PLAY effects of basic cards
  (play = free; you paid to DRAW).
- Write `scripts/cardlint.mjs` asserting invariants 1–8 over `cards.json` before any card ships.
- Card data is canonical in `docs/cards.csv` / `docs/cards.json`; the game should load from it.

---

## 10. Playtest rulings — round 1 (SUPERSEDE §2–§4 where they conflict)

Firm design rules from the first review pass. Apply set-wide in the revision pass.
Per-card verdicts live in `docs/cards-review.md`.

**Costing / rarity**
- **R1 — Rarity is not a frequency or cost lever.** Every card is unique, single-copy, equally
  likely in any draft. Drop the "rarity" framing; never balance a card on being "rare/rarely drawn".
- **R2 — ~~Flat buy cost~~ → REVERSED to VARIABLE buy cost (§13).** The flat-cost experiment was
  tried (v2/v3) and then reversed by the designer: real Terraforming-Mars balances via *variable*
  card cost. Every premium card now has its own power-balanced buy cost; the W/P/N play-gate is a
  second cost (gated cards cost less energy). Basics stay free deck-floor. See §13 for the curve.
- **R12 — Re-cost energy engines** (Brown-Rot Mat was too cheap/OP). Balance via effect magnitude +
  the engine-energy ceiling, not buy price.

**Substrate & growth**
- **R3 — Substrate = fixed distance, direction only.** Substrate cards drop their patch at the EDGE
  of current sensing range, in a player-chosen DIRECTION. Player controls direction, not distance.
  Differentiate cards by PATCH SIZE.
- **R3b — Add sensing/growth-trick cards**, e.g. "grow 1 in every direction (no substrate needed)",
  "grow 3 toward the nearest substrate even if out of range".
- **R8 — No "grow toward the goal" / obstacle-pathing growth.** Directional growth is player-aimed
  or toward the nearest sensed attractor. (Goal-direction is fine ONLY for a single-target rock clear.)

**Digest / production**
- **R4 — Digest affects ALL occupied substrate**, never specific cells.
- **R5 — Flat numbers, never percentages.** Digest starts very low (1); digest/production boosts add
  +1/+X flat. No % modifiers anywhere in the set.

**Rock / dig**
- **R6 — Rock clearing removes one WHOLE rock of any size; no distance counting.** Card is unplayable
  if no rock is in range (no do-nothing fallback). Differentiate dig cards by which TERRAIN they can
  clear (boulder / formation / column / lake-basin), not by distance.

**Targeting (phone-first)**
- **R7 — No single-node / single-strand targeting.** All targeting is GLOBAL, RADIUS-around-a-tap
  (like the Amputate action), or DIRECTIONAL. Cleanse / heal / protect / repair → radius.
- **R9 — Cleanse/heal is radius-limited**, never whole-map (e.g. Monsoon Bloom).

**Cut mechanics**
- **R10 — Drop skip-cost reduction entirely** (uninteresting; also removes the invariant-5 exploit).
- **R11 — Remove all "does not stack with itself" clauses** (every card is a single unique copy).

---

## 11. v2 framework (CURRENT — supersedes §3 buy-cost tiers)

v2 = 164 cards, fully R1–R12 compliant (0 flat-cost / play-energy / percentage / node-target violations).
Data: `docs/cards.csv` / `docs/cards.json`. Verdict ledger: `docs/cards-review.md`.

**Economy** — *the flat-buy line below was REVERSED in v4; see §13 for variable buy costs.*
- ~~Flat buy cost = 14 for every premium card~~ → **variable per-card buy cost (5–20+), §13.**
- `CONFIG.economy = { startEnergy:110, energyCarryCap:160, drawCostEnergy:8, skipCostEnergy:12, basicBuyCost:0 }`
  (buy cost now lives per-card in `buyCostEnergy`, not a global flat).
- **Piles** (`CONFIG.pile`): small `25 energy · see3/keep1` · med `40 · see4/keep2` · large `55 · see5/keep2`.
  Energy scales linearly with leaves consumed; the **draft unlocks only at full harvest** (ants stealing
  part of a pile = less energy AND no draft). ~9 piles/map; route 4–6.

**Engine energy ceiling (the death-clock linchpin)** — enforce GLOBALLY at runtime: each end-turn pay out
`min(Σ installed energy-engine output, skipCost−1) = capped at 11`; excess is wasted (surface "income
capped" in UI). Per-engine ≤ 4. Only ENERGY engines count toward the cap; resource/growth/defense engines
are exempt (they don't print the master currency) but keep their repay clocks.

**Terrain ladder for dig/clear cards** (R6) — freeze in `CONFIG.terrain`: `boulder < formation <
rock-column < lake-basin`. Each dig clears ONE whole rock within a contiguous capability band, is
unplayable if no eligible rock is in range, and carries a heavier (usually phosphorus) gate the higher
the band. No distance counting, ever.

**Targeting model** (R7/R9) — exactly three legal modes, each card declares one:
1. **GLOBAL** (digest = all substrate, network buffs, fruiting),
2. **RADIUS-around-a-tap** (the Amputate model; all cleanse/heal/protect/repair; differentiate by radius size),
3. **DIRECTIONAL** (substrate drops at the sensing-range edge in a chosen direction; growth is player-aimed
   or toward the nearest sensed attractor). No single node/strand selection anywhere.

**Residual watch-items for the next review round** — *all addressed in §12 (v3).*

---

## 12. v3 consolidation (CURRENT — supersedes §11 counts & watch-items)

v3 = **134 cards** (was 164: **31 cut**, **1 added**). Still fully R1–R12 compliant
(0 flat-cost / play-energy / percentage / node-target violations; verified by the consolidation script).
The `gapfill` family is **gone** — every kept card now lives in a real lane.

> Mandate was *"consolidate redundance only, no forced number, + add the ant stuff."*
> Every cut below is a genuine duplicate, a strictly-dominated card, or a redundant member of an
> over-served cluster. Nothing unique was removed for the sake of a target count.

**Composition** — type: basic 16 · engine 47 · event 50 · action 14 · extender 7.
Family: basics 10 · energy 16 · water 17 · phosphorus 15 · nitrogen 14 · defense 21 · growth 13 ·
fruiting 12 · extenders 9 · events 7.

### 12.1 Cuts (31), by redundancy cluster
- **Duplicate free grow basics** — there were three "aimed grow" basics and two "radial grow" basics
  across the basics/growth/gapfill families. Kept the basics-family copies; cut **Apical Extension**,
  **Hyphal Branching** (= Foraging Fan), **Apical Spearhead** (= Apical Drive), **Radial Flush**
  (buy-14 reusable Foraging Fan), **Long-Range Chemotaxis** (N-parity of Riptide Reach; reach is
  covered by free Tropic Lunge + W-gated Riptide Reach).
- **Duplicate resource floors** — **Ammonifying Mantle** (= Mineralizing Saprobe, the uncond +1 N
  engine), **Mineral Etch** (= Phosphate Tap, the basic P contact-harvest), **Decay Foray**
  (= Decay Forage Front, the N runway extender).
- **W/P engine glut** — **Aquifer Tap** (dominated Aquaporin Channels; durable uncond W faucet is now
  Osmotic Lure), **Aquaporin Conduit** (= Riparian Mycelium niche), **Apatite Vein Engine** (dominated
  Phosphatase Reserve; durable uncond P faucet is Mineral Foraging Hyphae), **Mycorrhizal Bridge**
  (P-engine glut). Each lane keeps a clean curve: capped-early → conditional → rare-ceiling.
- **Energy income / storage glut** — **Trickle Mat** (+1/round strictly dominated by Trunkline's +4 at
  the same flat buy = a dud), **Saprotrophic Quicksprout** (= Trunkline tagged "late"),
  **Chlamydospore Bank** & **Sealed Sclerotium** (storage covered by Sclerotium Reserve +
  Polyphosphate Granule).
- **Energy-burst auto-includes** — **Sclerotial Cache** (ungated instant +18 strictly dominated
  Hyphal Investment) and **Autolytic Cash-Out** (= Necrotic Tithe's spatial-sacrifice axis, and the
  worst auto-include at +30) cut outright; see §12.2 for the two survivors that were re-costed.
- **Dig ladder duplicates** — **Oxalate Exudate** (event) (= Enzymatic Deep Bore, 2P boulder+formation),
  **Pebble Crack** (Tier-1 boulder covered by Appressorial Punch + Acidic Exudate), **Karst Dissolution**
  (= Hydraulic Deluge Bore, 3W+1P column+lake-basin).
- **Mould cleanse / heal glut** — six radius cleanses collapsed to a clean set: cut **Antibiotic Flush**
  (= Antibiosis Bloom), **Rot Cleanse Bloom** (= Hydrophobin Cleanse), **Cytokinin Salve**
  (= Rehydration Pulse, r60/1W all-threat repair), **Mycoparasitic Coil** (= Mycoparasitic Reversal),
  **Laccase Curtain** (= Melanized Sheath).
- **Converter glut** — **Translocation Cord** & **Nutrient Shunt** (the design always intended ONE
  generic W↔P↔N converter; kept **Metabolic Reroute**).
- **Substrate / water-burst glut** — **Spore Speck Patch** (= Leaf Litter Cache), **Humus Apron**
  (size-glut between Litter Drift and Forest-Floor Mantle), **Tide Surge** (W-burst+grow covered by
  Imbibition Surge + the grow events).

### 12.2 Re-costs & fixes (watch-items from §11)
- **Autophagic Sprint** +24 → **+16** (the permanent skip-raise downside now actually bites early).
- **Shade-or-Sun Cap** SUN +28 → **+18** (the energy↔spore FORK is the point, not a pile-rivaling spike).
- **Saprophytic Reclaim** whole-network → **RADIUS-around-a-tap (r75)** — R9 compliance.
- **Vesicle Supply Line** now seeds **Apical Drive** basics (Apical Extension was cut).
- The burst cluster is now fully axis-differentiated — every one-shot energy spike carries a distinct
  gate or downside: Osmotic Cashout (1W, instant), Hyphal Investment (ungated drip), Hyphal Autolysis
  (deck sacrifice), Necrotic Tithe (frontier sacrifice), Autophagic Sprint (skip-raise), Spore Salvo
  (2N, hands back N), Shade-or-Sun (fork), Trail Hijack (ant-trail gated). No ungated-no-downside
  instant spike survives.

### 12.3 Ant lane (the "add the ant stuff" ask)
Ants now have a complete lane parallel to the worm lane — **8 cards** in the `defense` family:
- **NEW · Fungus-Garden Mat** (rare engine) — the **unconditional anti-ant defensive ENGINE** the lane
  lacked, the direct parallel of Nematophagous Mat (worms): guaranteed **+1 N/round floor** on any map,
  doubling to **+2 N + turning back ant columns** that touch the network while a raid is on. Distinct
  from Picket Hyphae (reduces pile-theft) and Aphid Ranch (ant→energy): this **removes ant pressure +
  pays a resource floor**, so it is never a dead draft on an ant-light map.
- Engines: Fungus-Garden Mat (uncond), Trophallaxis Hijack (skim ant food→nutrient), Picket Hyphae
  (−2 leaves stolen/pile), Aphid Ranch (ant→energy, +1 floor).
- Reactive/offensive: Chemorepellent Trail (repel piles), Pheromone Scramble (re-path ants),
  Trail Hijack (trail→energy + free route), Formic Vanguard (collapse nests).

### 12.4 Family refold
Every surviving `gapfill` card was moved to its real lane: Cordyceps Vault / Autophagic Sprint /
Necrotic Tithe / Spent Mat Combustion → **energy**; Imbibition Surge / Condense → **water**;
Ammonify → **nitrogen**; Picket Hyphae / Trail Hijack / Aphid Ranch / Pheromone Scramble /
Mycoparasite Harvest / Demarcation Line / Saprophytic Reclaim / Fungus-Garden Mat → **defense**;
Foxfire Glow / Litter Drift / Forest-Floor Mantle / Sensory Sheath → **growth**.

---

## 13. v4 — spores removed, variable buy costs, tighter text (CURRENT — authoritative)

v4 = **124 cards** (v3 134 → 10 cut). Driven by three designer directives:
*(1)* remove everything spore-related, *(2)* costs are variable & power-balanced like Terraforming
Mars (NOT flat), *(3)* tighten over-explained card text. Produced by a multi-agent workflow with
adversarial fidelity + cost-curve verification.

### 13.1 Spores removed — win is now binary
**Spores are no longer part of the game.** "Fruiting" simply means **reaching the goal and winning
the level** — there is no spore count, no fruiting yield, no score, no carry-over.
- **Cut (spore-economy cards):** Primordium Set, Stipe Buttress, Spore Print Flush, Synchronous Flush,
  Veil Rupture, Stroma Crust, Hardened Apothecium — plus three that became redundant shells once their
  spore rider was stripped: **Shade-or-Sun Cap** (collapsed to a plain +18 burst, dup of the burst
  cluster), **Fruiting Primordium** (redundant "win now at goal" finisher), **Sclerotial Bloom**
  (a 3 P dig dominated by Apatite Detonation).
- **Kept (spore is only *flavor*, mechanic is non-spore):** Spore Dispersal Vector (routing leap),
  Aerial Spore Cast (multi-front routing), Spore Bastion (threat-halt), Spore Salvo (energy+N burst),
  Sporulating Bloom (tutor), Adhesive Web *(A. oligospora)*.
- **Finishers intact:** Fruiting Vigil (close an 8-cell gap to the goal & win) and Positive Phototropism
  (surge 3 toward the goal when in range) — both are reach-to-goal tools, exactly what winning needs now.
- The `fruiting` family is gone; its non-spore survivors (Hydrophobin Rind, Melanized Cord, Anastomosis
  Graft — all mitigation/insurance) refolded into **defense**.

### 13.2 Variable buy cost (reverses the flat-14 rule)
Buy cost is now **per-card and power-balanced**, the way TM actually works. Curve (premium cards):
**5–20 energy, median 10**, e.g. 5–7 small utilities · 8–13 solid commons/uncommons · 14–18 strong
engines/bursts/finishers. Basics stay **0**.
- A **W/P/N play-gate is a second cost**, so a heavily-gated card costs *less* energy (≈ 2–3 energy off
  per gate point). Energy-positive bursts are priced near their payout (e.g. Osmotic Cashout +22 → buy 17,
  net ≈ +5). Anchor: Rhizomorph Trunkline (+4/round, ungated) = 18.
- An adversarial **cost-curve critic** removed strict dominance: e.g. Septal Pore Gating (a weaker
  draw-discount than Septal Pore Flux) dropped to **6**; Phosphatase Reserve re-priced to **8** to match
  the capped-resource-engine pattern (Aquaporin Channels 7).
- `buyCostEnergy` now carries this per card in `cards.json`/`cards.csv`. `CONFIG.economy.buyCostFlat` is
  retired.

### 13.3 Tighter card text
Every card's `effect` was rewritten concise & phone-readable (1–2 short sentences), with an adversarial
fidelity pass guaranteeing **no mechanic, number, gate, targeting mode, cooldown, or "unplayable-if"
clause drifted**. Two flagged drifts were hand-corrected (Melanized Sheath kept absolute "cannot be
infected"; Saprophytic Reclaim kept "rotted *or* infected"). **Monsoon Bloom**'s radius was cut 160 → 110
(designer PASS: 160 read as "clear all").

### 13.4 Composition (124)
Type: basic 16 · engine 43 · event 44 · action 14 · extender 7.
Family: basics 10 · energy 16 · water 17 · phosphorus 15 · nitrogen 13 · defense 24 · growth 13 ·
extenders 9 · events 7. (No `fruiting`, no `gapfill`.)

---

## 14. v5 — the CORE SET (CURRENT — authoritative)

**39 cards.** Deliberately weeded down from 124 to *one card per core type*, so the set is small
enough to review properly. Stronger cards and variations on these core mechanics come later.

### 14.1 What changed
- **`rarity` removed** entirely (not a balance lever). Field dropped from `cards.json`/`cards.csv`.
- **Basics reworked.** The player STARTS with only **5× Hyphal Extension + 5× Leaf Litter Cache**
  in the draw deck (`startCopies: 5`). Every OTHER basic enters the deck only by playing a **draw
  engine** card ("Shuffle 5 copies of X into your draw deck") — one draw engine per non-starting basic.
- **Reviewed basics applied** (round-3 verdicts): all 14 liked basics kept with the human's shorter
  descriptions; **Mineralize** and **Ammonify** removed (thumbs-down); **Constricting Ring**
  reclassified basic → **action** (worm trap).
- **Cost cap ~40** (eventual). The core set sits at **0 (basics) / 6–22 (premium)**, leaving 22–40 of
  headroom for future power cards. `buyCostEnergy` is per-card (variable).
- **Tutorial set** — a `tutorial: true` flag marks a suggested starting configuration (§14.4),
  filterable in the review tool via the "★ Tutorial set" chip.

### 14.2 The core types kept (one each)
- **Basics (13):** grow-to-food (Hyphal Extension), grow-aimed (Apical Drive), grow-radial (Foraging
  Fan), grow-reach (Tropic Lunge), substrate S/M/L (Leaf Litter Cache / Humus Bed / Humic Mat),
  digest (Saprotrophic Digest), boulder-dig (Appressorial Punch), protect (Sclerotial Crust), water
  harvest (Hyphal Osmosis), phosphorus harvest (Phosphate Tap), water floor (Condense).
- **Draw engines (11):** one per non-starting basic (Leading Cord, Forager Bloom, Questing Front,
  Humus Cache, Cord Weave, Enzyme Priming, Boring Corps, Crust Reserve, Capillary Runners,
  Prospecting Cords, Dew Traps).
- **Energy (3):** income engine (Rhizomorph Trunkline +4/rd), burst (Osmotic Cashout), draw-discount
  (Septal Pore Flux).
- **Resource production (3):** Aquaporin Channels (W), Phosphatase Reserve (P), Mineralizing Saprobe (N).
- **Dig (1):** Sinker Rhizomorph (formation/column, P-gated).
- **Defense (3):** anti-ant engine (Fungus-Garden Mat), anti-mould engine (Melanized Sheath),
  anti-worm action (Constricting Ring).
- **Utility (5):** radius heal (Rehydration Pulse), converter (Metabolic Reroute), reach
  (Rhizomorph Lance), scout (Foxfire Glow), finisher (Fruiting Vigil).

### 14.3 Schema changes
Dropped `rarity`. Added `tutorial` (bool) and `startCopies` (int; 5 on the two starting basics, else 0).
Draw-engine payload lives in the `effect` text ("Shuffle 5 copies of X…"). `playCostEnergy` stays 0.

### 14.4 Suggested tutorial starting configuration
Draw deck: **5× Hyphal Extension + 5× Leaf Litter Cache**. Opening HAND (7 cards, all `tutorial:true`):
- **Rhizomorph Trunkline** — energy engine (slows the bleed) → teaches engine-building.
- **Aquaporin Channels** — +1 Water/round → teaches resource production.
- **Fungus-Garden Mat** — +1 N/round + ant defense → teaches defense + a 2nd resource.
- **Forager Bloom** — shuffle in 5 grows → teaches deck extension.
- **Boring Corps** — shuffle in 5 boulder-digs → teaches digging past barriers.
- **Osmotic Cashout** — spend 1 W for +22 energy → teaches bursts / resource spend.
- **Fruiting Vigil** — 2 W + 2 N, extend to goal & win → teaches the finish.
Water comes from Aquaporin Channels, Nitrogen from Fungus-Garden Mat, so the burst and the finisher
are both affordable within an easy level. Demonstrates: grow, substrate, energy engine, W+N
production, deck extension, digging, burst, defense, and winning.

---

## 15. v6 — resources GATE the core loops (CURRENT — authoritative)

**38 cards.** Fixes the "resources are easy to make but gate nothing / feel useless" problem by making
each map resource **required for a core recurring activity**, so producing W/P/N genuinely matters.

### 15.1 The gating model
- **WATER → GROWTH** (turgor). Every grow action costs Water. Single-step grows (Hyphal Extension,
  Apical Drive, Foraging Fan) = **1 W**; multi-step grows are discounted below 1 W/step so they stay
  worth it (Tropic Lunge 3 steps = 2 W, Rhizomorph Lance 6 = 2 W, Fruiting Vigil = 2 W). **Substrate
  placement** (Leaf Litter / Humus Bed / Humic Mat) is NOT growth and stays free.
- **NITROGEN → DIGESTION**. Saprotrophic Digest = **1 N** (enzymes need N).
- **PHOSPHORUS → repeatable ACTIONS** (ATP). Every activation of an action-type card = **1 P**
  (Constricting Ring, Sclerotial Seal). Sinker Rhizomorph pays **2 P at install** (engine).
  The resource **converter** (Metabolic Reroute) is exempt (it's the relief valve) and
  resource-*producing* engines are never P-gated.
- Other cards keep sensible thematic gates (Osmotic Cashout 1 W = water→energy; Rehydration Pulse 1 W;
  Fruiting Vigil 2 W + 2 N).

### 15.2 Anti-soft-lock economy (proposed — confirm)
The starting draw deck stays strictly **5× Hyphal Extension + 5× Leaf Litter Cache** (per the designer),
so it has no built-in water source — yet grow now costs water. Safeguards so a run can't dead-end:
- **`startResources = { water: 5, nitrogen: 2, phosphorus: 2 }`** — lets you grow from turn 1 and pay
  Fruiting Vigil's 2 N from the buffer alone.
- Early water is reachable: **Aquaporin Channels** (+1 W/round, in the tutorial hand), **Condense** /
  **Hyphal Osmosis** (via draw engines), and **lake taps**.
- ~~Proposed baseline +1 W/2 rounds safety net~~ → **RESOLVED in v7 (§16):** the designer instead seeds
  **5× Condense (+3 W each)** into the starting draw deck, so water is guaranteed from the deck itself.
Soft cap ~6 per resource. Every W/P/N-gated card must remain recoverable from a zero stock (no gate is
ever a permanent dead end).

### 15.3 Three review-failed cards fixed
- **Fungus-Garden Mat** removed (ants steal from *piles*, not your network) → replaced by **Sclerotial
  Seal** (action, 1 P, once/3 rounds): *tap a food pile; ants can't harvest it for 3 rounds* — protects
  what ants actually attack.
- **Melanized Sheath** removed ("3 nearest strands" was untargetable) → replaced by **Melanized Wall**
  (engine, buy 16): *network-wide — cure 1 infected strand/round and block new mould infection* (global,
  no per-strand targeting).
- **Foxfire Glow** removed, no replacement (the map is fully visible — scouting is pointless).

### 15.4 Buy-cost rebalance & tutorial
Gated cards were pushed to lower energy buys (the gate is a second cost): e.g. Osmotic Cashout 18→12,
Fruiting Vigil 20→12, Rhizomorph Lance 12→10, Constricting Ring 6→5, Tap-Root 14→12; Rhizomorph
Trunkline stays the priciest at 22. Tutorial hand updated (Fungus-Garden Mat was in it): now
**Rhizomorph Trunkline · Aquaporin Channels (W) · Mineralizing Saprobe (N) · Osmotic Cashout ·
Fruiting Vigil · Forager Bloom · Boring Corps** + the 5×/5× starting deck — carries the W and N the
gated finisher needs.

### 15.5 Composition (38)
basic 13 · engine 7 · event 4 · action 3 · extender 11.

---

## 16. v7 — resource-cost tuning (CURRENT — authoritative)

Round-5 review approved all 38 cards (38👍/0👎); these are the requested cost tweaks. The gating model
of §15 stands, extended so **substrate placement is also gated** and the **water economy is scaled up**
to match "grow costs water."

### 16.1 Resource costs
- **Substrate → Nitrogen** (organic matter): Leaf Litter Cache **1 N**, Humus Bed **1 N**, Mycorrhizal
  Mat **2 N**. This makes the food loop N-driven (place substrate with N, digest it with N) — the clean
  three-pillar model: **Water = growth · Nitrogen = food (substrate + digest) · Phosphorus = work
  (actions + digs)**.
- **Foraging Fan → 2 W** (grow-in-every-direction is strong). **Appressorial Punch → 1 W** (appressoria
  bore through rock by turgor pressure; also a grow-through).
- Everything else from §15 unchanged (grows 1–2 W, Saprotrophic Digest 1 N, actions 1 P, Tap-Root 2 P
  install, Fruiting Vigil 2 W + 2 N, etc.).

### 16.2 Water economy scaled up (grow now consumes water every turn)
- **Condense → +3 Water**, and **5 copies seeded into the starting draw deck** (startCopies 5). The
  starting draw deck is now **5× Hyphal Extension + 5× Leaf Litter Cache + 5× Condense** — water is
  guaranteed from the deck, so the earlier soft-lock worry is resolved without a passive trickle.
- **Aquaporin Channels → +2 Water/round.**
- **Hyphal Osmosis → +9 Water** at a lake edge / **+3 Water** from soil.
- Consequently the **Water soft cap rises to ~20** (a lake tap alone gives +9); **Nitrogen and
  Phosphorus keep the ~6 soft cap**. (Per-resource caps — update `CONFIG.resources` accordingly.)
- `startResources` stays 5 W / 2 N / 2 P for turn-1 action before Condense is drawn.

### 16.3 Card wording / redesign
- **Melanized Wall** → now a **radius cure on tap** (was a network-wide passive engine; "we never pick
  strands"): *Action (once per 3 rounds, 1 P): tap a point; cure all mould infection within radius 80
  and block reinfection there for 2 rounds.* (action → P-gated, radius targeting.)
- **Rhizomorph Lance / Fruiting Vigil** reworded to "grow up to 6 steps" (Vigil keeps 2 W + 2 N).

### 16.4 Open balance question (flagged, not decided)
Grows now cost water on essentially every turn. With the scaled-up water sources this should flow, but
whether *every* grow should cost water (vs. only bigger/aimed grows, keeping the 1-step basic free) is
worth a playtest read — noted for a future round.

---

## 17. v8 — card layer IMPLEMENTED in-game (CURRENT — authoritative)

The card system is now built into the game and playable (procedural/sandbox runs; the classic
puzzle mode still uses the old action bar). Verified headless (19/19 card tests) + in-browser
(self-play reaches the goal and wins).

### 17.1 New/changed code
- **`src/cards-data.js`** — card defs generated from `docs/cards.json` (`scripts/gen-carddata.mjs`).
- **`src/engine/cards.js`** — the runtime: deck/hand/discard, W/P/N gating, `drawCard`/`skipRound`/
  `playCard`, installed-engine per-round production (`produceCardEngines`), the effect registry for all
  40 cards, and the win/lose checks (`checkGoalReached`).
- **`src/engine/network.js`** — W/P/N resource fields + growth primitives: `growDirected` (aimed/reach),
  `growRadial`, `growToNearestFood`, `digThrough` (flood-clear a rock feature + bridge in), `tips`,
  `frontierPoint`, `nearestNode`.
- **`src/engine/turn.js`** — `tickWorld` now runs `produceCardEngines` + `checkGoalReached` each tick
  (guarded on `state.cards`, so the plain sim/tests are untouched).
- **`src/config.js`** — a `cards` economy block (draw/skip cost, start buffers, soft caps, harvest
  amounts, substrate sizes, reach/step sizes, engine clamp).
- **`src/main.js` / `src/render/ui.js` / `index.html`** — the card HUD: W/P/N readout, the hand of
  cards with gate chips, Draw/Skip buttons, tap-to-target (directional/radius/pile) with an aim-line
  preview, and a card-aware win/lose overlay. The old action bar is hidden when the card layer is on.
  `window.__game` exposes `draw/skip/play/botToGoal` for console self-play.
- **`test/cards.test.js`** — economy + every effect + goal-win + card-dry death + a routed win.

### 17.2 How it plays
Start with **5× Hyphal Extension + 5× Leaf Litter Cache + 5× Condense** in the draw deck and the
tutorial hand of premium cards. **Draw** (spend ⚡) pulls a basic into hand; **play** a card (paying its
W/P/N gate) resolves its effect and advances the world one tick (threats move, engines produce,
income flows); **Skip** (spend ⚡) advances without a card. Reach the goal band on the right to win;
go card-dry with no energy and you die.

### 17.3 v8 implementation simplifications (revisit later)
- **Action-per-tick**: every draw/play/skip advances the world one step (matches the existing engine).
  A distinct multi-play "round" is deferred.
- ~~**No pile drafting yet**~~ → **DONE in v9 (§18)**: finishing a map food pile now drafts a card. The
  draw deck + draw engines + pile drafts are the card flow. (**Superseded:** the hand no longer starts
  empty — see §18.1 — but the acquisition loop is unchanged.)
- **Action-type cards are one-shot** on play (they resolve immediately and discard) rather than
  installed-with-cooldown; Tap-Root is the one repeatable "engine" that clears on a timer.
- **Defense effects are first-pass** (radius cure / snare / pile-seal); tuning pending playtests.

## 18. v9 — pile drafting + opening hand (CURRENT — authoritative)

The acquisition loop the earlier framework called for (§4 "food piles are the heartbeat") is now
wired, in a simplified free-draft form.

### 18.1 The rule
- **Start with a free opening hand of `drawCount` (3) basics dealt off the top of the draw deck**, so
  turn 1 already has cards to consider. (Deck built as 5× Hyphal Extension + 5× Leaf Litter Cache +
  5× Condense = 15, then 3 are dealt to the opening hand → 12 left in the deck.) No Energy is charged
  for this opening draw; you pay Energy to draw *more*. _(Earlier v9 dealt an EMPTY hand; changed by
  request so the game doesn't open with a bare hand.)_
- **Finishing (fully digesting) a MAP food pile drafts a card.** When a map-placed pile you have
  colonised is drained to zero, you pick **1 of 3 random cards from the tutorial set**. The card joins
  your hand **for free** — you still pay its ⚡ + W/P/N to *play* it later.
- **Only map piles count.** Piles you place yourself (Leaf Litter Cache / Humus Bed / Humic Mat)
  are not tracked and grant nothing — no farming your own substrate for cards.
- The tutorial map has **+50% food piles** (`foodClusterCount` 9 → 14) so the draft loop has room to
  breathe and the level is a touch easier.

### 18.2 Code
- **`src/engine/substrate.js`** — `sub.foodPiles = [{ cells, rewarded }]`, registered only for
  generator-placed caches (`drop`). Overlapping drops merge into one pile (one blob = one draft).
- **`src/engine/cards.js`** — `checkPileRewards(state)` (fires the draft when a colonised map pile hits
  zero), `offerPileReward` (3 random tutorial-set cards into `state.cards.pendingOffers`), `chooseOffer`
  (free add to hand). Card-dry death is suppressed while a draft is pending. `initCards` deals a free
  opening hand of `drawCount` off the top of the draw deck (§18.1).
- **`src/engine/turn.js`** — `tickWorld` runs `checkPileRewards` after engines, before the win check.
- **`src/render/ui.js` / `index.html` / `src/main.js`** — a modal draft overlay (`.offer`) showing the
  3 cards; tapping one drafts it (no world tick — it's a reward, not an action).
- **`test/cards.test.js`** — draft fires on a finished map pile; 3 tutorial-set choices; free add;
  player-placed piles grant nothing. (29/29 card tests; verified in-browser end-to-end.)

### 18.3 Draft pool odds (CURRENT — authoritative; supersedes "tutorial set" above)

Two cache types offer different pools (`engine/cards.js` `offerCardDraft` / `weightedNormalChoices`):

- **NORMAL cache** (ORANGE/route + BROWN duff food piles) → offers **Basic** or **Event**. Each of the
  **3** offered slots is an **independent weighted coin-flip: `config.cards.draftBasicWeight` = 0.6 →
  60% Basic / 40% Event**, then a distinct random card is drawn from the winning category.
- **ENGINE cache** (RED piles / engine caches) → offers **3 unique Engines** from the per-run pool
  (falls back to Basics only if every engine is already drafted).

**Critical, load-bearing detail:** the Basic-vs-Event split is that **FIXED weight — it does NOT
scale with pool size.** Adding cards to a category changes the *variety within* that category (each
specific card is diluted), **not** the 60/40 ratio. (So the grow-card family — +4 basics — did **not**
make basics show up more often; it only made each individual basic rarer among the basic slots. To
actually shift the ratio, change `draftBasicWeight`.)

Copies granted on draft: **Basic → 3** (`draftBasicCopies`), **Event → 1**, **Engine → 1** (unique,
removed from the pool). Basics/Events are **infinite** (repeatable across drafts); Engines are one-per-run.

Odds for a normal offer of 3 (Binomial(3, 0.6), pools never run dry): **0 basics 6.4% · 1 → 28.8% ·
2 → 43.2% · 3 → 21.6%**; ≥1 basic **93.6%**, ≥1 event **78.4%**; expected **1.8 basics + 1.2 events**.
Live playable pools (2026-07-20): **10 basics, 15 events, 35 engines** (`displayCategory`, minus the
`ARCHIVED` set) → a *specific* basic appears in ~18% of offers, a *specific* event in ~8%.

### 18.3 Revisit later
- Draft pool is the whole **tutorial set** (incl. the two starter basics). Once past the tutorial,
  widen to the full collection / bias by what the pile "contained".
- Free draft (no buy cost at the pile) — the earlier design charged each kept card's buy cost. Free is
  friendlier for the tutorial; revisit for difficulty.
- "Touched" = any pile cell colonised. Ants stealing an uncolonised pile grants nothing (intended).

## 19. v10 — two resources, draw 3, instant colonisation, 2-step digest (CURRENT — authoritative)

### 19.1 Two resources (Nitrogen retired)
The three-resource model (Water/Nitrogen/Phosphorus) collapses to **two**:
- **WATER** — growth **and** substrate placement (the expansion resource). Harvested by Condense /
  Hyphal Osmosis; +1 / 2 rounds from Aquaporin Channels.
- **PHOSPHORUS** — digest-burst, defense, utility, and repeatable actions (the "work"/mineral
  resource). **Harvested from rocks** (Phosphate Tap on mineral contact; +1 / round from Mineralizing
  Saprobe or Phosphatase Reserve; Metabolic Reroute converts W↔P).

Per-card reassignment of the old Nitrogen cost (my call): substrate (Leaf Litter Cache / Humus Bed /
Humic Mat) → **Water**; Saprotrophic Digest, Fruiting Vigil → **Phosphorus**; N production/gains
(Mineralizing Saprobe, Constricting Ring) → **Phosphorus**. Config: `startWater 7`, `startPhosphorus 3`,
`softCapWater 999`, `softCapPhosphorus 999` (no more `*Nitrogen`). **Caps raised from 20/10 → 999** so
harvest/income always pays off and you can bank for big plays (see §20.4).

### 19.2 Draw 3
`Draw` now pulls **`cards.drawCount` (=3)** cards at once for **`drawCostEnergy` (=16)** (was 1 for 8).
Deck-underflow safe (pulls what's left). `drawDiscount` (Septal Pore Flux) still applies to the lump.

### 19.3 Instant colonisation + 2-step digest
- **Entry burst** (`substrate.entryBurst = 9`): the FIRST time a strand enters a food pocket,
  `_colonizeStep` sprays a burst that fans across the cell (and into food neighbours) and jumps
  `cell.colonized` straight to **1** — the pocket reads as fully colonised at once.
- **2-step digest** (`energy.passiveIncomeRate 34 → 25`, `foodCellNutrient` stays 50): a fully
  colonised cell (colonized = 1) drains `min(nutrient, 25)` per tick → 50 → 25 → 0 in exactly two steps.

### 19.4 Code / data
- Data: `docs/cards.json` (nitrogen retired) → `scripts/gen-carddata.mjs` (emits `costW`/`costP`, folds
  any legacy N into P) → `src/cards-data.js`.
- Runtime: `src/engine/cards.js` (init/gate/play/engines/effects, multi-draw), `src/engine/network.js`
  (`water`/`phosphorus` only; entry-burst colonise), `src/config.js`, `src/render/ui.js` (HUD = W/P,
  hand + draft chips, "Draw 3" label), `src/main.js`.
- Tests: 29/29 card + 86/86 smoke; in-browser verified (draw 3, W/P HUD, dense colonise, 50→25→0,
  self-play win in 31 steps / 139 nodes).

### 19.5 Revisit later
- **Phosphatase Reserve now duplicates Mineralizing Saprobe** (both +1 P/round). Only Mineralizing is
  in the tutorial draft pool, so the dup is invisible for now — differentiate or cut when the pool widens.
- Balance: Water now carries grow **and** substrate; Phosphorus is rock-gated. Watch early-game Water
  pressure and whether P is reachable before the first rock contact; tune start buffers / harvest if needed.

---

## 20. Grow-card mechanic tuning (CURRENT — authoritative for these cards)

Behaviour clarifications/fixes for the grow + dig + harvest cards. Runtime lives in
`src/engine/network.js` (sim primitives) and `src/engine/cards.js` (effects). All verified
headlessly + in-browser. Growth convention throughout: **1 "step" ≈ 3 cells** (`segmentLength` 17,
`cellSize` 36); Apical Drive 2 steps, Tropic Lunge 5 steps, Rhizomorph Lance / Fruiting Vigil 6 steps,
Foraging Fan 1 step (= `foragingFanCells` 3 rings). Hard size cap `growth.maxNodes = 6000`; all grow
cards report "The colony has reached its maximum size." at the cap.

### 20.1 Foraging Fan (`growRadial` / `_fanRing`)
- **Radial burst, no food needed** — every frontier tip sprouts `foragingFanRays` (8) hyphae around the
  circle, grown as `foragingFanCells` (3) successive rings; min-spacing (`minTipSpacing`) drops candidates
  that fall back over the colony so the frontier expands outward.
- **Partial growth always succeeds** — tips with open ground fan out even if rock walls off other tips.
  Only when *no* tip anywhere can advance does it fail, naming the reason: at-cap / walled-in by rock /
  packed too tightly.
- **Fair distribution** — `_fanRing` **shuffles the tips and fans ray-by-ray** (one ray per tip per pass),
  so the burst spreads across the *whole* frontier. (Old bug: it iterated tips in node-array order and did
  all of a tip's rays before moving on, so near the cap the older/denser near-side ate the node budget and
  the far frontier grew nothing.)

### 20.2 Tropic Lunge (`growToNearestFood`)
- Lunges `lungeSegments` (15) toward the nearest food, from the tip nearest that food, **regardless of
  sensing range**.
- Targets only **unreached** food — food cells with `colonized > 0` are excluded (they keep nutrient while
  it drains), so the lunge strikes out toward fresh food instead of doubling back onto the pile it holds.
- Considers **all (tip, food) pairs** ordered by distance and lunges from the closest that can actually
  make progress (reaches the food, or has a full clear runway). A walled nearest pile falls through to the
  next-closest approach — a different tip **or** a different pile — before failing. Distinct messages for
  "blocked by rock" vs "every food pile already reached".

### 20.3 Appressorial Punch (`punchThrough`)
- Bores through **any rock** — loose boulders, big formations, and path-blocking columns all read as
  "rock" and clear the same way (lakes/water excluded).
- **Overlay, not removal** — the rock stays drawn; the strand threads *over* it. Cells on the strand's
  path get a `bored` flag (passable but still `rock`); `_placeOk` treats bored cells as open ground. No
  render-cache invalidation needed since nothing is removed.
- **Aims in the chosen direction** — the channel runs from the colony toward the **clicked point**, and
  stops at the clicked feature's far edge **along that ray** (was aiming at the centroid + boring the whole
  feature, which dragged the strand down a long column's length). Range-gated to the colony's sensing
  reach. Food sitting right on the far side is claimed by the normal colonisation pass.

### 20.4 Resource harvest / income never drops a pool
- `gain(cur, amt, cap) = max(cur, min(cap, cur+amt))` in `cards.js` — adds up to the soft cap but **never
  reduces** a pool already above it. Used by Condense, Hyphal Osmosis, Phosphate Tap, Constricting Ring,
  and per-round engine income. (Old bug: `min(cap, cur+amt)` slashed Water/P down to the cap.)
- Soft caps raised to **999** (§19.1) so harvest keeps paying off; harvest cards report the actual gain and
  refuse ("… is already full") at the cap so the card isn't wasted.

---

## 21. Design direction — routes to victory, species, meta-progression, run structure (VISION, not built yet)

_Captured from a planning note. This is the intended shape of the full game; NONE of it is implemented yet.
Record refinements here. **Sequencing:** finish polishing what exists first — more UI design + bug testing on
the CURRENT content (current cards, enemy/ant/mould behavior, the engine-display HUD) — THEN build out more
cards toward the vision below._

### 21.1 Core pillar: many engines, a route chosen at draft (the Terraforming Mars decision)
The defining decision TM gives you: **at the start of a game, based on the cards you happen to draft, you
commit to a strategy** — usually ~2 point-generating focuses plus 2–3 resource-generating things that feed
them (cities/greenery, heat, microbe combos, energy→points, money, ore, titanium, …). We want the SAME
opening decision. There must be **many distinct ENGINES, each a viable route to the map's end point** (our
victory-point equivalent = reaching/completing the map goal), and the player decides **what to focus on
this run based on the initial draft**. Today there is essentially one route (grow → goal); the work is to
add several parallel engine archetypes so the draft is a real strategic fork, not a fixed path.

### 21.2 CCG meta-progression (player influence over the draft)
It's a collectible card game, so give the player some agency over the fork: **after every run, keep ONE
card**; at the next run's initial draft, you may **bring that one kept card with you**. (A small, TM-does-
not-have-this lever that lets a player steer toward a favored route across runs.)

### 21.3 Run structure & modes
- **Modes:** ship **Survival first**; **Campaign** and **online 1v1** later.
- **Species = corporations.** Each run you pick a **mushroom species** (the TM "corp" analogue) that grants
  **small starting bonuses** for that run. Then the draft happens.
- **Escalating maps:** you travel map → map, each **harder than the last (more enemies each round/map)**.
- **Ants = food-supply modifier:** the more colonies present on a map, the **less food** there is (ants
  compete for / drain the shared supply). Ties enemy pressure to the resource economy.
- **Between-map card retention:** you **keep the ENGINE cards you played** on each map, but only **X** of the
  other cards. (Open option: keep the **unused cards left in hand + X** of the rest.) Tunable X; the intent
  is that your persistent power is the engine you built, with limited carryover of one-shots.

### 21.4 Open questions / to resolve when we get here
- What are the concrete engine archetypes (our cities/heat/microbes analogues) and how does each "score" the
  map? Needs a list of 5+ routes with distinct resource + payoff loops.
- Exact retention rule (engines + X others vs unused-hand + X) and the value of X.
- How the one kept card interacts with species bonuses and the draft pool.
- Scoring model per map (binary goal-reached vs a points total that rewards over-building).

---

## 22. Installed ACTIONS — the top-right menu (CURRENT — authoritative for these cards)

Implements §5's `action` type as a persistent ability and supersedes the older per-card
text for the four action cards. Runtime map lives in CHECKPOINT §4.

**Model.** When played, an `action`-type card **installs** into the top-right Actions
menu (`state.cards.actions[]`) rather than firing once. Each install carries its gating:
a **cooldown** (`every N` rounds), a **per-activation resource cost**, a **uses/round**
cap, and/or **targeting** (tap a map point). A world tick (draw/skip/play) resets uses
and ages cooldowns. **Install cost = the card's buy Energy only**; any W/P on the card is
the *per-activation* price, not an install gate (so action cards aren't W/P-gated to play,
aren't greyed for W/P in hand, and don't show a W/P pip on the face). Duplicate installs
are blocked. `engine`-type cards still install to the left ledger; `event`/`basic`/
`extender` stay one-shot.

**The four action cards (current, shortened text):**

| Card | Cooldown | Activation cost | Effect |
| --- | --- | --- | --- |
| **Constricting Ring** | every 6 | free | Tap empty ground → lay a **trap**; the first nematode to enter its radius is digested for **+2 P** (resolved in the sim, swept-path). |
| **Sinker Rhizomorph** | every 5 | **2 P** | Tap an in-range rock → **bore through it** (was an auto dig-engine; now a player-triggered action, type engine→action). |
| **Sclerotial Seal** | every 4 | **1 P** | Tap a food pile → **ant-proof** it for 3 rounds. |
| **Melanized Wall** | every 3 | free | Tap a point → **clear all mould infection** in radius 80 **and ward** those cells against reinfection for **2 full rounds** (`cell.mouldProof`). |

Note: this diverges from §15.1's earlier "every action activation = 1 P" line — only
Tap-Root (2 P) and Sclerotial Seal (1 P) charge per use now; Constricting Ring and Suberin
Wall are free to activate (their card text has no "Pay"). The card **face** text and the
Actions-menu row label are the source of truth for each card's gating.

---

## 23. v11 — `buyCostPhosphorus` install gate + rebalancing pass (CURRENT — authoritative for costs)

Per-card costs now live in `docs/cards.json` (regen → build); this section records the
**model change** and the intent behind the tuning. Numbers below are the *what changed*, not
the running total — treat `cards.json` (and the card editor at `docs/card-editor.html`) as
the live cost sheet.

**New cost dimension — `buyCostPhosphorus` (→ `buyP` in `CARD_DATA`).** Supersedes §22's
"install cost = the card's buy Energy only." A card can now gate its **install** on Phosphorus
too, charged for **any** card type alongside `buyCostEnergy`:

- The point is installed **actions**. Their play-W/P is a *per-activation* price, not an
  install gate (§22), so before this there was no way to make an action "cost P to acquire."
  `buyP` is that acquisition gate.
- Wiring: `cardBlockedReason` blocks (`Not enough Phosphorus (need N)`); `playCard` charges
  `net.phosphorus -= c.buyP` for all types; `ui.js gateChips` draws a P pip on **every** face
  (right after the buy-⚡ pip — unlike play-W/P, which stays off action faces). The card editor
  has a **Buy P** field + face pip.
- Install-P set on: **Leading Cord 3 · Forager Bloom 1 · Crust Reserve 3 · Colonizing Front 1 ·
  Acorn Fall 1 · Sclerotial Seal 1 · Melanized Wall 2 · Sclerotial Rind 2 · Toxocyst Array 3 ·
  Constricting Ring 4** (added later — see below).

**Constricting Ring** — **3 P per activation** AND **4 P to install** (`buyCostPhosphorus:4`, added
after the initial pass; supersedes §22 table's "free"). The per-activation 3 P was expressed as
`playCostPhosphorus 0→3` on an installed action → read as a per-use cost (the `action` spec's
`cost/res`); the 4 P install is the separate `buyP` acquisition gate.

**Mechanic changes.**
- **Acorn Cache** — placement is now **drag-aim (`directional`)** like grow cards (aim a
  direction; the cache lands at the sensing edge in that direction) rather than a single tap.
  Still a fixed **2⚡** nut cache (`config.cards.acornCacheEnergy`). Text uses the ⚡ glyph.
- **Constricting Snap** — text/message dropped "throttled and" → "…digested for +3 P".
- **Toxocyst Burst** — Phosphorus income **caps at 10** (`gain = Math.min(n, 10)`) while still
  killing **every** nematode in radius; text "…digested (+1 P each, **max 10 P**)."

**Water-engine tier — all three fire every 6 rounds** (was 2/3/6): **Aquaporin Channels** +1
Water/6 (20⚡ · 6P play), **Dew Traps** +2 Water/6 (25⚡ · 12P play), **Capillary Runners** +3
Water/6 (30⚡ · 16P play). A clean +1/+2/+3-per-6 ladder at escalating cost.

**Cost retune (~30 cards).** Broad E/P buy & play retuning across the set — engines and
utilities made pricier, a few softened (Cordyceps Bloom 14→7⚡, Cord Capillary 6→4⚡). Not
reproduced card-by-card here — see `cards.json` / the card editor. Tests in `test/cards.test.js`
assert the new numbers for Rhizomorph Trunkline (6P play), Aquaporin (+1/6 rounds, 6P play),
Osmotic Cashout (5P play), and Toxocyst Array (3P buy-in).

---

## 24. Grow-card family expansion + tempo rebalance (CURRENT — authoritative for these cards)

Owner batch. Rhizomorph Lance (grow 6 for a flat 2 W) had become the auto-take grow, so this pass
(a) buffs the cheap/free grows so they stay relevant, (b) nerfs Rhizomorph Lance a notch, and (c) adds
a **paid directional aimed-grow family** — a spread of one-shot BASICs and installed ENGINEs at
different reach/cost mixes so the grow you take flexes with the resources you hold. All directional grows
here are **press-and-drag aimed** (R8: player-aimed, never goal-pathing). Growth convention unchanged:
**1 step = 3 segments** (`segmentLength` 17). Runtime helpers `aimedGrow` / `aimedGrowAction` in
`engine/cards.js` (a shared `aimedGrowCore(state, ctx)` adapts to both the card-effect and installed-action
call shapes); segment counts come from `config.cards`.

### 24.1 Buffs to the existing grows
- **Apical Drive 2 → 3 steps** and **Leading Cord 2 → 3** — both read `config.cards.directionalSteps`,
  raised **6 → 9**.
- **Hyphal Extension 1 → 2 steps** and **Colonizing Front 1 → 2** — the food-seek effects now run
  `config.cards.foodSeekSteps` (= **2**) `grow()` passes; the 2nd pass advances the front, then senses the
  next food (it no-ops once all sensed food is reached).
- **Rhizomorph Lance → 2⚡ + 2 W** (`buyCostEnergy` 1 → 2; play Water stays 2) — still the cheap 6-step
  event, just no longer strictly the best grow in the deck.

### 24.2 Four new BASIC directional grows (one-shot, played from hand)
`type:basic` (drafts from the infinite basic pool, 3 copies). ⚡ = `buyCostEnergy`, W = `playCostWater`,
P = `playCostPhosphorus`.

| Card | Steps | ⚡ | W | P | Feel (`straight`) | Mycology |
| --- | --- | --- | --- | --- | --- | --- |
| **Guerrilla Runners** | 5 | 1 | 1 | 1 | exploratory (false) | guerrilla foraging growth form — fast, sparse runner hyphae |
| **Turgor Thrust** | 4 | 2 | 1 | 0 | committed (true) | turgor / hydrostatic pressure ramming the tip forward (W route) |
| **Vesicle Surge** | 4 | 3 | 0 | 1 | committed (true) | Spitzenkörper flooding the apex with wall-building vesicles (P route) |
| **Translocation Cord** | 5 | 2 | 0 | 2 | committed (true) | bulk cytoplasmic translocation down a differentiated cord (P route) |

Reach: grow-4 = `grow4Segments` (12), grow-5 = `grow5Segments` (15). The two 5-step / two 4-step cards are a
**Water-route vs Phosphorus-route pair** so one is always playable when the other resource is dry.

### 24.3 Five new grow ENGINES (installed actions — "every 6 rounds: pay ⟨res⟩, drag-aim, grow N steps")
`type:action`, `displayCategory:engine` (unique, drafts from RED engine caches). Install = `buyCostEnergy`
(⚡) + `buyCostPhosphorus` (P); the per-use cost is the `action` spec `cost`/`res` (so the play-W/P pip is
hidden on the face, per §22).

| Card | Steps | Install ⚡ + P | Per-use | Twin of |
| --- | --- | --- | --- | --- |
| **Turgor Line** | 4 | 13⚡ + 3P | 1 W | Turgor Thrust |
| **Vesicle Supply Line** | 4 | 10⚡ + 3P | 1 P | Vesicle Surge |
| **Explorer Cord** | 5 | 17⚡ + 3P | 1 W | Guerrilla Runners |
| **Bulk-Flow Cord** | 5 | 14⚡ + 4P | 1 P | Translocation Cord |
| **Rhizomorph Cable** | 6 | 20⚡ + 4P | 2 W | Rhizomorph Lance |

**Balance ladder** (in line with the existing grow engines — Leading Cord grow-3 = 9⚡+3P/1W, Colonizing
Front 7⚡+1P/1W, Forager Bloom 4⚡+1P/1W): the **Water-route install ladder is a consistent +4⚡/step** —
Leading Cord 9 (g3) → Turgor Line 13 (g4) → Explorer Cord 17 (g5) → Rhizomorph Cable 20 (g6, +double
per-use water). Each same-reach W/P pair is **non-dominated**: the Water twin installs pricier but each use
spends plentiful Water; the Phosphorus twin installs cheaper (lower ⚡) but each use spends scarce Phosphorus.
(An earlier Explorer Cord at 15⚡ inverted the ladder and squeezed Turgor Line out of a niche — an adversarial
review workflow caught it; fixed to 17⚡.)

### 24.4 Config / data
- `config.cards`: `directionalSteps` 6→**9**, new `grow4Segments` **12** / `grow5Segments` **15**, new
  `foodSeekSteps` **2**. grow-6 reuses `reachSegments` (18).
- All nine cards live in `docs/cards.json` → `src/cards-data.js` (regen) → `dist/` (build). Effects:
  `aimedGrow`/`aimedGrowAction` for the directional set; the food-seek buff loops `grow()` `foodSeekSteps`×.
- **Art:** FLUX 1.1 Pro (`scripts/gen_grow_cards.py`), 3 options/card → `assets/card_options/`, winners →
  `assets/cards/<slug>.jpg`. Brief: **mycelium, not mushrooms** — fine pointed / thread-like hyphal tips, no caps.

## 25. Decoy Cache — tactical lure event (CURRENT — authoritative for this card)
- **New EVENT: "Decoy Cache"** (70th card). **Tap any spot within the colony's sensing range** (line of
  sight) to drop a small nut cache worth **exactly 1⚡** total. Cost **2 Energy** (`buyCostEnergy`), no W/P.
- **Purpose = control, not economy.** Placed food redirects ant harvest targets and draws nematodes, so it
  pulls threats OFF the colony or bunches them (e.g. onto a Constricting Ring trap). The 1⚡ payout barely
  covers its own cost if YOU harvest it — the value is the lure.
- **Impl:** `EFFECTS['Decoy Cache'] = targeted(...)` in `engine/cards.js` — validates the tap is within
  `growth.sensingRadius` of the nearest node, snaps to the nearest open soil, `sub.deposit(x,y,substrateSmall,1,1)`.
  Rejects out-of-sight / no-soil taps (no cost, card kept). Auto-joins the event draft pool (1 copy/draft).
- **Art:** none yet — the card face falls back to no image (frame + name + cost + effect). Generate via the
  documented FLUX flow (`assets/cards/decoy-cache.jpg`) when the Replicate token is available.
