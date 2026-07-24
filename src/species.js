// =============================================================================
// Starter-species roster for the start-of-run picker.
//
// Single source of truth for BOTH the selection screen (render/species_select.js)
// and how a run is seeded (engine/cards.js initCards, mode 'species'). Card faces,
// effects and play-costs are looked up from CARD_DATA by name — here we only list
// each species' identity, its starting resources, and its starting hand as
// {name, count}. `unlock: null` = playable from the start; a tier label = shown as
// a locked preview under that unlock row. `cost` = Spores to buy it once revealed.
//
// Progression is two-step: clearing the required level REVEALS a gated species
// (its "?" tile flips to a viewable but unplayable "Locked" card), then paying
// Spores (earned by finishing levels) UNLOCKS it for play. See the progress
// helpers at the bottom of this file.
// =============================================================================

export const SPECIES = [
  {
    id: 'marasmius', vibe: 'cool', unlock: null,
    name: 'Fairy Ring Champignon', latin: 'Marasmius oreades', img: 'marasmius-oreades',
    cardPos: 'center 20%',   // grid card: pull the visible band up so the cap top isn't cropped (detail view unchanged)
    blurb: 'A grassland saprotroph that grows outward in an ever-widening <b>fairy ring</b> pattern — the colony pushes evenly in every direction from its heart, decomposing the turf as it goes. It is marcescent: it shrivels in a drought and springs back to life once the rain returns, so it banks water and simply waits the dry spells out. Slow, broad and hard to kill — a forgiving way to learn the colony.',
    res: { energy: 0, water: 30, phosphorus: 0 },
    hand: [
      { name: 'Foraging Fan', count: 4 },
      { name: 'Hyphal Extension', count: 6 },
      { name: 'Acorn Cache', count: 6 },
      { name: 'Turgor Thrust', count: 5 },
    ],
  },
  {
    id: 'armillaria', vibe: 'warm', unlock: null,
    name: 'Honey Fungus', latin: 'Armillaria mellea', img: 'armillaria-ostoyae',
    blurb: 'A notorious tree-killer whose genus boasts the <b>largest living organism on Earth</b> — a single Armillaria in Oregon sprawls across nearly ten square kilometres of forest. It travels on <b>rhizomorphs</b>: bootlace-like cords that shoot far ahead through the soil to strike distant roots. A committed long-range predator, not a gentle forager — it banks energy, drives its cords along a chosen line, and lances across open ground toward the goal.',
    res: { energy: 10, water: 25, phosphorus: 0 },   // opener Rhizomorph Lance costs 1⚡ to play → start with Energy
    hand: [
      { name: 'Apical Drive', count: 10 },
      { name: 'Rhizomorph Lance', count: 5 },
      { name: 'Turgor Thrust', count: 5 },
    ],
  },
  {
    id: 'ganoderma', vibe: 'cool', unlock: 'Complete level 1', memory: true,
    name: "Artist's Conk", latin: 'Ganoderma applanatum', img: 'ganoderma-applanatum',
    blurb: 'A woody perennial bracket that lives for years on end, laying down a fresh layer of spore-tubes every season — so its whole body becomes a stacked <b>archive of seasons past</b>. Its chalk-white underside bruises dark at the faintest touch and keeps the mark forever, which is why foragers etch drawings into it: a fungus that literally <b>remembers</b>. This colony learns: it lets you <b>hand-pick cards you drafted during your last run</b>. Be warned: your first run may be a little rough.',
    res: { energy: 10, water: 35, phosphorus: 0 },
    hand: [
      { name: 'Apical Drive', count: 5 },
    ],
  },
  {
    id: 'pleurotus', vibe: 'warm', unlock: 'Complete level 1',
    name: 'Oyster Mushroom', latin: 'Pleurotus ostreatus', img: 'pleurotus-ostreatus',
    blurb: 'Among the fastest and most vigorous wood-rotters alive — oyster mycelium storms through a fallen log and turns dead timber straight into sugar, fruiting in shelving tiers wherever the carbon runs richest. It is a hungry feeder that spreads faster than almost anything else in the litter. This is the colony that keeps the lights on: it opens with a living <b>cord that trickles a steady current of energy</b> through the mat every round.',
    res: { energy: 10, water: 35, phosphorus: 8 },   // opener Cord Capillary installs for 4⚡+2W+6P
    hand: [
      { name: 'Cord Capillary', count: 1 },
      { name: 'Foraging Fan', count: 3 },
      { name: 'Turgor Thrust', count: 12 },
    ],
  },
  {
    id: 'suillus', vibe: 'spore', unlock: 'Complete level 3',
    name: 'Slippery Jack', latin: 'Suillus luteus', img: 'suillus-luteus',
    blurb: 'A slick, amber-capped bolete bound in partnership with pine — a <b>mycorrhizal</b> trader that sheathes the tree\'s rootlets and ranges far through poor soil for the nutrient those roots can never reach on their own: <b>phosphate</b>. It pays for the mineral in sugar, funnelling carbon down its cords to fund the dig. Your first dependable phosphate supply, and the key that unlocks digest, defense, and the heavier grows.',
    res: { energy: 14, water: 35, phosphorus: 8 },   // opener Prospecting Cords installs for 12⚡
    hand: [
      { name: 'Prospecting Cords', count: 1 },
      { name: 'Apical Drive', count: 8 },
      { name: 'Vesicle Surge', count: 6 },
      { name: 'Fruiting Vigil', count: 3 },
    ],
  },
  {
    id: 'schizophyllum', vibe: 'aqua', unlock: 'Complete level 10', memory: true, memPick: 15, memEngines: 2, startLevelMin: 3, startLevelMax: 10,
    name: 'Split Gill', latin: 'Schizophyllum commune', img: 'schizophyllum-commune',
    blurb: 'The most widely distributed mushroom on Earth and the most genetically promiscuous — over <b>20,000 mating types</b>, endlessly adaptable. Its <b>split gills</b> fold shut to ride out drought and reopen the moment damp returns. The most seasoned colony you can field: it opens with just five runners, but lets you <b>hand-pick 15 cards and 2 engines you drafted last run</b> and carry them into this one.',
    res: { energy: 20, water: 52, phosphorus: 16 },
    hand: [
      { name: 'Apical Drive', count: 5 },
    ],
  },
  {
    id: 'hydnellum', vibe: 'aqua', unlock: 'Complete level 3',
    name: 'Bleeding Tooth Fungus', latin: 'Hydnellum peckii', img: 'hydnellum-peckii',
    blurb: 'A damp-forest fungus that runs on water: it drives so much moisture through itself that it weeps bright red droplets from its cap — real <b>guttation</b>. That constant flow lets it grow almost anywhere the ground is wet, fanning out in every direction and pressing on long after drier colonies stall. Open the taps and flood the map.',
    res: { energy: 10, water: 40, phosphorus: 6 },
    hand: [
      { name: 'Aquaporin Channels', count: 1 },
      { name: 'Apical Drive', count: 6 },
      { name: 'Hyphal Extension', count: 6 },
      { name: 'Foraging Fan', count: 3 },
      { name: 'Rhizomorph Lance', count: 6 },
    ],
  },
  {
    id: 'stropharia', vibe: 'warm', unlock: 'Complete level 5',
    name: 'Wine Cap', latin: 'Stropharia rugosoannulata', img: 'stropharia-rugosoannulata',
    blurb: 'The <b>"garden giant"</b> — a bulky saprotroph with a wine-red cap that rips through wood chips, straw and forest mulch faster than almost anything, turning dead matter straight into <b>sugar and mineralised nutrients</b>. Its mycelium bristles with tiny spiked cells (acanthocytes) that puncture passing nematodes and bacteria and strip them for extra nitrogen and phosphate. It opens running two engines at once — a <b>cord that trickles energy</b> and a <b>saprobic front that mineralises phosphorus</b> — a self-feeding decomposer from turn one.',
    res: { energy: 20, water: 45, phosphorus: 7 },   // openers Cord Capillary (4⚡+2W+6P) + Mineralizing Saprobe (14⚡) → install both turn 1
    hand: [
      { name: 'Cord Capillary', count: 1 },
      { name: 'Mineralizing Saprobe', count: 1 },
      { name: 'Hyphal Extension', count: 6 },
      { name: 'Foraging Fan', count: 4 },
      { name: 'Apical Drive', count: 6 },
      { name: 'Guerrilla Runners', count: 6 },
      { name: 'Constricting Snap', count: 3 },
    ],
  },
  {
    id: 'cortinarius', vibe: 'spore', unlock: 'Complete level 7',
    name: 'Violet Webcap', latin: 'Cortinarius violaceus', img: 'cortinarius-violaceus',
    blurb: 'One of the few truly <b>violet</b> mushrooms — dark indigo from cap to stem — and an ectomycorrhizal partner that sheathes tree roots through damp, mossy forest floor. It mines the soil for locked-away nutrients, secreting <b>acid phosphatases that free bound phosphate</b>, and pipes <b>water and minerals</b> back to its host in trade for sugar. It opens with both taps already running: a slow, deep phosphate reserve and a steady draw of water.',
    res: { energy: 34, water: 45, phosphorus: 10 },   // openers Phosphatase Reserve (12⚡) + Aquaporin Channels (20⚡+6P) → install both turn 1
    hand: [
      { name: 'Phosphatase Reserve', count: 1 },
      { name: 'Aquaporin Channels', count: 1 },
      { name: 'Apical Drive', count: 8 },
      { name: 'Fruiting Vigil', count: 3 },
      { name: 'Guerrilla Runners', count: 6 },
      { name: 'Vesicle Surge', count: 4 },
    ],
  },
  {
    id: 'serpula', vibe: 'warm', unlock: 'Complete level 7',
    name: 'Dry Rot', latin: 'Serpula lacrymans', img: 'serpula-lacrymans',
    blurb: 'The most feared timber-rotter of all — <b>"true dry rot."</b> A brown-rot fungus that crumbles wood into dry, cracked cubes for energy, it has a rare trick: it <b>translocates water along its own mycelial cords</b>, carrying moisture from damp ground into bone-dry timber so it can rot wood nothing else can reach. Its rusty, folded fruitbodies bead with watery droplets — hence <i>lacrymans</i>, "weeping." It opens piping <b>water through its cords</b> while a <b>capillary trickles energy.</b>',
    res: { energy: 26, water: 45, phosphorus: 14 },   // openers Aquaporin Channels (20⚡+6P) + Cord Capillary (4⚡+2W+6P) → install both turn 1
    hand: [
      { name: 'Aquaporin Channels', count: 1 },
      { name: 'Cord Capillary', count: 1 },
      { name: 'Apical Drive', count: 8 },
      { name: 'Rhizomorph Lance', count: 6 },
      { name: 'Turgor Thrust', count: 8 },
      { name: 'Amputate', count: 2 },
    ],
  },
  {
    id: 'scleroderma', vibe: 'spore', unlock: 'Complete level 5',
    name: 'Earthball', latin: 'Scleroderma citrinum', img: 'scleroderma-citrinum',
    blurb: 'A tough, chemically defended fungus whose name means <b>"hard skin"</b> — it seals itself inside a thick, warty, leathery rind and holds ground instead of racing for it. It walls off and severs any tissue that rot or grazers reach, so infection never spreads. Where other colonies spend everything on speed, the earthball digs in: slow, armoured and stubborn.',
    res: { energy: 15, water: 35, phosphorus: 12 },
    hand: [
      { name: 'Sclerotial Crust', count: 2 },
      { name: 'Amputate', count: 2 },
      { name: 'Apical Drive', count: 7 },
      { name: 'Aquaporin Channels', count: 1 },
      { name: 'Rhizomorph Lance', count: 12 },
      { name: 'Melanized Wall', count: 1 },
    ],
  },
  {
    // Reddit bonus-competition winner. Unlocked NOT by clearing a level but by touching a
    // hidden "troll rockface" that appears on level 1 (see main.js placeRockface / touchRockface,
    // render/species_select.js showSpeciesUnlocked). `unlock:'?'` keeps it in the communal
    // mystery tier; `revealBy:'rockface'` routes its reveal through the rock, not level clears
    // (see isRevealed). `special:'magic'` wires the conjure-a-card power (engine/cards.js).
    id: 'psilocybe', vibe: 'spore', unlock: '?', cost: 2000,
    revealBy: 'rockface', revealHint: 'Touch rockface',
    special: 'magic', magicEvery: 4,
    specialText: 'Every 4 turns, a random basic or event card magically appears in your hand. Cannot be sped up.',
    name: 'Magic Mushroom', latin: 'Psilocybe cubensis', img: 'psilocybe-cubensis',
    blurb: 'The famous <b>magic mushroom</b> — a golden-capped dung-loving fungus steeped in folklore and psychedelia, and the <b>winner of the community vote</b>. This colony bends the rules of the deck itself: every few turns a card simply <b>materialises in your hand out of thin air</b>, conjured with no cost and no way to hurry it along. Let the magic keep dealing and ride whatever it gives you.',
    res: { energy: 14, water: 40, phosphorus: 10 },   // 40W/10P as requested; a little Energy so the opening grows can actually be played
    hand: [
      { name: 'Rhizomorph Lance', count: 10 },
      { name: 'Turgor Thrust', count: 10 },
      { name: 'Capillary Runners', count: 1 },
    ],
  },
];

// Locked unlock tiers shown under the two available species (mystery "?" cards,
// except where a real species above is pinned to a tier via `unlock`).
export const LOCKED_TIERS = [
  { label: 'Complete level 1', n: 2 },
  { label: 'Complete level 3', n: 2 },
  { label: 'Complete level 5', n: 2 },
  { label: 'Complete level 7', n: 2 },
  { label: 'Complete level 10', n: 1 },
  { label: '?', n: 8, communal: true },
];

// =============================================================================
// Campaign: a run is a ladder of levels 1..MAX_LEVEL. Maps stay procedural; the
// only per-level scaling is the number of each threat present. Beat MAX_LEVEL to
// win the game.
//
// Scaling rule (see threatsForLevel): nematodes and Trichoderma always equal the
// level number; ant nests keep climbing but never exceed MAX_ANT_NESTS. Levels
// 1..11 keep their hand-authored ant curve (LEVEL_THREATS below); level 12 and up
// are computed so the ladder can run all the way to 100 without a 100-row table.
// =============================================================================
export const MAX_LEVEL = 100;

// Ant nests never exceed this, however deep the run goes.
export const MAX_ANT_NESTS = 8;

// index by level (1-based); [0] unused. Each: ant nests / nematodes / mould patches.
// This is the AUTHORED early curve (levels 1..11); deeper levels are computed by
// threatsForLevel (nematodes = trych = level, ants ramp on to the MAX_ANT_NESTS cap).
export const LEVEL_THREATS = [
  null,
  { ants: 1, nematodes: 1,  trych: 1 },   // 1
  { ants: 2, nematodes: 2,  trych: 2 },   // 2
  { ants: 3, nematodes: 3,  trych: 3 },   // 3
  { ants: 3, nematodes: 4,  trych: 4 },   // 4
  { ants: 3, nematodes: 5,  trych: 5 },   // 5
  { ants: 4, nematodes: 6,  trych: 6 },   // 6
  { ants: 4, nematodes: 7,  trych: 7 },   // 7
  { ants: 4, nematodes: 8,  trych: 8 },   // 8
  { ants: 5, nematodes: 9,  trych: 9 },   // 9
  { ants: 5, nematodes: 10, trych: 10 },  // 10
  { ants: 6, nematodes: 11, trych: 11 },  // 11
];

// Ant nests for a computed (level >= 12) level: continue the authored curve's
// gentle climb (~+1 every 4 levels from level 11's 6) and cap at MAX_ANT_NESTS.
//   L12–14 → 6, L15–18 → 7, L19+ → 8 (capped).
function antsForLevel(level) {
  return Math.min(MAX_ANT_NESTS, 6 + Math.floor((level - 11) / 4));
}

export function threatsForLevel(level) {
  const lvl = Math.max(1, level | 0);
  if (lvl < LEVEL_THREATS.length) return LEVEL_THREATS[lvl];   // authored early curve (1..11)
  return { ants: antsForLevel(lvl), nematodes: lvl, trych: lvl };
}

// Spores earned for finishing a level: 100 for level 1, 200 for level 2, and so on.
export function sporesForLevel(level) {
  return Math.max(0, (level | 0)) * 100;
}

// The level a species unlocks at, parsed from its `unlock` label ("Complete level N").
export function levelFromUnlock(label) {
  const m = /(\d+)/.exec(label || '');
  return m ? +m[1] : null;
}

// Which campaign level a species BEGINS its run on. Higher-tier species skip the
// early grind: a fixed-start species opens on its unlock level (ungated → level 1).
// A "choose your start" species (the memory colonies) instead exposes a range
// [startLevelMin, startLevelMax] the player dials in next to the Start button.
//   Slippery Jack / Bleeding Tooth → 3 · Wine Cap / Earthball → 5 · Violet Webcap / Dry Rot → 7
//   Split Gill → adjustable 3–10 · Artist's Conk → fixed level 1 (memory colony, first reveal)
// Returns { min, max, adjustable }.
export function startLevelRange(sp) {
  if (sp && sp.startLevelMin != null && sp.startLevelMax != null) {
    const min = Math.max(1, sp.startLevelMin | 0);
    const max = Math.max(min, sp.startLevelMax | 0);
    return { min, max, adjustable: max > min };
  }
  const lvl = levelFromUnlock(sp && sp.unlock) || 1;
  return { min: lvl, max: lvl, adjustable: false };
}
// The level a species starts on by default. Fixed species = their only level;
// adjustable species default to their unlock level (the high end of the range),
// clamped into the allowed range — so the toggle only ever DIALS DOWN from there.
export function defaultStartLevel(sp) {
  const r = startLevelRange(sp);
  if (!r.adjustable) return r.min;
  const u = levelFromUnlock(sp && sp.unlock) || r.max;
  return Math.max(r.min, Math.min(r.max, u));
}

// The ordered unlock-tier levels, from LOCKED_TIERS — e.g. [1, 3, 5, 7, 10].
function tierLevels() {
  return LOCKED_TIERS.map((t) => levelFromUnlock(t.label)).filter((n) => n).sort((a, b) => a - b);
}

// Spore price to buy a revealed species, keyed by the tier's unlock LEVEL:
//   L1 → 1 000 · L3 → 5 000 · L5 → 10 000 · L7 → 25 000 · L10 → 50 000.
// All species in a tier share its price; explicit `sp.cost` overrides. An off-tier level
// falls back to the nearest defined tier at or below it.
export const TIER_COST = { 1: 1000, 3: 5000, 5: 10000, 7: 25000, 10: 50000 };
export function unlockCost(sp) {
  if (!sp || !sp.unlock) return 0;
  if (sp.cost != null) return sp.cost;
  const lvl = levelFromUnlock(sp.unlock);
  if (!lvl) return 0;
  if (TIER_COST[lvl] != null) return TIER_COST[lvl];
  const levels = Object.keys(TIER_COST).map(Number).sort((a, b) => a - b);   // off-tier: nearest tier ≤ lvl
  let cost = TIER_COST[levels[0]];
  for (const l of levels) if (l <= lvl) cost = TIER_COST[l];
  return cost;
}

// Species pinned to a tier level, in roster (unlock) order. Order matters: the
// k-th species in a tier unlocks on the (k+1)-th time that level is cleared.
export function tierSpecies(level) {
  return SPECIES.filter((s) => s.unlock && levelFromUnlock(s.unlock) === level);
}
function tierIndexOf(sp) {
  const lvl = levelFromUnlock(sp.unlock);
  return tierSpecies(lvl).indexOf(sp);
}

// --- unlock progress (persisted in localStorage) ---------------------------
// Tracks per-level clears, the Spores wallet, and which species have been bought:
//   { clears: { "1": 2, ... }, spores: 350, purchased: { "scleroderma": true } }
// (v2 — the v1 model was "max level cleared"; a clean key avoids a migration.
// `spores` / `purchased` are additive and default safely for older v2 saves.)
const PROGRESS_KEY = 'mycelium.progress.v2';

export function loadProgress() {
  let p;
  try { p = JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (_) { p = {}; }
  if (!p.clears) p.clears = {};
  if (typeof p.spores !== 'number' || !isFinite(p.spores)) p.spores = 0;
  if (!p.purchased) p.purchased = {};
  if (!p.revealedSpecies) p.revealedSpecies = {};   // species revealed by a special event (e.g. Magic Mushroom via the level-1 troll rock) rather than by clearing a level
  if (!p.loadouts) p.loadouts = {};   // per-species carried loadout (memory species): { id: [{name,count}] }
  if (!p.lastDrafts) p.lastDrafts = {};   // per-species pool of the LAST run's non-engine drafts, offered at the next run's start-of-run picker
  if (!p.lastDraftEngines) p.lastDraftEngines = {};   // parallel pool of the LAST run's ENGINE drafts (Artist's Conk curates up to 2)
  if (!Array.isArray(p.deathCarry)) p.deathCarry = [];   // universal death-carry: cards chosen at death to bring into the NEXT run (any species), consumed when it seeds
  if (migrateProgress(p)) saveProgress(p);   // one-time roster-swap migrations; persist if anything changed
  return p;
}
export function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (_) {}
}

// One-time save migrations. Mutates `p` in place; returns true if anything changed (so
// loadProgress persists it). Each migration is guarded by its own flag → it runs at most
// once per save, and because the flag is written in the SAME saveProgress call as the change,
// a failed write simply replays the whole thing next load (never a partial / double refund).
const EARTHBALL_OLD_L1_COST = 1000;   // what an L1 unlock cost when Earthball was still an L1 species
export function migrateProgress(p) {
  let changed = false;
  // Roster swap (2026-07): Earthball (scleroderma) moved L1 -> L5. Anyone who already BOUGHT it
  // at the old L1 price is refunded those spores and has the purchase cleared, so it reverts to a
  // normal (locked) L5 unlock for them — rather than silently losing a species they paid for.
  if (!p.migratedEarthballL5) {
    if (p.purchased && p.purchased.scleroderma) {
      delete p.purchased.scleroderma;
      p.spores = (typeof p.spores === 'number' && isFinite(p.spores) ? p.spores : 0) + EARTHBALL_OLD_L1_COST;
    }
    p.migratedEarthballL5 = true;
    changed = true;
  }
  return changed;
}
// "New" on the title screen: wipe all unlock progress (start from scratch).
export function resetProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch (_) {}
}
// TEMP DEV: reveal AND unlock (buy) every gated species — records enough clears of each
// tier's level to reveal all its species, and marks them all purchased. For the dev
// button on the species picker; remove for release.
export function devUnlockAll() {
  const p = loadProgress();
  if (!p.revealedSpecies) p.revealedSpecies = {};
  for (const s of SPECIES) {
    if (!s.unlock) continue;
    if (s.revealBy) { p.revealedSpecies[s.id] = true; p.purchased[s.id] = true; continue; }   // special-reveal species (rock, etc.)
    const lvl = levelFromUnlock(s.unlock);
    if (lvl) p.clears[lvl] = Math.max(p.clears[lvl] || 0, 99);   // 99 clears → every species in the tier is revealed
    p.purchased[s.id] = true;                                    // and bought (playable)
  }
  saveProgress(p);
  return p;
}
export function clearsFor(progress, level) {
  return (progress && progress.clears && progress.clears[level]) || 0;
}
// Record one more clear of a level; returns the updated progress.
export function recordLevelCleared(level) {
  const p = loadProgress();
  p.clears[level] = clearsFor(p, level) + 1;
  saveProgress(p);
  return p;
}

// --- Spores wallet ---------------------------------------------------------
export function sporesBalance(progress) {
  const p = progress || loadProgress();
  return (typeof p.spores === 'number' && isFinite(p.spores)) ? p.spores : 0;
}
// Credit the wallet (e.g. for clearing a level); persists and returns new balance.
export function addSpores(amount) {
  const p = loadProgress();
  p.spores = sporesBalance(p) + Math.max(0, amount | 0);
  saveProgress(p);
  return p.spores;
}
export function isPurchased(sp, progress) {
  const p = progress || loadProgress();
  return !!(sp && p.purchased && p.purchased[sp.id]);
}

// --- carried loadout (memory species, e.g. Split Gill) ----------------------
// A memory species opens with its fixed `hand` PLUS a player-curated set of cards
// carried from the last run's DRAFTS. Stored per species id as [{name,count}]
// (count = copies). loadoutFor returns [] when nothing is saved yet (first run).
export function loadoutFor(speciesId, progress) {
  const p = progress || loadProgress();
  const lo = p.loadouts && p.loadouts[speciesId];
  return Array.isArray(lo) ? lo.filter((e) => e && e.name && e.count > 0) : [];
}
export function saveLoadout(speciesId, list) {
  const p = loadProgress();
  p.loadouts[speciesId] = (Array.isArray(list) ? list : []).filter((e) => e && e.name && e.count > 0);
  saveProgress(p);
  return p.loadouts[speciesId];
}
// The pool a memory species offers at the START of a new run: the NON-ENGINE cards it
// DRAFTED on its last run. Recorded at run end, consumed by the start-of-run picker.
export function lastDraftsFor(speciesId, progress) {
  const p = progress || loadProgress();
  const l = p.lastDrafts && p.lastDrafts[speciesId];
  return Array.isArray(l) ? l.filter((e) => e && e.name && e.count > 0) : [];
}
export function saveLastDrafts(speciesId, list) {
  const p = loadProgress();
  p.lastDrafts[speciesId] = (Array.isArray(list) ? list : []).filter((e) => e && e.name && e.count > 0);
  saveProgress(p);
  return p.lastDrafts[speciesId];
}
// Parallel to lastDrafts, but the ENGINE cards drafted last run (offered under a separate,
// smaller cap in the loadout picker). Only memory species with `memEngines > 0` use these.
export function lastDraftEnginesFor(speciesId, progress) {
  const p = progress || loadProgress();
  const l = p.lastDraftEngines && p.lastDraftEngines[speciesId];
  return Array.isArray(l) ? l.filter((e) => e && e.name && e.count > 0) : [];
}
export function saveLastDraftEngines(speciesId, list) {
  const p = loadProgress();
  p.lastDraftEngines[speciesId] = (Array.isArray(list) ? list : []).filter((e) => e && e.name && e.count > 0);
  saveProgress(p);
  return p.lastDraftEngines[speciesId];
}

// --- death-carry (universal consolation cards) ------------------------------
// When a run ends in death the player picks a few cards they PLAYED to carry into
// their NEXT run — whatever species they choose. One shared list [{name,count}]
// (not per species); merged into the next fresh run's starting hand and cleared
// when that run seeds. See main.js showDeathCarry / withDeathCarry.
export function loadDeathCarry(progress) {
  const p = progress || loadProgress();
  return Array.isArray(p.deathCarry) ? p.deathCarry.filter((e) => e && e.name && e.count > 0) : [];
}
export function saveDeathCarry(list) {
  const p = loadProgress();
  p.deathCarry = (Array.isArray(list) ? list : []).filter((e) => e && e.name && e.count > 0);
  saveProgress(p);
  return p.deathCarry;
}
export function clearDeathCarry() {
  const p = loadProgress();
  p.deathCarry = [];
  saveProgress(p);
}

// --- Resume-in-progress-run (title "Old" → continue last game) --------------
// A serializable snapshot of the CURRENT LEVEL's opening state (level, species id, deck
// as card names, installed engine/action names, resources), saved at the start of each
// campaign level in main.js. Lets a player who closes the tab mid-run press "Old" and
// re-enter the same level (a fresh map — they just restart that level). Kept in its own
// localStorage key (bulky + run-specific), separate from the meta-progression wallet.
const RESUME_KEY = 'mycelium.resume.v1';
export function loadResume() {
  try { const s = localStorage.getItem(RESUME_KEY); return s ? JSON.parse(s) : null; } catch (_) { return null; }
}
export function saveResume(snap) {
  try { localStorage.setItem(RESUME_KEY, JSON.stringify(snap)); } catch (_) { /* ignore quota/serialize errors */ }
}
export function clearResume() {
  try { localStorage.removeItem(RESUME_KEY); } catch (_) {}
}
// Buy a revealed species with Spores. Returns { ok, spores } — ok=false if it can't
// be bought (not revealed, already owned, or too few Spores).
export function purchaseSpecies(sp, progress) {
  const p = progress || loadProgress();
  if (!sp || !sp.unlock) return { ok: true, spores: sporesBalance(p) };   // ungated: nothing to buy
  if (isPurchased(sp, p)) return { ok: true, spores: sporesBalance(p) };
  if (!isRevealed(sp, p)) return { ok: false, spores: sporesBalance(p) };
  const cost = unlockCost(sp);
  if (sporesBalance(p) < cost) return { ok: false, spores: sporesBalance(p) };
  p.spores = sporesBalance(p) - cost;
  p.purchased[sp.id] = true;
  saveProgress(p);
  return { ok: true, spores: p.spores };
}

// --- reveal / playable state ------------------------------------------------
// REVEALED: the tier has been cleared enough times to expose this species — its "?"
// tile flips to a viewable "Locked" card (k-th species needs k+1 clears of the level).
export function isRevealed(sp, progress) {
  if (!sp || !sp.unlock) return true;
  // Specially-revealed species (e.g. Magic Mushroom, revealBy:'rockface') don't gate on
  // level clears — they flip to revealed the moment their unlock EVENT fires (the rock is
  // touched → revealSpecies), which persists in progress.revealedSpecies.
  if (sp.revealBy) return isSpeciesRevealed(sp.id, progress);
  const lvl = levelFromUnlock(sp.unlock);
  return lvl != null && clearsFor(progress, lvl) >= tierIndexOf(sp) + 1;
}
// Whether a species has been specially revealed (persisted). Safe with no progress arg.
export function isSpeciesRevealed(id, progress) {
  const p = progress || loadProgress();
  return !!(p && p.revealedSpecies && p.revealedSpecies[id]);
}
// Mark a species revealed (its unlock event fired). Idempotent; persists and returns progress.
export function revealSpecies(id) {
  const p = loadProgress();
  if (!p.revealedSpecies) p.revealedSpecies = {};
  if (p.revealedSpecies[id]) return p;   // already revealed
  p.revealedSpecies[id] = true;
  saveProgress(p);
  return p;
}
// PLAYABLE: revealed AND bought with Spores (ungated species are always playable).
export function isPlayable(sp, progress) {
  if (!sp || !sp.unlock) return true;
  return isRevealed(sp, progress) && isPurchased(sp, progress);
}
// The species newly REVEALED by clearing `level`, given progress BEFORE this clear.
// One per clear, in tier order; [] once the tier is exhausted.
export function newlyRevealedByClear(level, progressBefore) {
  const tier = tierSpecies(level);
  const prior = clearsFor(progressBefore, level);
  return prior < tier.length ? [tier[prior]] : [];
}
