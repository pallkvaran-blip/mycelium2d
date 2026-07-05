// =============================================================================
// Network — a single mycelial colony (A5, A8, A9).
//
// This is a STANDALONE, renderer-agnostic object. The game holds a LIST of
// these (state.js); in Phase 1 only one is active, but modelling it as a
// self-contained object now means the generational/decay system (A5) drops in
// later without a rewrite. Nothing in here touches the DOM or a canvas.
//
// Structure: nodes connected parent -> child form the filaments. Growth uses
// 2D space colonization toward substrate nutrient (the "sensing" of food).
// =============================================================================

let NETWORK_SEQ = 0;

export class Network {
  constructor(config) {
    this.id = NETWORK_SEQ++;
    this.config = config;
    this.nodes = [];           // array of node objects
    this.byId = new Map();     // id -> node
    this.nextNodeId = 0;

    this.traits = {};   // (genetic traits removed for now — Melanize is gone)
    this.energy = config.energy.start;
    // Card-layer resources (C1): gate PLAYS. Two resources — Water=growth+substrate,
    // Phosphorus=digest/defense/work (harvested from rocks).
    const cc = config.cards || {};
    this.water = cc.startWater || 0;
    this.phosphorus = cc.startPhosphorus || 0;
    this.spores = 0;           // spores this network has produced (Fruit)

    this.alive = true;         // false once dead (killed) ...
    this.fruited = false;      // ... or once it has fruited (life cycle ended)
    this.active = true;        // is this the player-tended network?

    this.vitality = 1;         // 0..1, cached; drives render brightness
    this._vitalityDip = 0;     // transient hit (Digest), decays each turn

    this.occupiedIdx = new Set(); // substrate cell indices currently occupied
    this.fruitPoints = [];     // last computed fruiting points (for render)
  }

  // --- node helpers --------------------------------------------------------
  addNode(x, y, parent) {
    const node = {
      id: this.nextNodeId++,
      x, y,
      parentId: parent ? parent.id : null,
      children: [],
      health: 1,
      age: 0,
      infected: false,   // overrun by Trichoderma (green/dead)
    };
    this.nodes.push(node);
    this.byId.set(node.id, node);
    if (parent) parent.children.push(node.id);
    return node;
  }

  isTip(node) { return node.children.length === 0; }
  get root() { return this.nodes[0]; }

  // --- seeding (A8): a short vertical filament rooted just under a soil col --
  // startCol (optional) forces the root column (puzzle mode); otherwise a random
  // clear soil column near the centre is chosen.
  seed(substrate, rng, startCol) {
    const g = this.config.growth;
    // Pick a soil column near the centre to root under (so it can fruit later).
    let bestCol = Math.floor(substrate.cols / 2);
    const depthRows = Math.ceil(g.startDepth / substrate.cellSize) + 1;
    const columnClear = (c) => {
      for (let row = 0; row <= depthRows; row++) {
        const cell = substrate.cellAt(c, row);
        if (cell && cell.rock) return false;
      }
      return true;
    };
    if (startCol != null) {
      bestCol = startCol;
    } else for (let tries = 0; tries < 60; tries++) {
      const c = rng.int(Math.floor(substrate.cols * 0.25), Math.floor(substrate.cols * 0.75));
      if (substrate.surface[c] && substrate.surface[c].soil && columnClear(c)) { bestCol = c; break; }
    }
    const x = bestCol * substrate.cellSize + substrate.cellSize / 2;
    const topY = substrate.surfaceY + 6;
    const segs = Math.max(2, Math.round(g.startDepth / g.segmentLength));
    let parent = this.addNode(x, topY, null);
    for (let i = 1; i <= segs; i++) {
      const y = topY + (g.startDepth * i) / segs;
      parent = this.addNode(x + rng.range(-3, 3), y, parent);
    }
    this.recomputeVitality();
    return this;
  }

  // --- growth: one Grow action = stepsPerGrow space-colonization iterations -
  // Returns the number of new nodes created (for feedback / logging).
  grow(substrate, rng) {
    const g = this.config.growth;
    let created = 0;
    for (let step = 0; step < g.stepsPerGrow; step++) {
      created += this._growStep(substrate, rng);
      if (this.nodes.length >= g.maxNodes) break;
    }
    // Growing also fully colonises any substrate pile now within reach.
    created += this.colonizeReachablePiles(substrate, rng);
    if (created > 0) this.recomputeVitality();
    return created;
  }

  _growStep(substrate, rng) {
    const g = this.config.growth;
    if (this.nodes.length >= g.maxNodes) return 0;

    // 1) Collect attractors: food cells above threshold (the colony "senses").
    const attractors = [];
    substrate.forEachCell((cell, col, row) => {
      if (cell.nutrient > g.attractorThreshold && !cell.hazard) {
        const ctr = substrate.cellCenter(col, row);
        attractors.push({ x: ctr.x, y: ctr.y, w: cell.nutrient });
      }
    });
    if (attractors.length === 0) return 0;

    // 2) Spatial hash of nodes (bucketed by substrate cell) for nearest lookup.
    //    Any UNINFECTED strand can grow — including healthy mycelium that's been
    //    cut loose from the root (a severed fragment keeps living and growing).
    const buckets = new Map();
    const key = (col, row) => col + ',' + row;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.infected) continue;                 // infected (dead) strands can't grow
      const col = substrate.colAtX(n.x), row = substrate.rowAtY(n.y);
      const k = key(col, row);
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(n);
    }
    const reach = Math.ceil(g.sensingRadius / substrate.cellSize) + 1;
    const sense2 = g.sensingRadius * g.sensingRadius;
    const kill2 = g.killDistance * g.killDistance;

    // 3) For each attractor, find its nearest node within the sensing radius.
    //    Unsatisfied attractors (no node within killDistance) pull that node.
    const influence = new Map(); // node.id -> {dx, dy, w}
    for (const a of attractors) {
      const col = substrate.colAtX(a.x), row = substrate.rowAtY(a.y);
      let nearest = null, nd2 = sense2;
      for (let r = row - reach; r <= row + reach; r++) {
        for (let c = col - reach; c <= col + reach; c++) {
          const b = buckets.get(key(c, r));
          if (!b) continue;
          for (const n of b) {
            const dx = a.x - n.x, dy = a.y - n.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < nd2) { nd2 = d2; nearest = n; }
          }
        }
      }
      if (!nearest) continue;
      if (nd2 <= kill2) continue; // attractor satisfied — already reached
      const d = Math.sqrt(nd2) || 1;
      let inf = influence.get(nearest.id);
      if (!inf) influence.set(nearest.id, (inf = { dx: 0, dy: 0, w: 0 }));
      const w = a.w;
      inf.dx += ((a.x - nearest.x) / d) * w;
      inf.dy += ((a.y - nearest.y) / d) * w;
      inf.w += w;
    }

    // 4) Grow one new node from each influenced node toward its attractors.
    let created = 0;
    const newNodes = [];
    for (const [nodeId, inf] of influence) {
      const node = this.byId.get(nodeId);
      if (!node) continue;
      const len = Math.hypot(inf.dx, inf.dy);
      if (len < 1e-4) continue;
      let ang = Math.atan2(inf.dy, inf.dx) + rng.range(-g.branchJitter, g.branchJitter);
      let nx = node.x + Math.cos(ang) * g.segmentLength;
      let ny = node.y + Math.sin(ang) * g.segmentLength;
      // Keep growth underground and inside the world.
      ny = Math.max(substrate.surfaceY + 2, Math.min(substrate.worldHeight - 2, ny));
      nx = Math.max(2, Math.min(substrate.worldWidth - 2, nx));
      // Can't grow through rock or across an active ant trail.
      const tcell = substrate.cellAtWorld(nx, ny);
      if (tcell && (tcell.rock || tcell.antTrail)) continue;
      // Don't pile nodes on top of each other.
      if (this._tooClose(nx, ny, g.minTipSpacing, substrate, buckets, key, reach)) continue;
      const child = this.addNode(nx, ny, node);
      newNodes.push(child);
      created++;
      if (this.nodes.length >= g.maxNodes) break;
    }
    return created;
  }

  // === Card-layer growth primitives (C1) ==================================
  // Uninfected tip nodes (the advancing frontier).
  tips() {
    const t = [];
    // Exclude `colon` mat hyphae (dense fill sprayed into claimed food piles):
    // they aren't the advancing frontier and would skew aim / growth direction /
    // the frontier centroid.
    for (const n of this.nodes) if (!n.infected && !n.colon && n.children.length === 0) t.push(n);
    return t.length ? t : this.nodes.filter((n) => !n.infected);
  }
  // Nearest uninfected node to a world point.
  nearestNode(x, y) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) {
      if (n.infected) continue;
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  // Nearest frontier TIP (childless strand end) to a world point — the source for
  // aimed plays, so growth/placement always originates from the strand closest to
  // where you're aiming. Returns a node, or null if the network has no tips.
  nearestTip(x, y) {
    let best = null, bd = Infinity;
    for (const n of this.tips()) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  // Centroid of the frontier (origin for directional plays / substrate placement).
  frontierPoint() {
    const src = this.tips();
    if (!src.length) return null;
    let sx = 0, sy = 0;
    for (const n of src) { sx += n.x; sy += n.y; }
    return { x: sx / src.length, y: sy / src.length };
  }

  _placeOk(substrate, nx, ny) {
    if (ny <= substrate.surfaceY + 2 || ny >= substrate.worldHeight - 2) return false;
    if (nx <= 2 || nx >= substrate.worldWidth - 2) return false;
    const cell = substrate.cellAtWorld(nx, ny);
    return !(cell && (cell.rock || cell.antTrail));
  }

  // Grow a chain of `steps` segments in direction (dx,dy). The chain starts from
  // `startTip` when given (aimed plays pass the tip nearest the aim point, so growth
  // originates from the strand you aimed from); otherwise it starts from the frontier
  // tip furthest along (dx,dy). straight=true ignores jitter; returns nodes created.
  growDirected(substrate, rng, dx, dy, steps, straight = false, startTip = null) {
    const g = this.config.growth;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const tips = this.tips();
    if (!tips.length) return 0;
    let parent;
    if (startTip && !startTip.infected) {
      parent = startTip;   // grow from the given node (a branch, even if it isn't a tip)
    } else {
      parent = tips[0]; let bestProj = -Infinity;
      for (const n of tips) { const p = n.x * dx + n.y * dy; if (p > bestProj) { bestProj = p; parent = n; } }
    }
    const baseAng = Math.atan2(dy, dx);
    let created = 0;
    for (let i = 0; i < steps; i++) {
      if (this.nodes.length >= g.maxNodes) break;
      const ang = straight ? baseAng : baseAng + rng.range(-g.branchJitter, g.branchJitter);
      const nx = parent.x + Math.cos(ang) * g.segmentLength;
      const ny = parent.y + Math.sin(ang) * g.segmentLength;
      if (!this._placeOk(substrate, nx, ny)) break;   // blocked (rock/edge)
      parent = this.addNode(nx, ny, parent);
      created++;
    }
    // Directed growth also colonises any substrate pile it brought within reach.
    created += this.colonizeReachablePiles(substrate, rng);
    if (created) this.recomputeVitality();
    return created;
  }

  // Foraging Fan: the colony spreads outward everywhere at once (a radial burst,
  // no food needed). One play = "1 step" = `foragingFanCells` (~3) cells outward in
  // every direction, grown as that many successive frontier rings so the fan reads
  // as a filled 3-cell expansion, not a single-cell nudge.
  growRadial(substrate, rng) {
    const g = this.config.growth;
    const cells = Math.max(1, g.foragingFanCells || 3);
    let created = 0;
    for (let ring = 0; ring < cells; ring++) created += this._fanRing(substrate, rng);
    // Fanning out also fully colonises any substrate pile within reach, in one step.
    created += this.colonizeReachablePiles(substrate, rng);
    if (created) this.recomputeVitality();
    return created;
  }

  // One ring of the fan: every current tip sprouts new hyphae around the circle;
  // a min-spacing check drops candidates that fall back over the colony (and rock /
  // edge / above-surface ones), so the frontier expands OUTWARD into open ground.
  _fanRing(substrate, rng) {
    const g = this.config.growth;
    const rays = Math.max(3, g.foragingFanRays || 8);
    const key = (c, r) => c + ',' + r;
    const buckets = new Map();
    const bucket = (n) => { const k = key(substrate.colAtX(n.x), substrate.rowAtY(n.y)); let b = buckets.get(k); if (!b) buckets.set(k, (b = [])); b.push(n); };
    for (const n of this.nodes) if (!n.infected) bucket(n);
    let created = 0;
    for (const t of this.tips()) {
      if (this.nodes.length >= g.maxNodes) break;
      for (let k = 0; k < rays; k++) {
        if (this.nodes.length >= g.maxNodes) break;
        const ang = (k / rays) * Math.PI * 2 + rng.range(-g.branchJitter, g.branchJitter) * 0.5;
        const nx = t.x + Math.cos(ang) * g.segmentLength;
        const ny = t.y + Math.sin(ang) * g.segmentLength;
        if (!this._placeOk(substrate, nx, ny)) continue;                         // rock / edge / above surface
        if (this._tooClose(nx, ny, g.minTipSpacing, substrate, buckets, key, 1)) continue;  // already occupied
        const child = this.addNode(nx, ny, t);
        bucket(child);
        created++;
      }
    }
    return created;
  }

  // Any food left on the map? (For distinguishing "no food" from "blocked".)
  hasFood(substrate) {
    for (const cell of substrate.cells) if (cell.nutrient > 0 && !cell.rock && !cell.hazard) return true;
    return false;
  }

  // How many `steps` a straight runner from `node` toward (dx,dy) could place
  // before rock/edge/surface stops it (a dry run — adds no nodes).
  _reachableSteps(substrate, node, dx, dy, steps) {
    const g = this.config.growth;
    const len = Math.hypot(dx, dy) || 1; const ux = dx / len, uy = dy / len;
    let px = node.x, py = node.y, n = 0;
    for (let i = 0; i < steps; i++) {
      const nx = px + ux * g.segmentLength, ny = py + uy * g.segmentLength;
      if (!this._placeOk(substrate, nx, ny)) break;
      px = nx; py = ny; n++;
    }
    return n;
  }

  // Grow `steps` from the strand CLOSEST to any food cell, toward that food (works
  // anywhere on the map, even out of sensing range). Ties — strands equally near
  // food — go to the one closer to the goal (goal band is on the far right → larger
  // x). If the closest strand's path is walled by rock, we pick the closest strand
  // that can lunge the FURTHEST (a full lunge from a strand with a clear path beats
  // a 1-step stub from a strand jammed against rock). Returns nodes grown; 0 means
  // either no food exists or every path is walled off (caller checks hasFood()).
  growToNearestFood(substrate, rng, steps) {
    const food = [];
    substrate.forEachCell((cell, col, row) => {
      if (cell.nutrient > 0 && !cell.rock && !cell.hazard) food.push(substrate.cellCenter(col, row));
    });
    if (!food.length) return 0;
    // For every living strand, its nearest food + distance.
    const cand = [];
    for (const n of this.nodes) {
      if (n.infected) continue;
      let nd = Infinity, nt = null;
      for (const f of food) { const d = (f.x - n.x) ** 2 + (f.y - n.y) ** 2; if (d < nd) { nd = d; nt = f; } }
      if (nt) cand.push({ n, nt, nd });
    }
    if (!cand.length) return 0;
    // Order by nearest-food distance; ties (within ~2px) go to the strand closer to
    // the goal (larger x). Quantised distance keeps the comparator transitive.
    const EPS2 = 4;
    cand.sort((a, b) => { const qa = Math.round(a.nd / EPS2), qb = Math.round(b.nd / EPS2); return qa !== qb ? qa - qb : b.n.x - a.n.x; });
    // Pick the closest strand that can lunge the furthest: iterate nearest-first,
    // keep the one with the longest clear path, and stop at the first that can go
    // the full distance (so a rock jamming the closest strand doesn't cap the lunge
    // at 1 — a farther strand with a clear run does the full lunge instead).
    let best = null, bestReach = 0;
    for (const c of cand) {
      const reach = this._reachableSteps(substrate, c.n, c.nt.x - c.n.x, c.nt.y - c.n.y, steps);
      if (reach > bestReach) { best = c; bestReach = reach; if (reach >= steps) break; }
    }
    if (!best) return 0;   // food exists but every path toward it is walled off
    return this.growDirected(substrate, rng, best.nt.x - best.n.x, best.nt.y - best.n.y, steps, false, best.n);
  }

  // Clear the contiguous rock feature (of an allowed class) nearest a tapped point
  // and bridge a node into it so growth can pass. classes ⊆ {boulder,formation,column,lakeBasin}.
  digThrough(substrate, x, y, classes, cap = 90) {
    const isClass = (cell) => cell && cell.rock && (
      (classes.includes('boulder') && !cell.formation && !cell.column && !cell.water) ||
      (classes.includes('formation') && cell.formation) ||
      (classes.includes('column') && cell.column) ||
      (classes.includes('lakeBasin') && cell.water));
    const c0 = substrate.colAtX(x), r0 = substrate.rowAtY(y);
    let start = null;
    outer:
    for (let rad = 0; rad <= 8 && !start; rad++) {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (rad > 0 && Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        if (isClass(substrate.cellAt(c0 + dc, r0 + dr))) { start = { col: c0 + dc, row: r0 + dr }; break outer; }
      }
    }
    if (!start) return 0;
    const seen = new Set(), stack = [start], cleared = [];
    while (stack.length && cleared.length < cap) {
      const { col, row } = stack.pop();
      if (!substrate.inBounds(col, row)) continue;
      const idx = substrate.index(col, row);
      if (seen.has(idx)) continue; seen.add(idx);
      const cell = substrate.cells[idx];
      if (!isClass(cell)) continue;
      cell.rock = false; cell.formation = false; cell.column = false;
      if (cell.water && classes.includes('lakeBasin')) cell.water = false;
      cleared.push(substrate.cellCenter(col, row));
      stack.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
    }
    if (cleared.length) {
      const entry = cleared[0];
      const near = this.nearestNode(entry.x, entry.y);
      if (near) this.addNode(entry.x, entry.y, near);
      this.recomputeVitality();
    }
    return cleared.length;
  }

  _tooClose(x, y, minDist, substrate, buckets, key, reach) {
    const col = substrate.colAtX(x), row = substrate.rowAtY(y);
    const min2 = minDist * minDist;
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        const b = buckets.get(key(c, r));
        if (!b) continue;
        for (const n of b) {
          const dx = n.x - x, dy = n.y - y;
          if (dx * dx + dy * dy < min2) return true;
        }
      }
    }
    return false;
  }

  // --- Amputate (A2): cut out every strand within a radius of the click -----
  // Removes all nodes inside the circle (a clean excision of the infected blob).
  // Surviving strands that lose their parent to the cut become free fragments —
  // they keep living and can still grow. Returns the number of strands removed.
  amputateAt(x, y, radius) {
    const r2 = radius * radius;
    const removed = new Set();
    for (const n of this.nodes) {
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy <= r2) removed.add(n.id);
    }
    return this._removeNodes(removed);
  }

  // Remove a set of node ids, orphaning any surviving children (they become
  // free fragments that keep living/growing — we never cascade-delete).
  _removeNodes(removed) {
    if (removed.size === 0) return 0;
    for (const n of this.nodes) {
      if (removed.has(n.id)) continue;
      if (n.parentId != null && removed.has(n.parentId)) n.parentId = null;
      if (n.children.length) n.children = n.children.filter((id) => !removed.has(id));
    }
    for (const id of removed) this.byId.delete(id);
    this.nodes = this.nodes.filter((n) => !removed.has(n.id));
    if (this.nodes.length === 0) this.alive = false;
    this.recomputeVitality();
    return removed.size;
  }

  // --- Occupancy: which cells the network sits in (income + held ground) ---
  // Updates cell.held (firmly-held ground resists Trichoderma) and returns the
  // list of occupied cells that still carry nutrient (income sources).
  collectOccupiedCells(substrate) {
    // Clear previously-held cells.
    for (const idx of this.occupiedIdx) {
      if (substrate.cells[idx]) substrate.cells[idx].held = 0;
    }
    this.occupiedIdx.clear();
    const income = [];
    for (const n of this.nodes) {
      if (n.infected) continue;                 // dead strands don't feed or hold ground
      const col = substrate.colAtX(n.x), row = substrate.rowAtY(n.y);
      if (!substrate.inBounds(col, row)) continue;
      const idx = substrate.index(col, row);
      const cell = substrate.cells[idx];
      cell.held = Math.max(cell.held, n.health);
      if (!this.occupiedIdx.has(idx)) {
        this.occupiedIdx.add(idx);
        if (cell.nutrient > 0 && !cell.hazard) income.push(cell);
      }
    }
    return income;
  }

  // --- Colonisation: fully claim every substrate pile within reach ------------
  // Called after every grow. For each CONNECTED substrate pile (a blob of food
  // cells) with any cell within sensing/reach range of a living strand — you grew
  // into its edge, or it simply sits inside your lit reach — the WHOLE pile is
  // claimed in one step, even the cells that were out of range on the far side:
  // a thin runner is grown from the nearest strand into the pile (so the mat stays
  // attached), colonised=1 is set on every cell (income then digests the whole
  // pile), and a dense burst of hyphae is sprayed through each cell so the pocket
  // reads as fully, densely colonised. Piles walled off by rock (no runner can
  // reach them) are left alone. Every node this spawns is flagged `colon` so it
  // never counts as the growth frontier (aim / direction / centroid stay clean),
  // and the node cost stays bounded by the map's small food footprint.
  // Returns the number of hyphae created.
  colonizeReachablePiles(substrate, rng) {
    const g = this.config.growth;
    if (this.nodes.length >= g.maxNodes) return 0;
    const cs = substrate.cellSize;
    const cols = substrate.cols;
    const burst = this.config.substrate.entryBurst || 9;
    const reach2 = g.sensingRadius * g.sensingRadius;
    const reachCells = Math.ceil(g.sensingRadius / cs) + 1;
    const key = (c, r) => c + ',' + r;

    // Bucket living strands by cell for a bounded nearest-node search.
    const buckets = new Map();
    let liveCount = 0;
    for (const n of this.nodes) {
      if (n.infected) continue;
      liveCount++;
      const b = key(substrate.colAtX(n.x), substrate.rowAtY(n.y));
      let arr = buckets.get(b); if (!arr) buckets.set(b, (arr = [])); arr.push(n);
    }
    if (!liveCount) return 0;

    const isFood = (cell) => cell && cell.maxNutrient > 0 && !cell.rock && !cell.hazard;
    const seen = new Set();
    let created = 0;
    for (let idx = 0; idx < substrate.cells.length; idx++) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      if (!isFood(substrate.cells[idx])) continue;
      // Flood-fill the whole connected pile (8-connectivity).
      const pile = [idx];
      const stack = [idx];
      while (stack.length) {
        const i = stack.pop();
        const c = i % cols, r = (i - c) / cols;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc, nr = r + dr;
          if (!substrate.inBounds(nc, nr)) continue;
          const ni = substrate.index(nc, nr);
          if (seen.has(ni)) continue;
          seen.add(ni);
          if (isFood(substrate.cells[ni])) { pile.push(ni); stack.push(ni); }
        }
      }
      if (pile.every((i) => substrate.cells[i].colonized >= 1)) continue;   // already dense
      // Nearest living strand to the pile (and the cell it should enter at).
      let best = null, bd = reach2, entry = null;
      for (const i of pile) {
        const c = i % cols, r = (i - c) / cols;
        const ctr = substrate.cellCenter(c, r);
        for (let rr = r - reachCells; rr <= r + reachCells; rr++)
          for (let cc = c - reachCells; cc <= c + reachCells; cc++) {
            const arr = buckets.get(key(cc, rr)); if (!arr) continue;
            for (const n of arr) {
              const d = (n.x - ctr.x) ** 2 + (n.y - ctr.y) ** 2;
              if (d < bd) { bd = d; best = n; entry = ctr; }
            }
          }
      }
      if (!best) continue;                                    // pile out of reach — leave it
      const bridge = this._bridgeInto(substrate, best, entry);
      if (!bridge.reached) continue;                          // walled off by rock — can't claim it
      created += bridge.created;
      // Fill nearest-to-the-entry-cell first so runners stay short/connected.
      const order = pile
        .filter((i) => substrate.cells[i].colonized < 1)
        .map((i) => { const c = i % cols, r = (i - c) / cols; return { i, ctr: substrate.cellCenter(c, r) }; })
        .sort((a, b) => ((a.ctr.x - entry.x) ** 2 + (a.ctr.y - entry.y) ** 2) - ((b.ctr.x - entry.x) ** 2 + (b.ctr.y - entry.y) ** 2));
      for (const o of order) {
        if (this.nodes.length >= g.maxNodes) break;
        const parent = this.nearestNode(o.ctr.x, o.ctr.y);
        if (!parent) continue;
        for (let b = 0; b < burst; b++) {
          if (this.nodes.length >= g.maxNodes) break;
          const ang = rng() * Math.PI * 2;
          const rad = cs * (0.15 + rng() * 0.55);
          const nx = o.ctr.x + Math.cos(ang) * rad;
          const ny = o.ctr.y + Math.sin(ang) * rad;
          if (ny <= substrate.surfaceY + 2 || ny >= substrate.worldHeight - 2) continue;
          if (nx <= 2 || nx >= substrate.worldWidth - 2) continue;
          const tc = substrate.cellAtWorld(nx, ny);
          if (tc && (tc.rock || tc.antTrail)) continue;
          this.addNode(nx, ny, parent).colon = true;   // mat hyphae: not a growth frontier
          created++;
        }
        substrate.cells[o.i].colonized = 1;
      }
    }
    return created;
  }

  // Plan a straight runner from `node` toward `target` (a pile cell centre) and
  // commit it ONLY if it actually reaches the pile edge (rock in the way → it
  // reaches nothing and adds no nodes, so a walled-off pile is never claimed and
  // never leaks half-runners on repeat grows). Runner nodes are flagged `colon`
  // so they don't count as the growth frontier. Returns {created, reached}.
  _bridgeInto(substrate, node, target) {
    const g = this.config.growth;
    const pts = [];
    let px = node.x, py = node.y, reached = false;
    for (let guard = 0; guard < 24; guard++) {
      const dx = target.x - px, dy = target.y - py, dist = Math.hypot(dx, dy);
      if (dist <= substrate.cellSize) { reached = true; break; }   // at the pile edge
      const ux = dx / dist, uy = dy / dist;
      px += ux * g.segmentLength; py += uy * g.segmentLength;
      if (!this._placeOk(substrate, px, py)) break;                 // rock / edge blocks it
      pts.push({ x: px, y: py });
    }
    if (!reached) return { created: 0, reached: false };
    let parent = node, created = 0;
    for (const pt of pts) {
      if (this.nodes.length >= g.maxNodes) break;
      parent = this.addNode(pt.x, pt.y, parent);
      parent.colon = true;
      created++;
    }
    return { created, reached: true };
  }

  // Age every strand a step each turn — older mycelium fills in denser (used by
  // the renderer to thicken the colony progressively, petri-dish style).
  agePass() {
    for (const n of this.nodes) n.age++;
  }

  applyStarvation() {
    const v = this.config.vitality;
    for (const n of this.nodes) n.health -= v.starvationDamage;
  }

  // Remove starved-out nodes; their healthy children survive as free fragments.
  pruneDead() {
    const dead = this.config.vitality.deadNodeHealth;
    const removed = new Set();
    for (const n of this.nodes) if (n.health <= dead) removed.add(n.id);
    return this._removeNodes(removed);
  }

  // Healthy (uninfected) strand count.
  healthyCount() {
    let c = 0;
    for (const n of this.nodes) if (!n.infected) c++;
    return c;
  }

  // --- Vitality = fraction of the colony still healthy (uninfected) --------
  // (Appearance no longer depends on this; it drives the HUD "% healthy" bar.)
  recomputeVitality() {
    if (this.nodes.length === 0) { this.vitality = 0; return; }
    this.vitality = this.healthyCount() / this.nodes.length;
  }
  decayVitalityDip() {
    this._vitalityDip = Math.max(0, this._vitalityDip - this.config.vitality.dipDecayPerTurn);
  }
  addVitalityDip(amount) {
    this._vitalityDip = Math.min(this.config.vitality.maxVitalityDip, this._vitalityDip + amount);
    this.recomputeVitality();
  }

  // --- Fruiting (A4, B5): find reachable fruitable soil points -------------
  // A soil column is fruitable if a node sits within reachDepth of the surface
  // and within reachSpread horizontally. Adjacent fruitable columns group into
  // one fruiting body (clusterWidth). Shaded bodies yield more.
  computeFruitPoints(substrate) {
    const f = this.config.actions.fruit;
    const colFruitable = new Array(substrate.cols).fill(false);
    const colShade = new Array(substrate.cols).fill(false);
    for (let c = 0; c < substrate.cols; c++) {
      const surf = substrate.surface[c];
      if (!surf.soil) continue;
      const cx = c * substrate.cellSize + substrate.cellSize / 2;
      // Is there a node near the surface beneath this column?
      let reachable = false;
      for (const n of this.nodes) {
        if (n.infected) continue;               // dead strands can't fruit
        const depth = n.y - substrate.surfaceY;
        if (depth >= 0 && depth <= f.reachDepth && Math.abs(n.x - cx) <= f.reachSpread + substrate.cellSize / 2) {
          reachable = true; break;
        }
      }
      colFruitable[c] = reachable;
      colShade[c] = surf.shade;
    }
    // Group consecutive fruitable columns into bodies of clusterWidth.
    const points = [];
    let c = 0;
    while (c < substrate.cols) {
      if (!colFruitable[c]) { c++; continue; }
      let end = c;
      while (end < substrate.cols && colFruitable[end]) end++;
      // [c, end) is a fruitable run.
      for (let start = c; start < end; start += f.clusterWidth) {
        const mid = Math.min(end - 1, start + Math.floor(f.clusterWidth / 2));
        const x = mid * substrate.cellSize + substrate.cellSize / 2;
        points.push({ x, y: substrate.surfaceY, shade: colShade[mid] });
      }
      c = end;
    }
    this.fruitPoints = points;
    return points;
  }

  // --- bounding box (camera framing) ---------------------------------------
  bounds() {
    if (this.nodes.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }
    return { minX, minY, maxX, maxY };
  }
}
