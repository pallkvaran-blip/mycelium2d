// =============================================================================
// Puzzle — a fixed, hand-authored map (a "level"). Goal: steer the colony to the
// treasure chest. Rocks force detours, a tight energy economy makes reaching the
// next food a real decision, and a couple of Trichoderma clouds must be lured
// away or fought (let them infect, then amputate — they die off after infecting).
//
// Fully deterministic (no rng). Built imperatively in grid coordinates; the
// world geometry + economy are applied to a CLONE of CONFIG so the sandbox is
// never affected.
// =============================================================================

const CELL = 36;
const AIR = 4;     // rows of air above the surface line
const COLS = 78;   // -> width 2808
const ROWS = 22;   // underground rows -> height 936

const START_COL = 6;
const CHEST_CELL = [73, 9];

// Food islands (col, row, radius) — small stepping-stones; the chain weaves
// through the rock-wall gaps from the start to the chest.
const ISLANDS = [
  [9, 5, 2],    // A — starter fuel by the seed
  [20, 5, 1],   // B
  [31, 13, 1],  // C  (you must dip DOWN to reach it)
  [43, 7, 1],   // D  (then climb UP)
  [55, 14, 1],  // E  (down again)
  [67, 9, 1],   // F  — right by the chest, at the end of the corridor
];

// Rock walls (c0,r0,c1,r1 inclusive). Each leaves a gap on the path; together
// they force a down-up-down weave and frame the final corridor.
const ROCKS = [
  [15, 0, 15, 3], [15, 7, 15, 21],   // W1 — gap at rows 4-6 (A->B threads it)
  [26, 0, 26, 7],                    // W2 — blocks the top, forces DOWN to C
  [38, 12, 38, 21],                  // W3 — blocks the bottom, forces UP to D
  [49, 0, 49, 6],                    // W4 — blocks the top, forces DOWN to E
  [60, 6, 70, 8], [60, 10, 70, 11],  // W5 — a 1-cell corridor at row 9 to the chest
];

// Trichoderma clouds (col, row).
const CLOUD_CELLS = [
  [47, 9],   // T1 — guards the D->E stretch (lure it aside, or push through)
  [64, 9],   // T2 — sits in the corridor by the chest (infect-and-sever)
];

// Exposed for tests: the intended path waypoints (island centres + chest).
export const PUZZLE_WAYPOINTS = ISLANDS.map(([c, r]) => [c, r]).concat([CHEST_CELL]);

export function buildPuzzle(config, Substrate, setCfg) {
  // --- world geometry ---
  setCfg('world.cellSize', CELL);
  setCfg('world.surfaceY', AIR * CELL);
  setCfg('world.width', COLS * CELL);
  setCfg('world.height', AIR * CELL + ROWS * CELL);

  // --- tight economy: you must reach the next food before you starve ---
  setCfg('energy.start', 50);
  setCfg('energy.baselineTrickle', 0);     // no free energy — only food fuels you
  setCfg('energy.passiveIncomeRate', 28);
  setCfg('substrate.foodCellNutrient', 35); // small piles
  setCfg('actions.grow.energyCost', 10);
  setCfg('actions.addSubstrate.energyCost', 14); // lures are precious

  // --- a fixed set of mould; none seeded randomly, none respawning ---
  setCfg('trichoderma.initialPatches', 0);
  setCfg('trichoderma.respawnChance', 0);

  const sub = new Substrate(config);
  // all surface is soil so the colony can root at the start column
  for (let c = 0; c < sub.cols; c++) { sub.surface[c].soil = true; sub.surface[c].shade = false; }

  // rocks
  for (const [c0, r0, c1, r1] of ROCKS) {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cell = sub.cellAt(c, r);
      if (cell) { cell.rock = true; cell.nutrient = 0; cell.maxNutrient = 0; }
    }
  }

  // food islands (skip rock)
  const N = config.substrate.foodCellNutrient;
  for (const [cc, cr, rad] of ISLANDS) {
    for (let r = cr - rad; r <= cr + rad; r++) for (let c = cc - rad; c <= cc + rad; c++) {
      const cell = sub.cellAt(c, r);
      if (!cell || cell.rock) continue;
      if (Math.hypot(c - cc, r - cr) > rad + 0.001) continue;
      cell.nutrient = N; cell.maxNutrient = N;
    }
  }

  const chest = { ...sub.cellCenter(CHEST_CELL[0], CHEST_CELL[1]), r: CELL * 1.4 };
  const clouds = CLOUD_CELLS.map(([c, r]) => sub.cellCenter(c, r));

  return { substrate: sub, startCol: START_COL, clouds, chest };
}
