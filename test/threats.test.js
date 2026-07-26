// Campaign threat scaling: the per-level nematode / Trichoderma counts.
// Run with: node --test test/*.js   (or: node test/threats.test.js)
//
// These numbers are an owner-specified curve with awkward breakpoints (7, 10, then
// every 5 from 15), so they are pinned exactly rather than described. A change here
// should be a deliberate balance decision, not a refactor accident.

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { LEVEL_THREATS, MAX_LEVEL, MAX_ANT_NESTS, threatsForLevel, threatBonusForLevel } from '../src/species.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ok  -', msg); }
  else { failed++; console.error('  FAIL-', msg); }
}

console.log('# Late-game threat bonus (threatBonusForLevel)');
{
  // Every breakpoint, plus the level either side of it so an off-by-one can't hide.
  const expect = [
    [1, 0], [5, 0], [6, 0],
    [7, 2], [8, 2], [9, 2],
    [10, 3], [11, 3], [14, 3],
    [15, 4], [19, 4],
    [20, 5], [24, 5],
    [25, 6], [29, 6],
    [30, 7], [34, 7],
    [35, 8], [40, 9], [50, 11], [100, 21],
  ];
  for (const [lvl, want] of expect) {
    const got = threatBonusForLevel(lvl);
    ok(got === want, `level ${lvl} → +${want} of each (got +${got})`);
  }
  ok(threatBonusForLevel(0) === 0 && threatBonusForLevel(-3) === 0, 'level 0 / negative clamps to the level-1 bonus (0)');
}

console.log('\n# Seeded counts (threatsForLevel = base curve + bonus)');
{
  // level → {nematodes, trych}
  const expect = [
    [1, 1], [6, 6],            // on-ramp untouched
    [7, 9], [9, 11],           // +2
    [10, 13], [11, 14],        // +3 (still inside the authored table)
    [12, 15], [14, 17],        // +3 (computed levels)
    [15, 19], [20, 25],
    [25, 31], [30, 37],
    [100, 121],
  ];
  for (const [lvl, want] of expect) {
    const t = threatsForLevel(lvl);
    ok(t.nematodes === want && t.trych === want,
      `level ${lvl} seeds ${want} nematodes and ${want} Trichoderma (got ${t.nematodes}/${t.trych})`);
  }
}

console.log('\n# What the bonus must NOT touch');
{
  // Ants keep their own curve and cap — the bonus is nematodes + mould only.
  for (const lvl of [7, 10, 15, 20, 30, 100]) {
    const t = threatsForLevel(lvl);
    const base = lvl < LEVEL_THREATS.length ? LEVEL_THREATS[lvl].ants : Math.min(MAX_ANT_NESTS, 6 + Math.floor((lvl - 11) / 4));
    ok(t.ants === base, `level ${lvl} ant nests unchanged at ${base}`);
  }
  ok(threatsForLevel(MAX_LEVEL).ants === MAX_ANT_NESTS, `ant nests still cap at ${MAX_ANT_NESTS} on the last level`);

  // Levels 1..6 must match the authored table exactly (the early game is deliberately
  // tuned and the complaint was about the MID game).
  for (let lvl = 1; lvl <= 6; lvl++) {
    const t = threatsForLevel(lvl), a = LEVEL_THREATS[lvl];
    ok(t.ants === a.ants && t.nematodes === a.nematodes && t.trych === a.trych,
      `level ${lvl} is exactly the authored row (${a.ants}/${a.nematodes}/${a.trych})`);
  }
}

console.log('\n# Shape / safety');
{
  // The old implementation handed back the shared LEVEL_THREATS row, so a caller mutating
  // the result would rewrite the authored curve for the whole session.
  const a = threatsForLevel(3);
  a.nematodes = 999;
  ok(threatsForLevel(3).nematodes === 3, 'the returned object is a copy — mutating it cannot corrupt LEVEL_THREATS');
  ok(LEVEL_THREATS[3].nematodes === 3, 'the authored table itself is untouched');

  // Difficulty must never dip as you go deeper.
  let prevN = -1, prevT = -1, monotonic = true;
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
    const t = threatsForLevel(lvl);
    if (t.nematodes < prevN || t.trych < prevT) monotonic = false;
    prevN = t.nematodes; prevT = t.trych;
  }
  ok(monotonic, `nematode + Trichoderma counts never decrease across levels 1..${MAX_LEVEL}`);

  // Seeding ignores maxPopulation (only the respawn trickle checks it), so the deepest
  // level must not seed past the hard cap or the population starts over its own ceiling.
  const deepest = threatsForLevel(MAX_LEVEL).nematodes;
  ok(deepest <= CONFIG.nematodes.maxPopulation,
    `level ${MAX_LEVEL} seeds ${deepest} worms, within maxPopulation ${CONFIG.nematodes.maxPopulation}`);
}

console.log('\n# The numbers actually reach the map');
{
  // Mirrors main.js configForLevel (browser-only, so it can't be imported here): the whole
  // point is that a raised count is really SEEDED, not just returned by a pure function.
  const levelCfg = (level) => {
    const t = threatsForLevel(level);
    const c = JSON.parse(JSON.stringify(CONFIG));
    c.ants.nestCount = t.ants;
    c.nematodes.initialCount = t.nematodes;
    c.trichoderma.initialPatches = t.trych;
    return c;
  };
  for (const [lvl, want] of [[6, 6], [7, 9], [20, 25], [30, 37]]) {
    const s = createState(levelCfg(lvl), 9000 + lvl);
    ok(s.nematodes.length === want, `level ${lvl} map really holds ${want} worms (got ${s.nematodes.length})`);
    ok(s.clouds.length === want, `level ${lvl} map really holds ${want} mould clouds (got ${s.clouds.length})`);
    // A dropped placement would be invisible in the count above if seeding ever bailed,
    // and an entity inside rock would be unreachable/unkillable.
    ok(s.nematodes.every((w) => { const c = s.substrate.cellAtWorld(w.x, w.y); return c && !c.rock; }),
      `level ${lvl}: every worm seeded in open soil`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
