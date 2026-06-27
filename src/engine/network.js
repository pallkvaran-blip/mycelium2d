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

    this.traits = { melanize: 0, antifungal: 0, antipredator: 0 };
    this.energy = config.energy.start;
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
    };
    this.nodes.push(node);
    this.byId.set(node.id, node);
    if (parent) parent.children.push(node.id);
    return node;
  }

  isTip(node) { return node.children.length === 0; }
  get root() { return this.nodes[0]; }

  // --- seeding (A8): a short vertical filament rooted just under a soil col --
  seed(substrate, rng) {
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
    for (let tries = 0; tries < 60; tries++) {
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
    const buckets = new Map();
    const key = (col, row) => col + ',' + row;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
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
      // Can't grow through rock.
      const tcell = substrate.cellAtWorld(nx, ny);
      if (tcell && tcell.rock) continue;
      // Don't pile nodes on top of each other.
      if (this._tooClose(nx, ny, g.minTipSpacing, substrate, buckets, key, reach)) continue;
      const child = this.addNode(nx, ny, node);
      newNodes.push(child);
      created++;
      if (this.nodes.length >= g.maxNodes) break;
    }
    return created;
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

  // --- Amputate (A2): remove the node nearest a click + its whole subtree ---
  nodeNear(x, y, maxDist) {
    let best = null, bd2 = maxDist * maxDist;
    for (const n of this.nodes) {
      const dx = n.x - x, dy = n.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd2) { bd2 = d2; best = n; }
    }
    return best;
  }

  amputateAt(x, y, maxDist) {
    const target = this.nodeNear(x, y, maxDist);
    if (!target) return 0;
    return this.amputateNode(target.id);
  }

  amputateNode(nodeId) {
    const start = this.byId.get(nodeId);
    if (!start) return 0;
    // Collect the subtree (the node and everything downstream of it).
    const toRemove = new Set();
    const stack = [start];
    while (stack.length) {
      const n = stack.pop();
      if (toRemove.has(n.id)) continue;
      toRemove.add(n.id);
      for (const cid of n.children) {
        const c = this.byId.get(cid);
        if (c) stack.push(c);
      }
    }
    // Detach from parent.
    if (start.parentId != null) {
      const parent = this.byId.get(start.parentId);
      if (parent) parent.children = parent.children.filter((id) => id !== start.id);
    }
    for (const id of toRemove) this.byId.delete(id);
    this.nodes = this.nodes.filter((n) => !toRemove.has(n.id));
    if (this.nodes.length === 0) this.alive = false;
    this.recomputeVitality();
    return toRemove.size;
  }

  // --- Express (A2): raise a defence trait one level, organism-wide --------
  expressTrait(name) {
    if (!(name in this.traits)) return false;
    const max = this.config.actions.express.maxLevel;
    if (this.traits[name] >= max) return false;
    this.traits[name]++;
    return true;
  }
  expressCost(name) {
    const e = this.config.actions.express;
    return e.energyCostBase + e.energyCostPerLevel * this.traits[name];
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

    // Group the network's nodes by the (uncolonised) substrate cell they're in.
    const byCell = new Map();
    for (const n of this.nodes) {
      const col = substrate.colAtX(n.x), row = substrate.rowAtY(n.y);
      if (!substrate.inBounds(col, row)) continue;
      const idx = substrate.index(col, row);
      const cell = substrate.cells[idx];
      if (cell.maxNutrient <= 0 || cell.rock || cell.hazard || cell.colonized >= 1) continue;
      let e = byCell.get(idx);
      if (!e) byCell.set(idx, (e = { cell, nodes: [] }));
      e.nodes.push(n);
    }

    let created = 0;
    const len = g.segmentLength * 0.5;
    for (const { cell, nodes } of byCell.values()) {
      if (this.nodes.length >= g.maxNodes) break;
      const parent = nodes[Math.floor(rng() * nodes.length)];
      const branches = 1 + (rng() < 0.5 ? 1 : 0);
      for (let b = 0; b < branches; b++) {
        const ang = rng() * Math.PI * 2;
        const dist = len * (0.6 + rng() * 0.8);
        const nx = parent.x + Math.cos(ang) * dist;
        const ny = parent.y + Math.sin(ang) * dist;
        if (ny <= substrate.surfaceY + 2 || ny >= substrate.worldHeight - 2) continue;
        const tc = substrate.cellAtWorld(nx, ny);
        if (tc && tc.rock) continue;
        this.addNode(nx, ny, parent);
        created++;
      }
      cell.colonized = Math.min(1, cell.colonized + step * parent.health);
    }
    return created;
  }

  // Age every strand a step each turn — older mycelium fills in denser (used by
  // the renderer to thicken the colony progressively, petri-dish style).
  agePass() {
    for (const n of this.nodes) n.age++;
  }

  // --- Per-turn hazard damage (Trichoderma handled in threats.js) ----------
  // Strands recover only when genuinely safe AND fed: not in a hazard cell,
  // not in a Trichoderma-infected cell, and with Energy to spare. Otherwise
  // recovery would silently cancel the mold's contact damage applied just
  // before this step, and would heal even while starving.
  applyHazardDamage(substrate) {
    const v = this.config.vitality;
    const melaninRed = this.traits.melanize * this.config.traits.melanize.damageReductionPerLevel;
    const dmgMul = Math.max(0, 1 - melaninRed);
    const fed = this.energy > 0;
    for (const n of this.nodes) {
      const cell = substrate.cellAtWorld(n.x, n.y);
      if (cell && cell.hazard) {
        n.health -= v.hazardDamagePerTurn * dmgMul;
      } else if (n.health < 1 && fed && (!cell || cell.trich <= 0)) {
        n.health = Math.min(1, n.health + v.recoveryPerTurn);
      }
    }
  }

  applyStarvation() {
    const v = this.config.vitality;
    for (const n of this.nodes) n.health -= v.starvationDamage;
  }

  // Remove dead nodes (and the now-disconnected subtree beneath them).
  pruneDead() {
    const dead = this.config.vitality.deadNodeHealth;
    let removed = 0;
    let again = true;
    while (again) {
      again = false;
      for (const n of this.nodes) {
        if (n.health <= dead) {
          removed += this.amputateNode(n.id);
          again = true;
          break;
        }
      }
    }
    if (this.nodes.length === 0) this.alive = false;
    return removed;
  }

  // --- Vitality (drives render brightness) ---------------------------------
  recomputeVitality() {
    if (this.nodes.length === 0) { this.vitality = 0; return; }
    let sum = 0;
    for (const n of this.nodes) sum += n.health;
    const avg = sum / this.nodes.length;
    this.vitality = Math.max(0, Math.min(1, avg - this._vitalityDip));
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
