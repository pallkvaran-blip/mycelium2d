// Generate src/cards-data.js from docs/cards.json (engine-relevant fields only).
// Run: node scripts/gen-carddata.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(readFileSync(join(root, 'docs/cards.json'), 'utf8'));

const slim = cards.map((c) => ({
  name: c.name, type: c.type, category: c.category,
  // displayCategory = the label shown under the name + the in-game filter bucket
  // (Basic/Engine/Event). PURELY cosmetic — `type` still drives all behavior.
  displayCategory: c.displayCategory || c.type,
  buyCostEnergy: c.buyCostEnergy || 0,
  // Two-resource model: Water + Phosphorus. Any legacy Nitrogen cost folds into Phosphorus.
  costW: c.playCostWater || 0, costP: (c.playCostPhosphorus || 0) + (c.playCostNitrogen || 0),
  timing: c.timing || 'any', repay: c.repayRounds || 0, threat: c.threat || 'none',
  produces: c.produces || '', effect: c.effect || '', family: c.familyKey || '',
  tutorial: !!c.tutorial, startCopies: c.startCopies || 0,
}));

const out = `// =============================================================================
// Card data — GENERATED from docs/cards.json (do not edit by hand).
// Regenerate: node scripts/gen-carddata.mjs
// Engine-relevant fields only. Effects are dispatched by name in engine/cards.js.
// =============================================================================
export const CARD_DATA = ${JSON.stringify(slim, null, 1)};

export const CARD_BY_NAME = Object.fromEntries(CARD_DATA.map((c) => [c.name, c]));
`;
writeFileSync(join(root, 'src/cards-data.js'), out);
console.log(`wrote src/cards-data.js with ${slim.length} cards`);
