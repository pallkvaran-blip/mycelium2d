# Mycelium — Card System Design

Source of truth for the card layer. Card data lives in `docs/cards.csv` (spreadsheet-editable)
and `docs/cards.json` (implementation-ready). This doc is the rules + balance framework + the
open issues to resolve before implementation.

> Status: **IMPLEMENTED (v8)** — **40 cards** (added draw engines for the two starters). The card layer
> is now BUILT INTO THE GAME (`src/engine/cards.js`) and playable: deck/hand/W-P-N, draw/skip/play,
> per-round engines, reach-the-goal win. Resources gate the core loops (grow=Water, digest=Nitrogen,
> action=Phosphorus) + substrate=Nitrogen. No `rarity`; variable buy costs (cap ~40).
> CURRENT rules: §10 → §11 → §12–16 (history) → **§17 (v8 implementation — authoritative)**.

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
   (Phosphatase Cushion, Apatite Hyphae, Apatite Detonation, Boring Front)
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
- **Frictionless ramp engines are auto-includes** (Aquaporin Channels, Phosphatase Cushion, Cord
  Formation, Saprotrophic Mat). Give each a real opportunity cost: install-time W/P/N gate
  (route-to-feature-first, reinforces the spatial theme) or a ramp-down (early-only identity).
- Over-costed near-duds to buff/re-tier: Fruiting Primordium, Sclerotial Bunker, Protein Synthesis
  Cascade (un-castable in N-light runs). Under-costed: Septal Reinforcement, Shade-or-Sun Cap.
- Conditional cards that can be 100% blank need a guaranteed floor: Hyphal Imbibition, Turgor Pulse,
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
  Phosphatase Cushion; durable uncond P faucet is Mineral Foraging Hyphae), **Mycorrhizal Bridge**
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
  generic W↔P↔N converter; kept **Nutrient Transmutation**).
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
  draw-discount than Septal Pore Flux) dropped to **6**; Phosphatase Cushion re-priced to **8** to match
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
  Fan), grow-reach (Tropic Lunge), substrate S/M/L (Leaf Litter Cache / Humus Bed / Mycorrhizal Mat),
  digest (Saprotrophic Digest), boulder-dig (Appressorial Punch), protect (Sclerotial Crust), water
  harvest (Hyphal Imbibition), phosphorus harvest (Phosphate Tap), water floor (Condense).
- **Draw engines (11):** one per non-starting basic (Leading Cord, Forager Bloom, Questing Front,
  Humus Cache, Symbiont Weave, Enzyme Priming, Boring Corps, Crust Reserve, Capillary Runners,
  Prospecting Cords, Dew Traps).
- **Energy (3):** income engine (Rhizomorph Trunkline +4/rd), burst (Osmotic Cashout), draw-discount
  (Septal Pore Flux).
- **Resource production (3):** Aquaporin Channels (W), Phosphatase Cushion (P), Mineralizing Saprobe (N).
- **Dig (1):** Tap-Root Rhizomorph (formation/column, P-gated).
- **Defense (3):** anti-ant engine (Fungus-Garden Mat), anti-mould engine (Melanized Sheath),
  anti-worm action (Constricting Ring).
- **Utility (5):** radius heal (Rehydration Pulse), converter (Nutrient Transmutation), reach
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
  placement** (Leaf Litter / Humus Bed / Mycorrhizal Mat) is NOT growth and stays free.
- **NITROGEN → DIGESTION**. Saprotrophic Digest = **1 N** (enzymes need N).
- **PHOSPHORUS → repeatable ACTIONS** (ATP). Every activation of an action-type card = **1 P**
  (Constricting Ring, Sclerotial Seal). Tap-Root Rhizomorph pays **2 P at install** (engine).
  The resource **converter** (Nutrient Transmutation) is exempt (it's the relief valve) and
  resource-*producing* engines are never P-gated.
- Other cards keep sensible thematic gates (Osmotic Cashout 1 W = water→energy; Rehydration Pulse 1 W;
  Fruiting Vigil 2 W + 2 N).

### 15.2 Anti-soft-lock economy (proposed — confirm)
The starting draw deck stays strictly **5× Hyphal Extension + 5× Leaf Litter Cache** (per the designer),
so it has no built-in water source — yet grow now costs water. Safeguards so a run can't dead-end:
- **`startResources = { water: 5, nitrogen: 2, phosphorus: 2 }`** — lets you grow from turn 1 and pay
  Fruiting Vigil's 2 N from the buffer alone.
- Early water is reachable: **Aquaporin Channels** (+1 W/round, in the tutorial hand), **Condense** /
  **Hyphal Imbibition** (via draw engines), and **lake taps**.
- ~~Proposed baseline +1 W/2 rounds safety net~~ → **RESOLVED in v7 (§16):** the designer instead seeds
  **5× Condense (+3 W each)** into the starting draw deck, so water is guaranteed from the deck itself.
Soft cap ~6 per resource. Every W/P/N-gated card must remain recoverable from a zero stock (no gate is
ever a permanent dead end).

### 15.3 Three review-failed cards fixed
- **Fungus-Garden Mat** removed (ants steal from *piles*, not your network) → replaced by **Sclerotial
  Seal** (action, 1 P, once/3 rounds): *tap a food pile; ants can't harvest it for 3 rounds* — protects
  what ants actually attack.
- **Melanized Sheath** removed ("3 nearest strands" was untargetable) → replaced by **Suberin Wall**
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
- **Hyphal Imbibition → +9 Water** at a lake edge / **+3 Water** from soil.
- Consequently the **Water soft cap rises to ~20** (a lake tap alone gives +9); **Nitrogen and
  Phosphorus keep the ~6 soft cap**. (Per-resource caps — update `CONFIG.resources` accordingly.)
- `startResources` stays 5 W / 2 N / 2 P for turn-1 action before Condense is drawn.

### 16.3 Card wording / redesign
- **Suberin Wall** → now a **radius cure on tap** (was a network-wide passive engine; "we never pick
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
- **No pile drafting yet**: the premium hand is the tutorial set; buying new cards at food piles (the
  pile → energy + draft) is not wired — the draw deck + draw engines are the card flow for now.
- **Action-type cards are one-shot** on play (they resolve immediately and discard) rather than
  installed-with-cooldown; Tap-Root is the one repeatable "engine" that clears on a timer.
- **Defense effects are first-pass** (radius cure / snare / pile-seal); tuning pending playtests.
