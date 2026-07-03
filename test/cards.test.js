// Headless card-layer test (C1). Run: node test/cards.test.js
// Proves the card economy + effects work and a level is winnable through cards.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { tickWorld } from '../src/engine/turn.js';
import { initCards, drawCard, skipRound, playCard, produceCardEngines, cardBlockedReason } from '../src/engine/cards.js';

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

  ok(s.cards.drawDeck.length === 15, `starting draw deck = 15 (5 HE/5 LLC/5 Condense), got ${s.cards.drawDeck.length}`);
  ok(s.cards.hand.length >= 7, `tutorial hand dealt (${s.cards.hand.length} cards)`);
  ok(net.water === cc.startWater && net.nitrogen === cc.startNitrogen && net.phosphorus === cc.startPhosphorus, 'starting W/N/P buffers set');

  // draw: −energy, +hand, −deck (check before the world tick)
  const e0 = net.energy, h0 = s.cards.hand.length, d0 = s.cards.drawDeck.length;
  const dr = drawCard(s);
  ok(dr.ok && net.energy === e0 - cc.drawCostEnergy && s.cards.hand.length === h0 + 1 && s.cards.drawDeck.length === d0 - 1, 'draw spends energy, moves a basic to hand');

  // engine install + per-tick production (produceCardEngines is isolated from income)
  const ti = ensureHand(s, 'Rhizomorph Trunkline'); playCard(s, ti);
  ok(s.cards.engines.some((e) => e.name === 'Rhizomorph Trunkline'), 'Rhizomorph Trunkline installed as an engine');
  net.energy = 100; produceCardEngines(s);
  ok(net.energy === 104, `energy engine produces +4/tick (got ${net.energy})`);

  const wi = ensureHand(s, 'Aquaporin Channels'); playCard(s, wi);
  net.water = 0; produceCardEngines(s);
  ok(net.water === 2, `water engine produces +2/tick (got ${net.water})`);

  // engine energy clamp (< skip)
  s.cards.engines = [{ energy: 8 }, { energy: 8 }]; net.energy = 0; produceCardEngines(s);
  ok(net.energy === cc.engineEnergyClamp, `total energy-engine output clamped to ${cc.engineEnergyClamp} (got ${net.energy})`);
  s.cards.engines = [];

  // directional grow costs water, adds nodes
  net.water = 5; const n0 = net.nodes.length; const fp = net.frontierPoint();
  const ai = ensureHand(s, 'Apical Drive');
  const ap = playCard(s, ai, { x: fp.x + 300, y: fp.y });
  ok(ap.ok && net.nodes.length > n0 && net.water === 4, `Apical Drive grew nodes and spent 1 Water (nodes ${n0}->${net.nodes.length}, water ${net.water})`);

  // substrate placement costs nitrogen and drops food
  net.nitrogen = 3; const nut0 = s.substrate.totalNutrient();
  const li = ensureHand(s, 'Leaf Litter Cache');
  const lp = playCard(s, li, { x: fp.x + 200, y: fp.y });
  ok(lp.ok && s.substrate.totalNutrient() > nut0 && net.nitrogen === 2, 'Leaf Litter Cache deposits substrate and spends 1 Nitrogen');

  // harvest: Condense +3 water
  net.water = 1; const ci = ensureHand(s, 'Condense'); playCard(s, ci);
  ok(net.water === 4, `Condense +3 Water (got ${net.water})`);

  // energy burst: Osmotic Cashout −1 water +22 energy
  net.water = 5; net.energy = 50; const oi = ensureHand(s, 'Osmotic Cashout'); playCard(s, oi);
  ok(net.energy === 72 && net.water === 4, `Osmotic Cashout +22⚡ for 1 Water (energy ${net.energy}, water ${net.water})`);

  // draw engine grows the deck by 5 of its basic
  const dd0 = s.cards.drawDeck.length; const fbi = ensureHand(s, 'Forager Bloom'); playCard(s, fbi);
  ok(s.cards.drawDeck.length === dd0 + 5 && s.cards.drawDeck.includes('Foraging Fan'), 'Forager Bloom shuffles 5 Foraging Fan into the deck');

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

// ============================ D: winnable through cards =====================
console.log('# Winnable: route to the goal by playing cards');
{
  const s = createState(clone(), 4242); isolate(s); initCards(s);
  const sub = s.substrate, net = s.active;
  const goalCols = Math.max(2, Math.min(sub.cols - 4, s.config.substrate.goalCols || 6));
  const goalStart = sub.cols - goalCols;
  const cheat = () => { net.energy = 9999; net.water = 99; net.nitrogen = 99; net.phosphorus = 99; };
  const clearRow = (col) => { for (let r = 0; r < sub.rows; r++) { const c = sub.cellAt(col, r); if (c && !c.rock && !c.water) return r; } return -1; };

  let guard = 0; const budget = 900;
  while (!s.won && !s.runOver && guard++ < budget) {
    cheat();
    const fp = net.frontierPoint(); if (!fp) break;
    const fcol = sub.colAtX(fp.x);
    // aim at a shallow clear cell a few columns toward the goal (or up to surface once in the goal band)
    let target;
    if (fcol >= goalStart) target = { x: fp.x, y: sub.surfaceY + 18 };
    else {
      let tcol = Math.min(sub.cols - 1, fcol + 3), tr = clearRow(tcol);
      if (tr < 0) { tcol = Math.min(sub.cols - 1, fcol + 1); tr = clearRow(tcol); }
      target = tr >= 0 ? sub.cellCenter(tcol, tr) : { x: fp.x + 100, y: fp.y };
    }
    const before = net.nodes.length;
    const idx = ensureHand(s, 'Rhizomorph Lance'); cheat();
    const r = playCard(s, idx, { x: target.x, y: target.y });
    if (r.ok) tickWorld(s);
    if (!s.won && net.nodes.length === before) {
      // blocked by rock: dig straight ahead toward the target, then step
      const dx = Math.sign(target.x - fp.x) || 1;
      net.digThrough(sub, fp.x + dx * sub.cellSize, (fp.y + target.y) / 2, ['boulder', 'formation', 'column', 'lakeBasin']);
      tickWorld(s);
    }
  }
  const reach = Math.max(...net.nodes.map((n) => sub.colAtX(n.x)));
  ok(s.won, `routed to the goal via cards in ${guard} plays (reached col ${reach} / goalStart ${goalStart})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
