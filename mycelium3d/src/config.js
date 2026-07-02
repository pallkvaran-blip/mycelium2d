// =============================================================================
// CONFIG — every gameplay number for the 3D game lives here.
//
// This is the 3D port of the 2D game's config (../src/config.js). The same
// data-driven rule applies: engine code must read numbers from here, never
// hard-code them.
//
// Coordinate system (three.js convention):
//   x : the traversal axis — the colony enters at the WEST (x=0) and must
//       cross underground to the fruitable GOAL zone at the EAST (x=width).
//   y : up. The soil surface is the plane y = 0; underground is y < 0 down
//       to y = -depth. (The 2D game's "y increases downward" is gone.)
//   z : lateral breadth — the new dimension. You fly around obstacles in z.
//
// The substrate is a voxel grid: cols along x, lays (layers) down from the
// surface along -y, rows along z.
// =============================================================================

export const CONFIG = {
  // ---- World / volume geometry --------------------------------------------
  world: {
    width: 2600,        // world size along x (west -> east traversal)
    depth: 1120,        // world size along -y (surface down to bedrock)
    breadth: 1080,      // world size along z (lateral)
    cellSize: 40,       // substrate voxel size (cube)
  },

  // ---- Substrate field + surface terrain generation ------------------------
  substrate: {
    goalCols: 6,                 // width (x cols) of the eastern fruitable GOAL zone
    goalSummerCols: 6,           // cols just WEST of the goal kept clear of dark-world features
    startCols: 2,                // width of the western entry zone (cols)
    foodClusterCount: 12,        // sparse caches along the route — energy is a real constraint
    foodClusterRadiusCells: 1,   // small stepping-stone pockets (a ~7-voxel sphere)
    foodCellNutrient: 50,        // every food voxel is worth the same — a pile's value is its SIZE
    foodRockBuffer: 2.2,         // min clearance (cells) food keeps from rock
    // Rock CURTAINS — the 3D path-blocking barriers. Each is a near-vertical
    // wall spanning the full z-breadth at some x, running from the surface down
    // to depth; the mycelium must dig UNDER it (you can't route around in z).
    curtainCountMin: 2,
    curtainCountMax: 4,
    curtainThicknessCols: 2,     // impassable footprint thickness (x cols)
    curtainDepthMinLays: 6,      // reaches at least this deep…
    curtainDepthMaxLays: 11,     // …up to this — the deeper, the longer the dip under
    curtainTiltMaxDeg: 25,       // whole-wall lean from vertical (±, in x per layer)
    curtainGapChance: 0.5,       // chance a curtain has ONE eroded porthole through it
    curtainGapRadiusCells: 1.6,  // radius of that porthole (a risky shortcut)
    pathLays: 2,                 // height of the guaranteed clear route carved beneath barriers
    pathHalfWidthCells: 1,       // the carved tunnel spans z in [zc-this, zc+this]
    // Lake basin: a large water-filled bowl carved into the surface. The water
    // is IMPASSABLE — the mycelium routes UNDER (or around its z-edges).
    lakeCountMin: 1,
    lakeCountMax: 1,
    lakeWidthMinCols: 8,         // basin extent along x
    lakeWidthMaxCols: 13,
    lakeBreadthMinRows: 9,       // basin extent along z
    lakeBreadthMaxRows: 16,
    lakeDepthMinLays: 3,         // bowl depth at the centre (layers)
    lakeDepthMaxLays: 7,
    // Scattered obstacles to weave through while flying:
    boulderCount: 46,            // lone 1-voxel rocks
    formationCount: 10,          // large impassable ellipsoid rock masses
    formationRadiusMinCols: 2.5, // formation x/z radius (cells); y radius is /2.2
    formationRadiusMaxCols: 5.5,
    shadeFraction: 0.45,         // ~fraction of GOAL soil columns that are shaded
    colonizeRate: 0.166,         // colonisation progress per Grow cycle (~6 cycles to fill)
  },

  // ---- Resources ------------------------------------------------------------
  energy: {
    start: 120,                  // starting Energy
    baselineTrickle: 1,          // tiny per-action free trickle
    passiveIncomeRate: 34,       // nutrient pulled from each colonised voxel/step
    incomeEfficiency: 0.6,       // Energy gained per unit nutrient consumed
  },

  // ---- Growth: 3D space colonization ---------------------------------------
  growth: {
    sensingRadius: 150,          // tips sense substrate attractors within this radius
    killDistance: 24,            // attractor is consumed when a node gets this close
    segmentLength: 18,           // length of one growth segment
    stepsPerGrow: 7,             // space-colonization iterations per Grow action
    maxNodes: 3200,              // safety cap on network size
    attractorThreshold: 1,       // any voxel with food attracts growth
    branchJitter: 0.22,          // random angular wobble for organic look (radians)
    startDepth: 140,             // initial seed depth below the surface plane
    minTipSpacing: 12,           // don't spawn a node this close to an existing one
  },

  // ---- Vitality / health ----------------------------------------------------
  vitality: {
    starvationDamage: 0.05,      // health lost network-wide per step when starving
    deadNodeHealth: 0.0,         // health at/below which a node is pruned
    dipDecayPerTurn: 0.03,
    maxVitalityDip: 0.9,
  },

  // ---- Threat: Trichoderma (roaming mould clouds) --------------------------
  trichoderma: {
    initialPatches: 3,           // number of roaming mold clouds in the volume
    cloudRadiusMin: 0.8,         // starting cloud radius in grid cells
    cloudRadiusMax: 1.3,         // HARD cap — a cloud never grows big
    growthPerEat: 0.02,          // radius gained per action while eating (tiny)
    sightRadius: 520,            // how far (world units) a cloud senses food/you
    moveSpeed: 1.5,              // cells per ACTION a cloud creeps toward its target
    consumeReachMult: 2.2,       // cells within (radius x this) are eaten WHOLE each action
    fadeTurns: 3,                // after infecting you, a cloud fades over this many steps
    seedMinColonyDistFrac: 0.2,  // clouds seed at least this fraction of world-width from you
    respawnChance: 0.12,         // per action, chance a faded cloud is replaced
    contactChance: 1.0,          // edge touch = infection, immediately
    contactChunk: 4,             // the breach instantly claims this many rings of mycelium
    spreadDepthPerTurn: 6,       // rings the rot races along your filaments each step
    infectionSpreadChance: 0.85, // chance the rot takes each ring of that race
  },

  // ---- The seven basic actions ---------------------------------------------
  actions: {
    grow:         { moveCost: 1, energyCost: 10 },
    addSubstrate: { moveCost: 1, energyCost: 12, amount: 20, radius: 1 },
    amputate:     { moveCost: 1, energyCost: 4,  radius: 64 },
    attackAnts:   { moveCost: 1, energyCost: 30, damageFrac: 0.4, pickRadius: 150 },
    excrete:      { moveCost: 1, energyCost: 10, range: 85, stickTurns: 1 },
    digest:       { moveCost: 1, energyCost: 8,  drainFraction: 0.5 },
    fruit: {
      moveCost: 1, energyCost: 22,
      payoutPerBody: 11,         // Spores per fruiting body
      shadeMultiplier: 1.8,      // shaded soil yields more
      vitalityFloor: 0.3,        // minimum payout multiplier a sickly network still gets
      clusterCells: 3,           // fruitable surface cells group into bodies on this grid pitch
      reachDepth: 180,           // node must be within this depth of the surface to fruit
      reachSpread: 34,           // horizontal (xz) tolerance from a soil column centre
    },
  },

  // ---- Ants — a fixed territorial threat + food rival ----------------------
  ants: {
    nestCount: 2,                // nests seeded per map (on the surface plane)
    maxHp: 100,
    harvestRate: 20,             // nutrient a nest carries off its target food per action
  },

  // ---- Nematodes — fungivorous worms that graze your frontier ---------------
  nematodes: {
    initialCount: 3,
    seedMinColonyDistFrac: 0.25,
    sightRadius: 380,            // detection range; rock blocks line of sight
    crawlSpeed: 3.0,             // cells/step toward a sensed strand — fast
    wanderSpeed: 1.0,            // cells/step while searching
    reach: 0.7,                  // cells: how close to a strand before it feeds
    eatEveryTicks: 2,            // a feeding worm eats one strand every N steps
    breedChance: 0.35,           // chance a feeding worm splits each step
    killHits: 3,                 // Excrete hits to kill one
    maxPopulation: 150,
    respawnChance: 0.06,
  },

  // ---- Rendering / feel — visual only, never gameplay ----------------------
  render: {
    fogColor: '#04070a',                  // deep underground haze
    fogDensity: 0.00085,
    clearColor: '#04070a',
    ambient: '#182420',
    hemiSky: '#26414c', hemiGround: '#1c130a', hemiIntensity: 0.5,
    // the living network (luminous accent — the brightest thing in the volume)
    filament: '#cfe8d6',
    filamentTrunk: '#b8d8c4',
    tipGlow: '#bfffd0',
    infected: '#a6c63a',                  // a strand the mould has overrun
    pulseColor: '#eafff0',
    // terrain
    ceiling: '#241a10',                   // the soil surface seen from below
    ceilingGoal: '#5a7a44',               // sunlit living ground over the goal
    ceilingShade: '#2f5a3c',              // shaded goal soil
    rock: '#2e333c',
    rockEmissive: '#11161d',
    water: '#1d4254',
    waterDeep: '#0e2935',
    food: '#8a6c30',                      // glowing decaying-matter caches (kept dim: bloom lifts it)
    foodCore: '#c9a45c',
    // threats
    trich: '#8aa23e',
    trichBright: '#d2e074',
    ant: '#2a1a0e',
    antTrail: '#4a321c',
    nematode: '#d8cfc0',
    nematodeStuck: '#8fb7a5',
    // atmosphere
    mote: '#9ecdc2',
    moteCount: 700,
    goalBeacon: '#96e696',
    startBeacon: '#7fd4e6',
    // bloom
    bloomStrength: 0.72,
    bloomRadius: 0.55,
    bloomThreshold: 0.32,
  },

  // ---- Flight (the drone camera) — feel only, never gameplay ---------------
  flight: {
    speed: 170,                  // cruise speed, world units/sec
    boost: 3.2,                  // Shift multiplier
    accel: 6.5,                  // approach rate toward target velocity (1/sec)
    lookSpeed: 0.0023,           // radians per pixel of mouse movement
    cursorMin: 30,               // targeting cursor distance range (scroll wheel)
    cursorMax: 700,
    cursorStart: 180,
  },

  dev: {
    enabled: true,
    cheatEnergy: 100,
    cheatSpores: 100,
  },
};

// Read/write CONFIG by dotted path (used by the dev panel).
export function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
export function setByPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
