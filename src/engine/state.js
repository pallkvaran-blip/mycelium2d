// =============================================================================
// State — holds the whole simulation (A9).
//
// Crucially, state holds a LIST of networks even in Phase 1 (only one is
// active). The shared cross-section substrate, the run-wide Spore total, the
// turn counter and the event log all live here. Renderer-agnostic.
// =============================================================================

import { makeRng } from './rng.js';
import { generateSubstrate, Substrate } from './substrate.js';
import { Network } from './network.js';
import { seedTrichoderma, placeClouds } from './threats.js';
import { seedAnts, placeAntNests } from './ants.js';
import { seedNematodes, placeNematodes } from './nematodes.js';
import { buildPuzzle } from './puzzle.js';
import { buildLevel, configForLevelDef } from './level.js';
import { setByPath } from '../config.js';

// Standard (procedural, random) run.
export function createState(config, seed) {
  const rng = makeRng(seed >>> 0 || 1);
  const substrate = generateSubstrate(config, rng);

  const network = new Network(config);
  // Root the colony at the far-left entry zone — it must cross to the goal.
  const startCol = Math.max(1, Math.floor((config.substrate.startCols || 2) / 2));
  network.seed(substrate, rng, startCol);

  // Seed the mould AFTER the colony so clouds can start in open ground, away
  // from both food and you, and visibly creep in toward their nearest target.
  const clouds = seedTrichoderma(substrate, config, rng, network);

  // Ant nests near the surface, each running a trail to its nearest food.
  const ants = seedAnts(substrate, config, rng, network);

  // Nematode worms wandering the soil until they sense the colony.
  const nematodes = seedNematodes(substrate, config, rng, network);

  return assembleState(config, rng, seed, substrate, [network], clouds, { mode: 'sandbox', ants, nematodes });
}

// HAND-AUTHORED level run (level editor / campaign): identical to createState in
// every respect except that the geometry and the threat positions come from a
// level definition instead of the generator. Same rules, same economy, same
// carry-over — only the map is designed rather than rolled. `level` is a parsed
// `mycelium-level` object (see engine/level.js).
export function createLevelState(config, seed, level) {
  const cfg = configForLevelDef(config, level);
  const rng = makeRng(seed >>> 0 || 1);
  const { substrate, spawns, startCol } = buildLevel(cfg, level);

  const network = new Network(cfg);
  network.seed(substrate, rng, startCol);

  // Authored spawns: exactly what the designer placed, in the order they placed
  // it. An empty list means that threat simply isn't on this map.
  const clouds = placeClouds(substrate, spawns.clouds, cfg);
  const ants = placeAntNests(substrate, cfg, spawns.ants);
  const nematodes = placeNematodes(rng, spawns.nematodes);

  const state = assembleState(cfg, rng, seed, substrate, [network], clouds, { mode: 'sandbox', ants, nematodes });
  state.levelDef = level;                 // kept for debugging / the editor's playtest loop
  return state;
}

// Fixed hand-authored PUZZLE run: reach the treasure chest. Builds its own world
// geometry + economy from the puzzle definition (a clone of CONFIG, so the
// sandbox config is never mutated).
export function createPuzzleState(baseConfig) {
  const config = JSON.parse(JSON.stringify(baseConfig));
  const built = buildPuzzle(config, Substrate, (path, v) => setByPath(config, path, v));
  // built = { substrate, startCol, clouds: [{x,y}], chest: {x,y,r} }
  const rng = makeRng(20240611);   // fixed seed → deterministic puzzle

  const network = new Network(config);
  network.seed(built.substrate, rng, built.startCol);

  const clouds = placeClouds(built.substrate, built.clouds, config);

  return assembleState(config, rng, 20240611, built.substrate, [network], clouds, {
    mode: 'puzzle',
    chest: built.chest,
    won: false,
    ants: [],        // ants are a sandbox threat for now; the puzzle has none
    nematodes: [],   // nematodes are a sandbox threat for now too
  });
}

function assembleState(config, rng, seed, substrate, networks, clouds, extra) {
  const state = {
    config,
    rng,
    seed,
    substrate,
    clouds,                // roaming Trichoderma clouds (shared cross-section threat)
    networks,              // list-of-networks (A5-ready); one active in Phase 1
    active: networks[0],
    spores: 0,             // run-wide Spore total (summed across networks later)
    traps: [],             // Constricting Ring traps: {x,y,r,reward} — digest a worm on contact
    turn: 1,
    runOver: false,
    winPending: false,     // goal reached, but finishing harvest + drafts before the win lands
    runResult: null,
    logEntries: [],
    _logSeq: 0,
    log(message, kind = 'info') {
      this.logEntries.push({ id: this._logSeq++, turn: this.turn, message, kind });
      if (this.logEntries.length > 200) this.logEntries.shift();
    },
    ...extra,
  };

  if (state.mode === 'puzzle') {
    state.log('A fixed puzzle: steer the colony to the treasure chest.', 'good');
  } else {
    state.log('The colony stirs at the western edge. Cross underground to the far side and fruit at the surface.', 'good');
  }
  return state;
}

// Start a fresh run with the (possibly slider-edited) config.
export function newRun(config, seed) {
  return createState(config, seed);
}
