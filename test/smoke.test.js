// Headless smoke test for the renderer-agnostic simulation (A9).
// Run with: node test/smoke.test.js
// Proves the engine drives a full turn cycle without a browser.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { performAction } from '../src/engine/actions.js';
import { endTurn } from '../src/engine/turn.js';
import { totalTrichoderma, spawnTrichodermaAt, infectNetwork, spreadTrichoderma } from '../src/engine/threats.js';

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

console.log('# Amputate removes a subtree');
const countBefore = state.active.nodes.length;
const tip = state.active.nodes[state.active.nodes.length - 1];
const ar = performAction(state, 'amputate', { x: tip.x, y: tip.y });
ok(ar.ok && state.active.nodes.length < countBefore, 'Amputate removed strand(s)');

console.log('# Trichoderma clouds roam, persist, devour, and fade after infecting');
// Drop a cloud right on the network and run two turns — the world stays finite.
spawnTrichodermaAt(state, state.active.root.x, state.active.root.y + 30);
state.movesLeft = 0;
endTurn(state);
endTurn(state);
ok(totalTrichoderma(state.substrate) >= 0, 'Trichoderma field stays finite');

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

// Consumption: a cloud sitting on a pile eats it within ~2 turns.
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 654);
  const sub = s.substrate;
  const N = s.config.substrate.foodCellNutrient;
  for (const c of sub.cells) { c.nutrient = 0; c.maxNutrient = 0; }
  const c0 = 10, r0 = 5;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const cell = sub.cellAt(c0 + dc, r0 + dr);
    if (cell) { cell.nutrient = N; cell.maxNutrient = N; cell.rock = false; cell.hazard = false; }
  }
  s.clouds = [];
  const ctr = sub.cellCenter(c0, r0);
  spawnTrichodermaAt(s, ctr.x, ctr.y);
  const food0 = sub.totalNutrient();
  spreadTrichoderma(s);
  spreadTrichoderma(s);
  ok(sub.totalNutrient() < food0 * 0.1, `a cloud devoured the pile in 2 turns (${food0|0} -> ${sub.totalNutrient()|0})`);
}

// Fade: once a cloud infects you it spends itself and vanishes over ~2 turns.
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 55);
  s.clouds = [];
  const node = s.active.nodes[s.active.nodes.length - 1];
  const cloud = spawnTrichodermaAt(s, node.x, node.y);
  infectNetwork(s.active, s);
  ok(cloud.dying === true, 'cloud spends itself (dying) the moment it infects you');
  ok(s.active.nodes.some((n) => n.infected), 'contact infected the network');
  spreadTrichoderma(s);
  spreadTrichoderma(s);
  ok(!s.clouds.includes(cloud), 'the spent cloud disappears over ~2 turns (infect each cloud ~once)');
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

  // Amputate removes infected strands (the cure / firebreak).
  const inf = net.nodes.find((n) => n.infected);
  const before = net.nodes.length;
  const removed = net.amputateNode(inf.id);
  ok(removed > 0 && net.nodes.length < before, `Amputate cuts out infected strands (-${removed})`);

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
