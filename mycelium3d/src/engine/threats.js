// =============================================================================
// Threats — Trichoderma, the roaming mould (3D port).
//
// A small number of discrete, roughly fixed-size CLOUDS roam the volume:
//   - Each cloud creeps toward the nearest food source (or you).
//   - It devours any substrate it passes over but eating barely grows it.
//   - The moment a cloud's edge touches your network it infects you (turning a
//     chunk of strands green/dead), then spends itself and fades away.
//   - Once inside, the rot races along your filaments (several rings a step)
//     until you Amputate the infected branch.
//
// The discrete clouds are projected into a per-voxel intensity field
// (cell.trich) each step so the renderer can read a simple scalar.
// Renderer-agnostic: operates only on substrate voxels + Network objects.
// =============================================================================

function makeCloud(x, y, z, r) {
  return { x, y, z, r, strength: 1, dying: false, heading: null };
}

// Seed the initial roaming clouds at map generation. They start in OPEN ground
// (not on food) and a good way from the colony, so each one visibly creeps in.
export function seedTrichoderma(substrate, config, rng, network) {
  const t = config.trichoderma;
  const root = network && network.root ? network.root : null;
  const clouds = [];
  for (let i = 0; i < t.initialPatches; i++) {
    const spot = pickOpenSpot(substrate, rng, root, t);
    clouds.push(makeCloud(spot.x, spot.y, spot.z, rng.range(t.cloudRadiusMin, t.cloudRadiusMax)));
  }
  stampCloudField(substrate, clouds);
  return clouds;
}

// Pick an open underground spot — NOT on food/rock and (ideally) a good way
// from the colony — so a cloud has a clear journey ahead of it.
function pickOpenSpot(substrate, rng, root, t) {
  const minDist = substrate.worldWidth * (t.seedMinColonyDistFrac || 0);
  let fallback = null;
  for (let tries = 0; tries < 60; tries++) {
    const x = rng.range(substrate.cellSize, substrate.worldWidth - substrate.cellSize);
    const y = -rng.range(substrate.cellSize, (substrate.lays - 1) * substrate.cellSize);
    const z = rng.range(substrate.cellSize, substrate.worldBreadth - substrate.cellSize);
    const cell = substrate.cellAtWorld(x, y, z);
    if (!cell || cell.rock || cell.maxNutrient > 0) continue;   // open ground only
    fallback = { x, y, z };
    if (!root || Math.hypot(x - root.x, y - root.y, z - root.z) >= minDist) return { x, y, z };
  }
  return fallback || { x: substrate.worldWidth / 2, y: -substrate.cellSize * 3, z: substrate.worldBreadth / 2 };
}

// Spawn a fresh roaming cloud in open ground far from the colony.
function spawnFarCloud(state) {
  const t = state.config.trichoderma;
  const root = state.active && state.active.root ? state.active.root : null;
  const spot = pickOpenSpot(state.substrate, state.rng, root, t);
  state.clouds.push(makeCloud(spot.x, spot.y, spot.z, (t.cloudRadiusMin + t.cloudRadiusMax) / 2));
}

// Dev cheat / spawn hook: drop a fresh cloud at a world point.
export function spawnTrichodermaAt(state, x, y, z) {
  const t = state.config.trichoderma;
  const r = (t.cloudRadiusMin + t.cloudRadiusMax) / 2;
  const cloud = makeCloud(x, y, z, r);
  if (!state.clouds) state.clouds = [];
  state.clouds.push(cloud);
  stampCloudField(state.substrate, state.clouds);
  return cloud;
}

// --- Per-step cloud update ----------------------------------------------------
// Move every cloud toward the nearest food, devour what it sits on, fade any
// spent cloud, then re-project the clouds into the cell.trich field.
export function spreadTrichoderma(state) {
  const { config, substrate: sub, rng } = state;
  const t = config.trichoderma;
  const cs = sub.cellSize;
  if (!state.clouds) state.clouds = [];

  // Current food voxel centres — clouds home in on the nearest food source.
  const food = [];
  sub.forEachCell((cell, cx, cy, cz) => {
    if (cell.nutrient > 0 && !cell.rock) food.push(sub.cellCenter(cx, cy, cz));
  });
  // Your colony counts as a food source too.
  const nodes = state.active && state.active.alive ? state.active.nodes : [];

  const survivors = [];
  for (const cloud of state.clouds) {
    // A spent cloud fades to nothing over fadeTurns, then is dropped.
    if (cloud.dying) {
      cloud.strength -= 1 / Math.max(1, t.fadeTurns);
      if (cloud.strength <= 0.01) continue;
    }

    // Head for the nearest food/strand WITHIN sight; else wander.
    const step = t.moveSpeed * cs;
    let tx = null, ty = null, tz = null, best = t.sightRadius * t.sightRadius;
    for (const f of food) {
      const d = (f.x - cloud.x) ** 2 + (f.y - cloud.y) ** 2 + (f.z - cloud.z) ** 2;
      if (d < best) { best = d; tx = f.x; ty = f.y; tz = f.z; }
    }
    for (const n of nodes) {
      const d = (n.x - cloud.x) ** 2 + (n.y - cloud.y) ** 2 + (n.z - cloud.z) ** 2;
      if (d < best) { best = d; tx = n.x; ty = n.y; tz = n.z; }
    }
    if (tx != null) {
      const dx = tx - cloud.x, dy = ty - cloud.y, dz = tz - cloud.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      cloud.heading = { x: dx / dist, y: dy / dist, z: dz / dist };
      moveCloud(cloud, dx / dist, dy / dist, dz / dist, Math.min(dist, step), sub);
    } else {
      // Nothing sensed — roam; turn away when rock or the world edge blocks it.
      if (!cloud.heading) cloud.heading = randomDir(rng);
      wobble(cloud.heading, rng, 0.4);
      const moved = moveCloud(cloud, cloud.heading.x, cloud.heading.y, cloud.heading.z, step, sub);
      if (!moved) cloud.heading = randomDir(rng);       // blocked — pick a new way
    }

    // Devour the substrate it covers: voxels within reach are eaten WHOLE.
    const ate = eatUnder(sub, cloud, t.consumeReachMult);
    if (ate > 0 && !cloud.dying) cloud.r = Math.min(t.cloudRadiusMax, cloud.r + t.growthPerEat);

    survivors.push(cloud);
  }
  state.clouds = survivors;

  // Keep the roaming population topped up.
  if (state.clouds.length < t.initialPatches && rng.chance(t.respawnChance)) {
    spawnFarCloud(state);
  }

  stampCloudField(sub, state.clouds);
}

function randomDir(rng) {
  const th = rng.range(0, Math.PI * 2);
  const cph = rng.range(-1, 1), sph = Math.sqrt(Math.max(0, 1 - cph * cph));
  return { x: Math.cos(th) * sph, y: cph, z: Math.sin(th) * sph };
}
function wobble(dir, rng, amt) {
  dir.x += rng.range(-amt, amt);
  dir.y += rng.range(-amt, amt) * 0.5;   // mostly horizontal roaming
  dir.z += rng.range(-amt, amt);
  const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
  dir.x /= l; dir.y /= l; dir.z /= l;
}

// Move a cloud by (ux,uy,uz)*s, but never THROUGH rock or out of bounds. The
// whole path is checked; a blocked straight move slides along single axes
// (x, z, then y) so the cloud rounds rock formations. Returns true if it moved.
function moveCloud(cloud, ux, uy, uz, s, sub) {
  const cs = sub.cellSize;
  const minX = cs, maxX = sub.worldWidth - cs;
  const minY = -(sub.worldDepth - cs), maxY = -cs;
  const minZ = cs, maxZ = sub.worldBreadth - cs;
  const pathClear = (x1, y1, z1) => {
    const dx = x1 - cloud.x, dy = y1 - cloud.y, dz = z1 - cloud.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / (cs * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const x = cloud.x + dx * (i / steps), y = cloud.y + dy * (i / steps), z = cloud.z + dz * (i / steps);
      if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) return false;
      const c = sub.cellAtWorld(x, y, z);
      if (c && c.rock) return false;
    }
    return true;
  };
  const fx = cloud.x + ux * s, fy = cloud.y + uy * s, fz = cloud.z + uz * s;
  if (pathClear(fx, fy, fz)) { cloud.x = fx; cloud.y = fy; cloud.z = fz; return true; }
  if (ux !== 0 && pathClear(fx, cloud.y, cloud.z)) { cloud.x = fx; return true; }
  if (uz !== 0 && pathClear(cloud.x, cloud.y, fz)) { cloud.z = fz; return true; }
  if (uy !== 0 && pathClear(cloud.x, fy, cloud.z)) { cloud.y = fy; return true; }
  return false;
}

// Eat the substrate the cloud covers WHOLE: every food voxel within reach is
// fully consumed this action. Returns total nutrient eaten.
function eatUnder(sub, cloud, reachMult) {
  const cs = sub.cellSize;
  const reach = cloud.r * cs * reachMult;
  const c0 = sub.colAtX(cloud.x), l0 = sub.layAtY(cloud.y), r0 = sub.rowAtZ(cloud.z);
  const radCells = Math.ceil(reach / cs) + 1;
  let ate = 0;
  for (let cy = l0 - radCells; cy <= l0 + radCells; cy++) {
    for (let cz = r0 - radCells; cz <= r0 + radCells; cz++) {
      for (let cx = c0 - radCells; cx <= c0 + radCells; cx++) {
        if (!sub.inBounds(cx, cy, cz)) continue;
        const cell = sub.cells[sub.index(cx, cy, cz)];
        if (cell.nutrient <= 0) continue;
        const c = sub.cellCenter(cx, cy, cz);
        if (Math.hypot(c.x - cloud.x, c.y - cloud.y, c.z - cloud.z) > reach) continue;
        ate += cell.nutrient;
        cell.nutrient = 0;
        cell.maxNutrient = 0;   // the voxel is gone — the pile gets smaller
      }
    }
  }
  return ate;
}

// Project the discrete clouds into the per-voxel intensity field.
function stampCloudField(sub, clouds) {
  const cs = sub.cellSize;
  for (const cell of sub.cells) cell.trich = 0;
  for (const cloud of clouds) {
    const c0 = sub.colAtX(cloud.x), l0 = sub.layAtY(cloud.y), r0 = sub.rowAtZ(cloud.z);
    const radCells = Math.ceil(cloud.r) + 1;
    const reach = cloud.r * cs;
    const strength = cloud.strength == null ? 1 : cloud.strength;
    for (let cy = l0 - radCells; cy <= l0 + radCells; cy++) {
      for (let cz = r0 - radCells; cz <= r0 + radCells; cz++) {
        for (let cx = c0 - radCells; cx <= c0 + radCells; cx++) {
          if (!sub.inBounds(cx, cy, cz)) continue;
          const cell = sub.cells[sub.index(cx, cy, cz)];
          if (cell.rock) continue;
          const c = sub.cellCenter(cx, cy, cz);
          const d = Math.hypot(c.x - cloud.x, c.y - cloud.y, c.z - cloud.z);
          if (d > reach) continue;
          const inten = strength * (1 - d / (reach + cs * 0.5));
          if (inten > cell.trich) cell.trich = inten;
        }
      }
    }
  }
}

// --- Per-step network infection ------------------------------------------------
// When a cloud's edge touches a healthy strand it breaches — infecting that
// strand and instantly claiming a chunk of mycelium around it — then the cloud
// is spent. After that the rot races along your filaments each step.
export function infectNetwork(net, state) {
  const { config, substrate: sub, rng } = state;
  const t = config.trichoderma;
  const cs = sub.cellSize;

  for (const cloud of (state.clouds || [])) {
    if (cloud.dying) continue;                 // already spent — fading away
    const reach = cloud.r * cs;
    let hit = null, best = Infinity, touched = false;
    for (const n of net.nodes) {
      const d = (n.x - cloud.x) ** 2 + (n.y - cloud.y) ** 2 + (n.z - cloud.z) ** 2;
      if (d > reach * reach) continue;
      touched = true;                          // in contact with the colony
      if (!n.infected && d < best) { best = d; hit = n; }
    }
    if (hit && rng() < t.contactChance) {
      hit.infected = true;
      infectAround(net, hit, t.contactChunk, 1, rng);
    }
    if (touched) cloud.dying = true;           // reached you — now it fades out
  }

  // Internal spread — the rot races along the filaments from the whole front.
  const front = [];
  for (const n of net.nodes) if (n.infected) front.push(n);
  for (const n of front) infectAround(net, n, t.spreadDepthPerTurn, t.infectionSpreadChance, rng);
}

// Flood infection outward from `seed` up to `depth` rings along the graph.
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

export function totalTrichoderma(substrate) {
  let total = 0;
  for (const cell of substrate.cells) total += cell.trich;
  return total;
}
