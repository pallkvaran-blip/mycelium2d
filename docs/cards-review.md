# Card Review Ledger

Rolling per-card verdicts from playtest review. Verdicts feed the revision pass; the cross-cutting
design rules they established live in `cards-design.md` §10 (R1–R12).

> Most comments are **principles that generalize beyond the named card** — see the ruling refs.

## Round 1 — 21 rated (👍 14 / 👎 7)

### 👍 LIKE
| Card | Note | Ruling |
|---|---|---|
| Hyphal Extension | keep | — |
| Leaf Litter Cache | want various patch sizes | R3 |
| Saprotrophic Digest | digest hits all occupied substrate | R4 |
| Appressorial Punch | simplify: unplayable w/o rock; clear a whole rock toward goal | R6 |
| Brown-Rot Mat | too cheap / OP — re-cost | R12 |
| Cellulase Bloom | digest starts at 1; boosts are +x flat, not % | R5 |
| Septal Pore Flux | drop the "no-stack" clause | R11 |
| Oxalate Exudate Network | keep | — |
| Hydraulic Boring | clear whole rock, no distance count | R6 |
| Rehydration Pulse | radius-based, not per-strand | R7 |
| Saprotrophic Lattice | keep | — |
| Septal Reinforcement | keep | — |
| Sclerotial Vault | keep | — |
| Anastomosis Salvage | keep | — |

### 👎 PASS
| Card | Reason | Ruling |
|---|---|---|
| Chemotropic Probe | "toward the goal" growth is fiddly / pathing | R8 |
| Septal Plug | node targeting too hard on phone | R7 |
| Anastomosis | strand targeting too hard on phone | R7 |
| Cord Surge | — | — |
| Anastomosis Network | making skip cheaper isn't interesting | R10 |
| Turgor Thrust | — | — |
| Monsoon Bloom | global "clear all rot" too strong → radius | R9 |

### New card ideas raised
- Grow 1 in every direction, no substrate needed.
- Grow 3 toward the nearest substrate, even if out of range.
- A family of sensing-distance / growth-mechanic manipulator cards.
- Substrate cards across a range of patch sizes (small → large).

## v3 consolidation (between review rounds)

After the v2 set (164) the human asked to *"consolidate redundance only — no forced number — and add the
ant stuff."* Result: **134 cards** (31 cut, 1 added). Full log in `cards-design.md` §12. Highlights:
- Cut 31 genuine duplicates / dominated cards / over-served-cluster members (the whole `gapfill` family
  was refolded into real lanes; duplicate grow basics, digs, mould-cleanses, converters, W/P engine glut,
  and energy-burst auto-includes removed).
- Re-costed the burst auto-includes the human flagged: Autophagic Sprint +24→+16, Shade-or-Sun SUN
  +28→+18; made Saprophytic Reclaim radius-based (R9).
- **Ant lane** rounded out to 8 cards incl. the **NEW Fungus-Garden Mat** — the unconditional anti-ant
  defensive engine (parallel to Nematophagous Mat) the lane was missing.

## Round 2 — 28 rated (👍 27 / 👎 1) on the v3 set

Verdicts kept; comment text intentionally **not** retained here. Per the human: most round-2 comments
on LIKED cards were **repeats of round-1 rulings already fixed** (substrate dropped at sensing-edge /
direction-only; Digest hits all occupied substrate; Appressorial Punch = unplayable-without-rock,
clears one whole rock toward goal; Hydraulic Boring = whole-rock no distance count; Rehydration Pulse
= radius not strand; Cellulase/digest = flat +1 not %; Septal Pore Flux no-stack clause dropped). These
were **not re-applied** (they were already done) to avoid churn/confusion.

**👍 LIKE (27):** Hyphal Extension · Apical Drive · Foraging Fan · Tropic Lunge · Leaf Litter Cache ·
Humus Bed · Mycorrhizal Mat · Saprotrophic Digest · Appressorial Punch · Sclerotial Crust · Brown-Rot
Mat · Septal Pore Flux · Oxalate Exudate Network · Cellulase Bloom · Hyphal Imbibition · Hydraulic
Boring · Rehydration Pulse · Mineralize · Phosphate Tap · Saprotrophic Lattice · Septal Reinforcement ·
Sclerotial Vault · Constricting Ring · Anastomosis Salvage · Trophallaxis Hijack · Condense · Ammonify.

**👎 PASS (1):** Monsoon Bloom — "clear all rot too powerful, maybe a radius." → radius cut 160 → 110.

### New round-2 actions taken (→ v4)
- **"Over-explained"** (Apical Drive, Foraging Fan, Phosphate Tap, Mineralize, Condense, Ammonify, and
  deck-wide): tightened all `effect` text to 1–2 concise sentences, mechanics preserved (fidelity-verified).
- **Spores removed** from the whole game (designer directive) — see `cards-design.md` §13.
- **Variable buy costs** (TM-style) replace the flat-14 rule (designer directive) — §13.

## Round 3 — 16 rated (👍 14 / 👎 2) → triggered the CORE-SET cut (v5, 39 cards)

Verdicts kept; comment text not retained (see `cards-design.md` §14 for the full v5 write-up).
- **👍 (14):** all approved basics, kept with the human's shorter descriptions (Hyphal Extension,
  Apical Drive, Foraging Fan, Tropic Lunge, Leaf Litter Cache, Humus Bed, Mycorrhizal Mat,
  Saprotrophic Digest, Appressorial Punch, Sclerotial Crust, Hyphal Imbibition, Phosphate Tap,
  Constricting Ring, Condense).
- **👎 (2):** Mineralize (felt like an engine, not a basic) & Ammonify (unclear harvest source) — removed.

### Directives acted on (→ v5 core set)
- **Removed `rarity`** designations everywhere.
- **Basics model:** start with 5× Hyphal Extension + 5× Leaf Litter Cache; every other basic enters
  via a **draw engine** card ("Shuffle 5 copies of X…"). Constricting Ring → **action**.
- **Weeded 124 → 39** — one card per core type (stronger cards + variations to come later).
- **Rebalanced costs** (cap ~40; core sits 0/6–22).
- Added a **tutorial set** (suggested starting hand, filterable in the tool).

## Round 4 — 39/39 rated (👍 36 / 👎 3) → v6 resource gating + 3 fixes

Verdicts kept; comment text not retained (full write-up in `cards-design.md` §15).
- **👍 (36):** the whole core set approved; the human's shorter descriptions applied verbatim
  (Tropic Lunge, Saprotrophic Digest, Appressorial Punch, Hyphal Imbibition +3 W, Septal Pore Flux,
  Tap-Root "every 5 rounds", Constricting Ring "once/6 + tap where no worm in range", Fruiting Vigil
  "extend 6").
- **👎 (3):** Fungus-Garden Mat (ants don't touch the network — no effect), Melanized Sheath
  ("3 nearest strands" untargetable), Foxfire Glow (map already fully visible).

### Big directive: resources were easy to make but gated nothing → now they gate the core loops
- **Water → grow · Nitrogen → digest · Phosphorus → repeatable actions.** Many cards now carry small
  W/P/N play-costs, so producing W/P/N is finally necessary. `startResources 5 W / 2 N / 2 P`;
  soft-lock safeguards proposed (§15.2). Buy costs rebalanced down for gated cards.
- **Fixes:** Fungus-Garden Mat → **Sclerotial Seal** (seal a food pile vs ants); Melanized Sheath →
  **Suberin Wall** (network-wide mould cure/block); Foxfire Glow removed.

→ Awaiting **review round 5** on the v6 set (38 cards). Watch-item to sanity-check: does *grow costs
water* feel right in play, and is the no-water-in-starting-deck soft-lock risk acceptable (§15.2)?
