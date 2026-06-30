# Mycelium — Card System Design

Source of truth for the card layer. Card data lives in `docs/cards.csv` (spreadsheet-editable)
and `docs/cards.json` (implementation-ready). This doc is the rules + balance framework + the
open issues to resolve before implementation.

> Status: **design draft v1** — ~119 cards generated and adversarially reviewed; NOT yet
> balanced-final and NOT implemented. See "Known issues to fix" before coding anything.

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
  K leaves → see N cards → keep M, paying a **flat energy cost per card kept**. Ants race you for
  piles; partial harvest = partial payout. (Piles reuse the existing sparse food-cluster system.)
- **Flat buy cost per card** (by rarity tier; never scales with quantity). The decision is timing,
  not cost-scaling.
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
2. **Flat buy cost:** depends only on rarity tier; never scales with quantity/hand size/count.
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
  (bounded energy / a resource / growth / defense / spores). Has a repay clock.
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
6. **Spore Payoff / Score Max** — reach the goal then bank spores each round for max fruiting yield.
   (Stipe Buttress, Hymenial Surge Bed, Synchronous Flush)
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
- **Spore valuation:** what is 1 spore worth (energy-equiv + run score)? Needed to lint spore
  engines' repay. And — does fruiting yield *do* anything mechanically (meta progression / score)?
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
- **R2 — Flat buy cost (PENDING CONFIRM).** Every premium card costs the SAME flat energy to buy
  at a pile (Terraforming-Mars style). Power is balanced by the resource (W/P/N) play-gate + effect
  strength + timing — not by buy cost. Basics stay free deck-floor. If confirmed, this replaces the
  §3 buy-cost tiers.
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

**Locked economy**
- **Flat buy cost = 14 energy for EVERY premium card** (engine/action/event/extender), basics = 0.
  Power lives in the W/P/N play-gate + effect + timing, never in buy cost. (TM-style.)
- `CONFIG.economy = { startEnergy:110, energyCarryCap:160, drawCostEnergy:8, skipCostEnergy:12, buyCostFlat:14, basicBuyCost:0 }`.
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

**Residual watch-items for the next review round**
- **Burst-energy auto-includes**: with flat-14 buy, several un-gated bursts are strict +ROI in one play
  (Sclerotial Cache +18, Autophagic Sprint +24, Autolytic Cash-Out +30, Shade-or-Sun SUN +28). Stiffen
  their gates/downsides or they violate "no auto-includes".
- **Ant lane is thin** — add an unconditional anti-ant defensive ENGINE (parallel to Nematophagous Mat).
- A few unconditional no-gate engines (Trickle Mat, Aquifer Tap, Apatite Vein Engine…) may dominate the
  conditional/threat engines that idle on quiet maps — give conditional engines a small guaranteed floor.
- **Saprophytic Reclaim** (whole-network rot clear + 3N) is the most generous R9 edge case → make it radius.
- **Count: 164 is high** (gap-fill bloat in the `gapfill` family) — consolidate near-duplicates to ~110–120.
