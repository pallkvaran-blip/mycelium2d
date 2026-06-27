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
    foodClusterCount: 16,        // number of food clusters scattered underground
    foodClusterRadiusMin: 2,     // cluster radius in cells
    foodClusterRadiusMax: 6,
    foodRichnessMin: 45,         // peak nutrient at a cluster centre
    foodRichnessMax: 130,
    hazardCount: 6,              // ant colonies / waterlogged-toxic pools
    hazardRadiusMin: 1,
    hazardRadiusMax: 3,
    // Surface line: alternating segments of soil (fruitable) / non-soil.
    surfaceSegmentMinCols: 3,    // min width of a surface segment, in grid columns
    surfaceSegmentMaxCols: 11,
    soilFraction: 0.6,           // ~fraction of surface segments that are soil
    shadeFraction: 0.45,         // ~fraction of soil columns that are shaded
    // Deliberate tension: bias some rich food to sit near hazards / under
    // non-soil so steering toward food is a real risk/reward choice (B1).
    richNearHazardChance: 0.45,
    richUnderNonSoilChance: 0.4,
  },

  // ---- Resources (A3, B3) -------------------------------------------------
  energy: {
    start: 110,                  // starting Energy (SLIDER)
    baselineTrickle: 4,          // free Energy per turn, prevents soft-lock
    passiveIncomeRate: 6,        // max nutrient pulled from each occupied cell/turn (SLIDER)
    incomeEfficiency: 0.6,       // Energy gained per unit nutrient consumed (lossy)
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
  trichoderma: {
    initialPatches: 3,           // mold patches seeded at map generation
    patchRadiusMin: 1,
    patchRadiusMax: 2,
    spreadRate: 0.55,            // base spread aggressiveness per turn (SLIDER)
    spreadBase: 0.25,            // base fraction applied to each neighbour spread step
    spreadThreshold: 0.25,       // a cell must reach this intensity before it spreads
    spreadJitterMin: 0.6,        // per-cell spread randomness range (organic front)
    spreadJitterMax: 1.0,
    foodAttraction: 1.6,         // spreads faster toward food-rich cells
    intensityGainOnFood: 0.18,   // intensity a cell gains per turn over substrate
    contactDamage: 0.09,         // health damage/turn to network nodes in infected cells
    avoidHeldThreshold: 0.55,    // firmly-held cells (healthy net) resist infection
    seedFoodBias: 0.75,          // chance an initial patch is biased toward food
    spawnChancePerTurn: 0.0,     // ambient new patches (0 = only seeded + dev/spawn)
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
      burstSize: 70,             // total nutrient burst-converted to Energy (SLIDER)
      extraDepletion: 1.6,      // depletion multiplier — exhausts the patch faster
      vitalityDip: 0.09,         // temporary network-wide vitality hit
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

  // ---- Genetic defence traits (A2, B5) -----------------------------------
  traits: {
    melanize:     { damageReductionPerLevel: 0.16 },   // passive armour (all damage)
    antifungal:   { slowPerLevel: 0.22, damagePerLevel: 0.13 }, // vs Trichoderma
    antipredator: { noteOnly: true },                  // no fungivore threat in Phase 1
  },

  // ---- Rendering / feel (A8) — visual only, never gameplay ---------------
  // A subterranean cross-section: a twilight sky over rich, textured earth,
  // glowing nutrient pockets, toxic pools, and a luminous mint network.
  render: {
    // sky / air
    skyTop: '#06080f',
    skyHorizon: '#1a2236',
    horizonGlow: 'rgba(74,86,128,0.45)',
    star: 'rgba(200,214,255,0.7)',
    sunWash: 'rgba(232,176,86,0.12)',     // warm light over sunny soil
    shadeWash: 'rgba(36,86,150,0.30)',    // cool light over shaded soil
    canopy: 'rgba(8,16,12,0.55)',         // foliage silhouette over shade
    // earth strata (top -> deep)
    soilTop: '#473221',
    soilMid: '#241a10',
    soilDeep: '#0c0805',
    rock: '#41382d',
    rockLip: '#5b5040',
    vein: 'rgba(214,182,120,0.45)',       // mineral veins
    fleck: 'rgba(226,206,150,0.5)',       // mineral flecks
    // food / nutrient pockets
    foodCore: '#cc9038',
    foodEdge: '#566a2a',
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
    // the living network (luminous accent — kept distinct from the earth)
    filament: '#cfe8d6',
    tipGlow: '#bfffd0',
    sensingRing: 'rgba(160,255,190,0.15)',
    pulseColor: '#eafff0',
    pulseSpeed: 70,              // pulse travel speed (units/sec)
    minBrightness: 0.3,         // dimmest a fully-unhealthy network renders
    // atmosphere
    spore: 'rgba(202,255,216,0.75)',
    mote: 'rgba(226,196,142,0.5)',
    particleCount: 80,
    // dynamic lighting: the network/food/hazards emit light into the dark earth
    lighting: true,
    ambientLight: 0.5,          // brightness of unlit areas (1 = lighting off)
    networkLight: 'rgba(150,255,190,1)',
    foodLight: 'rgba(255,196,120,1)',
    hazardLight: 'rgba(90,220,200,1)',
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
  { path: 'energy.passiveIncomeRate',    label: 'Passive Income Rate', min: 0,   max: 30,  step: 1 },
  { path: 'actions.grow.energyCost',     label: 'Grow Energy Cost',    min: 0,   max: 40,  step: 1 },
  { path: 'trichoderma.spreadRate',      label: 'Trichoderma Spread',  min: 0,   max: 2,   step: 0.05 },
  { path: 'actions.fruit.payoutPerBody', label: 'Fruit Payout / Body', min: 0,   max: 40,  step: 1 },
  { path: 'actions.digest.burstSize',    label: 'Digest Burst Size',   min: 0,   max: 200, step: 5 },
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
