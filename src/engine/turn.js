// =============================================================================
// World tick (A2, B4).
//
// This game mode has no turn/move budget — the player just performs actions one
// after another, and the WHOLE world advances one step after each. tickWorld()
// is that single step: the threats act (Trichoderma creep + eat, ants harvest +
// reroute, nematodes crawl + feed), then each network draws passive income from
// the substrate it has colonised, ages, the rot spreads, starvation bites, and
// the death check runs. Called from performAction() after every successful action.
//
// Phase 1 plays a single active network, but the tick iterates the whole network
// list so the generational/autonomous-tick system (A5) drops in later.
// =============================================================================

import { infectNetwork, spreadTrichoderma, checkPuzzleGoal } from './threats.js';
import { stepAnts } from './ants.js';
import { stepNematodes } from './nematodes.js';
import { produceCardEngines, checkGoalReached, checkPileRewards } from './cards.js';

export function tickWorld(state) {
  if (state.runOver) return;

  const { config, substrate } = state;

  // The threats all act on every step.
  spreadTrichoderma(state);   // clouds creep toward food/you and devour what they pass
  stepAnts(state);            // ants harvest their target food, RETARGET when it empties, re-stamp trails
  stepNematodes(state);       // worms crawl in, eat strands whole, and multiply
  resolveTraps(state);        // Constricting Ring traps digest a worm that wandered in
  // Age reinfection wards (Suberin Wall) down one step per round.
  for (const cell of substrate.cells) if (cell.mouldProof > 0) cell.mouldProof -= 1;

  for (const net of state.networks) {
    if (!net.alive) continue;

    // 1) Passive income from occupied substrate (depletes those patches).
    resolveIncome(net, substrate, config);

    // 1b) Age the strands so the colony visibly thickens over time.
    net.agePass();

    // 1c) The rot races further along the filaments.
    infectNetwork(net, state);

    // 2) Starvation if the colony is out of Energy (prunes strands).
    if (net.energy <= 0) {
      net.energy = 0;
      net.applyStarvation();
      net.pruneDead();
    }

    // 3) Recompute % healthy. Dead when no healthy strands remain (fully
    //    overrun by mould) or nothing is left (e.g. starved out this step).
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

  // Card layer (only when active): installed engines produce, then the goal /
  // card-dry checks run. Guarded on state.cards so the plain sim is untouched.
  if (state.cards) {
    produceCardEngines(state);
    checkPileRewards(state);   // a finished map pile grants a card draft
    checkGoalReached(state);
  }

  checkPuzzleGoal(state);
  state.turn += 1;   // a step counter (each action advances the world one step)
}

// Constricting Ring traps: a one-shot snare on empty ground. When any nematode
// wanders within a trap's radius it's digested (removed) for a Phosphorus reward,
// and the trap is spent. Runs after the worms have moved this step.
function resolveTraps(state) {
  const traps = state.traps;
  if (!traps || !traps.length) return;
  const worms = state.nematodes;
  if (!worms || !worms.length) return;
  const net = state.active, cap = state.config.cards.softCapPhosphorus;
  for (let i = traps.length - 1; i >= 0; i--) {
    const tr = traps[i];
    const wi = worms.findIndex((w) => (w.x - tr.x) ** 2 + (w.y - tr.y) ** 2 <= tr.r * tr.r);
    if (wi < 0) continue;
    worms.splice(wi, 1);
    const r = tr.reward || 2;
    if (net) net.phosphorus = Math.max(net.phosphorus, Math.min(cap, net.phosphorus + r));   // never drop below current
    traps.splice(i, 1);
    state.log(`A constricting trap digested a nematode: +${r} Phosphorus.`, 'good');
  }
}

// Draw nutrient from every COLONISED food cell, plus the baseline trickle.
// (Growing into a pile claims the WHOLE pile — colonised=1 on every cell — so a
// pile you've reached digests fully, even far cells no strand physically sits in.)
function resolveIncome(net, substrate, config) {
  const e = config.energy;
  net.collectOccupiedCells(substrate);   // refresh cell.held (Trichoderma resistance)
  let nutrientDrawn = 0;
  for (const cell of substrate.cells) {
    if (cell.colonized <= 0 || cell.nutrient <= 0 || cell.hazard) continue;
    const take = Math.min(cell.nutrient, e.passiveIncomeRate) * cell.colonized;
    cell.nutrient -= take;
    nutrientDrawn += take;
  }
  const income = nutrientDrawn * e.incomeEfficiency + e.baselineTrickle;
  net.energy += income;
  return income;
}
