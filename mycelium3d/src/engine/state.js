// =============================================================================
// State — holds the whole simulation (3D port).
//
// State holds a LIST of networks (only one is active), the shared voxel
// substrate, the run-wide Spore total, the step counter and the event log.
// Renderer-agnostic.
// =============================================================================

import { makeRng } from './rng.js';
import { generateSubstrate } from './substrate.js';
import { Network } from './network.js';
import { seedTrichoderma } from './threats.js';
import { seedAnts } from './ants.js';
import { seedNematodes } from './nematodes.js';

// Standard (procedural, random) run.
export function createState(config, seed) {
  const rng = makeRng(seed >>> 0 || 1);
  const substrate = generateSubstrate(config, rng);

  const network = new Network(config);
  // Root the colony at the western entry zone — it must cross to the goal.
  const startCol = Math.max(1, Math.floor((config.substrate.startCols || 2) / 2));
  network.seed(substrate, rng, startCol);

  // Seed the mould AFTER the colony so clouds can start in open ground, away
  // from both food and you, and visibly creep in toward their nearest target.
  const clouds = seedTrichoderma(substrate, config, rng, network);

  // Ant nests on the surface, each running a trail to its nearest food.
  const ants = seedAnts(substrate, config, rng, network);

  // Nematode worms wandering the earth until they sense the colony.
  const nematodes = seedNematodes(substrate, config, rng, network);

  const state = {
    config,
    rng,
    seed,
    substrate,
    clouds,                // roaming Trichoderma clouds
    networks: [network],   // list-of-networks; one active
    active: network,
    ants,
    nematodes,
    spores: 0,             // run-wide Spore total
    turn: 1,
    runOver: false,
    runResult: null,
    logEntries: [],
    _logSeq: 0,
    log(message, kind = 'info') {
      this.logEntries.push({ id: this._logSeq++, turn: this.turn, message, kind });
      if (this.logEntries.length > 200) this.logEntries.shift();
    },
  };

  state.log('The colony stirs at the western edge. Cross underground to the sunlit soil in the east and fruit at the surface.', 'good');
  return state;
}

// Start a fresh run with the (possibly dev-edited) config.
export function newRun(config, seed) {
  return createState(config, seed);
}
