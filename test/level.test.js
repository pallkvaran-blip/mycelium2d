// Hand-authored levels: the level-editor format -> a playable Substrate.
// Run with: node --test test/*.js   (or: node test/level.test.js)
//
// The point of these checks is that an authored map is INDISTINGUISHABLE from a
// generated one to the rest of the engine: same cell flags, same foodPiles /
// reservoirs shapes, same threat objects — only the geometry is designed.

import { CONFIG } from '../src/config.js';
import { createLevelState } from '../src/engine/state.js';
import { buildLevel, blankLevel, isLevel, configForLevelDef, LEVEL_FORMAT } from '../src/engine/level.js';
import { tickWorld } from '../src/engine/turn.js';

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ok  -', msg); }
  else { failed++; console.error('  FAIL-', msg); }
}

const cfg = JSON.parse(JSON.stringify(CONFIG));

console.log('# Level format');
{
  const b = blankLevel();
  ok(b.format === LEVEL_FORMAT && b.version === 1, 'blankLevel stamps format + version');
  ok(isLevel(b), 'blankLevel validates');
  ok(!isLevel({ format: 'something-else', objects: [] }), 'a foreign format is rejected');
  ok(!isLevel({ format: LEVEL_FORMAT }), 'a document with no objects[] is rejected');
  ok(!isLevel(null), 'null is rejected');
}

// A small but complete level: one of everything the editor can place.
function demoLevel() {
  const L = blankLevel();
  L.name = 'Test crossing';
  L.campaignLevel = 1;
  L.objects = [
    { t: 'boulder', key: 'rockSlate', x: 700, y: 700, w: 80, h: 64, rot: 0.3 },
    { t: 'formation', key: 'rockform3', x: 1100, y: 900, w: 260, h: 150, rot: 0 },
    { t: 'lake', key: 'lake2', x: 1500, w: 360, h: 130 },
    { t: 'reservoir', key: 'reservoir1', x: 1900, y: 1100, r: 90 },
    { t: 'food', kind: 'duff', x: 400, y: 560, r: 1, energy: 2 },
    { t: 'food', kind: 'cache', x: 900, y: 620, r: 2, energy: 3 },
    { t: 'food', kind: 'cache-engine', x: 1700, y: 480, r: 1, energy: 4 },
    { t: 'ant', x: 1200 },
    { t: 'nematode', x: 1000, y: 800 },
    { t: 'nematode', x: 1300, y: 950 },
    { t: 'trichoderma', x: 1600, y: 760, r: 44 },
    { t: 'mountain', x: 800, w: 150 },
  ];
  return L;
}

console.log('\n# buildLevel — geometry');
{
  const L = demoLevel();
  const c = configForLevelDef(cfg, L);
  const { substrate: sub, spawns, startCol } = buildLevel(c, L);

  ok(sub.cols > 0 && sub.rows > 0, 'grid sized from the level world box');
  ok(sub.authored === true, 'substrate is flagged authored');
  ok(startCol >= 1, 'start column is inside the entry zone');

  // Rocks are NOT baked into cells — main.js solidifyRock stamps them from the
  // sprite silhouette so collision matches the drawn art (see engine/level.js).
  ok(sub.levelSprites.length === 2, 'both rock objects published as sprites');
  const boulder = sub.levelSprites[0];
  ok(boulder.key === 'rockSlate' && boulder.style === 'boulder', 'boulder keeps its art + style');
  ok(Math.abs(boulder.rot - 0.3) < 1e-9 && boulder.w === 80 && boulder.h === 64, 'boulder keeps its size + rotation verbatim');
  let rockCells = 0;
  sub.forEachCell((cell) => { if (cell.rock && !cell.water) rockCells++; });
  ok(rockCells === 0, 'no rock cells baked at build time (solidifyRock owns that)');

  // Lake: impassable water hanging off the surface, deepest in the middle.
  const lakeCols = [];
  for (let col = 0; col < sub.cols; col++) if (sub.surface[col].barrier === 'lake') lakeCols.push(col);
  ok(lakeCols.length === 10, 'lake spans 360/36 = 10 columns');
  ok(sub.surface[lakeCols[0]].soil === false && sub.surface[lakeCols[0]].goal === false, 'lake columns are un-surfaceable');
  const depthAt = (col) => { let d = 0; while (sub.cellAt(col, d) && sub.cellAt(col, d).water) d++; return d; };
  const mid = lakeCols[Math.floor(lakeCols.length / 2)];
  ok(depthAt(mid) > depthAt(lakeCols[0]), 'lake bowl is deepest at the centre');
  ok(sub.cellAt(mid, 0).rock === true && sub.cellAt(mid, 0).water === true, 'lake water is impassable (rock+water)');
  ok(sub.lakeArt[lakeCols[0]] === 'lake2', 'the authored lake art is recorded for the renderer');

  // Reservoir: same record shape generateSubstrate produces, so drawReservoirs
  // and the Water-income code need no special case.
  ok(sub.reservoirs.length === 1, 'one reservoir placed');
  const res = sub.reservoirs[0];
  ok(res.id === 1 && res.key === 'reservoir1', 'reservoir carries its id + authored art');
  ok(res.c1 >= res.c0 && res.r1 >= res.r0, 'reservoir bounding box is filled in');
  ok(sub.cellAt(res.cx, res.cy).reservoir === 1, 'reservoir cells are tagged with the pool id');
  ok(sub.cellAt(res.cx, res.cy).water === true, 'reservoir centre is water');

  // Food piles.
  ok(sub.foodPiles.length === 3, 'three food piles registered');
  const kinds = sub.foodPiles.map((p) => p.kind).sort();
  ok(kinds.join(',') === 'duff,engine,normal', 'pile kinds map to duff / normal / engine');
  const r2 = sub.foodPiles.find((p) => p.cells.length === 13);
  ok(!!r2, 'a radius-2 pile stamps a 13-cell diamond');
  const eng = sub.foodPiles.find((p) => p.kind === 'engine');
  ok(eng.energyValue === 4, 'authored Energy value is kept');
  const per = eng.energyValue / (eng.cells.length * c.substrate.foodCellNutrient);
  ok(Math.abs(sub.cells[eng.cells[0]].energyPerNutrient - per) < 1e-12,
    'energy-per-nutrient is spread so draining the pile pays exactly its value');
  ok(sub.cells[eng.cells[0]].foodKind === 'cache-engine', 'engine pile cells render as red litter');

  // Surface layout.
  ok(sub.surface[sub.cols - 1].goal === true && sub.surface[sub.cols - 1].soil === true, 'goal zone is fruitable');
  ok(sub.surface[Math.floor(800 / 36)].barrier === 'mountain', 'mountain marks its surface columns');

  // Threat spawns are handed to the caller, not baked into the substrate.
  ok(spawns.ants.length === 1 && spawns.ants[0] === Math.floor(1200 / 36), 'ant nest column derived from its x');
  ok(spawns.nematodes.length === 2, 'both nematodes queued');
  ok(spawns.clouds.length === 1 && spawns.clouds[0].r === 44, 'cloud keeps its authored radius');
}

console.log('\n# Entry + goal channels');
{
  const L = demoLevel();
  // A rock parked right on the entry must not seal the colony in.
  L.objects.push({ t: 'boulder', key: 'rockSlate', x: 40, y: 500, w: 200, h: 200, rot: 0 });
  const { substrate: sub } = buildLevel(configForLevelDef(cfg, L), L);
  ok(sub.cellAt(0, 3).pathClear === true, 'entry channel is dug clear');
  ok(sub.cellAt(sub.cols - 1, 3).pathClear === true, 'goal channel is dug clear');
  let midClear = 0;
  for (let r = 0; r < sub.rows; r++) if (sub.cellAt(Math.floor(sub.cols / 2), r).pathClear) midClear++;
  ok(midClear === 0, 'NO guaranteed corridor in between — the authored route is the only route');

  const L2 = demoLevel();
  L2.layout.clearChannels = false;
  const { substrate: sub2 } = buildLevel(configForLevelDef(cfg, L2), L2);
  ok(sub2.cellAt(0, 3).pathClear !== true, 'channels can be turned off');
}

console.log('\n# createLevelState — a real run');
{
  const L = demoLevel();
  const s = createLevelState(cfg, 999, L);
  ok(s.active && s.active.nodes.length > 0, 'colony seeded at the entry');
  ok(s.ants.length === 1, 'one ant nest on the map');
  ok(s.nematodes.length === 2, 'two nematodes on the map');
  ok(s.clouds.length === 1, 'one Trichoderma cloud on the map');
  ok(Math.abs(s.nematodes[0].x - 1000) < 1e-9 && Math.abs(s.nematodes[0].y - 800) < 1e-9,
    'a nematode sits exactly where it was placed');
  ok(Math.abs(s.clouds[0].cx - 1600) < 1e-9, 'a cloud sits exactly where it was placed');
  ok(s.ants[0].col === Math.floor(1200 / 36) && s.ants[0].y === s.substrate.surfaceY, 'the nest sits on the surface at its column');
  ok(s.levelDef === L, 'the level definition is kept on state for debugging');
  ok(s.substrate.totalNutrient() > 0, 'the map has food');

  // The threat COUNTS come from the objects, not the campaign table — an authored
  // map is exactly what was drawn.
  const cfg2 = JSON.parse(JSON.stringify(CONFIG));
  cfg2.ants.nestCount = 7; cfg2.nematodes.initialCount = 9; cfg2.trichoderma.initialPatches = 5;
  const s2 = createLevelState(cfg2, 4, L);
  ok(s2.ants.length === 1 && s2.nematodes.length === 2 && s2.clouds.length === 1,
    'config threat counts are ignored — authored placement wins');

  // And the whole world still ticks.
  const before = s.turn;
  tickWorld(s);
  ok(s.turn >= before, 'tickWorld runs against an authored map without throwing');
}

console.log('\n# An empty level still builds');
{
  const L = blankLevel();
  const s = createLevelState(cfg, 7, L);
  ok(s.substrate.foodPiles.length === 0 && s.ants.length === 0 && s.nematodes.length === 0 && s.clouds.length === 0,
    'a blank level is a bare map with no content');
  ok(s.active.nodes.length > 0, 'the colony still roots');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
