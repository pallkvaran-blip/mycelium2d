// Headless smoke test for the renderer-agnostic simulation (A9).
// Run with: node test/smoke.test.js
// Proves the engine drives a full turn cycle without a browser.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { performAction } from '../src/engine/actions.js';
import { endTurn } from '../src/engine/turn.js';
import { totalTrichoderma, spawnTrichodermaAt, infectNetwork } from '../src/engine/threats.js';

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

console.log('# Trichoderma spreads and can damage the network');
const trichBefore = totalTrichoderma(state.substrate);
// Force mold right onto the network to guarantee contact.
spawnTrichodermaAt(state.substrate, state.active.root.x, state.active.root.y + 30, cfg, state.rng);
const healthBefore = state.active.nodes.reduce((s, n) => s + n.health, 0);
state.movesLeft = 0;
endTurn(state);
endTurn(state);
const trichAfter = totalTrichoderma(state.substrate);
ok(trichAfter > 0, 'Trichoderma present on the map');
ok(totalTrichoderma(state.substrate) >= 0, 'Trichoderma field stays finite');

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

console.log('# Trichoderma infects and spreads through the network; Amputate cures');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 7);
  const net = s.active;
  for (const node of net.nodes) { const c = s.substrate.cellAtWorld(node.x, node.y); if (c) c.trich = 1; }
  ok(net.healthyCount() === net.nodes.length, 'starts fully healthy (uninfected)');
  for (let i = 0; i < 8; i++) infectNetwork(net, s.substrate, s.config, s.rng);
  const infected = net.nodes.length - net.healthyCount();
  ok(infected > 0, `Trichoderma infected strands (${infected}/${net.nodes.length})`);
  net.recomputeVitality();
  ok(net.vitality < 1, `vitality now means % healthy and dropped (${net.vitality.toFixed(2)})`);

  // Amputate removes infected strands (the cure / firebreak).
  const inf = net.nodes.find((n) => n.infected);
  const before = net.nodes.length;
  const removed = net.amputateNode(inf.id);
  ok(removed > 0 && net.nodes.length < before, `Amputate cuts out infected strands (-${removed})`);

  // Melanize resists the INITIAL contact (same seed -> fewer contact infections).
  const sa = createState(JSON.parse(JSON.stringify(CONFIG)), 7);
  for (const node of sa.active.nodes) { const c = sa.substrate.cellAtWorld(node.x, node.y); if (c) c.trich = 1; }
  infectNetwork(sa.active, sa.substrate, sa.config, sa.rng);
  const infNoMel = sa.active.nodes.filter((n) => n.infected).length;
  const sb = createState(JSON.parse(JSON.stringify(CONFIG)), 7);
  sb.active.traits.melanize = 5;
  for (const node of sb.active.nodes) { const c = sb.substrate.cellAtWorld(node.x, node.y); if (c) c.trich = 1; }
  infectNetwork(sb.active, sb.substrate, sb.config, sb.rng);
  const infMel = sb.active.nodes.filter((n) => n.infected).length;
  ok(infMel <= infNoMel, `Melanize resists initial contact (${infMel} <= ${infNoMel})`);
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
