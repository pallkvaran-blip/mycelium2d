// =============================================================================
// Nematodes — fungivorous worms (3D port).
//
// A few worms wander the volume until a strand enters their SIGHT (a radius,
// with ROCK BLOCKING LINE OF SIGHT). Then they crawl in FAST, eat strands
// WHOLE on contact, and MULTIPLY as they feed — an ignored swarm snowballs.
// Countered by the Excrete action: sticky mucus that hits every worm within
// range of ANY strand (killHits hits kills one).
//
// Renderer-agnostic and importless (operates on the passed substrate / network /
// state objects).
// =============================================================================

function makeWorm(x, y, z, heading, phase) {
  return { x, y, z, heading, phase, hits: 0, stuck: 0, feeding: false, feedCd: 0, sees: false };
}

function randomDir(rng) {
  const th = rng.range(0, Math.PI * 2);
  const cph = rng.range(-1, 1), sph = Math.sqrt(Math.max(0, 1 - cph * cph));
  return { x: Math.cos(th) * sph, y: cph, z: Math.sin(th) * sph };
}

// Seed wandering worms in open ground, a good way from the colony.
export function seedNematodes(substrate, config, rng, network) {
  const n = config.nematodes;
  const root = network && network.root ? network.root : null;
  const worms = [];
  for (let i = 0; i < (n.initialCount || 0); i++) {
    const spot = openSpot(substrate, rng, root, n.seedMinColonyDistFrac);
    worms.push(makeWorm(spot.x, spot.y, spot.z, randomDir(rng), rng.range(0, Math.PI * 2)));
  }
  return worms;
}

// Dev cheat / spawn hook: drop a worm at a world point.
export function spawnNematodeAt(state, x, y, z) {
  if (!state.nematodes) state.nematodes = [];
  const rng = state.rng;
  const w = makeWorm(x, y, z, rng ? randomDir(rng) : { x: 1, y: 0, z: 0 }, rng ? rng.range(0, Math.PI * 2) : 0);
  state.nematodes.push(w);
  return w;
}

// --- Per-step update -----------------------------------------------------------
// Each worm: if stuck, sit out the step. Otherwise acquire the nearest strand
// in sight with clear LOS; crawl to it; on contact feed (eat a strand whole on
// a cooldown) and multiply. Eaten strands are removed in one batch at the end.
export function stepNematodes(state) {
  const { config, substrate: sub, rng } = state;
  const n = config.nematodes;
  if (!state.nematodes) state.nematodes = [];
  const net = state.active;
  const cs = sub.cellSize;
  const nodes = net && net.alive ? net.nodes : [];
  const claimed = new Set();    // node ids eaten this step (one worm per strand)
  const newborns = [];

  for (const w of state.nematodes) {
    // Stuck by a fresh excretion — no move / feed / breed this step.
    if (w.stuck > 0) { w.stuck -= 1; w.feeding = false; continue; }
    w.feeding = false;

    const seen = nearestVisibleNode(sub, nodes, w, n.sightRadius, null);
    w.sees = !!seen;

    if (seen) {
      const dx = seen.x - w.x, dy = seen.y - w.y, dz = seen.z - w.z;
      const dist = Math.hypot(dx, dy, dz) || 1;
      w.heading = { x: dx / dist, y: dy / dist, z: dz / dist };
      if (dist <= n.reach * cs) {
        w.feeding = true;
        // Breed EVERY step while in contact — this is the exponential growth.
        if (state.nematodes.length + newborns.length < n.maxPopulation && rng.chance(n.breedChance)) {
          let bx = w.x + rng.range(-cs * 0.3, cs * 0.3);
          let by = w.y + rng.range(-cs * 0.3, cs * 0.3);
          let bz = w.z + rng.range(-cs * 0.3, cs * 0.3);
          const bc = sub.cellAtWorld(bx, by, bz);
          if (!bc || bc.rock) { bx = w.x; by = w.y; bz = w.z; }   // never spawn inside rock
          newborns.push(makeWorm(bx, by, bz, randomDir(rng), rng.range(0, Math.PI * 2)));
        }
        // Eat a DISTINCT strand whole on a cooldown (one worm per strand/step).
        if (w.feedCd <= 0) {
          const bite = claimed.has(seen.id) ? nearestVisibleNode(sub, nodes, w, n.sightRadius, claimed) : seen;
          if (bite && Math.hypot(bite.x - w.x, bite.y - w.y, bite.z - w.z) <= n.reach * cs) {
            claimed.add(bite.id); w.feedCd = n.eatEveryTicks;
          }
        } else w.feedCd -= 1;
      } else {
        moveWorm(w, w.heading.x, w.heading.y, w.heading.z, Math.min(dist, n.crawlSpeed * cs), sub);
      }
    } else {
      // Nothing seen — wander; turn away when rock / the edge blocks it.
      w.heading.x += rng.range(-0.5, 0.5);
      w.heading.y += rng.range(-0.5, 0.5) * 0.5;
      w.heading.z += rng.range(-0.5, 0.5);
      const l = Math.hypot(w.heading.x, w.heading.y, w.heading.z) || 1;
      w.heading.x /= l; w.heading.y /= l; w.heading.z /= l;
      const moved = moveWorm(w, w.heading.x, w.heading.y, w.heading.z, n.wanderSpeed * cs, sub);
      if (!moved) w.heading = randomDir(rng);
    }
  }

  if (newborns.length) for (const b of newborns) state.nematodes.push(b);
  if (claimed.size && net) net._removeNodes(claimed);

  // Keep a baseline of wanderers trickling in (up to initialCount), capped.
  if (state.nematodes.length < n.initialCount && state.nematodes.length < n.maxPopulation && rng.chance(n.respawnChance)) {
    const spot = openSpot(sub, rng, net && net.root, n.seedMinColonyDistFrac);
    state.nematodes.push(makeWorm(spot.x, spot.y, spot.z, randomDir(rng), rng.range(0, Math.PI * 2)));
  }
}

// --- Excrete (the defence) ------------------------------------------------------
// Sticky mucus: every worm within `range` of ANY strand takes 1 hit and is
// stuck for stickTurns; a worm at killHits dies. Returns {hit, killed}.
export function excrete(state) {
  const cfg = state.config.actions.excrete;
  const n = state.config.nematodes;
  const net = state.active;
  if (!state.nematodes || !state.nematodes.length) return { hit: 0, killed: 0 };
  const nodes = net ? net.nodes : [];
  const r2 = cfg.range * cfg.range;
  let hit = 0, killed = 0;
  const survivors = [];
  for (const w of state.nematodes) {
    let inRange = false;
    for (const node of nodes) {
      const dx = node.x - w.x, dy = node.y - w.y, dz = node.z - w.z;
      if (dx * dx + dy * dy + dz * dz <= r2) { inRange = true; break; }
    }
    if (inRange) {
      w.hits += 1;
      w.stuck = Math.max(w.stuck, cfg.stickTurns);
      hit++;
      if (w.hits >= n.killHits) { killed++; continue; }   // dead — drop it
    }
    survivors.push(w);
  }
  state.nematodes = survivors;
  return { hit, killed };
}

// --- internals -------------------------------------------------------------------

// Nearest strand within sight that has CLEAR LINE OF SIGHT (rock blocks it),
// skipping nodes already claimed for eating this step.
function nearestVisibleNode(sub, nodes, w, sight, claimed) {
  let best = null, bestD = sight * sight;
  for (const node of nodes) {
    if (claimed && claimed.has(node.id)) continue;
    const dx = node.x - w.x, dy = node.y - w.y, dz = node.z - w.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD && losClear(sub, w.x, w.y, w.z, node.x, node.y, node.z)) { bestD = d; best = node; }
  }
  return best;
}

// True if no rock voxel lies on the segment (sampled). Rock blocks sight.
function losClear(sub, x0, y0, z0, x1, y1, z1) {
  const cs = sub.cellSize;
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / (cs * 0.5)));
  for (let i = 1; i <= steps; i++) {
    const x = x0 + dx * (i / steps), y = y0 + dy * (i / steps), z = z0 + dz * (i / steps);
    const c = sub.cellAtWorld(x, y, z);
    if (c && c.rock) return false;
  }
  return true;
}

// Move a worm by (ux,uy,uz)*s, never THROUGH rock or out of bounds; the whole
// path is checked, and a blocked straight move slides along x, z, then y.
function moveWorm(w, ux, uy, uz, s, sub) {
  const cs = sub.cellSize;
  const minX = cs, maxX = sub.worldWidth - cs;
  const minY = -(sub.worldDepth - cs), maxY = -cs;
  const minZ = cs, maxZ = sub.worldBreadth - cs;
  const clear = (x1, y1, z1) => {
    const dx = x1 - w.x, dy = y1 - w.y, dz = z1 - w.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / (cs * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const x = w.x + dx * (i / steps), y = w.y + dy * (i / steps), z = w.z + dz * (i / steps);
      if (x < minX || x > maxX || y < minY || y > maxY || z < minZ || z > maxZ) return false;
      const c = sub.cellAtWorld(x, y, z);
      if (c && c.rock) return false;
    }
    return true;
  };
  const fx = w.x + ux * s, fy = w.y + uy * s, fz = w.z + uz * s;
  if (clear(fx, fy, fz)) { w.x = fx; w.y = fy; w.z = fz; return true; }
  if (ux !== 0 && clear(fx, w.y, w.z)) { w.x = fx; return true; }
  if (uz !== 0 && clear(w.x, w.y, fz)) { w.z = fz; return true; }
  if (uy !== 0 && clear(w.x, fy, w.z)) { w.y = fy; return true; }
  return false;
}

// Pick an open underground spot — not in rock and (ideally) far from the colony.
function openSpot(sub, rng, root, minFrac) {
  const minDist = sub.worldWidth * (minFrac || 0);
  let fallback = null;
  for (let t = 0; t < 60; t++) {
    const x = rng.range(sub.cellSize, sub.worldWidth - sub.cellSize);
    const y = -rng.range(sub.cellSize, (sub.lays - 1) * sub.cellSize);
    const z = rng.range(sub.cellSize, sub.worldBreadth - sub.cellSize);
    const cell = sub.cellAtWorld(x, y, z);
    if (!cell || cell.rock) continue;
    fallback = { x, y, z };
    if (!root || Math.hypot(x - root.x, y - root.y, z - root.z) >= minDist) return { x, y, z };
  }
  return fallback || { x: sub.worldWidth / 2, y: -sub.cellSize * 3, z: sub.worldBreadth / 2 };
}

export function totalNematodes(state) {
  return (state.nematodes || []).length;
}
