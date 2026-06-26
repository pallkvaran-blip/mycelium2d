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
    if (candidates.length && rng.chance(0.75)) {
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
  const antifungal = network ? network.traits.antifungal : 0;
  const slow = Math.max(0, 1 - antifungal * config.traits.antifungal.slowPerLevel);
  const afDamage = antifungal * config.traits.antifungal.damagePerLevel;

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

      // Intensity self-gain over food (it eats substrate), capped.
      if (cell.nutrient > 0) {
        delta[idx] += t.intensityGainOnFood * intensity;
      }

      if (intensity < t.spreadThreshold) continue;

      for (const [dc, dr] of neighbors) {
        const nc = col + dc, nr = row + dr;
        if (!substrate.inBounds(nc, nr)) continue;
        const nidx = substrate.index(nc, nr);
        const ncell = substrate.cells[nidx];
        if (ncell.hazard) continue;
        // Firmly-held ground resists infection.
        if (ncell.held > t.avoidHeldThreshold) continue;
        let amount = t.spreadRate * slow * intensity * 0.25;
        if (ncell.nutrient > 0) amount *= t.foodAttraction;
        // A little randomness so the front is organic, not a perfect square.
        amount *= rng.range(0.6, 1.0);
        // Held-but-not-firm ground partially resists, scaled by how held it is.
        if (ncell.held > 0) amount *= Math.max(0.1, 1 - ncell.held);
        delta[nidx] += amount;
      }
    }
  }

  // Apply spread, then antifungal pushback where the network is present.
  for (let i = 0; i < substrate.cells.length; i++) {
    const cell = substrate.cells[i];
    if (delta[i] > 0) cell.trich = Math.min(1, cell.trich + delta[i]);
    // Antifungal damages mold on/near held ground.
    if (afDamage > 0 && cell.held > 0 && cell.trich > 0) {
      cell.trich = Math.max(0, cell.trich - afDamage);
    }
    if (cell.trich < 0.01) cell.trich = 0;
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

// --- Per-turn damage to the network (B6) ------------------------------------
export function applyTrichodermaDamage(network, substrate, config) {
  const t = config.trichoderma;
  const melaninRed = network.traits.melanize * config.traits.melanize.damageReductionPerLevel;
  const dmgMul = Math.max(0, 1 - melaninRed);
  for (const n of network.nodes) {
    const cell = substrate.cellAtWorld(n.x, n.y);
    if (cell && cell.trich > 0) {
      n.health -= t.contactDamage * cell.trich * dmgMul;
    }
  }
}

export function totalTrichoderma(substrate) {
  let total = 0;
  for (const cell of substrate.cells) total += cell.trich;
  return total;
}
