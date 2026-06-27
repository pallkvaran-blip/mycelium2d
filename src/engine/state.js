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
import { seedAnts } from './ants.js';
import { buildPuzzle } from './puzzle.js';
import { setByPath } from '../config.js';

// Standard (procedural, random) run.
export function createState(config, seed) {
  const rng = makeRng(seed >>> 0 || 1);
  const substrate = generateSubstrate(config, rng);

  const network = new Network(config);
  network.seed(substrate, rng);

  // Seed the mould AFTER the colony so clouds can start in open ground, away
  // from both food and you, and visibly creep in toward their nearest target.
  const clouds = seedTrichoderma(substrate, config, rng, network);

  // Ant nests near the surface, each running a trail to its nearest food.
  const ants = seedAnts(substrate, config, rng, network);

  return assembleState(config, rng, seed, substrate, [network], clouds, { mode: 'sandbox', ants });
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
    ants: [],   // ants are a sandbox threat for now; the puzzle has none
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
    turn: 1,
    movesLeft: config.turn.movesPerTurn,
    runOver: false,
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
    state.log('Generation 1 begins. The colony stirs beneath the soil.', 'good');
  }
  return state;
}

// Start a fresh run with the (possibly slider-edited) config.
export function newRun(config, seed) {
  return createState(config, seed);
}
