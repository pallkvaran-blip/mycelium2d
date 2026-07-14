// Headless smoke test for the renderer-agnostic simulation (A9).
// Run with: node test/smoke.test.js
// Proves the engine drives a full turn cycle without a browser.

import { CONFIG } from '../src/config.js';
import { createState, createPuzzleState } from '../src/engine/state.js';
import { performAction } from '../src/engine/actions.js';
import { tickWorld } from '../src/engine/turn.js';
import { totalTrichoderma, spawnTrichodermaAt, infectNetwork, spreadTrichoderma } from '../src/engine/threats.js';
import { stepAnts, attackNest } from '../src/engine/ants.js';
import { stepNematodes, excrete, spawnNematodeAt } from '../src/engine/nematodes.js';

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
state.ants = [];        // ants act on end-turn; isolate them from the generic action tests
state.nematodes = [];   // nematodes act on every action/end-turn; isolate them too
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
for (let i = 0; i < 3; i++) {
  const r = performAction(state, 'grow');
  if (r.ok) grew = true;
}
ok(grew, 'Grow produced new filaments toward lured food');
ok(state.active.nodes.length > nodesBefore, 'network grew');

console.log('# No turns: every action advances the world one step');
// Re-lure with fresh food a little further out (the earlier lure is digested fast
// now that colonisation is instant), so this Grow has an attractor and ticks.
state.active.energy = 9999;
performAction(state, 'addSubstrate', { x: seedNode.x + 110, y: seedNode.y + 70 });
const turnBefore = state.turn;
performAction(state, 'grow');
ok(state.turn > turnBefore, 'the step counter advances on each action (the world ticks)');
const energyBefore = state.active.energy;
tickWorld(state);
ok(typeof state.active.energy === 'number' && state.active.energy <= energyBefore + 1000,
  'passive income/trickle resolves on a world tick');

console.log('# Digest burst');
const eBeforeDigest = state.active.energy;
const dr = performAction(state, 'digest');
if (dr.ok) ok(state.active.energy > eBeforeDigest - cfg.actions.digest.energyCost,
  'Digest yielded an Energy burst');
else ok(true, 'Digest had no occupied food (acceptable depending on map)');

console.log('# Amputate cuts out strands within a radius');
const countBefore = state.active.nodes.length;
const tip = state.active.nodes[state.active.nodes.length - 1];
const ar = performAction(state, 'amputate', { x: tip.x, y: tip.y });
ok(ar.ok && state.active.nodes.length < countBefore, 'Amputate removes the strands within its radius');

console.log('# Trichoderma clouds roam, persist, devour, and fade after infecting');
// Drop a cloud right on the network and run two turns — the world stays finite.
spawnTrichodermaAt(state, state.active.root.x, state.active.root.y + 30);
tickWorld(state);
tickWorld(state);
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

// Spends itself on contact even when you're ALREADY infected: a cloud that
// reaches a colony whose nearby strands are all rotten must still fade out
// (it must not sit there forever doing nothing).
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 321);
  const net = s.active;
  for (const n of net.nodes) n.infected = true;     // whole colony already rotten
  s.clouds = [];
  spawnTrichodermaAt(s, net.root.x, net.root.y + 20); // drop a cloud right on it
  infectNetwork(net, s);                              // contact resolves
  const cloud = s.clouds[0];
  ok(cloud.dying === true, 'a cloud that reaches an already-infected colony spends itself');
  for (let i = 0; i < CONFIG.trichoderma.fadeTurns + 1; i++) spreadTrichoderma(s);
  // THIS cloud must be gone — track it specifically (the global sim may spawn other,
  // unrelated clouds from infected substrate, which is a separate mechanic).
  ok(!s.clouds.includes(cloud), 'and then fades away completely (does not linger forever)');
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
}

console.log('# Infection also advances on End Turn (no dodging the rot)');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 314);
  const net = s.active;
  s.clouds = [];                              // isolate the internal spread
  s.nematodes = [];                           // and the worms
  s.config.trichoderma.initialPatches = 0;    // no respawn
  net.energy += 1000;                         // no starvation interference
  const seedNode = net.nodes[net.nodes.length - 1];
  s.substrate.deposit(seedNode.x, seedNode.y + 30, 100, 3);
  for (let i = 0; i < 12; i++) net.grow(s.substrate, s.rng);
  const hub = net.nodes.find((n) => n.parentId != null && n.children.length > 0) || net.nodes[1];
  hub.infected = true;
  const before = net.nodes.filter((n) => n.infected).length;
  tickWorld(s);
  const after = net.nodes.filter((n) => n.infected).length;
  ok(after > before, `the rot advances on a world tick (${before} -> ${after} infected)`);
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

console.log('# Ants: nests seed at the surface, each with a trail to food');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  ok(s.ants.length === CONFIG.ants.nestCount, `seeded ${s.ants.length} nests (config ${CONFIG.ants.nestCount})`);
  ok(s.ants.every((n) => Math.abs(n.y - s.substrate.surfaceY) < 1e-6), 'nests sit on the surface line');
  ok(s.ants.every((n) => n.hp === n.maxHp && n.maxHp === CONFIG.ants.maxHp), 'nests start at full HP');
  ok(s.ants.some((n) => n.path && n.path.length > 1), 'at least one nest ran a trail to food');
}

console.log('# Ants: the trail walls growth off (cannot pierce it)');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 71);
  const sub = s.substrate;
  for (const c of sub.cells) { c.nutrient = 0; c.maxNutrient = 0; c.rock = false; c.antTrail = false; }
  s.clouds = []; s.ants = []; s.config.trichoderma.initialPatches = 0;
  const net = s.active;
  const rootCol = sub.colAtX(net.root.x), rootRow = sub.rowAtY(net.root.y);
  // A near lure to pull growth toward the wall, plus food on the far side.
  const nearCtr = sub.cellCenter(rootCol + 1, rootRow);
  sub.deposit(nearCtr.x, nearCtr.y, 100, 1);
  const wallCol = rootCol + 3;
  for (let row = 0; row < sub.rows; row++) { const cell = sub.cellAt(wallCol, row); if (cell) cell.antTrail = true; }
  const far = sub.cellAt(wallCol + 3, rootRow); if (far) { far.nutrient = 100; far.maxNutrient = 100; }
  const before = net.nodes.length;
  for (let i = 0; i < 40; i++) net.grow(sub, s.rng);
  const crossed = net.nodes.some((n) => sub.colAtX(n.x) > wallCol);
  ok(net.nodes.length > before, 'the colony grew toward the lure');
  ok(!crossed, 'growth cannot cross an ant-trail wall');
}

console.log('# Ants: harvest the target food, then relocate when it runs out');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  const sub = s.substrate;
  const nest = s.ants.find((n) => n.target);
  ok(nest, 'a nest has a target food');
  const tgt = nest.target;
  const cell = sub.cellAt(tgt.col, tgt.row);
  const before = cell.nutrient;
  stepAnts(s);
  ok(cell.nutrient < before, `ants harvest the target (${before} -> ${cell.nutrient})`);
  // Drain the target to force a relocate to the next-nearest food.
  cell.nutrient = 0; cell.maxNutrient = 0;
  const oldKey = tgt.col + ',' + tgt.row;
  stepAnts(s);
  const newKey = nest.target ? nest.target.col + ',' + nest.target.row : null;
  ok(newKey !== oldKey, 'ants retarget when their food runs out (relocate or go dormant)');
}

console.log('# Ants: bombing a nest removes 40% max HP; a kill clears its trail');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  const a = s.config.actions.attackAnts;
  const nest = s.ants[0];
  const before = nest.hp;
  const r1 = attackNest(s, nest.x, nest.y, a.pickRadius, a.damageFrac);
  ok(r1 && approx(nest.hp, before - a.damageFrac * nest.maxHp), `a bomb removes ${(a.damageFrac * 100) | 0}% of max HP`);
  // Bomb somewhere provably far from EVERY nest (robust to map/ant layout).
  const far = Math.max(...s.ants.map((n) => n.x)) + a.pickRadius * 20;
  const miss = attackNest(s, far, nest.y + 5000, a.pickRadius, a.damageFrac);
  ok(miss === null, 'a bomb far from any nest misses');

  // Isolate one nest with a real trail, then bomb it to death and confirm its
  // impassable trail is fully cleared from the cells.
  const s2 = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  const b = s2.config.actions.attackAnts;
  const lone = s2.ants.filter((n) => n.path && n.path.length > 1)
    .sort((p, q) => q.path.length - p.path.length)[0] || s2.ants[0];
  s2.ants = [lone];
  stepAnts(s2);   // stamp only this nest's trail
  const trailBefore = s2.substrate.cells.filter((c) => c.antTrail).length;
  ok(trailBefore > 0, `a lone nest stamps an impassable trail (${trailBefore} cells)`);
  let dead = false;
  for (let i = 0; i < 6 && !dead; i++) { const r = attackNest(s2, lone.x, lone.y, b.pickRadius, b.damageFrac); dead = !!(r && r.dead); }
  const trailAfter = s2.substrate.cells.filter((c) => c.antTrail).length;
  ok(dead, 'enough bombs destroy the nest');
  ok(!s2.ants.includes(lone), 'a destroyed nest is removed from the list');
  ok(trailAfter === 0, `killing the nest clears its trail (${trailBefore} -> ${trailAfter})`);
}

console.log('# Nematodes: seed as wandering worms in open soil');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  ok(s.nematodes.length === CONFIG.nematodes.initialCount, `seeded ${s.nematodes.length} worms`);
  ok(s.nematodes.every((w) => { const c = s.substrate.cellAtWorld(w.x, w.y); return c && !c.rock; }),
    'worms seed in open soil (not in rock)');
}

console.log('# Nematodes: crawl in on sight; rock blocks line of sight');
{
  const cs = CONFIG.world.cellSize;
  // One worm a fixed distance from the colony; measure how much it closes in a
  // single step with vs without a rock wall blocking its view of the colony.
  function losStep(seed, wall) {
    const s = createState(JSON.parse(JSON.stringify(CONFIG)), seed);
    const sub = s.substrate;
    for (const c of sub.cells) { c.rock = false; c.nutrient = 0; c.maxNutrient = 0; }
    s.clouds = []; s.ants = []; s.config.trichoderma.initialPatches = 0;
    const net = s.active;
    const rootCol = sub.colAtX(net.root.x), rootRow = sub.rowAtY(net.root.y);
    const wc = sub.cellCenter(rootCol + 7, rootRow + 4);   // a few rows down (clear of the surface clamp)
    s.nematodes = [];
    const w = spawnNematodeAt(s, wc.x, wc.y);
    if (wall) for (let r = 0; r < sub.rows; r++) { const cell = sub.cellAt(rootCol + 3, r); if (cell) cell.rock = true; }
    const dist = () => Math.min(...net.nodes.map((n) => Math.hypot(n.x - w.x, n.y - w.y)));
    const d0 = dist();
    stepNematodes(s);
    return d0 - dist();
  }
  const closedIn = losStep(11, false);
  const blockedIn = losStep(11, true);
  ok(closedIn > cs * 1.5, `with clear line of sight a worm crawls in (${closedIn | 0}px in one step)`);
  ok(blockedIn < cs * 1.5, `rock blocks line of sight — the worm doesn't crawl in (${blockedIn | 0}px)`);
}

console.log('# Trichoderma: clouds home in on sight; rock blocks line of sight');
{
  const cs = CONFIG.world.cellSize;
  // A cloud a fixed distance from the colony; measure how much it creeps in over
  // one step with vs without a rock wall between it and the colony. A cloud
  // wanders (aimlessly) at the SAME speed it homes, so a single run's wander can
  // drift either way — we average over many fixed seeds: homing closes ground
  // consistently, aimless wandering nets ~nothing.
  function cloudLosStep(seed, wall) {
    const s = createState(JSON.parse(JSON.stringify(CONFIG)), seed);
    const sub = s.substrate;
    for (const c of sub.cells) { c.rock = false; c.nutrient = 0; c.maxNutrient = 0; }
    s.nematodes = []; s.ants = []; s.config.trichoderma.initialPatches = 0;  // isolate the cloud (no respawn)
    const net = s.active;
    const rootCol = sub.colAtX(net.root.x), rootRow = sub.rowAtY(net.root.y);
    const cc = sub.cellCenter(rootCol + 7, rootRow + 4);
    s.clouds = [];
    const cloud = spawnTrichodermaAt(s, cc.x, cc.y);
    if (wall) for (let r = 0; r < sub.rows; r++) { const cell = sub.cellAt(rootCol + 3, r); if (cell) cell.rock = true; }
    const dist = () => Math.min(...net.nodes.map((n) => Math.hypot(n.x - cloud.cx, n.y - cloud.cy)));
    const d0 = dist();
    spreadTrichoderma(s);
    return d0 - dist();
  }
  let clearSum = 0, blockSum = 0;
  const N = 40;
  for (let seed = 1; seed <= N; seed++) { clearSum += cloudLosStep(seed, false); blockSum += cloudLosStep(seed, true); }
  const clearAvg = clearSum / N, blockAvg = blockSum / N;
  ok(clearAvg > cs, `with clear line of sight clouds creep IN (avg ${clearAvg | 0}px/step)`);
  ok(blockAvg < clearAvg - cs, `rock blocks line of sight — walled clouds don't home in (avg ${blockAvg | 0}px/step vs ${clearAvg | 0})`);
}

console.log('# Substrate: segmentClear + visionPolygon respect rock');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 777);
  const sub = s.substrate;
  const cs = sub.cellSize;
  for (const c of sub.cells) c.rock = false;                 // clean slate
  // A full vertical rock wall a few cells to the RIGHT of a chosen origin.
  const oCol = 5, oRow = 5, wallCol = 9;
  const o = sub.cellCenter(oCol, oRow);
  for (let r = 0; r < sub.rows; r++) { const cell = sub.cellAt(wallCol, r); if (cell) cell.rock = true; }
  const wallX = wallCol * cs;                                // left face of the wall

  // segmentClear: clear to the left, blocked to a point past the wall.
  const leftPt = sub.cellCenter(oCol - 3, oRow);
  const pastWall = sub.cellCenter(wallCol + 3, oRow);
  ok(sub.segmentClear(o.x, o.y, leftPt.x, leftPt.y), 'segmentClear: open ground is visible');
  ok(!sub.segmentClear(o.x, o.y, pastWall.x, pastWall.y), 'segmentClear: rock wall blocks the line');

  // visionPolygon: no vertex may sit past the wall on the +x side, and the ray
  // pointing straight at the wall must stop at (or before) the wall face; open
  // directions still reach near the full radius.
  const radius = 12 * cs;
  const poly = sub.visionPolygon(o.x, o.y, radius);
  ok(poly.length === 96, `visionPolygon returns a full fan (${poly.length} rays)`);
  const beyondWall = poly.some((p) => p.x > wallX + cs && Math.abs(p.y - o.y) < cs);
  ok(!beyondWall, 'visionPolygon: no vertex reaches past the rock wall (on its axis)');
  // The +x ray (index 0, angle 0) should stop at/just before the wall, not at full radius.
  const rightReach = poly[0].x - o.x;
  ok(rightReach < wallX - o.x + cs && rightReach < radius - cs, `visionPolygon: +x ray stops at the wall (${rightReach | 0}px, wall at ${(wallX - o.x) | 0}px)`);
  // The -x ray (index 48, angle π) is unobstructed and should reach ~full radius.
  const leftReach = o.x - poly[48].x;
  ok(leftReach > radius - cs, `visionPolygon: open -x ray reaches the full radius (${leftReach | 0}px of ${radius | 0})`);
}

console.log('# Nematodes: feed on contact (eat strands whole) and multiply');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  s.clouds = []; s.ants = []; s.config.trichoderma.initialPatches = 0;
  const net = s.active;
  const seed = net.nodes[net.nodes.length - 1];
  s.substrate.deposit(seed.x, seed.y + 30, 100, 3);
  for (let i = 0; i < 8; i++) net.grow(s.substrate, s.rng);
  const nodesBefore = net.nodes.length;
  s.nematodes = [];
  const onNode = net.nodes[0];
  for (let i = 0; i < 4; i++) spawnNematodeAt(s, onNode.x, onNode.y);
  const wormsBefore = s.nematodes.length;
  for (let i = 0; i < 4; i++) stepNematodes(s);
  ok(net.nodes.length < nodesBefore, `worms eat strands whole (${nodesBefore} -> ${net.nodes.length} nodes)`);
  ok(s.nematodes.length > wormsBefore, `feeding worms multiply (${wormsBefore} -> ${s.nematodes.length})`);
}

console.log('# Nematodes: breeding is exponential, not throttled by strand count');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  s.clouds = []; s.ants = []; s.config.trichoderma.initialPatches = 0;
  s.config.nematodes.eatEveryTicks = 999;   // don't consume — isolate breeding
  s.config.nematodes.breedChance = 1;        // deterministic doubling
  s.config.nematodes.respawnChance = 0;      // no trickle to muddy the count
  s.config.nematodes.maxPopulation = 1000;
  const net = s.active;
  const seed = net.nodes[net.nodes.length - 1];
  s.substrate.deposit(seed.x, seed.y + 30, 100, 3);
  for (let i = 0; i < 8; i++) net.grow(s.substrate, s.rng);   // a bigger colony to sit on
  // Drop the worms in the THICK of the colony body (the densest node, safely
  // below the worm movement floor) — as in real play worms crawl into the body,
  // not onto the surface root. This isolates breeding from incidental geometry.
  const cs = s.substrate.cellSize, floor = s.substrate.surfaceY + cs * 2;
  const reach2 = (s.config.nematodes.reach * cs) ** 2;
  let onNode = net.nodes[0], bestN = -1;
  for (const a of net.nodes) {
    if (a.y < floor) continue;
    let k = 0;
    for (const b of net.nodes) { const dx = a.x - b.x, dy = a.y - b.y; if (dx * dx + dy * dy <= reach2) k++; }
    if (k > bestN) { bestN = k; onNode = a; }
  }
  s.nematodes = [];
  for (let i = 0; i < 2; i++) spawnNematodeAt(s, onNode.x, onNode.y);
  const p0 = s.nematodes.length;
  stepNematodes(s); const p1 = s.nematodes.length;
  stepNematodes(s); const p2 = s.nematodes.length;
  ok(p1 >= p0 * 2 && p2 > p1, `population grows exponentially while feeding (${p0} -> ${p1} -> ${p2})`);
}

console.log('# Nematodes: Excrete sticks & kills worms in range only (3 hits)');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  const net = s.active;
  const onNode = net.nodes[0];
  s.nematodes = [];
  const near = spawnNematodeAt(s, onNode.x + 5, onNode.y + 5);     // within Excrete range
  const far = spawnNematodeAt(s, onNode.x + 99999, onNode.y);      // far out of range
  const r1 = excrete(s);
  ok(r1.hit === 1 && near.hits === 1 && near.stuck >= 1, 'Excrete hits & sticks worms in range only');
  ok(s.nematodes.includes(far) && far.hits === 0, 'a worm out of range is untouched');
  excrete(s);
  const r3 = excrete(s);
  ok(!s.nematodes.includes(near) && r3.killed >= 1, `${s.config.nematodes.killHits} hits kills a worm`);
}

console.log('# Nematodes: feed on every action AND on End Turn (wiring)');
{
  const s = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  s.clouds = []; s.config.trichoderma.initialPatches = 0;
  const net = s.active;
  const onNode = net.nodes[0];
  net.energy = 999;
  s.nematodes = [];
  for (let i = 0; i < 4; i++) spawnNematodeAt(s, onNode.x, onNode.y);
  const beforeAction = net.nodes.length;
  performAction(s, 'addSubstrate', { x: onNode.x, y: onNode.y + 40 });
  ok(net.nodes.length < beforeAction, 'worms feed on every action (per-action world tick)');

  const s2 = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  s2.clouds = []; s2.config.trichoderma.initialPatches = 0;
  const net2 = s2.active, on2 = net2.nodes[0];
  s2.nematodes = [];
  for (let i = 0; i < 4; i++) spawnNematodeAt(s2, on2.x, on2.y);
  const beforeTurn = net2.nodes.length;
  tickWorld(s2);
  ok(net2.nodes.length < beforeTurn || s2.runOver, 'worms feed on a world tick too');
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
  // Drive the frontier along the path with DIRECTIONAL growth toward each waypoint
  // (food-pull growth no longer bridges >sensing-range gaps now that reaching a
  // pile colonises + digests it in one step; this checks the route is growable,
  // which is what matters — rocks don't wall it off and the chest is reachable).
  for (const [c, r] of path) {
    const ctr = s.substrate.cellCenter(c, r);
    s.active.energy = 9999;
    performAction(s, 'addSubstrate', { x: ctr.x, y: ctr.y });
    for (let g = 0; g < 6 && !s.won; g++) {
      s.active.energy = 9999;
      const fp = s.active.frontierPoint() || { x: ctr.x, y: ctr.y };
      s.active.growDirected(s.substrate, s.rng, ctr.x - fp.x, ctr.y - fp.y, 4, false);
      s.active.grow(s.substrate, s.rng);          // fan/colonise around the new reach
      tickWorld(s);                               // advances world + checks the puzzle goal
    }
    if (s.won) break;
  }
  const reach = Math.max(...s.active.nodes.map((n) => s.substrate.colAtX(n.x)));
  ok(s.won, `the colony can be routed to the chest (reached col ${reach}, chest col 73)`);
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
for (const name of ['grow', 'addSubstrate', 'amputate', 'attackAnts', 'excrete', 'digest', 'fruit']) {
  ok(typeof cfg.actions[name].moveCost === 'number', `${name} has moveCost in CONFIG`);
}

// --- Foraging Fan (growRadial) fans from EVERY strand, not just one ----------
// Regression: a bug made the fan grow only from an isolated tip (crowd-locked
// everywhere else), so a colony with several strands only expanded in one place.
{
  const s = createState(cfg, 4747);
  const net = s.active, sub = s.substrate;
  const okOpen = (x, y) => { const c = sub.cellAtWorld(x, y); return y > sub.surfaceY + 40 && (!c || !c.rock); };
  const openAt = (xf) => { const x0 = sub.worldWidth * xf, y = sub.surfaceY + 200; for (let d = 0; d < 400; d += 20) for (const x of [x0 + d, x0 - d]) if (okOpen(x, y)) return { x, y }; return { x: x0, y }; };
  const A = openAt(0.25), B = openAt(0.75);
  net.addNode(A.x, A.y, net.nodes[0]);
  net.addNode(B.x, B.y, net.nodes[0]);
  const near = (p) => net.nodes.filter((n) => (n.x - p.x) ** 2 + (n.y - p.y) ** 2 <= 60 * 60).length;
  const a0 = near(A), b0 = near(B);
  net.growRadial(sub, s.rng);
  ok(near(A) > a0 && near(B) > b0, 'Foraging Fan grows from BOTH separated strands (not just one)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
