// =============================================================================
// Substrate — the side-on cross-section field + surface line (A4, B1).
//
// Renderer-agnostic. Holds a grid of underground cells (nutrient / hazard /
// Trichoderma intensity) and a per-column surface description (soil vs non-soil,
// shade vs sun). All spatial queries the rest of the engine needs live here.
//
// Grid coordinate model:
//   - Columns span the full world width (col 0 at world x in [0, cellSize)).
//   - Rows span underground only: row 0 starts at world y = surfaceY.
// =============================================================================

export class Substrate {
  constructor(config) {
    const { width, height, surfaceY, cellSize } = config.world;
    this.cellSize = cellSize;
    this.surfaceY = surfaceY;
    this.worldWidth = width;
    this.worldHeight = height;
    this.cols = Math.floor(width / cellSize);
    this.rows = Math.floor((height - surfaceY) / cellSize);
    // Flat cell array, indexed [row * cols + col].
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = { nutrient: 0, maxNutrient: 0, hazard: false, rock: false, antTrail: false, trich: 0, held: 0, colonized: 0 };
    }
    // Surface descriptor per column.
    //   soil    : fruitable ground (only the start/goal zones)
    //   shade   : shaded soil (bonus fruit payout)
    //   goal    : the right-hand exit zone you must cross to
    //   barrier : un-surfaceable terrain type ('concrete' | 'mountain' | 'lake')
    this.surface = new Array(this.cols);
    for (let c = 0; c < this.cols; c++) this.surface[c] = { soil: true, shade: false, goal: false, barrier: null };
  }

  // --- coordinate helpers --------------------------------------------------
  index(col, row) { return row * this.cols + col; }
  inBounds(col, row) { return col >= 0 && col < this.cols && row >= 0 && row < this.rows; }

  colAtX(x) { return Math.floor(x / this.cellSize); }
  rowAtY(y) { return Math.floor((y - this.surfaceY) / this.cellSize); }

  cellCenter(col, row) {
    return {
      x: col * this.cellSize + this.cellSize / 2,
      y: this.surfaceY + row * this.cellSize + this.cellSize / 2,
    };
  }

  cellAt(col, row) {
    return this.inBounds(col, row) ? this.cells[this.index(col, row)] : null;
  }
  cellAtWorld(x, y) {
    return this.cellAt(this.colAtX(x), this.rowAtY(y));
  }

  surfaceColumnAtX(x) {
    const c = this.colAtX(x);
    return c >= 0 && c < this.cols ? this.surface[c] : null;
  }

  // Iterate every cell with its grid coordinates.
  forEachCell(cb) {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        cb(this.cells[this.index(col, row)], col, row);
      }
    }
  }

  // Iterate cells whose centres fall within `radius` of a world point.
  cellsInRadius(x, y, radius, cb) {
    const r = Math.ceil(radius / this.cellSize) + 1;
    const c0 = this.colAtX(x), r0 = this.rowAtY(y);
    const rad2 = radius * radius;
    for (let row = r0 - r; row <= r0 + r; row++) {
      for (let col = c0 - r; col <= c0 + r; col++) {
        if (!this.inBounds(col, row)) continue;
        const center = this.cellCenter(col, row);
        const dx = center.x - x, dy = center.y - y;
        if (dx * dx + dy * dy <= rad2) {
          cb(this.cells[this.index(col, row)], col, row, center);
        }
      }
    }
  }

  // Deposit nutrient in a radius (Add Substrate action). Falls off to the edge.
  deposit(x, y, amount, radiusCells) {
    const c0 = this.colAtX(x), r0 = this.rowAtY(y);
    for (let row = r0 - radiusCells; row <= r0 + radiusCells; row++) {
      for (let col = c0 - radiusCells; col <= c0 + radiusCells; col++) {
        if (!this.inBounds(col, row)) continue;
        const dist = Math.hypot(col - c0, row - r0);
        if (dist > radiusCells) continue;
        const cell = this.cells[this.index(col, row)];
        if (cell.rock) continue;                 // can't place food in rock
        cell.nutrient = Math.max(cell.nutrient, amount);  // flat patch (same value per cell)
        cell.maxNutrient = Math.max(cell.maxNutrient, amount);
        cell.hazard = false;
      }
    }
  }

  totalNutrient() {
    let t = 0;
    for (const cell of this.cells) t += cell.nutrient;
    return t;
  }
}

// -----------------------------------------------------------------------------
// Procedural generation (B1). Places food clusters, hazards, and the surface
// line, deliberately seeding some rich food near hazards / under non-soil so
// steering toward food is a genuine risk/reward choice.
// -----------------------------------------------------------------------------
export function generateSubstrate(config, rng) {
  const sub = new Substrate(config);
  const s = config.substrate;

  // 1) Traversal layout (the point of a level): the colony enters at the far
  //    LEFT and must cross underground to the fruitable GOAL zone at the far
  //    RIGHT. Everything between is un-surfaceable terrain — concrete, mountain
  //    or lake — so the only place you can break the surface and fruit is the
  //    goal you've travelled to.
  const goalCols = Math.max(2, Math.min(sub.cols - 4, s.goalCols || 6));
  const startCols = Math.max(1, Math.min(sub.cols - goalCols - 1, s.startCols || 2));
  const goalStart = sub.cols - goalCols;

  // Everything is impassable surface by default…
  for (let c = 0; c < sub.cols; c++) {
    sub.surface[c].soil = false;
    sub.surface[c].shade = false;
    sub.surface[c].goal = false;
    sub.surface[c].barrier = 'concrete';
  }
  // …the goal zone is fruitable soil (sunlit, some shaded for bonus payout)…
  for (let c = goalStart; c < sub.cols; c++) {
    sub.surface[c].soil = true;
    sub.surface[c].goal = true;
    sub.surface[c].barrier = null;
    sub.surface[c].shade = rng.chance(s.shadeFraction);
  }
  // …and the middle is broken into runs of distinct barrier terrain.
  const TYPES = ['concrete', 'mountain', 'lake'];
  let bcol = startCols;
  while (bcol < goalStart) {
    const width = rng.int(s.barrierSegMinCols || 4, s.barrierSegMaxCols || 10);
    const type = rng.pick(TYPES);
    for (let i = 0; i < width && bcol < goalStart; i++, bcol++) sub.surface[bcol].barrier = type;
  }

  // 2) Hazards (toxic pools) — disabled (hazardCount 0), kept for compatibility.
  const hazards = [];
  for (let i = 0; i < s.hazardCount; i++) {
    const hc = rng.int(2, sub.cols - 3);
    const hr = rng.int(1, Math.max(1, sub.rows - 2));
    const radius = rng.int(s.hazardRadiusMin, s.hazardRadiusMax);
    hazards.push({ col: hc, row: hr, radius });
    stamp(sub, hc, hr, radius, (cell) => { cell.hazard = true; cell.nutrient = 0; cell.maxNutrient = 0; });
  }

  // 2b) Rock formations — impassable stone the mycelium routes around on its way
  //     across. Kept out of the start/goal columns so entry and exit are clear.
  const rocks = [];
  for (let i = 0; i < (s.rockCount || 0); i++) {
    const rc = rng.int(startCols + 2, goalStart - 2);
    const rr = rng.int(2, Math.max(2, sub.rows - 2)); // keep off the very top row
    const radius = rng.int(s.rockRadiusMin, s.rockRadiusMax);
    rocks.push({ col: rc, row: rr, radius });
    stamp(sub, rc, rr, radius, (cell, dist) => {
      // irregular edge so formations aren't perfect circles
      if (dist > radius - 0.5 && rng.chance(0.4)) return;
      cell.rock = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false;
    });
  }
  // Always clear a rock-free channel at the entry (so the colony can root) and
  // under the goal (so it can reach the surface to fruit).
  const clearChannel = (c0, c1) => {
    for (let col = c0; col < c1; col++)
      for (let row = 0; row < sub.rows; row++) {
        const cell = sub.cellAt(col, row);
        if (cell) cell.rock = false;
      }
  };
  clearChannel(0, startCols + 1);
  clearChannel(goalStart - 1, sub.cols);
  // Guarantee a rock-free corridor just under the surface for the WHOLE width,
  // so there is always a route across (rocks below it still force you to dip
  // and route around them to reach the lower food). Keeps every map winnable.
  const corridor = Math.max(1, s.surfaceCorridorRows || 2);
  for (let col = 0; col < sub.cols; col++)
    for (let row = 0; row < corridor; row++) {
      const cell = sub.cellAt(col, row);
      if (cell) cell.rock = false;
    }

  // 3) Food trail. Every food cell holds the SAME nutrient (flat), so a pile's
  //    energy value is purely its size.
  const N = s.foodCellNutrient;
  const drop = (cc, cr, radius) => stamp(sub, cc, cr, radius, (cell) => {
    if (cell.hazard || cell.rock) return;         // no food inside rock
    cell.nutrient = N; cell.maxNutrient = N;      // flat — same value every cell
  });
  // 3a) The MAIN breadcrumb trail runs left→right through the guaranteed-clear
  //     surface corridor, spaced within sensing range, so the colony can always
  //     follow it across (with the odd Add-Substrate lure to round a rock).
  const count = Math.max(1, s.foodClusterCount);
  const corridorTop = Math.max(0, (s.surfaceCorridorRows || 2) - 1);
  const xLo = startCols + 1, xHi = goalStart;       // run right up to the goal
  const span = Math.max(1, xHi - xLo);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;                                  // even left→right spread
    let cc = Math.round(xLo + t * span + rng.range(-1, 1));
    cc = Math.max(1, Math.min(sub.cols - 2, cc));
    drop(cc, rng.int(0, corridorTop), rng.int(s.foodClusterRadiusMin, s.foodClusterRadiusMax));
  }
  // 3b) A few deeper BONUS pockets — extra energy for routing down around rock.
  const bonus = s.foodBonusClusters || 4;
  const maxRow = Math.max(3, Math.min(s.foodBandRows || 6, sub.rows - 2));
  for (let i = 0; i < bonus; i++) {
    drop(rng.int(xLo, xHi - 1), rng.int(3, maxRow), rng.int(s.foodClusterRadiusMin, s.foodClusterRadiusMax));
  }

  return sub;
}

// Stamp a circular footprint, invoking cb(cell, distInCells) for each cell.
function stamp(sub, cc, cr, radius, cb) {
  for (let row = cr - radius; row <= cr + radius; row++) {
    for (let col = cc - radius; col <= cc + radius; col++) {
      if (!sub.inBounds(col, row)) continue;
      const dist = Math.hypot(col - cc, row - cr);
      if (dist > radius) continue;
      cb(sub.cells[sub.index(col, row)], dist);
    }
  }
}
