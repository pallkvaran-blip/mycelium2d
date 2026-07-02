# Mycelium — Fable-5 Card Collection · Design Doc

117 unique single-copy cards. Designed fresh from the brief against the actual
Phase-1 engine (`src/config.js`, `src/engine/*`), not against the other set.

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

| Card | Energy/round | Shape |
|---|---|---|
| Amadou Tinder | +1 | cheapest early trickle, no condition |
| Rhizomorph Cord | +2 | flat, reliable |
| Mycorrhizal Handshake | up to +3 | only while a tip is near food |
| Xylaria Deadwood Bed | up to +3 | only on a broad (4+ patch) mat |
| Ambrosia Garden | +2 | only in peacetime (0 while attacked) |
| Sclerotial Battery | +4 (6 rounds) | finite, front-loaded, self-exhausts |
| Fairy-Ring Metabolism | +2 | also slow free growth |
| Companion Planting | +1 to +4 | scales with your *other* resource engines |
| Phosphate/Nitrogen Foundry | +2 | burns 1 P / 1 N each round |
| Prospering Flush (finisher) | +1 | goal-locked |

Because they're single-copy and mostly *conditional*, you can't stack them into
runaway income even before the clamp — most pay only when you're doing the
thing you'd do anyway (staying near food, staying broad, staying peaceful).
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
| Autolysis | — | 7 | +2/patch | income crash next round |
| Inkcap Deliquesce | — | 9 | +4/patch | patches **zeroed** (harshest) |
| Enzyme Bloom | W2 | 6 | +3/patch | gated |
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
- **W / P / N — each a full lane:** free basic floor (Guttation Sip / Mineral Etch
  / Saprophagy; plus Rhizosphere Priming as a no-rock P floor) · a harvest
  (Osmotic Draught / Oxalic Bore / Decay Compost) · a production engine (Suillus
  Bog Mat / Glomus + Hartig / Springtail Snare + Diazotroph) · gated power growth
  spike (Turgor Surge / Calcite Surge / Mycelial Bloom) · a dig (Hydraulic Lift,
  Hydnellum Weir / Serpula, Bore-Tide / — ) · a repair (Rehydration Bloom /
  Lion's-Mane / Chitin Armor) · growth (Aquaporin / Prototaxites, Crystalline
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

## 5. Files
- `cards.json` / `cards.csv` — identical column set, one row per card. `clears`
  is a `|`-joined string in the CSV, a JSON array in the JSON.
- `review.html` — self-contained dark field-guide for phone review; 👍/👎 + notes
  persist to `localStorage["mycelium-fable5-feedback"]`, with a text/JSON export.
