// =============================================================================
// Ants — a fixed territorial threat + food rival (A2/B6).
//
// A nest sits near the surface and runs a TRAIL to the nearest reachable food
// (BFS around rock). The ants harvest that food; when it's gone they retarget
// the next-nearest food, so an un-bombed nest works through the whole map
// (nests see everything — no sight limit). The trail is IMPASSABLE to your
// growth, so you can't pierce it; you go around, race them to the food (so they
// relocate), or bomb the nest (Attack Ants action).
//
// Renderer-agnostic: operates on substrate cells + the Network objects, with the
// live nest list on `state.ants`. No genetic-trait defence (Melanize) here.
// =============================================================================

// Seed nests near the surface, away from the colony's start column.
export function seedAnts(substrate, config, rng, network) {
  const a = config.ants;
  const nests = [];
  const rootCol = network && network.root ? substrate.colAtX(network.root.x) : -99;
  for (let i = 0; i < (a.nestCount || 0); i++) {
    let col = rng.int(2, substrate.cols - 3);
    for (let tries = 0; tries < 40; tries++) {
      col = rng.int(2, substrate.cols - 3);
      const top = substrate.cellAt(col, 0);
      if (top && !top.rock && Math.abs(col - rootCol) > 6) break;
    }
    const ctr = substrate.cellCenter(col, 0);
    const nest = {
      col, x: ctr.x, y: substrate.surfaceY,
      hp: a.maxHp, maxHp: a.maxHp,
      target: null, path: [], phase: 0, dormant: false,
    };
    retarget(substrate, nest);
    nests.push(nest);
  }
  setTrailFields(substrate, nests);
  return nests;
}

// Per-turn: each nest harvests its target food (retargeting when it's gone),
// then we re-stamp the trail barrier and eat any strands a trail moved onto.
export function stepAnts(state) {
  const sub = state.substrate;
  const nests = state.ants;
  if (!nests || !nests.length) return;
  for (const nest of nests) {
    let cell = nest.target ? sub.cellAt(nest.target.col, nest.target.row) : null;
    if (!cell || cell.nutrient <= 0) {
      retarget(sub, nest);
      cell = nest.target ? sub.cellAt(nest.target.col, nest.target.row) : null;
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
export function attackNest(state, x, y, radius, frac) {
  const nests = state.ants || [];
  let best = null, bestD2 = radius * radius;
  for (const nest of nests) {
    const dx = nest.x - x, dy = nest.y - y, d2 = dx * dx + dy * dy;
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

// --- internals --------------------------------------------------------------

// Point a nest at the nearest reachable food and lay its trail there.
function retarget(sub, nest) {
  const t = buildTrail(sub, nest.col, 0);
  if (t) { nest.target = t.target; nest.path = t.path; nest.dormant = false; }
  else { nest.target = null; nest.path = []; nest.dormant = true; }
}

// BFS from the nest cell (around rock) to the nearest food cell; returns the
// {target, path} (path is a list of {col,row} from nest to food) or null.
function buildTrail(sub, nestCol, nestRow) {
  const W = sub.cols, H = sub.rows;
  const parent = new Int32Array(W * H).fill(-2);   // -2 unvisited, -1 = start
  const start = nestRow * W + nestCol;
  parent[start] = -1;
  const q = [start];
  let head = 0, foodIdx = -1;
  const nbrs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  while (head < q.length) {
    const cur = q[head++];
    const cell = sub.cells[cur];
    if (cell.nutrient > 0 && cur !== start) { foodIdx = cur; break; }  // nearest food (BFS order)
    const c = cur % W, r = (cur / W) | 0;
    for (const [dc, dr] of nbrs) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
      const ni = nr * W + nc;
      if (parent[ni] !== -2 || sub.cells[ni].rock) continue;
      parent[ni] = cur;
      q.push(ni);
    }
  }
  if (foodIdx === -1) return null;
  const path = [];
  for (let cur = foodIdx; cur !== -1; cur = parent[cur]) path.push({ col: cur % W, row: (cur / W) | 0 });
  path.reverse();
  return { target: { col: foodIdx % W, row: (foodIdx / W) | 0 }, path };
}

// Stamp the trail barrier into cells: every trail cell EXCEPT the food endpoint
// blocks growth (the endpoint stays reachable so you can still race for it).
function setTrailFields(sub, nests) {
  for (const c of sub.cells) c.antTrail = false;
  for (const nest of nests) {
    if (!nest.path) continue;
    for (let k = 0; k < nest.path.length - 1; k++) {
      const p = nest.path[k];
      const cell = sub.cellAt(p.col, p.row);
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
      const cell = sub.cellAtWorld(n.x, n.y);
      if (cell && cell.antTrail) remove.add(n.id);
    }
    if (remove.size) net._removeNodes(remove);
  }
}
