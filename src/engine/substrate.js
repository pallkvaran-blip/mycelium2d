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
    // worldHeight is the CONTENT region: the grid + ALL generation/engine bounds
    // stay inside it, so nothing spawns in the buffer below.
    this.worldHeight = height;
    // viewHeight adds an empty dirt buffer below the content (fades to black) that
    // the camera + renderer use, so the player can scroll the deepest content clear
    // of the bottom UI. Engine code never uses this.
    this.viewHeight = height + (config.world.bottomBuffer || 0);
    this.cols = Math.floor(width / cellSize);
    this.rows = Math.floor((height - surfaceY) / cellSize);
    // Flat cell array, indexed [row * cols + col].
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = { nutrient: 0, maxNutrient: 0, hazard: false, rock: false, water: false, formation: false, column: false, antTrail: false, trich: 0, held: 0, colonized: 0, antProof: 0, mouldProof: 0, hardened: 0, reinfectGrace: 0, bored: false, pathClear: false, rockFill: false, foodKind: '', energyPerNutrient: null };
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
  // FINE-resolution rock collision for growth (built by main.js solidifyRock). True
  // if the exact point (x,y) is under a drawn rock sprite or lake water. The mask is
  // several times finer than the 36px cell grid (see _fineSize), so it matches the
  // VISIBLE art closely: growth threads a real gap and stops at a real edge, with no
  // coarse-grid false gaps (grow through touching rocks) or false walls (blocked at a
  // visible gap). Falls back to the coarse cell.rock flag before the mask exists.
  solidAtWorld(x, y) {
    const fs = this._fineSolid;
    if (!fs) { const c = this.cellAtWorld(x, y); return !!(c && c.rock); }
    const fc = Math.floor(x / this._fineSize);
    const fr = Math.floor((y - this.surfaceY) / this._fineSize);
    if (fc < 0 || fr < 0 || fc >= this._fineCols || fr >= this._fineRows) return false;
    return fs[fr * this._fineCols + fc] === 1;
  }
  // True if any rock cell lies within `r` cells of (col,row). Rock SPRITES
  // (boulders/formations/columns) render several cells larger than their flagged
  // cells and `solidifyRock()` only fills that true footprint at render time — so
  // spawns/food must keep this clearance or they read as sitting on a rock.
  rockNear(col, row, r = 2.2) {
    const ri = Math.ceil(r), r2 = r * r;
    for (let dr = -ri; dr <= ri; dr++)
      for (let dc = -ri; dc <= ri; dc++) {
        if (dc * dc + dr * dr > r2) continue;
        const cell = this.cellAt(col + dc, row + dr);
        if (cell && cell.rock) return true;
      }
    return false;
  }
  rockNearWorld(x, y, r) { return this.rockNear(this.colAtX(x), this.rowAtY(y), r); }

  // Pick an open spawn spot (clear of the oversized rock sprites, preferring the
  // shallow 60% band) SPREAD evenly across the width. Because rock is dense in the
  // middle of the shallow band, a plain random-x-with-reject loop piles spawns onto
  // the one clear strip near the goal — so each spawn targets its own horizontal
  // BAND (via opts.i / opts.count) and is allowed to go deeper inside that band if
  // its shallow rows are all rock. opts: { root, minDist, avoidFood, i, count }.
  findSpawnSpot(rng, opts = {}) {
    const W = this.worldWidth, cs = this.cellSize;
    const root = opts.root, minDist = opts.minDist || 0, avoidFood = !!opts.avoidFood;
    const loX = Math.max(cs, root ? root.x + minDist : cs);   // keep a gap right of the colony
    const hiX = W - cs;
    const span = Math.max(cs, hiX - loX);
    let bLo = loX, bHi = hiX;
    if (opts.count && opts.count > 1) {                        // this spawn's own band
      const bw = span / opts.count;
      bLo = loX + opts.i * bw; bHi = loX + (opts.i + 1) * bw;
    }
    const shallow = (this.rows - 1) * cs * 0.6, deep = (this.rows - 1) * cs;
    const clear = (x, y) => {
      const c = this.cellAtWorld(x, y);
      if (!c || c.rock || (avoidFood && c.maxNutrient > 0)) return null;
      // 4-cell gap: the widest boulder sprites reach ~3.3–3.7 cells past their seed
      // cell, and solidifyRock() flags that whole footprint — 3 was marginal.
      if (this.rockNear(this.colAtX(x), this.rowAtY(y), 4)) return null;
      return { x, y };
    };
    let ground = null, soft = null;   // fallbacks: raw open ground / open ground with a small (1.6-cell) rock gap
    const scan = (x0, x1, yMax, tries) => {
      for (let t = 0; t < tries; t++) {
        const x = rng.range(x0, x1), y = this.surfaceY + rng.range(cs, yMax);
        const s = clear(x, y);
        if (s) return s;
        const c = this.cellAtWorld(x, y);
        if (c && !c.rock && !(avoidFood && c.maxNutrient > 0)) {
          ground = { x, y };
          if (!this.rockNear(this.colAtX(x), this.rowAtY(y), 1.6)) soft = { x, y };
        }
      }
      return null;
    };
    return scan(bLo, bHi, shallow, 40)     // in-band, shallow
        || scan(bLo, bHi, deep, 40)        // in-band, any depth (rocky shallow rows)
        || scan(loX, hiX, deep, 200)       // anywhere ahead of the colony (many tries → reliably off-rock)
        || soft || ground
        || { x: (bLo + bHi) / 2, y: this.surfaceY + cs * 3 };
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

  // --- line of sight -------------------------------------------------------
  // True if a clear straight line runs from (x0,y0) to (x1,y1): no rock cell
  // lies on the segment (sampled at half-cell steps, endpoint included). Rock
  // blocks line of sight — worms and mould clouds can't sense through it.
  segmentClear(x0, y0, x1, y1) {
    const cs = this.cellSize;
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cs * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const x = x0 + dx * (i / steps), y = y0 + dy * (i / steps);
      const c = this.cellAtWorld(x, y);
      if (c && c.rock) return false;
    }
    return true;
  }

  // Cast a fan of `rays` rays out to `radius` from (ox,oy); each ray stops at
  // the first rock cell it meets. Returns the ray endpoints (world coords) as a
  // closed, star-shaped polygon of what the point can actually SEE — so a sight
  // overlay drawn from it is occluded by rock instead of bleeding through it.
  // Marched at half-cell steps (same resolution as segmentClear).
  visionPolygon(ox, oy, radius, rays = 96) {
    const stepLen = this.cellSize * 0.5;
    const steps = Math.max(1, Math.ceil(radius / stepLen));
    const poly = new Array(rays);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      let reach = radius;
      for (let s = 1; s <= steps; s++) {
        const t = s * stepLen;
        if (t >= radius) break;                          // reached the edge in the open
        const c = this.cellAtWorld(ox + dx * t, oy + dy * t);
        if (c && c.rock) { reach = t; break; }           // blocked — die at the rock face
      }
      poly[i] = { x: ox + dx * reach, y: oy + dy * reach };
    }
    return poly;
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
        // Player-placed food = a humble NUT cache (energy only, no card). Never
        // downgrade a MAP cache cell (orange draft / red engine / brown duff).
        if (!cell.foodKind || cell.foodKind === 'nut') cell.foodKind = 'nut';
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
  // …the cols just LEFT of the goal are the SUMMERY approach under the hill, and
  // they are ALL fruitable too (sunlit, no shade) — so the whole landscape under
  // the hill can be fruited, not just the goal half. Dark-world features (cities,
  // mountains, columns, formations, lakes) are kept out of this zone below.
  const summerCols = Math.max(0, Math.min(goalStart - startCols - 2, s.goalSummerCols || 0));
  for (let c = goalStart - summerCols; c < goalStart; c++)
    if (c >= 0) { sub.surface[c].barrier = null; sub.surface[c].soil = true; sub.surface[c].goal = true; sub.surface[c].shade = false; }
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
    const rr = rng.int(3, Math.max(3, sub.rows - 2)); // keep off the top rows (big boulders mustn't poke above ground)
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
  const innerLo = startCols + 3, innerHi = goalStart - 3 - wallW - summerCols;
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
  const lakeLo = startCols + 3, lakeHi = goalStart - 3 - summerCols;
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

  // 2c-i2) ROCK COLUMNS — the path-blocking barriers. Each is a near-vertical
  //   (±tilt) strip of impassable rock running from the SURFACE down to depth, so
  //   the mycelium must dig UNDER it. 2–6 per map, placed in free inner columns
  //   (clear of mountains and lakes). The renderer draws each as a vertical stack
  //   of large rock-formation sprites. Marked column=true (and rock=true).
  sub.rockColumns = [];
  const colCount = rng.int(Math.max(0, s.columnCountMin || 2), Math.max(0, s.columnCountMax || 6));
  const colW = Math.max(1, s.columnWidthCols || 2);
  const cdMin = s.columnDepthMinRows || 6, cdMax = s.columnDepthMaxRows || 11;
  const tiltMax = (s.columnTiltMaxDeg || 30) * Math.PI / 180;
  const colLo = startCols + 2, colHi = goalStart - 2 - colW - summerCols;
  const placedCols = [];
  let colAttempts = 0;
  while (sub.rockColumns.length < colCount && colAttempts++ < 300 && colHi > colLo) {
    const cx = rng.int(colLo, colHi);
    const depth = Math.max(3, Math.min(sub.rows - pathH - 1, rng.int(cdMin, cdMax)));
    const tilt = rng.range(-tiltMax, tiltMax);
    const shift = Math.round(depth * Math.tan(tilt));   // horizontal drift at the bottom
    // span of columns this tilted strip touches (for spacing + clearance checks)
    const lo = Math.min(cx, cx + shift) - 1, hi = Math.max(cx + colW - 1, cx + colW - 1 + shift) + 1;
    let ok = lo >= 0 && hi < sub.cols;
    if (ok) for (let c = lo; c <= hi; c++) if (occupied[c]) { ok = false; break; }   // clear of mountains/lakes
    if (ok) for (const p of placedCols) if (Math.abs(p - cx) < colW + 5) { ok = false; break; } // spaced apart
    if (!ok) continue;
    placedCols.push(cx);
    for (let r = 0; r <= depth; r++) {
      const center = cx + Math.round(r * Math.tan(tilt));
      for (let w = 0; w < colW; w++) {
        const col = center + w;
        const cell = sub.cellAt(col, r);
        if (cell) { cell.rock = true; cell.column = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false; }
      }
    }
    // surface: un-surfaceable rock at the top of the column (so cities/mountains avoid it)
    for (let w = 0; w < colW; w++) { const col = cx + w; if (col >= 0 && col < sub.cols) { sub.surface[col].soil = false; sub.surface[col].goal = false; sub.surface[col].barrier = 'rock'; } }
    for (let c = lo; c <= hi; c++) if (c >= 0 && c < sub.cols) occupied[c] = true;   // reserve so formations avoid
    sub.rockColumns.push({ cx, depth, tilt, lo, hi });
  }

  // 2c-iii) Large rock FORMATIONS — wide, impassable masses, each drawn as ONE
  //   AI rock-formation sprite (crystal / ember / fungal / glow). SCATTERED across
  //   the whole inner band (not packed into the few free spans), kept off the
  //   lakes/columns and spaced apart so each stays its own connected patch (one
  //   sprite). Footprints are WIDE and LOW (ellipse, ≈2.4:1) to match the art.
  const fCount = Math.max(0, s.formationCount || 0);
  const fwMin = s.formationWidthMinCols || 5, fwMax = s.formationWidthMaxCols || 11;
  const fLo = startCols + 3, fHi = goalStart - 3 - summerCols;
  // Formations draw from their OWN deterministic sub-stream (seeded from a single
  // main draw). Their count/placement consumes thousands of rolls, so keeping them
  // OFF the main stream means tuning rock density never perturbs the gameplay RNG
  // (colony growth, ants, nematodes) — the sim stays reproducible as terrain changes.
  let _fa = ((rng() * 4294967296) >>> 0) || 1;
  const frng = () => { _fa |= 0; _fa = (_fa + 0x6d2b79f5) | 0; let t = Math.imul(_fa ^ (_fa >>> 15), 1 | _fa); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  frng.int = (min, max) => Math.floor(frng() * (max - min + 1)) + min;
  frng.range = (min, max) => min + frng() * (max - min);
  frng.chance = (p) => frng() < p;
  const placedF = [];
  let fAttempts = 0;
  while (placedF.length < fCount && fAttempts++ < 600 && fHi - fLo > fwMin) {
    const wCols = frng.int(fwMin, fwMax);
    const rx = Math.max(2, wCols / 2);
    const ry = Math.max(1, rx / 2.4);                      // wide & low
    const cc = frng.range(fLo + rx, fHi - rx);
    // Spread across most of the depth (not just the surface, not the dead-deep floor).
    const rrMax = Math.max(3, Math.min(sub.rows - Math.ceil(ry) - 1, Math.round(sub.rows * 0.62)));
    if (rrMax <= 2 + ry) continue;
    const rr = frng.range(2 + ry, rrMax);
    let ok = true;
    for (let row = Math.floor(rr - ry); row <= Math.ceil(rr + ry) && ok; row++)   // keep off lake water + path-blocking columns
      for (let col = Math.floor(cc - rx); col <= Math.ceil(cc + rx); col++) {
        const cell = sub.cellAt(col, row);
        if (cell && (cell.water || cell.column)) { ok = false; break; }
      }
    if (ok) for (const p of placedF)                                       // spaced from other formations
      if (Math.abs(cc - p.cc) < rx + p.rx + 1 && Math.abs(rr - p.rr) < ry + p.ry + 1) { ok = false; break; }
    if (!ok) continue;
    for (let row = Math.floor(rr - ry); row <= Math.ceil(rr + ry); row++)
      for (let col = Math.floor(cc - rx); col <= Math.ceil(cc + rx); col++) {
        const nx = (col - cc) / rx, ny = (row - rr) / ry;
        const dd = nx * nx + ny * ny;
        if (dd > 1) continue;
        if (dd > 0.78 && frng.chance(0.35)) continue;       // irregular edge
        const cell = sub.cellAt(col, row);
        if (!cell || cell.water) continue;
        cell.rock = true; cell.formation = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false;
      }
    placedF.push({ cc, rr, rx, ry });
  }

  // 2d) Carve a guaranteed connected route from entry to goal: a shallow tunnel
  //     that DIPS beneath every barrier (rock columns and lakes). Built as a
  //     row-profile that changes by at most (pathH-1) rows per column, so the
  //     cleared windows always overlap and connect.
  const req = new Array(sub.cols).fill(1);                 // baseline: near the surface
  // Rock columns: the tunnel must pass beneath the column's deepest rock.
  for (const rc of sub.rockColumns) for (let col = rc.lo; col <= rc.hi; col++) {
    if (col >= 0 && col < sub.cols) req[col] = Math.max(req[col], rc.depth + 1);
  }
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
      if (cell && !cell.water) { cell.rock = false; cell.pathClear = true; }   // never carve through a lake; flag the guaranteed corridor so nothing re-fills it
    }

  // Entry + goal channels always clear (root in, surface out).
  const clearChannel = (c0, c1) => {
    for (let col = c0; col < c1; col++)
      for (let row = 0; row < sub.rows; row++) {
        const cell = sub.cellAt(col, row);
        if (cell && !cell.water) { cell.rock = false; cell.pathClear = true; }
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
  // True if no existing food cell (any pile, any kind) lies within `sep` cells of
  // (col,row). Keeps distinct piles a little apart so they don't read as one blob.
  const clearOfPiles = (col, row, sep) => {
    const ri = Math.ceil(sep);
    for (let dr = -ri; dr <= ri; dr++)
      for (let dc = -ri; dc <= ri; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) > sep) continue;
        const cell = sub.cellAt(col + dc, row + dr);
        if (cell && cell.maxNutrient > 0) return false;
      }
    return true;
  };
  // Min separation (cells) a new pile's centre keeps from any existing pile — a
  // little breathing room so piles don't merge into one big blob. 0 = disabled.
  const PILE_GAP = s.foodPileGapCells != null ? s.foodPileGapCells : 3;
  // Find the nearest cell to (cc,cr) that's open and clear of rock (spiral out).
  // First try to also keep PILE_GAP away from other piles; if nowhere within reach
  // qualifies, fall back to the nearest merely-clear cell (never fail to place).
  const findClear = (cc, cr) => {
    for (let pass = 0; pass < 2; pass++) {
      const wantGap = pass === 0 && PILE_GAP > 0;
      for (let r = 0; r <= 6; r++)
        for (let dr = -r; dr <= r; dr++)
          for (let dc = -r; dc <= r; dc++) {
            if (r > 0 && Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue; // ring only
            const col = cc + dc, row = cr + dr;
            const cell = sub.cellAt(col, row);
            if (cell && !cell.rock && !cell.hazard && !rockNear(col, row, BUF)
                && (!wantGap || clearOfPiles(col, row, PILE_GAP))) return { col, row };
          }
    }
    return null;
  };
  // Every cluster placed here is a MAP pile: finishing (fully digesting) one
  // grants a card draft (engine/cards.js). Piles the PLAYER drops later go
  // through Substrate.deposit() and are NOT registered, so they grant nothing.
  sub.foodPiles = [];
  // `kind` picks the litter: 'normal' → orange oak/maple leaves (drafts basic/event);
  // 'engine' → RED maple/autumn leaves (drafts an engine card). Both are real food you
  // colonise and digest; the render layer keys the leaf art off cell.foodKind.
  const drop = (cc, cr, radius, kind = 'normal') => {
    const c0 = findClear(cc, cr);                  // relocate the cluster to clear ground
    if (!c0) return;
    const cells = [];
    const fk = kind === 'engine' ? 'cache-engine' : 'cache';
    stamp(sub, c0.col, c0.row, radius, (cell, dist, col, row) => {
      if (cell.hazard || cell.rock) return;        // no food inside rock
      if (rockNear(col, row, BUF)) return;         // …or close enough to be under a boulder
      if (cell.nutrient > 0 && cell.foodKind && cell.foodKind !== fk) return;   // never cannibalise a DIFFERENT-kind cache (keeps draft pools + looks separate)
      cell.nutrient = N; cell.maxNutrient = N;     // flat — same value every cell
      cell.foodKind = fk;                          // map cache = leaf litter that grants a card draft
      cells.push(sub.index(col, row));
    });
    if (!cells.length) return;
    // A drop can be relocated onto an existing cache (findClear). Merge overlapping
    // drops of the SAME kind into ONE pile so a connected blob grants exactly one
    // draft; never merge an engine cache into a normal one (different draft pools).
    const set = new Set(cells);
    // Fold this drop into EVERY same-kind pile it overlaps (a drop can bridge two existing
    // piles) — merge them all into one so no cell is ever shared between two piles.
    const hit = sub.foodPiles.filter((p) => (p.kind || 'normal') === kind && p.cells.some((idx) => set.has(idx)));
    let pile;
    if (hit.length) {
      pile = hit[0];
      for (const idx of cells) if (!pile.cells.includes(idx)) pile.cells.push(idx);
      for (let i = 1; i < hit.length; i++) {
        for (const idx of hit[i].cells) if (!pile.cells.includes(idx)) pile.cells.push(idx);
        const j = sub.foodPiles.indexOf(hit[i]); if (j >= 0) sub.foodPiles.splice(j, 1);
      }
    } else {
      // Fixed per-pile Energy roll, per KIND: engine (red) is the highest tier, normal
      // (orange) mid. Duff (yellow) is re-rolled lower in the DUFF pass below.
      const eMin = kind === 'engine' ? (s.engineEnergyMin != null ? s.engineEnergyMin : 4) : (s.foodEnergyMin != null ? s.foodEnergyMin : 1);
      const eMax = kind === 'engine' ? (s.engineEnergyMax != null ? s.engineEnergyMax : 7) : (s.foodEnergyMax != null ? s.foodEnergyMax : 8);
      pile = { cells, rewarded: false, kind, energyValue: rng.int(eMin, eMax) };
      sub.foodPiles.push(pile);
    }
    // A map pile is worth a small FIXED Energy value (1..8), decoupled from its nutrient.
    // Spread that value across the pile's cells as energy-per-nutrient so draining the whole
    // pile yields exactly energyValue — while the nutrient amounts (and thus attraction,
    // threat-eating and colonisation timing) stay exactly as before.
    const per = pile.energyValue / Math.max(1, pile.cells.length * N);
    for (const idx of pile.cells) sub.cells[idx].energyPerNutrient = per;
  };
  const count = Math.max(1, s.foodClusterCount);
  const xLo = startCols + 1, xHi = goalStart;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;                                  // even left→right spread
    let cc = Math.round(xLo + t * (xHi - xLo) + rng.range(-1, 1));
    cc = Math.max(1, Math.min(sub.cols - 2, cc));
    drop(cc, pathRow[cc], rng.int(s.foodClusterRadiusMin, s.foodClusterRadiusMax));
  }
  for (const rc of sub.rockColumns) {
    const cc = Math.min(sub.cols - 2, rc.hi + 1);    // just past the column, down at the dip
    drop(cc, Math.min(sub.rows - 1, rc.depth + 1), s.foodClusterRadiusMax);
  }
  for (const lk of lakes) {
    const cc = Math.min(sub.cols - 2, lk.c1 + 1);    // just past the lake, beneath the deepest water
    drop(cc, Math.min(sub.rows - 1, lk.maxDepth + 1), s.foodClusterRadiusMax);
  }

  // DUFF pass — down-tier a fraction of the drafting (orange) caches to LOW-VALUE
  // "duff" (brown decayed litter): identical food you colonise + digest, but a SMALLER
  // Energy roll and NO card draft (cards.js checkPileRewards skips kind 'duff'). Applied
  // AFTER every normal drop so the fraction covers the true total (route + column + lake),
  // and spread evenly left→right so low- and high-value piles alternate across the map.
  const duffFrac = s.duffClusterFraction != null ? s.duffClusterFraction : 0.55;
  if (duffFrac > 0) {
    const normals = sub.foodPiles.filter((p) => (p.kind || 'normal') === 'normal');
    normals.sort((a, b) => (a.cells[0] % sub.cols) - (b.cells[0] % sub.cols));
    const total = normals.length;
    const duffN = Math.round(total * duffFrac);
    const dMin = s.duffEnergyMin != null ? s.duffEnergyMin : 1;
    const dMax = s.duffEnergyMax != null ? s.duffEnergyMax : 4;
    for (let i = 0; i < total; i++) {
      // even-distribution: exactly duffN of `total`, spread out (not clumped)
      if (Math.floor((i * duffN) / total) === Math.floor(((i + 1) * duffN) / total)) continue;
      const pile = normals[i];
      pile.kind = 'duff';
      pile.energyValue = rng.int(dMin, dMax);
      const per = pile.energyValue / Math.max(1, pile.cells.length * N);
      for (const idx of pile.cells) { const c = sub.cells[idx]; if (c) { c.foodKind = 'duff'; c.energyPerNutrient = per; } }
    }
  }

  // ENGINE caches — rarer, high-value RED-leaf litter piles that draft an ENGINE card
  // (normal caches draft basic/event). Just like normal caches you colonise and digest
  // them; the render layer draws them as red maple/autumn leaves (foodKind 'cache-engine').
  // Placed mostly right under the SURFACE so the player must climb UP (away from the
  // deeper goal path) to reach these valuable piles; a fraction sit deeper.
  const engCount = rng.int(s.engineClusterMin != null ? s.engineClusterMin : 1, s.engineClusterMax != null ? s.engineClusterMax : 3);
  const engRadius = s.engineClusterRadius != null ? s.engineClusterRadius : 1;
  const band = Math.max(0, s.engineSurfaceRows || 2);
  const engineCount = () => sub.foodPiles.filter((p) => p.kind === 'engine').length;
  // Place `engCount` engine caches. A drop can fail (its spot is all rock/occupied), so RETRY
  // at a fresh RANDOM x each time — and once the near-surface band keeps failing, fall back to
  // deeper ground — until we've actually placed that many. So a map reliably gets its 1–3.
  let placed = 0;
  for (let attempt = 0; placed < engCount && attempt < 40; attempt++) {
    const cc = Math.max(1, Math.min(sub.cols - 2, Math.round(xLo + rng.range(0, 1) * (xHi - xLo))));
    const deep = rng.range(0, 1) < (s.engineDeepChance || 0) || attempt >= engCount * 4;
    const cr = deep ? Math.min(sub.rows - 1, Math.max(band + 2, Math.round((pathRow[cc] || band) * 0.6)))
                    : rng.int(0, band);            // near-surface band by default
    const before = engineCount();
    drop(cc, cr, engRadius, 'engine');
    if (engineCount() > before) placed++;
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
