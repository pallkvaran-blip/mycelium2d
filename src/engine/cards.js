// =============================================================================
// Card runtime (C1) — the deck / hand / resource layer on top of the action sim.
//
// Model (design §19 — two-resource):
//   - ENERGY (net.energy) is the master currency: spent to DRAW (a hand-full at once) and to SKIP.
//   - TWO resources gate PLAYS: WATER (growth + substrate) and PHOSPHORUS (digest/defense/
//     utility/work, harvested from rocks). They live on the active Network.
//   - A DRAW DECK of basics you pay energy to draw into your HAND; a HAND of cards
//     you play (paying their W/P gate); a DISCARD graveyard (no reshuffle). Finishing a
//     map food pile drafts a card into hand for free (pendingOffers → chooseOffer).
//   - Engine cards INSTALL and produce each world-tick (produceCardEngines).
//   - WIN = a strand reaches the goal zone. LOSE (stall) = no draw/skip/play/draft possible
//     (checked in checkGoalReached path).
//
// This module has NO dependency on turn.js (turn.js imports FROM here), so the
// card operations resolve the effect + economy and the CALLER advances the world
// (main.js handler / test), exactly like performAction/afterAction.
// =============================================================================

import { CARD_DATA, CARD_BY_NAME } from '../cards-data.js';

// Draw-engine card -> the basic it seeds (5 copies).
const DRAW_ENGINES = {
  'Leading Cord': 'Apical Drive',
  'Forager Bloom': 'Foraging Fan',
  'Questing Front': 'Tropic Lunge',
  'Humus Cache': 'Humus Bed',
  'Symbiont Weave': 'Mycorrhizal Mat',
  'Acorn Fall': 'Acorn Cache',
  'Enzyme Priming': 'Saprotrophic Digest',
  'Boring Corps': 'Appressorial Punch',
  'Crust Reserve': 'Sclerotial Crust',
  'Capillary Runners': 'Hyphal Imbibition',
  'Prospecting Cords': 'Phosphate Tap',
  'Dew Traps': 'Condense',
  'Colonizing Front': 'Hyphal Extension',
  'Leaf Fall': 'Leaf Litter Cache',
};

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// The "tutorial set": the pool a finished food pile drafts 3 random cards from.
// Basics are EXCLUDED — drafts hand out premium cards / draw-engines only (you
// already get basics from the draw deck), so a pile reward always feels premium.
const TUTORIAL_POOL = CARD_DATA.filter((c) => c.tutorial && c.type !== 'basic').map((c) => c.name);

// What a draw-engine card shuffles into your deck (for the confirm/preview UI).
// Returns { name, count } or null for non-engine cards.
export function cardDeckAdditions(name) {
  const basic = DRAW_ENGINES[name];
  return basic ? { name: basic, count: 5 } : null;
}

// --- setup ------------------------------------------------------------------
// Build the starting deck. `mode`: 'tutorial' (default) starts with an EMPTY
// hand — you draw basics from the deck, and DRAFT new premium cards by finishing
// (fully digesting) the food piles the map placed. 'all' deals every premium
// card to hand up-front (dev / free explore).
export function initCards(state, mode = 'tutorial') {
  const cc = state.config.cards;
  const net = state.active;
  net.water = cc.startWater; net.phosphorus = cc.startPhosphorus;

  const drawDeck = [];
  for (const c of CARD_DATA) for (let i = 0; i < (c.startCopies || 0); i++) drawDeck.push(c.name);
  shuffle(drawDeck, state.rng);

  let seq = 0;
  const hand = [];
  if (mode === 'all') {
    for (const c of CARD_DATA) { if (c.type === 'basic') continue; hand.push({ id: seq++, name: c.name }); }
  }

  state.cards = { drawDeck, hand, discard: [], engines: [], round: 1, seq, drawDiscount: 0, pendingOffers: [] };
  state.log('Card layer online: draw basics; finish a map food pile to draft a new card; reach the goal.', 'good');
  return state.cards;
}

// --- pile-reward draft ------------------------------------------------------
// Finishing (fully digesting) a MAP-placed food pile you colonised lets you pick
// one of 3 random tutorial-set cards, FREE (into hand). You still pay to play it.
// Piles you placed yourself (Substrate.deposit) are untracked and grant nothing.
function offerPileReward(state) {
  const C = state.cards;
  const bag = TUTORIAL_POOL.slice();
  shuffle(bag, state.rng);
  C.pendingOffers.push({ choices: bag.slice(0, Math.min(3, bag.length)) });
  state.log('A food pile is fully digested — choose a new card to add to your hand.', 'good');
}

export function checkPileRewards(state) {
  const C = state.cards; if (!C || !C.pendingOffers || state.runOver) return;
  const sub = state.substrate; if (!sub || !sub.foodPiles) return;
  const net = state.active; if (!net || !net.alive) return;
  for (const pile of sub.foodPiles) {
    if (pile.rewarded) continue;
    let total = 0, touched = false;
    for (const idx of pile.cells) {
      const cell = sub.cells[idx]; if (!cell) continue;
      total += cell.nutrient;
      if (cell.colonized > 0) touched = true;   // the colony actually digested it
    }
    if (touched && total <= 1e-6) { pile.rewarded = true; offerPileReward(state); }
  }
}

// Resolve a pending draft: add the chosen card to hand (free). No world tick —
// drafting is a reward for an action already taken, not an action itself.
export function chooseOffer(state, cardName) {
  const C = state.cards; if (!C) return { ok: false, message: 'No card layer.' };
  const offer = C.pendingOffers && C.pendingOffers[0];
  if (!offer) return { ok: false, message: 'No card reward to pick.' };
  if (!offer.choices.includes(cardName)) return { ok: false, message: 'That card is not on offer.' };
  C.hand.push({ id: C.seq++, name: cardName });
  C.pendingOffers.shift();
  state.log(`Drafted ${cardName} into your hand (free — you still pay to play it).`, 'good');
  return { ok: true, card: cardName };
}

// --- costs / gating ---------------------------------------------------------
export function drawCost(state) {
  return Math.max(1, state.config.cards.drawCostEnergy - (state.cards.drawDiscount || 0));
}
export function cardBlockedReason(state, name) {
  if (state.runOver) return 'The run is over.';
  const net = state.active;
  if (!net || !net.alive) return 'The network is no longer alive.';
  const c = CARD_BY_NAME[name];
  if (!c) return 'Unknown card.';
  if (net.energy < c.buyCostEnergy) return `Not enough Energy (need ${c.buyCostEnergy}).`;
  if (net.water < c.costW) return `Not enough Water (need ${c.costW}).`;
  if (net.phosphorus < c.costP) return `Not enough Phosphorus (need ${c.costP}).`;
  return null;
}
export function cardNeedsTarget(name) {
  const e = EFFECTS[name];
  return !!(e && e.target);
}

// --- operations (do NOT tick; the caller advances the world after) ----------
export function drawCard(state) {
  const C = state.cards, net = state.active, cc = state.config.cards;
  if (state.runOver) return { ok: false, message: 'The run is over.' };
  if (!C.drawDeck.length) return { ok: false, message: 'Draw deck is empty — you are card-dry.' };
  const cost = drawCost(state);
  if (net.energy < cost) return { ok: false, message: `Not enough Energy to draw (need ${cost}).` };
  net.energy -= cost;
  const n = Math.min(cc.drawCount || 1, C.drawDeck.length);   // pull the whole hand-full at once
  const drawn = [];
  for (let i = 0; i < n; i++) { const name = C.drawDeck.shift(); C.hand.push({ id: C.seq++, name }); drawn.push(name); }
  state.log(`Drew ${n} card${n > 1 ? 's' : ''} (−${cost}⚡): ${drawn.join(', ')}.`, 'action');
  return { ok: true, tick: true, message: `Drew ${n} card${n > 1 ? 's' : ''}.` };
}

export function skipRound(state) {
  const cc = state.config.cards, net = state.active;
  if (state.runOver) return { ok: false, message: 'The run is over.' };
  const cost = cc.skipCostEnergy;
  if (net.energy < cost) return { ok: false, message: `Not enough Energy to skip (need ${cost}).` };
  net.energy -= cost;
  state.log(`Skipped a round (−${cost}⚡).`, 'action');
  return { ok: true, tick: true, message: 'Skipped a round.' };
}

export function playCard(state, handIndex, ctx = {}) {
  const C = state.cards, net = state.active;
  const entry = C.hand[handIndex];
  if (!entry) return { ok: false, message: 'No such card in hand.' };
  const c = CARD_BY_NAME[entry.name];
  const blocked = cardBlockedReason(state, entry.name);
  if (blocked) { state.log(blocked, 'warn'); return { ok: false, message: blocked }; }
  const eff = EFFECTS[entry.name];
  if (!eff) return { ok: false, message: `${entry.name} has no effect wired.` };
  if (eff.target && ctx.x == null) return { ok: false, needTarget: true, message: `Tap a target for ${entry.name}.` };

  const res = eff.apply(state, c, ctx);
  if (!res.ok) { state.log(res.message, 'warn'); return res; }

  // Charge the card's Energy cost + its resource gate, only on success.
  // (Premium cards carry a buyCostEnergy; basics are 0 — you paid Energy to draw them.
  //  Until food-pile drafting exists, that Energy cost is paid here, at play time.)
  net.energy -= c.buyCostEnergy;
  net.water -= c.costW; net.phosphorus -= c.costP;
  C.hand.splice(handIndex, 1);
  if (res.install) {
    res.install.name = entry.name;
    C.engines.push(res.install);
    if (res.install.drawDiscount) C.drawDiscount = (C.drawDiscount || 0) + res.install.drawDiscount;
  } else {
    C.discard.push(entry.name);
  }
  state.log(`Played ${entry.name}. ${res.message}`, 'action');
  return { ok: true, tick: true, message: res.message };
}

// --- per world-tick: installed engines produce (called from tickWorld) ------
export function produceCardEngines(state) {
  const C = state.cards; if (!C) return;
  const net = state.active; if (!net || !net.alive) return;
  const cc = state.config.cards;
  let energySum = 0;
  for (const e of C.engines) {
    // Cadence: an engine with `every > 1` produces only every N rounds (ticks).
    let due = true;
    if (e.every && e.every > 1) {
      e._et = (e._et || 0) + 1;
      if (e._et < e.every) due = false; else e._et = 0;
    }
    if (due) {
      if (e.energy) energySum += e.energy;
      if (e.water) net.water = Math.min(cc.softCapWater, net.water + e.water);
      if (e.phosphorus) net.phosphorus = Math.min(cc.softCapPhosphorus, net.phosphorus + e.phosphorus);
    }
    if (e.digEvery) {
      e._t = (e._t || 0) + 1;
      if (e._t >= e.digEvery) { e._t = 0; digNearestRock(state, e.digClasses || ['formation', 'column']); }
    }
  }
  // The engine energy ceiling: installed energy income is clamped below SKIP.
  if (energySum > 0) net.energy += Math.min(energySum, cc.engineEnergyClamp);
}

// --- WIN: a strand reaches the goal zone; LOSE: card-dry & broke ------------
export function checkGoalReached(state) {
  if (state.runOver || !state.cards) return;
  const net = state.active; if (!net || !net.alive) return;
  const sub = state.substrate;
  const f = state.config.actions.fruit;
  for (const n of net.nodes) {
    if (n.infected) continue;
    const surf = sub.surfaceColumnAtX(n.x);
    if (surf && surf.goal) {
      const depth = n.y - sub.surfaceY;
      if (depth >= 0 && depth <= f.reachDepth) {
        net.fruited = true; net.alive = false;
        state.runOver = true; state.won = true;
        state.runResult = { won: true, turns: state.turn };
        state.log('A fruiting body breaks the surface at the goal — you win the level!', 'good');
        return;
      }
    }
  }
  // Stall death: the world can no longer be advanced. You can't afford to DRAW
  // (deck empty OR too little Energy), can't SKIP, have no playable card, and no
  // free draft is pending. (Gating on deck-emptiness alone missed the freeze where
  // the deck still has cards but Energy is below the draw cost — Draw costs 16 > skip 12.)
  const C = state.cards;
  const cc = state.config.cards;
  const canDraw = C.drawDeck.length > 0 && net.energy >= drawCost(state);
  const canSkip = net.energy >= cc.skipCostEnergy;
  const canPlay = C.hand.some((h) => !cardBlockedReason(state, h.name) && EFFECTS[h.name]);
  const hasDraft = C.pendingOffers && C.pendingOffers.length > 0;   // a free card is still coming
  if (!canDraw && !canSkip && !canPlay && !hasDraft) {
    net.alive = false; state.runOver = true;
    state.runResult = { won: false, died: true, turns: state.turn };
    state.log('Out of Energy with no playable move — the colony stalls. Run over.', 'warn');
  }
}

// --- shared effect helpers --------------------------------------------------
function dirFrom(state, ctx) {
  const fp = state.active.frontierPoint() || { x: 0, y: state.substrate.surfaceY };
  let dx = ctx.x - fp.x, dy = ctx.y - fp.y;
  if (Math.hypot(dx, dy) < 1) { dx = 1; dy = 0; }
  return { fp, dx, dy };
}
function depositAtSensingEdge(state, ctx, amount, radiusCells) {
  const sub = state.substrate;
  const g = state.config.growth;
  const { fp, dx, dy } = dirFrom(state, ctx);
  const len = Math.hypot(dx, dy) || 1;
  let px = fp.x + (dx / len) * g.sensingRadius;
  let py = fp.y + (dy / len) * g.sensingRadius;
  py = Math.max(sub.surfaceY + sub.cellSize, Math.min(sub.worldHeight - sub.cellSize, py));
  px = Math.max(sub.cellSize, Math.min(sub.worldWidth - sub.cellSize, px));
  sub.deposit(px, py, amount, radiusCells);
  return { px, py };
}
function nodeTouches(state, pred) {
  const sub = state.substrate;
  for (const n of state.active.nodes) {
    if (n.infected) continue;
    const col = sub.colAtX(n.x), row = sub.rowAtY(n.y);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cell = sub.cellAt(col + dc, row + dr);
      if (cell && pred(cell)) return true;
    }
  }
  return false;
}
const touchesLake = (state) => nodeTouches(state, (c) => c.water);
const touchesMineral = (state) => nodeTouches(state, (c) => c.rock && !c.water);
function digNearestRock(state, classes) {
  const fp = state.active.frontierPoint(); if (!fp) return 0;
  return state.active.digThrough(state.substrate, fp.x, fp.y, classes);
}
function cureRadius(state, ctx, r) {
  let healed = 0;
  for (const n of state.active.nodes) {
    if ((n.x - ctx.x) ** 2 + (n.y - ctx.y) ** 2 <= r * r) {
      if (n.infected) { n.infected = false; healed++; }
      n.health = 1;
    }
  }
  state.substrate.cellsInRadius(ctx.x, ctx.y, r, (cell) => { cell.trich = 0; });
  state.active.recomputeVitality();
  return healed;
}

// --- the effect registry (all 40 cards) -------------------------------------
const grow = (fn) => ({ apply: fn });
const targeted = (fn) => ({ target: true, apply: fn });
const engine = (produce, msg) => ({ apply: () => ({ ok: true, install: { ...produce }, message: msg }) });

export const EFFECTS = {
  // --- grow (Water) ---
  'Hyphal Extension': grow((s) => {
    const c = s.active.grow(s.substrate, s.rng);
    return c > 0 ? { ok: true, message: `Grew ${c} filaments toward food.` } : { ok: false, message: 'No food within sensing range.' };
  }),
  'Apical Drive': targeted((s, c, ctx) => {
    const { dx, dy } = dirFrom(s, ctx);
    const n = s.active.growDirected(s.substrate, s.rng, dx, dy, s.config.cards.directionalSteps, false);
    return n > 0 ? { ok: true, message: `Grew ${n} in your chosen direction.` } : { ok: false, message: 'Blocked — nothing grew that way.' };
  }),
  'Foraging Fan': grow((s) => {
    const n = s.active.growRadial(s.substrate, s.rng);
    return n > 0 ? { ok: true, message: `Fanned out ${n} tips.` } : { ok: false, message: 'No room to fan out.' };
  }),
  'Tropic Lunge': grow((s) => {
    const n = s.active.growToNearestFood(s.substrate, s.rng, 3);
    return n > 0 ? { ok: true, message: `Lunged ${n} toward the nearest food.` } : { ok: false, message: 'No food sensed anywhere.' };
  }),
  'Appressorial Punch': targeted((s, c, ctx) => {
    const n = s.active.digThrough(s.substrate, ctx.x, ctx.y, ['boulder']);
    return n > 0 ? { ok: true, message: 'Bored through the boulder.' } : { ok: false, message: 'No boulder there to punch through.' };
  }),
  'Rhizomorph Lance': targeted((s, c, ctx) => {
    const { dx, dy } = dirFrom(s, ctx);
    const n = s.active.growDirected(s.substrate, s.rng, dx, dy, s.config.cards.reachSegments, true);
    return n > 0 ? { ok: true, message: `Lanced ${n} cells forward.` } : { ok: false, message: 'Blocked — the lance hit rock.' };
  }),
  'Fruiting Vigil': targeted((s, c, ctx) => {
    const { dx, dy } = dirFrom(s, ctx);
    const n = s.active.growDirected(s.substrate, s.rng, dx, dy, s.config.cards.reachSegments, true);
    checkGoalReached(s);
    return { ok: true, message: s.won ? 'Reached the goal!' : `Extended ${n} toward the goal.` };
  }),

  // --- substrate (Water) ---
  'Leaf Litter Cache': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateSmall, 1); return { ok: true, message: 'Dropped a small patch at the sensing edge.' }; }),
  'Acorn Cache': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateSmall, 1); return { ok: true, message: 'Buried a small nut cache at the sensing edge.' }; }),
  'Humus Bed': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateMedium, 2); return { ok: true, message: 'Laid a medium patch at the sensing edge.' }; }),
  'Mycorrhizal Mat': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateLarge, 3); return { ok: true, message: 'Spread a large mat at the sensing edge.' }; }),

  // --- digest (Phosphorus) ---
  'Saprotrophic Digest': grow((s) => {
    const net = s.active, sub = s.substrate;
    const cells = net.collectOccupiedCells(sub).filter((c) => c.nutrient > 0);
    if (!cells.length) return { ok: false, message: 'No occupied substrate to digest.' };
    const d = s.config.actions.digest;
    let gained = 0;
    for (const cell of cells) { const take = Math.min(cell.nutrient, cell.maxNutrient * d.drainFraction); cell.nutrient -= take; gained += take; }
    const energy = Math.round(gained * s.config.energy.incomeEfficiency * 2);   // doubled
    net.energy += energy;
    return { ok: true, message: `Digest: +${energy}⚡.` };
  }),

  // --- harvest ---
  'Condense': grow((s) => { const cc = s.config.cards; s.active.water = Math.min(cc.softCapWater, s.active.water + 3); return { ok: true, message: '+3 Water.' }; }),
  'Hyphal Imbibition': grow((s) => {
    const cc = s.config.cards; const amt = touchesLake(s) ? cc.harvestWaterLake : cc.harvestWaterSoil;
    s.active.water = Math.min(cc.softCapWater, s.active.water + amt);
    return { ok: true, message: `+${amt} Water${amt === cc.harvestWaterLake ? ' (lake)' : ''}.` };
  }),
  'Phosphate Tap': grow((s) => {
    if (!touchesMineral(s)) return { ok: false, message: 'Not in contact with mineral rock.' };
    const cc = s.config.cards; s.active.phosphorus = Math.min(cc.softCapPhosphorus, s.active.phosphorus + cc.harvestPhosphorus);
    return { ok: true, message: `+${cc.harvestPhosphorus} Phosphorus.` };
  }),

  // --- energy ---
  'Rhizomorph Trunkline': engine({ energy: 4 }, 'Installed: +4⚡/round.'),
  'Osmotic Cashout': grow((s) => { s.active.energy += 22; return { ok: true, message: '+22⚡.' }; }),
  'Septal Pore Flux': engine({ drawDiscount: 3 }, 'Installed: draws cost 3 less.'),

  // --- resource engines ---
  'Aquaporin Channels': engine({ water: 1, every: 2 }, 'Installed: +1 Water every 2 rounds.'),
  'Phosphatase Cushion': engine({ phosphorus: 1 }, 'Installed: +1 Phosphorus/round.'),
  'Mineralizing Saprobe': engine({ phosphorus: 1 }, 'Installed: +1 Phosphorus/round.'),

  // --- dig engine (Phosphorus install) ---
  'Tap-Root Rhizomorph': engine({ digEvery: 5, digClasses: ['formation', 'column'] }, 'Installed: clears a formation/column every 5 rounds.'),

  // --- utility ---
  'Nutrient Transmutation': grow((s) => {
    const net = s.active;
    const pools = [['water', net.water], ['phosphorus', net.phosphorus]];
    pools.sort((a, b) => b[1] - a[1]);
    const from = pools[0], to = pools[1];
    if (from[1] < 2) return { ok: false, message: 'Need 2 of a resource to convert.' };
    net[from[0]] -= 2; net[to[0]] += 1;
    return { ok: true, message: `Converted 2 ${from[0]} → 1 ${to[0]}.` };
  }),

  // --- defense (best-effort v1) ---
  'Sclerotial Crust': targeted((s, c, ctx) => { const h = cureRadius(s, ctx, 40); return { ok: true, message: h ? `Hardened & cleared ${h} strands.` : 'Hardened the patch.' }; }),
  'Suberin Wall': targeted((s, c, ctx) => { const h = cureRadius(s, ctx, 80); return { ok: true, message: h ? `Cured ${h} infected strands.` : 'No infection in range (walled off).' }; }),
  'Rehydration Pulse': targeted((s, c, ctx) => { const h = cureRadius(s, ctx, 60); return { ok: true, message: h ? `Rehydrated ${h} strands.` : 'Rehydrated the area.' }; }),
  'Constricting Ring': grow((s) => {
    const worms = s.nematodes || [];
    if (!worms.length) return { ok: false, message: 'No nematodes to snare.' };
    const fp = s.active.frontierPoint() || { x: 0, y: 0 };
    let idx = 0, bd = Infinity;
    worms.forEach((w, i) => { const d = (w.x - fp.x) ** 2 + (w.y - fp.y) ** 2; if (d < bd) { bd = d; idx = i; } });
    worms.splice(idx, 1);
    s.active.phosphorus = Math.min(s.config.cards.softCapPhosphorus, s.active.phosphorus + 2);
    return { ok: true, message: 'Snared a nematode: +2 Phosphorus.' };
  }),
  'Sclerotial Seal': targeted((s, c, ctx) => {
    const cell = s.substrate.cellAtWorld(ctx.x, ctx.y);
    if (!cell || cell.nutrient <= 0) return { ok: false, message: 'Tap a food pile to seal it.' };
    s.substrate.cellsInRadius(ctx.x, ctx.y, s.substrate.cellSize * 2, (cl) => { if (cl.nutrient > 0) cl.antProof = 3; });
    return { ok: true, message: 'Sealed the pile — ants can’t harvest it for 3 rounds.' };
  }),
};

// Draw-engine cards: shuffle 5 copies of a basic into the draw deck.
for (const [name, payload] of Object.entries(DRAW_ENGINES)) {
  EFFECTS[name] = grow((s) => {
    for (let i = 0; i < 5; i++) s.cards.drawDeck.push(payload);
    shuffle(s.cards.drawDeck, s.rng);
    return { ok: true, message: `Shuffled 5 ${payload} into the draw deck.` };
  });
}
