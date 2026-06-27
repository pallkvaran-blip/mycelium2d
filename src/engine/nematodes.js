// =============================================================================
// Nematodes — fungivorous worms (the third threat).
//
// A few worms wander the soil until a strand enters their SIGHT (a radius, with
// ROCK BLOCKING LINE OF SIGHT). The moment they spot you they crawl in FAST —
// much quicker than the creeping mould — routing around rock. On contact they
// eat strands WHOLE and MULTIPLY as they feed, so an ignored swarm grows (and
// its consumption snowballs) exponentially. They are lethal if left unchecked.
//
// Your answer is the Excrete action: a sticky secretion that hits every worm
// within range of ANY of your strands — 1 hit + it sticks them fast (no move /
// feed / breed that tick); killHits hits kills one. Amputate does nothing here.
//
// Renderer-agnostic and importless (operates on the passed substrate / network /
// state objects) so there's no circular-import risk in the bundle.
// =============================================================================

function makeWorm(x, y, heading, phase) {
  return { x, y, heading, phase, hits: 0, stuck: 0, feeding: false, feedCd: 0 };
}

// Seed wandering worms in open soil, a good way from the colony so they have to
// crawl in once they sense you. Returns the worm list (stored on state.nematodes).
export function seedNematodes(substrate, config, rng, network) {
  const n = config.nematodes;
  const root = network && network.root ? network.root : null;
  const worms = [];
  for (let i = 0; i < (n.initialCount || 0); i++) {
    const spot = openSpot(substrate, rng, root, n.seedMinColonyDistFrac);
    worms.push(makeWorm(spot.x, spot.y, rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)));
  }
  return worms;
}

// Dev cheat / spawn hook: drop a worm at a world point.
export function spawnNematodeAt(state, x, y) {
  if (!state.nematodes) state.nematodes = [];
  const rng = state.rng;
  const w = makeWorm(x, y, rng ? rng.range(0, Math.PI * 2) : 0, rng ? rng.range(0, Math.PI * 2) : 0);
  state.nematodes.push(w);
  return w;
}

// --- Per-tick step (per action AND end-turn) --------------------------------
// Each worm: if stuck, sit out the tick. Otherwise acquire the nearest strand
// in sight with clear LOS; crawl to it; on contact feed (eat a strand whole on a
// cooldown) and multiply. Eaten strands are removed in one batch at the end.
export function stepNematodes(state) {
  const { config, substrate: sub, rng } = state;
  const n = config.nematodes;
  if (!state.nematodes) state.nematodes = [];
  const net = state.active;
  const cs = sub.cellSize;
  const nodes = net && net.alive ? net.nodes : [];
  const claimed = new Set();    // node ids eaten this tick (one worm per strand)
  const newborns = [];

  for (const w of state.nematodes) {
    // Stuck by a fresh excretion — no move / feed / breed this tick.
    if (w.stuck > 0) { w.stuck -= 1; w.feeding = false; continue; }
    w.feeding = false;

    // Movement/feeding target is the nearest strand it can SEE (clear LOS),
    // regardless of whether another worm is already eating it. (Eating below
    // claims a DISTINCT strand — so the swarm's CONSUMPTION scales with its
    // size, but BREEDING isn't throttled by how many strands are in reach.)
    const seen = nearestVisibleNode(sub, nodes, w, n.sightRadius, null);
    recordVision(sub, nodes, w, n.sightRadius, seen);   // cache for the debug overlay

    if (seen) {
      const dx = seen.x - w.x, dy = seen.y - w.y;
      const dist = Math.hypot(dx, dy) || 1;
      w.heading = Math.atan2(dy, dx);
      if (dist <= n.reach * cs) {
        w.feeding = true;
        // Breed EVERY tick while in contact — this is the exponential growth.
        if (state.nematodes.length + newborns.length < n.maxPopulation && rng.chance(n.breedChance)) {
          newborns.push(makeWorm(
            w.x + rng.range(-cs * 0.3, cs * 0.3), w.y + rng.range(-cs * 0.3, cs * 0.3),
            rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)));
        }
        // Eat a DISTINCT strand whole on a cooldown (one worm per strand/tick).
        if (w.feedCd <= 0) {
          const bite = claimed.has(seen.id) ? nearestVisibleNode(sub, nodes, w, n.sightRadius, claimed) : seen;
          if (bite && Math.hypot(bite.x - w.x, bite.y - w.y) <= n.reach * cs) {
            claimed.add(bite.id); w.feedCd = n.eatEveryTicks;
          }
        } else w.feedCd -= 1;
      } else {
        moveWorm(w, dx / dist, dy / dist, Math.min(dist, n.crawlSpeed * cs), sub);
      }
    } else {
      // Nothing seen — wander; turn away when rock / the edge blocks it.
      w.heading += rng.range(-0.5, 0.5);
      const moved = moveWorm(w, Math.cos(w.heading), Math.sin(w.heading), n.wanderSpeed * cs, sub);
      if (!moved) w.heading += rng.range(2, 4);
    }
  }

  if (newborns.length) for (const b of newborns) state.nematodes.push(b);
  if (claimed.size && net) net._removeNodes(claimed);

  // Keep a baseline of wanderers trickling in (up to initialCount), capped.
  if (state.nematodes.length < n.initialCount && state.nematodes.length < n.maxPopulation && rng.chance(n.respawnChance)) {
    const spot = openSpot(sub, rng, net && net.root, n.seedMinColonyDistFrac);
    state.nematodes.push(makeWorm(spot.x, spot.y, rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)));
  }
}

// --- Excrete (the defence) --------------------------------------------------
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
      const dx = node.x - w.x, dy = node.y - w.y;
      if (dx * dx + dy * dy <= r2) { inRange = true; break; }
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

// --- internals --------------------------------------------------------------

// Nearest strand within sight that has CLEAR LINE OF SIGHT (rock blocks it),
// skipping nodes already claimed for eating this tick. LOS is only tested on a
// distance improvement, to keep the cost down.
function nearestVisibleNode(sub, nodes, w, sight, claimed) {
  let best = null, bestD = sight * sight;
  for (const node of nodes) {
    if (claimed && claimed.has(node.id)) continue;
    const dx = node.x - w.x, dy = node.y - w.y, d = dx * dx + dy * dy;
    if (d < bestD && losClear(sub, w.x, w.y, node.x, node.y)) { bestD = d; best = node; }
  }
  return best;
}

// Cache what this worm currently sees (for the debug vision overlay): the strand
// it has clear LOS to, and — if its nearest strand is hidden behind rock — that
// strand plus the point on the way where the rock blocks the view.
function recordVision(sub, nodes, w, sight, seen) {
  w.seeX = seen ? seen.x : null;
  w.seeY = seen ? seen.y : null;
  w.blindX = null; w.blindY = null; w.blockX = null; w.blockY = null;
  // Nearest strand in range ignoring LOS — if it isn't the one we can see, the
  // view to it is blocked; find where the ray first hits rock.
  let nearAny = null, best = sight * sight;
  for (const node of nodes) {
    const dx = node.x - w.x, dy = node.y - w.y, d = dx * dx + dy * dy;
    if (d < best) { best = d; nearAny = node; }
  }
  if (nearAny && (!seen || nearAny.id !== seen.id)) {
    w.blindX = nearAny.x; w.blindY = nearAny.y;
    const cs = sub.cellSize;
    const dx = nearAny.x - w.x, dy = nearAny.y - w.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cs * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const x = w.x + dx * (i / steps), y = w.y + dy * (i / steps);
      const c = sub.cellAtWorld(x, y);
      if (c && c.rock) { w.blockX = x; w.blockY = y; break; }
    }
  }
}

// True if no rock cell lies on the segment (sampled). Rock blocks line of sight.
function losClear(sub, x0, y0, x1, y1) {
  const cs = sub.cellSize;
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cs * 0.5)));
  for (let i = 1; i <= steps; i++) {
    const x = x0 + dx * (i / steps), y = y0 + dy * (i / steps);
    const c = sub.cellAtWorld(x, y);
    if (c && c.rock) return false;
  }
  return true;
}

// Move a worm by (ux,uy)*s, never THROUGH rock or out of bounds; the whole path
// is checked, and a blocked straight move slides along x then y (rounds rock).
function moveWorm(w, ux, uy, s, sub) {
  const cs = sub.cellSize;
  const minX = cs, maxX = sub.worldWidth - cs;
  const minY = sub.surfaceY + cs, maxY = sub.worldHeight - cs;
  const clear = (x1, y1) => {
    const dx = x1 - w.x, dy = y1 - w.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cs * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const x = w.x + dx * (i / steps), y = w.y + dy * (i / steps);
      if (x < minX || x > maxX || y < minY || y > maxY) return false;
      const c = sub.cellAtWorld(x, y);
      if (c && c.rock) return false;
    }
    return true;
  };
  const fx = w.x + ux * s, fy = w.y + uy * s;
  if (clear(fx, fy)) { w.x = fx; w.y = fy; return true; }
  if (ux !== 0 && clear(fx, w.y)) { w.x = fx; return true; }
  if (uy !== 0 && clear(w.x, fy)) { w.y = fy; return true; }
  return false;
}

// Pick an open underground spot — not in rock and (ideally) a good way from the
// colony — so a worm has a clear journey in.
function openSpot(sub, rng, root, minFrac) {
  const minDist = sub.worldWidth * (minFrac || 0);
  let fallback = null;
  for (let t = 0; t < 40; t++) {
    const x = rng.range(sub.cellSize, sub.worldWidth - sub.cellSize);
    const y = sub.surfaceY + rng.range(sub.cellSize, (sub.rows - 1) * sub.cellSize);
    const cell = sub.cellAtWorld(x, y);
    if (!cell || cell.rock) continue;
    fallback = { x, y };
    if (!root || Math.hypot(x - root.x, y - root.y) >= minDist) return { x, y };
  }
  return fallback || { x: sub.worldWidth / 2, y: sub.surfaceY + sub.cellSize * 3 };
}

export function totalNematodes(state) {
  return (state.nematodes || []).length;
}
