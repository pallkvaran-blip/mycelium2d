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
      this.cells[i] = { nutrient: 0, maxNutrient: 0, hazard: false, rock: false, water: false, formation: false, antTrail: false, trich: 0, held: 0, colonized: 0 };
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
  // …and the middle stays 'concrete' (rendered as plain ground; city skylines are
  // drawn over it). The distinctive barriers — mountains and lakes — are placed
  // as features below, so the rest of the surface is just impassable ground.

  // 2) Hazards (toxic pools) — disabled (hazardCount 0), kept for compatibility.
  const hazards = [];
  for (let i = 0; i < s.hazardCount; i++) {
    const hc = rng.int(2, sub.cols - 3);
    const hr = rng.int(1, Math.max(1, sub.rows - 2));
    const radius = rng.int(s.hazardRadiusMin, s.hazardRadiusMax);
    hazards.push({ col: hc, row: hr, radius });
    stamp(sub, hc, hr, radius, (cell) => { cell.hazard = true; cell.nutrient = 0; cell.maxNutrient = 0; });
  }

  // 2b) lone BOULDERS — scattered single rocks (one old-style sprite each, never
  //     piled). The large rock FORMATIONS are placed later (after the lake basin
  //     reserves its span) so the lake always fits. Kept out of start/goal.
  for (let i = 0; i < (s.rockCount || 0); i++) {
    const rc = rng.int(startCols + 2, goalStart - 2);
    const rr = rng.int(2, Math.max(2, sub.rows - 2)); // keep off the very top row
    const radius = rng.int(s.rockRadiusMin || 0, s.rockRadiusMax || 0);
    stamp(sub, rc, rr, radius, (cell, dist) => {
      if (dist > radius - 0.5 && rng.chance(0.4)) return;  // irregular edge
      cell.rock = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false;
    });
  }

  // 2c) MOUNTAIN surface landmarks. (The old impassable "wall" rock column that
  //     rose from the surface to depth — the path-blocking mechanic — has been
  //     REMOVED; it's being redesigned. For now these just place mountain
  //     sprites on the surface and reserve their columns so lakes avoid them.)
  const pathH = Math.max(1, s.pathRows || 2);
  const wallW = Math.max(1, s.wallWidthCols || 3);
  const wallCount = rng.int(Math.max(1, s.wallCountMin || 1), Math.max(1, s.wallCountMax || 3));
  const innerLo = startCols + 3, innerHi = goalStart - 3 - wallW;
  const walls = [];
  for (let i = 0; i < wallCount && innerHi > innerLo; i++) {
    const frac = (i + 1) / (wallCount + 1);
    let wc = Math.round(innerLo + frac * (innerHi - innerLo) + rng.range(-2, 2));
    wc = Math.max(innerLo, Math.min(innerHi, wc));
    walls.push({ c0: wc, c1: wc + wallW });
    for (let col = wc; col < wc + wallW; col++) sub.surface[col].barrier = 'mountain';
  }

  // 2c-ii) LAKE basins — large water-filled cross-sections carved into the earth.
  //   A bowl (semi-ellipse) of WATER cells: impassable (rock+water), deepest at
  //   the centre, tapering to the edges. The mycelium routes UNDER each basin
  //   (its depth feeds the path profile below). Placed in the middle, clear of
  //   the mountains and the entry/goal channels.
  const occupied = new Array(sub.cols).fill(false);
  for (const w of walls) for (let c = w.c0 - 2; c <= w.c1 + 1; c++) if (c >= 0 && c < sub.cols) occupied[c] = true;
  const lakes = [];
  const lakeCount = rng.int(Math.max(0, s.lakeCountMin || 0), Math.max(0, s.lakeCountMax || 0));
  const lwMin = s.lakeWidthMinCols || 8, lwMax = s.lakeWidthMaxCols || 14;
  const ldMin = s.lakeDepthMinRows || 5, ldMax = s.lakeDepthMaxRows || 8;
  const lakeLo = startCols + 3, lakeHi = goalStart - 3;
  // Find the free spans between the mountains, then drop lakes into the widest
  // ones — so a basin reliably appears (random probing often found no room).
  const spans = [];
  let sc = -1;
  for (let c = lakeLo; c <= lakeHi; c++) {
    if (!occupied[c]) { if (sc < 0) sc = c; }
    else if (sc >= 0) { spans.push([sc, c - 1]); sc = -1; }
  }
  if (sc >= 0) spans.push([sc, lakeHi]);
  spans.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));   // widest first
  for (const [s0, s1] of spans) {
    if (lakes.length >= lakeCount) break;
    const spanW = s1 - s0 + 1;
    if (spanW < lwMin + 1) continue;                     // no room for even a min lake (+margin)
    const lw = Math.min(rng.int(lwMin, lwMax), spanW - 1);
    const c0 = s0 + Math.floor((spanW - lw) / 2);        // centre the basin in the span
    // Depth follows the lake-art aspect (width:depth) so the sprite draws undistorted.
    const aspect = s.lakeAspect || 2.8;
    const maxDepth = Math.max(ldMin, Math.min(ldMax, Math.min(sub.rows - pathH - 2, Math.round(lw / aspect))));
    const center = c0 + lw / 2;
    for (let col = c0; col < c0 + lw; col++) {
      const t = (col + 0.5 - center) / (lw / 2);         // -1..1 across the bowl
      const d = Math.max(1, Math.round(maxDepth * Math.sqrt(Math.max(0, 1 - t * t))));
      sub.surface[col].barrier = 'lake';
      sub.surface[col].soil = false;
      sub.surface[col].goal = false;
      for (let row = 0; row < d; row++) {
        const cell = sub.cellAt(col, row);
        if (cell) { cell.rock = true; cell.water = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false; }
      }
      occupied[col] = true;
    }
    lakes.push({ c0, c1: c0 + lw - 1, maxDepth });
  }

  // 2c-iii) Large rock FORMATIONS — a few wide, impassable masses, each drawn as
  //   ONE unique AI rock-formation sprite (crystal / ember / fungal / glow).
  //   Footprints are WIDE and LOW (ellipse, ≈2.4:1) to match the art's aspect.
  //   Placed in the free columns LEFT between the walls and the lake — the lake
  //   has already reserved its span, so it always fits — and spaced apart so each
  //   is its own connected patch. Marked formation=true for the renderer.
  const fCount = Math.max(0, s.formationCount || 0);
  const fwMin = s.formationWidthMinCols || 6, fwMax = s.formationWidthMaxCols || 11;
  const fLo = startCols + 3, fHi = goalStart - 3;
  const fSpans = [];
  let fsc = -1;
  for (let c = fLo; c <= fHi; c++) {
    if (!occupied[c]) { if (fsc < 0) fsc = c; }
    else if (fsc >= 0) { fSpans.push([fsc, c - 1]); fsc = -1; }
  }
  if (fsc >= 0) fSpans.push([fsc, fHi]);
  fSpans.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));   // widest spans first
  let fPlaced = 0;
  for (const [s0, s1] of fSpans) {
    if (fPlaced >= fCount) break;
    let cur0 = s0;
    while (fPlaced < fCount) {
      const avail = s1 - cur0 + 1;
      if (avail < fwMin) break;
      const wCols = Math.min(rng.int(fwMin, fwMax), avail);
      const rx = Math.max(2, wCols / 2);
      const ry = Math.max(1, rx / 2.4);                    // wide & low
      const cc = cur0 + (wCols - 1) / 2;
      // Bias depth to the upper-middle play area (not the deep dead zone) so the
      // formations sit where the mycelium routes and read as real obstacles.
      const rrMax = Math.max(3, Math.min(sub.rows - Math.ceil(ry) - 1, Math.round(sub.rows * 0.5)));
      const rr = rng.int(2, rrMax);                        // off the top row
      for (let row = Math.floor(rr - ry); row <= Math.ceil(rr + ry); row++)
        for (let col = Math.floor(cc - rx); col <= Math.ceil(cc + rx); col++) {
          const nx = (col - cc) / rx, ny = (row - rr) / ry;
          const dd = nx * nx + ny * ny;
          if (dd > 1) continue;
          if (dd > 0.78 && rng.chance(0.35)) continue;     // irregular edge
          const cell = sub.cellAt(col, row);
          if (!cell || cell.water) continue;
          cell.rock = true; cell.formation = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false;
        }
      for (let c = cur0; c < cur0 + wCols && c < sub.cols; c++) occupied[c] = true;
      fPlaced++;
      cur0 += wCols + 2;                                   // gap → next formation stays a distinct patch
    }
  }

  // 2d) Carve a guaranteed connected route from entry to goal: a shallow tunnel
  //     that still DIPS beneath every lake. (The wall "go under" dips were removed
  //     with the path-blocking columns — to be redesigned.) Built as a row-profile
  //     that changes by at most (pathH-1) rows per column, so the cleared windows
  //     always overlap and connect.
  const req = new Array(sub.cols).fill(1);                 // baseline: near the surface
  // Lakes: the tunnel must pass beneath the deepest water in each column.
  for (const lk of lakes) for (let col = lk.c0; col <= lk.c1; col++) {
    let d = 0; while (d < sub.rows && sub.cellAt(col, d) && sub.cellAt(col, d).water) d++;
    req[col] = Math.max(req[col], d + 1);
  }
  const pr = req.slice();
  for (let c = 1; c < sub.cols; c++) pr[c] = Math.max(pr[c], pr[c - 1] - 1);
  for (let c = sub.cols - 2; c >= 0; c--) pr[c] = Math.max(pr[c], pr[c + 1] - 1);
  const pathRow = pr.map((r) => Math.max(0, Math.min(sub.rows - pathH, r)));
  for (let col = 0; col < sub.cols; col++)
    for (let row = pathRow[col]; row < pathRow[col] + pathH; row++) {
      const cell = sub.cellAt(col, row);
      if (cell && !cell.water) cell.rock = false;          // never carve through a lake
    }

  // Entry + goal channels always clear (root in, surface out).
  const clearChannel = (c0, c1) => {
    for (let col = c0; col < c1; col++)
      for (let row = 0; row < sub.rows; row++) {
        const cell = sub.cellAt(col, row);
        if (cell && !cell.water) cell.rock = false;
      }
  };
  clearChannel(0, startCols + 1);
  clearChannel(goalStart - 1, sub.cols);

  // 3) Food — SPARSE caches along the route, so energy is a real constraint (you
  //    can't just grow freely) and steering with Add-Substrate matters. A reward
  //    cache sits beneath each lake's deep dip.
  const N = s.foodCellNutrient;
  // Keep food clear of rock formations: rocks render as big piled boulders that
  // spill well beyond their cells, so food placed near rock reads as sitting on
  // (or under) the rock. BUF is the min clearance (cells) from any rock cell.
  const BUF = s.foodRockBuffer || 2.2;
  const rockNear = (col, row, r) => {
    const ri = Math.ceil(r);
    for (let dr = -ri; dr <= ri; dr++)
      for (let dc = -ri; dc <= ri; dc++) {
        if (dc * dc + dr * dr > r * r) continue;
        const cell = sub.cellAt(col + dc, row + dr);
        if (cell && cell.rock) return true;
      }
    return false;
  };
  // Find the nearest cell to (cc,cr) that's open and clear of rock (spiral out).
  const findClear = (cc, cr) => {
    for (let r = 0; r <= 6; r++)
      for (let dr = -r; dr <= r; dr++)
        for (let dc = -r; dc <= r; dc++) {
          if (r > 0 && Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue; // ring only
          const col = cc + dc, row = cr + dr;
          const cell = sub.cellAt(col, row);
          if (cell && !cell.rock && !cell.hazard && !rockNear(col, row, BUF)) return { col, row };
        }
    return null;
  };
  const drop = (cc, cr, radius) => {
    const c0 = findClear(cc, cr);                  // relocate the cluster to clear ground
    if (!c0) return;
    stamp(sub, c0.col, c0.row, radius, (cell, dist, col, row) => {
      if (cell.hazard || cell.rock) return;        // no food inside rock
      if (rockNear(col, row, BUF)) return;         // …or close enough to be under a boulder
      cell.nutrient = N; cell.maxNutrient = N;     // flat — same value every cell
    });
  };
  const count = Math.max(1, s.foodClusterCount);
  const xLo = startCols + 1, xHi = goalStart;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;                                  // even left→right spread
    let cc = Math.round(xLo + t * (xHi - xLo) + rng.range(-1, 1));
    cc = Math.max(1, Math.min(sub.cols - 2, cc));
    drop(cc, pathRow[cc], rng.int(s.foodClusterRadiusMin, s.foodClusterRadiusMax));
  }
  for (const lk of lakes) {
    const cc = Math.min(sub.cols - 2, lk.c1 + 1);    // just past the lake, beneath the deepest water
    drop(cc, Math.min(sub.rows - 1, lk.maxDepth + 1), s.foodClusterRadiusMax);
  }

  return sub;
}

// Stamp a circular footprint, invoking cb(cell, distInCells, col, row) per cell.
function stamp(sub, cc, cr, radius, cb) {
  for (let row = cr - radius; row <= cr + radius; row++) {
    for (let col = cc - radius; col <= cc + radius; col++) {
      if (!sub.inBounds(col, row)) continue;
      const dist = Math.hypot(col - cc, row - cr);
      if (dist > radius) continue;
      cb(sub.cells[sub.index(col, row)], dist, col, row);
    }
  }
}
