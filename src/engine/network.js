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
    // Each Grow also branches the mycelium within the substrate it occupies,
    // colonising it denser over successive growth cycles.
    created += this._colonizeStep(substrate, rng);
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
    for (const n of this.nodes) if (!n.infected && n.children.length === 0) t.push(n);
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
    if (startTip && !startTip.infected && startTip.children.length === 0) {
      parent = startTip;
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
    if (created) this.recomputeVitality();
    return created;
  }

  // Grow one segment outward from every tip (radial spread; no attractor needed).
  growRadial(substrate, rng) {
    const g = this.config.growth;
    let created = 0;
    for (const t of this.tips()) {
      if (this.nodes.length >= g.maxNodes) break;
      const par = t.parentId != null ? this.byId.get(t.parentId) : null;
      let hx = par ? t.x - par.x : 0, hy = par ? t.y - par.y : 1;
      const l = Math.hypot(hx, hy) || 1; hx /= l; hy /= l;
      const ang = Math.atan2(hy, hx) + rng.range(-g.branchJitter, g.branchJitter);
      const nx = t.x + Math.cos(ang) * g.segmentLength;
      const ny = t.y + Math.sin(ang) * g.segmentLength;
      if (!this._placeOk(substrate, nx, ny)) continue;
      this.addNode(nx, ny, t);
      created++;
    }
    if (created) this.recomputeVitality();
    return created;
  }

  // Grow `steps` toward the nearest food cell anywhere on the map (even out of range).
  growToNearestFood(substrate, rng, steps) {
    const fp = this.frontierPoint();
    if (!fp) return 0;
    let target = null, best = Infinity;
    substrate.forEachCell((cell, col, row) => {
      if (cell.nutrient > 0 && !cell.rock) {
        const c = substrate.cellCenter(col, row);
        const d = (c.x - fp.x) ** 2 + (c.y - fp.y) ** 2;
        if (d < best) { best = d; target = c; }
      }
    });
    if (!target) return 0;
    return this.growDirected(substrate, rng, target.x - fp.x, target.y - fp.y, steps, false);
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

  // --- Colonisation (per Grow cycle): branch within occupied substrate ------
  // Each Grow, every substrate cell the network sits in (that isn't yet fully
  // colonised) sprouts a fresh branch or two of real hyphae and advances its
  // colonisation. Over several growth cycles the pocket fills with a dense,
  // genuinely branched mycelial network — the look comes from real structure.
  _colonizeStep(substrate, rng) {
    const g = this.config.growth;
    const step = this.config.substrate.colonizeRate;
    if (this.nodes.length >= g.maxNodes) return 0;

    // Group the network's nodes by the (uncolonised) substrate cell they sit in.
    // Any uninfected strand colonises (including cut-loose healthy fragments).
    const byCell = new Map();
    for (const n of this.nodes) {
      if (n.infected) continue;                 // infected strands can't colonise
      const col = substrate.colAtX(n.x), row = substrate.rowAtY(n.y);
      if (!substrate.inBounds(col, row)) continue;
      const idx = substrate.index(col, row);
      const cell = substrate.cells[idx];
      if (cell.maxNutrient <= 0 || cell.rock || cell.hazard || cell.colonized >= 1) continue;
      let e = byCell.get(idx);
      if (!e) byCell.set(idx, (e = { cell, nodes: [] }));
      e.nodes.push(n);
    }

    const cs = substrate.cellSize;
    let created = 0;
    for (const { cell, nodes } of byCell.values()) {
      if (this.nodes.length >= g.maxNodes) break;
      // FIRST entry into a fresh pocket: disperse a full burst that fans out
      // across the cell (and into its food neighbours) so the pocket reads as
      // fully colonised at once, and jump colonisation straight to 1 (so income
      // digests it at full rate — a pile clears in ~2 steps). Later visits just
      // thicken it a little.
      const firstEntry = cell.colonized <= 0;
      const branches = firstEntry ? (this.config.substrate.entryBurst || 9) : (1 + (rng() < 0.6 ? 1 : 0));
      let lastParent = nodes[0];
      for (let b = 0; b < branches; b++) {
        const parent = nodes[Math.floor(rng() * nodes.length)];
        lastParent = parent;
        const dist = firstEntry
          ? cs * (0.25 + rng() * 0.7)                          // fan across the pocket + into neighbours
          : g.segmentLength * (0.85 + cell.colonized * 0.7) * (0.7 + rng() * 0.6);
        const ang = rng() * Math.PI * 2;
        const nx = parent.x + Math.cos(ang) * dist;
        const ny = parent.y + Math.sin(ang) * dist;
        if (ny <= substrate.surfaceY + 2 || ny >= substrate.worldHeight - 2) continue;
        const tc = substrate.cellAtWorld(nx, ny);
        if (tc && (tc.rock || tc.antTrail)) continue;
        this.addNode(nx, ny, parent);
        created++;
      }
      cell.colonized = firstEntry ? 1 : Math.min(1, cell.colonized + step * lastParent.health);
    }
    return created;
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
