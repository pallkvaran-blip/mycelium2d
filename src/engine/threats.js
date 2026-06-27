// =============================================================================
// Threats — Trichoderma, the one Phase 1 threat (A2/A5, B6).
//
// Trichoderma is a competing mold. It lives as an intensity field on substrate
// cells (cell.trich, 0..1). It spreads toward food, damages network parts it
// touches, and avoids firmly-held ground. It is countered by:
//   - Amputate  (cut off infected strands)            -> network.amputate*
//   - Express -> Antifungal (slows & damages the mold) -> traits.antifungal
//   - Express -> Melanize  (reduces the damage it deals)-> traits.melanize
//
// Renderer-agnostic: operates only on substrate cells + the Network object.
// =============================================================================

// Seed initial mold patches at map generation, biased toward food clusters so
// that the richest substrate is also the most contested (B6 tension).
export function seedTrichoderma(substrate, config, rng) {
  const t = config.trichoderma;
  // Candidate centres: prefer food-rich, non-hazard cells.
  const candidates = [];
  substrate.forEachCell((cell, col, row) => {
    if (!cell.hazard && cell.nutrient > 0) candidates.push({ col, row, w: cell.nutrient });
  });
  for (let i = 0; i < t.initialPatches; i++) {
    let col, row;
    if (candidates.length && rng.chance(t.seedFoodBias)) {
      const c = rng.pick(candidates);
      // nudge a little off the food so it has somewhere to grow into
      col = c.col + rng.int(-2, 2);
      row = c.row + rng.int(-2, 2);
    } else {
      col = rng.int(1, substrate.cols - 2);
      row = rng.int(1, substrate.rows - 2);
    }
    const radius = rng.int(t.patchRadiusMin, t.patchRadiusMax);
    stampTrich(substrate, col, row, radius);
  }
}

// Dev cheat / Add-substrate-near hook: spawn a mold patch at a world point.
export function spawnTrichodermaAt(substrate, x, y, config, rng) {
  const t = config.trichoderma;
  const col = substrate.colAtX(x), row = substrate.rowAtY(y);
  const radius = rng.int(t.patchRadiusMin, t.patchRadiusMax + 1);
  stampTrich(substrate, col, row, radius);
}

function stampTrich(substrate, cc, cr, radius) {
  for (let row = cr - radius; row <= cr + radius; row++) {
    for (let col = cc - radius; col <= cc + radius; col++) {
      if (!substrate.inBounds(col, row)) continue;
      const dist = Math.hypot(col - cc, row - cr);
      if (dist > radius) continue;
      const cell = substrate.cells[substrate.index(col, row)];
      if (cell.hazard) continue;
      cell.trich = Math.min(1, Math.max(cell.trich, 1 - dist / (radius + 0.5)));
    }
  }
}

// --- Per-turn spread (B6) ---------------------------------------------------
// Snapshot current intensities, accumulate deltas, then apply — so a cell
// infected this turn doesn't cascade-spread within the same turn.
export function spreadTrichoderma(substrate, network, config, rng) {
  const t = config.trichoderma;
  const cols = substrate.cols, rows = substrate.rows;
  const snapshot = new Float32Array(substrate.cells.length);
  for (let i = 0; i < substrate.cells.length; i++) snapshot[i] = substrate.cells[i].trich;
  const delta = new Float32Array(substrate.cells.length);

  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = substrate.index(col, row);
      const intensity = snapshot[idx];
      if (intensity <= 0) continue;
      const cell = substrate.cells[idx];

      // Small self-gain over food (so it persists on a pile), kept low.
      if (cell.nutrient > 0) {
        delta[idx] += t.intensityGainOnFood * intensity;
      }

      if (intensity < t.spreadThreshold) continue;

      for (const [dc, dr] of neighbors) {
        const nc = col + dc, nr = row + dr;
        if (!substrate.inBounds(nc, nr)) continue;
        const nidx = substrate.index(nc, nr);
        const ncell = substrate.cells[nidx];
        if (ncell.hazard || ncell.rock) continue;
        let amount = t.spreadRate * intensity * t.spreadBase;
        if (ncell.nutrient > 0) amount *= t.foodAttraction;  // creep toward food / your pockets
        amount *= rng.range(t.spreadJitterMin, t.spreadJitterMax);
        // Dense healthy network only SLOWS the creep in (it no longer blocks it,
        // so the mould can actually reach and infect you).
        if (ncell.held > 0) amount *= Math.max(0.15, 1 - t.heldResist * ncell.held);
        delta[nidx] += amount;
      }
    }
  }

  // Apply: decay everywhere (so mould fades on barren ground and stays a
  // creeping patch), then add the spread, clamped to [0, 1].
  for (let i = 0; i < substrate.cells.length; i++) {
    const cell = substrate.cells[i];
    cell.trich = Math.min(1, cell.trich * (1 - t.decayRate) + delta[i]);
    if (cell.trich < 0.02) cell.trich = 0;
  }

  // Ambient new outbreaks (off by default).
  if (t.spawnChancePerTurn > 0 && rng.chance(t.spawnChancePerTurn)) {
    spawnTrichodermaAt(
      substrate,
      rng.range(0, substrate.worldWidth),
      substrate.surfaceY + rng.range(0, substrate.rows * substrate.cellSize),
      config, rng,
    );
  }
}

// --- Per-turn network infection (B6) ----------------------------------------
// The mould overruns the colony: strands standing in mould get infected
// (green/dead), then the infection jumps along your filaments turning more
// green each turn. Melanize resists the INITIAL contact only; once it's inside,
// only Amputate (cutting the infected branch) stops it.
export function infectNetwork(network, substrate, config, rng) {
  const t = config.trichoderma;
  const melanize = network.traits.melanize || 0;
  const resist = Math.min(0.9, melanize * config.traits.melanize.contactResistPerLevel);

  // 1) Contact — a healthy strand standing in mould may be infected.
  for (const n of network.nodes) {
    if (n.infected) continue;
    const cell = substrate.cellAtWorld(n.x, n.y);
    if (cell && cell.trich >= t.contactThreshold) {
      if (rng() < t.contactChance * cell.trich * (1 - resist)) n.infected = true;
    }
  }

  // 2) Internal spread — infection jumps one ring along the filaments (from a
  //    snapshot of the current front, so it advances one step per turn).
  const front = [];
  for (const n of network.nodes) if (n.infected) front.push(n);
  for (const n of front) {
    if (n.parentId != null) {
      const p = network.byId.get(n.parentId);
      if (p && !p.infected && rng() < t.infectionSpreadChance) p.infected = true;
    }
    for (const cid of n.children) {
      const c = network.byId.get(cid);
      if (c && !c.infected && rng() < t.infectionSpreadChance) c.infected = true;
    }
  }
}

export function totalTrichoderma(substrate) {
  let total = 0;
  for (const cell of substrate.cells) total += cell.trich;
  return total;
}
