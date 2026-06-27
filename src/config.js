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
    height: 1500,       // world height in units (top = sky, bottom = deep ground)
    surfaceY: 380,      // y of the soil line; air above, underground below
    cellSize: 36,       // substrate grid cell size (square)
  },

  // ---- Substrate field + surface terrain generation (A4, B1) -------------
  substrate: {
    foodClusterCount: 9,         // fewer, rarer pockets — reaching them is the game
    foodClusterRadiusMin: 1,     // small, concentrated pockets
    foodClusterRadiusMax: 3,
    foodCellNutrient: 100,       // every food cell is worth the same — a pile's value is its SIZE
    rockCount: 7,                // impassable rock formations to route around
    rockRadiusMin: 2,
    rockRadiusMax: 5,
    hazardCount: 0,              // toxic pools removed
    hazardRadiusMin: 1,
    hazardRadiusMax: 3,
    // Surface line: alternating segments of soil (fruitable) / non-soil.
    surfaceSegmentMinCols: 3,    // min width of a surface segment, in grid columns
    surfaceSegmentMaxCols: 11,
    soilFraction: 0.6,           // ~fraction of surface segments that are soil
    shadeFraction: 0.45,         // ~fraction of soil columns that are shaded
    // Deliberate tension: tuck some rich food against rock / under non-soil so
    // reaching it means routing around obstacles (B1).
    richNearHazardChance: 0,     // (no hazards now)
    richNearRockChance: 0.4,
    richUnderNonSoilChance: 0.4,
    // Colonisation advances per GROW cycle: each Grow, the mycelium branches
    // within occupied substrate and makes this much progress, so ~1/this grow
    // cycles are needed to fully colonise (and densely branch) a pocket.
    colonizeRate: 0.2,
  },

  // ---- Resources (A3, B3) -------------------------------------------------
  energy: {
    start: 120,                  // starting Energy (SLIDER)
    baselineTrickle: 2,          // small free trickle (you depend on colonising food)
    passiveIncomeRate: 34,       // nutrient pulled from each colonised cell/turn — ~3 turns to empty a cell (SLIDER)
    incomeEfficiency: 0.6,       // Energy gained per unit nutrient consumed
  },

  // ---- Turn loop (A2, B4) -------------------------------------------------
  turn: {
    movesPerTurn: 3,             // moves available each turn (SLIDER)
  },

  // ---- Growth: 2D space-colonization (A8, B2) ----------------------------
  growth: {
    sensingRadius: 135,          // tips sense substrate attractors within this radius
    killDistance: 22,            // attractor is consumed when a node gets this close
    segmentLength: 17,           // length of one growth segment
    stepsPerGrow: 7,             // space-colonization iterations per Grow action
    maxNodes: 1500,              // safety cap on network size
    attractorThreshold: 6,       // min cell nutrient to emit a growth attractor
    branchJitter: 0.22,          // random angular wobble for organic look (radians)
    startDepth: 130,             // initial seed depth below the surface line
    minTipSpacing: 11,           // don't spawn a node this close to an existing one
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
    cloudRadiusMin: 1.6,         // starting cloud size, in grid cells
    cloudRadiusMax: 3.0,         // HARD cap — a cloud never grows giant, however much it eats
    growthPerEat: 0.03,          // radius gained per turn it's eating (tiny — stays ~the same size)
    moveSpeed: 2.0,              // cells/turn a cloud creeps toward the nearest food (SLIDER)
    consumeFraction: 0.6,        // food drained per turn from cells under the cloud (~2 turns to clear)
    fadeTurns: 2,                // after infecting you, a cloud vanishes completely over this many turns
    seedFoodBias: 0.8,           // chance a cloud starts near a food cluster
    spawnChancePerTurn: 0.0,     // ambient new clouds (0 = only seeded + dev spawn)
    // --- network infection (a cloud's edge touching you turns strands green) ---
    contactChance: 1.0,          // edge touch = infection, immediately (Melanize gives a chance to resist)
    contactChunk: 4,             // the breach instantly claims this many rings of mycelium
    spreadDepthPerTurn: 3,       // once inside, the rot races this many rings along your filaments each turn
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
      amount: 70,                // nutrient deposited at the centre cell
      radius: 2,                 // deposit radius in cells (falls off to edge)
      lureStrength: 1.8,         // attractor weight multiplier for placed food
    },
    amputate: {
      moveCost: 1,
      energyCost: 4,
      pickRadius: 28,            // click tolerance (world units) for picking a strand
    },
    express: {
      moveCost: 1,
      energyCostBase: 16,        // cost of taking a trait from level n -> n+1
      energyCostPerLevel: 9,     // added per current level (escalating)
      maxLevel: 5,
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

  // ---- Genetic defence trait (A2, B5) — kept deliberately simple ----------
  traits: {
    // The one defence: broad passive armour AND it resists the INITIAL
    // Trichoderma contact (it does NOT slow the spread once inside you).
    melanize: { damageReductionPerLevel: 0.16, contactResistPerLevel: 0.18 },
  },

  // ---- Rendering / feel (A8) — visual only, never gameplay ---------------
  // A cross-section: a bright daytime sky over rich, textured earth, with the
  // dark underground lit by the luminous mint network colonising organic matter.
  render: {
    // sky / air (daytime)
    skyTop: '#3f86c8',                    // daytime blue
    skyHorizon: '#cbe4ea',                // pale haze near the horizon
    horizonGlow: 'rgba(255,244,214,0.4)', // warm daylight haze
    sun: 'rgba(255,250,232,0.95)',        // the sun
    sunWash: 'rgba(255,238,188,0.20)',    // warm light over sunny soil
    shadeWash: 'rgba(74,118,150,0.26)',   // cool light over shaded soil
    canopy: 'rgba(46,74,42,0.5)',         // foliage silhouette over shade
    // earth strata (top -> deep) — earthy brown all the way down, never black
    soilTop: '#6d5132',
    soilMid: '#4c3722',
    soilDeep: '#2f2114',
    rock: '#41382d',             // small buried pebbles
    rockLip: '#5b5040',
    // impassable rock formations (stone you cannot grow through)
    rockMass: '#5d574e',
    rockFacet: '#787065',
    rockShadow: 'rgba(8,8,10,0.45)',
    rockEdge: 'rgba(0,0,0,0.45)',
    vein: 'rgba(214,182,120,0.45)',       // mineral veins
    fleck: 'rgba(226,206,150,0.5)',       // mineral flecks
    // substrate = decaying organic matter (rotting wood + leaf litter)
    detritusBase: '#4a3219',              // dark rotting mass (brown, reads as matter)
    detritusWood: '#7c5326',              // woody chips / twigs
    detritusLeaf: '#5d5a26',              // leaf litter
    detritusEdge: 'rgba(18,11,5,0.55)',   // outline
    mat: '230,242,228',                   // mycelial mat (rgb) overgrowing it
    foodVein: '#f2d784',
    // hazards (toxic pools / nests)
    hazardDeep: '#34112c',
    hazardMid: '#741f3d',
    hazardCaustic: 'rgba(78,210,176,0.8)',
    hazardBubble: 'rgba(150,240,210,0.5)',
    // surface
    crust: '#52402b',
    crustLip: '#6c5536',
    grassSun: '#86b154',
    grassShade: '#4f8088',
    concrete: '#383b43',
    concreteCrack: 'rgba(0,0,0,0.4)',
    // Trichoderma
    trich: '#8aa23e',
    trichSpore: '#d2e074',
    infected: '#a6c63a',         // a strand the mould has overrun (green/dead)
    // the living network (luminous accent — kept distinct from the earth)
    filament: '#cfe8d6',
    tipGlow: '#bfffd0',
    sensingRing: 'rgba(160,255,190,0.15)',
    pulseColor: '#eafff0',
    pulseSpeed: 70,              // pulse travel speed (units/sec)
    minBrightness: 0.45,        // brightness floor so the network never washes out
    // atmosphere
    spore: 'rgba(202,255,216,0.75)',
    mote: 'rgba(226,196,142,0.5)',
    particleCount: 80,
    // dynamic lighting: the network/food/hazards emit light into the dark earth
    lighting: true,
    ambientLight: 0.72,         // unlit earth stays a visible warm brown (1 = lighting off)
    networkLight: 'rgba(150,255,190,1)',
    foodLight: 'rgba(255,196,120,1)',
    hazardLight: 'rgba(90,220,200,1)',
    senseLight: 'rgba(170,205,180,1)', // soft glow marking the sensed (in-range) area
    lightRadius: 64,            // base light radius (world units)
  },

  dev: {
    enabled: true,              // show dev cheats + sliders (remove for release)
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
  { path: 'turn.movesPerTurn',           label: 'Moves / Turn',        min: 1,   max: 8,   step: 1 },
  { path: 'energy.passiveIncomeRate',    label: 'Passive Income Rate', min: 0,   max: 60,  step: 1 },
  { path: 'actions.grow.energyCost',     label: 'Grow Energy Cost',    min: 0,   max: 40,  step: 1 },
  { path: 'trichoderma.moveSpeed',       label: 'Mold Creep (speed)',  min: 0,   max: 5,   step: 0.5 },
  { path: 'trichoderma.infectionSpreadChance', label: 'Infection Spread', min: 0, max: 1, step: 0.05 },
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
