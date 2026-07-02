#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Single source of truth for the Fable-5 Mycelium card collection.
Emits docs/fable5/cards.json and docs/fable5/cards.csv with identical columns.
"""
import json, csv, os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", "docs", "fable5")
# We'll override OUT from the shell with an absolute path instead; see bottom.

COLUMNS = [
    "name", "type", "category", "buyCostEnergy", "playCostEnergy",
    "playCostWater", "playCostPhosphorus", "playCostNitrogen", "timing",
    "axis", "threat", "produces", "effect", "flavor", "notes", "familyKey",
    "targeting", "radius", "growthAmount", "clears",
]

cards = []

def C(name, type, category, axis, effect, flavor,
      buy=0, W=0, P=0, N=0, timing="flex", threat="none", produces="",
      notes="", family="", targeting="", radius="", growth="", clears=None):
    cards.append({
        "name": name, "type": type, "category": category,
        "buyCostEnergy": buy, "playCostEnergy": 0,
        "playCostWater": W, "playCostPhosphorus": P, "playCostNitrogen": N,
        "timing": timing, "axis": axis, "threat": threat, "produces": produces,
        "effect": effect, "flavor": flavor, "notes": notes, "familyKey": family,
        "targeting": targeting, "radius": radius, "growthAmount": growth,
        "clears": clears if clears is not None else [],
    })

# =============================================================================
# 1) GROW & ROUTE BASICS + GROWTH TRICKS  (draw-deck floor, buy 0)
# =============================================================================
C("Hyphal Advance", "basic", "grow", "grow",
  "GLOBAL. Release the network: every tip runs one growth pulse toward sensed food. Unplayable if no attractor is in sensing range.",
  "The default hunger of a colony: reach, always, toward the next meal.",
  timing="early", produces="growth", family="grow-basic", targeting="global", growth="1 pulse")

C("Radial Flush", "basic", "growth-trick", "grow",
  "GLOBAL. Grow 1 short segment in EVERY direction from every tip, ignoring attractors. Fills a pocket and seeds branches to steer later.",
  "Marasmius throwing a fairy ring outward in every bearing at once.",
  timing="early", produces="growth", family="grow-basic", targeting="global", growth="1 (omni)")

C("Tropic Lunge", "basic", "growth-trick", "route",
  "DIRECTIONAL. Aim a straight-line growth burst of 3 segments in a chosen compass direction, ignoring attractors. Punches toward terrain you can't yet sense.",
  "Positive tropism — the tip commits to a bearing and drives.",
  timing="flex", produces="growth", family="grow-basic", targeting="directional", growth="3 (aimed)")

C("Forage Seek", "basic", "growth-trick", "route",
  "GLOBAL. Grow 3 segments toward the NEAREST food source anywhere on the map, even if out of sensing range. Unplayable if no food remains.",
  "Chemotropism across the dark — the colony always knows where the larder is.",
  timing="flex", produces="growth", family="grow-basic", targeting="global", growth="3 (seek)")

C("Leaf-Litter Lure", "basic", "substrate", "substrate",
  "DIRECTIONAL. Drop a SMALL nutrient patch at the edge of sensing range in a chosen direction. Steers the next Grow; barely feeds.",
  "A scatter of rotting leaf to tempt the frontier onward.",
  timing="early", produces="substrate", family="substrate-ladder", targeting="directional")

C("Burst Digest", "basic", "digest", "energy",
  "GLOBAL. Over-digest ALL occupied substrate at once for +1 Energy per occupied patch (flat). Depletes those patches faster than passive income would.",
  "Cash the mat in now — autolysis for a quick meal.",
  timing="flex", produces="energy", family="digest", targeting="global")

# =============================================================================
# 2) SUBSTRATE SIZE LADDER (small -> large)  (mix of basic + premium)
# =============================================================================
C("Twig Bed", "action", "substrate", "substrate",
  "DIRECTIONAL, cooldown 2. Drop a MEDIUM nutrient patch at the edge of sensing range in a chosen direction — enough to lure and lightly feed a branch.",
  "Woody debris: slower to rot, but it holds a frontier.",
  buy=5, timing="early", produces="substrate", family="substrate-ladder", targeting="directional")

C("Log Cache", "event", "substrate", "substrate",
  "DIRECTIONAL, one-shot. Drop a LARGE nutrient patch at the edge of sensing range in a chosen direction — a real pile that both lures and feeds a colonisation.",
  "A whole fallen limb, buried and waiting — Xylaria's feast.",
  buy=9, timing="mid", produces="substrate", family="substrate-ladder", targeting="directional")

C("Buried Windfall", "event", "substrate", "substrate",
  "DIRECTIONAL, one-shot. Drop a HUGE nutrient patch at the edge of sensing range in a chosen direction — bridges a barren stretch or bankrolls a late push.",
  "The whole windthrown crown gone under — a season of food in one drop.",
  buy=16, timing="late", produces="substrate", family="substrate-ladder", targeting="directional")

# =============================================================================
# 3) RESOURCE TAP BASICS (free floor producers) — W / P / N
# =============================================================================
C("Guttation Sip", "basic", "water", "water",
  "DIRECTIONAL. Tap a lake edge in a chosen direction for +3 Water (drains one of the edge's ~3 charges). Unplayable if no lake edge is in range.",
  "Hydnellum weeping clear droplets at dawn.",
  timing="flex", produces="water", family="water-tap", targeting="directional")

C("Mineral Etch", "basic", "phosphorus", "phosphorus",
  "DIRECTIONAL. Tap a mineral/crystal rock in a chosen direction for +3 Phosphorus (one of its ~3 charges). Unplayable if no mineral rock is in range.",
  "Oxalic acid pitting the stone, prying phosphate loose.",
  timing="flex", produces="phosphorus", family="phos-tap", targeting="directional")

C("Saprophagy", "basic", "nitrogen", "nitrogen",
  "GLOBAL. Scavenge decay across the network for +1 Nitrogen. The free floor when no worm is dead to digest.",
  "Nitrogen wrung from whatever already died down here.",
  timing="flex", produces="nitrogen", family="nitro-tap", targeting="global")

# =============================================================================
# 4) SMALL DIGS (terrain ladder floor)
# =============================================================================
C("Rootlet Bore", "basic", "dig", "route",
  "DIRECTIONAL. Clear ONE boulder (1-cell rock) in a chosen direction. Unplayable if no boulder is in range.",
  "Acid-tipped rhizomorphs worrying a pebble out of the way.",
  timing="early", produces="clear", family="dig-ladder", targeting="directional", clears=["boulder"])

C("Rhizomorph Pry", "action", "dig", "route",
  "DIRECTIONAL, cooldown 2. Clear ONE rock formation (the wide low crystal/ember/fungal masses) in a chosen direction. Unplayable if no formation is in range.",
  "Armillaria's black bootlaces splitting a seam in the mass.",
  buy=6, W=1, timing="mid", produces="clear", family="dig-ladder", targeting="directional", clears=["formation"])

C("Serpula Creep", "action", "dig", "route",
  "DIRECTIONAL, cooldown 3. Clear ONE rock column (a full vertical barrier) in a chosen direction. Unplayable if no column is in range.",
  "Dry rot conducts its own water and walks straight through masonry.",
  buy=12, P=2, timing="mid", produces="clear", family="dig-ladder", targeting="directional", clears=["column"])

C("Basin Breach", "event", "dig", "route",
  "DIRECTIONAL, one-shot. Drain and clear the lake basin barrier in a chosen direction AND bank a one-time +8 Water windfall from the drained lake. The lake specialist: opens the hardest crossing and fills your Water at once. Unplayable if the basin is not in range.",
  "Undermine the bowl and let the whole lake find the deep dark — catching what you can as it goes.",
  buy=16, P=2, W=1, timing="late", produces="lake-basin clear + big Water windfall", family="dig-ladder",
  targeting="directional", clears=["lake-basin"],
  notes="Not dominated by Universal Solvent: cheaper, water-positive, but lake-basin only vs Universal's flexible any-rock clear.")

C("Universal Solvent", "event", "dig", "route",
  "DIRECTIONAL, one-shot. Clear ANY ONE rock in a chosen direction regardless of class — boulder, formation, column, or lake basin. Unplayable if no rock is in range.",
  "Oxalic acid enough to eat anything the earth put in your way.",
  buy=18, P=2, timing="late", produces="clear", family="dig-ladder", targeting="directional",
  clears=["boulder","formation","column","lake-basin"])

# =============================================================================
# 5) ENERGY ENGINES (BOUNDED — each <=4/round; global clamp <11 total)
# =============================================================================
C("Rhizomorph Cord", "engine", "energy-engine", "energy",
  "INSTALL. +2 Energy per round while the network is alive. The steady, unconditional benchmark engine.",
  "Bundled hyphae as a pipeline, shuttling sugar from the far frontier home.",
  buy=10, timing="early", produces="+2 energy/round",
  notes="Energy engine: 2/round, unconditional. Repay ~5 rounds. Counts to <11 ceiling. The benchmark the conditional/gated +2s trade against.", family="energy-engine")

C("Xylaria Deadwood Bed", "engine", "energy-engine", "energy",
  "INSTALL. +3 Energy per round, but only while you occupy at least 4 substrate patches (else +1). Rewards a broad, colonised mat.",
  "Dead man's fingers, patiently rendering buried wood to sugar.",
  buy=13, timing="mid", produces="+3 energy/round (broad)",
  notes="Energy engine: up to 3/round, conditional. Repay ~5. Counts to <11 ceiling.", family="energy-engine")

C("Sclerotial Battery", "engine", "energy-engine", "energy",
  "INSTALL. +4 Energy per round for 6 rounds, then it exhausts to a spent husk (+0). A finite, front-loaded engine — burn it during a hard stretch.",
  "A sclerotium spending its hoarded store, then going quiet.",
  buy=15, P=1, timing="mid", produces="+4 energy/round (6 rounds)",
  notes="Energy engine: 4/round capped, self-exhausting. Repay ~4. Counts to <11 while live.", family="energy-engine")

C("Fairy-Ring Metabolism", "engine", "energy-engine", "energy",
  "INSTALL. +2 Energy per round, AND once every 3 rounds it also grows 1 omni-segment for free. A slow economy that also creeps.",
  "The ring widens each year, feeding as it goes.",
  buy=12, timing="mid", produces="+2 energy/round + slow growth",
  notes="Energy engine: 2/round (growth is exempt). Repay ~6. Counts to <11 ceiling.", family="energy-engine")

# =============================================================================
# 6) ENERGY BURSTS (one-shots; each has a distinct gate or downside)
# =============================================================================
C("Autolysis", "event", "energy-burst", "energy",
  "GLOBAL, one-shot. Over-digest ALL occupied substrate for +2 Energy per patch (flat). Downside: leaves those patches near-empty, cutting passive income next round.",
  "The colony eats its own stored mass in a rush.",
  buy=5, timing="flex", produces="energy burst", family="energy-burst", targeting="global",
  notes="Cheapest ungated floor burst. Flat +2/patch + income-crash downside; trades cleanly vs Enzyme Bloom (6E/W2/+3, no downside).")

C("Enzyme Bloom", "event", "energy-burst", "energy",
  "GLOBAL, one-shot. +3 Energy per occupied patch (flat). Gated by Water — turgor drives the enzyme flush.",
  "A pulse of cellulase across the whole mat at once.",
  buy=6, W=2, timing="flex", produces="energy burst", family="energy-burst", targeting="global",
  notes="Gated => cheaper than Autolysis for a bigger flat rate.")

C("Phosphate Fire", "event", "energy-burst", "energy",
  "GLOBAL, one-shot. +4 Energy per occupied patch (flat). Gated by Phosphorus — ATP spent to redline metabolism.",
  "Every mitochondrion in the mat opened wide for one heartbeat.",
  buy=8, P=2, timing="mid", produces="energy burst", family="energy-burst", targeting="global",
  notes="Highest flat rate; heavy P gate keeps it honest.")

C("Cordyceps Windfall", "event", "energy-burst", "energy",
  "GLOBAL, one-shot. Gain +6 Energy for each dead nematode you have digested this run (flat, min +6). Gated by Nitrogen. Rewards a worm-heavy map.",
  "The predator's fee, paid all at once.",
  buy=6, N=2, timing="mid", produces="energy burst", family="energy-burst", targeting="global",
  notes="Scales with worm kills; useless-ish on worm-light maps => opportunity cost, not a dud.")

# =============================================================================
# 7) DRAW ECONOMY + EXTENDERS (runway; extenders not recycled)
# =============================================================================
C("Anastomosis", "extender", "draw", "draw",
  "INSTALL. Shuffle 3 new Hyphal Advance basics into your draw deck. Extends the clock; the extender itself is not recycled.",
  "Hyphae fusing where they cross — the net rewires itself denser.",
  buy=8, timing="flex", produces="+3 basics", family="extender")

C("Chlamydospore Reserve", "extender", "draw", "draw",
  "INSTALL. Shuffle 2 Burst Digest and 1 Leaf-Litter Lure basic into your draw deck. Runway plus a little economy.",
  "Thick-walled survival spores banked against the lean stretch.",
  buy=8, timing="flex", produces="+3 basics", family="extender",
  notes="All '+3 basics' extenders share a buy cost; the choice is WHICH basics (economy vs traversal vs anti-stall), not price.")

C("Rhizomorph Highway", "extender", "draw", "draw",
  "INSTALL. Shuffle 3 Tropic Lunge basics into your draw deck. Runway tuned for punching across barren terrain.",
  "Cord-conducting bundles laid down as express lanes.",
  buy=8, timing="flex", produces="+3 basics", family="extender")

C("Mycorrhizal Windfall", "extender", "draw", "draw",
  "INSTALL. Shuffle 5 assorted basics (2 grow, 1 substrate, 1 water tap, 1 mineral tap) into your draw deck. The big late-run runway refill.",
  "A whole root-web of partners, suddenly plugged in.",
  buy=14, timing="late", produces="+5 basics", family="extender")

C("Ghost-Fungus Lantern", "engine", "draw", "draw",
  "INSTALL. Widens sensing radius so attractors are found sooner, AND the FIRST draw each round costs 3 less Energy. Cheapens the clock without refilling it.",
  "Panellus glow lighting the substrate two body-lengths further out.",
  buy=11, timing="flex", produces="draw discount + sensing",
  notes="Draw-economy engine; does not print master currency (exempt from ceiling).", family="draw-engine")

C("Woodwide Web", "action", "draw", "draw",
  "INSTALL, cooldown 3. Next draw this round is FREE (0 Energy). A repeatable pressure valve on the energy-for-cards tax.",
  "The common network sharing what one colony can't afford alone.",
  buy=10, timing="mid", produces="free draw / 3 rounds", family="draw-engine")

# =============================================================================
# 8) WATER LANE (basic tap above; harvest, engine, gated power, dig, repair, growth)
# =============================================================================
C("Osmotic Draught", "action", "water", "water",
  "DIRECTIONAL, cooldown 1. Deep-tap a lake edge in a chosen direction for +6 Water at once (drains 2 charges). The Water harvest option. Unplayable if no lake edge in range.",
  "Suillus drawing hard on the bog it grew beside.",
  buy=6, timing="flex", produces="water harvest", family="water", targeting="directional")

C("Suillus Bog Mat", "engine", "water", "water",
  "INSTALL. +3 Water per round while any tip sits within sensing range of a lake; +1 otherwise. Your standing Water supply.",
  "A bolete's felt drinking steadily from the waterline.",
  buy=12, timing="mid", produces="+3 water/round", family="water",
  notes="Resource engine (exempt from energy ceiling). Repay in tempo.")

C("Turgor Surge", "event", "water", "growth",
  "GLOBAL, one-shot. Gated by Water. Every tip grows 2 segments toward sensed food AND branches denser — a turgor-pressure growth spike across the whole colony.",
  "Cells swelling with water until the whole front lunges.",
  buy=7, W=3, timing="flex", produces="growth spike", family="water", targeting="global", growth="2 (all tips)")

C("Aquaporin Gate", "engine", "water", "growth",
  "INSTALL. Each round, one growth pulse toward sensed food is 40% longer reach (flat +2 segment length). Sustained traversal engine, Water-themed.",
  "Water channels flung wide so the tip drives further per push.",
  buy=11, W=1, timing="mid", produces="reach engine", family="water",
  notes="Growth engine (exempt). Repay in saved grow actions.")

C("Hydraulic Lift", "event", "water", "route",
  "RADIUS around a tap (radius 90). Gated by Water. Soften and clear every boulder within the radius at once, and lure growth into the cleared ground. Unplayable if no boulder in radius.",
  "Redistributing night water to crack a field of stones.",
  buy=9, W=2, timing="mid", produces="multi-boulder clear", family="water",
  targeting="radius", radius=90, clears=["boulder"])

C("Rehydration Bloom", "action", "water", "general-defense",
  "RADIUS around a tap (radius 100), cooldown 2. Gated by Water. Restore vitality to all strands in the radius and clear any drought/dip. General repair, Water-themed.",
  "Parched hyphae plumping back to life as the water returns.",
  buy=8, W=1, timing="flex", produces="heal", threat="all", family="water",
  targeting="radius", radius=100)

# =============================================================================
# 9) PHOSPHORUS LANE
# =============================================================================
C("Oxalic Bore", "action", "phosphorus", "phosphorus",
  "DIRECTIONAL, cooldown 1. Deep-etch a mineral rock in a chosen direction for +6 Phosphorus (2 charges). The Phosphorus harvest option. Unplayable if no mineral rock in range.",
  "Crystals of calcium oxalate blooming where the acid bites deepest.",
  buy=6, timing="flex", produces="phosphorus harvest", family="phosphorus", targeting="directional")

C("Glomus Arbuscule", "engine", "phosphorus", "phosphorus",
  "INSTALL. +2 Phosphorus per round while alive. The steady mycorrhizal P line.",
  "Arbuscular hyphae branching inside a root, trading sugar for phosphate.",
  buy=10, timing="mid", produces="+2 phosphorus/round", family="phosphorus",
  notes="Resource engine (exempt from energy ceiling).")

C("Hartig Net", "engine", "phosphorus", "phosphorus",
  "INSTALL. +3 Phosphorus per round while you occupy at least 3 patches; +1 otherwise. The broad-colony P engine.",
  "A lattice of hyphae sheathing every rootlet in reach.",
  buy=13, P=1, timing="mid", produces="+3 phosphorus/round", family="phosphorus",
  notes="Resource engine (exempt). Gate keeps it off turn-one.")

C("Prototaxites Spire", "engine", "phosphorus", "grow",
  "INSTALL. Gated by Phosphorus. Each round, grow 1 aimed segment straight UP toward the surface — a standing structural push toward daylight.",
  "The great primordial fungal tower, reaching for a sky that had no trees.",
  buy=14, P=2, timing="mid", produces="vertical growth/round", family="phosphorus",
  notes="Growth engine (exempt). Structure/reach theme.")

C("Crystalline Trellis", "event", "phosphorus", "route",
  "DIRECTIONAL, one-shot. Gated by Phosphorus. Lay a rigid mineralised growth spur: grow 5 segments in a straight chosen direction, passing over cleared ground. A hard structural reach.",
  "Hyphae calcified into scaffolding to hold an impossible line.",
  buy=10, P=3, timing="mid", produces="long aimed growth", family="phosphorus",
  targeting="directional", growth="5 (aimed)")

C("Phosphate Foundry", "engine", "phosphorus", "energy",
  "INSTALL. +3 Energy per round, but consumes 1 Phosphorus each round to run (idles at +0 if you have no P). Out-earns the ungated Cord by burning surplus P — the P-flush player's throughput upgrade.",
  "Burning stored phosphate for ATP when the sugar runs thin.",
  buy=11, P=1, timing="mid", produces="+3 energy/round (burns 1 P/round)",
  notes="ENERGY engine: 3/round (>Cord's flat 2), counts to <11 ceiling; self-limits via ongoing P upkeep. Gate+upkeep buys the extra +1 over Cord.", family="phosphorus")

# =============================================================================
# 10) NITROGEN LANE
# =============================================================================
C("Springtail Snare", "engine", "nitrogen", "nitrogen",
  "INSTALL. +2 Nitrogen per round from trapped soil fauna (springtails, mites) — useful even with no nematodes on the map. The unconditional N line.",
  "Laccaria's adhesive hyphae, quietly harvesting the little animals.",
  buy=10, timing="mid", produces="+2 nitrogen/round", family="nitrogen",
  notes="Resource engine (exempt). Unconditional: works without worms.")

C("Decay Compost", "action", "nitrogen", "nitrogen",
  "GLOBAL, cooldown 1. Wring +3 Nitrogen from network-wide decay at once. The N harvest option (no worm required).",
  "Ammonia rising off everything the colony has already unmade.",
  buy=6, timing="flex", produces="nitrogen harvest", family="nitrogen", targeting="global")

C("Mycelial Bloom", "event", "nitrogen", "growth",
  "GLOBAL, one-shot. Gated by Nitrogen. Every tip grows 2 segments toward sensed food and thickens — a nitrogen-fed surge, the aggression payoff.",
  "The flush after rain, when nitrogen is suddenly cheap.",
  buy=7, N=3, timing="flex", produces="growth spike", family="nitrogen", targeting="global", growth="2 (all tips)")

C("Chitin Armor", "engine", "nitrogen", "general-defense",
  "INSTALL. Gated by Nitrogen. +50% vitality recovery each round network-wide and a standing resistance to all threats' first touch. The N defensive payoff.",
  "Melanised, chitin-thick walls that shrug off the first bite.",
  buy=10, N=2, timing="mid", produces="defense engine", threat="all", family="nitrogen",
  notes="Defense engine (exempt). Unconditional value even threat-free (recovery). Gated => buys below its ungated first-hit-resist sibling Sclerotium Bunker (12). Distinct from Ganoderma Bracket's flat damage-reduction mechanic.")

C("Nitrogen Foundry", "engine", "nitrogen", "energy",
  "INSTALL. +3 Energy per round, but consumes 1 Nitrogen each round (idles at +0 with no N). Out-earns the ungated Cord by burning surplus N — the aggression deck's throughput upgrade.",
  "Deaminating amino acids for a steady drip of ATP.",
  buy=11, N=1, timing="mid", produces="+3 energy/round (burns 1 N/round)",
  notes="ENERGY engine: 3/round (>Cord's flat 2), counts to <11 ceiling; self-limits via ongoing N upkeep. Gate+upkeep buys the extra +1 over Cord.", family="nitrogen")

C("Cordyceps Lance", "event", "nitrogen", "route",
  "DIRECTIONAL, one-shot. Gated by Nitrogen. A violent aimed growth strike of 6 segments straight in a chosen direction — the aggressive traversal spike.",
  "The fruiting stalk that erupts from a host, driving skyward.",
  buy=9, N=3, timing="mid", produces="long aimed growth", family="nitrogen",
  targeting="directional", growth="6 (aimed)")

# =============================================================================
# 11) ANT DEFENSE LANE
# =============================================================================
C("Ophiocordyceps Sentinel", "engine", "ant-defense", "defense",
  "INSTALL. Each round, an infected ant scout wanders home and weakens its nest (small standing pressure on ant HP). ALSO widens the range at which food piles are revealed — useful even with no ants present.",
  "The zombie-ant fungus, turning the raiders into its own scouts.",
  buy=11, timing="mid", produces="ant pressure + reveal", threat="ant", family="ant-defense",
  notes="Unconditional: the reveal helps route to food even ant-free.")

C("Formic Ward", "action", "ant-defense", "defense",
  "RADIUS around a tap (radius 120), cooldown 2. Sever the ant trail and repel foragers within the radius, so a nest must re-path and you get a head start to the pile.",
  "A reek of antibiotic hyphae the column refuses to cross.",
  buy=8, timing="flex", produces="ant repel", threat="ant", family="ant-defense",
  targeting="radius", radius=120)

C("Leafcutter's Due", "event", "ant-defense", "energy",
  "RADIUS around a tap (radius 110), one-shot. Rush-digest every food pile in the radius for +3 Energy per patch (flat) NOW — beat the ants to the harvest. Unplayable if no food in radius.",
  "Take the leaf-hoard first; let the colony arrive to bare soil.",
  buy=8, timing="flex", produces="contested harvest", threat="ant", family="ant-defense",
  targeting="radius", radius=110)

C("Myrmecophyte Pact", "engine", "ant-defense", "energy",
  "INSTALL. +1 Energy per round; if any ant nest is active on the map, +3 instead. A pact that pays whether or not the ants show — never a dead draft.",
  "Feeding the colony a sugar tithe so they raid a neighbour instead.",
  buy=10, timing="mid", produces="+1 to +3 energy/round", threat="ant", family="ant-defense",
  notes="ENERGY engine: capped 3/round, counts to <11 ceiling. Unconditional floor of +1.")

C("Trail Choke", "action", "ant-defense", "route",
  "DIRECTIONAL, cooldown 2. Grow a dense mycelial wall 2 segments in a chosen direction that ant trails cannot cross, walling a pile off from a nest.",
  "A living palisade the foragers meet and turn back from.",
  buy=7, timing="flex", produces="growth + block", threat="ant", family="ant-defense",
  targeting="directional", growth="2 (wall)")

# =============================================================================
# 12) MOULD (TRICHODERMA) DEFENSE LANE
# =============================================================================
C("Melanin Sheath", "engine", "mould-defense", "defense",
  "INSTALL. Standing chance to RESIST each Trichoderma contact infection, and +vitality recovery each round. Useful as plain regeneration even with no mould about.",
  "Melanised cell walls: sunscreen, armour, and a rot-shield in one.",
  buy=11, timing="mid", produces="infection resist + heal", threat="mould", family="mould-defense",
  notes="Defense engine (exempt). Unconditional recovery value.")

C("Woronin Seal", "action", "mould-defense", "defense",
  "GLOBAL, cooldown 1. Plug the septal pores network-wide: FREEZE all rot spread for 1 round (the race along your filaments halts). Buys a turn to cut or cleanse.",
  "Woronin bodies slamming the hyphal doors shut against the breach.",
  buy=8, timing="flex", produces="freeze rot spread", threat="mould", family="mould-defense", targeting="global")

C("Penicillin Purge", "action", "mould-defense", "defense",
  "RADIUS around a tap (radius 110), cooldown 1. Cleanse ALL infection within the radius and kill any Trichoderma cloud caught inside it. The workhorse cleanse.",
  "Penicillium doing what it has always done to a rival mould.",
  buy=9, timing="flex", produces="cleanse + kill cloud", threat="mould", family="mould-defense",
  targeting="radius", radius=110)

C("Antibiosis Field", "engine", "mould-defense", "defense",
  "INSTALL. Each round, cleanse a little infection network-wide AND emit an antifungal aura that slows Trichoderma clouds approaching your frontier. Standing mould suppression.",
  "A permanent chemical no-man's-land at the colony's edge.",
  buy=13, timing="mid", produces="standing cleanse + slow", threat="mould", family="mould-defense",
  notes="Even mould-free it keeps strands clean of transient dips.")

C("Scorched Excision", "event", "mould-defense", "defense",
  "RADIUS around a tap (radius 130), one-shot. Amputate every strand in a LARGE radius and cleanse the ground — the emergency firebreak for a runaway infection. Regrow after.",
  "Cut to living tissue and burn the rest; the colony can afford to lose an arm.",
  buy=6, timing="flex", produces="large amputate + cleanse", threat="mould", family="mould-defense",
  targeting="radius", radius=130)

# =============================================================================
# 13) WORM (NEMATODE) DEFENSE LANE
# =============================================================================
C("Arthrobotrys Ring-Net", "engine", "worm-defense", "nitrogen",
  "INSTALL. Constricting hyphal rings passively snare and digest nematodes near your frontier each round, yielding +1 Nitrogen per round even with no worms (soil fauna). Scales up when worms swarm.",
  "The noose fungus, its rings snapping shut on anything that crawls through.",
  buy=11, timing="mid", produces="+1 N/round + worm kill", threat="worm", family="worm-defense",
  notes="Unconditional N floor; converts a worm map into a payoff. Resource engine (exempt).")

C("Sticky Secretion", "basic", "worm-defense", "defense",
  "RADIUS around a tap (radius 70). Secrete mucus: stick every nematode in a small radius for 1 round (no move/feed/breed). The free floor worm tool.",
  "Adhesive knobs the worms blunder into and cannot leave.",
  timing="flex", produces="worm stick", threat="worm", family="worm-defense",
  targeting="radius", radius=70)

C("Pleurotus Predation", "event", "worm-defense", "nitrogen",
  "RADIUS around a tap (radius 100), one-shot. Toxic droplets paralyse and DIGEST every nematode in the radius, converting them to Nitrogen (~+2 N each). The worm->N payoff burst.",
  "The oyster mushroom, quietly carnivorous, dissolving its prey for nitrogen.",
  buy=7, timing="flex", produces="worm kill -> N", threat="worm", family="worm-defense",
  targeting="radius", radius=100)

C("Nematophagous Bed", "engine", "worm-defense", "nitrogen",
  "INSTALL. A standing carnivorous mat: each round it kills nematodes in contact and banks the Nitrogen (+2 N per worm digested). On a worm-heavy map this is a runaway N engine.",
  "A whole hunting ground of hyphal traps, always set.",
  buy=12, timing="mid", produces="worm kill -> +N/round", threat="worm", family="worm-defense",
  notes="Resource engine (exempt). Value scales with worm pressure; pairs with N lane.")

C("Mucus Flood", "action", "worm-defense", "defense",
  "RADIUS around a tap (radius 140), cooldown 2. A wide sticky flood: stick every nematode in a LARGE radius for 2 rounds and halt a breeding swarm. The panic button.",
  "Guttation turned to glue across the whole embattled front.",
  buy=9, timing="flex", produces="wide worm stick", threat="worm", family="worm-defense",
  targeting="radius", radius=140)

# =============================================================================
# 14) GENERAL / ALL-THREAT DEFENSE
# =============================================================================
C("Sclerotium Bunker", "engine", "general-defense", "defense",
  "INSTALL. Standing +vitality recovery and a resistance to the FIRST hit from ants, mould, or worms each round. A hardened core that never sits idle whatever the map throws up.",
  "A dense survival mass the colony can always retreat into.",
  buy=12, timing="mid", produces="all-threat resist + heal", threat="all", family="general-defense",
  notes="Unconditional (recovery). Defense engine (exempt).")

C("Turkey-Tail Guard", "action", "general-defense", "defense",
  "RADIUS around a tap (radius 120), cooldown 2. Immune surge: cleanse mould infection, repel ants, and stick worms in the radius, all at once. One button for a mixed assault.",
  "Trametes' banded shelves, the classic immune tonic of the forest.",
  buy=13, timing="mid", produces="all-threat cleanse/repel", threat="all", family="general-defense",
  targeting="radius", radius=120)

C("Amanita Toxin Ring", "event", "general-defense", "defense",
  "RADIUS around a tap (radius 130), one-shot. Lay a toxic ring: kills nematodes and Trichoderma clouds and drives ant foragers out of the radius. The scorched-earth reset.",
  "Muscarine and amatoxin — nothing that eats the colony survives the dose.",
  buy=10, N=1, timing="flex", produces="all-threat kill/repel", threat="all", family="general-defense",
  targeting="radius", radius=130)

# =============================================================================
# 15) FINISHERS (reach-to-goal; late-game surge toward revealed goal)
# =============================================================================
C("Pilobolus Cannon", "event", "finisher", "finisher",
  "GLOBAL, one-shot. Late-game only. Fire an aimed growth ballista of 8 segments straight toward the REVEALED goal zone, punching across open ground. Unplayable until the goal is sensed.",
  "The hat-thrower, launching its cargo at ten thousand g toward the light.",
  buy=16, W=2, timing="late", produces="goal surge", family="finisher",
  targeting="global", growth="8 (to goal)")

C("Heliotropic Rush", "event", "finisher", "finisher",
  "GLOBAL, one-shot. Late-game only. Every tip within reach of the goal soil surges 4 segments toward it and branches to fill the fruiting columns. Unplayable until the goal is sensed.",
  "The whole colony leaning at once toward the summer light.",
  buy=18, P=2, timing="late", produces="goal fill", family="finisher",
  targeting="global", growth="4 (all -> goal)")

C("Fruiting Primordia", "event", "finisher", "finisher",
  "GLOBAL, one-shot. Late-game only. Force fruiting-body primordia across ALL reachable goal soil at once, even sickly or shallow tissue — guarantees the fruit that wins the level if any goal soil is held. Unplayable if no goal soil is reached.",
  "Pins forming in the dark, committing the colony's whole life to this one flush.",
  buy=24, W=2, P=2, timing="late", produces="win-secure fruit", family="finisher",
  targeting="global")

C("Rhizomorph Sprint", "event", "finisher", "finisher",
  "DIRECTIONAL, one-shot. Late-game only. Lay an express cord 7 segments in a chosen direction and pull the whole frontier along it — a hard traversal finisher for the last barren gap.",
  "Bootlaces racing through the dark, meters a day, straight for the exit.",
  buy=14, W=1, timing="late", produces="traversal finisher", family="finisher",
  targeting="directional", growth="7 (aimed)")

C("Prospering Flush", "engine", "finisher", "finisher",
  "INSTALL. Late-game engine. Each round, grow 1 segment toward the revealed goal AND +1 Energy. Buy it once the goal is in sight to close the run on autopilot. Unplayable until the goal is sensed.",
  "The colony, scenting summer, needs no more steering.",
  buy=13, timing="late", produces="+1 energy/round + goal creep",
  notes="ENERGY engine: 1/round (counts to <11). Growth exempt. Goal-locked.", family="finisher")

# =============================================================================
# 16) MORE GROW/ROUTE & UTILITY to round out families and viable archetypes
# =============================================================================
C("Physarum Router", "engine", "grow", "route",
  "INSTALL. Each round, auto-extend 1 segment toward the NEAREST sensed attractor (slime-mould pathfinding). Hands you steady routing without spending draws.",
  "The slime mould that solves the maze and keeps only the efficient tubes.",
  buy=10, timing="mid", produces="auto-route/round", family="grow-engine",
  notes="Growth engine (exempt from energy ceiling).")

C("Split-Gill Spread", "action", "growth-trick", "grow",
  "GLOBAL, cooldown 1. Grow 1 omni-segment from every tip AND branch denser network-wide — resilient, desiccation-proof coverage on demand.",
  "Schizophyllum commune: more mating types than any organism, everywhere at once.",
  buy=6, timing="early", produces="omni growth", family="grow-engine",
  targeting="global", growth="1 (omni)")

C("Honey-Fungus March", "event", "growth-trick", "route",
  "DIRECTIONAL, one-shot. Advance the entire frontier 4 segments in a chosen direction as a coordinated sheet — the biggest single aimed push before finishers.",
  "Armillaria, the largest organism alive, walking the forest floor.",
  buy=9, W=1, timing="mid", produces="mass aimed growth", family="grow-engine",
  targeting="directional", growth="4 (frontier)")

C("Truffle Instinct", "action", "utility", "route",
  "GLOBAL, cooldown 2. Reveal the nearest unsensed food pile AND grow 2 segments toward it. Anti-stall tool when the frontier can't find the next meal.",
  "Tuber, buried and blind, yet unerring toward what feeds it.",
  buy=7, timing="flex", produces="reveal + growth", family="grow-engine",
  targeting="global", growth="2 (seek)")

C("Guttation Reservoir", "engine", "water", "water",
  "INSTALL. Store up to +2 extra Water soft-cap and refund 1 Water each round from condensation. A small standing top-up that smooths Water sequencing.",
  "Dew beading on the hyphae each night, saved against the dry.",
  buy=8, timing="flex", produces="+1 water/round", family="water",
  notes="Resource engine (exempt). Raises effective W cap slightly.")

C("Bleeding-Tooth Font", "action", "water", "water",
  "GLOBAL, cooldown 2. Guttate +4 Water from the network's own stored moisture — a Water harvest that needs no lake in range. The desert option.",
  "Hydnellum peckii weeping its scarlet drops far from any pool.",
  buy=9, timing="mid", produces="water harvest (no lake)", family="water", targeting="global")

C("Calcite Vault", "engine", "phosphorus", "phosphorus",
  "INSTALL. Store up to +2 extra Phosphorus soft-cap and refund 1 P each round from mineral scavenging. Smooths P sequencing for the heavy-gated cards.",
  "Oxalate crystals banked in the hyphae like coin.",
  buy=8, timing="flex", produces="+1 phosphorus/round", family="phosphorus",
  notes="Resource engine (exempt). Raises effective P cap slightly.")

C("Bore-Tide", "event", "phosphorus", "route",
  "RADIUS around a tap (radius 100), one-shot. Gated by Phosphorus. Clear every boulder AND every rock formation within the radius at once. Unplayable if none in radius.",
  "Acid enough to dissolve a whole reef of stone in a night.",
  buy=13, P=3, timing="mid", produces="multi-rock clear", family="phosphorus",
  targeting="radius", radius=100, clears=["boulder","formation"])

C("Diazotroph Symbiosis", "engine", "nitrogen", "nitrogen",
  "INSTALL. Host nitrogen-fixing bacteria: +3 Nitrogen per round from the air itself, unconditional. The BIG standing N line — a full tier above the +2 Springtail Snare, for N-hungry aggression decks.",
  "Bacteria lodged in the hyphae, spinning nitrogen out of nothing.",
  buy=13, timing="mid", produces="+3 nitrogen/round", family="nitrogen",
  notes="Resource engine (exempt). +3/round tier (cf. Springtail Snare +2/10E) — sized up, not a clone.")

C("Lion's-Mane Regrowth", "action", "general-defense", "defense",
  "RADIUS around a tap (radius 110), cooldown 2. Regenerate strands and rapidly re-grow tissue lost to any threat in the radius — restorative, not preventive. Pairs with any excision.",
  "Hericium's cascading spines: the fungus that mends nerves mending itself.",
  buy=9, timing="flex", produces="regrow + heal", threat="all", family="general-defense",
  targeting="radius", radius=110)

C("Chitin Digest", "basic", "energy-burst", "energy",
  "GLOBAL. Burst-digest ONLY the substrate under your densest, oldest mat for +2 Energy per such patch (flat). A focused floor burst; weaker than premium bursts, free to draw.",
  "Recycling the colony's own thickened core for a quick meal.",
  timing="flex", produces="energy burst", family="digest", targeting="global")

C("Sensing Bloom", "basic", "utility", "route",
  "GLOBAL. Flare the sensing radius for this action only: the next Grow this round sees attractors much further out. Free anti-stall floor tool.",
  "A pulse of receptors flung out into the dark.",
  timing="flex", produces="sensing flare", family="grow-basic", targeting="global")

C("Melanize", "basic", "mould-defense", "defense",
  "GLOBAL. Toughen cell walls for 1 round: standing chance to resist the next Trichoderma contact network-wide. The free floor mould tool.",
  "Pigment flooding the walls the moment spores drift near.",
  timing="flex", produces="infection resist (1 round)", threat="mould", family="mould-defense", targeting="global")

C("Scout Repel", "basic", "ant-defense", "defense",
  "RADIUS around a tap (radius 80). Emit a brief antibiotic reek that turns ant foragers back from the radius for 1 round. The free floor ant tool.",
  "A whiff of something the column's chemists flag as poison.",
  timing="flex", produces="ant repel (1 round)", threat="ant", family="ant-defense",
  targeting="radius", radius=80)

C("Fissure Grow", "basic", "growth-trick", "route",
  "DIRECTIONAL. Grow 2 aimed segments in a chosen direction and, if they meet a boulder, clear it as they pass. Combines a small push with a small dig. Free floor tool.",
  "Hyphae wedging into a crack until the pebble simply gives.",
  timing="flex", produces="growth + boulder clear", family="grow-basic",
  targeting="directional", growth="2 (aimed)", clears=["boulder"])

C("Turgor Tap", "basic", "water", "growth",
  "GLOBAL. Gated by Water. Spend turgor for TWO growth pulses toward food, reaching even food OUT of sensing range — a Water-fuelled tempo basic that grows when the free Hyphal Advance would be dead.",
  "A short swell of pressure, spent on two honest pushes past the edge of sense.",
  W=1, timing="flex", produces="growth (2, extended reach)", family="water", targeting="global", growth="2 (extended reach)",
  notes="Beats free Hyphal Advance on reach + count, justifying the W gate (not dominated).")

C("Necromass Feast", "event", "nitrogen", "energy",
  "GLOBAL, one-shot. Gated by Nitrogen. Convert banked Nitrogen into a one-time +5 Energy per 2 N spent (you choose how much, up to your stock). Flexible late fuel.",
  "The colony eating its own dead in a controlled, nitrogen-rich burn.",
  buy=6, N=2, timing="late", produces="N -> energy", family="nitrogen", targeting="global")

C("Mycangial Cache", "extender", "draw", "draw",
  "INSTALL. Shuffle 2 resource-tap basics (1 Guttation Sip, 1 Mineral Etch) into your draw deck. Runway that also shores up your W/P floor.",
  "Beetles carry fungal spores in special pockets; the colony keeps its own.",
  buy=7, timing="flex", produces="+2 basics", family="extender")

C("Hyphal Fusion", "action", "draw", "draw",
  "INSTALL, cooldown 4. Retrieve one spent basic from the graveyard back into your hand-side pile — the ONLY recycle in the game, deliberately rare and slow.",
  "Two colonies touching, becoming one, sharing what each had lost.",
  buy=12, timing="mid", produces="rare recycle", family="draw-engine",
  notes="Slow, single-target, long cooldown: does not break the no-reshuffle clock.")

C("Deep-Reach Taproot", "event", "route", "route",
  "DIRECTIONAL, one-shot. Gated by Water. Grow 6 aimed segments straight DOWN-and-across in a chosen direction, tunnelling the frontier beneath a barrier belt.",
  "The one cord that goes deep enough to pass under everything.",
  buy=10, W=2, timing="mid", produces="deep aimed growth", family="grow-engine",
  targeting="directional", growth="6 (deep aimed)")

C("Companion Planting", "engine", "energy-engine", "energy",
  "INSTALL. +1 Energy per round, and +1 more per round for each OTHER resource engine (W/P/N) you have installed, capped at +4 total. Rewards a resource-engine build.",
  "A guild of partners, each paying a little into the common purse.",
  buy=13, timing="mid", produces="+1 to +4 energy/round",
  notes="ENERGY engine: hard cap 4/round, counts to <11 ceiling.", family="energy-engine")

C("Zombie Ant Vector", "event", "ant-defense", "route",
  "GLOBAL, one-shot. Turn an active ant nest against itself: it stops harvesting and its foragers clear a path (removes the impassable trail) for 3 rounds. Unplayable if no ant nest is active.",
  "The fungus steers the colony's corpse to where its spores need to go.",
  buy=9, timing="flex", produces="ant neutralise + path", threat="ant", family="ant-defense", targeting="global")

C("Spore Print Draft", "extender", "draw", "draw",
  "INSTALL. Shuffle 2 Forage Seek and 1 Sensing Bloom basic into your draw deck. Runway tuned to keep a stalled frontier finding food.",
  "A dark print dropped on the soil, each spore a fresh start.",
  buy=8, timing="flex", produces="+3 basics", family="extender")

C("Cellulase Cascade", "action", "energy-burst", "energy",
  "INSTALL, cooldown 2. ACTIVATE to digest all occupied substrate for +2 Energy per patch (flat). A player-fired burst you can repeat every 2 rounds — not a passive engine, so you must spend the action each time.",
  "The enzyme wave you can call up again and again, if you pace it.",
  buy=10, timing="mid", produces="repeatable digest burst (player-fired)", family="digest", targeting="global",
  notes="Player-activated action (not auto-firing), so it prints no passive Energy => exempt from the <11 energy-engine ceiling.")

C("Mycorrhizal Handshake", "engine", "energy-engine", "energy",
  "INSTALL. +3 Energy per round while at least one tip sits within sensing range of a food pile; +1 otherwise. Rewards keeping the frontier fed.",
  "Sugar-for-mineral trade, humming only while a partner is in reach.",
  buy=12, timing="mid", produces="+3 energy/round (fed)",
  notes="ENERGY engine: up to 3/round, conditional, counts to <11 ceiling.", family="energy-engine")

C("Amadou Tinder", "engine", "phosphorus", "energy",
  "INSTALL. +1 Energy per round; consumes 0 resources. The tiniest, cheapest standing trickle — an early pick that never embarrasses you and frees draws for action.",
  "Fomes tinder, catching the smallest spark and holding it.",
  buy=5, timing="early", produces="+1 energy/round",
  notes="ENERGY engine: 1/round, counts to <11 ceiling. Cheap early runway.", family="energy-engine")

# ---- a few more to round coverage & archetypes -----------------------------
C("Hydnellum Weir", "event", "water", "route",
  "DIRECTIONAL, one-shot. Gated by Water. Clear one rock column in a chosen direction by dissolving its base — a Water-gated alternative to the P-gated column dig. Unplayable if no column in range.",
  "Redirecting water to carve the barrier out from under itself.",
  buy=11, W=3, timing="mid", produces="column clear (W route)", family="dig-ladder",
  targeting="directional", clears=["column"])

C("Sporangial Volley", "action", "growth-trick", "route",
  "DIRECTIONAL, cooldown 1. Fire 3 aimed segments in a chosen direction, repeatable — a cheap standing traversal tool for open ground once installed.",
  "A steady patter of spores, each one a new advancing tip.",
  buy=7, timing="flex", produces="repeatable aimed growth", family="grow-engine",
  targeting="directional", growth="3 (aimed)")

C("Colonise Pocket", "action", "grow", "grow",
  "RADIUS around a tap (radius 90), cooldown 1. Densely branch and fully colonise all occupied substrate within the radius in one action — maximises passive income from a pile fast.",
  "Saturating a food pocket with mat until every cell is worked.",
  buy=6, timing="early", produces="fast colonise", family="grow-engine",
  targeting="radius", radius=90)

C("Ambrosia Garden", "engine", "energy-engine", "energy",
  "INSTALL. +3 Energy per round, but only while NO threat is currently touching your network; +0 while under attack. A high-ceiling fair-weather engine that out-earns the steady Cord on calm maps and craters under a swarm.",
  "Beetles farming their fungal gardens — productive only in peace.",
  buy=9, timing="mid", produces="+3 energy/round (peacetime)",
  notes="ENERGY engine: 3/round peak, conditional (0 under attack), counts to <11 ceiling. Cheaper + higher ceiling than Cord, but a 0 floor.", family="energy-engine")

C("Dead-Man's-Fingers Reach", "event", "phosphorus", "route",
  "DIRECTIONAL, one-shot. Gated by Phosphorus. Grow 4 aimed segments straight down in a chosen direction through deep soil, then branch — the structural deep-dive to slip under a column belt.",
  "Xylaria's black digits, reaching into wood no other fungus bothers with.",
  buy=8, P=2, timing="mid", produces="deep aimed growth", family="phosphorus",
  targeting="directional", growth="4 (deep aimed)")

C("Immune Priming", "engine", "general-defense", "defense",
  "INSTALL. Each round, reduce the reach of the NEXT threat contact (rot rings claimed, worms fed, ants harvested) by a flat amount. A standing damage-cap on whatever hits first.",
  "The colony that has been bitten once and remembers.",
  buy=11, timing="mid", produces="standing damage cap", threat="all", family="general-defense",
  notes="Unconditional across all three threats; defense engine (exempt).")

C("Guttation Cleanse", "basic", "worm-defense", "defense",
  "RADIUS around a tap (radius 70). Rinse a small radius: stick worms AND wash off light mould infection at once. A dual free-floor cleanse for a messy frontier.",
  "A flush of clean droplets carrying the grime away.",
  timing="flex", produces="stick + light cleanse", threat="all", family="general-defense",
  targeting="radius", radius=70)

C("Sunlit Antennae", "event", "finisher", "finisher",
  "GLOBAL, one-shot. Late-game only. Permanently reveal the goal zone and its shaded columns, and grow 3 segments toward it. The scout that opens the endgame. Unplayable until you are within a few pushes of the goal.",
  "The first hyphae to taste warm soil, and call the rest.",
  buy=8, timing="late", produces="reveal goal + growth", family="finisher",
  targeting="global", growth="3 (to goal)")

C("Overwinter Sclerotium", "extender", "draw", "draw",
  "INSTALL. Shuffle 4 assorted defensive basics (1 each: Melanize, Sticky Secretion, Scout Repel, Guttation Cleanse) into your draw deck. Runway for a defensive, attrition build.",
  "A survival mass packed with every trick, waiting out the siege.",
  buy=10, timing="mid", produces="+4 defensive basics", family="extender")

# =============================================================================
# 17) FINAL ROUND — symmetry fills, threat->resource converters, floor bulk
# =============================================================================
C("Wick Grow", "basic", "growth-trick", "route",
  "DIRECTIONAL. Grow 2 segments toward the nearest food source lying in a chosen direction, even if out of sensing range, AND drop a tiny lure where they land. Free directed seek.",
  "A single questing cord, wicking toward the scent it chose.",
  timing="flex", produces="growth + lure", family="grow-basic",
  targeting="directional", growth="2 (directed seek)")

C("Calcite Surge", "event", "phosphorus", "growth",
  "GLOBAL, one-shot. Gated by Phosphorus. Every tip grows 2 segments toward sensed food and stiffens into structural cord — the P counterpart to the W and N growth spikes, better at holding won ground.",
  "Mineral scaffolding thrown up across the whole advancing sheet.",
  buy=7, P=3, timing="flex", produces="growth spike", family="phosphorus",
  targeting="global", growth="2 (all tips)")

C("Mycoparasite Turn", "event", "mould-defense", "energy",
  "RADIUS around a tap (radius 120), one-shot. Turn the tables: consume every Trichoderma cloud in the radius and gain +4 Energy per cloud devoured (flat). The mould->resource converter. Unplayable if no cloud in radius.",
  "The parasite parasitised — the colony eats the mould that came to eat it.",
  buy=7, timing="flex", produces="cloud kill -> energy", threat="mould", family="mould-defense",
  targeting="radius", radius=120)

C("Stinkhorn Decoy", "event", "ant-defense", "defense",
  "DIRECTIONAL, one-shot. Grow a reeking false food body in a chosen direction that ant foragers swarm to and waste 3 rounds harvesting, pulling every trail off your real piles.",
  "Phallus impudicus, stinking of carrion, drawing the insects to nothing.",
  buy=7, timing="flex", produces="ant misdirect", threat="ant", family="ant-defense",
  targeting="directional")

C("Inkcap Deliquesce", "event", "energy-burst", "energy",
  "GLOBAL, one-shot. Fully autolyse ALL occupied substrate for +4 Energy per patch (flat) — the biggest ungated burst. Harsh downside: those patches are emptied to zero, killing their passive income entirely.",
  "Coprinus dissolving itself to black ink overnight, spending everything.",
  buy=9, timing="flex", produces="max energy burst", family="energy-burst", targeting="global",
  notes="Ungated but the harshest downside (patches zeroed). Balances vs gated bursts.")

C("Dormancy Pact", "engine", "energy-engine", "energy",
  "INSTALL. Reduces the SKIP cost by 3 Energy while installed (a cheaper idle). Does NOT print Energy, so it never counts toward the engine ceiling — it just softens the depletion clock.",
  "Slowing the metabolism to a crawl to wait out the lean dark.",
  buy=8, timing="flex", produces="cheaper skip",
  notes="NOT an energy engine (prints nothing); exempt from <11 ceiling. Runway/clock softener.", family="energy-engine")

C("Rhizosphere Priming", "basic", "phosphorus", "phosphorus",
  "GLOBAL. Coax the surrounding soil web for +1 Phosphorus with no rock in range — the free P floor when the crystals are far.",
  "Exudates sweet-talking the whole rhizosphere into sharing its phosphate.",
  timing="flex", produces="phosphorus floor", family="phos-tap", targeting="global")

C("Mycena Glow", "basic", "utility", "route",
  "GLOBAL. Bioluminesce for one action: reveal all food and rock within an expanded radius so you can plan the next route. Free scouting floor tool.",
  "Little green lamps of Mycena, mapping the dark by their own light.",
  timing="flex", produces="reveal", family="grow-basic", targeting="global")

C("Ganoderma Bracket", "engine", "general-defense", "defense",
  "INSTALL. A hard perennial shelf: flat reduction to ALL threat damage each round and slow vitality regen. The cheapest always-on toughness, valuable on any map.",
  "Reishi, the bracket that returns to the same log for a decade.",
  buy=9, timing="flex", produces="flat damage reduction + heal", threat="all", family="general-defense",
  notes="Unconditional; defense engine (exempt).")

C("Hydrophobin Dew", "basic", "water", "water",
  "GLOBAL. Condense atmospheric moisture on the network's own water-repellent surfaces for +1 Water, anywhere, no lake required — the free Water floor to mirror Saprophagy (N) and Rhizosphere Priming (P).",
  "Hydrophobins pearling the dawn air into droplets on every hypha.",
  timing="flex", produces="water floor", family="water-tap", targeting="global",
  notes="+1 floor beneath Guttation Sip's +3 lake tap; the guaranteed W source on lake-sparse maps.")

C("Ammonifying Bore", "event", "dig", "route",
  "DIRECTIONAL, one-shot. Gated by Nitrogen. Rot a rock formation apart with ammonifying acids in a chosen direction — clears ONE formation AND banks +2 Nitrogen from its organic binder. The Nitrogen lane's own dig. Unplayable if no formation is in range.",
  "Ammonia eating the very cement that held the stone together.",
  buy=6, N=2, timing="mid", produces="formation clear + N", threat="none", family="dig-ladder",
  targeting="directional", clears=["formation"],
  notes="Closes the per-resource dig matrix (W & P had digs, N did not). Distinct from W-gated Rhizomorph Pry: one-shot + N gate + N refund.")

C("Rhizomorph Relay", "extender", "draw", "draw",
  "INSTALL. Shuffle 2 Tropic Lunge and 1 Colonise-Pocket-style Radial Flush basic into your draw deck. Balanced runway of push + fill.",
  "Relay cords handing the advance from one bundle to the next.",
  buy=8, timing="flex", produces="+3 basics", family="extender")

# =============================================================================
# WRITE OUT
# =============================================================================
import sys
outdir = sys.argv[1] if len(sys.argv) > 1 else "docs/fable5"
os.makedirs(outdir, exist_ok=True)

# JSON
with open(os.path.join(outdir, "cards.json"), "w", encoding="utf-8") as f:
    json.dump(cards, f, indent=2, ensure_ascii=False)

# CSV (clears serialised as a |-joined string so one cell = one column)
with open(os.path.join(outdir, "cards.csv"), "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    w.writerow(COLUMNS)
    for c in cards:
        row = []
        for col in COLUMNS:
            v = c[col]
            if isinstance(v, list):
                v = "|".join(v)
            row.append(v)
        w.writerow(row)

# ---- self-contained phone review page (dark field-guide) -------------------
cards_js = json.dumps(cards, ensure_ascii=False)
html = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mycelium — Fable-5 Card Field Guide</title>
<style>
:root{--bg:#0a0f0c;--panel:#101a13;--panel2:#0d1610;--line:#1e2f22;--mint:#bfffd0;--mint2:#7fdca0;--dim:#8fae98;--txt:#dCEfd8;--warn:#f2c14e;--w:#69c0ff;--p:#d59cff;--n:#ffd08a;}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(120% 80% at 50% -10%,#12211a 0%,var(--bg) 60%);color:var(--txt);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
header{position:sticky;top:0;z-index:10;background:rgba(10,15,12,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:14px 14px 10px}
h1{margin:0;font-size:18px;letter-spacing:.3px;color:var(--mint)}
.sub{color:var(--dim);font-size:12px;margin-top:2px}
.controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
input[type=search],select{background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:9px;padding:8px 10px;font-size:14px}
input[type=search]{flex:1;min-width:140px}
.stat{color:var(--dim);font-size:12px;margin-top:8px;display:flex;gap:12px;flex-wrap:wrap}
.stat b{color:var(--mint2)}
main{padding:12px 12px 90px;max-width:760px;margin:0 auto}
.card{background:linear-gradient(180deg,var(--panel) 0%,var(--panel2) 100%);border:1px solid var(--line);border-radius:14px;padding:13px 14px;margin:10px 0;box-shadow:0 1px 0 rgba(191,255,208,.03) inset}
.card.up{border-color:#2e6b40;box-shadow:0 0 0 1px #2e6b40 inset}
.card.down{border-color:#6b2e2e;opacity:.62}
.crow{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.cname{font-weight:600;color:var(--mint);font-size:15.5px}
.cost{font-variant-numeric:tabular-nums;color:var(--mint2);font-weight:600;white-space:nowrap}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0 4px}
.tag{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;padding:2px 7px;border-radius:20px;border:1px solid var(--line);color:var(--dim)}
.tag.type{color:var(--mint2);border-color:#295c3a}
.tag.W{color:var(--w);border-color:#274a63}.tag.P{color:var(--p);border-color:#4a2f63}.tag.N{color:var(--n);border-color:#63512f}
.tag.threat{color:var(--warn);border-color:#5c4a20}
.eff{font-size:13.5px;color:var(--txt);margin:6px 0 3px}
.flav{font-size:12px;color:var(--dim);font-style:italic}
.note{font-size:11.5px;color:#6f8f79;margin-top:5px}
.vote{display:flex;gap:8px;margin-top:10px;align-items:center}
.vote button{flex:0 0 auto;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:7px 14px;font-size:16px;cursor:pointer}
.vote button.on-up{background:#173a24;border-color:#2e6b40}
.vote button.on-down{background:#3a1717;border-color:#6b2e2e}
.vote input{flex:1;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:7px 10px;font-size:13px}
footer{position:fixed;bottom:0;left:0;right:0;background:rgba(10,15,12,.95);border-top:1px solid var(--line);padding:10px 12px;display:flex;gap:8px;justify-content:center;backdrop-filter:blur(8px)}
footer button{background:var(--mint);color:#06110a;border:0;border-radius:9px;padding:9px 16px;font-weight:600;font-size:13px;cursor:pointer}
footer button.ghost{background:var(--panel2);color:var(--txt);border:1px solid var(--line)}
dialog{background:var(--panel);color:var(--txt);border:1px solid var(--line);border-radius:14px;max-width:92vw;width:640px}
textarea{width:100%;height:44vh;background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:9px;font:12px/1.5 ui-monospace,monospace;padding:10px}
</style></head><body>
<header>
  <h1>Mycelium · Fable-5 Card Field Guide</h1>
  <div class="sub">Tap 👍 / 👎 on each card. Saved locally on this phone; export when done.</div>
  <div class="controls">
    <input id="q" type="search" placeholder="Search name / effect / flavor…">
    <select id="fCat"></select>
    <select id="fType"></select>
    <select id="fVote"><option value="">all votes</option><option value="up">👍 only</option><option value="down">👎 only</option><option value="none">unrated</option></select>
  </div>
  <div class="stat"><span>Showing <b id="nShown">0</b></span><span>👍 <b id="nUp">0</b></span><span>👎 <b id="nDown">0</b></span><span>rated <b id="nRated">0</b>/<b id="nTotal">0</b></span></div>
</header>
<main id="list"></main>
<footer>
  <button class="ghost" onclick="jump()">Next unrated ↓</button>
  <button onclick="exportFb()">Export feedback</button>
  <button class="ghost" onclick="if(confirm('Clear all your votes on this device?')){localStorage.removeItem(KEY);fb={};render()}">Reset</button>
</footer>
<dialog id="dlg"><textarea id="exp" readonly></textarea><div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end"><button class="ghost" onclick="copyExp()" style="background:#101a13;color:#dCEfd8;border:1px solid #1e2f22;border-radius:9px;padding:8px 14px;cursor:pointer">Copy</button><button onclick="dlg.close()" style="background:#bfffd0;color:#06110a;border:0;border-radius:9px;padding:8px 14px;cursor:pointer">Close</button></div></dialog>
<script>
const CARDS = __CARDS__;
const KEY = "mycelium-fable5-feedback";
let fb = JSON.parse(localStorage.getItem(KEY) || "{}");
const $ = s => document.querySelector(s);
const list = $("#list");
function save(){ localStorage.setItem(KEY, JSON.stringify(fb)); }
function opts(sel, vals, label){ sel.innerHTML = '<option value="">'+label+'</option>' + vals.map(v=>'<option>'+v+'</option>').join(''); }
opts($("#fCat"), [...new Set(CARDS.map(c=>c.category))].sort(), "all categories");
opts($("#fType"), [...new Set(CARDS.map(c=>c.type))].sort(), "all types");
function gate(c){ let g=[]; if(+c.playCostWater)g.push(['W',c.playCostWater]); if(+c.playCostPhosphorus)g.push(['P',c.playCostPhosphorus]); if(+c.playCostNitrogen)g.push(['N',c.playCostNitrogen]); return g; }
function matches(c){
  const q=$("#q").value.toLowerCase().trim();
  if(q && !(c.name+' '+c.effect+' '+c.flavor+' '+c.produces).toLowerCase().includes(q)) return false;
  if($("#fCat").value && c.category!==$("#fCat").value) return false;
  if($("#fType").value && c.type!==$("#fType").value) return false;
  const v=$("#fVote").value, cur=fb[c.name]&&fb[c.name].v;
  if(v==='up'&&cur!=='up')return false; if(v==='down'&&cur!=='down')return false; if(v==='none'&&cur)return false;
  return true;
}
function render(){
  const shown = CARDS.filter(matches);
  list.innerHTML = shown.map(c=>{
    const f=fb[c.name]||{}; const g=gate(c);
    const cost = c.type==='basic' ? 'basic' : (c.buyCostEnergy+'⚡');
    const gtags = g.map(([k,v])=>`<span class="tag ${k}">${v}${k}</span>`).join('');
    const th = c.threat&&c.threat!=='none' ? `<span class="tag threat">${c.threat}</span>`:'';
    const tg = c.targeting ? `<span class="tag">${c.targeting}${c.radius?(' r'+c.radius):''}</span>`:'';
    return `<div class="card ${f.v==='up'?'up':f.v==='down'?'down':''}" data-n="${encodeURIComponent(c.name)}">
      <div class="crow"><span class="cname">${c.name}</span><span class="cost">${cost}</span></div>
      <div class="tags"><span class="tag type">${c.type}</span><span class="tag">${c.category}</span>${gtags}${th}${tg}<span class="tag">${c.timing}</span></div>
      <div class="eff">${c.effect}</div>
      <div class="flav">${c.flavor}</div>
      ${c.notes?`<div class="note">▸ ${c.notes}</div>`:''}
      <div class="vote">
        <button class="${f.v==='up'?'on-up':''}" onclick="vote('${encodeURIComponent(c.name)}','up')">👍</button>
        <button class="${f.v==='down'?'on-down':''}" onclick="vote('${encodeURIComponent(c.name)}','down')">👎</button>
        <input placeholder="note…" value="${(f.note||'').replace(/"/g,'&quot;')}" oninput="note('${encodeURIComponent(c.name)}',this.value)">
      </div></div>`;
  }).join('') || '<p style="color:#8fae98;text-align:center;margin-top:40px">No cards match.</p>';
  const up=Object.values(fb).filter(x=>x.v==='up').length, dn=Object.values(fb).filter(x=>x.v==='down').length;
  $("#nShown").textContent=shown.length; $("#nUp").textContent=up; $("#nDown").textContent=dn;
  $("#nRated").textContent=Object.values(fb).filter(x=>x.v).length; $("#nTotal").textContent=CARDS.length;
}
function vote(n,v){ n=decodeURIComponent(n); fb[n]=fb[n]||{}; fb[n].v = fb[n].v===v?null:v; save(); render(); }
function note(n,t){ n=decodeURIComponent(n); fb[n]=fb[n]||{}; fb[n].note=t; save(); }
function jump(){ const el=[...document.querySelectorAll('.card')].find(c=>{const n=decodeURIComponent(c.dataset.n);return !(fb[n]&&fb[n].v);}); if(el)el.scrollIntoView({behavior:'smooth',block:'center'}); }
function exportFb(){
  const lines=["# Mycelium Fable-5 card feedback","", "total rated: "+Object.values(fb).filter(x=>x.v).length+"/"+CARDS.length,""];
  for(const c of CARDS){ const f=fb[c.name]; if(f&&(f.v||f.note)) lines.push(`${f.v==='up'?'👍':f.v==='down'?'👎':'·'}  ${c.name}${f.note?'  — '+f.note:''}`); }
  lines.push("","## JSON"); lines.push(JSON.stringify(fb,null,2));
  $("#exp").value=lines.join("\\n"); $("#dlg").showModal();
}
function copyExp(){ const t=$("#exp"); t.select(); try{navigator.clipboard.writeText(t.value)}catch(e){document.execCommand('copy')} }
["#q","#fCat","#fType","#fVote"].forEach(s=>$(s).addEventListener('input',render));
render();
</script></body></html>
"""
html = html.replace("__CARDS__", cards_js)
with open(os.path.join(outdir, "review.html"), "w", encoding="utf-8") as f:
    f.write(html)

print(f"Wrote {len(cards)} cards to {outdir}")

# quick integrity summary
from collections import Counter
print("by type:", dict(Counter(c["type"] for c in cards)))
print("by category:", dict(Counter(c["category"] for c in cards)))
print("by threat:", dict(Counter(c["threat"] for c in cards)))
names = [c["name"] for c in cards]
dupes = [n for n,ct in Counter(names).items() if ct>1]
print("DUPLICATE NAMES:", dupes)
