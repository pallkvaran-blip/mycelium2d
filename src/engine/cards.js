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
// Cordyceps cards destroy an ant nest (attackNest with frac 1 = full kill).
import { attackNest } from './ants.js';

// Add `amt` to a resource pool, capped at its soft cap — but NEVER below what you
// already hold. (A plain Math.min(cap, cur+amt) DROPS a pool that's already over
// the cap, so a harvest/income card would REDUCE your resource instead of raising
// it. gain() only ever adds, and stops adding once you're at/over the cap.)
const gain = (cur, amt, cap) => Math.max(cur, Math.min(cap, cur + amt));

// Draw-engine card -> the basic it seeds (5 copies). The active extenders were
// converted into installed engines/actions that repeat every 6 rounds (see the
// explicit EFFECTS at the bottom of this file); only ARCHIVED extenders remain
// here (kept for the round-trip if ever un-archived).
const DRAW_ENGINES = {
  'Humus Cache': 'Humus Bed',
  'Symbiont Weave': 'Mycorrhizal Mat',
  'Enzyme Priming': 'Saprotrophic Digest',
  'Leaf Fall': 'Leaf Litter Cache',
};

// Archived cards — not part of the game for now (kept in the data/design docs so
// they're easy to bring back). Filtered out of the draw deck, drafts and dealt
// hands, so they never enter play. To un-archive a card, remove it from this set.
const ARCHIVED = new Set([
  // Non-Acorn substrate placement (Acorn Cache stays) + their draw-engine extenders.
  'Leaf Litter Cache', 'Humus Bed', 'Mycorrhizal Mat',
  'Leaf Fall', 'Humus Cache', 'Symbiont Weave',
  // Digestion is fast enough now that an active digest card is redundant.
  'Saprotrophic Digest', 'Enzyme Priming',
]);
const isArchived = (name) => ARCHIVED.has(name);

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Draft pools, split by the card's displayed category. A NORMAL substrate cache
// drafts a Basic or Event card; a rare ENGINE cache (the red-iconed piles near the
// surface) drafts an Engine card — the recurring, high-value stuff. Built lazily so
// EFFECTS (defined later in this module) is available: only playable, non-archived
// cards are eligible. `engine=true` → the engine pool, else the basic/event pool.
const dcatOf = (c) => c.displayCategory || c.type;
function draftPool(engine) {
  return CARD_DATA.filter((c) => {
    if (isArchived(c.name) || !EFFECTS[c.name]) return false;
    const d = dcatOf(c);
    return engine ? d === 'engine' : (d === 'basic' || d === 'event');
  }).map((c) => c.name);
}

// What a draw-engine card shuffles into your deck (for the confirm/preview UI).
// Returns { name, count } or null for non-engine (or archived) cards.
export function cardDeckAdditions(name) {
  if (isArchived(name)) return null;
  const basic = DRAW_ENGINES[name];
  return basic && !isArchived(basic) ? { name: basic, count: 5 } : null;
}

// --- setup ------------------------------------------------------------------
// Build the starting deck. `mode`: 'tutorial' (default) deals a free OPENING
// HAND of `drawCount` basics off the top of the draw deck (so turn 1 already has
// cards to consider); you then draw more from the deck and DRAFT premium cards by
// finishing (fully digesting) the food piles the map placed. 'all' deals every
// premium card to hand up-front (dev / free explore).
export function initCards(state, mode = 'tutorial') {
  const cc = state.config.cards;
  const net = state.active;
  net.water = cc.startWater; net.phosphorus = cc.startPhosphorus;

  const drawDeck = [];
  for (const c of CARD_DATA) { if (isArchived(c.name)) continue; for (let i = 0; i < (c.startCopies || 0); i++) drawDeck.push(c.name); }
  shuffle(drawDeck, state.rng);

  let seq = 0;
  const hand = [];
  if (mode === 'testall') {
    // === TEMP (card testing) — remove this branch (and the 'testall' arg in
    // main.js) to restore the normal opening hand. Deals 5× of every playable card
    // and tops up resources so each one can actually be played and verified.
    for (const c of CARD_DATA) {
      if (!EFFECTS[c.name] || isArchived(c.name)) continue;   // only playable, non-archived cards
      for (let i = 0; i < 5; i++) hand.push({ id: seq++, name: c.name });
    }
    net.energy = 300; net.water = 300; net.phosphorus = 300;
    // === END TEMP =============================================================
  } else if (mode === 'all') {
    for (const c of CARD_DATA) { if (c.type === 'basic' || isArchived(c.name)) continue; hand.push({ id: seq++, name: c.name }); }
  } else {
    // Free opening draw so the hand isn't empty at game start (no Energy charged).
    const opening = Math.min(cc.drawCount || 3, drawDeck.length);
    for (let i = 0; i < opening; i++) hand.push({ id: seq++, name: drawDeck.shift() });
  }

  state.cards = { drawDeck, hand, discard: [], engines: [], actions: [], round: 1, seq, drawDiscount: 0, pendingOffers: [] };
  state.log('Card layer online: you start with a small hand — draw more basics, finish a map food pile to draft a new card, and reach the goal.', 'good');
  return state.cards;
}

// --- pile-reward draft ------------------------------------------------------
// Finishing (fully digesting) a MAP-placed food pile you colonised lets you pick
// one of 3 random tutorial-set cards, FREE (into hand). You still pay to play it.
// Piles you placed yourself (Substrate.deposit) are untracked and grant nothing.
function offerPileReward(state, pile) {
  const C = state.cards;
  const engine = !!(pile && pile.kind === 'engine');
  const bag = draftPool(engine);
  shuffle(bag, state.rng);
  const offer = { choices: bag.slice(0, Math.min(3, bag.length)), kind: engine ? 'engine' : 'normal' };
  // Capture the pile's world footprint (centre + cells) so the render layer can
  // play the draft animation FROM where the pile stood — a 3-card glyph fades in
  // there, then the draft panel expands out of it. Pure world coords; no view state.
  const sub = state.substrate;
  if (pile && pile.cells && pile.cells.length && sub && sub.cellCenter) {
    let sx = 0, sy = 0, n = 0;
    for (const idx of pile.cells) {
      const col = idx % sub.cols, row = Math.floor(idx / sub.cols);
      const c = sub.cellCenter(col, row);
      sx += c.x; sy += c.y; n++;
    }
    if (n) { offer.center = { x: sx / n, y: sy / n }; offer.cells = pile.cells.slice(); }
  }
  C.pendingOffers.push(offer);
  state.log(engine ? 'An engine cache is digested — choose a powerful ENGINE card.' : 'A food pile is fully digested — choose a new card to add to your hand.', 'good');
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
    if (touched && total <= 1e-6) { pile.rewarded = true; offerPileReward(state, pile); }
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
  // Action cards pay only their Energy buy price to INSTALL; any W/P shown on the
  // card is the per-activation cost (spent on each Use from the menu), not a gate
  // on installing — so don't require it here.
  if (c.type === 'action') {
    if (state.cards && state.cards.actions && state.cards.actions.some((a) => a.name === name)) return 'Already installed — it’s in your Actions menu.';
    return null;
  }
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
  // Tempo upgrades pick ONE installed ability to speed up — the UI shows a picker
  // and replays with ctx.ability = its index into cards.actions / cards.engines.
  if (eff.abilityScope && ctx.ability == null) return { ok: false, needAbilityPick: true, scope: eff.abilityScope, amount: eff.abilityAmount, message: `Choose an ${eff.abilityScope} to speed up.` };

  const res = eff.apply(state, c, ctx);
  if (!res.ok) { state.log(res.message, 'warn'); return res; }

  // Charge the card's Energy cost + its resource gate, only on success.
  // (Premium cards carry a buyCostEnergy; basics are 0 — you paid Energy to draw them.
  //  Until food-pile drafting exists, that Energy cost is paid here, at play time.)
  // Action cards pay only Energy to install; their W/P is a per-activation cost
  // (charged by activateAction on each Use), not an install gate.
  net.energy -= c.buyCostEnergy;
  if (!res.installAction) { net.water -= c.costW; net.phosphorus -= c.costP; }
  C.hand.splice(handIndex, 1);
  if (res.install) {
    res.install.name = entry.name;
    C.engines.push(res.install);
    if (res.install.drawDiscount) C.drawDiscount = (C.drawDiscount || 0) + res.install.drawDiscount;
  } else if (res.installAction) {
    // Action cards graduate to a repeatable ability in the Actions menu (right).
    const a = res.installAction;
    a.name = entry.name;
    a.used = 0; a.cd = 0;   // ready on install (cooldown/uses tick with the world)
    C.actions.push(a);
  } else {
    C.discard.push(entry.name);
  }
  state.log(`Played ${entry.name}. ${res.message}`, 'action');
  return { ok: true, tick: true, message: res.message };
}

// Tempo upgrade: which installed abilities a card can speed up + by how much.
// Returns { scope:'action'|'engine', amount } or null. The UI uses this to offer a
// picker of the eligible installed abilities (those still waiting >1 round).
export function cardAbilityInfo(name) {
  const e = EFFECTS[name];
  return (e && e.abilityScope) ? { scope: e.abilityScope, amount: e.abilityAmount } : null;
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
      if (e.water) net.water = gain(net.water, e.water, cc.softCapWater);
      if (e.phosphorus) net.phosphorus = gain(net.phosphorus, e.phosphorus, cc.softCapPhosphorus);
    }
    if (e.digEvery) {
      e._t = (e._t || 0) + 1;
      if (e._t >= e.digEvery) { e._t = 0; digNearestRock(state, e.digClasses || ['formation', 'column']); }
    }
  }
  // The engine energy ceiling: installed energy income is clamped below SKIP.
  if (energySum > 0) net.energy += Math.min(energySum, cc.engineEnergyClamp);

  // Player-activated actions: a world tick is one "round", so per-round use limits
  // reset and cooldowns tick down (the Actions-menu buttons refresh from this).
  for (const a of (C.actions || [])) {
    a.used = 0;
    if (a.cd > 0) a.cd -= 1;
  }
}

// --- player-activated actions (Actions menu) --------------------------------
// An action is gated by a cooldown (`every` rounds → `cd` counts down), a resource
// price (`cost` of `res`), and/or a per-round use cap (`per`, `used` this round).
// Using one does NOT advance the world (it happens within the round); draw/skip/
// play tick the world, which is what resets `used` and decrements `cd` above.
const RES_LABEL = { energy: 'Energy', water: 'Water', phosphorus: 'Phosphorus' };
export function actionUsable(state, a) {
  if (!a) return false;
  const net = state.active; if (!net || !net.alive) return false;
  if ((a.cd || 0) > 0) return false;
  if (a.per && (a.used || 0) >= a.per) return false;
  if (a.cost && (net[a.res] || 0) < a.cost) return false;
  return true;
}
export function activateAction(state, i, ctx) {
  const C = state.cards; if (!C) return { ok: false };
  const a = C.actions && C.actions[i]; if (!a) return { ok: false };
  const net = state.active;
  if (!actionUsable(state, a)) {
    let msg = 'That action isn’t ready.';
    if ((a.cd || 0) > 0) msg = `On cooldown — ${a.cd} round${a.cd > 1 ? 's' : ''} left.`;
    else if (a.per && (a.used || 0) >= a.per) msg = 'No uses left this round.';
    else if (a.cost && (net[a.res] || 0) < a.cost) msg = `Need ${a.cost - Math.floor(net[a.res] || 0)} more ${RES_LABEL[a.res] || a.res}.`;
    return { ok: false, message: msg };
  }
  // Targeted abilities need a map point. The first call (from the Use button) has
  // no ctx → ask the caller to aim; the second call (map tap) carries {x,y}. Cost
  // and cooldown are only spent once the effect actually resolves, below.
  if (a.target && (!ctx || ctx.x == null)) return { ok: false, needTarget: true, index: i, message: `Tap a target for ${a.name}.` };
  const res = a.apply ? a.apply(state, ctx) : { ok: true, message: `${a.name}.` };
  if (!res || !res.ok) return { ok: false, message: (res && res.message) || 'Nothing happened.' };
  if (a.cost) net[a.res] -= a.cost;      // pay the price
  if (a.per) a.used = (a.used || 0) + 1;  // spend a use
  if (a.every) a.cd = a.every;            // start the cooldown
  state.log(`Action: ${a.name}. ${res.message || ''}`, 'action');
  return { ok: true, message: res.message };
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
// Aimed plays originate from the part of the ALIVE colony nearest the tapped
// point (any node, not only a frontier tip — whichever strand is closest to
// where you clicked), and grow from there toward the tap. Falls back to the
// frontier centroid only if the network somehow has no nodes. Returns the source
// point `fp`, the source `tip` node (for growth to start from), and the direction
// from that source to the tapped point.
function dirFrom(state, ctx) {
  const tip = state.active.nearestNode(ctx.x, ctx.y);
  const fp = tip ? { x: tip.x, y: tip.y } : (state.active.frontierPoint() || { x: 0, y: state.substrate.surfaceY });
  let dx = ctx.x - fp.x, dy = ctx.y - fp.y;
  if (Math.hypot(dx, dy) < 1) { dx = 1; dy = 0; }
  return { fp, tip, dx, dy };
}
function depositAtSensingEdge(state, ctx, amount, radiusCells) {
  const sub = state.substrate;
  const g = state.config.growth;
  const { fp, dx, dy } = dirFrom(state, ctx);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const clampX = (x) => Math.max(sub.cellSize, Math.min(sub.worldWidth - sub.cellSize, x));
  const clampY = (y) => Math.max(sub.surfaceY + sub.cellSize, Math.min(sub.worldHeight - sub.cellSize, y));
  // Where we'd LIKE it: just inside the sensing edge, in the aimed direction.
  const target = { x: clampX(fp.x + ux * g.sensingRadius * 0.85), y: clampY(fp.y + uy * g.sensingRadius * 0.85) };
  // But growth senses food strictly WITHIN the sensing radius, so the cache MUST
  // land on soil that the colony can actually reach. Scan the soil cells within
  // sensing range of the source tip (excluding cells already at/inside it) and pick
  // the one nearest the aimed target. This guarantees a reachable, on-soil cache —
  // never buried in rock, off the map, or dropped exactly on the un-reachable edge.
  const reachCells = Math.ceil(g.sensingRadius / sub.cellSize);
  const tc = sub.colAtX(fp.x), tr = sub.rowAtY(fp.y);
  const inMin = g.killDistance + sub.cellSize, inMax = g.sensingRadius * 0.9;
  let best = null, bestD = Infinity;
  for (let r = tr - reachCells; r <= tr + reachCells; r++) {
    for (let c = tc - reachCells; c <= tc + reachCells; c++) {
      const cell = sub.cellAt(c, r);
      if (!cell || cell.rock || cell.water) continue;
      const cc = sub.cellCenter(c, r);
      const dTip = Math.hypot(cc.x - fp.x, cc.y - fp.y);
      if (dTip < inMin || dTip > inMax) continue;   // reachable and not already occupied
      const dTgt = (cc.x - target.x) ** 2 + (cc.y - target.y) ** 2;
      if (dTgt < bestD) { bestD = dTgt; best = cc; }
    }
  }
  const at = best || target;   // fallback only if the colony is fully walled in
  sub.deposit(at.x, at.y, amount, radiusCells);
  return { px: at.x, py: at.y };
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
// Remove every node of the active network within radius `r` of the tap. Refuses
// to wipe the whole colony (aim tighter). The key anti-Trichoderma tool: cut off
// an infected region before it spreads. _removeNodes recomputes vitality.
function amputateAt(state, ctx, r) {
  const net = state.active;
  const doomed = new Set();
  for (const n of net.nodes) if ((n.x - ctx.x) ** 2 + (n.y - ctx.y) ** 2 <= r * r) doomed.add(n.id);
  if (!doomed.size) return { ok: false, message: 'No mycelium there to amputate.' };
  if (doomed.size >= net.nodes.length) return { ok: false, message: 'That would remove the whole colony — aim tighter.' };
  net._removeNodes(doomed);
  return { ok: true, message: `Amputated ${doomed.size} strand${doomed.size > 1 ? 's' : ''}.` };
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
// abilityUpgrade(): a one-shot card that permanently shortens ONE chosen installed
// ability's "every N rounds" wait by `n` (min 1). `scope` picks the eligible list
// ('action' → cards.actions, 'engine' → cards.engines); the UI shows a picker and
// replays playCard with ctx.ability = the chosen index. Goes to the discard.
const abilityUpgrade = (scope, n) => ({
  abilityScope: scope,
  abilityAmount: n,
  apply: (state, c, ctx) => {
    const list = scope === 'action' ? state.cards.actions : state.cards.engines;
    const t = list[ctx.ability];
    if (!t) return { ok: false, message: 'That ability is no longer installed.' };
    // "Max 1 speed up per card": each installed ability can be sped up by exactly
    // ONE tempo card, of any kind, ever.
    if (t.tempoUsed) return { ok: false, message: `${t.name} has already been sped up — max 1 speed up per card.` };
    if (!(t.every > 1)) return { ok: false, message: `${t.name} is already at its minimum wait.` };
    const before = t.every;
    t.every = Math.max(1, t.every - n);
    t.tempoUsed = true;
    return { ok: true, message: `${t.name}: wait ${before} → ${t.every} round${t.every > 1 ? 's' : ''}.` };
  },
});
// action(): a card that, when PLAYED, installs a repeatable ability into the
// Actions menu (right) instead of firing once. `spec` holds the activation gating —
// `every` (once-per-N-rounds cooldown), `cost`+`res` (resource price per use),
// `per` (uses per round), `target` (aim a point on the map) — plus a short `effect`
// label for the menu row. `run(state, ctx)` is the ability's effect. The card's
// buy/W/P cost is the one-time INSTALL price (charged by playCard); per-activation
// costs come from `spec.cost`.
const action = (spec, run) => ({ apply: () => ({ ok: true, installAction: { ...spec, apply: run }, message: 'Installed — added to your Actions menu.' }) });
// The colony is at its hard node cap — growth can't add more. Grow cards check
// this first so they report the real reason instead of a misleading "no room".
const maxedOut = (s) => s.active.nodes.length >= s.config.growth.maxNodes;
const MAXED_MSG = 'The colony has reached its maximum size.';

export const EFFECTS = {
  // --- grow (Water) ---
  'Hyphal Extension': grow((s) => {
    if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
    const c = s.active.grow(s.substrate, s.rng);
    return c > 0 ? { ok: true, message: `Grew ${c} filaments toward food.` } : { ok: false, message: 'No food within sensing range.' };
  }),
  'Apical Drive': targeted((s, c, ctx) => {
    if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
    const { dx, dy, tip } = dirFrom(s, ctx);
    const n = s.active.growDirected(s.substrate, s.rng, dx, dy, s.config.cards.directionalSteps, false, tip);
    return n > 0 ? { ok: true, message: `Grew ${n} in your chosen direction.` } : { ok: false, message: 'Blocked — nothing grew that way.' };
  }),
  'Foraging Fan': grow((s) => {
    if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
    // Partial growth always succeeds: every frontier tip with open ground fans
    // out, even if rock walls off the others. Only when NOT ONE tip anywhere can
    // advance do we fail — and then we name the real reason (rock vs. too dense).
    const n = s.active.growRadial(s.substrate, s.rng);
    if (n > 0) return { ok: true, message: `Fanned out and colonised ${n} filaments.` };
    const reason = s.active.fanBlockReason(s.substrate);
    if (reason === 'cap') return { ok: false, message: MAXED_MSG };
    if (reason === 'crowded') return { ok: false, message: 'The colony is packed too tightly here to fan out any further.' };
    return { ok: false, message: 'Rock walls the colony in on every side — nowhere to fan out.' };
  }),
  'Tropic Lunge': grow((s) => {
    // Lunge from the strand closest to ANY food it hasn't reached yet, toward that
    // food — regardless of range (the nearest UNREACHED food on the whole map, even
    // far out of sensing range). Already-colonised piles don't count, so the lunge
    // strikes out toward fresh food instead of doubling back over what it already
    // holds. If a rock walls off the path it still grows as far as it can.
    if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
    const n = s.active.growToNearestFood(s.substrate, s.rng, s.config.cards.lungeSegments);
    if (n > 0) return { ok: true, message: `Lunged ${n} toward the nearest food.` };
    if (s.active.hasFood(s.substrate)) return { ok: false, message: 'Blocked — rock walls off the path to every food source.' };
    return { ok: false, message: 'Every food pile has already been reached — nothing new to lunge toward.' };
  }),
  'Appressorial Punch': targeted((s, c, ctx) => {
    if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
    const n = s.active.punchThrough(s.substrate, s.rng, ctx.x, ctx.y);
    if (n > 0) return { ok: true, message: `Bored through the rock — threaded ${n} hyphae.` };
    if (n < 0) return { ok: false, message: 'That rock is out of range — grow closer first.' };
    return { ok: false, message: 'No rock there to punch through.' };
  }),
  'Rhizomorph Lance': targeted((s, c, ctx) => {
    if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
    const { dx, dy, tip } = dirFrom(s, ctx);
    const n = s.active.growDirected(s.substrate, s.rng, dx, dy, s.config.cards.reachSegments, true, tip);
    return n > 0 ? { ok: true, message: `Lanced ${n} cells forward.` } : { ok: false, message: 'Blocked — the lance hit rock.' };
  }),
  'Fruiting Vigil': targeted((s, c, ctx) => {
    if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
    const { dx, dy, tip } = dirFrom(s, ctx);
    const n = s.active.growDirected(s.substrate, s.rng, dx, dy, 24, true, tip);   // "up to 8 steps" (8 × 3 segments)
    checkGoalReached(s);
    return { ok: true, message: s.won ? 'Reached the goal!' : `Grew ${n} in your chosen direction.` };
  }),

  // --- substrate (Water) ---
  'Leaf Litter Cache': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateSmall, 1); return { ok: true, message: 'Dropped a small patch at the sensing edge.' }; }),
  'Acorn Cache': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateSmall, 1); return { ok: true, message: 'Buried a small nut cache at the sensing edge.' }; }),
  'Humus Bed': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateMedium, 2); return { ok: true, message: 'Laid a medium patch at the sensing edge.' }; }),
  'Mycorrhizal Mat': targeted((s, c, ctx) => { depositAtSensingEdge(s, ctx, s.config.cards.substrateLarge, 3); return { ok: true, message: 'Spread a large mat at the sensing edge.' }; }),

  // --- digest (Phosphorus) ---
  'Saprotrophic Digest': grow((s) => {
    const net = s.active, sub = s.substrate;
    const cells = sub.cells.filter((c) => c.colonized > 0 && c.nutrient > 0 && !c.hazard);
    if (!cells.length) return { ok: false, message: 'No colonised substrate to digest.' };
    const d = s.config.actions.digest;
    let gained = 0;
    for (const cell of cells) { const take = Math.min(cell.nutrient, cell.maxNutrient * d.drainFraction); cell.nutrient -= take; gained += take; }
    const energy = Math.round(gained * s.config.energy.incomeEfficiency * 2);   // doubled
    net.energy += energy;
    return { ok: true, message: `Digest: +${energy}⚡.` };
  }),

  // --- harvest ---
  'Condense': grow((s) => {
    const cc = s.config.cards, before = s.active.water;
    s.active.water = gain(s.active.water, 5, cc.softCapWater);
    const got = s.active.water - before;
    return got > 0 ? { ok: true, message: `+${got} Water.` } : { ok: false, message: 'Water is already full.' };
  }),
  'Hyphal Imbibition': grow((s) => {
    const cc = s.config.cards; const amt = touchesLake(s) ? cc.harvestWaterLake : cc.harvestWaterSoil;
    const before = s.active.water;
    s.active.water = gain(s.active.water, amt, cc.softCapWater);
    const got = s.active.water - before;
    return got > 0 ? { ok: true, message: `+${got} Water${amt === cc.harvestWaterLake ? ' (lake)' : ''}.` } : { ok: false, message: 'Water is already full.' };
  }),
  'Phosphate Tap': grow((s) => {
    if (!touchesMineral(s)) return { ok: false, message: 'Not in contact with mineral rock.' };
    const cc = s.config.cards, before = s.active.phosphorus;
    s.active.phosphorus = gain(s.active.phosphorus, cc.harvestPhosphorus, cc.softCapPhosphorus);
    const got = s.active.phosphorus - before;
    return got > 0 ? { ok: true, message: `+${got} Phosphorus.` } : { ok: false, message: 'Phosphorus is already full.' };
  }),

  // --- energy ---
  'Rhizomorph Trunkline': engine({ energy: 2 }, 'Installed: +2⚡/round.'),
  'Osmotic Cashout': grow((s) => { s.active.energy += 22; return { ok: true, message: '+22⚡.' }; }),

  // --- resource engines ---
  'Aquaporin Channels': engine({ water: 1, every: 2 }, 'Installed: +1 Water every 2 rounds.'),
  'Phosphatase Cushion': engine({ phosphorus: 2, every: 8 }, 'Installed: +2 Phosphorus every 8 rounds.'),
  'Mineralizing Saprobe': engine({ phosphorus: 1, every: 5 }, 'Installed: +1 Phosphorus every 5 rounds.'),

  // --- installed ACTION: bore through an in-range rock on a cooldown ---
  // (Was an auto dig-engine; now a player-triggered ability per the card text.)
  'Tap-Root Rhizomorph': action({ effect: 'grow through an in-range rock', every: 10, cost: 2, res: 'phosphorus', target: true }, (s, ctx) => {
    const n = s.active.punchThrough(s.substrate, s.rng, ctx.x, ctx.y);
    if (n > 0) return { ok: true, message: `Bored through the rock — threaded ${n} hyphae.` };
    if (n < 0) return { ok: false, message: 'That rock is out of range — grow closer first.' };
    return { ok: false, message: 'No rock there to grow through.' };
  }),

  // --- utility (installed ACTION → Actions menu, right) ---
  // Once per round, spend 2 of your larger resource pool to gain 1 of the other.
  'Nutrient Transmutation': action({ effect: 'convert 2 of one resource → 1 of the other', per: 1 }, (s) => {
    const net = s.active;
    const pools = [['water', net.water], ['phosphorus', net.phosphorus]];
    pools.sort((a, b) => b[1] - a[1]);
    const from = pools[0], to = pools[1];
    if (from[1] < 2) return { ok: false, message: 'Need 2 of a resource to convert.' };
    net[from[0]] -= 2; net[to[0]] += 1;
    return { ok: true, message: `Converted 2 ${from[0]} → 1 ${to[0]}.` };
  }),

  // --- defense (best-effort v1) ---
  // Sclerotial Crust (basic) + Rehydration Pulse (event) stay one-shot plays.
  'Sclerotial Crust': targeted((s, c, ctx) => {
    const h = cureRadius(s, ctx, 60);
    // Permanent immunity to BOTH infection (mouldProof) and eating (hardened →
    // worms/ants skip these cells in nematodes.js / ants.js).
    s.substrate.cellsInRadius(ctx.x, ctx.y, 60 + s.substrate.cellSize, (cl) => { cl.mouldProof = 9999; cl.hardened = true; });
    return { ok: true, message: h ? `Hardened & cleared ${h} strands — permanently immune.` : 'Hardened the patch — permanently immune.' };
  }),
  'Rehydration Pulse': targeted((s, c, ctx) => { const h = cureRadius(s, ctx, 60); return { ok: true, message: h ? `Rehydrated ${h} strands.` : 'Rehydrated the area.' }; }),
  // --- installed ACTIONS (→ Actions menu, right) ---
  // Suberin Wall: every 3 rounds, tap a point → cure all infection in radius 80 AND
  // ward the cells there against reinfection for 2 rounds (cell.mouldProof).
  'Suberin Wall': action({ effect: 'clear mould + permanent ward', every: 8, cost: 3, res: 'phosphorus', target: true }, (s, ctx) => {
    const h = cureRadius(s, ctx, 80);
    // Ward a hair wider than the cure (cure tests node position, the ward tests cell
    // centre) so every cured node's cell is warded — no cured-but-unwarded rim.
    s.substrate.cellsInRadius(ctx.x, ctx.y, 80 + s.substrate.cellSize, (cl) => { cl.mouldProof = 9999; });   // permanent reinfection ward
    return { ok: true, message: h ? `Cured ${h} strands; permanently warded.` : 'Permanently warded the area against mould.' };
  }),
  // Constricting Ring: every 6 rounds (free), tap empty ground → lay a trap; the first
  // nematode to enter its radius is digested for +2 Phosphorus (resolved in tickWorld).
  'Constricting Ring': action({ effect: 'trap a nematode → +2✦', every: 6, target: true }, (s, ctx) => {
    const r = s.substrate.cellSize * 2.5;
    const cell = s.substrate.cellAtWorld(ctx.x, ctx.y);
    if (!cell || cell.rock) return { ok: false, message: 'Set the trap on open ground (not rock).' };
    const worms = s.nematodes || [];
    if (worms.some((w) => (w.x - ctx.x) ** 2 + (w.y - ctx.y) ** 2 <= r * r)) {
      return { ok: false, message: 'A nematode is already there — set the trap on empty ground.' };
    }
    (s.traps || (s.traps = [])).push({ x: ctx.x, y: ctx.y, r, reward: 2 });
    return { ok: true, message: 'Set a constricting trap — the next worm to enter is digested.' };
  }),
  // Sclerotial Seal: spend 1 Phosphorus, once per 4 rounds, tap a food pile → ant-proof it for 3 rounds.
  'Sclerotial Seal': action({ effect: 'permanently seal a food pile from ants', every: 10, cost: 1, res: 'phosphorus', target: true }, (s, ctx) => {
    const cell = s.substrate.cellAtWorld(ctx.x, ctx.y);
    if (!cell || cell.nutrient <= 0) return { ok: false, message: 'Tap a food pile to seal it.' };
    s.substrate.cellsInRadius(ctx.x, ctx.y, s.substrate.cellSize * 2, (cl) => { if (cl.nutrient > 0) cl.antProof = 9999; });
    return { ok: true, message: 'Sealed the pile — permanently ant-proof.' };
  }),
};

// Draw-engine cards (ARCHIVED only): shuffle 5 copies of a basic into the draw deck.
for (const [name, payload] of Object.entries(DRAW_ENGINES)) {
  EFFECTS[name] = grow((s) => {
    for (let i = 0; i < 5; i++) s.cards.drawDeck.push(payload);
    shuffle(s.cards.drawDeck, s.rng);
    return { ok: true, message: `Shuffled 5 ${payload} into the draw deck.` };
  });
}

// --- converted extenders --------------------------------------------------
// The former "draw 5 copies of X" extenders are now INSTALLED cards that repeat
// their effect every 6 rounds. Growth / bore / cache / defense ones install as
// player-triggered ACTIONS (right menu): ready every 6 rounds, aim + pay a per-use
// resource. Harvest ones install as passive resource ENGINES (left ledger). All
// cost 8⚡ to install (see docs/cards.json).
EFFECTS['Leading Cord'] = action({ effect: 'grow 2 in a chosen direction', every: 6, cost: 1, res: 'water', target: true }, (s, ctx) => {
  if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
  const { dx, dy, tip } = dirFrom(s, ctx);
  const n = s.active.growDirected(s.substrate, s.rng, dx, dy, s.config.cards.directionalSteps, false, tip);
  return n > 0 ? { ok: true, message: `Grew ${n} in your chosen direction.` } : { ok: false, message: 'Blocked — nothing grew that way.' };
});
EFFECTS['Forager Bloom'] = action({ effect: 'fan out: grow every direction', every: 6, cost: 1, res: 'water' }, (s) => {
  if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
  const n = s.active.growRadial(s.substrate, s.rng);
  if (n > 0) return { ok: true, message: `Fanned out and colonised ${n} filaments.` };
  const reason = s.active.fanBlockReason(s.substrate);
  if (reason === 'cap') return { ok: false, message: MAXED_MSG };
  if (reason === 'crowded') return { ok: false, message: 'Packed too tightly to fan out any further.' };
  return { ok: false, message: 'Rock walls the colony in — nowhere to fan out.' };
});
EFFECTS['Questing Front'] = action({ effect: 'grow 5 steps to the nearest food', every: 6, cost: 2, res: 'water' }, (s) => {
  if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
  const n = s.active.growToNearestFood(s.substrate, s.rng, s.config.cards.lungeSegments);
  if (n > 0) return { ok: true, message: `Lunged ${n} toward the nearest food.` };
  if (s.active.hasFood(s.substrate)) return { ok: false, message: 'Blocked — rock walls off the path to every food source.' };
  return { ok: false, message: 'Every food pile has already been reached.' };
});
EFFECTS['Colonizing Front'] = action({ effect: 'grow toward all food in range', every: 6, cost: 1, res: 'water' }, (s) => {
  if (maxedOut(s)) return { ok: false, message: MAXED_MSG };
  const n = s.active.grow(s.substrate, s.rng);
  return n > 0 ? { ok: true, message: `Grew ${n} filaments toward food.` } : { ok: false, message: 'No food within sensing range.' };
});
EFFECTS['Acorn Fall'] = action({ effect: 'bury a small nut cache', every: 6, cost: 1, res: 'water', target: true }, (s, ctx) => {
  depositAtSensingEdge(s, ctx, s.config.cards.substrateSmall, 1);
  return { ok: true, message: 'Buried a small nut cache at the sensing edge.' };
});
EFFECTS['Crust Reserve'] = action({ effect: 'harden + clear mould (immune after)', every: 6, cost: 2, res: 'phosphorus', target: true }, (s, ctx) => {
  const h = cureRadius(s, ctx, 40);
  s.substrate.cellsInRadius(ctx.x, ctx.y, 40 + s.substrate.cellSize, (cl) => { cl.mouldProof = 9999; });   // immune to future infection
  return { ok: true, message: h ? `Hardened & cleared ${h} strands — immune to future infection.` : 'Hardened the patch — immune to future infection.' };
});
EFFECTS['Capillary Runners'] = engine({ water: 3, every: 6 }, 'Installed: +3 Water every 6 rounds.');
EFFECTS['Dew Traps'] = engine({ water: 2, every: 3 }, 'Installed: +2 Water every 3 rounds.');
EFFECTS['Prospecting Cords'] = engine({ phosphorus: 1, every: 8 }, 'Installed: +1 Phosphorus every 8 rounds.');

// --- tempo upgrades (one-shot, pick ONE installed ability) ----------------
// Permanently shorten the "every N rounds" wait on ONE chosen installed ability
// (min 1). The action set speeds up a player ACTION (right menu, e.g. Leading
// Cord); the engine set speeds up a resource ENGINE (left pill, e.g. Prospecting
// Cords). Bigger reduction = higher install cost (see docs/cards.json).
EFFECTS['Quickened Reflex'] = abilityUpgrade('action', 1);
EFFECTS['Impulse Relay'] = abilityUpgrade('action', 2);
EFFECTS['Hair-Trigger Hyphae'] = abilityUpgrade('action', 3);
EFFECTS['Brisk Metabolism'] = abilityUpgrade('engine', 1);
EFFECTS['Enzyme Overclock'] = abilityUpgrade('engine', 2);
EFFECTS['Metabolic Surge'] = abilityUpgrade('engine', 3);

// --- energy bursts (one-shot: pay Phosphorus → gain a lump of Energy) --------
// Sizes scale a touch better per-P as they get bigger. P cost is charged from
// data (playCostPhosphorus), like Osmotic Cashout.
EFFECTS['Turgor Spark'] = grow((s) => { s.active.energy += 13; return { ok: true, message: '+13⚡.' }; });
EFFECTS['Vacuolar Burst'] = grow((s) => { s.active.energy += 33; return { ok: true, message: '+33⚡.' }; });
EFFECTS['Glycogen Crush'] = grow((s) => { s.active.energy += 54; return { ok: true, message: '+54⚡.' }; });
EFFECTS['Cytoplasmic Cascade'] = grow((s) => { s.active.energy += 82; return { ok: true, message: '+82⚡.' }; });

// --- energy engines (installed: +N⚡/round; total energy income clamped by cc) -
EFFECTS['Cord Capillary'] = engine({ energy: 1 }, 'Installed: +1⚡/round.');
EFFECTS['Rhizomorph Dynamo'] = engine({ energy: 3 }, 'Installed: +3⚡/round.');

// --- amputate (anti-Trichoderma): remove mycelium in a radius ----------------
// One-shot basic (tap to cut) + an installed ACTION version on a cooldown.
EFFECTS['Amputate'] = targeted((s, c, ctx) => amputateAt(s, ctx, s.config.cards.amputateRadius));
EFFECTS['Severing Cords'] = action({ effect: 'amputate mycelium in a radius', every: 8, cost: 2, res: 'phosphorus', target: true },
  (s, ctx) => amputateAt(s, ctx, s.config.cards.amputateRadius));

// --- Sclerotial Rind: the installed-ACTION version of Sclerotial Crust --------
// Every 6 rounds, pay 1 P to harden strands in a radius — permanent immunity to
// BOTH infection (mouldProof) and eating (hardened), same as the one-shot Crust.
EFFECTS['Sclerotial Rind'] = action({ effect: 'harden + clear mould (immune)', every: 6, cost: 1, res: 'phosphorus', target: true }, (s, ctx) => {
  const h = cureRadius(s, ctx, 60);
  s.substrate.cellsInRadius(ctx.x, ctx.y, 60 + s.substrate.cellSize, (cl) => { cl.mouldProof = 9999; cl.hardened = true; });
  return { ok: true, message: h ? `Hardened & cleared ${h} strands — permanently immune.` : 'Hardened the patch — permanently immune.' };
});

// --- anti-nematode & anti-ant predation (real fungal biology) ----------------
// Fungi kill nematodes two ways and parasitise ant colonies three cards model:
//   • Constricting ring (Drechslerella) — a 3-celled ring inflates in ~0.1 s and
//     throttles ONE passing worm. Constricting Snap fires it on the nearest worm now.
//   • Toxocysts (Pleurotus, the oyster mushroom) — hyphae bristle with droplet
//     glands that paralyse EVERY worm they touch. Toxocyst Burst/Array clear a radius.
//   • Ophiocordyceps (the "zombie-ant" fungus) — threads a nest, then erupts fruiting
//     stalks from its workers, collapsing it. Cordyceps Bloom/Stroma destroy a sensed nest.
const gainPhos = (net, r, cap) => { net.phosphorus = Math.max(net.phosphorus, Math.min(cap, net.phosphorus + r)); };

// Digest every nematode within `r` of (x,y); returns how many were removed.
function killWormsInRadius(state, x, y, r) {
  const worms = state.nematodes;
  if (!worms || !worms.length) return 0;
  const r2 = r * r, survivors = [];
  let killed = 0;
  for (const w of worms) { if ((w.x - x) ** 2 + (w.y - y) ** 2 <= r2) killed++; else survivors.push(w); }
  state.nematodes = survivors;
  return killed;
}

// Nearest ant nest whose closest colony node is within sensing range; null if none.
function nestInSensingRange(state) {
  const nests = state.ants || [];
  if (!nests.length) return null;
  const sense2 = state.config.growth.sensingRadius ** 2;
  let best = null, bd = Infinity;
  for (const nest of nests) {
    const nn = state.active.nearestNode(nest.x, nest.y);
    if (!nn) continue;
    const d = (nn.x - nest.x) ** 2 + (nn.y - nest.y) ** 2;
    if (d <= sense2 && d < bd) { bd = d; best = nest; }
  }
  return best;
}
function eruptNearestNest(state) {
  const nest = nestInSensingRange(state);
  if (!nest) return { ok: false, message: 'No ant nest within sensing range — grow closer first.' };
  attackNest(state, nest.x, nest.y, state.substrate.cellSize, 1);   // frac 1 → destroy outright
  return { ok: true, message: 'Cordyceps erupted through the nest — the raiding column is gone.' };
}

// 1. Constricting Snap — EVENT version of Constricting Ring: throttle the nearest worm now.
EFFECTS['Constricting Snap'] = targeted((s, c, ctx) => {
  const worms = s.nematodes || [], r2 = s.config.cards.snapRadius ** 2;
  let wi = -1, bd = r2;
  for (let i = 0; i < worms.length; i++) {
    const d = (worms[i].x - ctx.x) ** 2 + (worms[i].y - ctx.y) ** 2;
    if (d <= bd) { bd = d; wi = i; }
  }
  if (wi < 0) return { ok: false, message: 'No nematode within reach of the ring.' };
  worms.splice(wi, 1);
  gainPhos(s.active, 3, s.config.cards.softCapPhosphorus);
  return { ok: true, message: 'Throttled and digested a nematode: +3 Phosphorus.' };
});

// 2a. Toxocyst Burst — EVENT: paralyse & digest EVERY worm in a radius (+1 P each).
EFFECTS['Toxocyst Burst'] = targeted((s, c, ctx) => {
  const n = killWormsInRadius(s, ctx.x, ctx.y, s.config.cards.toxocystRadius);
  if (!n) return { ok: false, message: 'No nematodes in range.' };
  gainPhos(s.active, n, s.config.cards.softCapPhosphorus);
  return { ok: true, message: `Toxin paralysed ${n} nematode${n > 1 ? 's' : ''}: +${n} Phosphorus.` };
});

// 2b. Toxocyst Array — installed ACTION (engine): clear a radius of worms every 8 rounds (no reward).
EFFECTS['Toxocyst Array'] = action({ effect: 'digest every worm in a radius', every: 8, target: true }, (s, ctx) => {
  const n = killWormsInRadius(s, ctx.x, ctx.y, s.config.cards.toxocystRadius);
  return n ? { ok: true, message: `Toxocysts cleared ${n} nematode${n > 1 ? 's' : ''}.` } : { ok: false, message: 'No nematodes in range.' };
});

// 3a. Cordyceps Bloom — EVENT: destroy the nearest ant nest within sensing range.
EFFECTS['Cordyceps Bloom'] = grow((s) => eruptNearestNest(s));

// 3b. Cordyceps Stroma — installed ACTION (engine): destroy a sensed ant nest every 10 rounds.
EFFECTS['Cordyceps Stroma'] = action({ effect: 'destroy a sensed ant nest', every: 10 }, (s) => eruptNearestNest(s));
