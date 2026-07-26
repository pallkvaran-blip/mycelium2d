// Campaign threat scaling: the per-level nematode / Trichoderma counts.
// Run with: node --test test/*.js   (or: node test/threats.test.js)
//
// From level 7 the extras COMPOUND: threatRatePerLevel is how many more each level adds on
// top of the previous one, so threatBonusForLevel integrates a rising rate and the totals
// grow quadratically. Owner-specified, with awkward breakpoints (7, 10, then every 5 from
// 15), so the numbers are pinned exactly rather than described — a change here should be a
// deliberate balance decision, not a refactor accident.

// Also covers the two things tied to that curve: the escalation taunt shown on each step-up
// level, and START_LEVEL_SHIFT (every species opens 2 levels earlier, to buy engine-building
// runway before the escalation bites).

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { SPECIES, LEVEL_THREATS, MAX_LEVEL, MAX_ANT_NESTS, START_LEVEL_SHIFT, threatsForLevel, threatBonusForLevel, threatRatePerLevel, escalationNote, startLevelRange, defaultStartLevel, levelFromUnlock } from '../src/species.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ok  -', msg); }
  else { failed++; console.error('  FAIL-', msg); }
}

console.log('# Per-level rate (threatRatePerLevel)');
{
  // Every breakpoint, plus the level either side so an off-by-one can't hide.
  const expect = [
    [1, 0], [6, 0],
    [7, 2], [9, 2],
    [10, 3], [14, 3],
    [15, 4], [19, 4],
    [20, 5], [24, 5],
    [25, 6], [29, 6],
    [30, 7], [34, 7],
    [35, 8], [40, 9], [50, 11], [100, 21],
  ];
  for (const [lvl, want] of expect) {
    const got = threatRatePerLevel(lvl);
    ok(got === want, `level ${lvl} adds +${want}/level (got +${got})`);
  }
}

console.log('\n# Accumulated extras (threatBonusForLevel = every rate from 7 up)');
{
  const expect = [
    [6, 0],
    [7, 2], [8, 4], [9, 6],        // +2/level
    [10, 9], [11, 12], [14, 21],   // +3/level
    [15, 25], [19, 41],            // +4/level
    [20, 46], [24, 66],            // +5/level
    [25, 72], [29, 96],            // +6/level
    [30, 103],                     // +7/level
    [50, 277], [100, 1062],
  ];
  for (const [lvl, want] of expect) {
    const got = threatBonusForLevel(lvl);
    ok(got === want, `level ${lvl} carries +${want} accumulated (got +${got})`);
  }
  ok(threatBonusForLevel(0) === 0 && threatBonusForLevel(-3) === 0, 'level 0 / negative clamps to 0 extras');
}

console.log('\n# Seeded counts (threatsForLevel = base curve + accumulated extras)');
{
  // The owner's worked example: level 7 → 9, level 8 → 12, and up from there.
  const expect = [
    [1, 1], [6, 6],                           // on-ramp untouched
    [7, 9], [8, 12], [9, 15],
    [10, 19], [11, 23], [12, 27], [14, 35],
    [15, 40], [20, 66], [25, 97], [30, 133],
    [50, 327], [100, 1162],
  ];
  for (const [lvl, want] of expect) {
    const t = threatsForLevel(lvl);
    ok(t.nematodes === want && t.trych === want,
      `level ${lvl} seeds ${want} nematodes and ${want} Trichoderma (got ${t.nematodes}/${t.trych})`);
  }
  // The step between consecutive levels must WIDEN — that's the whole difference from the
  // flat version this replaced (which stepped by a constant +1 between breakpoints).
  const step = (l) => threatsForLevel(l + 1).nematodes - threatsForLevel(l).nematodes;
  ok(step(5) === 1, 'below level 7 the step is still the base +1');
  ok(step(7) === 3, 'level 7→8 steps by 3 (base +1 and rate +2)');
  ok(step(10) === 4 && step(20) === 6 && step(30) === 8, 'the step keeps widening with the rate');
}

console.log('\n# What the extras must NOT touch');
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

  // DOCUMENTED consequence of a compounding curve, not an accident: past level 32 the seed
  // alone exceeds config.nematodes.maxPopulation. Seeding does not consult that cap (only
  // breeding and the respawn trickle do), so the population simply starts above its own
  // ceiling and stops breeding. If this line ever fails, the curve or the cap moved — decide
  // which is right rather than "fixing" the test.
  let firstOver = null;
  for (let lvl = 7; lvl <= MAX_LEVEL; lvl++) {
    if (threatsForLevel(lvl).nematodes > CONFIG.nematodes.maxPopulation) { firstOver = lvl; break; }
  }
  ok(firstOver === 33, `the seed first passes maxPopulation (${CONFIG.nematodes.maxPopulation}) at level ${firstOver}`);
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
  for (const [lvl, want] of [[6, 6], [7, 9], [8, 12], [20, 66], [30, 133], [100, 1162]]) {
    const s = createState(levelCfg(lvl), 9000 + lvl);
    ok(s.nematodes.length === want, `level ${lvl} map really holds ${want} worms (got ${s.nematodes.length})`);
    ok(s.clouds.length === want, `level ${lvl} map really holds ${want} mould clouds (got ${s.clouds.length})`);
    // A dropped placement would be invisible in the count above if seeding ever bailed,
    // and an entity inside rock would be unreachable/unkillable.
    ok(s.nematodes.every((w) => { const c = s.substrate.cellAtWorld(w.x, w.y); return c && !c.rock; }),
      `level ${lvl}: every worm seeded in open soil`);
  }
}

console.log('\n# Escalation taunt (level-intro subtitle)');
{
  // Exactly the levels where the rate steps up, and nowhere else.
  const steps = [7, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  const got = [];
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) if (escalationNote(lvl)) got.push(lvl);
  ok(got.join(',') === steps.join(','), `a taunt appears on exactly the ${steps.length} step-up levels (got ${got.length})`);
  ok(!escalationNote(1) && !escalationNote(6) && !escalationNote(8) && !escalationNote(21),
    'quiet levels get no subtitle (1, 6, 8, 21)');

  // The "+N per level" tail is generated from the live rate, so it can never disagree with
  // the curve. If someone retunes threatRatePerLevel, this keeps the copy honest.
  let tailsMatch = true;
  for (const lvl of steps) if (!escalationNote(lvl).endsWith('+' + threatRatePerLevel(lvl) + ' per level')) tailsMatch = false;
  ok(tailsMatch, 'every taunt ends with the level\'s REAL rate');

  // The owner's own wording, verbatim.
  const authored = {
    7: 'Time to turn up the heat: +2 per level',
    10: "You're doing well. Time to die. +3 per level",
    15: "Think you're unstoppable? +4 per level",
    20: 'How are you still alive? +5 per level',
    25: 'Ok, now this is just getting too weird. +6 per level',
    30: 'You officially broke the game. +7 per level',
  };
  for (const [lvl, want] of Object.entries(authored)) {
    ok(escalationNote(+lvl) === want, `level ${lvl}: "${want}"`);
  }
  ok(steps.every((l) => escalationNote(l).length <= 80), 'no taunt runs long enough to wrap badly on a phone');
}

console.log('\n# Start levels shift 2 earlier (START_LEVEL_SHIFT)');
{
  ok(START_LEVEL_SHIFT === 2, 'the shift is 2 levels');
  // id → the start level a player should now see.
  const want = {
    marasmius: 1, armillaria: 1, ganoderma: 1, pleurotus: 1,   // already at the floor
    suillus: 1, hydnellum: 1,                                   // were 3
    stropharia: 3, scleroderma: 3,                              // were 5
    cortinarius: 5, serpula: 5,                                 // were 7
    psilocybe: 1,                                               // communal tier, no level in its label
  };
  for (const [id, lvl] of Object.entries(want)) {
    const sp = SPECIES.find((s) => s.id === id);
    ok(!!sp, `species ${id} exists`);
    if (sp) ok(defaultStartLevel(sp) === lvl, `${sp.name} starts on level ${lvl} (got ${defaultStartLevel(sp)})`);
  }
  // The adjustable memory colony: range and default both move down by 2.
  const split = SPECIES.find((s) => s.id === 'schizophyllum');
  const r = startLevelRange(split);
  ok(r.min === 1 && r.max === 8 && r.adjustable, `Split Gill dials 1–8 (got ${r.min}–${r.max})`);
  ok(defaultStartLevel(split) === 8, `Split Gill defaults to 8 (got ${defaultStartLevel(split)})`);

  // Never below level 1, and never above the level you unlocked it on.
  for (const sp of SPECIES) {
    const rr = startLevelRange(sp);
    ok(rr.min >= 1 && rr.max >= rr.min, `${sp.name}: range is sane (${rr.min}–${rr.max})`);
    const u = levelFromUnlock(sp.unlock);
    if (u) ok(rr.max <= u, `${sp.name}: start (${rr.max}) never exceeds its unlock level (${u})`);
  }

  // The UNLOCK requirement must NOT have moved — you still earn the species the same way.
  const unlocks = SPECIES.map((s) => s.id + ':' + (s.unlock || 'none')).join(' ');
  ok(unlocks.includes('stropharia:Complete level 5') && unlocks.includes('cortinarius:Complete level 7')
    && unlocks.includes('schizophyllum:Complete level 10'),
    'unlock labels are untouched (only the START level moved)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
