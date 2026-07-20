// =============================================================================
// CONFIG — every gameplay number lives here.
//
// This is the single source of truth for tuning. The dev panel (render/ui.js)
// reads and live-edits values in this object by dotted path (see SLIDERS).
// Engine code must read numbers from here, never hard-code them, so that the
// game stays fully data-driven and tunable (per design A9).
// =============================================================================

export const CONFIG = {
  // ---- World / cross-section geometry (A4) --------------------------------
  // Coordinates: world units. y increases DOWNWARD (canvas-natural).
  //   y <  surfaceY  -> open air (above the soil line)
  //   y >= surfaceY  -> underground (the main play surface)
  world: {
    width: 2600,        // world width in units
    height: 1500,       // CONTENT height (top = sky, bottom = deepest generated ground)
    bottomBuffer: 2160, // extra empty dirt below the content that fades to black — lets
                        //   you scroll the deepest content clear of the bottom UI. Sized so
                        //   that even fully zoomed out on a phone portrait (height-limited
                        //   min-zoom, no vertical scroll), the buffer alone fills the
                        //   carousel-covered band, leaving ALL content above it. NO
                        //   rocks/food/etc. are generated here; camera + renderer only.
    surfaceY: 380,      // y of the soil line; air above, underground below
    cellSize: 36,       // substrate grid cell size (square)
  },

  // ---- Substrate field + surface terrain generation (A4, B1) -------------
  substrate: {
    // Traversal level: enter at the far left, cross underground to the goal soil
    // on the far right, surface there and fruit. The middle is un-surfaceable.
    goalCols: 6,                 // width of the right-hand fruitable GOAL zone (cols)
    goalSummerCols: 7,           // cols just LEFT of the goal kept clear of dark-world features — the summery landscape approach
    startCols: 2,                // width of the left entry zone (cols)
    barrierSegMinCols: 4,        // min run-length of one barrier-terrain segment
    barrierSegMaxCols: 10,       // max run-length (concrete / mountain / lake)
    foodClusterCount: 8,         // caches along the route (before duff down-tier + feature caches)
    foodClusterRadiusMin: 1,     // small stepping-stone pockets (don't sink the node budget)
    foodClusterRadiusMax: 1,
    foodCellNutrient: 50,        // every food cell is worth the same — a pile's value is its SIZE
    foodRockBuffer: 2.2,         // min clearance (cells) food keeps from rock — boulders spill past their cells
    foodPileGapCells: 3,         // min separation (cells) a new pile keeps from other piles, so distinct
                                 //   piles don't merge into one blob (best-effort; falls back if no room)
    foodEnergyMin: 2,            // a DRAFTING (orange) pile's fixed Energy value is a roll in [min,max]…
    foodEnergyMax: 3,            //   …decoupled from nutrient (see substrate.js drop())
    // DUFF caches: a fraction of the route/feature caches are down-tiered to LOW-VALUE
    // "duff" — brown decayed leaf litter. Same food you colonise + digest, a SMALLER
    // Energy yield, and NO card draft. Cuts drafting without starving map energy; renders
    // as brown/desaturated oak-maple leaves (foodKind 'duff').
    duffClusterFraction: 0.5,    // share of drafting caches converted to duff (~half → yellow, half orange)
    duffEnergyMin: 1,            // a duff pile's fixed Energy value is a roll in [min,max] — lower than orange
    duffEnergyMax: 2,
    // ENGINE caches: rarer, high-value RED-leaf litter piles that draft an ENGINE card
    // (normal piles draft basic/event). Colonise + digest them like any cache; they just
    // render as red maple/autumn leaves. Placed mostly near the surface so the player must
    // climb UP (away from the goal) to reach these valuable piles.
    engineClusterMin: 1,         // RED engine caches per map: a random count in [min,max] — pinned to exactly 1
    engineClusterMax: 1,
    engineEnergyMin: 3,          // a RED engine pile's fixed Energy value is a roll in [min,max] — highest tier
    engineEnergyMax: 4,
    engineClusterRadius: 1,      // footprint radius (cells) — a small pocket like normal caches
    engineSurfaceRows: 2,        // "near surface" band: rows [0, this] below the surface
    engineDeepChance: 0.25,      // fraction placed deeper (not all right at the surface)
    // Rock landmarks come in two kinds:
    //   • FORMATIONS — a few large, unique AI-rendered rock-formation sprites
    //     (crystal / ember / fungal / glow). Wide-and-low footprints so the art
    //     draws at its native aspect. The mycelium routes around them.
    //   • lone BOULDERS — scattered single old-style rocks, one sprite each,
    //     never piled.
    formationCount: 14,          // big single-image rock formations scattered per map (the larger, colourful type)
    formationWidthMinCols: 5,    // footprint width (cols) — wide & low to match the art
    formationWidthMaxCols: 11,
    rockCount: 34,               // scattered lone boulders (1 cell each, drawn as a single rock — varied large/small)
    rockRadiusMin: 0,
    rockRadiusMax: 0,
    // Rock COLUMNS — the path-blocking barriers. Each is a near-vertical (±30°)
    // stack of 2–4 distinct, large rock-formation sprites running from the
    // surface down to depth; the mycelium must dig UNDER them. 2–6 per map.
    columnCountMin: 2,
    columnCountMax: 6,
    columnWidthCols: 2,          // impassable footprint width (cols)
    columnDepthMinRows: 7,       // reaches at least this deep…
    columnDepthMaxRows: 12,      // …up to this — the deeper, the longer the dip under
                                 //   (rocks stand vertically, so 2–4 reach well down)
    columnTiltMaxDeg: 30,        // whole-column lean from vertical (±)
    pathRows: 2,                 // height of the guaranteed clear route carved beneath barriers
    mountainCount: 3,            // mountain landmarks per map — one of each variant (distinct sprites)
    // Lake basins: large water-filled cross-sections carved into the earth. The
    // water is IMPASSABLE — the mycelium must route UNDER each basin.
    lakeCountMin: 1,             // exactly one lake per map
    lakeCountMax: 1,
    lakeWidthMinCols: 8,         // basin width (cols) — wide enough to read as a cross-section
    lakeWidthMaxCols: 14,
    lakeAspect: 2.8,             // basin width:depth — matches the lake art so it draws undistorted
    lakeDepthMinRows: 3,         // clamp: bowl depth at the centre (rows)
    lakeDepthMaxRows: 8,
    // Underground water reservoirs: small IMPASSABLE water pockets tucked just
    // above the winnable corridor. Touching one (like touching the lake) grants a
    // trickle of Water income — a survival lifeline scattered along the route.
    reservoirCountMin: 1,        // 1–3 reservoirs per map
    reservoirCountMax: 3,
    reservoirRadiusMin: 2,       // blob radius in cells (small pockets)
    reservoirRadiusMax: 3,
    reservoirClearCells: 2,      // lake/column/food-free halo (cells) required around a pocket for PLACEMENT (kept modest so pockets still fit)
    reservoirRockClearCells: 4,  // radius (cells past the pool) in which BOULDERS + FORMATIONS are carved away — must exceed the max rock-sprite spill (large boulders render ~3.3 cells / ~2-cell reach; formations overhang their footprint) or rocks visibly overlap the pool
    hazardCount: 0,              // toxic pools removed
    hazardRadiusMin: 1,
    hazardRadiusMax: 3,
    shadeFraction: 0.45,         // ~fraction of GOAL soil columns that are shaded
    // Colonisation advances per GROW cycle: each Grow, the mycelium branches
    // within occupied substrate and makes this much progress, so ~1/this grow
    // cycles are needed to fully colonise (and densely branch) a pocket.
    // (0.166 ≈ 6 grow cycles — one more round of branching than before.)
    colonizeRate: 0.166,
    entryBurst: 9,               // branches sprayed the FIRST time a strand enters a food pocket
                                 //   (fans across the cell so it reads as fully colonised at once)
  },

  // ---- Resources (A3, B3) -------------------------------------------------
  energy: {
    start: 50,                   // starting Energy (SLIDER) — tight: ~3 draws or 4 skips before you must feed
    baselineTrickle: 0,          // no free per-turn trickle — energy comes only from colonising food
    passiveIncomeRate: 25,       // nutrient pulled from each colonised cell/turn — a fully-colonised pile (50/cell) empties in 2 steps (SLIDER)
    incomeEfficiency: 0.6,       // Energy gained per unit nutrient consumed
  },

  // ---- Turn loop (A2, B4) -------------------------------------------------
  turn: {
    movesPerTurn: 3,             // moves available each turn (SLIDER)
  },

  // ---- Card economy (C1) --------------------------------------------------
  // The card layer sits on top of the action sim. ENERGY (net.energy) is the
  // master currency, spent to DRAW (3 cards at once) / SKIP. TWO resources gate
  // PLAYS: WATER = growth + substrate; PHOSPHORUS = digest/defense/work, harvested
  // from rocks. Each card's own W/P costs live in the generated card data
  // (src/cards-data.js); these are the loop-wide knobs.
  cards: {
    enabled: true,               // turn the card layer on
    drawCostEnergy: 16,          // energy to DRAW (pulls drawCount cards at once)
    drawCount: 3,                // cards pulled per Draw
    draftBasicCopies: 3,         // drafting an (infinite) BASIC card grants this many copies; event/engine give 1
    draftBasicWeight: 0.6,       // in a NORMAL (basic/event) draft, chance each slot is a Basic vs an Event (~60/40)
    skipCostEnergy: 3,          // energy to SKIP a round (advance the world, draw nothing)
    handStartMax: 12,            // cap on the opening premium hand (tutorial uses fewer)
    startWater: 10,              // starting Water (covers grow AND substrate; ~10 grows before you must harvest)
    startPhosphorus: 0,          // starting Phosphorus (earn it from rocks via Phosphate Tap; gates digest/defense)
    softCapWater: 999,           // per-resource stockpile caps — set high so harvesting/income
    softCapPhosphorus: 999,      //   keeps paying off and you can bank resources for big plays

    engineEnergyClamp: 11,       // total installed energy-engine output/round is clamped below skip
    // resource harvest amounts (used by harvest-card effects)
    harvestWaterLake: 9,         // Hyphal Osmosis at a lake edge
    harvestWaterSoil: 3,         // …off a lake
    harvestPhosphorus: 5,        // Phosphate Tap on mineral/boulder contact
    // substrate patch sizes (nutrient) placed at the sensing-range edge
    substrateSmall: 40,
    substrateMedium: 70,
    substrateLarge: 110,
    acornCacheEnergy: 2,         // Acorn Cache pile digests to exactly this much Energy total (not the default per-nutrient rate)
    // Growth distances follow one convention: 1 "step" ≈ 3 cells.
    reachSegments: 18,           // Rhizomorph Lance / Fruiting Vigil / Rhizomorph Cable: "6 steps" forward (6 × 3)
    directionalSteps: 9,         // Apical Drive / Leading Cord: "3 steps" in a direction (3 × 3) — buffed 2→3
    grow4Segments: 12,           // paid grow-4 family (Turgor Thrust/Vesicle Surge/Turgor Line/Vesicle Supply Line): "4 steps" (4 × 3)
    grow5Segments: 15,           // paid grow-5 family (Guerrilla Runners/Translocation Cord/Explorer Cord/Bulk-Flow Cord): "5 steps" (5 × 3)
    foodSeekSteps: 2,            // food-seek grows (Hyphal Extension / Colonizing Front): how many grow() passes per play — buffed 1→2
    lungeSegments: 15,           // Tropic Lunge: "5 steps" toward food (5 × 3)
    foragingFanCells: 3,         // (legacy omni fan — kept for reference; Foraging Fan is now directional)
    // Foraging Fan / Forager Bloom: an AIMED RECURSIVE fern — primary rays around the aim,
    // each limb forks into shorter child limbs over `fanGens` generations, filling a full
    // fan. Deepest path ≈ fanSteps segments; fanBudget caps the total so it never explodes.
    fanSteps: 9,                 // "3 steps" (3 × 3) — depth of the deepest path along the fan
    fanRays: 3,                  // primary limbs spread around the aim (the base of the fan)
    fanSpread: 0.5,              // angle (radians) between adjacent primary limbs
    fanGens: 2,                  // fork generations beyond the primary limbs (0 = straight rays)
    fanForks: 2,                 // children each limb forks into
    fanForkAngle: 0.5,           // angle (radians) a child limb diverges from its parent
    fanFalloff: 0.7,             // child limb length ÷ parent (also sizes the primary limb so gens sum to fanSteps)
    fanBudget: 60,               // hard cap on total segments grown by one fan (keeps it full but bounded)
    amputateRadius: 50,          // Amputate / Severing Cords: remove mycelium within this world radius
    snapRadius: 55,              // Constricting Snap: catch the nearest nematode within this radius
    toxocystRadius: 65,          // Toxocyst Burst / Array: paralyse every nematode within this radius
    // defense durations / radii
    immuneRounds: 10,            // harden/immune cards (Sclerotial Crust/Rind, Crust Reserve, Melanized Wall)
                                 //   grant infection/eating immunity for this many rounds (was permanent)
    crustRadius: 60,             // Sclerotial Crust / Rind: harden radius
    reserveRadius: 40,           // Crust Reserve: harden radius
    suberinRadius: 80,           // Melanized Wall: clear + ward radius
    rehydrateRadius: 90,         // Rehydration Pulse: heal radius (was 60 → +50%)
    sealReach: 8,                // Sclerotial Seal: seal the whole nearest food pile within this many cells (forgiving)
  },

  // ---- Growth: 2D space-colonization (A8, B2) ----------------------------
  growth: {
    sensingRadius: 135,          // tips sense substrate attractors within this radius
    killDistance: 22,            // attractor is consumed when a node gets this close
    segmentLength: 17,           // length of one growth segment
    // Rock collision is FIRM and FINE: a strand may never sit under drawn rock. It's
    // enforced by a ¼-cell solid mask (main.js solidifyRock → substrate.solidAtWorld),
    // which matches the visible sprite, so there's no overlap knob — growth stops at the
    // visible edge and threads real gaps. Routing around rock is handled generously by
    // the grow cards' dodge/offset search (network.js growDirected DODGE, _growStep
    // offsets, growRadial ARC), NOT by letting strands grow into the rock.
    stepsPerGrow: 7,             // space-colonization iterations per Grow action
    maxNodes: 6000,              // safety cap on network size (raised: buffed growth + colonisation fills the old 2500 in ~18 plays)
    attractorThreshold: 1,       // any cell with food attracts growth (so no scraps get left behind, which confuses players)
    branchJitter: 0.22,          // random angular wobble for organic look (radians)
    foragingFanRays: 8,          // Foraging Fan: new strands sprouted per tip, around the circle
    startDepth: 20,              // initial seed depth below the surface line (tiny starting sprout)
    minTipSpacing: 11,           // don't spawn a node this close to an existing one
    // Experimental side-branching: as a strand grows, EACH step has this chance to
    // sprout a small extra strand from a random point along the strand-so-far, heading
    // in a random direction. Non-recursive (side-strands don't branch again) and
    // collision-aware. Applies to every grow primitive (directional, fan, lunge,
    // undirected) — see network.js _sproutSideStrand.
    sideStrandChance: 0.6,       // 60% per growth step
    sideStrandMin: 1,            // side-strand length in segments (inclusive range)
    sideStrandMax: 3,
    // A side-strand that rolls the FULL max length has this chance to sprout one
    // extra length-1 twig off itself (see network.js _sproutSideStrand).
    sideStrandForkChance: 0.5,
    // --- water bodies (lake / reservoir): income + auto-reach helper ---------
    // Income (the Aquifer Tap trickle) only kicks in when a strand is VISIBLY HUGGING the
    // water — a node within this many world units of a water cell's edge (~0.4 cell). The
    // water-seek helper below reliably creeps a tip to within ~7px of the edge, so this is
    // set just above that: income pays exactly when a strand you can SEE reaches the water.
    waterContactDist: 14,
    // Water-seek helper: whenever a tip is within SENSING RANGE (sensingRadius above) of a
    // water body, a free extra strand grows toward the water (like food) and creeps its tip
    // right up to the edge so contact is visible — never overlapping. A pool fills up to this
    // many helper strands as the colony nears from different tips (one per grow), then stops —
    // enough help to reliably tap it without matting the water. See network.js reachForWater.
    waterHelperMaxStrands: 3,
  },

  // ---- Vitality / health (A5, A8) ----------------------------------------
  vitality: {
    hazardDamagePerTurn: 0.07,   // health lost by a node sitting in a hazard cell
    recoveryPerTurn: 0.015,      // node health regained per turn when safe & fed
    starvationDamage: 0.05,      // health lost network-wide per turn when starving
    deadNodeHealth: 0.0,         // health at/below which a node is pruned
    dipDecayPerTurn: 0.03,       // how fast a transient vitality dip (Digest) recovers
    maxVitalityDip: 0.9,         // cap on stacked transient vitality dips
  },

  // ---- Threat: Trichoderma (A2/A5, B6) -----------------------------------
  // Trichoderma is a few discrete, roughly fixed-size CLOUDS that roam toward
  // food, eat what they pass without growing much, and spend themselves fading
  // away after they infect you (so each cloud infects you ~once).
  trichoderma: {
    initialPatches: 3,           // number of roaming mold clouds on the map
    cloudRadiusMin: 0.8,         // starting cloud size in grid cells — small (~3 cells across)
    cloudRadiusMax: 1.3,         // HARD cap — a cloud never grows big, however much it eats
    growthPerEat: 0.02,          // radius gained per action it's eating (tiny — stays ~the same size)
    sightRadius: 500,            // how far (world units) a cloud senses food/you and heads for it; rock blocks line of sight (SLIDER); shown on screen as a soft ring
    moveSpeed: 1.5,              // cells per ACTION a cloud creeps toward its nearest target (SLIDER)
    consumeReachMult: 2.2,       // cells within (cloud radius × this) are eligible to be eaten each action
    leavesPerRound: 0.22,        // AVERAGE food cells ("leaves") a cloud clears per round (may be fractional —
                                 //   accumulated in a per-cloud budget, nearest cells first). ~2/9 (≈1 cell every
                                 //   ~4–5 rounds) — 9× slower than the original 2/round, so a pile is slow to
                                 //   finish and scales with its size.
    fadeTurns: 3,                // after infecting you, a cloud dies off and vanishes over this many steps (actions or end-turns)
    seedMinColonyDistFrac: 0.2,  // clouds seed in OPEN ground at least this fraction of the map-width from the colony, so they visibly creep IN toward food/you
    respawnChance: 0.12,         // per action, chance a faded cloud is replaced by a fresh one creeping in (keeps the threat present)
    guardAnchors: null,          // optional list of scripted-gate anchors where the FIRST clouds are forced to seed (e.g. level 2's gauntlet — main.js configForLevel sets it per level); null → all clouds roam. Each anchor is EITHER world-relative {xFrac,depthFrac} (fractions of width / soil depth) OR goal-hill-relative {goalRelX (0=hill left edge,1=right), depthCells (rows below surface)}
    guardAnchorRockGap: 1,       // a guardAnchor cloud keeps at least this many cells clear of rock (small → lands as close to the anchor as possible; relaxed automatically if even that has no open spot)
    // --- network infection (a cloud's edge touching you turns strands green) ---
    contactChance: 1.0,          // edge touch = infection, immediately (Melanize gives a chance to resist)
    growInfectThreshold: 0.05,   // a strand standing in a trich-field cell ≥ this is infected on the spot (growing INTO mould) — so it can't fruit/win at the goal
    contactChunk: 4,             // the breach instantly claims this many rings of mycelium
    spreadDepthPerTurn: 6,       // once inside, the rot races this many rings along your filaments each step (runs on every action AND on end-turn)
    infectionSpreadChance: 0.85, // chance the rot takes each step of that race (SLIDER) — high = real consequences
  },

  // ---- The six basic actions (A2, B5) ------------------------------------
  // Each: moveCost (moves spent) + energyCost (Energy spent) + effect params.
  actions: {
    grow: {
      moveCost: 1,
      energyCost: 10,            // (SLIDER)
    },
    addSubstrate: {
      moveCost: 1,
      energyCost: 12,            // (SLIDER)
      amount: 20,                // SMALL nutrient — enough to attract growth, not to feed it
      radius: 1,                 // tiny footprint (a dot to lure toward, not a pile)
    },
    amputate: {
      moveCost: 1,
      energyCost: 4,
      radius: 60,                // cut radius (world units) — removes ALL strands inside it (SLIDER)
    },
    attackAnts: {
      moveCost: 1,
      energyCost: 30,            // expensive: ~3 bombs (each -40% HP) to destroy a nest
      damageFrac: 0.4,           // fraction of MAX nest HP removed per bomb
      pickRadius: 140,           // click tolerance (world units) — covers the underground colony
    },
    excrete: {
      moveCost: 1,
      energyCost: 10,            // affordable to repeat under a swarm (SLIDER)
      range: 80,                 // world units around ANY strand the sticky mucus reaches (SLIDER)
      stickTurns: 1,             // ticks a hit worm is stuck (no move / feed / breed)
    },
    digest: {
      moveCost: 1,
      energyCost: 8,
      drainFraction: 0.5,        // drains this fraction of EACH occupied cell per use — 2 uses fully digests (SLIDER)
    },
    fruit: {
      moveCost: 1,
      energyCost: 22,
      payoutPerBody: 11,         // Spores per fruiting body (SLIDER)
      shadeMultiplier: 1.8,      // shaded soil yields more (SLIDER)
      vitalityFloor: 0.3,        // minimum payout multiplier a sickly network still gets
      clusterWidth: 3,           // soil columns per fruiting body
      reachDepth: 170,           // node must be within this depth of surface to fruit
      reachSpread: 30,           // horizontal tolerance from a soil column
    },
  },

  // ---- Ants (A2, B6) — a fixed territorial threat + food rival ------------
  // A nest near the surface runs a trail to the nearest food and harvests it,
  // working through the whole map (nests see everything — no sight limit). The
  // trail is impassable to your growth. You go around, bomb the nest, or race
  // them to the food so they relocate.
  ants: {
    nestCount: 2,                // nests seeded per (sandbox) map
    maxHp: 100,
    harvestRate: 40,             // nutrient an active nest carries off its target food per action (SLIDER) — eats a pile in ~half the time
  },

  // ---- Nematodes (A2, B6) — fungivorous worms that graze your frontier ----
  // A few worms wander until a strand enters their sight (rock blocks line of
  // sight). Then they crawl in fast, eat strands whole, and MULTIPLY as they
  // feed — so an ignored swarm snowballs. Countered by the Excrete action.
  nematodes: {
    initialCount: 3,             // wandering worms seeded per sandbox map
    seedMinColonyDistFrac: 0.25, // seed at least this fraction of the map from the colony
    sightRadius: 500,            // detection range (matches the mould's); rock blocks line of sight (SLIDER)
    crawlSpeed: 3.0,             // cells/tick toward a sensed strand — fast (SLIDER)
    wanderSpeed: 1.0,            // cells/tick while searching
    reach: 0.7,                  // cells: how close to a strand before it feeds
    eatEveryTicks: 0,            // cooldown ticks between bites: a feeding worm eats a strand,
                                 //   then waits this many ticks — so it devours one every N+1
                                 //   ticks (0 → every tick; 1 → every other tick). Lower = deadlier. (SLIDER)
    breedChance: 0.8,            // chance a feeding worm splits each tick — snowballs the swarm fast (SLIDER)
    killHits: 3,                 // Excrete hits to kill one
    maxPopulation: 150,          // hard cap — a safety net, not a visible ceiling (SLIDER)
    respawnChance: 0.06,         // slow trickle of new wanderers up to initialCount
  },

  // ---- Rendering / feel (A8) — visual only, never gameplay ---------------
  // A cross-section: a bright daytime sky over rich, textured earth, with the
  // dark underground lit by the luminous mint network colonising organic matter.
  render: {
    // sky / air — deep twilight night so the underground life-light is the star
    skyTop: '#060b14',                    // deep night blue
    skyHorizon: '#2c4a5e',                // luminous twilight horizon (silhouettes props)
    horizonGlow: 'rgba(120,180,205,0.30)',// cool twilight haze hugging the surface
    sun: 'rgba(170,205,232,0.30)',        // a soft moon, not a sun
    sunWash: 'rgba(110,160,195,0.10)',    // faint cool light over open soil
    shadeWash: 'rgba(36,66,98,0.24)',     // cooler light under canopy
    canopy: 'rgba(9,18,17,0.6)',          // foliage silhouette over shade
    // earth strata (top -> deep) — rich earthy brown, darkening with depth
    soilTop: '#5e4528',
    soilMid: '#45331e',
    soilDeep: '#2a1d12',
    rock: '#23262c',             // small buried pebbles
    rockLip: '#3a4656',
    // impassable rock formations (cold dark slate)
    rockMass: '#1c2027',
    rockFacet: '#2b313b',
    rockShadow: 'rgba(0,0,0,0.55)',
    rockEdge: 'rgba(0,0,0,0.55)',
    vein: 'rgba(120,155,175,0.22)',       // cool mineral veins
    fleck: 'rgba(150,225,200,0.45)',      // faint mint mineral flecks
    // substrate = decaying organic matter (rotting wood + leaf litter)
    detritusBase: '#2a2417',              // dark rotting mass
    detritusWood: '#5a4a2c',              // woody chips / twigs
    detritusLeaf: '#3f4a26',              // leaf litter
    detritusEdge: 'rgba(6,5,3,0.6)',      // outline
    mat: '230,242,228',                   // mycelial mat (rgb) overgrowing it
    foodVein: '#f2d784',
    // hazards (toxic pools / nests)
    hazardDeep: '#34112c',
    hazardMid: '#741f3d',
    hazardCaustic: 'rgba(78,210,176,0.8)',
    hazardBubble: 'rgba(150,240,210,0.5)',
    // surface
    crust: '#241d14',
    crustLip: '#3a2f20',
    grassSun: '#4a7a52',
    grassShade: '#2f5a66',
    concrete: '#1e2228',
    concreteCrack: 'rgba(0,0,0,0.5)',
    // un-surfaceable terrain (the impassable middle of a level)
    waterSurface: '#3f8197',               // lake — bright sky-reflecting waterline
    water: '#1d4254',                      // lake — mid cool water
    waterDeep: '#0e2935',                  // lake — dark deep water at the bowl bottom
    waterLip: 'rgba(150,205,228,0.7)',     // reflective surface line
    waterGlint: 'rgba(200,235,248,0.6)',   // ripple highlights
    lakeBed: '#6f5d3c',                     // silt lakebed along the bowl curve
    waterPlantStalk: '#2c6f5a',             // bioluminescent aquatic plant stalk
    waterPlantGlow: 'rgba(130,240,205,0.9)',// glowing bulb at the plant tip
    waterFish: 'rgba(190,225,238,0.5)',     // pale drifting fish
    mountainRock: '#2c2a26',               // raised rocky ridge (warm dark stone)
    mountainFacet: 'rgba(120,120,130,0.18)',// lit facet on the ridge
    goalSoil: '#5a7a44',                   // the goal reads as sunlit, living ground
    goalGlow: 'rgba(150,225,150,0.30)',    // soft warm glow marking the exit
    // Trichoderma
    trich: '#8aa23e',
    trichSpore: '#d2e074',
    infected: '#a6c63a',         // a strand the mould has overrun (green/dead)
    warded: '#2f5fe6',           // a strand hardened/warded by a defense card — a deep blue "crust",
                                 //   distinct from the pale-mint colony and yellow-green mould
    // the living network (luminous accent — the brightest thing on screen)
    filament: '#cfe8d6',
    tipGlow: '#bfffd0',
    sensingRing: 'rgba(160,255,190,0.15)',
    pulseColor: '#eafff0',
    pulseSpeed: 70,              // pulse travel speed (units/sec)
    minBrightness: 0.45,        // brightness floor so the network never washes out
    // atmosphere
    spore: 'rgba(202,255,216,0.75)',
    mote: 'rgba(150,205,195,0.42)',
    particleCount: 80,
    // dynamic lighting: the network/food/hazards emit light into the dark earth
    lighting: true,
    ambientLight: 0.62,         // unlit earth stays a visible warm brown; life adds glow (1 = lighting off)
    networkLight: 'rgba(150,255,190,1)',
    foodLight: 'rgba(255,196,120,1)',
    hazardLight: 'rgba(90,220,200,1)',
    senseLight: 'rgba(170,205,180,1)', // soft glow marking the sensed (in-range) area
    lightRadius: 64,            // base light radius (world units)
  },

  dev: {
    enabled: false,             // dev cheats + sliders panel (off — hidden from the game UI)
    cheatEnergy: 100,
    cheatSpores: 100,
  },
};

// -----------------------------------------------------------------------------
// SLIDERS — the ~8 key constants exposed as live on-screen sliders (B7).
// Each references CONFIG by dotted path so edits take effect immediately.
// -----------------------------------------------------------------------------
export const SLIDERS = [
  { path: 'energy.start',                label: 'Starting Energy',     min: 0,   max: 400, step: 5 },
  { path: 'energy.passiveIncomeRate',    label: 'Passive Income Rate', min: 0,   max: 60,  step: 1 },
  { path: 'actions.grow.energyCost',     label: 'Grow Energy Cost',    min: 0,   max: 40,  step: 1 },
  { path: 'trichoderma.moveSpeed',       label: 'Mold Creep (speed)',  min: 0,   max: 5,   step: 0.5 },
  { path: 'trichoderma.sightRadius',     label: 'Mold Sight Range',    min: 100, max: 1500, step: 50 },
  { path: 'trichoderma.infectionSpreadChance', label: 'Infection Spread', min: 0, max: 1, step: 0.05 },
  { path: 'actions.amputate.radius',     label: 'Amputate Radius',     min: 20,  max: 160, step: 5 },
  { path: 'ants.harvestRate',            label: 'Ant Harvest Rate',    min: 0,   max: 200, step: 5 },
  { path: 'actions.attackAnts.energyCost', label: 'Attack Ants Cost',  min: 0,   max: 80,  step: 5 },
  { path: 'nematodes.sightRadius',       label: 'Nematode Sight',      min: 100, max: 700, step: 20 },
  { path: 'nematodes.crawlSpeed',        label: 'Nematode Speed',      min: 0.5, max: 6,   step: 0.5 },
  { path: 'nematodes.eatEveryTicks',     label: 'Worm Eat Cooldown',   min: 0,   max: 5,   step: 1 },
  { path: 'nematodes.breedChance',       label: 'Nematode Breed Rate', min: 0,   max: 1,   step: 0.05 },
  { path: 'nematodes.maxPopulation',     label: 'Nematode Max',        min: 20,  max: 400, step: 10 },
  { path: 'actions.excrete.energyCost',  label: 'Excrete Cost',        min: 0,   max: 40,  step: 2 },
  { path: 'actions.excrete.range',       label: 'Excrete Range',       min: 20,  max: 200, step: 10 },
  { path: 'actions.fruit.payoutPerBody', label: 'Fruit Payout / Body', min: 0,   max: 40,  step: 1 },
  { path: 'actions.digest.drainFraction', label: 'Digest Drain / Use',  min: 0.1, max: 1,   step: 0.05 },
  { path: 'actions.digest.energyCost',   label: 'Digest Energy Cost',  min: 0,   max: 40,  step: 1 },
  { path: 'actions.fruit.shadeMultiplier', label: 'Shade Multiplier',  min: 1,   max: 3,   step: 0.1 },
  { path: 'render.ambientLight',          label: 'Ambient Light',       min: 0.1, max: 1,   step: 0.05 },
];

// Read/write CONFIG by dotted path (used by the dev sliders).
export function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
export function setByPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
