// Headless card-layer test (C1). Run: node test/cards.test.js
// Proves the card economy + effects work and a level is winnable through cards.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { tickWorld } from '../src/engine/turn.js';
import { initCards, drawCard, skipRound, playCard, produceCardEngines, cardBlockedReason, chooseOffer, activateAction } from '../src/engine/cards.js';
import { CARD_BY_NAME, CARD_DATA } from '../src/cards-data.js';
const ARCHIVED_TEST = new Set(['Leaf Litter Cache', 'Humus Bed', 'Mycorrhizal Mat', 'Leaf Fall', 'Humus Cache', 'Symbiont Weave', 'Saprotrophic Digest', 'Enzyme Priming']);
const BUILT_DECK = CARD_DATA.filter((c) => !ARCHIVED_TEST.has(c.name)).reduce((n, c) => n + (c.startCopies || 0), 0);

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
  ok(s.cards.drawDeck.length === BUILT_DECK - cc.drawCount, `starting draw deck = ${BUILT_DECK - cc.drawCount} (${BUILT_DECK} built minus the ${cc.drawCount}-card opening hand), got ${s.cards.drawDeck.length}`);
  ok(net.water === cc.startWater && net.phosphorus === cc.startPhosphorus, 'starting W/P buffers set');

  // draw: −energy, +drawCount to hand, −drawCount from deck (check before the world tick)
  const e0 = net.energy, h0 = s.cards.hand.length, d0 = s.cards.drawDeck.length;
  const dr = drawCard(s);
  ok(dr.ok && net.energy === e0 - cc.drawCostEnergy && s.cards.hand.length === h0 + cc.drawCount && s.cards.drawDeck.length === d0 - cc.drawCount, `draw spends energy, pulls ${cc.drawCount} basics to hand`);

  // playing a premium card costs its Energy (buyCostEnergy); basics are free to play
  net.energy = 100;
  const ti = ensureHand(s, 'Rhizomorph Trunkline'); playCard(s, ti);
  ok(s.cards.engines.some((e) => e.name === 'Rhizomorph Trunkline'), 'Rhizomorph Trunkline installed as an engine');
  ok(net.energy === 100 - 8, `playing a premium card spends its Energy cost (100 -> ${net.energy}, cost 8)`);
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

  // harvest: Condense +5 water
  net.water = 1; const ci = ensureHand(s, 'Condense'); playCard(s, ci);
  ok(net.water === 6, `Condense +5 Water (got ${net.water})`);

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

  // Take the first NORMAL (draft-granting) map pile — duff piles grant no draft and
  // engine piles offer engines; index 0 isn't guaranteed to be normal.
  const pile = sub.foodPiles.find((p) => (p.kind || 'normal') === 'normal');
  ok(pile, 'has at least one normal (draft-granting) map pile');
  for (const idx of pile.cells) { sub.cells[idx].colonized = 1; sub.cells[idx].nutrient = 0; }
  net.energy = 50;
  const offers0 = s.cards.pendingOffers.length;
  tickWorld(s);
  ok(s.cards.pendingOffers.length === offers0 + 1, 'finishing a colonized map pile queues a draft offer');
  const offer = s.cards.pendingOffers[0];
  ok(offer && offer.choices.length === 3, `draft offers 3 cards (got ${offer ? offer.choices.length : 0})`);
  const dcat = (n) => { const c = CARD_BY_NAME[n]; return (c && (c.displayCategory || c.type)) || ''; };
  ok(offer.choices.every((n) => dcat(n) === 'basic' || dcat(n) === 'event'), 'a NORMAL pile offers only Basic/Event cards (no engines)');
  ok(!offer.kind || offer.kind === 'normal', `normal pile offer is tagged normal (got ${offer.kind})`);

  // Choosing adds it to hand for free — no Energy or resources spent to acquire.
  // (Copies vary: a basic grants 3, an event 1 — assert on cr.copies, not a fixed +1.)
  const e0 = net.energy, h0 = s.cards.hand.length;
  const cr = chooseOffer(s, offer.choices[0]);
  ok(cr.ok && s.cards.hand.length === h0 + cr.copies && net.energy === e0, `drafting a card adds ${cr.copies} to hand for free (no cost)`);
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

// ============================ E2: engine-cache draft ========================
console.log('# Engine caches are RED-leaf food piles that draft ENGINE cards on digest');
{
  const cfg = clone(); cfg.substrate.engineClusterMin = cfg.substrate.engineClusterMax = 4;   // fixed count for this test (live maps randomise 1–3)
  const s = createState(cfg, 20260714); isolate(s); initCards(s);
  const sub = s.substrate, net = s.active;
  const engPiles = (sub.foodPiles || []).filter((p) => p.kind === 'engine');
  ok(engPiles.length >= 2 && engPiles.length <= 4, `map registers the forced engine caches (got ${engPiles.length})`);
  // Engine caches are near the surface; their cells carry the distinct red-leaf foodKind.
  const engRows = engPiles.flatMap((p) => p.cells.map((idx) => Math.floor(idx / sub.cols)));
  ok(Math.min(...engRows) <= (s.config.substrate.engineSurfaceRows + 1), 'engine caches placed near the surface');
  ok(engPiles.every((p) => p.cells.every((idx) => sub.cells[idx].foodKind === 'cache-engine')), 'engine cache cells use the red-leaf foodKind');
  ok((sub.foodPiles || []).filter((p) => (p.kind || 'normal') === 'normal').every((p) => p.cells.every((idx) => sub.cells[idx].foodKind === 'cache')), 'normal cache cells keep the orange-leaf foodKind');

  // Colonise + fully digest one engine pile → it drafts on clearing, like a normal pile.
  const pile = engPiles[0];
  for (const idx of pile.cells) { sub.cells[idx].colonized = 1; sub.cells[idx].nutrient = 0; }
  net.energy = 50;
  const offers0 = s.cards.pendingOffers.length;
  tickWorld(s);
  ok(s.cards.pendingOffers.length === offers0 + 1, 'finishing a colonized engine cache queues a draft offer');
  const offer = s.cards.pendingOffers[0];
  const dcat2 = (n) => { const c = CARD_BY_NAME[n]; return (c && (c.displayCategory || c.type)) || ''; };
  ok(offer && offer.kind === 'engine', `the engine cache drafts an engine-kind offer (got ${offer ? offer.kind : 'none'})`);
  ok(offer && offer.choices.length === 3 && offer.choices.every((n) => dcat2(n) === 'engine'), 'an ENGINE cache offers only Engine cards');
  ok(offer && offer.center, 'the offer is anchored at the pile for the fly-in animation');
}

// ===================== E3: draft rules (infinite basics/events vs unique engines) =====
console.log('# Drafting: basics infinite (3 copies), events infinite (1 copy), engines unique');
{
  const dcat = (n) => { const c = CARD_BY_NAME[n]; return (c && (c.displayCategory || c.type)) || ''; };
  // A BASIC draft grants 3 copies; it is infinite (never in the unique pool).
  {
    const s = createState(clone(), 7001); isolate(s); initCards(s);
    const C = s.cards;
    const basic = CARD_DATA.find((c) => (c.displayCategory || c.type) === 'basic' && CARD_BY_NAME[c.name]).name;
    const h0 = C.hand.length, poolLen = C.draftable.length;
    C.pendingOffers.push({ choices: [basic], kind: 'normal' });
    const r = chooseOffer(s, basic);
    ok(r.ok && C.hand.length === h0 + 3 && C.hand.filter((h) => h.name === basic).length >= 3, `drafting a BASIC adds 3 copies (hand +${C.hand.length - h0})`);
    ok(C.draftable.length === poolLen && !C.draftable.includes(basic), 'a basic never enters/leaves the unique pool (infinite)');
  }
  // An EVENT draft grants exactly 1 copy, is INFINITE (not consumed), and can be drafted again.
  {
    const s = createState(clone(), 7002); isolate(s); initCards(s);
    const C = s.cards;
    const ev = CARD_DATA.find((c) => (c.displayCategory || c.type) === 'event' && CARD_BY_NAME[c.name]).name;
    const h0 = C.hand.length, poolLen = C.draftable.length;
    ok(!C.draftable.includes(ev), 'events are NOT in the unique pool');
    C.pendingOffers.push({ choices: [ev], kind: 'normal' });
    const r1 = chooseOffer(s, ev);
    ok(r1.ok && r1.copies === 1 && C.hand.length === h0 + 1, 'drafting an EVENT adds exactly 1 copy');
    ok(C.draftable.length === poolLen, 'events never touch the unique pool (infinite)');
    C.pendingOffers.push({ choices: [ev], kind: 'normal' });
    chooseOffer(s, ev);
    ok(C.hand.filter((h) => h.name === ev).length >= 2, 'the same event can be drafted again (not unique)');
  }
  // An ENGINE draft grants exactly 1 copy and is removed from the unique pool.
  {
    const s = createState(clone(), 7005); isolate(s); initCards(s);
    const C = s.cards;
    const uniq = C.draftable.find((n) => dcat(n) === 'engine');
    const h0 = C.hand.length, poolLen = C.draftable.length;
    C.pendingOffers.push({ choices: [uniq], kind: 'engine' });
    const r = chooseOffer(s, uniq);
    ok(r.ok && C.hand.length === h0 + 1 && C.hand.filter((h) => h.name === uniq).length === 1, 'drafting an ENGINE adds exactly 1 copy');
    ok(!C.draftable.includes(uniq) && C.draftable.length === poolLen - 1, 'a drafted engine leaves the pool');
    ok(C.draftable.every((n) => dcat(n) === 'engine'), 'the unique pool is engines only');
  }
  // Uniqueness across drafts via the real flow: a drafted engine never reappears, and the
  // two un-chosen engines from that offer stay draftable.
  {
    const cfg = clone(); cfg.substrate.engineClusterMin = cfg.substrate.engineClusterMax = 4;   // fixed count (live maps randomise 1–3)
    const s = createState(cfg, 7003); isolate(s); initCards(s);
    const sub = s.substrate, net = s.active, C = s.cards;
    const engPiles = (sub.foodPiles || []).filter((p) => p.kind === 'engine');
    ok(engPiles.length >= 2, `map has >=2 engine caches to test uniqueness (got ${engPiles.length})`);
    const digest = (pile) => { for (const idx of pile.cells) { sub.cells[idx].colonized = 1; sub.cells[idx].nutrient = 0; } net.energy = 50; tickWorld(s); };
    digest(engPiles[0]);
    const off0 = C.pendingOffers[0];
    const picked = off0.choices[0], spared = off0.choices.slice(1);
    chooseOffer(s, picked);
    ok(!C.draftable.includes(picked), 'the drafted engine left the pool');
    ok(spared.every((n) => C.draftable.includes(n)), 'engines that were offered but NOT chosen stay in the pool');
    digest(engPiles[1]);
    const off1 = C.pendingOffers[0];
    ok(off1 && !off1.choices.includes(picked), 'the drafted engine never reappears in a later engine draft');
  }
  // Normal drafts are WEIGHTED toward basics (~60/40) — sample many offers via the real flow.
  {
    let basics = 0, total = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const s = createState(clone(), seed * 1000 + 7); isolate(s); initCards(s);
      const sub = s.substrate, net = s.active;
      for (const pile of (sub.foodPiles || []).filter((p) => (p.kind || 'normal') === 'normal')) {
        for (const idx of pile.cells) { sub.cells[idx].colonized = 1; sub.cells[idx].nutrient = 0; }
      }
      net.energy = 50; tickWorld(s);
      for (const off of s.cards.pendingOffers) for (const n of off.choices) { total++; if (dcat(n) === 'basic') basics++; }
    }
    const frac = basics / total;
    ok(total > 100, `sampled ${total} normal-draft choices across seeds`);
    ok(frac > 0.48 && frac < 0.72, `normal drafts favour Basic ~60% (got ${(frac * 100).toFixed(0)}% of ${total})`);
  }
}

// ============= E: anti-nematode & anti-ant predation cards ==================
console.log('# Anti-nematode & anti-ant cards');
{
  const firstNode = (s) => s.active.nodes.find((n) => !n.infected) || s.active.nodes[0];
  // Constricting Snap — kill the nearest worm, +3 P (leave a far one).
  {
    const s = createState(clone(), 5150); isolate(s); initCards(s); s.active.phosphorus = 0;
    const nd = firstNode(s);
    s.nematodes = [{ x: nd.x + 20, y: nd.y }, { x: nd.x + 6000, y: nd.y }];
    const r = playCard(s, ensureHand(s, 'Constricting Snap'), { x: nd.x + 20, y: nd.y });
    ok(r.ok && s.nematodes.length === 1 && s.active.phosphorus === 3, 'Constricting Snap digests the nearest worm for +3 P');
  }
  // Toxocyst Burst — clear ALL worms in radius, +1 P each (leave a far one).
  {
    const s = createState(clone(), 5151); isolate(s); initCards(s); s.active.phosphorus = 0;
    const nd = firstNode(s);
    s.nematodes = [{ x: nd.x + 10, y: nd.y }, { x: nd.x - 10, y: nd.y }, { x: nd.x, y: nd.y + 15 }, { x: nd.x + 6000, y: nd.y }];
    const r = playCard(s, ensureHand(s, 'Toxocyst Burst'), { x: nd.x, y: nd.y });
    ok(r.ok && s.nematodes.length === 1 && s.active.phosphorus === 3, 'Toxocyst Burst clears the swarm in radius for +1 P each');
  }
  // Toxocyst Array — installs; firing clears worms with NO phosphorus reward.
  {
    const s = createState(clone(), 5152); isolate(s); initCards(s); s.active.phosphorus = 0; s.active.energy = 500;
    playCard(s, ensureHand(s, 'Toxocyst Array'));
    const ai = s.cards.actions.findIndex((a) => a.name === 'Toxocyst Array');
    const nd = firstNode(s); s.nematodes = [{ x: nd.x + 10, y: nd.y }, { x: nd.x - 20, y: nd.y }];
    const fr = activateAction(s, ai, { x: nd.x, y: nd.y });
    ok(ai >= 0 && fr.ok && s.nematodes.length === 0 && s.active.phosphorus === 0, 'Toxocyst Array installs and clears worms for no reward');
  }
  // Cordyceps Bloom — destroy the nearest nest in sensing range; leave the far one.
  {
    const s = createState(clone(), 5153); isolate(s); initCards(s);
    const nd = firstNode(s);
    s.ants = [{ x: nd.x + 30, y: nd.y, hp: 100, maxHp: 100 }, { x: nd.x + 6000, y: nd.y, hp: 100, maxHp: 100 }];
    const r = playCard(s, ensureHand(s, 'Cordyceps Bloom'));
    ok(r.ok && s.ants.length === 1 && s.ants[0].x > nd.x + 5000, 'Cordyceps Bloom destroys the sensed nest, spares the far one');
    // no nest in range → no-op
    const s2 = createState(clone(), 5154); isolate(s2); initCards(s2);
    const nd2 = firstNode(s2); s2.ants = [{ x: nd2.x + 6000, y: nd2.y, hp: 100, maxHp: 100 }];
    const r2 = playCard(s2, ensureHand(s2, 'Cordyceps Bloom'));
    ok(!r2.ok && s2.ants.length === 1, 'Cordyceps Bloom no-ops with no nest in sensing range');
  }
  // Cordyceps Stroma — installs; firing destroys a sensed nest.
  {
    const s = createState(clone(), 5155); isolate(s); initCards(s); s.active.energy = 500;
    playCard(s, ensureHand(s, 'Cordyceps Stroma'));
    const ai = s.cards.actions.findIndex((a) => a.name === 'Cordyceps Stroma');
    const nd = firstNode(s); s.ants = [{ x: nd.x + 30, y: nd.y, hp: 100, maxHp: 100 }];
    const fr = activateAction(s, ai, {});
    ok(ai >= 0 && fr.ok && s.ants.length === 0, 'Cordyceps Stroma installs and destroys a sensed nest');
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
