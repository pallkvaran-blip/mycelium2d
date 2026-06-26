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
  },

  // ---- Threat: Trichoderma (A2/A5, B6) -----------------------------------
  trichoderma: {
    initialPatches: 3,           // mold patches seeded at map generation
    patchRadiusMin: 1,
    patchRadiusMax: 2,
    spreadRate: 0.55,            // base spread aggressiveness per turn (SLIDER)
    spreadThreshold: 0.25,       // a cell must reach this intensity before it spreads
    foodAttraction: 1.6,         // spreads faster toward food-rich cells
    intensityGainOnFood: 0.18,   // intensity a cell gains per turn over substrate
    contactDamage: 0.09,         // health damage/turn to network nodes in infected cells
    avoidHeldThreshold: 0.55,    // firmly-held cells (healthy net) resist infection
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
  render: {
    skyTop: '#0a0f1c',
    skyBottom: '#10182b',
    groundTop: '#241a12',
    groundBottom: '#0e0a07',
    soilLine: '#5a4630',
    nonSoil: '#3a3d45',
    shadeOverlay: 'rgba(10,16,30,0.45)',
    foodColor: '#3f7d3a',
    hazardColor: '#7a2230',
    trichodermaColor: '#86a23c',
    filament: '#cfe8d6',
    tipGlow: '#bfffd0',
    sensingRing: 'rgba(160,255,190,0.18)',
    pulseColor: '#eafff0',
    pulseSpeed: 70,              // pulse travel speed (units/sec)
    minBrightness: 0.28,        // dimmest a fully-unhealthy network renders
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
