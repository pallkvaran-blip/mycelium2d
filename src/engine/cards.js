// =============================================================================
// Cards — the deck/hand layer over the standard actions (the engine-builder
// core, per the GDD). The player no longer has free actions; they draw a hand
// each turn and play cards (which cost Energy and trigger the underlying action
// effects). Card scarcity + the deck you build is where the depth comes from.
//
// A card template references an existing action (with optional param overrides)
// or an `engine` effect. Deck/hand/discard live on `state`.
// =============================================================================

import { ACTIONS } from './actions.js';
import { tickThreat } from './threats.js';

// --- Card templates ---------------------------------------------------------
// type drives the colour in the UI. target: null (instant), 'point' (click the
// map), 'node' (click a strand). maxDist (optional) limits how far from the
// colony a placement card can reach.
export const CARDS = {
  grow:      { name: 'Grow',            type: 'growth',    cost: 8,  target: null,    action: 'grow',
               desc: 'Extend the network toward sensed food.' },
  digest:    { name: 'Digest',          type: 'growth',    cost: 6,  target: null,    action: 'digest',
               desc: 'Devour occupied substrate for a burst of Energy.' },
  amputate:  { name: 'Amputate',        type: 'defense',   cost: 4,  target: 'node',  action: 'amputate', params: {},
               desc: 'Cut out every strand within the radius (excise infection).' },

  // Substrate lures/feeders — various SIZES and reach (DISTANCE from the colony).
  baitSmall: { name: 'Spore Bait',      type: 'substrate', cost: 4,  target: 'point', action: 'addSubstrate',
               params: { amount: 18, radius: 0 }, maxDist: 150,
               desc: 'A tiny lure (1 cell), placed close to the colony. Steers growth.' },
  patch:     { name: 'Compost Patch',   type: 'substrate', cost: 9,  target: 'point', action: 'addSubstrate',
               params: { amount: 40, radius: 1 }, maxDist: 180,
               desc: 'A small feeding patch near the colony — lures and feeds a little.' },
  mound:     { name: 'Rich Mound',      type: 'substrate', cost: 15, target: 'point', action: 'addSubstrate',
               params: { amount: 70, radius: 2 }, maxDist: 230,
               desc: 'A big, rich pile of food (short reach).' },
  farCast:   { name: 'Far Cast',        type: 'substrate', cost: 8,  target: 'point', action: 'addSubstrate',
               params: { amount: 16, radius: 0 },
               desc: 'Fling a tiny lure anywhere on the map (long reach).' },

  // Defence.
  melanize:  { name: 'Melanize',        type: 'defense',   cost: 12, target: null,    action: 'express',
               params: { trait: 'melanize' },
               desc: 'Toughen the organism — resists the mould\'s initial contact.' },

  // Engine builders.
  surge:     { name: 'Metabolic Surge', type: 'engine',    cost: 0,  target: null,    engine: { energy: 25 },
               desc: 'A burst of metabolism: +25 Energy now.' },
  deepen:    { name: 'Deepen Roots',    type: 'engine',    cost: 10, target: null,    engine: { income: 8 },
               desc: 'Thicken your feeding roots: +8 passive income for the rest of the run.' },
  flush:     { name: 'Spore Flush',     type: 'engine',    cost: 3,  target: null,    engine: { draw: 2 },
               desc: 'Draw 2 cards.' },
};

// Safe starting deck — you can always grow + feed, with one engine card.
export const STARTING_DECK = [
  'grow', 'grow', 'grow', 'grow',
  'baitSmall', 'baitSmall',
  'digest', 'digest',
  'amputate',
  'surge',
  'flush',
];

export const HAND_SIZE = 5;

let _uid = 0;

// --- Deck lifecycle ---------------------------------------------------------
export function initDeck(state) {
  state.deck = STARTING_DECK.map((key) => ({ uid: 'c' + (_uid++), key }));
  state.discard = [];
  state.hand = [];
  shuffle(state.deck, state.rng);
  drawCards(state, HAND_SIZE);
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
}

export function drawCards(state, n) {
  for (let i = 0; i < n; i++) {
    if (state.deck.length === 0) {
      if (state.discard.length === 0) break;        // genuinely out of cards
      state.deck = state.discard; state.discard = [];
      shuffle(state.deck, state.rng);
    }
    state.hand.push(state.deck.pop());
  }
}

// End of turn: discard whatever is left in hand, then draw a fresh hand.
export function refillHand(state) {
  while (state.hand.length) state.discard.push(state.hand.pop());
  drawCards(state, HAND_SIZE);
}

// Why a card can't be played right now (or null if it can).
export function cardBlockedReason(state, inst) {
  if (state.runOver) return 'The run is over.';
  const card = CARDS[inst.key];
  if (!card) return 'Unknown card.';
  const net = state.active;
  if (!net || !net.alive) return 'The network is no longer alive.';
  if (net.energy < card.cost) return `Not enough Energy (need ${card.cost}).`;
  return null;
}

// Play a card from hand. ctx carries {x,y} for targeted cards.
export function playCard(state, inst, ctx = {}) {
  const blocked = cardBlockedReason(state, inst);
  if (blocked) { state.log(blocked, 'warn'); return { ok: false, message: blocked }; }

  const card = CARDS[inst.key];
  const net = state.active;
  const idx = state.hand.indexOf(inst);
  if (idx < 0) return { ok: false, message: 'That card is not in hand.' };

  // placement cards: respect the card's reach from the colony
  if (card.maxDist != null && ctx.x != null) {
    let best = Infinity;
    for (const n of net.nodes) best = Math.min(best, Math.hypot(n.x - ctx.x, n.y - ctx.y));
    if (best > card.maxDist) { state.log('Too far from the colony for that card.', 'warn'); return { ok: false, message: 'Too far from the colony.' }; }
  }

  const res = card.engine
    ? applyEngine(state, card.engine)
    : ACTIONS[card.action].apply(state, { ...(card.params || {}), ...ctx });
  if (!res || !res.ok) { if (res) state.log(res.message, 'warn'); return res || { ok: false, message: 'No effect.' }; }

  net.energy -= card.cost;
  state.hand.splice(idx, 1);
  state.discard.push(inst);
  state.log(`${card.name}: ${res.message}`, 'action');
  net.recomputeVitality();

  tickThreat(state);   // the mould reacts to every card you play
  return { ok: true, message: res.message };
}

function applyEngine(state, eng) {
  const net = state.active;
  if (eng.energy) { net.energy += eng.energy; return { ok: true, message: `+${eng.energy} Energy.` }; }
  if (eng.income) { net.incomeBonus = (net.incomeBonus || 0) + eng.income; return { ok: true, message: `passive income +${eng.income}.` }; }
  if (eng.draw) { drawCards(state, eng.draw); return { ok: true, message: `drew ${eng.draw} cards.` }; }
  return { ok: false, message: 'No effect.' };
}
