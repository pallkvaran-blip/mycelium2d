// =============================================================================
// Starter-species roster for the start-of-run picker.
//
// Single source of truth for BOTH the selection screen (render/species_select.js)
// and how a run is seeded (engine/cards.js initCards, mode 'species'). Card faces,
// effects and play-costs are looked up from CARD_DATA by name — here we only list
// each species' identity, its starting resources, and its starting hand as
// {name, count}. `unlock: null` = playable from the start; a tier label = shown as
// a locked preview under that unlock row.
// =============================================================================

export const SPECIES = [
  {
    id: 'marasmius', vibe: 'cool', unlock: null,
    name: 'Fairy Ring Champignon', latin: 'Marasmius oreades', img: 'marasmius-oreades',
    blurb: 'A grassland saprotroph that grows outward in an ever-widening <b>fairy ring</b> pattern — the colony pushes evenly in every direction from its heart, decomposing the turf as it goes. It is marcescent: it shrivels in a drought and springs back to life once the rain returns, so it banks water and simply waits the dry spells out. Slow, broad and hard to kill — a forgiving way to learn the colony.',
    res: { energy: 30, water: 30, phosphorus: 0 },
    hand: [
      { name: 'Foraging Fan', count: 8 },
      { name: 'Hyphal Extension', count: 6 },
      { name: 'Acorn Cache', count: 6 },
    ],
  },
  {
    id: 'armillaria', vibe: 'warm', unlock: null,
    name: 'Honey Fungus', latin: 'Armillaria ostoyae', img: 'armillaria-ostoyae',
    blurb: 'The <b>largest living organism on Earth</b> — a single Armillaria in Oregon sprawls across nearly ten square kilometres of forest. It travels on <b>rhizomorphs</b>: bootlace-like cords that shoot far ahead through the soil to strike distant roots. A committed long-range predator, not a gentle forager — it banks energy, drives its cords along a chosen line, and lances across open ground toward the goal.',
    res: { energy: 100, water: 25, phosphorus: 0 },
    hand: [
      { name: 'Apical Drive', count: 10 },
      { name: 'Rhizomorph Lance', count: 5 },
    ],
  },
  {
    id: 'scleroderma', vibe: 'spore', unlock: 'Complete level 1',
    name: 'Common Earthball', latin: 'Scleroderma citrinum', img: 'scleroderma-citrinum',
    blurb: 'A tough, chemically defended fungus whose name means <b>"hard skin"</b> — it seals itself inside a thick, warty, leathery rind and holds ground instead of racing for it. It walls off and severs any tissue that rot or grazers reach, so infection never spreads. Where other colonies spend everything on speed, the earthball digs in: slow, armoured and stubborn.',
    res: { energy: 50, water: 30, phosphorus: 5 },
    hand: [
      { name: 'Sclerotial Crust', count: 2 },
      { name: 'Amputate', count: 2 },
      { name: 'Apical Drive', count: 5 },
      { name: 'Hyphal Extension', count: 3 },
      { name: 'Acorn Cache', count: 3 },
    ],
  },
  {
    id: 'hydnellum', vibe: 'aqua', unlock: 'Complete level 1',
    name: 'Bleeding Tooth Fungus', latin: 'Hydnellum peckii', img: 'hydnellum-peckii',
    blurb: 'A damp-forest fungus that runs on water: it drives so much moisture through itself that it weeps bright red droplets from its cap — real <b>guttation</b>. That constant flow lets it grow almost anywhere the ground is wet, fanning out in every direction and pressing on long after drier colonies stall. Open the taps and flood the map.',
    res: { energy: 50, water: 20, phosphorus: 0 },
    hand: [
      { name: 'Aquaporin Channels', count: 1 },
      { name: 'Hyphal Extension', count: 5 },
      { name: 'Apical Drive', count: 5 },
      { name: 'Foraging Fan', count: 5 },
      { name: 'Acorn Cache', count: 3 },
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
// only per-level scaling is the number of each threat present (owner-specified).
// Beat MAX_LEVEL to win the game.
// =============================================================================
export const MAX_LEVEL = 11;

// index by level (1-based); [0] unused. Each: ant nests / nematodes / mould patches.
export const LEVEL_THREATS = [
  null,
  { ants: 1, nematodes: 1, trych: 1 },   // 1
  { ants: 1, nematodes: 2, trych: 2 },   // 2
  { ants: 2, nematodes: 3, trych: 2 },   // 3
  { ants: 2, nematodes: 3, trych: 3 },   // 4
  { ants: 2, nematodes: 4, trych: 3 },   // 5
  { ants: 2, nematodes: 4, trych: 4 },   // 6
  { ants: 3, nematodes: 4, trych: 4 },   // 7
  { ants: 3, nematodes: 5, trych: 4 },   // 8
  { ants: 3, nematodes: 5, trych: 5 },   // 9
  { ants: 4, nematodes: 5, trych: 5 },   // 10
  { ants: 6, nematodes: 6, trych: 6 },   // 11
];

export function threatsForLevel(level) {
  return LEVEL_THREATS[level] || LEVEL_THREATS[LEVEL_THREATS.length - 1];
}

// The level a species unlocks at, parsed from its `unlock` label ("Complete level N").
export function levelFromUnlock(label) {
  const m = /(\d+)/.exec(label || '');
  return m ? +m[1] : null;
}

// Species whose unlock tier is exactly this level (i.e. granted by clearing it).
export function speciesUnlockedByClearing(level) {
  return SPECIES.filter((s) => s.unlock && levelFromUnlock(s.unlock) === level);
}

// --- unlock progress (persisted in localStorage) ---------------------------
const PROGRESS_KEY = 'mycelium.progress.v1';

export function loadProgress() {
  try { return Object.assign({ maxLevelCleared: 0 }, JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}); }
  catch (_) { return { maxLevelCleared: 0 }; }
}
export function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (_) {}
}
// Record a cleared level; returns the updated progress.
export function recordLevelCleared(level) {
  const p = loadProgress();
  p.maxLevelCleared = Math.max(p.maxLevelCleared || 0, level);
  saveProgress(p);
  return p;
}
// A species is available in the picker if it has no unlock gate, or its gate level
// has been cleared.
export function isUnlocked(sp, progress) {
  if (!sp.unlock) return true;
  const lvl = levelFromUnlock(sp.unlock);
  return lvl != null && (progress.maxLevelCleared || 0) >= lvl;
}
