// =============================================================================
// Network — a single mycelial colony, now living in a 3D volume.
//
// 3D port of the 2D game's Network. A STANDALONE, renderer-agnostic object.
// Structure: nodes connected parent -> child form the filaments. Growth uses
// 3D space colonization toward substrate nutrient (the "sensing" of food).
// Nothing in here touches the DOM or WebGL.
// =============================================================================

let NETWORK_SEQ = 0;

export class Network {
  constructor(config) {
    this.id = NETWORK_SEQ++;
    this.config = config;
    this.nodes = [];           // array of node objects
    this.byId = new Map();     // id -> node
    this.nextNodeId = 0;

    this.energy = config.energy.start;
    this.spores = 0;           // spores this network has produced (Fruit)

    this.alive = true;         // false once dead (killed) ...
    this.fruited = false;      // ... or once it has fruited (life cycle ended)
    this.active = true;        // is this the player-tended network?

    this.vitality = 1;         // 0..1 fraction healthy; drives the HUD bar
    this._vitalityDip = 0;

    this.occupiedIdx = new Set(); // substrate voxel indices currently occupied
    this.fruitPoints = [];     // last computed fruiting points (for render)
  }

  // --- node helpers ----------------------------------------------------------
  addNode(x, y, z, parent) {
    const node = {
      id: this.nextNodeId++,
      x, y, z,
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

  // --- seeding: a short vertical filament rooted just under the entry zone ---
  // startCol/startRow (optional) force the root column; otherwise a clear
  // column near the given defaults is chosen.
  seed(substrate, rng, startCol, startRow) {
    const g = this.config.growth;
    const depthLays = Math.ceil(g.startDepth / substrate.cellSize) + 1;
    const columnClear = (cx, cz) => {
      for (let cy = 0; cy <= depthLays; cy++) {
        const cell = substrate.cellAt(cx, cy, cz);
        if (cell && cell.rock) return false;
      }
      return true;
    };
    let bestCol = startCol != null ? startCol : Math.max(1, Math.floor((this.config.substrate.startCols || 2) / 2));
    let bestRow = startRow != null ? startRow : (substrate.pathZ ? substrate.pathZ[bestCol] : Math.floor(substrate.rows / 2));
    if (!columnClear(bestCol, bestRow)) {
      outer: for (let tries = 0; tries < 80; tries++) {
        const cz = rng.int(1, substrate.rows - 2);
        if (columnClear(bestCol, cz)) { bestRow = cz; break outer; }
      }
    }
    const x = bestCol * substrate.cellSize + substrate.cellSize / 2;
    const z = bestRow * substrate.cellSize + substrate.cellSize / 2;
    const topY = -6;
    const segs = Math.max(2, Math.round(g.startDepth / g.segmentLength));
    let parent = this.addNode(x, topY, z, null);
    for (let i = 1; i <= segs; i++) {
      const y = topY - (g.startDepth * i) / segs;
      parent = this.addNode(x + rng.range(-3, 3), y, z + rng.range(-3, 3), parent);
    }
    this.recomputeVitality();
    return this;
  }

  // --- growth: one Grow action = stepsPerGrow space-colonization iterations --
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

    // 1) Collect attractors: food voxels above threshold (the colony "senses").
    const attractors = [];
    substrate.forEachCell((cell, cx, cy, cz) => {
      if (cell.nutrient > g.attractorThreshold) {
        const c = substrate.cellCenter(cx, cy, cz);
        attractors.push({ x: c.x, y: c.y, z: c.z, w: cell.nutrient });
      }
    });
    if (attractors.length === 0) return 0;

    // 2) Spatial hash of nodes (bucketed by voxel) for nearest lookup. Any
    //    UNINFECTED strand can grow — including healthy severed fragments.
    const buckets = new Map();
    const key = (cx, cy, cz) => ((cy * 4096 + cz) * 4096 + cx);
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      if (n.infected) continue;                 // infected (dead) strands can't grow
      const k = key(substrate.colAtX(n.x), substrate.layAtY(n.y), substrate.rowAtZ(n.z));
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(n);
    }
    const reach = Math.ceil(g.sensingRadius / substrate.cellSize) + 1;
    const sense2 = g.sensingRadius * g.sensingRadius;
    const kill2 = g.killDistance * g.killDistance;

    // 3) For each attractor, find its nearest node within the sensing radius.
    //    Unsatisfied attractors (no node within killDistance) pull that node.
    const influence = new Map(); // node.id -> {dx, dy, dz, w}
    for (const a of attractors) {
      const acx = substrate.colAtX(a.x), acy = substrate.layAtY(a.y), acz = substrate.rowAtZ(a.z);
      let nearest = null, nd2 = sense2;
      for (let cy = acy - reach; cy <= acy + reach; cy++) {
        for (let cz = acz - reach; cz <= acz + reach; cz++) {
          for (let cx = acx - reach; cx <= acx + reach; cx++) {
            const b = buckets.get(key(cx, cy, cz));
            if (!b) continue;
            for (const n of b) {
              const dx = a.x - n.x, dy = a.y - n.y, dz = a.z - n.z;
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 < nd2) { nd2 = d2; nearest = n; }
            }
          }
        }
      }
      if (!nearest) continue;
      if (nd2 <= kill2) continue; // attractor satisfied — already reached
      const d = Math.sqrt(nd2) || 1;
      let inf = influence.get(nearest.id);
      if (!inf) influence.set(nearest.id, (inf = { dx: 0, dy: 0, dz: 0, w: 0 }));
      const w = a.w;
      inf.dx += ((a.x - nearest.x) / d) * w;
      inf.dy += ((a.y - nearest.y) / d) * w;
      inf.dz += ((a.z - nearest.z) / d) * w;
      inf.w += w;
    }

    // 4) Grow one new node from each influenced node toward its attractors.
    let created = 0;
    for (const [nodeId, inf] of influence) {
      const node = this.byId.get(nodeId);
      if (!node) continue;
      const len = Math.hypot(inf.dx, inf.dy, inf.dz);
      if (len < 1e-4) continue;
      // Unit direction + a small random wobble for organic growth.
      let ux = inf.dx / len, uy = inf.dy / len, uz = inf.dz / len;
      const j = Math.tan(g.branchJitter);
      const jx = rng.range(-j, j), jy = rng.range(-j, j), jz = rng.range(-j, j);
      let vx = ux + jx, vy = uy + jy, vz = uz + jz;
      const vlen = Math.hypot(vx, vy, vz) || 1;
      let nx = node.x + (vx / vlen) * g.segmentLength;
      let ny = node.y + (vy / vlen) * g.segmentLength;
      let nz = node.z + (vz / vlen) * g.segmentLength;
      // Keep growth underground and inside the world.
      ny = Math.min(-2, Math.max(-(substrate.worldDepth - 2), ny));
      nx = Math.max(2, Math.min(substrate.worldWidth - 2, nx));
      nz = Math.max(2, Math.min(substrate.worldBreadth - 2, nz));
      // Can't grow through rock or across an active ant trail.
      const tcell = substrate.cellAtWorld(nx, ny, nz);
      if (tcell && (tcell.rock || tcell.antTrail)) continue;
      // Don't pile nodes on top of each other.
      if (this._tooClose(nx, ny, nz, g.minTipSpacing, substrate, buckets, key)) continue;
      this.addNode(nx, ny, nz, node);
      created++;
      if (this.nodes.length >= g.maxNodes) break;
    }
    return created;
  }

  _tooClose(x, y, z, minDist, substrate, buckets, key) {
    const cx0 = substrate.colAtX(x), cy0 = substrate.layAtY(y), cz0 = substrate.rowAtZ(z);
    const min2 = minDist * minDist;
    for (let cy = cy0 - 1; cy <= cy0 + 1; cy++) {
      for (let cz = cz0 - 1; cz <= cz0 + 1; cz++) {
        for (let cx = cx0 - 1; cx <= cx0 + 1; cx++) {
          const b = buckets.get(key(cx, cy, cz));
          if (!b) continue;
          for (const n of b) {
            const dx = n.x - x, dy = n.y - y, dz = n.z - z;
            if (dx * dx + dy * dy + dz * dz < min2) return true;
          }
        }
      }
    }
    return false;
  }

  // --- Amputate: cut out every strand within a radius of the target point ----
  // Removes all nodes inside the sphere. Surviving strands that lose their
  // parent become free fragments — they keep living and can still grow.
  amputateAt(x, y, z, radius) {
    const r2 = radius * radius;
    const removed = new Set();
    for (const n of this.nodes) {
      const dx = n.x - x, dy = n.y - y, dz = n.z - z;
      if (dx * dx + dy * dy + dz * dz <= r2) removed.add(n.id);
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

  // --- Occupancy: which voxels the network sits in (income + held ground) ----
  collectOccupiedCells(substrate) {
    for (const idx of this.occupiedIdx) {
      if (substrate.cells[idx]) substrate.cells[idx].held = 0;
    }
    this.occupiedIdx.clear();
    const income = [];
    for (const n of this.nodes) {
      if (n.infected) continue;                 // dead strands don't feed or hold ground
      const cx = substrate.colAtX(n.x), cy = substrate.layAtY(n.y), cz = substrate.rowAtZ(n.z);
      if (!substrate.inBounds(cx, cy, cz)) continue;
      const idx = substrate.index(cx, cy, cz);
      const cell = substrate.cells[idx];
      cell.held = Math.max(cell.held, n.health);
      if (!this.occupiedIdx.has(idx)) {
        this.occupiedIdx.add(idx);
        if (cell.nutrient > 0) income.push(cell);
      }
    }
    return income;
  }

  // --- Colonisation (per Grow cycle): branch within occupied substrate -------
  // Each Grow, every substrate voxel the network sits in (that isn't yet fully
  // colonised) sprouts a fresh branch or two and advances its colonisation.
  _colonizeStep(substrate, rng) {
    const g = this.config.growth;
    const step = this.config.substrate.colonizeRate;
    if (this.nodes.length >= g.maxNodes) return 0;

    const byCell = new Map();
    for (const n of this.nodes) {
      if (n.infected) continue;
      const cx = substrate.colAtX(n.x), cy = substrate.layAtY(n.y), cz = substrate.rowAtZ(n.z);
      if (!substrate.inBounds(cx, cy, cz)) continue;
      const idx = substrate.index(cx, cy, cz);
      const cell = substrate.cells[idx];
      if (cell.maxNutrient <= 0 || cell.rock || cell.colonized >= 1) continue;
      let e = byCell.get(idx);
      if (!e) byCell.set(idx, (e = { cell, nodes: [] }));
      e.nodes.push(n);
    }

    let created = 0;
    for (const { cell, nodes } of byCell.values()) {
      if (this.nodes.length >= g.maxNodes) break;
      const len = g.segmentLength * (0.85 + cell.colonized * 0.7);
      const parent = nodes[Math.floor(rng() * nodes.length)];
      const branches = 1 + (rng() < 0.6 ? 1 : 0);
      for (let b = 0; b < branches; b++) {
        // Random direction on the sphere.
        const th = rng() * Math.PI * 2;
        const cph = rng() * 2 - 1, sph = Math.sqrt(Math.max(0, 1 - cph * cph));
        const dist = len * (0.7 + rng() * 0.6);
        const nx = parent.x + Math.cos(th) * sph * dist;
        const ny = parent.y + cph * dist;
        const nz = parent.z + Math.sin(th) * sph * dist;
        if (ny >= -2 || ny <= -(substrate.worldDepth - 2)) continue;
        if (nx <= 2 || nx >= substrate.worldWidth - 2 || nz <= 2 || nz >= substrate.worldBreadth - 2) continue;
        const tc = substrate.cellAtWorld(nx, ny, nz);
        if (tc && (tc.rock || tc.antTrail)) continue;
        this.addNode(nx, ny, nz, parent);
        created++;
      }
      cell.colonized = Math.min(1, cell.colonized + step * parent.health);
    }
    return created;
  }

  // Age every strand a step — the renderer thickens the colony progressively.
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

  healthyCount() {
    let c = 0;
    for (const n of this.nodes) if (!n.infected) c++;
    return c;
  }

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

  // --- Fruiting: find reachable fruitable soil points on the surface plane ---
  // A soil column (cx,cz) is fruitable if an uninfected node sits within
  // reachDepth of the surface and within reachSpread horizontally. Adjacent
  // fruitable columns group into bodies on a clusterCells-pitch grid.
  computeFruitPoints(substrate) {
    const f = this.config.actions.fruit;
    const cs = substrate.cellSize;
    // Which surface columns have a near-surface node? Bucket nodes by column
    // first so this is O(nodes + soilColumns * neighborhood).
    const near = new Map();  // surfIndex -> true
    const spreadCells = Math.ceil((f.reachSpread + cs / 2) / cs);
    for (const n of this.nodes) {
      if (n.infected) continue;
      const depth = -n.y;
      if (depth < 0 || depth > f.reachDepth) continue;
      const ncx = substrate.colAtX(n.x), ncz = substrate.rowAtZ(n.z);
      for (let cz = ncz - spreadCells; cz <= ncz + spreadCells; cz++) {
        for (let cx = ncx - spreadCells; cx <= ncx + spreadCells; cx++) {
          if (!substrate.surfInBounds(cx, cz)) continue;
          const surf = substrate.surface[substrate.surfIndex(cx, cz)];
          if (!surf.soil) continue;
          const c = substrate.surfaceCenter(cx, cz);
          const dx = n.x - c.x, dz = n.z - c.z;
          const tol = f.reachSpread + cs / 2;
          if (dx * dx + dz * dz <= tol * tol) near.set(substrate.surfIndex(cx, cz), true);
        }
      }
    }
    // Group fruitable surface cells into bodies on a coarse grid: one body per
    // clusterCells x clusterCells bucket, at the centroid of its cells.
    const pitch = Math.max(1, f.clusterCells || 3);
    const buckets = new Map(); // bucketKey -> {sx, sz, n, shade}
    for (const idx of near.keys()) {
      const cx = idx % substrate.cols, cz = Math.floor(idx / substrate.cols);
      const bk = Math.floor(cx / pitch) + ',' + Math.floor(cz / pitch);
      let b = buckets.get(bk);
      if (!b) buckets.set(bk, (b = { sx: 0, sz: 0, n: 0, shade: 0 }));
      const c = substrate.surfaceCenter(cx, cz);
      b.sx += c.x; b.sz += c.z; b.n++;
      if (substrate.surface[idx].shade) b.shade++;
    }
    const points = [];
    for (const b of buckets.values()) {
      points.push({ x: b.sx / b.n, y: 0, z: b.sz / b.n, shade: b.shade * 2 > b.n });
    }
    this.fruitPoints = points;
    return points;
  }

  // --- bounding box (framing / dev) ------------------------------------------
  bounds() {
    if (this.nodes.length === 0) return null;
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const n of this.nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.z < minZ) minZ = n.z;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
      if (n.z > maxZ) maxZ = n.z;
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }
}
