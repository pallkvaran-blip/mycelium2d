// Headless playtest bot — a balance harness (run: node mycelium3d/test/playtest.mjs [seeds…]).
//
// Plays a whole run with a simple honest strategy: grow when food is sensed,
// lure eastward along the carved route when it isn't, digest when hungry,
// amputate infection, excrete feeding worms, and fruit once the colony
// reaches the goal soil. Reports whether the run is winnable and how it went.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { performAction, actionBlockedReason } from '../src/engine/actions.js';

function play(seed, { verbose = false, maxSteps = 500 } = {}) {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  const state = createState(cfg, seed);
  const sub = state.substrate;
  const net = state.active;
  const g = cfg.growth;

  const goalStartX = (sub.cols - cfg.substrate.goalCols - cfg.substrate.goalSummerCols) * sub.cellSize;
  let acted = 0, lures = 0, grows = 0, digests = 0, amputates = 0, excretes = 0, bombs = 0, stalls = 0, lureVanished = 0;
  const trace = [];

  const easternmost = () => {
    let best = null;
    for (const n of net.nodes) if (!n.infected && (!best || n.x > best.x)) best = n;
    return best;
  };

  // Does any (healthy) node currently sense food? (mirrors the grow rule)
  const foodSensed = () => {
    const sense2 = g.sensingRadius * g.sensingRadius;
    const kill2 = g.killDistance * g.killDistance;
    let sensed = false;
    sub.forEachCell((cell, cx, cy, cz) => {
      if (sensed || cell.nutrient <= g.attractorThreshold) return;
      const c = sub.cellCenter(cx, cy, cz);
      let nd2 = Infinity;
      for (const n of net.nodes) {
        if (n.infected) continue;
        const dx = c.x - n.x, dy = c.y - n.y, dz = c.z - n.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < nd2) nd2 = d2;
      }
      if (nd2 < sense2 && nd2 > kill2) sensed = true;
    });
    return sensed;
  };

  while (!state.runOver && acted < maxSteps) {
    const infected = net.nodes.filter((n) => n.infected);

    // 0) survival first: cut out the rot the moment it appears. Cutting AT an
    // infected strand guarantees the sphere removes at least that strand.
    if (infected.length > 0) {
      const n = infected[0];
      if (!actionBlockedReason(state, 'amputate')) {
        performAction(state, 'amputate', { x: n.x, y: n.y, z: n.z }); acted++; amputates++;
        continue;
      }
    }
    // 0b) worms feeding on us → excrete
    if ((state.nematodes || []).some((w) => w.feeding) && !actionBlockedReason(state, 'excrete')) {
      performAction(state, 'excrete'); acted++; excretes++;
      continue;
    }
    // 0c) an ant trail chewing through the colony → bomb that nest until it falls
    if (state.ants.length && !actionBlockedReason(state, 'attackAnts') && net.energy > 60) {
      let threatened = false;
      for (const n of net.nodes) {
        for (const [dx, dy, dz] of [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
          const cell = sub.cellAt(sub.colAtX(n.x) + dx, sub.layAtY(n.y) + dy, sub.rowAtZ(n.z) + dz);
          if (cell && cell.antTrail) { threatened = true; break; }
        }
        if (threatened) break;
      }
      if (threatened) {
        let nest = null, best = Infinity;
        for (const a of state.ants) {
          const d = Math.hypot(a.x - net.root.x, a.z - net.root.z);
          if (d < best) { best = d; nest = a; }
        }
        performAction(state, 'attackAnts', { x: nest.x, y: nest.y, z: nest.z }); acted++; bombs++;
        continue;
      }
    }

    // 1) fruit once the colony is under the goal soil
    const points = net.computeFruitPoints(sub);
    if (points.length >= 2 && !actionBlockedReason(state, 'fruit')) {
      performAction(state, 'fruit'); acted++;
      break;
    }

    // 2) hungry? digest occupied food
    if (net.energy < 45) {
      const cells = net.collectOccupiedCells(sub).filter((c) => c.nutrient > 0);
      if (cells.length && !actionBlockedReason(state, 'digest')) {
        performAction(state, 'digest'); acted++; digests++;
        continue;
      }
    }

    // 2b) a mould cloud camped on the frontier eats every lure the tick it
    // lands (never touching us, never spending itself). Counter-play: stop
    // feeding it — pass the turn with a cheap sacrificial rear cut so the
    // cloud's only target becomes the colony; it attacks, spends itself, and
    // the infection is amputated by rule 0.
    if (lureVanished >= 2) {
      lureVanished = 0;
      let rear = null;
      for (const n of net.nodes) if (!n.infected && (!rear || n.x < rear.x)) rear = n;
      if (rear && net.nodes.length > 30 && !actionBlockedReason(state, 'amputate')) {
        for (let k = 0; k < 3 && !state.runOver; k++) {   // wait ~3 beats
          performAction(state, 'amputate', { x: rear.x, y: rear.y, z: rear.z }); acted++; amputates++;
          if (net.nodes.some((n) => n.infected)) break;   // it took the bait
        }
        continue;
      }
    }

    // 3) grow toward sensed food, else lure eastward along the carved route
    if (foodSensed() && !actionBlockedReason(state, 'grow')) {
      const r = performAction(state, 'grow'); acted++; grows++;
      if (r.ok) { lureVanished = 0; continue; }
    }
    const tip = easternmost();
    if (!tip) break;
    // Follow the carved tunnel: walk the (pathLay, pathZ) waypoint line east
    // from the tip's column and lure at the farthest waypoint still within
    // sensing range — waypoints are carved, so they are never rock.
    const tipCx = Math.max(0, Math.min(sub.cols - 1, sub.colAtX(tip.x)));
    let target = null;
    for (let cx = Math.min(sub.cols - 2, tipCx + 4); cx > tipCx; cx--) {
      const c = sub.cellCenter(cx, sub.pathLay[cx], sub.pathZ[cx]);
      const cell = sub.cellAt(cx, sub.pathLay[cx], sub.pathZ[cx]);
      if (!cell || cell.rock) continue;
      if (Math.hypot(c.x - tip.x, c.y - tip.y, c.z - tip.z) <= g.sensingRadius * 0.92) { target = c; break; }
    }
    if (!target) {
      // tip is off the tunnel line — pull it back toward the nearest waypoint
      const c = sub.cellCenter(tipCx, sub.pathLay[tipCx], sub.pathZ[tipCx]);
      const d = Math.hypot(c.x - tip.x, c.y - tip.y, c.z - tip.z) || 1;
      const f = Math.min(1, (g.sensingRadius * 0.8) / d);
      target = { x: tip.x + (c.x - tip.x) * f, y: tip.y + (c.y - tip.y) * f, z: tip.z + (c.z - tip.z) * f };
    }
    if (actionBlockedReason(state, 'addSubstrate')) {
      // out of energy and nothing to digest → grow anyway or die trying
      if (!actionBlockedReason(state, 'grow')) { performAction(state, 'grow'); acted++; grows++; continue; }
      break;
    }
    const before = state.turn;
    performAction(state, 'addSubstrate', target); acted++; lures++;
    if (state.turn === before) stalls++; else stalls = 0;
    if (stalls > 8) break;   // action keeps failing — abort rather than spin
    if (state.turn !== before && !foodSensed()) lureVanished++;   // eaten within its own tick
    if (verbose && acted % 25 === 0) {
      trace.push(`step ${acted}: e=${Math.round(net.energy)} nodes=${net.nodes.length} maxX=${Math.round(easternmost()?.x || 0)}/${goalStartX}`);
    }
  }

  const maxX = net.nodes.length ? Math.max(...net.nodes.map((n) => n.x)) : 0;
  return {
    seed,
    won: !!(state.runResult && state.runResult.spores > 0),
    died: !!(state.runResult && state.runResult.died),
    spores: state.runResult ? state.runResult.spores || 0 : 0,
    bodies: state.runResult ? state.runResult.bodies || 0 : 0,
    steps: acted, grows, lures, digests, amputates, excretes, bombs,
    nodes: net.nodes.length,
    progress: `${Math.round((maxX / goalStartX) * 100)}%`,
    energy: Math.round(net.energy),
    trace,
  };
}

const seeds = process.argv.slice(2).map(Number);
const list = seeds.length ? seeds : [12345, 777, 999, 4242, 31337, 555, 20260702, 1];
let wins = 0;
for (const seed of list) {
  const r = play(seed, { verbose: true });
  if (r.won) wins++;
  console.log(`seed ${String(seed).padEnd(9)} ${r.won ? 'WON ' : r.died ? 'DIED' : 'stall'}  spores=${String(r.spores).padEnd(4)} bodies=${String(r.bodies).padEnd(3)} steps=${String(r.steps).padEnd(4)} grows=${String(r.grows).padEnd(3)} lures=${String(r.lures).padEnd(3)} digest=${String(r.digests).padEnd(3)} amp=${String(r.amputates).padEnd(3)} exc=${String(r.excretes).padEnd(3)} bomb=${String(r.bombs).padEnd(2)} nodes=${String(r.nodes).padEnd(5)} progress=${r.progress} e=${r.energy}`);
  for (const t of r.trace.slice(-3)) console.log('   ', t);
}
console.log(`\n${wins}/${list.length} runs won`);
