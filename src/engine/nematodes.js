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
  const targeted = new Set();   // node ids a worm is already HEADING for this tick (fan-out)
  const newborns = [];

  for (const w of state.nematodes) {
    // Stuck by a fresh excretion — no move / feed / breed this tick.
    if (w.stuck > 0) { w.stuck -= 1; w.feeding = false; continue; }
    w.feeding = false;

    // Each worm heads for the nearest strand it can SEE (clear LOS) that NO other worm
    // has already picked this tick — so the swarm FANS OUT across the colony instead of
    // piling onto one node. If every visible strand is already taken (more worms than
    // strands in sight), fall back to the plain nearest so it still closes in. (Eating
    // below independently claims a DISTINCT strand, so consumption still scales.)
    let seen = nearestVisibleNode(sub, nodes, w, n.sightRadius, targeted);
    if (!seen) seen = nearestVisibleNode(sub, nodes, w, n.sightRadius, null);
    if (seen) targeted.add(seen.id);
    w.targetId = seen ? seen.id : null;
    w.sees = !!seen;                                    // searching vs locked-on (sight overlay)

    if (seen) {
      const dx = seen.x - w.x, dy = seen.y - w.y;
      const dist = Math.hypot(dx, dy) || 1;
      w.heading = Math.atan2(dy, dx);
      if (dist <= n.reach * cs) {
        w.feeding = true;
        // Breed EVERY tick while in contact — this is the exponential growth.
        if (state.nematodes.length + newborns.length < n.maxPopulation && rng.chance(n.breedChance)) {
          let bx = w.x + rng.range(-cs * 0.3, cs * 0.3), by = w.y + rng.range(-cs * 0.3, cs * 0.3);
          const bc = sub.cellAtWorld(bx, by);
          if (!bc || bc.rock) { bx = w.x; by = w.y; }   // never spawn a newborn inside rock — fall back to the parent's clear cell
          newborns.push(makeWorm(bx, by, rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)));
        }
        // Eat a DISTINCT strand whole on a cooldown (one worm per strand/tick).
        if (w.feedCd <= 0) {
          const bite = claimed.has(seen.id) ? nearestVisibleNode(sub, nodes, w, n.sightRadius, claimed) : seen;
          if (bite && Math.hypot(bite.x - w.x, bite.y - w.y) <= n.reach * cs) {
            const bcell = sub.cellAtWorld(bite.x, bite.y);
            if (!(bcell && bcell.hardened > 0)) { claimed.add(bite.id); w.feedCd = n.eatEveryTicks; }   // Sclerotial Crust: hardened strands can't be eaten (timed)
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
    if (d < bestD && sub.segmentClear(w.x, w.y, node.x, node.y)) { bestD = d; best = node; }
  }
  return best;
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
