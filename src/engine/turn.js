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
  if (state.runOver || state.winPending) return;   // goal reached, waiting on the final draft

  const { config, substrate } = state;

  // The threats all act on every step.
  spreadTrichoderma(state);   // clouds creep toward food/you and devour what they pass
  stepAnts(state);            // ants harvest their target food, RETARGET when it empties, re-stamp trails
  // Snapshot worm positions BEFORE they move so a trap can test the swept path
  // (a fast worm can step clear across a trap's radius between ticks otherwise).
  const wormPrev = new Map();
  for (const w of (state.nematodes || [])) wormPrev.set(w, { x: w.x, y: w.y });
  stepNematodes(state);       // worms crawl in, eat strands whole, and multiply
  resolveTraps(state, wormPrev);   // Constricting Ring traps digest a worm that crossed one

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
        // Cause split for telemetry: no Energy left = out of energy; otherwise the mould
        // (Trichoderma) rotted every healthy strand.
        state.runResult = { spores: net.spores, bodies: 0, died: true, cause: net.energy <= 0 ? 'energy' : 'infected' };
        state.log('The colony has been consumed. Run over.', 'warn');
      }
    }
  }

  // Defeat can also arrive from OUTSIDE the network loop: worms (stepNematodes) or
  // ants eat the LAST strand BEFORE the loop runs, which flips net.alive = false, so
  // `if (!net.alive) continue` above skips the death block and the run never ends.
  // Catch a wiped ACTIVE colony here so being devoured always ends the run with a message.
  const act = state.active;
  if (act && act.active && !state.runOver && (act.nodes.length === 0 || act.healthyCount() === 0)) {
    act.alive = false;
    state.runOver = true;
    state.runResult = { spores: act.spores, bodies: 0, died: true, cause: 'devoured' };   // worms/ants ate the last strand
    state.log('The colony has been devoured — every strand is gone. Run over.', 'warn');
  }

  // Age the timed defense wards AFTER the threats have acted this tick, so a ward
  // set to N protects for N full rounds (check-then-age):
  //   • mouldProof   — infection immunity (Melanized Wall, Crust Reserve, Sclerotial Crust/Rind)
  //   • hardened     — eating immunity vs worms/ants (Sclerotial Crust/Rind)
  //   • reinfectGrace — Rehydration Pulse's hidden 1-round anti-reinfection window
  for (const cell of substrate.cells) {
    if (cell.mouldProof > 0) cell.mouldProof -= 1;
    if (cell.hardened > 0) cell.hardened -= 1;
    if (cell.reinfectGrace > 0) cell.reinfectGrace -= 1;
  }

  // Card layer (only when active): installed engines produce, then the goal /
  // card-dry checks run. Guarded on state.cards so the plain sim is untouched.
  if (state.cards) {
    produceCardEngines(state);
    checkPileRewards(state);     // a finished map pile grants a card draft (red pile → engine)
    checkGoalReached(state);
  }

  checkPuzzleGoal(state);
  state.turn += 1;   // a step counter (each action advances the world one step)
}

// Constricting Ring traps: a one-shot snare on empty ground. When any nematode
// wanders within a trap's radius it's digested (removed) for a Phosphorus reward,
// and the trap is spent. Runs after the worms have moved this step.
function resolveTraps(state, wormPrev) {
  const traps = state.traps;
  if (!traps || !traps.length) return;
  const worms = state.nematodes;
  if (!worms || !worms.length) return;
  const net = state.active, cap = state.config.cards.softCapPhosphorus;
  // Squared distance from a trap centre to the worm's swept path this tick (its
  // previous → current position), so a worm that crossed the radius is still caught.
  const sweptD2 = (w, tr) => {
    const p = wormPrev && wormPrev.get(w);
    if (!p) return (w.x - tr.x) ** 2 + (w.y - tr.y) ** 2;
    const vx = w.x - p.x, vy = w.y - p.y, len2 = vx * vx + vy * vy;
    let t = len2 ? ((tr.x - p.x) * vx + (tr.y - p.y) * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = p.x + vx * t, cy = p.y + vy * t;
    return (cx - tr.x) ** 2 + (cy - tr.y) ** 2;
  };
  for (let i = traps.length - 1; i >= 0; i--) {
    const tr = traps[i];
    const wi = worms.findIndex((w) => sweptD2(w, tr) <= tr.r * tr.r);
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
  // Nutrient drains at the SAME rate as before (so attraction / threat-eating /
  // colonisation timing are unchanged) — only the Energy per unit nutrient differs:
  // map food piles carry a per-cell rate summing to the pile's fixed 1..8 value; other
  // food (player-dropped caches) falls back to the global incomeEfficiency.
  let energyGained = 0;
  for (const cell of substrate.cells) {
    if (cell.colonized <= 0 || cell.nutrient <= 0 || cell.hazard) continue;
    const take = Math.min(cell.nutrient, e.passiveIncomeRate) * cell.colonized;
    cell.nutrient -= take;
    energyGained += take * (cell.energyPerNutrient != null ? cell.energyPerNutrient : e.incomeEfficiency);
  }
  const income = energyGained + e.baselineTrickle;
  net.energy += income;
  return income;
}
