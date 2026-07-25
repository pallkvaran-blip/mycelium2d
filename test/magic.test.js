// Magic Mushroom special-power test. Run: node test/magic.test.js
// Proves the "conjure a random basic/event card every N turns" power fires on the Nth
// world tick, adds exactly one basic-or-event card, resets, and never touches a species
// without the special. (Reveal/unlock persistence is localStorage-gated → covered in-game.)

import { CONFIG } from '../src/config.js';
import { createState } from '../src/engine/state.js';
import { initCards, produceCardEngines } from '../src/engine/cards.js';
import { CARD_BY_NAME } from '../src/cards-data.js';
import { SPECIES } from '../src/species.js';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ok  -', m); } else { failed++; console.error('  FAIL-', m); } };
function isolate(s) { s.clouds = []; s.ants = []; s.nematodes = []; s.config.trichoderma.initialPatches = 0; s.config.trichoderma.respawnChance = 0; s.config.nematodes.respawnChance = 0; }
const clone = () => JSON.parse(JSON.stringify(CONFIG));
const isBasicOrEvent = (c) => !!c && (c.type === 'basic' || c.type === 'event' || c.displayCategory === 'basic' || c.displayCategory === 'event');

console.log('# Magic Mushroom: species definition');
{
  const m = SPECIES.find((s) => s.id === 'psilocybe');
  ok(!!m, 'Magic Mushroom (psilocybe) is in the roster');
  ok(m.name === 'Magic Mushroom' && m.latin === 'Psilocybe cubensis', 'named correctly');
  ok(m.special === 'magic' && m.magicEvery === 4, 'special:magic, every 4 turns');
  ok(m.unlock === '?' && m.cost === 1200, "in the '?' tier, costs 1200 spores");
  ok(m.revealBy === 'rockface' && m.revealHint === 'Touch rockface', 'revealed by rockface, hint = Touch rockface');
  ok(m.res && m.res.water === 40 && m.res.phosphorus === 10, 'starts 40 W / 10 P');
  const total = m.hand.reduce((n, h) => n + h.count, 0);
  ok(total === 21, `starting hand totals 21 (10 Lance + 10 Thrust + 1 Runners), got ${total}`);
  const names = m.hand.map((h) => h.name);
  ok(names.every((n) => !!CARD_BY_NAME[n]), 'every starting-hand card exists in CARD_DATA');
}

console.log('# Conjures a card every 4 turns (and cannot be sped up)');
{
  const magic = SPECIES.find((s) => s.id === 'psilocybe');
  const s = createState(clone(), 4242); isolate(s);
  initCards(s, 'species', magic);
  ok(s.cards.special === 'magic' && s.cards.magicEvery === 4, 'run seeded with the special power');
  ok(s.cards.magicCountdown === 4, 'conjure clock starts at 4');

  const h0 = s.cards.hand.length;
  produceCardEngines(s); ok(s.cards.hand.length === h0 && s.cards.magicCountdown === 3, 'tick 1: nothing yet, countdown 3');
  produceCardEngines(s); ok(s.cards.hand.length === h0 && s.cards.magicCountdown === 2, 'tick 2: nothing yet, countdown 2');
  produceCardEngines(s); ok(s.cards.hand.length === h0 && s.cards.magicCountdown === 1, 'tick 3: nothing yet, countdown 1');
  produceCardEngines(s);
  ok(s.cards.hand.length === h0 + 1, 'tick 4: exactly one card conjured');
  ok(s.cards.magicCountdown === 4, 'conjure clock resets to 4');
  ok(isBasicOrEvent(CARD_BY_NAME[s.cards.hand[s.cards.hand.length - 1].name]), 'the conjured card is a basic or event');

  for (let i = 0; i < 3; i++) produceCardEngines(s);
  ok(s.cards.hand.length === h0 + 1, 'ticks 5-7: still just the one (no early fire)');
  produceCardEngines(s);
  ok(s.cards.hand.length === h0 + 2, 'tick 8: a second card conjured');
}

console.log('# A species without the special never conjures');
{
  const fairy = SPECIES.find((x) => x.id === 'marasmius');
  const s = createState(clone(), 99); isolate(s);
  initCards(s, 'species', fairy);
  const h0 = s.cards.hand.length;
  for (let i = 0; i < 12; i++) produceCardEngines(s);
  ok(!s.cards.special && s.cards.hand.length === h0, 'no special set, no card conjured over 12 ticks');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
