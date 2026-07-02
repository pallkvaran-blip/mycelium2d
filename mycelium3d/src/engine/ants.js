// =============================================================================
// Ants — a fixed territorial threat + food rival (3D port).
//
// A nest sits on the SURFACE PLANE and runs a TRAIL down through the earth to
// the nearest reachable food (BFS around rock, 6-connected voxels). The ants
// harvest that food; when it's gone they retarget the next-nearest food, so an
// un-bombed nest works through the whole map. The trail is IMPASSABLE to your
// growth: you go around it, race them to the food, or bomb the nest.
//
// Renderer-agnostic: operates on substrate voxels + Network objects, with the
// live nest list on `state.ants`.
// =============================================================================

// Seed nests on the surface, away from the colony's start column.
export function seedAnts(substrate, config, rng, network) {
  const a = config.ants;
  const nests = [];
  const rootCx = network && network.root ? substrate.colAtX(network.root.x) : -99;
  const rootCz = network && network.root ? substrate.rowAtZ(network.root.z) : -99;
  for (let i = 0; i < (a.nestCount || 0); i++) {
    let cx = rng.int(2, substrate.cols - 3), cz = rng.int(2, substrate.rows - 3);
    for (let tries = 0; tries < 60; tries++) {
      cx = rng.int(2, substrate.cols - 3);
      cz = rng.int(2, substrate.rows - 3);
      const top = substrate.cellAt(cx, 0, cz);
      if (top && !top.rock && Math.hypot(cx - rootCx, cz - rootCz) > 6) break;
    }
    const c = substrate.surfaceCenter(cx, cz);
    const nest = {
      cx, cz, x: c.x, y: 0, z: c.z,
      hp: a.maxHp, maxHp: a.maxHp,
      target: null, path: [], phase: 0, dormant: false,
    };
    retarget(substrate, nest);
    nests.push(nest);
  }
  setTrailFields(substrate, nests);
  return nests;
}

// Per-step: each nest harvests its target food (retargeting when it's gone),
// then we re-stamp the trail barrier and eat any strands a trail moved onto.
export function stepAnts(state) {
  const sub = state.substrate;
  const nests = state.ants;
  if (!nests || !nests.length) return;
  for (const nest of nests) {
    let cell = nest.target ? sub.cellAt(nest.target.cx, nest.target.cy, nest.target.cz) : null;
    if (!cell || cell.nutrient <= 0) {
      retarget(sub, nest);
      cell = nest.target ? sub.cellAt(nest.target.cx, nest.target.cy, nest.target.cz) : null;
    }
    if (cell && cell.nutrient > 0) {
      cell.nutrient = Math.max(0, cell.nutrient - state.config.ants.harvestRate);
      nest.dormant = false;
    } else {
      nest.dormant = true;   // no reachable food left
    }
    nest.phase = (nest.phase || 0) + 1;
  }
  setTrailFields(sub, nests);
  eatStrandsOnTrail(state);
}

// Bomb the nearest nest within radius: remove a fraction of its MAX hp; destroy
// it (and clear its trail) at <= 0. Returns {hp,maxHp,dead} or null if no hit.
export function attackNest(state, x, y, z, radius, frac) {
  const nests = state.ants || [];
  let best = null, bestD2 = radius * radius;
  for (const nest of nests) {
    const dx = nest.x - x, dy = nest.y - y, dz = nest.z - z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 <= bestD2) { bestD2 = d2; best = nest; }
  }
  if (!best) return null;
  best.hp -= frac * best.maxHp;
  if (best.hp <= 0) {
    best.hp = 0;
    state.ants = nests.filter((n) => n !== best);
    setTrailFields(state.substrate, state.ants);
    return { hp: 0, maxHp: best.maxHp, dead: true };
  }
  return { hp: best.hp, maxHp: best.maxHp, dead: false };
}

// --- internals ----------------------------------------------------------------

// Point a nest at the nearest reachable food and lay its trail there.
function retarget(sub, nest) {
  const t = buildTrail(sub, nest.cx, 0, nest.cz);
  if (t) { nest.target = t.target; nest.path = t.path; nest.dormant = false; }
  else { nest.target = null; nest.path = []; nest.dormant = true; }
}

// BFS from the nest's top voxel (around rock, 6-connected) to the nearest food
// voxel; returns {target, path} (path is a list of {cx,cy,cz} from nest to
// food) or null. Uses a typed parent array over the whole voxel grid.
function buildTrail(sub, nestCx, nestCy, nestCz) {
  const total = sub.cols * sub.lays * sub.rows;
  const parent = new Int32Array(total).fill(-2);   // -2 unvisited, -1 = start
  const start = sub.index(nestCx, nestCy, nestCz);
  if (sub.cells[start].rock) return null;
  parent[start] = -1;
  const q = new Int32Array(total);
  q[0] = start;
  let head = 0, tail = 1, foodIdx = -1;
  while (head < tail) {
    const cur = q[head++];
    const cell = sub.cells[cur];
    if (cell.nutrient > 0 && cur !== start) { foodIdx = cur; break; }  // nearest food (BFS order)
    // decode cur -> (cx, cy, cz):  index = (cy * rows + cz) * cols + cx
    const cx = cur % sub.cols;
    const rest = (cur / sub.cols) | 0;
    const cz = rest % sub.rows;
    const cy = (rest / sub.rows) | 0;
    // 6-connected neighbours
    tryVisit(sub, parent, q, cur, cx - 1, cy, cz) && (tail = pushIdx(sub, q, tail, cx - 1, cy, cz));
    tryVisit(sub, parent, q, cur, cx + 1, cy, cz) && (tail = pushIdx(sub, q, tail, cx + 1, cy, cz));
    tryVisit(sub, parent, q, cur, cx, cy - 1, cz) && (tail = pushIdx(sub, q, tail, cx, cy - 1, cz));
    tryVisit(sub, parent, q, cur, cx, cy + 1, cz) && (tail = pushIdx(sub, q, tail, cx, cy + 1, cz));
    tryVisit(sub, parent, q, cur, cx, cy, cz - 1) && (tail = pushIdx(sub, q, tail, cx, cy, cz - 1));
    tryVisit(sub, parent, q, cur, cx, cy, cz + 1) && (tail = pushIdx(sub, q, tail, cx, cy, cz + 1));
  }
  if (foodIdx === -1) return null;
  const path = [];
  for (let cur = foodIdx; cur !== -1; cur = parent[cur]) {
    const cx = cur % sub.cols;
    const rest = (cur / sub.cols) | 0;
    const cz = rest % sub.rows;
    const cy = (rest / sub.rows) | 0;
    path.push({ cx, cy, cz });
  }
  path.reverse();
  const t = path[path.length - 1];
  return { target: { cx: t.cx, cy: t.cy, cz: t.cz }, path };
}

function tryVisit(sub, parent, q, from, cx, cy, cz) {
  if (!sub.inBounds(cx, cy, cz)) return false;
  const ni = sub.index(cx, cy, cz);
  if (parent[ni] !== -2 || sub.cells[ni].rock) return false;
  parent[ni] = from;
  return true;
}
function pushIdx(sub, q, tail, cx, cy, cz) {
  q[tail] = sub.index(cx, cy, cz);
  return tail + 1;
}

// Stamp the trail barrier into voxels: every trail voxel EXCEPT the food
// endpoint blocks growth (the endpoint stays reachable so you can race for it).
function setTrailFields(sub, nests) {
  for (const c of sub.cells) c.antTrail = false;
  for (const nest of nests) {
    if (!nest.path) continue;
    for (let k = 0; k < nest.path.length - 1; k++) {
      const p = nest.path[k];
      const cell = sub.cellAt(p.cx, p.cy, p.cz);
      if (cell && !cell.rock) cell.antTrail = true;
    }
  }
}

// Ants chew any of your strands a trail now runs through (e.g. after it moved).
function eatStrandsOnTrail(state) {
  const sub = state.substrate;
  for (const net of state.networks) {
    if (!net.alive) continue;
    const remove = new Set();
    for (const n of net.nodes) {
      const cell = sub.cellAtWorld(n.x, n.y, n.z);
      if (cell && cell.antTrail) remove.add(n.id);
    }
    if (remove.size) net._removeNodes(remove);
  }
}
