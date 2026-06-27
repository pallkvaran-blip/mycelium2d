// =============================================================================
// Actions — the six basic actions, the backbone of the game (A2, B5).
//
// Per the Terraforming Mars model these standard actions are always available;
// later cards will merely discount or twist them. Each action is defined as
// tunable DATA (moveCost / energyCost in CONFIG) plus an effect. The generic
// performAction() handles the move + Energy economy so every action is uniform.
//
// Targeting:
//   - 'point' : effect needs a world {x, y} (Add Substrate)
//   - 'node'  : effect needs a world {x, y} to pick a strand (Amputate)
//   - 'trait' : effect needs ctx.trait (Express)
//   - null    : no target (Grow, Digest, Fruit)
// =============================================================================

import { spawnTrichodermaAt, tickThreat } from './threats.js';
import { attackNest } from './ants.js';

export const ACTIONS = {
  grow: {
    label: 'Grow',
    target: null,
    desc: 'Release the network — tips extend toward sensed food.',
    apply(state) {
      const net = state.active;
      const created = net.grow(state.substrate, state.rng);
      if (created === 0) {
        return { ok: false, message: 'No food within sensing range — Add Substrate to lure growth.' };
      }
      return { ok: true, message: `Grew ${created} filament${created > 1 ? 's' : ''} toward food.` };
    },
  },

  addSubstrate: {
    label: 'Add Substrate',
    target: 'point',
    desc: 'Drop a small lure to steer growth where you want it (barely any food).',
    apply(state, ctx) {
      const a = state.config.actions.addSubstrate;
      const sub = state.substrate;
      if (ctx.y <= sub.surfaceY) return { ok: false, message: 'Place substrate underground (below the soil line).' };
      sub.deposit(ctx.x, ctx.y, a.amount, a.radius);   // small amount — it lures, it doesn't feed
      return { ok: true, message: 'Dropped a lure to steer growth.' };
    },
  },

  amputate: {
    label: 'Amputate',
    target: 'node',
    desc: 'Cut out every strand within a radius — excise an infected patch.',
    apply(state, ctx) {
      const a = state.config.actions.amputate;
      const removed = state.active.amputateAt(ctx.x, ctx.y, a.radius);
      if (removed === 0) return { ok: false, message: 'No strands within the cut radius there.' };
      return { ok: true, message: `Cut out ${removed} strand${removed > 1 ? 's' : ''}.` };
    },
  },

  attackAnts: {
    label: 'Attack Ants',
    target: 'point',
    desc: 'Drop a bomb on an ant nest — removes a chunk of its HP.',
    apply(state, ctx) {
      const a = state.config.actions.attackAnts;
      const hit = attackNest(state, ctx.x, ctx.y, a.pickRadius, a.damageFrac);
      if (!hit) return { ok: false, message: 'No ant nest close enough to bomb.' };
      return hit.dead
        ? { ok: true, message: 'Bombed the nest — it collapsed! The ants scatter.' }
        : { ok: true, message: `Bombed the nest — HP down to ${Math.round(hit.hp)}/${hit.maxHp}.` };
    },
  },

  digest: {
    label: 'Digest',
    target: null,
    desc: 'Over-digest occupied substrate for a burst of Energy now.',
    apply(state) {
      const d = state.config.actions.digest;
      const net = state.active;
      const sub = state.substrate;
      const cells = net.collectOccupiedCells(sub).filter((c) => c.nutrient > 0);
      if (cells.length === 0) return { ok: false, message: 'No occupied substrate to digest.' };
      // Drain a fixed fraction of EACH occupied cell — 2 uses fully digests a
      // pile of any size, at no loss (you get its full Energy value, just now).
      let gained = 0;
      for (const cell of cells) {
        const take = Math.min(cell.nutrient, cell.maxNutrient * d.drainFraction);
        cell.nutrient -= take;
        gained += take;
      }
      const energy = Math.round(gained * state.config.energy.incomeEfficiency);
      net.energy += energy;
      return { ok: true, message: `Digest: +${energy} Energy.` };
    },
  },

  fruit: {
    label: 'Fruit',
    target: null,
    desc: 'Push fruiting bodies up through reachable soil to release Spores.',
    apply(state) {
      const f = state.config.actions.fruit;
      const net = state.active;
      const points = net.computeFruitPoints(state.substrate);
      if (points.length === 0) {
        return { ok: false, message: 'No fruitable soil reached — steer growth under soil near the surface.' };
      }
      const vitalityFactor = Math.max(f.vitalityFloor, net.vitality);
      let spores = 0;
      for (const p of points) {
        spores += f.payoutPerBody * (p.shade ? f.shadeMultiplier : 1) * vitalityFactor;
      }
      spores = Math.round(spores);
      net.spores += spores;
      state.spores += spores;
      net.fruited = true;
      net.alive = false;
      state.runOver = true;
      state.runResult = { spores, bodies: points.length };
      return { ok: true, message: `Fruited ${points.length} bodies → +${spores} Spores. The network's life cycle ends.` };
    },
  },
};

// What it costs to perform an action right now (energy may be dynamic).
export function actionCost(state, name, ctx = {}) {
  const cfg = state.config.actions[name];
  const action = ACTIONS[name];
  const energy = action.energyCost ? action.energyCost(state, ctx) : cfg.energyCost;
  return { moves: cfg.moveCost, energy };
}

// Why an action can't be performed right now (or null if it can be afforded).
export function actionBlockedReason(state, name, ctx = {}) {
  if (state.runOver) return 'The run is over — restart to play again.';
  const net = state.active;
  if (!net || !net.alive) return 'The network is no longer alive.';
  const { moves, energy } = actionCost(state, name, ctx);
  if (state.movesLeft < moves) return 'No moves left this turn.';
  if (net.energy < energy) return `Not enough Energy (need ${Math.ceil(energy)}).`;
  return null;
}

// Perform an action: validate economy, run the effect, then charge on success.
export function performAction(state, name, ctx = {}) {
  const action = ACTIONS[name];
  if (!action) return { ok: false, message: `Unknown action: ${name}` };

  const blocked = actionBlockedReason(state, name, ctx);
  if (blocked) {
    state.log(blocked, 'warn');
    return { ok: false, message: blocked };
  }

  const { moves, energy } = actionCost(state, name, ctx);
  const result = action.apply(state, ctx);
  if (!result.ok) {
    state.log(result.message, 'warn');
    return result;
  }

  state.movesLeft -= moves;
  state.active.energy -= energy;
  state.active.recomputeVitality();
  state.log(result.message, 'action');

  // The mould reacts to your every move: clouds creep + eat, and the rot races
  // a little further along any infected filaments. (Fruit ends the run, so the
  // guard inside tickThreat makes this a no-op in that case.)
  tickThreat(state);

  return { ok: true, message: result.message, moves, energy };
}

// --- Dev cheat: spawn a Trichoderma cloud at a point (B7) -------------------
export function devSpawnTrichoderma(state, x, y) {
  spawnTrichodermaAt(state, x, y);
  state.log('DEV: spawned a Trichoderma cloud.', 'dev');
}
