// =============================================================================
// Threats — Trichoderma, the one Phase 1 threat (A2/A5, B6).
//
// Trichoderma is modelled as a small number of discrete, roughly fixed-size
// CLOUDS that roam the cross-section:
//   - Each cloud creeps toward the nearest food source.
//   - It devours any substrate it passes over (a pile it sits on is gone in
//     ~2 turns) but eating barely grows it — a small cloud that eats a giant
//     pile stays small.
//   - The moment a cloud's outer edge touches your network it infects you
//     (turning a chunk of strands green/dead), then spends itself: it keeps
//     drifting toward food while fading away completely over ~2 turns. So each
//     cloud infects you at most once.
//   - Once the rot is inside you it races along your filaments (several rings a
//     turn) until you Amputate the infected branch.
//
// The discrete clouds are projected into a per-cell intensity field
// (cell.trich) every turn purely so the renderer and recovery checks can read
// a simple scalar. Countered by:
//   - Amputate (cut out the infected branch — the only cure once inside)
//   - Melanize (a chance to resist the initial contact)
//
// Renderer-agnostic: operates only on substrate cells + the Network objects,
// with the live cloud list living on `state.clouds`.
// =============================================================================

function makeCloud(cx, cy, r) {
  return { cx, cy, r, strength: 1, dying: false };
}

// Seed the initial roaming clouds at map generation, biased to start near food
// clusters so the richest substrate is also the most contested (B6). Returns
// the cloud list (stored on state.clouds) and stamps the field for first paint.
export function seedTrichoderma(substrate, config, rng) {
  const t = config.trichoderma;
  const clouds = [];
  const candidates = [];
  substrate.forEachCell((cell, col, row) => {
    if (!cell.rock && !cell.hazard && cell.nutrient > 0) candidates.push(substrate.cellCenter(col, row));
  });
  for (let i = 0; i < t.initialPatches; i++) {
    let cx, cy;
    if (candidates.length && rng.chance(t.seedFoodBias)) {
      const c = rng.pick(candidates);
      cx = c.x + rng.range(-2, 2) * substrate.cellSize;
      cy = c.y + rng.range(-2, 2) * substrate.cellSize;
    } else {
      cx = rng.range(0, substrate.worldWidth);
      cy = substrate.surfaceY + rng.range(0, substrate.rows * substrate.cellSize);
    }
    clouds.push(makeCloud(cx, cy, rng.range(t.cloudRadiusMin, t.cloudRadiusMax)));
  }
  stampCloudField(substrate, clouds);
  return clouds;
}

// Dev cheat / spawn hook: drop a fresh cloud at a world point.
export function spawnTrichodermaAt(state, x, y) {
  const t = state.config.trichoderma;
  const r = (t.cloudRadiusMin + t.cloudRadiusMax) / 2;
  const cloud = makeCloud(x, y, r);
  if (!state.clouds) state.clouds = [];
  state.clouds.push(cloud);
  stampCloudField(state.substrate, state.clouds);
  return cloud;
}

// --- Per-turn cloud step (B6) -----------------------------------------------
// Move every cloud toward the nearest food, devour what it sits on, fade any
// spent cloud, then re-project the clouds into the cell.trich field.
export function spreadTrichoderma(state) {
  const { config, substrate: sub, rng } = state;
  const t = config.trichoderma;
  const cs = sub.cellSize;
  if (!state.clouds) state.clouds = [];

  // Current food cell centres — clouds home in on the nearest food source.
  const food = [];
  sub.forEachCell((cell, col, row) => {
    if (cell.nutrient > 0 && !cell.rock) food.push(sub.cellCenter(col, row));
  });
  // Your colony counts as a food source too, so a cloud always heads for the
  // CLOSEST of (substrate, you) and never sits idle while a target exists.
  const nodes = state.active && state.active.alive ? state.active.nodes : [];

  const survivors = [];
  for (const cloud of state.clouds) {
    // A spent cloud fades to nothing over fadeTurns, then is dropped.
    if (cloud.dying) {
      cloud.strength -= 1 / Math.max(1, t.fadeTurns);
      if (cloud.strength <= 0.01) continue;
    }

    // Drift toward the nearest target among ALL food cells AND all your strands.
    let tx = null, ty = null, best = Infinity;
    for (const f of food) {
      const d = (f.x - cloud.cx) ** 2 + (f.y - cloud.cy) ** 2;
      if (d < best) { best = d; tx = f.x; ty = f.y; }
    }
    for (const n of nodes) {
      const d = (n.x - cloud.cx) ** 2 + (n.y - cloud.cy) ** 2;
      if (d < best) { best = d; tx = n.x; ty = n.y; }
    }
    if (tx != null) {
      const dx = tx - cloud.cx, dy = ty - cloud.cy;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(dist, t.moveSpeed * cs);
      cloud.cx += (dx / dist) * step;
      cloud.cy += (dy / dist) * step;
    }

    // Devour the substrate under the cloud — fast (a covered cell is gone in
    // ~2 turns). Eating barely grows the cloud, hard-capped so it never gets
    // giant no matter how much food it consumes.
    const ate = eatUnder(sub, cloud, t.consumeFraction);
    if (ate > 0 && !cloud.dying) cloud.r = Math.min(t.cloudRadiusMax, cloud.r + t.growthPerEat);

    survivors.push(cloud);
  }
  state.clouds = survivors;

  // Ambient new outbreaks (off by default).
  if (t.spawnChancePerTurn > 0 && rng.chance(t.spawnChancePerTurn)) {
    spawnTrichodermaAt(state, rng.range(0, sub.worldWidth), sub.surfaceY + rng.range(0, sub.rows * cs));
  }

  stampCloudField(sub, state.clouds);
}

// Digest the whole substrate PILE a cloud is touching (not just the cells under
// its small footprint): find food under the cloud, flood-fill the connected
// pile, and drain every cell in it. So a small cloud that merely reaches a big
// pile still finishes the whole thing in ~2 turns. Returns total nutrient eaten.
function eatUnder(sub, cloud, frac) {
  const cs = sub.cellSize;
  const c0 = sub.colAtX(cloud.cx), r0 = sub.rowAtY(cloud.cy);
  const radCells = Math.ceil(cloud.r) + 1;
  const reach = cloud.r * cs;

  // Seeds: food cells the cloud's footprint overlaps.
  const stack = [];
  for (let row = r0 - radCells; row <= r0 + radCells; row++) {
    for (let col = c0 - radCells; col <= c0 + radCells; col++) {
      if (!sub.inBounds(col, row)) continue;
      const cell = sub.cells[sub.index(col, row)];
      if (cell.nutrient <= 0) continue;
      const ctr = sub.cellCenter(col, row);
      if (Math.hypot(ctr.x - cloud.cx, ctr.y - cloud.cy) <= reach) stack.push(col * 100000 + row);
    }
  }
  if (!stack.length) return 0;

  // Flood-fill through the connected food cluster (cells that ARE/WERE food, i.e.
  // maxNutrient > 0) and drain each one.
  const nbrs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];
  const seen = new Set();
  let ate = 0;
  while (stack.length) {
    const packed = stack.pop();
    if (seen.has(packed)) continue;
    seen.add(packed);
    const col = Math.floor(packed / 100000), row = packed % 100000;
    if (!sub.inBounds(col, row)) continue;
    const cell = sub.cells[sub.index(col, row)];
    if (cell.maxNutrient <= 0 || cell.rock) continue;   // only spread through the pile
    if (cell.nutrient > 0) {
      const take = Math.min(cell.nutrient, cell.maxNutrient * frac);
      cell.nutrient -= take;
      ate += take;
    }
    for (const [dc, dr] of nbrs) {
      const nc = col + dc, nr = row + dr;
      if (nc >= 0 && nr >= 0) stack.push(nc * 100000 + nr);
    }
  }
  return ate;
}

// Project the discrete clouds into the per-cell intensity field (render + the
// network's recovery check both read cell.trich). Cleared and rebuilt each step.
function stampCloudField(sub, clouds) {
  const cs = sub.cellSize;
  for (const cell of sub.cells) cell.trich = 0;
  for (const cloud of clouds) {
    const c0 = sub.colAtX(cloud.cx), r0 = sub.rowAtY(cloud.cy);
    const radCells = Math.ceil(cloud.r) + 1;
    const reach = cloud.r * cs;
    const strength = cloud.strength == null ? 1 : cloud.strength;
    for (let row = r0 - radCells; row <= r0 + radCells; row++) {
      for (let col = c0 - radCells; col <= c0 + radCells; col++) {
        if (!sub.inBounds(col, row)) continue;
        const cell = sub.cells[sub.index(col, row)];
        if (cell.rock) continue;
        const ctr = sub.cellCenter(col, row);
        const d = Math.hypot(ctr.x - cloud.cx, ctr.y - cloud.cy);
        if (d > reach) continue;
        const inten = strength * (1 - d / (reach + cs * 0.5));
        if (inten > cell.trich) cell.trich = inten;
      }
    }
  }
}

// --- Per-turn network infection (B6) ----------------------------------------
// When a cloud's edge touches a healthy strand it breaches — infecting that
// strand and instantly claiming a chunk of mycelium around it — then the cloud
// is spent (it begins to fade). After that the rot races along your filaments
// several rings per turn. Melanize gives a chance to resist the initial breach.
export function infectNetwork(net, state) {
  const { config, substrate: sub, rng } = state;
  const t = config.trichoderma;
  const cs = sub.cellSize;
  const melanize = net.traits.melanize || 0;
  const resist = Math.min(0.9, melanize * config.traits.melanize.contactResistPerLevel);

  // 1) Contact — a cloud that touches you infects (chunk) and then spends itself.
  for (const cloud of (state.clouds || [])) {
    if (cloud.dying) continue;                 // already spent — fading away
    const reach = cloud.r * cs;
    let hit = null, best = Infinity;
    for (const n of net.nodes) {
      if (n.infected) continue;
      const d = (n.x - cloud.cx) ** 2 + (n.y - cloud.cy) ** 2;
      if (d <= reach * reach && d < best) { best = d; hit = n; }
    }
    if (hit) {
      if (rng() < t.contactChance * (1 - resist)) {
        hit.infected = true;
        infectAround(net, hit, t.contactChunk, 1, rng);
      }
      cloud.dying = true;   // it spent itself breaching you — now it fades out
    }
  }

  // 2) Internal spread — the rot races along the filaments from the whole front.
  const front = [];
  for (const n of net.nodes) if (n.infected) front.push(n);
  for (const n of front) infectAround(net, n, t.spreadDepthPerTurn, t.infectionSpreadChance, rng);
}

// Flood infection outward from `seed` up to `depth` rings along the graph
// (parent + children each step). chance 1 = guaranteed (an instant chunk);
// < 1 = an organic race that may stall short of `depth`.
function infectAround(network, seed, depth, chance, rng) {
  let frontier = [seed];
  for (let d = 0; d < depth && frontier.length; d++) {
    const next = [];
    for (const n of frontier) {
      if (n.parentId != null) {
        const p = network.byId.get(n.parentId);
        if (p && !p.infected && (chance >= 1 || rng() < chance)) { p.infected = true; next.push(p); }
      }
      for (const cid of n.children) {
        const c = network.byId.get(cid);
        if (c && !c.infected && (chance >= 1 || rng() < chance)) { c.infected = true; next.push(c); }
      }
    }
    frontier = next;
  }
}

// --- Per-action threat tick (B6) --------------------------------------------
// The mould reacts to the player's EVERY action (not just at end of turn): the
// roaming clouds creep + eat, and any rot already inside races further along
// the filaments. Called from performAction after each successful action.
export function tickThreat(state) {
  if (state.runOver) return;
  spreadTrichoderma(state);
  for (const net of state.networks) {
    if (!net.alive) continue;
    infectNetwork(net, state);
    net.recomputeVitality();
    if (net.nodes.length === 0 || net.healthyCount() === 0) {
      net.alive = false;
      if (net.active && !state.runOver) {
        state.runOver = true;
        state.runResult = { spores: net.spores, bodies: 0, died: true };
        state.log('The colony has been consumed by Trichoderma. Run over.', 'warn');
      }
    }
  }
}

export function totalTrichoderma(substrate) {
  let total = 0;
  for (const cell of substrate.cells) total += cell.trich;
  return total;
}
