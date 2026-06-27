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
      this.cells[i] = { nutrient: 0, maxNutrient: 0, hazard: false, rock: false, trich: 0, held: 0, colonized: 0 };
    }
    // Surface descriptor per column.
    this.surface = new Array(this.cols);
    for (let c = 0; c < this.cols; c++) this.surface[c] = { soil: true, shade: false };
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

  // 1) Surface line: walk left-to-right laying down soil / non-soil segments,
  //    then mark shade on some soil columns.
  let col = 0;
  while (col < sub.cols) {
    const width = rng.int(s.surfaceSegmentMinCols, s.surfaceSegmentMaxCols);
    const soil = rng.chance(s.soilFraction);
    for (let i = 0; i < width && col < sub.cols; i++, col++) {
      sub.surface[col].soil = soil;
      sub.surface[col].shade = soil && rng.chance(s.shadeFraction);
    }
  }
  // Group shade into runs for readability (a shaded patch, not noise).
  for (let c = 1; c < sub.cols; c++) {
    if (sub.surface[c].soil && sub.surface[c - 1].soil && rng.chance(0.55)) {
      sub.surface[c].shade = sub.surface[c - 1].shade;
    }
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

  // 2b) Rock formations — impassable stone the mycelium must route around.
  const rocks = [];
  for (let i = 0; i < (s.rockCount || 0); i++) {
    const rc = rng.int(2, sub.cols - 3);
    const rr = rng.int(2, Math.max(2, sub.rows - 2)); // keep off the very top row
    const radius = rng.int(s.rockRadiusMin, s.rockRadiusMax);
    rocks.push({ col: rc, row: rr, radius });
    stamp(sub, rc, rr, radius, (cell, dist) => {
      // irregular edge so formations aren't perfect circles
      if (dist > radius - 0.5 && rng.chance(0.4)) return;
      cell.rock = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false;
    });
  }

  // 3) Food clusters — every cell holds the SAME nutrient (flat), so a pile's
  //    energy value is purely its size, not random richness.
  const N = s.foodCellNutrient;
  for (let i = 0; i < s.foodClusterCount; i++) {
    const radius = rng.int(s.foodClusterRadiusMin, s.foodClusterRadiusMax);
    let cc, cr;

    if (rng.chance(s.richNearRockChance) && rocks.length) {
      // Tuck a rich pocket up against a rock formation (route around to reach).
      const rk = rng.pick(rocks);
      const ang = rng.range(0, Math.PI * 2);
      const off = rk.radius + radius;
      cc = Math.round(rk.col + Math.cos(ang) * off);
      cr = Math.round(rk.row + Math.sin(ang) * off);
    } else if (rng.chance(s.richUnderNonSoilChance)) {
      // Place a rich cluster directly under a non-soil stretch (can feed but
      // can't fruit there) — forces a feed-vs-fruit decision.
      const nonSoilCols = [];
      for (let c = 0; c < sub.cols; c++) if (!sub.surface[c].soil) nonSoilCols.push(c);
      cc = nonSoilCols.length ? rng.pick(nonSoilCols) : rng.int(2, sub.cols - 3);
      cr = rng.int(1, Math.min(4, sub.rows - 1));
    } else {
      cc = rng.int(2, sub.cols - 3);
      cr = rng.int(1, Math.max(1, sub.rows - 2));
    }

    stamp(sub, cc, cr, radius, (cell) => {
      if (cell.hazard || cell.rock) return;       // no food inside rock
      cell.nutrient = N;                          // flat — same value every cell
      cell.maxNutrient = N;
    });
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
