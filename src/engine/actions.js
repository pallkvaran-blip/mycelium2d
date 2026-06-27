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

import { spawnTrichodermaAt } from './threats.js';

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
    desc: 'Place a patch of food to lure growth where you want it.',
    apply(state, ctx) {
      const a = state.config.actions.addSubstrate;
      const sub = state.substrate;
      if (ctx.y <= sub.surfaceY) return { ok: false, message: 'Place substrate underground (below the soil line).' };
      sub.deposit(ctx.x, ctx.y, a.amount * a.lureStrength, a.radius);
      return { ok: true, message: 'Placed substrate to lure growth.' };
    },
  },

  amputate: {
    label: 'Amputate',
    target: 'node',
    desc: 'Cut a strand and everything downstream of it.',
    apply(state, ctx) {
      const a = state.config.actions.amputate;
      const removed = state.active.amputateAt(ctx.x, ctx.y, a.pickRadius);
      if (removed === 0) return { ok: false, message: 'No strand close enough to cut there.' };
      return { ok: true, message: `Amputated ${removed} segment${removed > 1 ? 's' : ''}.` };
    },
  },

  express: {
    label: 'Express',
    target: 'trait',
    desc: 'Induce a genetic defence trait across the whole organism.',
    energyCost(state, ctx) {
      return state.active.expressCost(ctx.trait);
    },
    apply(state, ctx) {
      const net = state.active;
      const max = state.config.actions.express.maxLevel;
      if (net.traits[ctx.trait] >= max) {
        return { ok: false, message: `${cap(ctx.trait)} is already at max level.` };
      }
      net.expressTrait(ctx.trait);
      return { ok: true, message: `Expressed ${cap(ctx.trait)} → level ${net.traits[ctx.trait]}.` };
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
      const cells = net.collectOccupiedCells(sub)
        .filter((c) => c.nutrient > 0)
        .sort((a, b) => b.nutrient - a.nutrient);
      if (cells.length === 0) return { ok: false, message: 'No occupied substrate to digest.' };
      let remaining = d.burstSize;
      let gained = 0;
      for (const cell of cells) {
        if (remaining <= 0) break;
        const take = Math.min(cell.nutrient, remaining);
        gained += take;
        // Over-digesting exhausts the patch faster than the Energy it yields.
        cell.nutrient = Math.max(0, cell.nutrient - take * d.extraDepletion);
        remaining -= take;
      }
      const energy = Math.round(gained * state.config.energy.incomeEfficiency);
      net.energy += energy;
      return { ok: true, message: `Digest burst: +${energy} Energy (burns the patch faster).` };
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

// Capitalise a trait name for messages.
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

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
  return { ok: true, message: result.message, moves, energy };
}

// --- Dev cheat: spawn a Trichoderma patch at a point (B7) -------------------
export function devSpawnTrichoderma(state, x, y) {
  spawnTrichodermaAt(state.substrate, x, y, state.config, state.rng);
  state.log('DEV: spawned Trichoderma.', 'dev');
}
