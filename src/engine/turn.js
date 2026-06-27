// =============================================================================
// Turn loop (A2, B4).
//
// Each turn the player has movesPerTurn moves. Actions spend moves + Energy
// during the turn (actions.js). End-turn resolves the world: passive income,
// Trichoderma spread + damage, hazard damage, starvation, node pruning and
// vitality.
//
// Phase 1 plays a single active network, but end-turn iterates the whole
// network list so the generational/autonomous-tick system (A5) drops in later.
// =============================================================================

import { spreadTrichoderma, applyTrichodermaDamage } from './threats.js';

export function endTurn(state) {
  if (state.runOver) return;

  const { config, substrate, rng } = state;
  let totalIncome = 0;

  for (const net of state.networks) {
    if (!net.alive) continue;

    // 1) Passive income from occupied substrate (depletes those patches).
    const income = resolveIncome(net, substrate, config);
    if (net.active) totalIncome = income;

    // 1b) Progressively colonise the substrate the network occupies, and age
    //     the strands so the colony visibly thickens over growth cycles.
    net.colonize(substrate);
    net.agePass();

    // 2) Threat: Trichoderma spreads, then damages contacted strands.
    spreadTrichoderma(substrate, net, config, rng);
    applyTrichodermaDamage(net, substrate, config);

    // 3) Hazard damage (and slow recovery for safe, healthy strands).
    net.applyHazardDamage(substrate);

    // 4) Starvation if the colony is out of Energy.
    if (net.energy <= 0) {
      net.energy = 0;
      net.applyStarvation();
    }

    // 5) Remove dead strands; recompute vitality.
    net.pruneDead();
    net.decayVitalityDip();
    net.recomputeVitality();

    if (!net.alive || net.nodes.length === 0) {
      net.alive = false;
      if (net.active && !state.runOver) {
        state.runOver = true;
        state.runResult = { spores: net.spores, bodies: 0, died: true };
        state.log('The network has died. Run over.', 'warn');
      }
    }
  }

  // 6) Advance the clock and refill moves.
  state.turn += 1;
  state.movesLeft = config.turn.movesPerTurn;

  if (!state.runOver) {
    const trickle = config.energy.baselineTrickle;
    state.log(
      `Turn ${state.turn}. Passive income +${Math.round(totalIncome)} Energy (incl. +${trickle} trickle).`,
      'turn',
    );
  }
}

// Draw nutrient from every occupied cell, plus the baseline trickle.
function resolveIncome(net, substrate, config) {
  const e = config.energy;
  const cells = net.collectOccupiedCells(substrate);
  let nutrientDrawn = 0;
  for (const cell of cells) {
    // You only digest substrate you've colonised — income ramps with the mat.
    const take = Math.min(cell.nutrient, e.passiveIncomeRate) * cell.colonized;
    cell.nutrient -= take;
    nutrientDrawn += take;
  }
  const income = nutrientDrawn * e.incomeEfficiency + e.baselineTrickle;
  net.energy += income;
  return income;
}
