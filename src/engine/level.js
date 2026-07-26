// =============================================================================
// Hand-authored LEVELS — the format the level editor writes, and the loader that
// turns one into a playable Substrate.
//
// A procedural map (substrate.js generateSubstrate) decides everything from a
// seed. An AUTHORED map is the opposite: an explicit list of OBJECTS the designer
// dragged, rotated and resized in `docs/level-editor.html`. Each object carries
// its own world geometry, so what the editor shows is what the game builds.
//
// Two things make that safe against the rest of the engine:
//   • Rock objects are NOT baked into cells here. They're published on
//     `sub.levelSprites`, and main.js draws AND solidifies from that one list
//     (`solidifyRock` stamps each sprite's opaque silhouette into the coarse
//     cell.rock grid + the fine growth-collision mask). So collision matches the
//     visible art exactly — the same WYSIWYG guarantee procedural maps get.
//   • Everything the sim reads directly — water cells, food piles, reservoirs,
//     surface barriers — IS baked here, in exactly the shapes generateSubstrate
//     produces, so no downstream system can tell an authored map from a
//     procedural one.
//
// Object types (`t`), all coordinates in WORLD units unless noted:
//   boulder     { key, x, y, w, h, rot }      one rock sprite (drawn plain)
//   formation   { key, x, y, w, h, rot }      big rock sprite (soil-blended base)
//   lake        { x, w, h }                   surface bowl; x = centre, h = depth
//   reservoir   { x, y, r }                   underground water pocket (teardrop)
//   food        { kind, x, y, r, energy }     leaf pile; kind duff|cache|cache-engine,
//                                             r = footprint radius in CELLS
//   ant         { x }                         nest on the surface at this x
//   nematode    { x, y }                      worm
//   trichoderma { x, y, r }                   mould cloud
//   mountain    { key, x, w }                 surface mountain landmark (barrier); `key` picks
//                                             which mountainN peak art (omit → the game shuffles)
//   prop        { key, x, h, flip }           above-ground decor sprite standing on the soil
//                                             line (tree / goalbush / house). Decor only.
//   city        { key, x, w }                 skyline backdrop over the surface; `key` picks
//                                             which skylineN art (omit → the game shuffles one in)
//
// A map that places ANY `city` object takes full control of its skylines — main.js
// cityRuns() returns exactly those. A map with none keeps the derived behaviour (a
// skyline over every wide run of 'concrete' surface), so levels authored before cities
// existed look unchanged.
// =============================================================================

import { Substrate, reservoirHalfWidth } from './substrate.js';

export const LEVEL_FORMAT = 'mycelium-level';
export const LEVEL_VERSION = 1;

// Object types the editor can place. `solid` = becomes a rock sprite.
export const ROCK_TYPES = ['boulder', 'formation'];

// A fresh, empty level: the default world box with a start zone, a goal zone and
// nothing in between. The editor starts here; so does any programmatic author.
export function blankLevel(world) {
  const w = world || {};
  return {
    format: LEVEL_FORMAT,
    version: LEVEL_VERSION,
    name: 'Untitled level',
    campaignLevel: null,
    world: {
      width: w.width || 2600,
      height: w.height || 1500,
      surfaceY: w.surfaceY || 380,
      cellSize: w.cellSize || 36,
    },
    layout: { startCols: 2, goalCols: 6, summerCols: 7, clearChannels: true },
    objects: [],
  };
}

// True for anything that parses as a level of a format/version we can build.
export function isLevel(o) {
  return !!o && o.format === LEVEL_FORMAT && (o.version | 0) <= LEVEL_VERSION && Array.isArray(o.objects);
}

// A clone of `config` with the level's world box applied. The rest of CONFIG
// (economy, threat behaviour, render) is untouched — an authored map changes
// GEOMETRY, not rules.
export function configForLevelDef(config, level) {
  const cfg = JSON.parse(JSON.stringify(config));
  const w = (level && level.world) || {};
  if (w.width) cfg.world.width = w.width;
  if (w.height) cfg.world.height = w.height;
  if (w.surfaceY != null) cfg.world.surfaceY = w.surfaceY;
  if (w.cellSize) cfg.world.cellSize = w.cellSize;
  return cfg;
}

// -----------------------------------------------------------------------------
// Build the Substrate. Returns { substrate, spawns, startCol } — the caller
// (state.js createLevelState) seeds the network and the threats from `spawns`.
// -----------------------------------------------------------------------------
export function buildLevel(config, level) {
  const sub = new Substrate(config);
  const cs = sub.cellSize;
  const lay = (level && level.layout) || {};
  const objects = (level && level.objects) || [];

  const goalCols = Math.max(2, Math.min(sub.cols - 4, lay.goalCols || 6));
  const startCols = Math.max(1, Math.min(sub.cols - goalCols - 1, lay.startCols || 2));
  const goalStart = sub.cols - goalCols;
  sub.startCols = startCols;
  sub.homeCols = Math.max(6, startCols + 4);
  sub.authored = true;              // renderers/solidify take the levelSprites path
  sub.rockColumns = [];             // authored maps express columns as formation sprites
  sub.levelSprites = [];            // { key, style, x, y, w, h, rot } — draw + collide from this
  sub.lakeArt = {};                 // first column of a lake -> the art the author picked
  sub.reservoirs = [];
  sub.foodPiles = [];
  sub.authoredCities = [];          // { c0, c1, wCells, key } — explicit skylines (main.js cityRuns)
  sub.authoredMountains = [];       // { c0, c1, wCells, key } — explicit peaks (main.js mountainRuns)
  sub.authoredProps = [];           // { key, col, h, embed, flip } — surface decor (main.js surfaceProps)

  // --- surface layout: impassable middle, fruitable goal + summery approach ----
  for (let c = 0; c < sub.cols; c++) {
    sub.surface[c].soil = false;
    sub.surface[c].shade = false;
    sub.surface[c].goal = false;
    sub.surface[c].barrier = 'concrete';
  }
  for (let c = goalStart; c < sub.cols; c++) {
    sub.surface[c].soil = true; sub.surface[c].goal = true; sub.surface[c].barrier = null;
  }
  const summerCols = Math.max(0, Math.min(goalStart - startCols - 2, lay.summerCols != null ? lay.summerCols : 7));
  for (let c = goalStart - summerCols; c < goalStart; c++)
    if (c >= 0) { sub.surface[c].barrier = null; sub.surface[c].soil = true; sub.surface[c].goal = true; sub.surface[c].shade = false; }

  const spawns = { ants: [], nematodes: [], clouds: [] };
  const N = config.substrate.foodCellNutrient || 50;

  // Column span covered by a surface object centred at `x` with width `w`. The right edge
  // needs ceil-1, NOT colAtX: colAtX is floor(x/cs), so an edge landing exactly on a cell
  // boundary — which is the normal case, since the editor snaps widths to whole cells —
  // reports the NEXT column and the span comes out one column too wide. (Authored mountains
  // had that off-by-one from the start: they flagged one more column than the art covers.)
  const spanCols = (x, w) => {
    const c0 = Math.max(0, sub.colAtX(x - w / 2));
    const c1 = Math.min(sub.cols - 1, Math.max(c0, Math.ceil((x + w / 2) / cs) - 1));
    return { c0, c1 };
  };

  // --- objects ---------------------------------------------------------------
  // Order matters only where objects overwrite cells: lakes and reservoirs carve
  // water, food stamps nutrient. Rocks touch no cells at all (see header), so
  // they can never bury a pile — solidifyRock skips food + water cells.
  for (const o of objects) {
    if (!o || !o.t) continue;
    switch (o.t) {
      case 'boulder':
      case 'formation':
        if (!o.key) break;
        sub.levelSprites.push({
          key: o.key, style: o.t,
          x: +o.x || 0, y: +o.y || 0,
          w: Math.max(4, +o.w || cs), h: Math.max(4, +o.h || cs),
          rot: +o.rot || 0,
        });
        break;
      case 'lake':      stampLake(sub, o); break;
      case 'reservoir': stampReservoir(sub, o); break;
      case 'food':      stampFood(sub, o, N); break;
      case 'mountain': {
        const { c0, c1 } = spanCols(+o.x || 0, +o.w || cs);
        for (let c = c0; c <= c1; c++) if (!sub.surface[c].goal) sub.surface[c].barrier = 'mountain';
        // Record the span + chosen peak art so the renderer can honour it instead of
        // shuffling one in (main.js mountainRuns). The barrier flags above are what makes
        // the surface impassable; this list only decides which sprite is drawn.
        sub.authoredMountains.push({ c0, c1, wCells: c1 - c0 + 1, key: o.key || null });
        break;
      }
      case 'prop': {
        // Above-ground decor. Procedural maps scatter trees over fruitable soil, which an
        // authored map has none of outside the goal — so without this an authored map gets
        // no surface greenery at all.
        if (!o.key) break;
        sub.authoredProps.push({
          key: String(o.key), col: sub.colAtX(+o.x || 0),
          h: Math.max(8, +o.h || 124), embed: 24, flip: !!o.flip,
        });
        break;
      }
      case 'city': {
        // Column span only — the skyline is a BACKDROP, so it changes no cell and no
        // surface flag (those columns are already 'concrete'). Overlapping a city with a
        // mountain or lake is an author error the editor shows but the loader won't fight.
        const { c0, c1 } = spanCols(+o.x || 0, +o.w || cs);
        if (c1 >= c0) sub.authoredCities.push({ c0, c1, wCells: c1 - c0 + 1, key: o.key || null });
        break;
      }
      case 'ant':         spawns.ants.push(sub.colAtX(+o.x || 0)); break;
      case 'nematode':    spawns.nematodes.push({ x: +o.x || 0, y: +o.y || 0 }); break;
      case 'trichoderma': spawns.clouds.push({ x: +o.x || 0, y: +o.y || 0, r: +o.r || 0 }); break;
      default: break;
    }
  }

  // --- entry + goal channels -------------------------------------------------
  // The colony roots at the far left and must surface at the far right, so those
  // two channels are always dug clear (and flagged pathClear, which solidifyRock
  // honours as "never solid"). There is NO guaranteed corridor between them —
  // that's the whole point of authoring: the route is whatever you left open.
  if (lay.clearChannels !== false) {
    const clearChannel = (c0, c1) => {
      for (let col = c0; col < c1; col++)
        for (let row = 0; row < sub.rows; row++) {
          const cell = sub.cellAt(col, row);
          if (cell && !cell.water) { cell.rock = false; cell.pathClear = true; }
        }
    };
    clearChannel(0, startCols + 1);
    clearChannel(goalStart - 1, sub.cols);
  }

  const startCol = Math.max(1, Math.floor(startCols / 2));
  return { substrate: sub, spawns, startCol };
}

// A surface lake: a semi-ellipse bowl of impassable water hanging from the
// waterline, matching generateSubstrate's d = maxDepth·√(1−t²) profile (drawLakes
// clips the art to exactly that curve).
function stampLake(sub, o) {
  const cs = sub.cellSize;
  const wCols = Math.max(2, Math.round((+o.w || cs * 8) / cs));
  const dRows = Math.max(1, Math.round((+o.h || cs * 3) / cs));
  const c0 = sub.colAtX((+o.x || 0) - wCols * cs / 2);
  const centre = c0 + wCols / 2;
  // drawLakes keys its art off the run's first column; record the author's pick
  // there so the editor preview and the game show the same water.
  if (o.key) sub.lakeArt[Math.max(0, c0)] = o.key;
  for (let col = c0; col < c0 + wCols; col++) {
    if (col < 0 || col >= sub.cols) continue;
    const t = (col + 0.5 - centre) / (wCols / 2);
    const d = Math.max(1, Math.round(dRows * Math.sqrt(Math.max(0, 1 - t * t))));
    sub.surface[col].barrier = 'lake';
    sub.surface[col].soil = false;
    sub.surface[col].goal = false;
    for (let row = 0; row < d; row++) {
      const cell = sub.cellAt(col, row);
      if (cell) { cell.rock = true; cell.water = true; cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false; cell.foodKind = ''; }
    }
  }
}

// An underground water pocket, carved to the same TEARDROP the art draws
// (substrate.js reservoirHalfWidth) so the visible pool covers exactly the water
// cells the sim reads. Touching one grants Water income (cards.js).
function stampReservoir(sub, o) {
  const cs = sub.cellSize;
  const rad = Math.max(1, Math.round((+o.r || cs * 2) / cs));
  const cx = sub.colAtX(+o.x || 0), cy = sub.rowAtY(+o.y || 0);
  const id = sub.reservoirs.length + 1;
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (let dr = -rad; dr <= rad; dr++)
    for (let dc = -rad; dc <= rad; dc++) {
      if (dc * dc + dr * dr > rad * rad) continue;
      if (Math.abs(dc) > reservoirHalfWidth(dr, rad)) continue;
      const cell = sub.cellAt(cx + dc, cy + dr);
      if (!cell) continue;
      cell.rock = true; cell.water = true; cell.reservoir = id;
      cell.formation = false; cell.rockFill = false;
      cell.nutrient = 0; cell.maxNutrient = 0; cell.hazard = false; cell.foodKind = '';
      c0 = Math.min(c0, cx + dc); c1 = Math.max(c1, cx + dc);
      r0 = Math.min(r0, cy + dr); r1 = Math.max(r1, cy + dr);
    }
  if (c1 < c0) return;                            // entirely off-grid
  sub.reservoirs.push({ id, cx, cy, rad, c0, c1, r0, r1, key: o.key || null });
}

// A leaf-litter food pile: a diamond of nutrient cells + a registered entry in
// sub.foodPiles, so colonising it pays Energy and (for cache / cache-engine)
// drafts a card, exactly like a generated pile.
function stampFood(sub, o, N) {
  const kindCell = o.kind === 'cache-engine' ? 'cache-engine' : o.kind === 'duff' ? 'duff' : 'cache';
  const kindPile = kindCell === 'cache-engine' ? 'engine' : kindCell === 'duff' ? 'duff' : 'normal';
  const radius = Math.max(0, Math.min(6, Math.round(+o.r || 1)));
  const col = sub.colAtX(+o.x || 0), row = sub.rowAtY(+o.y || 0);
  const cells = [];
  for (let dr = -radius; dr <= radius; dr++)
    for (let dc = -radius; dc <= radius; dc++) {
      if (Math.abs(dr) + Math.abs(dc) > radius) continue;          // diamond footprint
      const c = col + dc, r = row + dr;
      const cell = sub.cellAt(c, r);
      if (!cell || cell.water || cell.hazard) continue;
      if (cell.maxNutrient > 0) continue;                          // already another pile's cell
      cell.rock = false; cell.rockFill = false;
      cell.nutrient = N; cell.maxNutrient = N; cell.foodKind = kindCell;
      cells.push(sub.index(c, r));
    }
  if (!cells.length) return;
  const energyValue = Math.max(0, +o.energy || (kindPile === 'engine' ? 4 : kindPile === 'duff' ? 2 : 3));
  const pile = { cells, rewarded: false, kind: kindPile, energyValue };
  const per = energyValue / Math.max(1, cells.length * N);
  for (const idx of cells) sub.cells[idx].energyPerNutrient = per;
  sub.foodPiles.push(pile);
}
