// =============================================================================
// Substrate — the underground VOLUME: a voxel field + the surface plane.
//
// 3D port of the 2D game's substrate (a side-on cross-section grid). Renderer-
// agnostic. Holds a 3D grid of underground voxels (nutrient / rock / water /
// Trichoderma intensity) and a per-(x,z)-column surface description (soil vs
// non-soil, shade vs sun, goal). All spatial queries the engine needs live here.
//
// Grid coordinate model:
//   - cx (col)   : along x, cx 0 at world x in [0, cellSize)
//   - cy (lay)   : layers DOWN from the surface; lay 0 spans world y in
//                  (-cellSize, 0]  (the surface plane is y = 0, underground y<0)
//   - cz (row)   : along z, row 0 at world z in [0, cellSize)
// =============================================================================

export class Substrate {
  constructor(config) {
    const { width, depth, breadth, cellSize } = config.world;
    this.cellSize = cellSize;
    this.worldWidth = width;    // x extent
    this.worldDepth = depth;    // -y extent (surface plane at y = 0)
    this.worldBreadth = breadth;// z extent
    this.cols = Math.floor(width / cellSize);
    this.lays = Math.floor(depth / cellSize);
    this.rows = Math.floor(breadth / cellSize);
    // Flat voxel array, indexed [(lay * rows + row) * cols + col].
    this.cells = new Array(this.cols * this.lays * this.rows);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = { nutrient: 0, maxNutrient: 0, rock: false, water: false, formation: false, curtain: false, antTrail: false, hazard: false, trich: 0, held: 0, colonized: 0 };
    }
    // Surface descriptor per (cx, cz) column of the surface plane.
    //   soil    : fruitable ground (only the goal-side zones)
    //   shade   : shaded soil (bonus fruit payout)
    //   goal    : the eastern exit zone you must cross to
    //   barrier : un-surfaceable terrain type ('concrete' | 'rock' | 'lake')
    this.surface = new Array(this.cols * this.rows);
    for (let i = 0; i < this.surface.length; i++) {
      this.surface[i] = { soil: true, shade: false, goal: false, barrier: null };
    }
    // Feature lists recorded during generation, purely for the renderer.
    this.features = { curtains: [], lakes: [], boulders: [], formations: [], foodClusters: [] };
  }

  // --- coordinate helpers ----------------------------------------------------
  index(cx, cy, cz) { return (cy * this.rows + cz) * this.cols + cx; }
  inBounds(cx, cy, cz) {
    return cx >= 0 && cx < this.cols && cy >= 0 && cy < this.lays && cz >= 0 && cz < this.rows;
  }
  surfIndex(cx, cz) { return cz * this.cols + cx; }
  surfInBounds(cx, cz) { return cx >= 0 && cx < this.cols && cz >= 0 && cz < this.rows; }
  surfaceAt(cx, cz) { return this.surfInBounds(cx, cz) ? this.surface[this.surfIndex(cx, cz)] : null; }

  colAtX(x) { return Math.floor(x / this.cellSize); }
  layAtY(y) { return Math.floor(-y / this.cellSize); }   // y=-1 -> lay 0
  rowAtZ(z) { return Math.floor(z / this.cellSize); }

  cellCenter(cx, cy, cz) {
    return {
      x: cx * this.cellSize + this.cellSize / 2,
      y: -(cy * this.cellSize + this.cellSize / 2),
      z: cz * this.cellSize + this.cellSize / 2,
    };
  }
  surfaceCenter(cx, cz) {
    return { x: cx * this.cellSize + this.cellSize / 2, y: 0, z: cz * this.cellSize + this.cellSize / 2 };
  }

  cellAt(cx, cy, cz) {
    return this.inBounds(cx, cy, cz) ? this.cells[this.index(cx, cy, cz)] : null;
  }
  cellAtWorld(x, y, z) {
    return this.cellAt(this.colAtX(x), this.layAtY(y), this.rowAtZ(z));
  }

  // Iterate every voxel with its grid coordinates.
  forEachCell(cb) {
    for (let cy = 0; cy < this.lays; cy++) {
      for (let cz = 0; cz < this.rows; cz++) {
        for (let cx = 0; cx < this.cols; cx++) {
          cb(this.cells[this.index(cx, cy, cz)], cx, cy, cz);
        }
      }
    }
  }

  // Iterate voxels whose centres fall within `radius` of a world point.
  cellsInRadius(x, y, z, radius, cb) {
    const r = Math.ceil(radius / this.cellSize) + 1;
    const c0 = this.colAtX(x), l0 = this.layAtY(y), r0 = this.rowAtZ(z);
    const rad2 = radius * radius;
    for (let cy = l0 - r; cy <= l0 + r; cy++) {
      for (let cz = r0 - r; cz <= r0 + r; cz++) {
        for (let cx = c0 - r; cx <= c0 + r; cx++) {
          if (!this.inBounds(cx, cy, cz)) continue;
          const c = this.cellCenter(cx, cy, cz);
          const dx = c.x - x, dy = c.y - y, dz = c.z - z;
          if (dx * dx + dy * dy + dz * dz <= rad2) {
            cb(this.cells[this.index(cx, cy, cz)], cx, cy, cz, c);
          }
        }
      }
    }
  }

  // Deposit nutrient in a sphere (Add Substrate action). Flat patch per cell.
  deposit(x, y, z, amount, radiusCells) {
    const c0 = this.colAtX(x), l0 = this.layAtY(y), r0 = this.rowAtZ(z);
    for (let cy = l0 - radiusCells; cy <= l0 + radiusCells; cy++) {
      for (let cz = r0 - radiusCells; cz <= r0 + radiusCells; cz++) {
        for (let cx = c0 - radiusCells; cx <= c0 + radiusCells; cx++) {
          if (!this.inBounds(cx, cy, cz)) continue;
          const dist = Math.hypot(cx - c0, cy - l0, cz - r0);
          if (dist > radiusCells) continue;
          const cell = this.cells[this.index(cx, cy, cz)];
          if (cell.rock) continue;                 // can't place food in rock
          cell.nutrient = Math.max(cell.nutrient, amount);
          cell.maxNutrient = Math.max(cell.maxNutrient, amount);
        }
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
// Procedural generation. Builds the traversal level in 3D: the colony enters at
// the WEST face and must cross the volume to the fruitable GOAL zone at the
// EAST, digging under rock curtains and the lake. Food is sparse caches strung
// along a guaranteed (carved) route.
// -----------------------------------------------------------------------------
export function generateSubstrate(config, rng) {
  const sub = new Substrate(config);
  const s = config.substrate;

  const goalCols = Math.max(2, Math.min(sub.cols - 4, s.goalCols || 6));
  const startCols = Math.max(1, Math.min(sub.cols - goalCols - 1, s.startCols || 2));
  const goalStart = sub.cols - goalCols;
  const summerCols = Math.max(0, Math.min(goalStart - startCols - 2, s.goalSummerCols || 0));

  // 1) Surface plane: everything is impassable by default; the goal zone (and
  //    the summery approach just west of it) is fruitable soil.
  for (let cz = 0; cz < sub.rows; cz++) {
    for (let cx = 0; cx < sub.cols; cx++) {
      const surf = sub.surface[sub.surfIndex(cx, cz)];
      surf.soil = false; surf.shade = false; surf.goal = false; surf.barrier = 'concrete';
      if (cx >= goalStart - summerCols) {
        surf.soil = true; surf.goal = true; surf.barrier = null;
        surf.shade = cx >= goalStart ? rng.chance(s.shadeFraction) : false;
      }
    }
  }

  // 2) Rock CURTAINS — near-vertical walls spanning the FULL z-breadth, from
  //    the surface down. The mycelium must dig under (z offers no way around),
  //    though some curtains have one eroded porthole as a risky shortcut.
  const occupied = new Array(sub.cols).fill(false);  // x-cols claimed by features
  const curtainCount = rng.int(Math.max(0, s.curtainCountMin || 2), Math.max(0, s.curtainCountMax || 4));
  const thick = Math.max(1, s.curtainThicknessCols || 2);
  const cdMin = s.curtainDepthMinLays || 6, cdMax = s.curtainDepthMaxLays || 11;
  const tiltMax = (s.curtainTiltMaxDeg || 25) * Math.PI / 180;
  const pathH = Math.max(1, s.pathLays || 2);
  const cLo = startCols + 2, cHi = goalStart - 2 - thick - summerCols;
  let attempts = 0;
  while (sub.features.curtains.length < curtainCount && attempts++ < 300 && cHi > cLo) {
    const cx0 = rng.int(cLo, cHi);
    const depth = Math.max(3, Math.min(sub.lays - pathH - 1, rng.int(cdMin, cdMax)));
    const tilt = rng.range(-tiltMax, tiltMax);
    const shift = Math.round(depth * Math.tan(tilt));
    const lo = Math.min(cx0, cx0 + shift) - 1, hi = Math.max(cx0 + thick - 1, cx0 + thick - 1 + shift) + 1;
    let ok = lo >= 0 && hi < sub.cols;
    if (ok) for (let c = lo; c <= hi; c++) if (occupied[c]) { ok = false; break; }
    if (ok) for (const p of sub.features.curtains) if (Math.abs(p.cx0 - cx0) < thick + 5) { ok = false; break; }
    if (!ok) continue;
    // Optional eroded porthole through the wall (a risky shortcut).
    const hasGap = rng.chance(s.curtainGapChance || 0);
    const gap = hasGap ? {
      cy: rng.int(2, Math.max(2, depth - 2)),
      cz: rng.int(3, Math.max(3, sub.rows - 4)),
      r: s.curtainGapRadiusCells || 1.5,
    } : null;
    for (let cy = 0; cy <= depth; cy++) {
      const cxAt = cx0 + Math.round(cy * Math.tan(tilt));
      for (let w = 0; w < thick; w++) {
        for (let cz = 0; cz < sub.rows; cz++) {
          if (gap && Math.hypot(cy - gap.cy, cz - gap.cz) <= gap.r) continue;
          const cell = sub.cellAt(cxAt + w, cy, cz);
          if (cell) { cell.rock = true; cell.curtain = true; cell.nutrient = 0; cell.maxNutrient = 0; }
        }
      }
    }
    // Un-surfaceable rock along the top of the wall.
    for (let w = 0; w < thick; w++) for (let cz = 0; cz < sub.rows; cz++) {
      const surf = sub.surfaceAt(cx0 + w, cz);
      if (surf) { surf.soil = false; surf.goal = false; surf.barrier = 'rock'; }
    }
    for (let c = lo; c <= hi; c++) occupied[c] = true;
    sub.features.curtains.push({ cx0, thick, depth, tilt, lo, hi, gap });
  }

  // 3) LAKE basin — an ellipsoid bowl of impassable water carved into the
  //    surface. Deepest at the centre, tapering to the rim in both x and z.
  const lakeCount = rng.int(Math.max(0, s.lakeCountMin || 0), Math.max(0, s.lakeCountMax || 0));
  const lwMin = s.lakeWidthMinCols || 8, lwMax = s.lakeWidthMaxCols || 13;
  const lbMin = s.lakeBreadthMinRows || 9, lbMax = s.lakeBreadthMaxRows || 16;
  const ldMin = s.lakeDepthMinLays || 3, ldMax = s.lakeDepthMaxLays || 7;
  const lakeLo = startCols + 3, lakeHi = goalStart - 3 - summerCols;
  // Free spans between curtains along x; drop the lake into the widest one.
  const spans = [];
  let sc = -1;
  for (let c = lakeLo; c <= lakeHi; c++) {
    if (!occupied[c]) { if (sc < 0) sc = c; }
    else if (sc >= 0) { spans.push([sc, c - 1]); sc = -1; }
  }
  if (sc >= 0) spans.push([sc, lakeHi]);
  spans.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  for (const [s0, s1] of spans) {
    if (sub.features.lakes.length >= lakeCount) break;
    const spanW = s1 - s0 + 1;
    if (spanW < lwMin + 1) continue;
    const lw = Math.min(rng.int(lwMin, lwMax), spanW - 1);
    const lb = Math.min(rng.int(lbMin, lbMax), sub.rows - 4);
    const cx0 = s0 + Math.floor((spanW - lw) / 2);
    const cz0 = Math.floor((sub.rows - lb) / 2) + rng.int(-2, 2);
    const maxDepth = Math.max(ldMin, Math.min(ldMax, sub.lays - pathH - 2));
    const cxm = cx0 + lw / 2, czm = cz0 + lb / 2;
    for (let cx = cx0; cx < cx0 + lw; cx++) {
      for (let cz = Math.max(0, cz0); cz < Math.min(sub.rows, cz0 + lb); cz++) {
        const tx = (cx + 0.5 - cxm) / (lw / 2);
        const tz = (cz + 0.5 - czm) / (lb / 2);
        const f = 1 - tx * tx - tz * tz;
        if (f <= 0) continue;
        const d = Math.max(1, Math.round(maxDepth * Math.sqrt(f)));
        const surf = sub.surfaceAt(cx, cz);
        if (surf) { surf.barrier = 'lake'; surf.soil = false; surf.goal = false; }
        for (let cy = 0; cy < d; cy++) {
          const cell = sub.cellAt(cx, cy, cz);
          if (cell) { cell.rock = true; cell.water = true; cell.nutrient = 0; cell.maxNutrient = 0; }
        }
      }
    }
    for (let c = cx0 - 1; c <= cx0 + lw; c++) if (c >= 0 && c < sub.cols) occupied[c] = true;
    sub.features.lakes.push({ cx0, lw, cz0, lb, maxDepth });
  }

  // 4) Large rock FORMATIONS — impassable ellipsoid masses scattered through
  //    the volume (wide and low), kept off the water/curtains and spaced apart.
  //    Drawn from their own deterministic sub-stream (as in 2D) so tuning rock
  //    density never perturbs the gameplay RNG.
  let _fa = ((rng() * 4294967296) >>> 0) || 1;
  const frng = () => { _fa |= 0; _fa = (_fa + 0x6d2b79f5) | 0; let t = Math.imul(_fa ^ (_fa >>> 15), 1 | _fa); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  frng.int = (min, max) => Math.floor(frng() * (max - min + 1)) + min;
  frng.range = (min, max) => min + frng() * (max - min);
  frng.chance = (p) => frng() < p;

  const fCount = Math.max(0, s.formationCount || 0);
  const frMin = s.formationRadiusMinCols || 2.5, frMax = s.formationRadiusMaxCols || 5.5;
  const fLo = startCols + 3, fHi = goalStart - 3 - summerCols;
  let fAttempts = 0;
  while (sub.features.formations.length < fCount && fAttempts++ < 600 && fHi - fLo > frMin * 2) {
    const rx = frng.range(frMin, frMax);
    const ry = Math.max(1, rx / 2.2);                    // wide & low
    const rz = rx * frng.range(0.6, 1.0);
    const cc = frng.range(fLo + rx, fHi - rx);
    const layMax = Math.max(3, Math.min(sub.lays - Math.ceil(ry) - 1, Math.round(sub.lays * 0.66)));
    if (layMax <= 2 + ry) continue;
    const cl = frng.range(2 + ry, layMax);
    const cr = frng.range(2 + rz, sub.rows - 2 - rz);
    let ok = true;
    for (let cy = Math.floor(cl - ry); cy <= Math.ceil(cl + ry) && ok; cy++)
      for (let cz = Math.floor(cr - rz); cz <= Math.ceil(cr + rz) && ok; cz++)
        for (let cx = Math.floor(cc - rx); cx <= Math.ceil(cc + rx); cx++) {
          const cell = sub.cellAt(cx, cy, cz);
          if (cell && (cell.water || cell.curtain)) { ok = false; break; }
        }
    if (ok) for (const p of sub.features.formations)
      if (Math.abs(cc - p.cc) < rx + p.rx + 1 && Math.abs(cl - p.cl) < ry + p.ry + 1 && Math.abs(cr - p.cr) < rz + p.rz + 1) { ok = false; break; }
    if (!ok) continue;
    for (let cy = Math.floor(cl - ry); cy <= Math.ceil(cl + ry); cy++)
      for (let cz = Math.floor(cr - rz); cz <= Math.ceil(cr + rz); cz++)
        for (let cx = Math.floor(cc - rx); cx <= Math.ceil(cc + rx); cx++) {
          const nx = (cx - cc) / rx, ny = (cy - cl) / ry, nz = (cz - cr) / rz;
          const dd = nx * nx + ny * ny + nz * nz;
          if (dd > 1) continue;
          if (dd > 0.78 && frng.chance(0.35)) continue;  // irregular edge
          const cell = sub.cellAt(cx, cy, cz);
          if (!cell || cell.water) continue;
          cell.rock = true; cell.formation = true; cell.nutrient = 0; cell.maxNutrient = 0;
        }
    sub.features.formations.push({ cc, cl, cr, rx, ry, rz, seed: frng() });
  }

  // 5) Lone BOULDERS — scattered 1-voxel rocks to weave through while flying.
  for (let i = 0; i < (s.boulderCount || 0); i++) {
    const cx = frng.int(startCols + 2, goalStart - 2);
    const cy = frng.int(2, Math.max(2, sub.lays - 2));
    const cz = frng.int(1, sub.rows - 2);
    const cell = sub.cellAt(cx, cy, cz);
    if (!cell || cell.water || cell.rock) continue;
    cell.rock = true;
    sub.features.boulders.push({ cx, cy, cz, seed: frng() });
  }

  // 6) Carve a guaranteed connected route from entry to goal: a tunnel that
  //    weaves in z and DIPS beneath every barrier. Built as a per-x-col layer
  //    profile that changes by at most 1 layer per col, so the cleared windows
  //    always overlap and connect.
  //    First, the z centreline weaves gently across the volume.
  const zc = new Array(sub.cols);
  const zMid = sub.rows / 2;
  const zAmp = Math.max(2, sub.rows * 0.28);
  const zPhase = rng.range(0, Math.PI * 2);
  const zFreq = rng.range(1.2, 2.2) * Math.PI / sub.cols;
  for (let cx = 0; cx < sub.cols; cx++) {
    zc[cx] = Math.round(zMid + Math.sin(cx * zFreq * 2 + zPhase) * zAmp * Math.sin((cx / sub.cols) * Math.PI));
    zc[cx] = Math.max(2, Math.min(sub.rows - 3, zc[cx]));
  }
  // Required tunnel depth per x-col: below the deepest obstruction the tunnel's
  // z-window meets at that col (curtains span all z; the lake only some).
  const halfW = Math.max(0, s.pathHalfWidthCells || 1);
  const req = new Array(sub.cols).fill(1);
  for (let cx = 0; cx < sub.cols; cx++) {
    for (let cz = zc[cx] - halfW; cz <= zc[cx] + halfW; cz++) {
      if (cz < 0 || cz >= sub.rows) continue;
      let d = 0;
      while (d < sub.lays) {
        const cell = sub.cellAt(cx, d, cz);
        if (cell && (cell.curtain || cell.water)) d++;
        else break;
      }
      req[cx] = Math.max(req[cx], d + 1);
    }
  }
  const pr = req.slice();
  for (let c = 1; c < sub.cols; c++) pr[c] = Math.max(pr[c], pr[c - 1] - 1);
  for (let c = sub.cols - 2; c >= 0; c--) pr[c] = Math.max(pr[c], pr[c + 1] - 1);
  const pathLay = pr.map((r) => Math.max(0, Math.min(sub.lays - pathH, r)));
  for (let cx = 0; cx < sub.cols; cx++) {
    for (let cz = zc[cx] - halfW; cz <= zc[cx] + halfW; cz++) {
      for (let cy = pathLay[cx]; cy < pathLay[cx] + pathH; cy++) {
        const cell = sub.cellAt(cx, cy, cz);
        if (cell && !cell.water) cell.rock = false;   // never carve through the lake
      }
    }
  }
  sub.pathLay = pathLay;   // exposed for food placement + the seed column
  sub.pathZ = zc;

  // Entry + goal channels always clear (root in, surface out): full-depth
  // clearance around the tunnel z-window at both ends.
  const clearChannel = (c0, c1) => {
    for (let cx = c0; cx < c1; cx++) {
      for (let cz = Math.max(0, zc[Math.max(0, Math.min(sub.cols - 1, cx))] - halfW - 1); cz <= Math.min(sub.rows - 1, zc[Math.max(0, Math.min(sub.cols - 1, cx))] + halfW + 1); cz++) {
        for (let cy = 0; cy < sub.lays; cy++) {
          const cell = sub.cellAt(cx, cy, cz);
          if (cell && !cell.water) cell.rock = false;
        }
      }
    }
  };
  clearChannel(0, startCols + 1);
  clearChannel(goalStart - 1, sub.cols);

  // 7) Food — SPARSE caches strung along the carved route, so energy is a real
  //    constraint and steering with Add-Substrate matters. A reward cache sits
  //    beneath each curtain's dip and past the lake's deepest point.
  const N = s.foodCellNutrient;
  const BUF = s.foodRockBuffer || 2.2;
  const rockNear = (cx, cy, cz, r) => {
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++)
      for (let dz = -ri; dz <= ri; dz++)
        for (let dx = -ri; dx <= ri; dx++) {
          if (dx * dx + dy * dy + dz * dz > r * r) continue;
          const cell = sub.cellAt(cx + dx, cy + dy, cz + dz);
          if (cell && cell.rock) return true;
        }
    return false;
  };
  // Nearest open voxel to (cc,ll,rr) clear of rock (expanding shells).
  const findClear = (cc, ll, rr) => {
    for (let r = 0; r <= 6; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dz = -r; dz <= r; dz++)
          for (let dx = -r; dx <= r; dx++) {
            if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue; // shell only
            const cx = cc + dx, cy = ll + dy, cz = rr + dz;
            const cell = sub.cellAt(cx, cy, cz);
            if (cell && !cell.rock && !rockNear(cx, cy, cz, BUF)) return { cx, cy, cz };
          }
    return null;
  };
  const radius = Math.max(0, s.foodClusterRadiusCells || 1);
  const drop = (cc, ll, rr) => {
    const c0 = findClear(cc, Math.max(0, Math.min(sub.lays - 1, ll)), Math.max(0, Math.min(sub.rows - 1, rr)));
    if (!c0) return;
    let placed = 0;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dz = -radius; dz <= radius; dz++)
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.hypot(dx, dy, dz) > radius + 0.01) continue;
          const cx = c0.cx + dx, cy = c0.cy + dy, cz = c0.cz + dz;
          const cell = sub.cellAt(cx, cy, cz);
          if (!cell || cell.rock || rockNear(cx, cy, cz, BUF)) continue;
          cell.nutrient = N; cell.maxNutrient = N;
          placed++;
        }
    if (placed > 0) sub.features.foodClusters.push(sub.cellCenter(c0.cx, c0.cy, c0.cz));
  };
  // A guaranteed STARTER cache just below the seed filament, inside its sensing
  // radius, so the colony's very first Grow has something to reach for.
  {
    const seedCol = Math.max(1, Math.floor(startCols / 2));
    const seedLay = Math.min(sub.lays - 1, Math.ceil((config.growth.startDepth + config.growth.sensingRadius * 0.4) / sub.cellSize));
    drop(seedCol + 1, seedLay, zc[seedCol]);
  }
  const count = Math.max(1, s.foodClusterCount);
  const xLo = startCols + 1, xHi = goalStart;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;                                  // even west->east spread
    let cc = Math.round(xLo + t * (xHi - xLo) + rng.range(-1, 1));
    cc = Math.max(1, Math.min(sub.cols - 2, cc));
    drop(cc, pathLay[cc], zc[cc] + rng.int(-1, 1));
  }
  for (const ct of sub.features.curtains) {
    const cc = Math.min(sub.cols - 2, ct.hi + 1);    // just past the wall, down at the dip
    drop(cc, Math.min(sub.lays - 1, ct.depth + 1), zc[Math.max(0, Math.min(sub.cols - 1, cc))]);
  }
  for (const lk of sub.features.lakes) {
    const cc = Math.min(sub.cols - 2, lk.cx0 + lk.lw + 1); // just past the lake, beneath the deepest water
    drop(cc, Math.min(sub.lays - 1, lk.maxDepth + 1), Math.round(lk.cz0 + lk.lb / 2));
  }

  return sub;
}
