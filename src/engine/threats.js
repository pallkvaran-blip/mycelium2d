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
  return { cx, cy, r, strength: 1, dying: false, heading: null };
}

// Seed the initial roaming clouds at map generation. They start in OPEN ground
// (not on food) and a good way from the colony, so each one visibly creeps in
// toward its nearest target. Returns the cloud list (stored on state.clouds)
// and stamps the field for first paint.
export function seedTrichoderma(substrate, config, rng, network) {
  const t = config.trichoderma;
  const root = network && network.root ? network.root : null;
  const clouds = [];
  for (let i = 0; i < t.initialPatches; i++) {
    const spot = pickOpenSpot(substrate, rng, root, t);
    clouds.push(makeCloud(spot.x, spot.y, rng.range(t.cloudRadiusMin, t.cloudRadiusMax)));
  }
  stampCloudField(substrate, clouds);
  return clouds;
}

// Pick an open underground spot — NOT on food/rock and (ideally) a good way from
// the colony — so a cloud has a clear journey ahead of it.
function pickOpenSpot(substrate, rng, root, t) {
  const minDist = substrate.worldWidth * (t.seedMinColonyDistFrac || 0);
  let fallback = null;
  for (let tries = 0; tries < 40; tries++) {
    const x = rng.range(substrate.cellSize, substrate.worldWidth - substrate.cellSize);
    const y = substrate.surfaceY + rng.range(substrate.cellSize, (substrate.rows - 1) * substrate.cellSize);
    const cell = substrate.cellAtWorld(x, y);
    if (!cell || cell.rock || cell.maxNutrient > 0) continue;   // open ground only
    fallback = { x, y };
    if (!root || Math.hypot(x - root.x, y - root.y) >= minDist) return { x, y };
  }
  return fallback || { x: substrate.worldWidth / 2, y: substrate.surfaceY + substrate.cellSize * 3 };
}

// Spawn a fresh roaming cloud in open ground far from the colony.
function spawnFarCloud(state) {
  const t = state.config.trichoderma;
  const root = state.active && state.active.root ? state.active.root : null;
  const spot = pickOpenSpot(state.substrate, state.rng, root, t);
  state.clouds.push(makeCloud(spot.x, spot.y, (t.cloudRadiusMin + t.cloudRadiusMax) / 2));
}

// Place clouds at fixed world positions (puzzle mode) and stamp the field.
export function placeClouds(substrate, positions, config) {
  const t = config.trichoderma;
  const r = (t.cloudRadiusMin + t.cloudRadiusMax) / 2;
  const clouds = positions.map((p) => makeCloud(p.x, p.y, r));
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

    // Head for the nearest food/strand WITHIN sight; if nothing is in range,
    // wander until something is sensed. (sightRadius is shown on screen.)
    const step = t.moveSpeed * cs;
    let tx = null, ty = null, best = t.sightRadius * t.sightRadius;
    for (const f of food) {
      const d = (f.x - cloud.cx) ** 2 + (f.y - cloud.cy) ** 2;
      if (d < best) { best = d; tx = f.x; ty = f.y; }
    }
    for (const n of nodes) {
      const d = (n.x - cloud.cx) ** 2 + (n.y - cloud.cy) ** 2;
      if (d < best) { best = d; tx = n.x; ty = n.y; }
    }
    if (tx != null) {
      // Creep toward the target, sliding ALONG rock faces (clouds can't travel
      // through rock) so they route around formations instead of tunnelling.
      const dx = tx - cloud.cx, dy = ty - cloud.cy;
      const dist = Math.hypot(dx, dy) || 1;
      cloud.heading = Math.atan2(dy, dx);
      moveCloud(cloud, dx / dist, dy / dist, Math.min(dist, step), sub);
    } else {
      // Nothing sensed — roam; turn away when a rock or the world edge blocks it.
      if (cloud.heading == null) cloud.heading = rng.range(0, Math.PI * 2);
      cloud.heading += rng.range(-0.4, 0.4);
      const moved = moveCloud(cloud, Math.cos(cloud.heading), Math.sin(cloud.heading), step, sub);
      if (!moved) cloud.heading += rng.range(2, 4); // blocked — pick a new way
    }

    // Devour the substrate it covers: cells within reach are eaten WHOLE, so the
    // pile visibly shrinks cell-by-cell as the cloud crawls across it. Eating
    // barely grows the cloud, hard-capped so it never gets giant.
    const ate = eatUnder(sub, cloud, t.consumeReachMult);
    if (ate > 0 && !cloud.dying) cloud.r = Math.min(t.cloudRadiusMax, cloud.r + t.growthPerEat);

    survivors.push(cloud);
  }
  state.clouds = survivors;

  // Keep the roaming population topped up: a cloud that infected you and faded
  // is eventually replaced by a fresh one creeping in from elsewhere, so the
  // threat never just ends and there's always something on the move.
  if (state.clouds.length < t.initialPatches && rng.chance(t.respawnChance)) {
    spawnFarCloud(state);
  }

  stampCloudField(sub, state.clouds);
}

// Move a cloud by (ux,uy)*s, but never THROUGH rock or out of bounds. The whole
// path is checked (not just the destination) so a long step can't jump over a
// thin wall. If the straight move is blocked, slide along the obstacle (x-only
// then y-only) so the cloud rounds rock formations. Returns true if it moved.
function moveCloud(cloud, ux, uy, s, sub) {
  const cs = sub.cellSize;
  const minX = cs, maxX = sub.worldWidth - cs;
  const minY = sub.surfaceY + cs, maxY = sub.worldHeight - cs;
  const pathClear = (x1, y1) => {
    const dx = x1 - cloud.cx, dy = y1 - cloud.cy;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cs * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const x = cloud.cx + dx * (i / steps), y = cloud.cy + dy * (i / steps);
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      const c = sub.cellAtWorld(x, y);
      if (c && c.rock) return false;
    }
    return true;
  };
  const fx = cloud.cx + ux * s, fy = cloud.cy + uy * s;
  if (pathClear(fx, fy)) { cloud.cx = fx; cloud.cy = fy; return true; }
  if (ux !== 0 && pathClear(fx, cloud.cy)) { cloud.cx = fx; return true; }   // slide along x
  if (uy !== 0 && pathClear(cloud.cx, fy)) { cloud.cy = fy; return true; }   // slide along y
  return false;                                                              // fully blocked
}

// Eat the substrate the cloud covers WHOLE: every food cell within reach is
// fully consumed (removed from the pile) this action — so the pile visibly
// shrinks cell-by-cell as the cloud crawls across it, rather than dimming
// uniformly. Returns total nutrient eaten.
function eatUnder(sub, cloud, reachMult) {
  const cs = sub.cellSize;
  const reach = cloud.r * cs * reachMult;
  const c0 = sub.colAtX(cloud.cx), r0 = sub.rowAtY(cloud.cy);
  const radCells = Math.ceil(reach / cs) + 1;
  let ate = 0;
  for (let row = r0 - radCells; row <= r0 + radCells; row++) {
    for (let col = c0 - radCells; col <= c0 + radCells; col++) {
      if (!sub.inBounds(col, row)) continue;
      const cell = sub.cells[sub.index(col, row)];
      if (cell.nutrient <= 0) continue;
      const ctr = sub.cellCenter(col, row);
      if (Math.hypot(ctr.x - cloud.cx, ctr.y - cloud.cy) > reach) continue;
      ate += cell.nutrient;
      cell.nutrient = 0;
      cell.maxNutrient = 0;   // the cell is gone — the pile gets smaller
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
  checkPuzzleGoal(state);
}

// Puzzle mode: reaching the treasure chest with a healthy strand wins the run.
export function checkPuzzleGoal(state) {
  if (state.mode !== 'puzzle' || state.won || state.runOver) return;
  const chest = state.chest;
  if (!chest) return;
  const r2 = chest.r * chest.r;
  for (const n of state.active.nodes) {
    if (n.infected) continue;
    const dx = n.x - chest.x, dy = n.y - chest.y;
    if (dx * dx + dy * dy <= r2) {
      state.won = true;
      state.runOver = true;
      state.runResult = { won: true, turns: state.turn };
      state.log('You reached the treasure! Puzzle solved.', 'good');
      return;
    }
  }
}

export function totalTrichoderma(substrate) {
  let total = 0;
  for (const cell of substrate.cells) total += cell.trich;
  return total;
}
