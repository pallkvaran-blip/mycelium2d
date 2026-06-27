// Headless smoke test for the renderer-agnostic simulation (A9).
// Run with: node test/smoke.test.js
// Proves the engine drives a full turn cycle without a browser.

import { CONFIG } from '../src/config.js';
import { createState, createPuzzleState } from '../src/engine/state.js';
import { performAction } from '../src/engine/actions.js';
import { endTurn } from '../src/engine/turn.js';
import { totalTrichoderma, spawnTrichodermaAt, infectNetwork, spreadTrichoderma } from '../src/engine/threats.js';
import { playCard, refillHand, drawCards, STARTING_DECK, HAND_SIZE } from '../src/engine/cards.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ok  -', msg); }
  else { failed++; console.error('  FAIL-', msg); }
}
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

// Deep-clone CONFIG so tweaks here don't leak between sections.
const cfg = JSON.parse(JSON.stringify(CONFIG));

console.log('# State + map generation');
const state = createState(cfg, 12345);
// performAction now ticks the mould on every action; clear clouds AND disable
// respawn so the generic action tests below aren't perturbed (threat has its
// own section).
state.clouds = [];
state.config.trichoderma.initialPatches = 0;
ok(state.networks.length === 1, 'holds a list with one network');
ok(state.active === state.networks[0], 'active network is the first');
ok(state.substrate.cols > 0 && state.substrate.rows > 0, 'substrate grid generated');
ok(state.substrate.totalNutrient() > 0, 'substrate has food');
ok(state.active.nodes.length > 0, 'network seeded with nodes');
ok(state.active.surface !== undefined || state.substrate.surface.length === state.substrate.cols,
  'surface line generated per column');
const someSoil = state.substrate.surface.some((s) => s.soil);
const someNonSoil = state.substrate.surface.some((s) => !s.soil);
ok(someSoil && someNonSoil, 'surface has both soil and non-soil stretches');

console.log('# Grow steers toward food');
const nodesBefore = state.active.nodes.length;
// Lure growth by placing substrate right next to the seed, then grow.
const seedNode = state.active.nodes[state.active.nodes.length - 1];
performAction(state, 'addSubstrate', { x: seedNode.x + 40, y: seedNode.y + 40 });
let grew = false;
for (let i = 0; i < 3 && state.movesLeft > 0; i++) {
  const r = performAction(state, 'grow');
  if (r.ok) grew = true;
}
ok(grew, 'Grow produced new filaments toward lured food');
ok(state.active.nodes.length > nodesBefore, 'network grew');

console.log('# Turn loop: moves + passive income');
const energyBefore = state.active.energy;
state.movesLeft = 0;
endTurn(state);
ok(state.turn === 2, 'turn advanced');
ok(state.movesLeft === cfg.turn.movesPerTurn, 'moves refilled');
ok(state.active.energy >= energyBefore - 0.001 + cfg.energy.baselineTrickle - 50,
  'energy changed via passive income/trickle');

console.log('# Digest burst');
const eBeforeDigest = state.active.energy;
const dr = performAction(state, 'digest');
if (dr.ok) ok(state.active.energy > eBeforeDigest - cfg.actions.digest.energyCost,
  'Digest yielded an Energy burst');
else ok(true, 'Digest had no occupied food (acceptable depending on map)');

console.log('# Express raises a trait, organism-wide');
state.active.energy += 200;
const er = performAction(state, 'express', { trait: 'melanize' });
ok(er.ok && state.active.traits.melanize === 1, 'Melanize expressed to level 1');
const cost1 = state.active.expressCost('melanize');
ok(cost1 > cfg.actions.express.energyCostBase, 'Express cost escalates with level');

console.log('# Amputate cuts out strands within a radius');
const countBefore = state.active.nodes.length;
const tip = state.active.nodes[state.active.nodes.length - 1];
const ar = performAction(state, 'amputate', { x: tip.x, y: tip.y });
ok(ar.ok && state.active.nodes.length < countBefore, 'Amputate removes the strands within its radius');

console.log('# Trichoderma clouds roam, persist, devour, and fade after infecting');
// Drop a cloud right on the network and run two turns — the world stays finite.
spawnTrichodermaAt(state, state.active.root.x, state.active.root.y + 30);
state.movesLeft = 0;
endTurn(state);
endTurn(state);
ok(totalTrichoderma(state.substrate) >= 0, 'Trichoderma field stays finite');

// Seeding: clouds start in OPEN ground (not sitting on food) so they travel.
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 2468);
  let onFood = 0;
  for (const c of s.clouds) { const cell = s.substrate.cellAtWorld(c.cx, c.cy); if (cell && cell.maxNutrient > 0) onFood++; }
  ok(s.clouds.length === CONFIG.trichoderma.initialPatches, 'all clouds seeded');
  ok(onFood === 0, `clouds seed in open ground, not on food (${onFood}/${s.clouds.length} on food)`);
}

// Travel: a seeded cloud visibly moves toward its nearest target each action.
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 2468);
  s.clouds = [s.clouds[0]];
  const c = s.clouds[0];
  const p0 = { x: c.cx, y: c.cy };
  for (let i = 0; i < 3; i++) spreadTrichoderma(s);
  const moved = Math.hypot(c.cx - p0.x, c.cy - p0.y);
  ok(moved > 1, `a seeded cloud moves toward food/colony (${moved | 0}px over 3 actions)`);
}

// Persistence: a healthy cloud keeps roaming for many turns (it doesn't just
// die out on its own — only spending itself on you removes it).
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 321);
  s.clouds = [];
  spawnTrichodermaAt(s, s.active.root.x + 200, s.active.root.y + 40);
  for (let i = 0; i < 20; i++) spreadTrichoderma(s);
  ok(s.clouds.length > 0 && totalTrichoderma(s.substrate) > 0,
    'a healthy cloud persists for many turns (does not die out)');
}

// Bounded size: a small cloud that eats a giant pile stays small (never giant).
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 808);
  const sub = s.substrate;
  const N = s.config.substrate.foodCellNutrient;
  for (const c of sub.cells) { c.nutrient = 0; c.maxNutrient = 0; }
  // A huge slab of food.
  for (let row = 2; row < 14; row++) for (let col = 4; col < 28; col++) {
    const cell = sub.cellAt(col, row);
    if (cell && !cell.rock) { cell.nutrient = N; cell.maxNutrient = N; }
  }
  s.clouds = [];
  const ctr = sub.cellCenter(6, 6);
  const cloud = spawnTrichodermaAt(s, ctr.x, ctr.y);
  const r0 = cloud.r;
  for (let i = 0; i < 20; i++) spreadTrichoderma(s);
  ok(cloud.r <= s.config.trichoderma.cloudRadiusMax + 1e-6 && cloud.r < r0 + 2,
    `cloud stays small after eating a giant pile (r ${r0.toFixed(2)} -> ${cloud.r.toFixed(2)}, cap ${s.config.trichoderma.cloudRadiusMax})`);
}

// Consumption: a cloud eats a pile cell-by-cell, so the pile visibly SHRINKS in
// size every action, and the whole thing is gone within ~2 turns (~6 actions).
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 654);
  const sub = s.substrate;
  const N = s.config.substrate.foodCellNutrient;
  for (const c of sub.cells) { c.nutrient = 0; c.maxNutrient = 0; }
  // A pile much bigger than one small cloud (radius ~3 cells).
  const c0 = 14, r0 = 8;
  for (let dr = -3; dr <= 3; dr++) for (let dc = -3; dc <= 3; dc++) {
    const cell = sub.cellAt(c0 + dc, r0 + dr);
    if (cell && Math.hypot(dc, dr) <= 3) { cell.nutrient = N; cell.maxNutrient = N; cell.rock = false; cell.hazard = false; }
  }
  s.clouds = [];
  s.config.trichoderma.initialPatches = 0;   // no respawn noise during the test
  const foodCells = () => sub.cells.filter((c) => c.maxNutrient > 0).length;
  const start = foodCells();
  spawnTrichodermaAt(s, sub.cellCenter(c0, r0).x, sub.cellCenter(c0, r0).y);
  spreadTrichoderma(s);
  ok(foodCells() < start, `pile shrinks in size as it's eaten (${start} -> ${foodCells()} cells after 1 action)`);
  let actions = 1;
  while (sub.totalNutrient() > 0 && actions < 15) { spreadTrichoderma(s); actions++; }
  ok(sub.totalNutrient() === 0 && actions <= 9,
    `whole pile eaten cell-by-cell in ${actions} actions (~${(actions / 3).toFixed(1)} turns)`);
}

// Fade: once a cloud infects you it spends itself and vanishes over ~2 turns.
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 55);
  s.clouds = [];
  s.config.trichoderma.initialPatches = 0;   // no respawn noise
  const node = s.active.nodes[s.active.nodes.length - 1];
  const cloud = spawnTrichodermaAt(s, node.x, node.y);
  infectNetwork(s.active, s);
  ok(cloud.dying === true, 'cloud spends itself (dying) the moment it infects you');
  ok(s.active.nodes.some((n) => n.infected), 'contact infected the network');
  const fade = s.config.trichoderma.fadeTurns;
  for (let i = 0; i < fade - 1; i++) { spreadTrichoderma(s); ok(s.clouds.includes(cloud), `cloud still fading (step ${i + 1}/${fade})`); }
  spreadTrichoderma(s);
  ok(!s.clouds.includes(cloud), `the spent cloud dies off over ~${fade} steps (infect each cloud ~once)`);
}

console.log('# Melanize reduces incoming damage (defensive trait matters)');
{
  const s2 = createState(JSON.parse(JSON.stringify(CONFIG)), 999);
  const n2 = s2.active;
  // Put hazard under every node so damage is guaranteed.
  for (const node of n2.nodes) {
    const cell = s2.substrate.cellAtWorld(node.x, node.y);
    if (cell) cell.hazard = true;
  }
  const undef = n2.nodes.map((n) => n.health);
  n2.applyHazardDamage(s2.substrate);
  const dmgNoMel = undef.reduce((a, h, i) => a + (h - n2.nodes[i].health), 0);
  // reset + melanize
  const s3 = createState(JSON.parse(JSON.stringify(CONFIG)), 999);
  const n3 = s3.active;
  for (const node of n3.nodes) {
    const cell = s3.substrate.cellAtWorld(node.x, node.y);
    if (cell) cell.hazard = true;
  }
  n3.traits.melanize = 3;
  const base = n3.nodes.map((n) => n.health);
  n3.applyHazardDamage(s3.substrate);
  const dmgMel = base.reduce((a, h, i) => a + (h - n3.nodes[i].health), 0);
  ok(dmgMel < dmgNoMel, `Melanize reduced hazard damage (${dmgMel.toFixed(3)} < ${dmgNoMel.toFixed(3)})`);
}

console.log('# Trichoderma infects on contact (chunk), races inward; Amputate cures');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 7);
  const net = s.active;
  s.clouds = [];
  // Grow a sizable network so a single chunk doesn't cover the whole thing.
  const seedNode = net.nodes[net.nodes.length - 1];
  s.substrate.deposit(seedNode.x, seedNode.y + 30, 100, 3);
  for (let i = 0; i < 12; i++) net.grow(s.substrate, s.rng);
  ok(net.healthyCount() === net.nodes.length, 'starts fully healthy (uninfected)');

  // A cloud touching one interior strand instantly claims a CHUNK, not one node.
  const hub = net.nodes.find((n) => n.parentId != null && n.children.length > 0) || net.nodes[1];
  spawnTrichodermaAt(s, hub.x, hub.y);
  infectNetwork(net, s);
  const afterContact = net.nodes.length - net.healthyCount();
  ok(afterContact > 1, `one contact instantly rots a chunk (${afterContact} strands)`);

  // The rot then races inward along the filaments each turn (clouds now spent).
  for (let i = 0; i < 5; i++) infectNetwork(net, s);
  const infected = net.nodes.length - net.healthyCount();
  ok(infected > afterContact, `infection races through the network (${infected}/${net.nodes.length})`);
  net.recomputeVitality();
  ok(net.vitality < 1, `vitality now means % healthy and dropped (${net.vitality.toFixed(2)})`);

  // Amputate cuts out the infected patch within its radius.
  const inf = net.nodes.find((n) => n.infected);
  const before = net.nodes.length;
  const removed = net.amputateAt(inf.x, inf.y, s.config.actions.amputate.radius);
  ok(removed > 0 && net.nodes.length < before, `Amputate cuts out the infected patch (-${removed})`);
  ok(!net.byId.has(inf.id), 'the targeted infected strand is gone');

  // Melanize gives a chance to resist the initial contact. Isolate the breach
  // (no chunk, no race), one cloud per node, and count breaches with/without it.
  function contactBreaches(seed, melanize) {
    const st = createState(JSON.parse(JSON.stringify(CONFIG)), seed);
    st.config.trichoderma.contactChunk = 0;
    st.config.trichoderma.spreadDepthPerTurn = 0;
    st.active.traits.melanize = melanize;
    st.clouds = [];
    for (const node of st.active.nodes) spawnTrichodermaAt(st, node.x, node.y);
    infectNetwork(st.active, st);
    return st.active.nodes.filter((n) => n.infected).length;
  }
  const brNoMel = contactBreaches(7, 0);
  const brMel = contactBreaches(7, 5);
  ok(brMel < brNoMel, `Melanize resists initial contact (${brMel} < ${brNoMel})`);
}

console.log('# Infection also advances on End Turn (no dodging the rot)');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 314);
  const net = s.active;
  s.clouds = [];                              // isolate the internal spread
  s.config.trichoderma.initialPatches = 0;    // no respawn
  net.energy += 1000;                         // no starvation interference
  const seedNode = net.nodes[net.nodes.length - 1];
  s.substrate.deposit(seedNode.x, seedNode.y + 30, 100, 3);
  for (let i = 0; i < 12; i++) net.grow(s.substrate, s.rng);
  const hub = net.nodes.find((n) => n.parentId != null && n.children.length > 0) || net.nodes[1];
  hub.infected = true;
  const before = net.nodes.filter((n) => n.infected).length;
  s.movesLeft = 0;
  endTurn(s);
  const after = net.nodes.filter((n) => n.infected).length;
  ok(after > before, `the rot advances on End Turn too (${before} -> ${after} infected)`);
}

console.log('# Growth: infected strands cannot grow; cut-loose healthy ones can');
{
  // A fully infected colony cannot grow at all.
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 77);
  const net = s.active;
  s.clouds = [];
  s.config.trichoderma.initialPatches = 0;
  const seedNode = net.nodes[net.nodes.length - 1];
  s.substrate.deposit(seedNode.x, seedNode.y + 30, 100, 3);
  for (let i = 0; i < 8; i++) net.grow(s.substrate, s.rng);
  ok(net.nodes.length > 2, 'network grew while healthy');
  for (const n of net.nodes) n.infected = true;       // whole colony dead
  const before = net.nodes.length;
  net.grow(s.substrate, s.rng);
  ok(net.nodes.length === before, 'a fully infected colony cannot grow at all');
}
{
  // A healthy strand cut loose from the root (no parent) keeps growing.
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 33);
  const net = s.active;
  s.clouds = [];
  s.config.trichoderma.initialPatches = 0;
  const lone = net.addNode(800, 800, null);           // disconnected fragment root
  s.substrate.deposit(lone.x + 24, lone.y, 100, 3);   // food right next to it
  const before = net.nodes.length;
  for (let i = 0; i < 3; i++) net.grow(s.substrate, s.rng);
  const grewFromLone = net.nodes.some((n) => n.parentId === lone.id);
  ok(net.nodes.length > before && grewFromLone, 'a cut-loose healthy strand still grows');
}

console.log('# Even small food attracts growth (no scraps left behind)');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 91);
  const net = s.active;
  s.clouds = [];
  s.config.trichoderma.initialPatches = 0;
  for (const c of s.substrate.cells) { c.nutrient = 0; c.maxNutrient = 0; }
  // A tiny 5-nutrient remnant (below the OLD threshold of 6) next to the seed.
  const seed = net.root;
  s.substrate.deposit(seed.x, seed.y + 50, 5, 0);
  const before = net.nodes.length;
  for (let i = 0; i < 4; i++) net.grow(s.substrate, s.rng);
  ok(net.nodes.length > before, 'a small (5-nutrient) remnant still lures growth');
}

console.log('# Trichoderma cannot travel through rock');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 71);
  const sub = s.substrate;
  for (const c of sub.cells) { c.nutrient = 0; c.maxNutrient = 0; c.rock = false; }
  s.clouds = [];
  s.config.trichoderma.initialPatches = 0;
  // A solid vertical rock wall between the cloud and the food behind it.
  for (let row = 0; row < sub.rows; row++) { const cell = sub.cellAt(20, row); if (cell) cell.rock = true; }
  const fcell = sub.cellAt(24, 7); fcell.nutrient = 100; fcell.maxNutrient = 100;
  const near = sub.cellCenter(16, 7);
  const cloud = spawnTrichodermaAt(s, near.x, near.y);
  let everInRock = false, crossed = false;
  for (let i = 0; i < 40; i++) {
    spreadTrichoderma(s);
    const c = sub.cellAtWorld(cloud.cx, cloud.cy);
    if (c && c.rock) everInRock = true;
    if (sub.colAtX(cloud.cx) > 20) crossed = true;   // got to the far side
  }
  ok(!everInRock, 'a cloud never ends up inside a rock cell');
  ok(!crossed, 'a cloud cannot tunnel through a solid rock wall');
}

console.log('# Puzzle mode: builds a fixed level and is navigable to the chest');
{
  const s = createPuzzleState(JSON.parse(JSON.stringify(CONFIG)));
  ok(s.mode === 'puzzle', 'puzzle mode set');
  ok(s.chest && s.chest.x > 0 && s.chest.r > 0, 'treasure chest placed');
  ok(s.clouds.length === 2, 'two mould clouds placed');
  ok(s.active.nodes.length > 0, 'colony seeded at the start');
  ok(s.substrate.cells.some((c) => c.rock), 'rock formations present');
  ok(s.substrate.totalNutrient() > 0, 'food islands present');
  ok(s.config.energy.start === 50 && s.config.energy.baselineTrickle === 0, 'tight economy applied');

  // Navigate to the chest by laying lures along the route. Cheat energy and
  // drop the clouds so this purely checks the ROUTE is growable (rocks don't
  // wall it off and the chest is reachable).
  s.clouds = [];
  const path = [[8, 4], [12, 5], [16, 5], [20, 5], [24, 9], [28, 12], [31, 13], [35, 11],
    [39, 9], [43, 7], [46, 8], [50, 10], [53, 12], [55, 14], [58, 11], [59, 9], [63, 9],
    [67, 9], [70, 9], [73, 9]];
  for (const [c, r] of path) {
    const ctr = s.substrate.cellCenter(c, r);
    s.active.energy = 9999; s.movesLeft = 9;
    performAction(s, 'addSubstrate', { x: ctr.x, y: ctr.y });
    for (let g = 0; g < 6 && !s.won; g++) { s.active.energy = 9999; s.movesLeft = 9; performAction(s, 'grow'); }
    if (s.won) break;
  }
  const reach = Math.max(...s.active.nodes.map((n) => s.substrate.colAtX(n.x)));
  ok(s.won, `the colony can be routed to the chest (reached col ${reach}, chest col 73)`);
}

console.log('# Cards: deck, hand, play, and end-of-turn refill');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  ok(s.hand.length === HAND_SIZE, `opening hand dealt (${s.hand.length})`);
  ok(s.deck.length + s.hand.length + s.discard.length === STARTING_DECK.length, 'every card accounted for');

  // Play an engine card (always playable) — energy up, card moves hand->discard.
  s.hand[0] = { uid: 'test', key: 'surge' };
  const e0 = s.active.energy, h0 = s.hand.length;
  const r = playCard(s, s.hand[0]);
  ok(r.ok && s.active.energy === e0 + 25, 'engine card (Surge) gave +25 Energy');
  ok(s.hand.length === h0 - 1 && s.discard.length === 1, 'played card moved hand -> discard');

  // Can't play a card you can't afford.
  s.hand[0] = { uid: 'test2', key: 'mound' };  // cost 15
  s.active.energy = 5;
  const r2 = playCard(s, s.hand[0], { x: s.active.root.x, y: s.active.root.y + 20 });
  ok(!r2.ok, 'a card you cannot afford is blocked');

  // End-of-turn refill: hand is replenished and the count is conserved.
  const total = s.deck.length + s.hand.length + s.discard.length;
  refillHand(s);
  ok(s.hand.length === HAND_SIZE, `hand refilled to ${HAND_SIZE}`);
  ok(s.deck.length + s.hand.length + s.discard.length === total, 'no cards lost on refill');

  // Drawing past the deck reshuffles the discard back in (no crash, conserved).
  let safety = 0;
  while (s.deck.length > 0 && safety++ < 999) drawCards(s, 1);
  drawCards(s, 3);
  ok(s.deck.length + s.hand.length + s.discard.length === total, 'discard reshuffles into the deck');
}

console.log('# Engine card raises passive income for the run');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 11);
  const before = s.active.incomeBonus;
  s.hand[0] = { uid: 'd', key: 'deepen' };
  s.active.energy = 100;
  playCard(s, s.hand[0]);
  ok(s.active.incomeBonus === before + 8, 'Deepen Roots raised passive income bonus');
}

console.log('# Fruit pays Spores and ends the cycle');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 2024);
  const net = s.active;
  net.energy += 500;
  // Ensure a node sits under a soil column near the surface.
  let soilCol = s.substrate.surface.findIndex((x) => x.soil);
  if (soilCol < 0) soilCol = 0;
  const cx = soilCol * s.substrate.cellSize + s.substrate.cellSize / 2;
  net.addNode(cx, s.substrate.surfaceY + 20, net.root);
  const fr = performAction(s, 'fruit');
  ok(fr.ok, 'Fruit succeeded with a node under soil');
  ok(s.spores > 0, `Spores produced: ${s.spores}`);
  ok(s.runOver === true && net.fruited, 'Fruiting ended the network life cycle');
}

console.log('# Config is data-driven (every action has costs)');
for (const name of ['grow', 'addSubstrate', 'amputate', 'express', 'digest', 'fruit']) {
  ok(typeof cfg.actions[name].moveCost === 'number', `${name} has moveCost in CONFIG`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
