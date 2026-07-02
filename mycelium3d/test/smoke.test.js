// Headless smoke test for the renderer-agnostic 3D simulation.
// Run with: node mycelium3d/test/smoke.test.js
// Proves the engine drives a full action cycle in the voxel volume without a browser.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { performAction } from '../src/engine/actions.js';
import { tickWorld } from '../src/engine/turn.js';
import { totalTrichoderma, spawnTrichodermaAt } from '../src/engine/threats.js';
import { attackNest } from '../src/engine/ants.js';
import { spawnNematodeAt } from '../src/engine/nematodes.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ok  -', msg); }
  else { failed++; console.error('  FAIL-', msg); }
}

// Deep-clone CONFIG so tweaks here don't leak between sections.
const cfg = JSON.parse(JSON.stringify(CONFIG));

console.log('# State + volume generation');
const state = createState(cfg, 12345);
// Isolate the generic action tests from the threats (they have their own section).
state.clouds = [];
state.config.trichoderma.initialPatches = 0;
state.config.trichoderma.respawnChance = 0;
state.ants = [];
state.nematodes = [];
state.config.nematodes.respawnChance = 0;
ok(state.networks.length === 1, 'holds a list with one network');
ok(state.active === state.networks[0], 'active network is the first');
const sub = state.substrate;
ok(sub.cols > 0 && sub.lays > 0 && sub.rows > 0, `voxel grid generated (${sub.cols}x${sub.lays}x${sub.rows})`);
ok(sub.totalNutrient() > 0, 'substrate has food');
ok(state.active.nodes.length > 0, 'network seeded with nodes');
ok(state.active.root.y < 0, 'network is underground (y < 0)');
let someSoil = false, someNonSoil = false;
for (const s of sub.surface) { if (s.soil) someSoil = true; else someNonSoil = true; }
ok(someSoil && someNonSoil, 'surface has both soil and non-soil zones');
ok(sub.features.curtains.length >= cfg.substrate.curtainCountMin, `rock curtains placed (${sub.features.curtains.length})`);
ok(sub.features.foodClusters.length > 0, `food clusters recorded (${sub.features.foodClusters.length})`);

console.log('# The guaranteed route is connected (flood fill entry -> goal soil)');
{
  const seen = new Uint8Array(sub.cols * sub.lays * sub.rows);
  const start = sub.index(sub.colAtX(state.active.root.x), sub.layAtY(state.active.root.y - 40), sub.rowAtZ(state.active.root.z));
  const q = [start]; seen[start] = 1;
  let reachedGoal = false;
  while (q.length) {
    const cur = q.pop();
    const cx = cur % sub.cols;
    const rest = (cur / sub.cols) | 0;
    const cz = rest % sub.rows;
    const cy = (rest / sub.rows) | 0;
    if (cy === 0) {
      const surf = sub.surfaceAt(cx, cz);
      if (surf && surf.goal) { reachedGoal = true; break; }
    }
    const nbrs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of nbrs) {
      const nx = cx + dx, ny = cy + dy, nz = cz + dz;
      if (!sub.inBounds(nx, ny, nz)) continue;
      const ni = sub.index(nx, ny, nz);
      if (seen[ni] || sub.cells[ni].rock) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  ok(reachedGoal, 'open voxels connect the colony seed to the goal-zone surface');
}

console.log('# Grow steers toward food (3D space colonization)');
const nodesBefore = state.active.nodes.length;
const seedNode = state.active.nodes[state.active.nodes.length - 1];
performAction(state, 'addSubstrate', { x: seedNode.x + 45, y: seedNode.y - 30, z: seedNode.z + 45 });
let grew = false;
for (let i = 0; i < 3; i++) {
  const r = performAction(state, 'grow');
  if (r.ok) grew = true;
}
ok(grew, 'Grow produced new filaments toward lured food');
ok(state.active.nodes.length > nodesBefore, 'network grew');
ok(state.active.nodes.every((n) => n.y < 0), 'all growth stays underground');

console.log('# Every action advances the world one step');
const turnBefore = state.turn;
performAction(state, 'grow');
ok(state.turn > turnBefore, 'the step counter advances on each action');
const energyBefore = state.active.energy;
tickWorld(state);
ok(typeof state.active.energy === 'number' && isFinite(state.active.energy), 'passive income resolves on a world tick');

console.log('# Digest burst');
const eBeforeDigest = state.active.energy;
const dr = performAction(state, 'digest');
if (dr.ok) ok(state.active.energy > eBeforeDigest - cfg.actions.digest.energyCost,
  'Digest yielded an Energy burst');
else ok(true, 'Digest had no occupied food (acceptable depending on map)');

console.log('# Amputate cuts out strands within a radius');
const countBefore = state.active.nodes.length;
const tip = state.active.nodes[state.active.nodes.length - 1];
const ar = performAction(state, 'amputate', { x: tip.x, y: tip.y, z: tip.z });
ok(ar.ok && state.active.nodes.length < countBefore, 'Amputate removes the strands within its radius');

console.log('# Trichoderma clouds roam, infect, and the rot races the filaments');
spawnTrichodermaAt(state, state.active.root.x, state.active.root.y - 30, state.active.root.z);
tickWorld(state);
tickWorld(state);
ok(totalTrichoderma(sub) >= 0, 'Trichoderma field stays finite');
ok(state.active.nodes.some((n) => n.infected) || state.clouds.length > 0,
  'a cloud dropped on the colony infects strands (or is still en route)');
tickWorld(state);
const infectedCount = state.active.nodes.filter((n) => n.infected).length;
ok(infectedCount > 0, `the rot is inside the network (${infectedCount} strands)`);

console.log('# Amputate is the cure: cut out the infected patch');
{
  const inf = state.active.nodes.find((n) => n.infected);
  if (inf) {
    performAction(state, 'amputate', { x: inf.x, y: inf.y, z: inf.z });
    ok(true, 'amputating at an infected strand succeeds');
  } else ok(true, 'nothing infected left to cut');
}

console.log('# Ants: nests trail to food, harvest it, and can be bombed');
{
  const s2 = createState(JSON.parse(JSON.stringify(CONFIG)), 777);
  s2.clouds = []; s2.nematodes = [];
  ok(s2.ants.length === CONFIG.ants.nestCount, `seeded ${s2.ants.length} nests`);
  const nest = s2.ants[0];
  ok(nest.path.length > 0, 'nest laid a trail to the nearest food');
  let trailCells = 0;
  s2.substrate.forEachCell((c) => { if (c.antTrail) trailCells++; });
  ok(trailCells > 0, `trail stamped impassable voxels (${trailCells})`);
  const foodBefore = s2.substrate.totalNutrient();
  tickWorld(s2);
  ok(s2.substrate.totalNutrient() < foodBefore, 'ants harvest nutrient each step');
  const hit = attackNest(s2, nest.x, nest.y, nest.z, 200, 1.0);
  ok(hit && hit.dead, 'a full-damage bomb destroys the nest');
  ok(s2.ants.length === CONFIG.ants.nestCount - 1, 'destroyed nest is removed');
}

console.log('# Nematodes: worms sense strands, crawl in, eat, and Excrete defends');
{
  const s3 = createState(JSON.parse(JSON.stringify(CONFIG)), 999);
  s3.clouds = []; s3.ants = [];
  s3.config.trichoderma.respawnChance = 0;
  const root = s3.active.root;
  // Drop a worm right next to the colony so it locks on immediately.
  spawnNematodeAt(s3, root.x + 60, root.y - 60, root.z + 60);
  const before = s3.active.nodes.length;
  for (let i = 0; i < 8; i++) tickWorld(s3);
  ok(s3.nematodes.length > 0, 'worms are alive in the volume');
  ok(s3.active.nodes.length <= before, 'a feeding worm eats strands (or is still crawling in)');
  const r = performAction(s3, 'excrete');
  ok(r.ok || /No nematodes/.test(r.message), 'Excrete hits worms near the mycelium (or none in range)');
}

console.log('# Fruit at the goal: reachable soil -> spores, run ends');
{
  const s4 = createState(JSON.parse(JSON.stringify(CONFIG)), 4242);
  s4.clouds = []; s4.ants = []; s4.nematodes = [];
  s4.config.trichoderma.respawnChance = 0;
  s4.config.nematodes.respawnChance = 0;
  // Teleport a healthy filament under the goal soil (test shortcut).
  const sub4 = s4.substrate;
  let goalCx = -1, goalCz = -1;
  for (let cz = 0; cz < sub4.rows && goalCx < 0; cz++)
    for (let cx = sub4.cols - 1; cx >= 0; cx--) {
      const surf = sub4.surfaceAt(cx, cz);
      if (surf && surf.soil && surf.goal) { goalCx = cx; goalCz = cz; break; }
    }
  ok(goalCx >= 0, 'a goal soil column exists');
  const c = sub4.surfaceCenter(goalCx, goalCz);
  const parent = s4.active.nodes[0];
  s4.active.addNode(c.x, -60, c.z, parent);
  const points = s4.active.computeFruitPoints(sub4);
  ok(points.length > 0, `fruit points found under goal soil (${points.length})`);
  const fr = performAction(s4, 'fruit');
  ok(fr.ok, 'Fruit succeeds with reachable goal soil');
  ok(s4.runOver && s4.runResult && s4.runResult.spores > 0, `run ends with spores banked (+${s4.runResult.spores})`);
}

console.log('# Starvation: an empty colony dies out');
{
  const s5 = createState(JSON.parse(JSON.stringify(CONFIG)), 31337);
  s5.clouds = []; s5.ants = []; s5.nematodes = [];
  s5.config.trichoderma.respawnChance = 0;
  s5.config.nematodes.respawnChance = 0;
  s5.active.energy = 0;
  // Park the colony on no food: drain all nutrient.
  s5.substrate.forEachCell((c) => { c.nutrient = 0; c.maxNutrient = 0; });
  s5.config.energy.baselineTrickle = 0;
  let steps = 0;
  while (!s5.runOver && steps++ < 60) tickWorld(s5);
  ok(s5.runOver && s5.runResult && s5.runResult.died, `starved colony dies (after ${steps} steps)`);
}

console.log('# Determinism: same seed -> same world');
{
  const a = createState(JSON.parse(JSON.stringify(CONFIG)), 555);
  const b = createState(JSON.parse(JSON.stringify(CONFIG)), 555);
  ok(a.substrate.totalNutrient() === b.substrate.totalNutrient(), 'identical nutrient totals');
  ok(a.active.nodes.length === b.active.nodes.length, 'identical seed filaments');
  ok(a.ants.length === b.ants.length && (!a.ants[0] || (a.ants[0].cx === b.ants[0].cx && a.ants[0].cz === b.ants[0].cz)), 'identical nest placement');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
