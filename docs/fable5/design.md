# Mycelium — Fable-5 Card Collection · Design Doc

119 unique single-copy cards. Designed fresh from the brief against the actual
Phase-1 engine (`src/config.js`, `src/engine/*`), not against the other set.
The final numbers below reflect a multi-agent adversarial review pass (5 review
dimensions × per-finding verification) that killed 16 confirmed
dominated/inverted/gap cases — see §6.

---

## 1. The framework

**One currency, three sinks.** Energy is the only thing you spend, and only on
**draw**, **buy**, or **skip**. You never pay to play. That makes every card's
`buyCostEnergy` the whole economic decision at a draft, and it makes the *draw
deck itself the clock*: energy leaves your pool every time you dig for a basic,
and the graveyard never reshuffles. You die when you run dry of both cards and
energy. So the collection is tuned around three pressures the engine already
creates:

1. **The depletion clock** — no free reshuffle. Extenders are the only way to
   put cards back, they add *new* basics, and they aren't recycled. Runway is
   finite and must be bought.
2. **The contested economy** — piles are sparse (`foodClusterCount: 9`) and ants
   race you to them. Passive income only flows from *colonised* cells, and
   Digest drains 50%/cell/use. So tempo (get there, colonise, cash out before
   the ants or the clock) is the real game.
3. **Emergent difficulty** — maps are procedural, threats are seeded by
   distance, draws vary. We never hand-author a spike; we hand cards that are
   good in *some* situations and let the map decide which.

**Terraforming-Mars costing.** Every card is good; the question is always
*when* and *whether now*. Buy costs are variable and scale with power
(`~1` for the tiniest engine to `24` for a win-securing finisher). A card is
never a dud and never strictly dominates another — differentiation is by
**timing** (early/mid/late), **situation** (which threat, near a lake?), and
**gate** (W/P/N).

**The two-tier deck.** A **draw deck** of mostly free basics (`buy 0`) you pay
energy to dig through, plus a planned tableau of **premium** cards (engines,
actions, events, extenders) you buy at pile drafts and time deliberately.

---

## 2. The invariants, and how they're enforced

### Energy-engine ceiling (HARD)
Only cards whose `produces` prints **master Energy per round** are "energy
engines." Every one is capped at **≤4/round**, and the system clamps the *sum*
of installed energy-engine output below the skip cost (~11) so an idle, card-dry
player is always net-negative and must keep moving. The energy engines:

| Card | Energy/round | Buy | Shape |
|---|---|---|---|
| Amadou Tinder | +1 | 5 | cheapest early trickle, no condition |
| Rhizomorph Cord | +2 | 10 | flat, unconditional — the **benchmark** |
| Mycorrhizal Handshake | up to +3 | 12 | only while a tip is near food |
| Xylaria Deadwood Bed | up to +3 | 13 | only on a broad (4+ patch) mat |
| Ambrosia Garden | +3 (0 attacked) | 9 | cheaper + higher ceiling than Cord, but a 0 floor under attack |
| Sclerotial Battery | +4 (6 rounds) | 15 | finite, front-loaded, self-exhausts |
| Fairy-Ring Metabolism | +2 | 12 | also slow free growth |
| Companion Planting | +1 to +4 | 13 | scales with your *other* resource engines |
| Phosphate / Nitrogen Foundry | +3 | 11 | burns 1 P / 1 N each round — out-earns Cord by spending a resource |
| Prospering Flush (finisher) | +1 | 13 | goal-locked |

The benchmark is **Rhizomorph Cord**: unconditional +2/round at 10E. Everything
else trades against it — cheaper-but-conditional (Ambrosia's +3 that craters
under attack), or a resource-fuelled upgrade (the Foundries' +3 for a P/N gate
plus 1/round upkeep). No engine is *both* cheaper *and* strictly better than the
Cord, so none dominates it and it doesn't dominate them. Because they're
single-copy and mostly *conditional*, you can't stack them into runaway income
even before the clamp — most pay only when you're doing the thing you'd do
anyway (staying near food, staying broad, staying peaceful).
**Growth, resource (W/P/N), draw, and defense engines are exempt** — they don't
print the master currency. Cards like Dormancy Pact (cheaper skip) and
Ghost-Fungus Lantern (draw discount) don't print Energy either, so they're
exempt too. Every non-energy engine still carries a repay clock
(`buyCost ÷ value/round`).

### Gate ⟹ cheaper
A W/P/N gate is a *second* cost, so a gated card buys for **less** energy than an
equally powerful ungated one. The clearest ladder is the burst family, all flat
per-patch:

| Burst | Gate | Buy | Flat rate | Downside |
|---|---|---|---|---|
| Autolysis | — | 5 | +2/patch | income crash next round — the cheap floor |
| Inkcap Deliquesce | — | 9 | +4/patch | patches **zeroed** (harshest) |
| Enzyme Bloom | W2 | 6 | +3/patch | gated, no downside |
| Phosphate Fire | P2 | 8 | +4/patch | heavy gate |
| Cordyceps Windfall | N2 | 6 | +6/kill | needs worm kills |

Ungated bursts pay their honesty in a real downside; gated bursts pay it in the
gate and buy cheaper. None dominates another.

### Targeting (phone-strict)
Exactly three modes. **Global** (whole network / all substrate / a state check),
**radius-around-a-tap** (differentiated by radius size: 70 small → 140 wide),
**directional** (grow / substrate / single digs). Nothing targets a single
strand or cell. Substrate cards are directional and the player controls
**direction only**; the size ladder (Leaf-Litter → Twig Bed → Log Cache →
Buried Windfall → the "at the sensing edge" rule) sets *how much*, never how far.
Digs clear **one whole rock** of a class and are **"unplayable if no eligible
rock in range"** — no do-nothing fallback, no cell-counting. The terrain ladder
climbs boulder → formation → column → lake-basin with heavier (mostly P) gates
up the rungs; radius multi-clears (Hydraulic Lift, Bore-Tide) are the exception
and say so.

### Flat numbers
All economy is flat (`+2/patch`, `+3 W`, `+6 segments`). The only percentages
are non-economy vitality tuning on defense engines (e.g. "+50% recovery"), which
don't touch the currency.

---

## 3. Coverage

- **Grow / route:** grow pulse, omni-flush, aimed lunge, attractor-seek, directed
  seek-with-lure; growth-trick engines (Physarum Router auto-routes, Sporangial
  Volley repeatable aim, Split-Gill omni, Honey-Fungus mass march).
- **Substrate ladder:** small → medium → large → huge, all directional-at-edge.
- **Energy:** the bounded engines above; digestion (Burst/Chitin basics, Cellulase
  Cascade action, four one-shot bursts); draw economy (Ghost-Fungus Lantern,
  Woodwide Web, Hyphal Fusion — the single deliberately-rare recycle).
- **W / P / N — each a full lane:** a source-independent free basic floor
  (Hydrophobin Dew / Rhizosphere Priming / Saprophagy) plus a source-tap floor
  (Guttation Sip / Mineral Etch) · a harvest (Osmotic Draught / Oxalic Bore /
  Decay Compost) · a production engine (Suillus Bog Mat / Glomus + Hartig /
  Springtail Snare + Diazotroph) · a gated power growth spike (Turgor Surge /
  Calcite Surge / Mycelial Bloom) · a dig (Hydraulic Lift + Hydnellum Weir /
  Serpula + Bore-Tide / Ammonifying Bore) · a repair (Rehydration Bloom /
  Lion's-Mane / Chitin Armor) · growth (Aquaporin / Prototaxites + Crystalline
  Trellis / Cordyceps Lance). Small storage engines (Guttation Reservoir, Calcite
  Vault) smooth sequencing without letting you hoard.
- **Threat lanes**, each with traps/repels/cleanses/converters **and ≥1
  unconditional engine** (never a dead draft):
  - **Ant** — Ophiocordyceps Sentinel (engine; also reveals food when ant-free),
    Myrmecophyte Pact (engine; +1 floor even with no ants), Formic Ward,
    Trail Choke, Leafcutter's Due (ant→energy), Stinkhorn Decoy, Zombie Ant
    Vector, Scout Repel (basic).
  - **Mould** — Melanin Sheath & Antibiosis Field (engines; regen/cleanse even
    mould-free), Woronin Seal (freeze spread), Penicillin Purge, Scorched
    Excision, Mycoparasite Turn (mould→energy), Melanize (basic).
  - **Worm** — Arthrobotrys Ring-Net & Nematophagous Bed (engines; +N floor from
    soil fauna even worm-free, worm→N converters), Pleurotus Predation, Mucus
    Flood, Sticky Secretion (basic).
  - **All-threat** — Sclerotium Bunker, Turkey-Tail Guard, Amanita Toxin Ring,
    Ganoderma Bracket, Immune Priming, Lion's-Mane Regrowth, Guttation Cleanse
    (basic).
- **Extenders (runway):** eight, each themed to a build (grow, digest, resource
  taps, defensive basics, seek-food).
- **Finishers:** Pilobolus Cannon (ballistic aim to goal), Heliotropic Rush (fill
  goal columns), Rhizomorph Sprint (traversal), Sunlit Antennae (reveal + open
  endgame), Prospering Flush (autopilot engine), Fruiting Primordia (24-cost
  win-securer). All goal-locked / late-timed so they can't be early auto-buys.

---

## 4. Archetypes the collection supports

- **Broad Saprotroph (economy/tempo):** Xylaria Bed + Cellulase Cascade + digest
  bursts + grow basics + a substrate extender. Colonise wide, cash the mat, out-run
  the clock. Weak to a fast worm swarm on the mat.
- **Mineral Engineer (P/structure/dig):** Glomus/Hartig + Calcite Vault +
  Serpula/Bore-Tide + Prototaxites/Crystalline Trellis + Phosphate Fire. Routes
  through the heaviest barriers a map can throw up; slow to start.
- **Carnivore (N/aggression):** Nematophagous Bed + Arthrobotrys + Diazotroph +
  Cordyceps Windfall/Lance + Chitin Armor. Turns a worm-heavy map into fuel and a
  nitrogen engine; underwhelming on a worm-light map (opportunity cost, not a dud).
- **Hydro-Rush (W/traversal):** Suillus Bog Mat + Aquaporin + Turgor Surge +
  Hydraulic Lift + Rhizomorph Sprint. Fast, lake-dependent, punches across open
  ground to the goal.
- **Bunker/attrition:** the all-threat engines + Overwinter Sclerotium extender +
  cleanse actions — survives a threat-dense map by out-healing it, then finishes.

Most real decks are hybrids drafted to the map: the point of the variable buy
cost and the timing tags is that *which* good card you take depends on how far
into the run you are and what the terrain and threats in front of you look like.

---

## 5. Adversarial review pass

A multi-agent review (5 independent reviewers — dominated/auto-include,
energy-ceiling, gate↔cost, targeting/schema, coverage — each finding then
adversarially verified by a separate skeptic) produced 32 findings; 16 survived
verification and were fixed:

- **The Cord cluster (6 findings).** Rhizomorph Cord (ungated +2) dominated
  Ambrosia Garden and *both* Foundries — the gated engines cost *more* than the
  ungated one, inverting the gate rule twice. Fixed by making the Cord the
  explicit 10E benchmark, giving Ambrosia a cheaper-but-higher-ceiling +3
  (0 under attack), and turning the Foundries into +3 resource-fuelled upgrades
  that out-earn the Cord by burning 1 P/N per round.
- **Basin Breach (3 findings, all severities).** Was strictly dominated by
  Universal Solvent (heavier gate, higher cost, narrower clear). Reworked into a
  cheaper lake specialist that *also* banks a +8 Water windfall — a route+resource
  play the flexible generalist can't replicate.
- **Diazotroph vs Springtail.** Two identical +2 N engines at 11/10E → Diazotroph
  promoted to the +3/13E tier so it's a bigger engine, not a costlier clone.
- **Chitin Armor** dropped to 10E so its N gate buys a discount under its ungated
  sibling Sclerotium Bunker (12E).
- **Turgor Tap** (a W-gated basic identical to the free Hyphal Advance) buffed to
  2 pulses + out-of-range reach, so the Water gate buys tempo the free card lacks.
- **Autolysis** dropped to 5E as the genuine cheap ungated floor burst beneath the
  W-gated Enzyme Bloom.
- **Deep-Reach Taproot** reworded to drop the one "single strand" phrase (it was
  already legal directional targeting; the wording just read wrong).
- **Two coverage gaps closed** with new cards: **Hydrophobin Dew** (a buy-0,
  source-independent +1 Water floor, mirroring the free N/P floors that Water
  lacked) and **Ammonifying Bore** (an N-gated formation dig — the Nitrogen lane
  previously had no dig of its own).

The 16 findings that did *not* survive verification were rejected as genuine
differentiation (e.g. the draw-discount cards Ghost-Fungus Lantern / Dormancy
Pact / Woodwide Web *look* like energy but are exempt by rule and by design).

## 6. Files
- `cards.json` / `cards.csv` — identical column set, one row per card. `clears`
  is a `|`-joined string in the CSV, a JSON array in the JSON.
- `review.html` — self-contained dark field-guide for phone review; 👍/👎 + notes
  persist to `localStorage["mycelium-fable5-feedback"]`, with a text/JSON export.
