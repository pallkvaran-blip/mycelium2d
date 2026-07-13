// Headless card-layer test (C1). Run: node test/cards.test.js
// Proves the card economy + effects work and a level is winnable through cards.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { tickWorld } from '../src/engine/turn.js';
import { initCards, drawCard, skipRound, playCard, produceCardEngines, cardBlockedReason, chooseOffer } from '../src/engine/cards.js';
import { CARD_BY_NAME } from '../src/cards-data.js';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ok  -', m); } else { failed++; console.error('  FAIL-', m); } };

function isolate(s) {
  s.clouds = []; s.ants = []; s.nematodes = [];
  s.config.trichoderma.initialPatches = 0; s.config.trichoderma.respawnChance = 0;
  s.config.nematodes.respawnChance = 0;
}
const hIdx = (s, name) => s.cards.hand.findIndex((h) => h.name === name);
function ensureHand(s, name) { let i = hIdx(s, name); if (i < 0) { s.cards.hand.push({ id: s.cards.seq++, name }); i = s.cards.hand.length - 1; } return i; }
const clone = () => JSON.parse(JSON.stringify(CONFIG));

// ============================ A: economy + effects ==========================
console.log('# Card economy + effects');
{
  const s = createState(clone(), 777); isolate(s); initCards(s);
  const net = s.active, cc = s.config.cards;

  ok(s.cards.hand.length === cc.drawCount, `hand starts with a free opening draw of ${cc.drawCount} (got ${s.cards.hand.length})`);
  ok(s.cards.drawDeck.length === 15 - cc.drawCount, `starting draw deck = ${15 - cc.drawCount} (15 built minus the ${cc.drawCount}-card opening hand), got ${s.cards.drawDeck.length}`);
  ok(net.water === cc.startWater && net.phosphorus === cc.startPhosphorus, 'starting W/P buffers set');

  // draw: −energy, +drawCount to hand, −drawCount from deck (check before the world tick)
  const e0 = net.energy, h0 = s.cards.hand.length, d0 = s.cards.drawDeck.length;
  const dr = drawCard(s);
  ok(dr.ok && net.energy === e0 - cc.drawCostEnergy && s.cards.hand.length === h0 + cc.drawCount && s.cards.drawDeck.length === d0 - cc.drawCount, `draw spends energy, pulls ${cc.drawCount} basics to hand`);

  // playing a premium card costs its Energy (buyCostEnergy); basics are free to play
  net.energy = 100;
  const ti = ensureHand(s, 'Rhizomorph Trunkline'); playCard(s, ti);
  ok(s.cards.engines.some((e) => e.name === 'Rhizomorph Trunkline'), 'Rhizomorph Trunkline installed as an engine');
  ok(net.energy === 100 - 9, `playing a premium card spends its Energy cost (100 -> ${net.energy}, cost 9)`);
  net.energy = 100; produceCardEngines(s);
  ok(net.energy === 102, `energy engine produces +2/tick (got ${net.energy})`);

  net.energy = 100;
  const wi = ensureHand(s, 'Aquaporin Channels'); playCard(s, wi);
  net.water = 0; produceCardEngines(s);
  ok(net.water === 0, 'water engine does not produce on the off-round (every 2 rounds)');
  produceCardEngines(s);
  ok(net.water === 1, `water engine produces +1 every 2 rounds (got ${net.water})`);

  // engine energy clamp (< skip)
  s.cards.engines = [{ energy: 8 }, { energy: 8 }]; net.energy = 0; produceCardEngines(s);
  ok(net.energy === cc.engineEnergyClamp, `total energy-engine output clamped to ${cc.engineEnergyClamp} (got ${net.energy})`);
  s.cards.engines = [];

  // directional grow costs water, adds nodes
  net.water = 5; const n0 = net.nodes.length; const fp = net.frontierPoint();
  const ai = ensureHand(s, 'Apical Drive');
  const ap = playCard(s, ai, { x: fp.x + 300, y: fp.y });
  ok(ap.ok && net.nodes.length > n0 && net.water === 4, `Apical Drive grew nodes and spent 1 Water (nodes ${n0}->${net.nodes.length}, water ${net.water})`);

  // substrate placement costs WATER and drops food (two-resource model)
  net.water = 3; const nut0 = s.substrate.totalNutrient();
  const li = ensureHand(s, 'Leaf Litter Cache');
  const lp = playCard(s, li, { x: fp.x + 200, y: fp.y });
  ok(lp.ok && s.substrate.totalNutrient() > nut0 && net.water === 2, 'Leaf Litter Cache deposits substrate and spends 1 Water');

  // harvest: Condense +3 water
  net.water = 1; const ci = ensureHand(s, 'Condense'); playCard(s, ci);
  ok(net.water === 4, `Condense +3 Water (got ${net.water})`);

  // energy burst: Osmotic Cashout now costs 4 Phosphorus (0⚡ buy), yields +22⚡
  net.energy = 50; net.phosphorus = 9; const oi = ensureHand(s, 'Osmotic Cashout'); playCard(s, oi);
  ok(net.energy === 50 + 22 && net.phosphorus === 5, `Osmotic Cashout: +22⚡ effect, −4 Phosphorus (energy ${net.energy}, phos ${net.phosphorus})`);

  // energy gate: a premium card is unplayable without its Energy cost
  net.energy = 3; net.water = 9; net.phosphorus = 9;
  ok(/Energy/.test(cardBlockedReason(s, 'Hair-Trigger Hyphae') || ''), 'a premium card is blocked with too little Energy');

  // converted extender: Forager Bloom now INSTALLS as an every-6-rounds action
  net.energy = 100;
  const acts0 = s.cards.actions.length; const fbi = ensureHand(s, 'Forager Bloom'); playCard(s, fbi);
  const fb = s.cards.actions.find((a) => a.name === 'Forager Bloom');
  ok(s.cards.actions.length === acts0 + 1 && fb && fb.every === 6 && fb.cost === 1 && fb.res === 'water',
    'Forager Bloom installs as an every-6-rounds action (1 Water/use)');

  // resource gate blocks an unaffordable play
  net.water = 0;
  ok(cardBlockedReason(s, 'Apical Drive') && /Water/.test(cardBlockedReason(s, 'Apical Drive')), 'a grow is blocked with no Water');
  const gi = ensureHand(s, 'Apical Drive'); const blocked = playCard(s, gi);
  ok(!blocked.ok, 'playCard refuses an unaffordable card');
}

// ============================ B: goal-win detection =========================
console.log('# Goal win: a strand reaching the goal zone wins');
{
  const s = createState(clone(), 999); isolate(s); initCards(s);
  const sub = s.substrate, net = s.active;
  const goalCol = sub.surface.findIndex((x) => x.goal);
  ok(goalCol >= 0, 'goal zone exists on the surface');
  const cx = goalCol * sub.cellSize + sub.cellSize / 2;
  net.addNode(cx, sub.surfaceY + 20, net.root);
  net.energy = 50;
  tickWorld(s);
  ok(s.won === true && s.runOver === true, 'reaching the goal zone sets won/runOver');
}

// ============================ C: card-dry death =============================
console.log('# Card-dry + broke = death');
{
  const s = createState(clone(), 111); isolate(s); initCards(s);
  s.cards.drawDeck = []; s.cards.hand = []; s.active.energy = 0;
  tickWorld(s);
  ok(s.runOver === true && s.runResult && s.runResult.died, 'card-dry with no energy ends the run');
}
{
  // Stall: deck NOT empty but Energy < draw cost, no Water, unplayable hand, no draft.
  // Must end the run (not silently freeze) now that Draw (16) costs more than Skip (12).
  const s = createState(clone(), 222); isolate(s); initCards(s);
  s.cards.drawDeck = ['Hyphal Extension'];            // deck has cards…
  s.cards.hand = [{ id: s.cards.seq++, name: 'Hyphal Extension' }];  // …but only a 1-Water card
  s.active.water = 0; s.active.phosphorus = 0; s.active.energy = 10;  // < draw 16 and < skip 12
  tickWorld(s);
  ok(s.runOver === true && s.runResult && s.runResult.died, 'a no-affordable-move stall (deck left, Energy < draw cost) ends the run');
}

// ============================ D: winnable through cards =====================
console.log('# Winnable: route to the goal by playing cards');
{
  const s = createState(clone(), 4242); isolate(s); initCards(s);
  const sub = s.substrate, net = s.active;
  const goalCols = Math.max(2, Math.min(sub.cols - 4, s.config.substrate.goalCols || 6));
  const goalStart = sub.cols - goalCols;
  const cheat = () => { net.energy = 9999; net.water = 99; net.phosphorus = 99; };
  const clearRow = (col) => { for (let r = 0; r < sub.rows; r++) { const c = sub.cellAt(col, r); if (c && !c.rock && !c.water) return r; } return -1; };

  // Aim from the LEADING edge (right-most living strand) toward the goal — that's
  // how a player routes. (The frontier centroid now lags the leading edge, because
  // reaching a food pile colonises + digests it in one step rather than letting
  // food-seeking growth keep spreading the whole colony forward.)
  const leadNode = () => {
    let best = null;
    for (const n of net.nodes) if (!n.infected && (!best || n.x > best.x)) best = n;
    return best || net.nodes[0];
  };
  let guard = 0; const budget = 900;
  while (!s.won && !s.runOver && guard++ < budget) {
    cheat();
    const lead = leadNode(); const lcol = sub.colAtX(lead.x);
    // aim at a shallow clear cell a few columns toward the goal (or up to surface once in the goal band)
    let target;
    if (lcol >= goalStart) target = { x: lead.x, y: sub.surfaceY + 18 };
    else {
      let tcol = Math.min(sub.cols - 1, lcol + 3), tr = clearRow(tcol);
      if (tr < 0) { tcol = Math.min(sub.cols - 1, lcol + 1); tr = clearRow(tcol); }
      target = tr >= 0 ? sub.cellCenter(tcol, tr) : { x: lead.x + 100, y: lead.y };
    }
    // Track the forward FRONTIER (max column), not the node count: growing into a
    // pile now colonises it (spawning mat nodes), so "node count unchanged" no
    // longer means "the lance was blocked". If the frontier didn't advance, dig.
    const reachBefore = Math.max(...net.nodes.map((n) => sub.colAtX(n.x)));
    const idx = ensureHand(s, 'Rhizomorph Lance'); cheat();
    const r = playCard(s, idx, { x: target.x, y: target.y });
    if (r.ok) tickWorld(s);
    const reachAfter = Math.max(...net.nodes.map((n) => sub.colAtX(n.x)));
    if (!s.won && reachAfter <= reachBefore) {
      // blocked by rock: dig straight ahead from the leading edge, then step
      const dx = Math.sign(target.x - lead.x) || 1;
      net.digThrough(sub, lead.x + dx * sub.cellSize, (lead.y + target.y) / 2, ['boulder', 'formation', 'column', 'lakeBasin']);
      tickWorld(s);
    }
  }
  const reach = Math.max(...net.nodes.map((n) => sub.colAtX(n.x)));
  ok(s.won, `routed to the goal via cards in ${guard} plays (reached col ${reach} / goalStart ${goalStart})`);
}

// ============================ E: pile-reward draft ==========================
console.log('# Finishing a MAP food pile drafts a card; player piles do not');
{
  const s = createState(clone(), 20260703); isolate(s); initCards(s);
  const sub = s.substrate, net = s.active;
  ok(sub.foodPiles && sub.foodPiles.length > 0, `map food piles registered (${sub.foodPiles ? sub.foodPiles.length : 0})`);

  // Take the first map pile: mark it colonized and fully drained, then tick.
  const pile = sub.foodPiles[0];
  for (const idx of pile.cells) { sub.cells[idx].colonized = 1; sub.cells[idx].nutrient = 0; }
  net.energy = 50;
  const offers0 = s.cards.pendingOffers.length;
  tickWorld(s);
  ok(s.cards.pendingOffers.length === offers0 + 1, 'finishing a colonized map pile queues a draft offer');
  const offer = s.cards.pendingOffers[0];
  ok(offer && offer.choices.length === 3, `draft offers 3 cards (got ${offer ? offer.choices.length : 0})`);
  ok(offer.choices.every((n) => CARD_BY_NAME[n] && CARD_BY_NAME[n].tutorial), 'all offered cards are from the tutorial set');

  // Choosing adds it to hand for free — no Energy or resources spent to acquire.
  const e0 = net.energy, h0 = s.cards.hand.length;
  const cr = chooseOffer(s, offer.choices[0]);
  ok(cr.ok && s.cards.hand.length === h0 + 1 && net.energy === e0, 'drafting a card adds it to hand for free (no cost)');
  ok(s.cards.pendingOffers.length === offers0, 'the resolved offer is cleared from the queue');

  // A pile the PLAYER placed grants NO draft (only map piles are tracked).
  for (const p of sub.foodPiles) p.rewarded = true;     // neutralize any overlap
  const before = s.cards.pendingOffers.length;
  const px = sub.cellSize * 4, py = sub.surfaceY + sub.cellSize * 3;
  sub.deposit(px, py, s.config.cards.substrateSmall, 1);
  sub.cellsInRadius(px, py, sub.cellSize * 1.6, (cell) => { if (cell.maxNutrient > 0 && !cell.rock) { cell.colonized = 1; cell.nutrient = 0; } });
  net.energy = 50;
  tickWorld(s);
  ok(s.cards.pendingOffers.length === before, 'finishing a player-placed pile grants NO draft');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
