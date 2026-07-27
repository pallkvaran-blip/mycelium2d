// The colony's colonisation pass (network.colonizeReachablePiles) must claim a pile only while
// it still holds LIVE nutrient. An ant (or the player) can drain a pile to 0 nutrient while its
// maxNutrient footprint persists; the leaf art fades at nutrient 0, so keying colonisation on
// maxNutrient sprayed a mat over visibly-empty ground ("food out of nowhere"). Regression pin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';

const rng = () => 0.5;

// Fresh state with ALL food wiped, then one small pile placed on clear soil right next to the
// first network node (so the bridge trivially reaches). Returns { state, net, sub, pileIdx }.
function scenario(nutrient) {
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  const state = createState(cfg, 4242);
  const sub = state.substrate, net = state.active;
  for (const c of sub.cells) { c.nutrient = 0; c.maxNutrient = 0; c.foodKind = ''; c.colonized = 0; }
  const n = net.nodes[0];
  const col = sub.colAtX(n.x), row = sub.rowAtY(n.y);
  const pileIdx = [];
  // a 2x2 block one row deeper than the node, on non-rock / non-hazard soil
  for (let dr = 1; dr <= 2; dr++) for (let dc = 0; dc <= 1; dc++) {
    const cc = col + dc, rr = row + dr;
    if (!sub.inBounds(cc, rr)) continue;
    const cell = sub.cellAt(cc, rr);
    if (!cell || cell.rock || cell.hazard) continue;
    cell.maxNutrient = 100; cell.nutrient = nutrient; cell.foodKind = 'duff'; cell.colonized = 0;
    pileIdx.push(sub.index(cc, rr));
  }
  return { state, net, sub, pileIdx };
}
const colonisedCount = (sub, idx) => idx.filter((i) => sub.cells[i].colonized >= 1).length;

test('a LIVE pile (nutrient > 0) still gets colonised', () => {
  const { net, sub, pileIdx } = scenario(100);
  assert.ok(pileIdx.length >= 2, 'test setup placed a pile');
  const created = net.colonizeReachablePiles(sub, rng);
  assert.ok(created > 0, 'colonisation created hyphae for the live pile');
  assert.ok(colonisedCount(sub, pileIdx) > 0, 'live pile cells were colonised');
});

test('a DRAINED pile (nutrient 0, maxNutrient > 0) is NOT colonised', () => {
  const { net, sub, pileIdx } = scenario(0);   // ant-eaten footprint: capacity remains, food gone
  assert.ok(pileIdx.length >= 2, 'test setup placed a pile');
  assert.ok(pileIdx.every((i) => sub.cells[i].maxNutrient > 0), 'footprint (maxNutrient) still present');
  const created = net.colonizeReachablePiles(sub, rng);
  assert.equal(colonisedCount(sub, pileIdx), 0, 'empty pile cells were left uncolonised');
  assert.equal(created, 0, 'no hyphae sprayed into the empty ground');
});
