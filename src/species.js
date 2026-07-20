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
    blurb: 'A grassland saprotroph that grows outward in an ever-widening <b>fairy ring</b> pattern — the colony pushes evenly in every direction from its heart, decomposing the turf as it goes. It is marcescent: it shrivels in a drought and springs back to life once the rain returns, so it banks water and simply waits the dry spells out. Slow, broad and hard to kill — a forgiving way to learn the colony.',
    res: { energy: 0, water: 30, phosphorus: 0 },
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
    res: { energy: 10, water: 25, phosphorus: 0 },   // opener Rhizomorph Lance costs 1⚡ to play → start with Energy
    hand: [
      { name: 'Apical Drive', count: 10 },
      { name: 'Rhizomorph Lance', count: 5 },
    ],
  },
  {
    id: 'scleroderma', vibe: 'spore', unlock: 'Complete level 1',
    name: 'Common Earthball', latin: 'Scleroderma citrinum', img: 'scleroderma-citrinum',
    blurb: 'A tough, chemically defended fungus whose name means <b>"hard skin"</b> — it seals itself inside a thick, warty, leathery rind and holds ground instead of racing for it. It walls off and severs any tissue that rot or grazers reach, so infection never spreads. Where other colonies spend everything on speed, the earthball digs in: slow, armoured and stubborn.',
    res: { energy: 0, water: 30, phosphorus: 5 },
    hand: [
      { name: 'Sclerotial Crust', count: 2 },
      { name: 'Amputate', count: 2 },
      { name: 'Apical Drive', count: 5 },
      { name: 'Hyphal Extension', count: 3 },
      { name: 'Acorn Cache', count: 3 },
    ],
  },
  {
    id: 'schizophyllum', vibe: 'aqua', unlock: null, memory: true,
    name: 'Split Gill', latin: 'Schizophyllum commune', img: 'schizophyllum-commune',
    blurb: 'The most widely distributed mushroom on Earth and the most genetically promiscuous — over <b>20,000 mating types</b>, endlessly adaptable. Its namesake <b>split gills</b> fold shut to ride out drought and reopen the moment damp returns. This colony <b>learns</b>: it always opens with its aquaporins and a fistful of driving tips, then carries forward <b>five cards you hand-pick from whatever you drafted on your last run</b> — so every attempt tunes the deck a little sharper. The first run is bare; build it out over several.',
    res: { energy: 10, water: 25, phosphorus: 0 },
    hand: [
      { name: 'Aquaporin Channels', count: 1 },
      { name: 'Apical Drive', count: 5 },
    ],
  },
  {
    id: 'hydnellum', vibe: 'aqua', unlock: 'Complete level 1',
    name: 'Bleeding Tooth Fungus', latin: 'Hydnellum peckii', img: 'hydnellum-peckii',
    blurb: 'A damp-forest fungus that runs on water: it drives so much moisture through itself that it weeps bright red droplets from its cap — real <b>guttation</b>. That constant flow lets it grow almost anywhere the ground is wet, fanning out in every direction and pressing on long after drier colonies stall. Open the taps and flood the map.',
    res: { energy: 10, water: 20, phosphorus: 0 },   // opener Aquaporin Channels costs 10⚡ to install → start with Energy
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

export function threatsForLevel(level) {
  return LEVEL_THREATS[level] || LEVEL_THREATS[LEVEL_THREATS.length - 1];
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

// The ordered unlock-tier levels, from LOCKED_TIERS — e.g. [1, 3, 5, 7, 10].
function tierLevels() {
  return LOCKED_TIERS.map((t) => levelFromUnlock(t.label)).filter((n) => n).sort((a, b) => a - b);
}

// Spore price to buy a revealed species: it DOUBLES per unlock tier, starting at
// UNLOCK_TIER_BASE for the FIRST gated tier (revealed after level 1):
//   after lvl 1 → 1000, lvl 3 → 2000, lvl 5 → 4000, lvl 7 → 8000, lvl 10 → 16000, …
// A species' tier RANK is its unlock level's position among the successive tier
// levels. All species in a tier share that tier's price. Explicit `sp.cost` overrides.
export const UNLOCK_TIER_BASE = 1000;
export function unlockCost(sp) {
  if (!sp || !sp.unlock) return 0;
  if (sp.cost != null) return sp.cost;
  const lvl = levelFromUnlock(sp.unlock);
  if (!lvl) return 0;
  const levels = tierLevels();
  let rank = levels.indexOf(lvl);
  if (rank < 0) rank = levels.filter((l) => l < lvl).length;   // off-tier level → rank by how many tiers precede it
  return UNLOCK_TIER_BASE * Math.pow(2, rank);
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
  if (!p.loadouts) p.loadouts = {};   // per-species carried loadout (memory species): { id: [{name,count}] }
  return p;
}
export function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (_) {}
}
// "New" on the title screen: wipe all unlock progress (start from scratch).
export function resetProgress() {
  try { localStorage.removeItem(PROGRESS_KEY); } catch (_) {}
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
  const lvl = levelFromUnlock(sp.unlock);
  return lvl != null && clearsFor(progress, lvl) >= tierIndexOf(sp) + 1;
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
