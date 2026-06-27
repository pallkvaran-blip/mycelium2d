// =============================================================================
// State — holds the whole simulation (A9).
//
// Crucially, state holds a LIST of networks even in Phase 1 (only one is
// active). The shared cross-section substrate, the run-wide Spore total, the
// turn counter and the event log all live here. Renderer-agnostic.
// =============================================================================

import { makeRng } from './rng.js';
import { generateSubstrate } from './substrate.js';
import { Network } from './network.js';
import { seedTrichoderma } from './threats.js';

export function createState(config, seed) {
  const rng = makeRng(seed >>> 0 || 1);
  const substrate = generateSubstrate(config, rng);

  const network = new Network(config);
  network.seed(substrate, rng);

  // Seed the mould AFTER the colony so clouds can start in open ground, away
  // from both food and you, and visibly creep in toward their nearest target.
  const clouds = seedTrichoderma(substrate, config, rng, network);

  const state = {
    config,
    rng,
    seed,
    substrate,
    clouds,                // roaming Trichoderma clouds (shared cross-section threat)
    networks: [network],   // list-of-networks (A5-ready); one active in Phase 1
    active: network,
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
  };

  state.log(`Generation 1 begins. The colony stirs beneath the soil.`, 'good');
  return state;
}

// Start a fresh run with the (possibly slider-edited) config.
export function newRun(config, seed) {
  return createState(config, seed);
}
