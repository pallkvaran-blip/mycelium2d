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

import { infectNetwork, spreadTrichoderma } from './threats.js';

export function endTurn(state) {
  if (state.runOver) return;

  const { config, substrate } = state;
  let totalIncome = 0;

  // The mould also acts on end-turn: the clouds creep/eat once more, and the
  // infection keeps spreading — so ending your turn never freezes the threat.
  spreadTrichoderma(state);

  for (const net of state.networks) {
    if (!net.alive) continue;

    // 1) Passive income from occupied substrate (depletes those patches).
    const income = resolveIncome(net, substrate, config);
    if (net.active) totalIncome = income;

    // 1b) Age the strands so the colony visibly thickens over time.
    //     (Colonisation itself now happens per Grow cycle, not per turn.)
    net.agePass();

    // 1c) The rot races further along the filaments (also runs per action).
    infectNetwork(net, state);

    // 2) Starvation if the colony is out of Energy (prunes strands).
    if (net.energy <= 0) {
      net.energy = 0;
      net.applyStarvation();
      net.pruneDead();
    }

    // 3) Recompute % healthy. Dead when no healthy strands remain (fully
    //    overrun by mould) or nothing is left (e.g. starved out this turn).
    net.recomputeVitality();
    if (net.nodes.length === 0 || net.healthyCount() === 0) {
      net.alive = false;
      if (net.active && !state.runOver) {
        state.runOver = true;
        state.runResult = { spores: net.spores, bodies: 0, died: true };
        state.log('The colony has been consumed. Run over.', 'warn');
      }
    }
  }

  // Advance the clock and refill moves.
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
