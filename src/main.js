// =============================================================================
// main.js — wiring (A9).
//
// Connects input -> actions (mutating engine state) -> renderers (reading
// state). Keeps simulation and rendering strictly separated: this file is the
// only place they meet. The render loop draws the world (canvas) every frame;
// the DOM UI updates only when state changes.
// =============================================================================

import { CONFIG } from './config.js';
import { createState, createPuzzleState } from './engine/state.js';
import { performAction, devSpawnTrichoderma, ACTIONS } from './engine/actions.js';
import { spawnNematodeAt } from './engine/nematodes.js';
import { tickWorld } from './engine/turn.js';
import { initCards, drawCard, skipRound, playCard, cardNeedsTarget, cardUsesDragAim, dragAimReach, cardBlockedReason, chooseOffer, activateAction, cardAbilityInfo } from './engine/cards.js';
import { Camera } from './render/camera.js';
import { SubstrateRenderer } from './render/substrate.js';
import { NetworkRenderer, drawFruitBodies } from './render/network.js';
import { Lighting } from './render/lighting.js';
import { UI, cardSlug } from './render/ui.js';
import { showSpeciesSelect, showLevelComplete, showGameWon } from './render/species_select.js';
import { showTitleScreen } from './render/title_screen.js';
import { startTutorial } from './render/tutorial.js';
import { SPECIES, MAX_LEVEL, threatsForLevel, recordLevelCleared, newlyUnlockedByClear, loadProgress, resetProgress } from './species.js';
import { loadAssets, hasAsset, asset, pattern, assetMeta, preloadCardArt } from './render/assets.js';
import { initMusic } from './render/music.js';
import { initSfx } from './render/sfx.js';
import { CARD_DATA } from './cards-data.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const camera = new Camera();
const lighting = new Lighting(CONFIG);

// Player settings (persisted). The sensing-range LIGHTING is the biggest per-frame
// cost (two full-canvas composite blits + a glow draw per node/tip), so it's a toggle
// in the settings menu — off = a flat, un-dimmed scene that's much lighter on phones.
const SETTINGS_KEY = 'mycelium.settings.v1';
function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch (_) { return {}; } }
let sensingLightOn = loadSettings().lighting !== false;   // default ON
function saveSettings() { try { const s = loadSettings(); s.lighting = sensingLightOn; localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (_) {} }

let state, ui, substrateRenderer;
let noTrich = false;                  // testing aid: spawn sandbox maps with no Trichoderma
let chosenSpecies = null;             // picked at the start-of-run screen; null = dev default run
let currentLevel = 1;                 // campaign level 1..MAX_LEVEL
let carryOver = null;                  // deck+resources snapshot transplanted onto the next level (null = seed fresh)
let _runOverPresented = false;         // guard: show the end-of-level / death overlay once per run
const networkRenderers = new Map();

// First-run tutorial: a scripted popup walkthrough that fires ONCE, the first
// time the player presses NEW. `tutorialPending` is armed by the title's New
// button (if never seen) and consumed by begin() on level 1; `tutorial` is the
// live controller while it runs. See render/tutorial.js.
let tutorial = null;
let tutorialPending = false;
let tutorialDevForce = false;          // TEMP dev title button: fire the tutorial (random species) without marking it seen
let tutorialDuff = null;               // world centre of the tutorial's guaranteed yellow pile
const TUT_KEY = 'mycelium.tutorial.v1';
function tutorialSeen() { try { return localStorage.getItem(TUT_KEY) === '1'; } catch (_) { return false; } }
function markTutorialSeen() { try { localStorage.setItem(TUT_KEY, '1'); } catch (_) {} }

let uiDirty = true;
let assetsReady = false;              // canvas art loaded — until then the map stays hidden
let _revealPending = false;           // reveal (fade in) after the next fully-drawn frame
let draftIntro = null;                // sequenced food-pile → card-draft animation (see updateDraftIntro)

// Fade the whole map in from black. Fired by the render loop after the FIRST fully
// drawn frame that follows an asset load / new map (see `_revealPending`), so the
// finished scene fades up as a whole — never a blank canvas (which is what a
// warm-cache refresh used to show, revealing before the first frame was drawn).
function revealMap() {
  canvas.style.transition = 'none';
  canvas.style.opacity = '0';
  void canvas.offsetWidth;            // commit opacity:0 with no transition
  canvas.style.transition = 'opacity 1.4s ease';
  canvas.style.opacity = '1';         // animate 0 -> 1
}

let previewFruit = false;
let previewFruitPoints = [];
// Floating "+N⚡" energy labels over the map: spawned when you TAP a food pile (its
// current value) or when a pile FINISHES digesting (the energy it gave). Each rises a
// little and fades. World-anchored so they track the camera.
const floaters = [];
const ENERGY_BOLT = (typeof Path2D !== 'undefined') ? new Path2D('M13.5 2 4 13.5h6L9 22l9.5-11.5h-6L13.5 2Z') : null;   // matches the HUD RES_ICON bolt (24×24)
const FLOAT_FONT = '"Inter", system-ui, "Segoe UI", sans-serif';
let lastTime = 0;                     // most recent frame timestamp (for action-driven effects)
let excreteFlashStart = -1e9;         // when the last Excrete fired, for the sticky pulse
let showNematodeVision = false;       // dev overlay: nematode sight range + line of sight (off by default — the rings cluttered the map)
let placingWorm = false;              // dev: click the map to drop a nematode
const mouse = { x: 0, y: 0, down: false, moved: false, startX: 0, startY: 0 };
const pointers = new Map();          // active pointers (touch/mouse) by id
let pinchDist = 0;                    // last two-finger spread, for pinch-zoom
let lastTapTime = 0, lastTapX = 0, lastTapY = 0; // double-tap-to-refit
// Active press-drag aim for a directional grow (Apical Drive / Rhizomorph Lance /
// Fruiting Vigil / Leading Cord): the press picks where growth starts, the drag its
// direction. Null when not aiming. See beginAim/updateAim/fireAim + drawAimLine.
let aim = null;
const AIM_MIN_PX = 12;                // drag this far (screen) to register a direction
// Press within this (screen px) of the colony to AIM; press farther and the gesture
// PANS the map instead — so the player can reposition the view without cancelling.
const AIM_NEAR_PX = 90;
// Drag past this (screen) to CANCEL — the line vanishes and releasing does nothing.
const aimCancelPx = () => Math.max(220, Math.min(window.innerWidth, window.innerHeight) * 0.55);

// --- setup / restart --------------------------------------------------------
// Per-level config: procedural map as always, but the number of each threat is
// set by the campaign table (species.js). Clones CONFIG so the global stays intact.
function configForLevel(level) {
  const t = threatsForLevel(level);
  const cfg = JSON.parse(JSON.stringify(CONFIG));
  cfg.ants.nestCount = t.ants;
  cfg.nematodes.initialCount = t.nematodes;
  cfg.trichoderma.initialPatches = t.trych;
  if (noTrich) {   // testing aid: a trich-free sandbox
    cfg.trichoderma.initialPatches = 0;
    cfg.trichoderma.respawnChance = 0;
  }
  return cfg;
}
function start(seed) {
  begin(createState(configForLevel(currentLevel), seed));
}
function startRun() { start((Date.now() & 0x7fffffff) || 1); }

// Show the start-of-run picker (also used on death → back to picker).
function showPicker() {
  showSpeciesSelect({
    onPick: (sp) => { chosenSpecies = sp; currentLevel = 1; carryOver = null; startRun(); },
    onDev: () => { chosenSpecies = null; currentLevel = 1; carryOver = null; startRun(); },
  });
}

function cardsCampaign() {
  return state && state.config.cards && state.config.cards.enabled && state.mode !== 'puzzle';
}

// Snapshot the current deck + reserves to carry onto the next level.
function snapshotCarry() {
  const net = state.active;
  return { cards: state.cards, energy: net.energy, water: net.water, phosphorus: net.phosphorus };
}
function applyCarry(st, carry) {
  st.cards = carry.cards;
  st.cards.pendingOffers = [];   // no stale pile offers on the fresh map
  st.cards.round = 1;
  const net = st.active;
  net.energy = carry.energy; net.water = carry.water; net.phosphorus = carry.phosphorus;
  st.log('Your colony carries its deck, engines and reserves down to the next level.', 'good');
}

// Route a finished run: a level win advances the campaign; puzzle wins / deaths
// fall through to the generic overlay (death's button goes back to the picker).
function presentRunOver() {
  if (!state.runOver || _runOverPresented) return;
  _runOverPresented = true;
  if (state.won && cardsCampaign()) { onLevelWon(); return; }
  const r = state.runResult; ui.showOverlay(r);
}

function onLevelWon() {
  const cleared = currentLevel;
  const prev = loadProgress();
  const newlyUnlocked = newlyUnlockedByClear(cleared, prev);   // one species per clear, in tier order
  recordLevelCleared(cleared);
  ui.hideOverlay();
  // Collapse the hand carousel so the (containerless) win banner has clear room
  // over the map on short screens; begin() re-opens it when the next level loads.
  if (ui.setHandOpen) ui.setHandOpen(false);
  if (cleared >= MAX_LEVEL) {
    showGameWon({ onNewRun: backToPicker });
  } else {
    const snap = snapshotCarry();
    showLevelComplete({
      level: cleared, maxLevel: MAX_LEVEL, unlocked: newlyUnlocked,
      onNext: () => { currentLevel = cleared + 1; carryOver = snap; startRun(); },
    });
  }
}

function backToPicker() {
  ui.hideOverlay();
  currentLevel = 1; carryOver = null; chosenSpecies = null;
  showPicker();
}

// The top-centre "Level N / 11" chip was removed; clean up any lingering node.
function updateLevelChip() {
  const chip = document.getElementById('levelChip');
  if (chip) chip.remove();
}

// TEMP dev button: instantly clear the current level (to test the campaign flow).
function devWinLevel() {
  if (!state || state.runOver || !cardsCampaign()) return;
  state.won = true; state.runOver = true; state.runResult = { won: true, turns: state.turn };
  presentRunOver();
}
function updateDevWinBtn() {
  let btn = document.getElementById('devWin');
  const ui0 = document.getElementById('ui');
  if (!cardsCampaign()) { if (btn) btn.style.display = 'none'; return; }
  if (!btn && ui0) {
    btn = document.createElement('button'); btn.id = 'devWin'; btn.type = 'button';
    btn.textContent = 'Dev: win level ▸';
    btn.onclick = devWinLevel;
    ui0.appendChild(btn);
  }
  if (btn) btn.style.display = '';
}
function startPuzzle() { begin(createPuzzleState(CONFIG)); }

// --- tutorial camera + wiring ----------------------------------------------
// A smooth camera move used by the tutorial to "zoom in on whatever it's talking
// about". Runs as a short eased tween advanced each render frame; the tutorial's
// arrows/rings track it because they re-read the live camera every frame.
let camFocus = null;
function isPortraitPhone() {
  try { return !!(window.matchMedia && window.matchMedia('(max-width:720px) and (orientation:portrait)').matches); }
  catch (_) { return false; }
}
function isDesktopWide() {
  try { return window.innerWidth >= 900 && !isPortraitPhone(); }
  catch (_) { return false; }
}
// anchorX / anchorY = where the SUBJECT should sit in the viewport, as fractions
// (0 = left/top, 0.5 = centre, 1 = right/bottom). The tutorial frames the subject off to
// one side/edge so its popup can sit clear of it:
//   • Portrait phone — zoom out ~50%, offset the subject VERTICALLY (anchorY ~0.28) so the
//     bottom popup never covers it.
//   • Desktop (wide) — frame the subject in a top quadrant (anchorX ~0.25/0.75, anchorY
//     ~0.25) so the top-half side popup sits opposite it.
//   • In-between widths — centred subject, given zoom (unchanged).
function focusWorld(x, y, zoom, anchorY, anchorX) {
  if (x == null || y == null) return;
  let z = zoom != null ? zoom : camera.zoom;
  let tx = x, ty = y;
  if (isPortraitPhone()) {
    z *= 0.5;                                              // wider view
    const fy = (anchorY != null) ? anchorY : 0.5;
    ty = y + (0.5 - fy) * camera.viewH / z;               // centre the camera so the subject lands at fraction fy
  } else if (isDesktopWide()) {
    const fx = (anchorX != null) ? anchorX : 0.5;
    const fy = (anchorY != null) ? anchorY : 0.5;
    tx = x + (0.5 - fx) * camera.viewW / z;               // …at horizontal fraction fx
    ty = y + (0.5 - fy) * camera.viewH / z;               // …and vertical fraction fy
  }
  camFocus = { fromX: camera.x, fromY: camera.y, fromZoom: camera.zoom,
    toX: tx, toY: ty, toZoom: z, t0: performance.now(), dur: 640 };
}
function focusBounds(b, pad = 80) {
  if (!b) return;
  const w = Math.max(1, b.maxX - b.minX), h = Math.max(1, b.maxY - b.minY);
  const z = Math.max(camera.minZoom, Math.min(camera.maxZoom, Math.min(camera.viewW / (w + pad * 2), camera.viewH / (h + pad * 2))));
  focusWorld((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, z);
}
function updateCamFocus(time) {
  if (!camFocus) return;
  const t = Math.min(1, (time - camFocus.t0) / camFocus.dur);
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // easeInOutQuad
  camera.x = camFocus.fromX + (camFocus.toX - camFocus.fromX) * e;
  camera.y = camFocus.fromY + (camFocus.toY - camFocus.fromY) * e;
  camera.zoom = camFocus.fromZoom + (camFocus.toZoom - camFocus.fromZoom) * e;
  camera.clamp();
  if (t >= 1) camFocus = null;
}

// Guarantee the two scripted props the tutorial points at: an Apical Drive in the
// opening hand (whatever species was picked) and a low-value YELLOW pile in clear
// soil a few cells from the colony root.
function injectTutorialHelpers() {
  const c = state.cards;
  if (c && Array.isArray(c.hand) && !c.hand.some((h) => h.name === 'Apical Drive')) {
    if (c.seq == null) c.seq = 1;
    c.hand.unshift({ id: c.seq++, name: 'Apical Drive' });
  }
  tutorialDuff = null;
  const sub = state.substrate;
  const root = (state.active && state.active.root) || (state.networks[0] && state.networks[0].nodes[0]);
  if (root && sub.injectDuffPile) {
    const rc = sub.colAtX(root.x), rr = Math.max(0, sub.rowAtY(root.y));
    const N = (state.config.substrate && state.config.substrate.foodCellNutrient) || 50;
    for (const [dc, dr] of [[3, 0], [4, 1], [3, 2], [5, 0], [2, 2], [4, 3], [6, 1], [3, 3]]) {
      const p = sub.injectDuffPile(rc + dc, Math.max(0, rr + dr), 1, 2, N);
      if (p) { tutorialDuff = p; substrateRenderer.markDirty(); break; }
    }
  }
}

// The deps bundle the tutorial controller reads from (see render/tutorial.js).
function tutorialDeps() {
  const surf = () => state.substrate.surfaceY;
  return {
    getState: () => state,
    worldToScreen: (x, y) => camera.worldToScreen(x, y),
    focusWorld, focusBounds,
    handCardEl: (name) => document.querySelector('#handlist .cardbtn[data-name="' + name + '"]'),
    pendingCard: () => (ui && ui.pendingCard) || null,
    setHandOpen: (open) => { if (ui && ui.setHandOpen) ui.setHandOpen(open); },
    setHandFilter: (key) => { if (ui && ui.setHandFilter) ui.setHandFilter(key); },
    colonyRoot: () => { const r = (state.active && state.active.root) || (state.networks[0] && state.networks[0].nodes[0]); return r ? { x: r.x, y: r.y } : null; },
    goalPoint: () => { const g = goalCol0(); if (g < 0) return null; return { x: (g + 3.5) * state.substrate.cellSize, y: surf() - 8 }; },
    duffPile: () => tutorialDuff,
    threats: () => ({
      ant: (state.ants && state.ants[0]) ? { x: state.ants[0].x, y: surf() + 40 } : null,
      nematode: (state.nematodes && state.nematodes[0]) ? { x: state.nematodes[0].x, y: state.nematodes[0].y } : null,
      trich: (state.clouds && state.clouds[0]) ? { x: state.clouds[0].cx, y: state.clouds[0].cy } : null,
    }),
    onDone: () => { tutorial = null; },
  };
}

// Start (or restart) the tutorial over the CURRENT run. Injects the scripted props
// first. Exposed on window.__game for the future "replay tutorial" button + tests.
function beginTutorial() {
  if (!state || !state.cards) return;
  if (tutorial) { tutorial.destroy(); tutorial = null; }
  injectTutorialHelpers();
  uiDirty = true;
  tutorial = startTutorial(tutorialDeps());
}

function begin(newState) {
  state = newState;
  if (state.mode !== 'puzzle') state.level = currentLevel;
  _runOverPresented = false;
  if (tutorial) { tutorial.destroy(); tutorial = null; }   // never carry a tutorial across levels/runs
  // Card layer online for procedural (non-puzzle) runs. Priority:
  //   carryOver  → transplant the deck+reserves from the previous level (campaign)
  //   chosenSpecies → that species' exact starting hand + resources
  //   else       → dev scaffold (5× of every card + 300 of each resource)
  if (state.config.cards && state.config.cards.enabled && state.mode !== 'puzzle') {
    if (carryOver) { applyCarry(state, carryOver); carryOver = null; }
    else if (chosenSpecies) initCards(state, 'species', chosenSpecies);
    else initCards(state, 'testall');
  }
  buildRenderers();
  // Invisible console/debug hook (no on-screen UI). Kept for self-play + testing
  // even with the dev-tools panel off; remove for a public release.
  window.__game = {
    get state() { return state; }, camera, performAction, tickWorld,
    draw: () => resolveCardOp(drawCard(state)),
    skip: () => resolveCardOp(skipRound(state)),
    play: (i, ctx) => resolveCardOp(playCard(state, i, ctx)),
    chooseCard: (name) => { const r = chooseOffer(state, name); uiDirty = true; return r; },
    botToGoal,
    // Debug hooks (invisible; used by tests/self-play): force a level win or a colony death.
    winLevel: () => devWinLevel(),
    killColony: () => { state.active.alive = false; state.runOver = true; state.won = false; state.runResult = { won: false, died: true, turns: state.turn }; presentRunOver(); },
    // Tutorial hooks (used by the future "replay tutorial" button + tests).
    startTutorial: () => beginTutorial(),
    resetTutorial: () => { try { localStorage.removeItem(TUT_KEY); } catch (_) {} },
  };
  if (ui) ui.setState(state); else ui = new UI(state, handlers);
  ui.hideOverlay();
  if (ui.setHandOpen) ui.setHandOpen(true);   // re-open the carousel a level-win collapse may have closed
  ui.setSelectedAction(null);
  // Clear any armed aim/selection so a stale index never carries into the new run.
  if (ui.clearPendingCard) ui.clearPendingCard();
  if (ui.clearPendingAction) ui.clearPendingAction();
  if (ui.clearArmed) ui.clearArmed();
  previewFruit = false;
  previewFruitPoints = [];
  resize();
  // Keep the view inside the painted map rect (sky at y=0 down to viewHeight,
  // x across the full world width) so panning/zooming never reveals the empty
  // background beyond the map's edges. viewHeight includes the bottom dirt buffer.
  camera.setWorldBounds(0, 0, state.substrate.worldWidth, state.substrate.viewHeight);
  if (state.mode === 'puzzle') {
    // show the whole level so the layout (rocks, food, chest, mould) reads;
    // pad the sides so the start (far left) and chest (far right) aren't jammed
    // against the screen edges / under the HUD + dev panels.
    camera.fitBounds({ minX: -160, minY: state.substrate.surfaceY - 30,
      maxX: state.substrate.worldWidth + 160, maxY: state.substrate.worldHeight }, 30);
  } else {
    // Start focused on the colony's entry point so the player sees their network
    // immediately (they can zoom out / pan to survey the route). Centre on the
    // colony root at a comfortable working zoom, then clamp back into bounds.
    const root = state.networks[0] && state.networks[0].nodes[0];
    camera.zoom = 0.85;
    camera.x = root ? root.x : state.substrate.worldWidth * 0.08;
    camera.y = state.substrate.surfaceY + 180;   // surface high in view, colony below it
    camera.clamp();
  }
  uiDirty = true;
  updateLevelChip();
  updateDevWinBtn();
  // First-run tutorial: fires ONCE, on the first NEW → level 1 of a real species
  // run (not puzzle/dev). Consume the pending flag either way so it never re-fires.
  // The TEMP dev title button (tutorialDevForce) fires it too, but WITHOUT marking
  // it seen — so it never interferes with testing the real first-run flow.
  if ((tutorialPending || tutorialDevForce) && currentLevel === 1 && state.mode !== 'puzzle') {
    const devForced = tutorialDevForce;
    tutorialPending = false; tutorialDevForce = false;
    if (chosenSpecies && state.config.cards && state.config.cards.enabled) {
      if (!devForced) markTutorialSeen();
      beginTutorial();
    }
  }
  // On a new map, fade the finished scene in AFTER its first frame draws (the very
  // first map also waits for art to load — see the loadAssets() boot below), so it
  // never fades in half-drawn or on a blank canvas.
  if (assetsReady) _revealPending = true;
}

function buildRenderers() {
  substrateRenderer = new SubstrateRenderer(state.substrate, state.config, state.seed);
  networkRenderers.clear();
  for (const net of state.networks) networkRenderers.set(net.id, new NetworkRenderer(net, state.config, state.substrate));
}

function rendererFor(net) {
  let r = networkRenderers.get(net.id);
  if (!r) { r = new NetworkRenderer(net, state.config, state.substrate); networkRenderers.set(net.id, r); }
  return r;
}

// A bounding box around the network, clamped to show some surrounding map.
function expandedBounds() {
  const b = state.active.bounds() || { minX: 0, minY: state.substrate.surfaceY, maxX: 600, maxY: 600 };
  return {
    minX: b.minX - 200, minY: state.substrate.surfaceY - 80,
    maxX: b.maxX + 200, maxY: b.maxY + 200,
  };
}

// --- input handlers (passed to UI) -----------------------------------------
const handlers = {
  // Settings menu (gear button, ui.js): replay the tutorial + toggle sensing-range lighting.
  onReplayTutorial: () => beginTutorial(),
  isLightingOn: () => sensingLightOn,
  setLightingOn: (v) => { sensingLightOn = !!v; saveSettings(); uiDirty = true; },
  onAction(name, ctx) {
    placingWorm = false;              // selecting an action leaves worm-placement mode
    const a = ACTIONS[name];
    // Targeted actions: first click selects targeting mode; the canvas click
    // supplies coordinates.
    if ((a.target === 'point' || a.target === 'node') && (!ctx || ctx.x === undefined)) {
      ui.setSelectedAction(ui.selectedAction === name ? null : name);
      uiDirty = true;
      return;
    }
    const res = performAction(state, name, ctx || {});
    afterAction(name, res);
  },
  onRestart() {
    noTrich = false;                  // "New Map" returns to a normal (mould) map
    start((Date.now() & 0x7fffffff) || 1);
  },
  onBackToPicker() {                  // death (campaign) → choose a species again from scratch
    backToPicker();
  },
  onNoTrichMap() {
    noTrich = true;                   // re-rollable Trichoderma-free sandbox for testing
    start((Date.now() & 0x7fffffff) || 1);
  },
  onToggleWormVision() {
    showNematodeVision = !showNematodeVision;
    return showNematodeVision;
  },
  onPlaceWorm() {
    placingWorm = !placingWorm;
    if (placingWorm) { ui.setSelectedAction(null); ui.setHint('Click the map to drop a nematode. Esc to stop.'); }
    uiDirty = true;
    return placingWorm;
  },
  onPuzzle() {
    startPuzzle();
  },
  onCheat(type) {
    const net = state.active;
    if (type === 'energy') { net.energy += CONFIG.dev.cheatEnergy; state.log(`DEV: +${CONFIG.dev.cheatEnergy} Energy.`, 'dev'); }
    else if (type === 'spores') { state.spores += CONFIG.dev.cheatSpores; state.log(`DEV: +${CONFIG.dev.cheatSpores} Spores.`, 'dev'); }
    else if (type === 'trichoderma') {
      const n = net.nodes.length ? net.nodes[Math.floor(state.rng() * net.nodes.length)] : null;
      const x = n ? n.x + state.rng.range(-40, 40) : camera.x;
      const y = n ? n.y + state.rng.range(20, 80) : camera.y;
      devSpawnTrichoderma(state, x, y);
      substrateRenderer.markDirty();
    }
    else if (type === 'nematode') {
      // Drop a few worms a short way off a random strand so they crawl in.
      const n = net.nodes.length ? net.nodes[Math.floor(state.rng() * net.nodes.length)] : null;
      for (let i = 0; i < 3; i++) {
        const x = (n ? n.x : camera.x) + state.rng.range(-160, 160);
        const y = (n ? n.y : camera.y) + state.rng.range(60, 200);
        spawnNematodeAt(state, x, y);
      }
      state.log('DEV: spawned nematodes.', 'dev');
    }
    uiDirty = true;
  },
  onSliderChange() { uiDirty = true; },
  // --- card layer ---
  onDraw() {
    if (draftLocked()) return;
    cancelAiming();
    resolveCardOp(drawCard(state));
  },
  onSkip() { if (draftLocked()) return; cancelAiming(); resolveCardOp(skipRound(state)); },
  // Returns true if the card was played or entered aiming; false if blocked
  // (e.g. can't afford) — the caller uses this to decide whether to minimize.
  onPlayCard(index) {
    if (draftLocked()) return false;
    const entry = state.cards && state.cards.hand[index];
    if (!entry) return false;
    // Can't afford / not allowed → surface why and drop the log down.
    const reason = cardBlockedReason(state, entry.name);
    if (reason) { state.log(reason, 'warn'); ui.toast(reason); uiDirty = true; return false; }
    // Playing/aiming a card cancels any pending targeted-action aim (mutually exclusive).
    if (ui.clearPendingAction) ui.clearPendingAction();
    if (cardNeedsTarget(entry.name)) {
      ui.setPendingCard(index);
      ui.setSelectedAction(null);
      ui.setHint(cardUsesDragAim(entry.name)
        ? `Press on your colony and drag to aim ${entry.name} — release to grow. Press away from it to pan.`
        : `Tap the map to aim/target ${entry.name}.`);
      uiDirty = true;
      return true;
    }
    // Tempo upgrades speed up ONE installed ability the player picks. Build the
    // eligible list (installed abilities still waiting >1 round) and show a picker;
    // if nothing qualifies, say so instead of silently consuming the card.
    const info = cardAbilityInfo(entry.name);
    if (info) {
      const list = info.scope === 'action' ? state.cards.actions : state.cards.engines;
      const eligible = (list || []).map((a, i) => ({ i, name: a.name, every: a.every })).filter((a) => a.every > 1);
      if (!eligible.length) {
        const msg = info.scope === 'action'
          ? 'No installed action to speed up yet — install one first.'
          : 'No resource engine to speed up yet — install one first.';
        state.log(msg, 'warn'); ui.toast(msg); uiDirty = true; return false;
      }
      ui.showAbilityPicker(index, info.scope, info.amount, eligible);
      uiDirty = true;
      return true;
    }
    // A card can be affordable yet no-op (e.g. "No food within sensing range"):
    // playCard returns {ok:false} and leaves it in hand. Report the real status
    // so the caller only minimizes/deselects on an actual play.
    const res = playCard(state, index);
    resolveCardOp(res);
    return !!(res && res.ok);
  },
  // The player picked which installed ability a tempo card should speed up.
  // Replay the card with ctx.ability = its index; a tempo upgrade doesn't advance
  // the world (it edits an install), so it resolves like any card op.
  onPickAbility(handIndex, abilityIndex) {
    ui.hideAbilityPicker();
    resolveCardOp(playCard(state, handIndex, { ability: abilityIndex }));
  },
  onCancelAbilityPick() {
    ui.hideAbilityPicker();
    uiDirty = true;
  },
  // The player picked which resource Metabolic Reroute should GAIN. Re-run the
  // action with ctx.res so it spends 2 of the other → 1 of this one.
  onPickResource(index, resName) {
    ui.hideResourcePicker();
    const res = activateAction(state, index, { res: resName });
    if (res && res.ok) {
      substrateRenderer.markDirty();
      rendererFor(state.active).markStructureDirty();
    } else if (res && res.message) { ui.toast(res.message); }
    uiDirty = true;
  },
  onCancelResourcePick() {
    ui.hideResourcePicker();
    uiDirty = true;
  },
  onCancelCard() {
    aim = null;
    ui.clearPendingCard();
    ui.resetHint();
    uiDirty = true;
  },
  onCancelAction() {
    aim = null;
    if (ui.clearPendingAction) ui.clearPendingAction();
    ui.resetHint();
    uiDirty = true;
  },
  onActivateAction(i) {
    if (draftLocked()) return;
    // Using an installed action does NOT advance the world (it happens within the
    // round); it may reshape the colony, so refresh the renderers on success.
    const res = activateAction(state, i);
    if (res && res.needTarget) {
      // Targeted ability (e.g. Melanized Wall) — arm it for a map tap, like a card.
      ui.clearPendingCard();
      ui.setSelectedAction(null);
      ui.setPendingAction(i);
      const act = state.cards.actions[i];
      ui.setHint(act && act.aim === 'drag'
        ? `Press on your colony and drag to aim ${act.name} — release to grow. Press away from it to pan.`
        : res.message);
      uiDirty = true;
      return;
    }
    if (res && res.needResourcePick) {
      // Metabolic Reroute — pick which resource to gain, then re-activate.
      ui.showResourcePicker(i);
      uiDirty = true;
      return;
    }
    if (res && res.ok) {
      substrateRenderer.markDirty();
      rendererFor(state.active).markStructureDirty();
      if (state.runOver) presentRunOver();
    } else if (res && res.message) {
      ui.toast(res.message);
    }
    uiDirty = true;
  },
  onChooseCard(name) {
    // Drafting a pile reward is free and does NOT advance the world.
    const res = chooseOffer(state, name);
    if (res.ok) uiDirty = true;
    else if (res.message) { ui.toast(res.message); uiDirty = true; }
  },
  onFruitPreview(on) {
    previewFruit = on;
    // Compute the candidate fruit points once, on hover-start (a UI event, not
    // the render loop), so the per-frame draw just reuses this cache.
    if (on && !state.runOver) previewFruitPoints = state.active.computeFruitPoints(state.substrate);
  },
};

// A pending card DRAFT locks the rest of the game: the player may pan, look at their
// hand, and study the map (even with the panel minimized to its chip), but can't
// play/draw/skip or use abilities until they choose. Returns true (and toasts why)
// when locked, so callers bail. When the draft panel is open it's a full-screen modal
// so these paths are unreachable anyway; this guard is what enforces it once minimized.
function draftLocked() {
  const c = state.cards;
  if (c && c.pendingOffers && c.pendingOffers.length && !state.runOver) {
    if (ui.restoreOffer) ui.restoreOffer();   // pop the draft back open so they can act on the nudge
    ui.toast('Finish your draft first — choose one of the cards.');
    return true;
  }
  return false;
}

// Cancel any in-progress map aim (a targeted card OR a targeted installed action)
// and restore the default hint. Called whenever a new op starts so a stale aim
// can never survive to fire on an unrelated later tap.
function cancelAiming() {
  aim = null;
  if (ui.clearPendingCard) ui.clearPendingCard();
  if (ui.clearPendingAction) ui.clearPendingAction();
  ui.resetHint();
}

function afterAction(name, res) {
  if (!res || !res.ok) { uiDirty = true; return; }
  // The mould steps on EVERY action, so both layers may have changed: clouds
  // moved / ate (substrate) and the rot advanced along filaments (structure).
  substrateRenderer.markDirty();
  rendererFor(state.active).markStructureDirty();
  if (name === 'excrete') excreteFlashStart = lastTime;   // trigger the sticky pulse
  if (name === 'fruit') state.active.computeFruitPoints(state.substrate);
  if (state.runOver) presentRunOver();
  uiDirty = true;
}

// Resolve a card op (draw/skip/play): advance the world, refresh renderers.
function resolveCardOp(res) {
  if (res && res.ok) {
    if (res.tick) tickWorld(state);
    substrateRenderer.markDirty();
    rendererFor(state.active).markStructureDirty();
    if (state.runOver) presentRunOver();
  } else if (res && res.message) {
    ui.toast(res.message);   // a blocked/no-op play (e.g. not enough energy) → error toast
  }
  uiDirty = true;
}

// Dev / self-play: drive the card game to the goal (route right + dig barriers).
// Cheats resources so it exercises the real card→sim→win path end to end.
function botToGoal(budget = 900) {
  if (!state.cards) return { won: false, reason: 'card layer off' };
  const sub = state.substrate, net = state.active;
  const goalCols = Math.max(2, Math.min(sub.cols - 4, state.config.substrate.goalCols || 6));
  const goalStart = sub.cols - goalCols;
  const clearRow = (col) => { for (let r = 0; r < sub.rows; r++) { const c = sub.cellAt(col, r); if (c && !c.rock && !c.water) return r; } return -1; };
  let guard = 0;
  while (!state.won && !state.runOver && guard++ < budget) {
    net.energy = Math.max(net.energy, 200); net.water = 99; net.phosphorus = 99;
    const fp = net.frontierPoint(); if (!fp) break;
    const fcol = sub.colAtX(fp.x);
    let target;
    if (fcol >= goalStart) target = { x: fp.x, y: sub.surfaceY + 18 };
    else { let tcol = Math.min(sub.cols - 1, fcol + 3), tr = clearRow(tcol); if (tr < 0) { tcol = Math.min(sub.cols - 1, fcol + 1); tr = clearRow(tcol); } target = tr >= 0 ? sub.cellCenter(tcol, tr) : { x: fp.x + 100, y: fp.y }; }
    let idx = state.cards.hand.findIndex((h) => h.name === 'Rhizomorph Lance');
    if (idx < 0) { state.cards.hand.push({ id: state.cards.seq++, name: 'Rhizomorph Lance' }); idx = state.cards.hand.length - 1; }
    const before = net.nodes.length;
    resolveCardOp(playCard(state, idx, { x: target.x, y: target.y }));
    if (!state.won && net.nodes.length === before) {
      const dx = Math.sign(target.x - fp.x) || 1;
      net.digThrough(sub, fp.x + dx * sub.cellSize, (fp.y + target.y) / 2, ['boulder', 'formation', 'column', 'lakeBasin']);
      tickWorld(state); substrateRenderer.markDirty(); rendererFor(state.active).markStructureDirty();
      if (state.runOver) presentRunOver(); uiDirty = true;
    }
  }
  return { won: state.won, steps: guard, reachCol: Math.max(...net.nodes.map((n) => sub.colAtX(n.x))), goalStart };
}

// --- canvas interaction -----------------------------------------------------
function onCanvasClick(worldX, worldY) {
  const sel = ui.selectedAction;
  if (!sel) return;
  const a = ACTIONS[sel];
  if (a.target === 'point' || a.target === 'node') {
    const res = performAction(state, sel, { x: worldX, y: worldY });
    afterAction(sel, res);
    if (state.runOver || state.active.energy < 0) ui.setSelectedAction(null);
  }
}

function pointerSpread() {
  const p = [...pointers.values()];
  if (p.length < 2) return 0;
  return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
}
function pointerMid() {
  const p = [...pointers.values()];
  return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
}

// --- directional press-drag aiming -----------------------------------------
// The four "choose a direction" grows (Apical Drive, Rhizomorph Lance, Fruiting
// Vigil, Leading Cord) used to guess their start point from a single tap, which
// often grew from the wrong strand. Now the player presses to pick the start and
// drags to pick the direction; dragging too far cancels. beginAim/updateAim/fireAim
// own the whole gesture, drawAimLine shows it, and the engine's dirFrom starts the
// growth exactly at the pressed source (ctx.srcX/srcY).

// The currently-armed drag target, or null. For a hand card, ref is {id,name}; for
// an installed action, ref is its index into state.cards.actions.
function armedDragTarget() {
  if (ui.pendingCard && cardUsesDragAim(ui.pendingCard.name)) return { kind: 'card', ref: ui.pendingCard };
  if (ui.pendingAction != null && state.cards) {
    const a = state.cards.actions[ui.pendingAction];
    if (a && a.aim === 'drag') return { kind: 'action', ref: ui.pendingAction };
  }
  return null;
}

// Begin an aim if a directional grow is armed (no-op otherwise). The press point
// picks the SOURCE: growth starts from the living strand nearest it, snapped so the
// drawn line originates exactly where growth will.
function beginAim(e) {
  const t = armedDragTarget();
  if (!t) { aim = null; return; }
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const w = camera.screenToWorld(sx, sy);
  const src = (state.active && state.active.nearestNode(w.x, w.y)) || { x: w.x, y: w.y };
  // Press FAR from the colony → don't aim; let the gesture PAN the map instead (the
  // player repositions the view without having to cancel the armed card first). Only
  // a press near a living strand starts an aim, snapping the origin to that strand.
  const ss = camera.worldToScreen(src.x, src.y);
  if (Math.hypot(sx - ss.x, sy - ss.y) > AIM_NEAR_PX) { aim = null; return; }
  const reachRef = t.kind === 'card' ? t.ref.name : state.cards.actions[t.ref];
  aim = {
    kind: t.kind, ref: t.ref,
    origin: { x: src.x, y: src.y },   // world source, snapped to a strand
    cur: { x: w.x, y: w.y },          // world drag point
    startScreen: { x: sx, y: sy },
    curScreen: { x: sx, y: sy },
    reach: dragAimReach(state, reachRef),
    dragged: false, cancelled: false,
  };
  uiDirty = true;
}

// Track the drag point: refresh the end, and flag whether it's far enough to
// register a direction (dragged) or so far it should CANCEL (line vanishes).
function updateAim(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  aim.curScreen = { x: sx, y: sy };
  aim.cur = camera.screenToWorld(sx, sy);
  const d = Math.hypot(sx - aim.startScreen.x, sy - aim.startScreen.y);
  aim.dragged = d >= AIM_MIN_PX;
  aim.cancelled = d >= aimCancelPx();
  uiDirty = true;
}

// Commit a completed aim: grow from the pressed source toward the drag point.
// ctx.srcX/srcY tell the engine to start growth exactly where the player pressed.
function fireAim(a) {
  const ctx = { x: a.cur.x, y: a.cur.y, srcX: a.origin.x, srcY: a.origin.y };
  if (a.kind === 'card') {
    const idx = state.cards.hand.findIndex((h) => h.id === a.ref.id);
    ui.clearPendingCard();
    if (ui.clearPendingAction) ui.clearPendingAction();
    ui.resetHint();
    if (idx >= 0) resolveCardOp(playCard(state, idx, ctx));
  } else {
    const idx = a.ref;
    ui.clearPendingAction();
    ui.resetHint();
    const res = activateAction(state, idx, ctx);
    if (res && res.ok) {
      substrateRenderer.markDirty();
      rendererFor(state.active).markStructureDirty();
      if (state.runOver) presentRunOver();
    } else if (res && res.message) {
      ui.toast(res.message);
    }
    uiDirty = true;
  }
}

function setupInput() {
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      mouse.down = true; mouse.moved = false;
      mouse.startX = e.clientX; mouse.startY = e.clientY;
      mouse.x = e.clientX; mouse.y = e.clientY;
      beginAim(e);          // start a directional press-drag aim if one is armed
    } else if (pointers.size === 2) {
      pinchDist = pointerSpread();
      mouse.moved = true;   // a second finger cancels tap/pan…
      aim = null;           // …and any in-progress aim drag
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        // Pinch to zoom about the midpoint of the two fingers.
        const d = pointerSpread();
        if (pinchDist > 0 && d > 0) {
          const rect = canvas.getBoundingClientRect();
          const mid = pointerMid();
          camera.zoomAt(mid.x - rect.left, mid.y - rect.top, d / pinchDist);
        }
        pinchDist = d;
        return;
      }
    }
    // Always track the cursor (even on a plain hover with no button down) so the
    // targeting preview — e.g. the Amputate cut radius — follows the mouse.
    const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (aim && mouse.down) { updateAim(e); return; }   // aiming a directional grow — steer, don't pan
    if (mouse.down) {
      if (Math.abs(e.clientX - mouse.startX) + Math.abs(e.clientY - mouse.startY) > 4) mouse.moved = true;
      if (mouse.moved) camera.panByScreen(dx, dy);
    }
  });
  const endPointer = (e) => {
    const had = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (!had || pointers.size !== 0 || !mouse.down) return;
    mouse.down = false;
    // A directional aim owns this gesture: fire it, or abort (pointercancel, dragged
    // too far, or too short to point) and stay armed so the player can try again.
    if (aim) {
      const a = aim; aim = null;
      if (e.type === 'pointercancel' || a.cancelled || !a.dragged) { uiDirty = true; return; }
      fireAim(a);
      return;
    }
    if (mouse.moved) return;
    // A directional drag-aim card/action is armed but this was a plain tap that never
    // started an aim (pressed too far from the colony — a pan intent that didn't move).
    // Do nothing and stay armed; the press-drag gesture is the only way to play it, so
    // a stray tap must NOT fall through to the single-tap play path below.
    if (armedDragTarget()) return;
    const rect = canvas.getBoundingClientRect();
    if (placingWorm) {
      // Dev placement: each tap drops a worm where you click (mode stays on).
      const w = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      spawnNematodeAt(state, w.x, w.y);
      state.log('DEV: placed a nematode.', 'dev');
      uiDirty = true;
      return;
    }
    // A card is awaiting a map target: this tap supplies it.
    if (ui.pendingCard) {
      const w = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const idx = state.cards.hand.findIndex((h) => h.id === ui.pendingCard.id);
      ui.clearPendingCard();
      if (ui.clearPendingAction) ui.clearPendingAction();   // never leave an action aim stranded
      if (idx >= 0) resolveCardOp(playCard(state, idx, { x: w.x, y: w.y }));
      return;
    }
    // A targeted installed action (Actions menu) is awaiting its point: apply it.
    if (ui.pendingAction != null) {
      const w = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const idx = ui.pendingAction;
      ui.clearPendingAction();
      ui.resetHint();
      const res = activateAction(state, idx, { x: w.x, y: w.y });
      if (res && res.ok) {
        substrateRenderer.markDirty();
        rendererFor(state.active).markStructureDirty();
        if (state.runOver) presentRunOver();
      } else if (res && res.message) {
        ui.toast(res.message);
      }
      uiDirty = true;
      return;
    }
    if (!ui.selectedAction) {
      // Tap a worm / mould cloud to toggle its sight ring; a food pile to float its
      // current energy value; tap empty map to hide all sight rings.
      if (inspectVisionAt(e.clientX - rect.left, e.clientY - rect.top)) return;
      if (showPileEnergyAt(e.clientX - rect.left, e.clientY - rect.top)) return;
      clearSightRings();
      // In navigation mode a double-tap reframes the network (mobile 'F').
      const now = Date.now();
      if (now - lastTapTime < 320 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) {
        camera.fitBounds(expandedBounds(), 120);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now; lastTapX = e.clientX; lastTapY = e.clientY;
      return;
    }
    const w = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    onCanvasClick(w.x, w.y);
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') { aim = null; ui.setSelectedAction(null); ui.clearPendingCard(); if (ui.clearPendingAction) ui.clearPendingAction(); if (ui.clearArmed) ui.clearArmed(); ui.resetHint(); placingWorm = false; uiDirty = true; }
    else if (e.code === 'KeyF') { camera.fitBounds(expandedBounds(), 120); }
  });

  window.addEventListener('resize', resize);
}

// Device-pixel ratio for the game canvas, CAPPED at 2. Per-frame fill work (the
// full-canvas lighting composites, big fills, blurs) scales with device-pixel COUNT,
// so a 3× phone rendering at 3× does ~2.25× the pixel work of 2× for no visible gain.
// Capping at 2 nearly halves per-frame fill cost on high-DPR phones (biggest win when
// zoomed out, where the whole canvas is filled); desktops (DPR 1–2) are unaffected.
const RENDER_DPR_CAP = 2;
function renderDpr() { return Math.min(RENDER_DPR_CAP, window.devicePixelRatio || 1); }

function resize() {
  const dpr = renderDpr();
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.setViewport(window.innerWidth, window.innerHeight);
}

// --- render loop ------------------------------------------------------------
// The loop is CRASH-PROOF: renderFrame() does all the drawing; frame() wraps it
// so a single throwing frame can't kill requestAnimationFrame and freeze the game
// with a half-drawn canvas (the symptom we chased). A bad frame is logged once
// (console + in-game Log) and the loop keeps animating.
let _lastFrameErr = null;
function frame(time) {
  // The species picker runs before the first run is created; there's nothing to
  // render until then, so idle the loop (keeps requesting frames) while state is null.
  if (!state) { requestAnimationFrame(frame); return; }
  try {
    renderFrame(time);
  } catch (e) {
    const sig = (e && (e.stack || e.message)) || String(e);
    if (sig !== _lastFrameErr) {
      _lastFrameErr = sig;
      console.error('[frame] render error (loop kept alive):', e);
      try { if (state && state.log) state.log('Render hiccup (recovered): ' + ((e && e.message) || e), 'warn'); } catch (_) {}
    }
  }
  requestAnimationFrame(frame);
}

function renderFrame(time) {
  lastTime = time;
  updateCamFocus(time);         // advance the tutorial's smooth camera "zoom-in" tween
  updateDraftIntro(time);       // advance the food-pile → card-draft intro (sets ghost/icon alphas)
  spawnFinishFloaters();        // pop a "+N⚡" the instant a pile finishes digesting
  // background (outside the world bounds)
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  substrateRenderer.draw(ctx, camera, time);
  drawMoon();                   // luminous moon high in the twilight sky
  drawGoalBackdrop();           // summery green hill band behind the goal (far backdrop)
  drawTerrainAssets();          // optional image-based textures over the earth (gated)
  drawSubstrateLeaves();        // food piles rendered as heaped leaves (gated) — UNDER rocks
  solidifyRock();               // one-shot: make every visible rock sprite (boulder/formation/column) block growth
  drawRockPiles();              // lone boulders (gated) — over food/earth
  drawRockFormations();         // large AI rock-formation sprites (gated) — over food/earth, embedded in soil
  drawRockColumns();            // path-blocking vertical rock columns (gated) — barriers from the surface down
  drawLakes();                  // lake basins (matted) — over rocks so a boulder can't spill into the water
  drawMountains();              // mountain barriers rendered as a sprite over the wall (gated)
  drawCities();                 // city skylines over the concrete barriers (gated)
  drawSurfaceProps();           // optional above-ground sprites: trees/grass/houses (gated)
  drawGoalProps();              // summery bush clusters on the goal soil (over the hill backdrop)

  for (const net of state.networks) {
    rendererFor(net).draw(ctx, camera, time);
    if (net.fruited && net.fruitPoints.length) drawFruitBodies(ctx, camera, net.fruitPoints, time, false);
  }

  // Fruit preview (where would it fruit?) — uses the cache from hover-start.
  if (previewFruit && !state.runOver) {
    drawFruitBodies(ctx, camera, previewFruitPoints, time, true);
  }

  // Dynamic lighting: dim the earth, then add the colony's glow back in. The settings
  // toggle controls ONLY the sensing-range aura (the soft glow at the colony's sensing
  // frontier) — the ambient darkening, colony glow and hazard glow always stay, so the
  // overall look is unchanged when it's off.
  lighting.senseAura = sensingLightOn;
  lighting.compose(ctx, camera, state, networkRenderers, substrateRenderer, time);

  // Atmosphere drifts on top of the lighting so spores read as bright motes.
  substrateRenderer.drawAtmosphere(ctx, camera, time);

  drawChest(time);
  drawCloudSight();
  drawAnts(time);
  drawNematodes(time);
  drawTraps(time);
  drawTargetingCursor(time);
  drawFloaters(time);           // floating "+N⚡" energy labels over piles (on top of the map)

  if (uiDirty) { ui.update(); uiDirty = false; }

  // Tutorial overlay: advance any forced-step gate + keep its rings/arrows glued to
  // their targets. Runs AFTER ui.update() so the hand DOM it points at is current.
  if (tutorial && tutorial.active) tutorial.tick(time);

  // The scene is now fully drawn this frame — fade it in (once) if a reveal is due.
  // Doing it here (not on asset load) guarantees we never fade in a blank canvas,
  // e.g. on a warm-cache refresh where assets resolve before the first frame draws.
  if (_revealPending) { _revealPending = false; revealMap(); }
}

// Constricting Ring traps — a pulsing phosphorus ring on the ground marking where
// a snare is set (the next nematode to enter it is digested).
function drawTraps(time) {
  const traps = state.traps;
  if (!traps || !traps.length) return;
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.005);
  for (const tr of traps) {
    const s = camera.worldToScreen(tr.x, tr.y);
    const r = tr.r * camera.zoom;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(199,155,230,${0.55 + 0.35 * pulse})`;   // phosphorus violet
    ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(199,155,230,${0.10 + 0.08 * pulse})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// Puzzle mode: the treasure chest goal. Made deliberately easy to find — a
// pulsing glow + a light beacon rising to the surface, a minimum on-screen size
// so it never shrinks away when zoomed out, and an edge arrow when off-screen.
function drawChest(time) {
  if (!state.chest) return;
  const W = window.innerWidth, H = window.innerHeight;
  const s = camera.worldToScreen(state.chest.x, state.chest.y);
  const z = camera.zoom;
  const pulse = 0.75 + 0.25 * Math.sin(time * 0.004);

  // Off-screen? Draw a gold arrow at the screen edge pointing to it.
  if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) {
    const cx = Math.max(28, Math.min(W - 28, s.x));
    const cy = Math.max(28, Math.min(H - 28, s.y));
    const ang = Math.atan2(s.y - cy, s.x - cx);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = `rgba(255,210,90,${0.85 * pulse})`;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  // light beacon rising to the surface — visible from across the map
  const surfY = camera.worldToScreen(state.chest.x, state.substrate.surfaceY).y;
  const beam = ctx.createLinearGradient(0, surfY - 40, 0, s.y);
  beam.addColorStop(0, 'rgba(255,220,120,0)');
  beam.addColorStop(1, `rgba(255,220,120,${0.18 * pulse})`);
  ctx.fillStyle = beam;
  const bw = Math.max(12, 20 * z);
  ctx.fillRect(s.x - bw / 2, surfY - 40, bw, s.y - (surfY - 40));

  // pulsing glow
  const R = Math.max(48, state.chest.r * z) * (0.9 + 0.25 * pulse);
  const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
  gr.addColorStop(0, 'rgba(255,210,90,0.6)');
  gr.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.fill();

  // chest — minimum on-screen size so it stays visible when zoomed out
  const sc = Math.max(1, z);
  const w = 32 * sc, h = 24 * sc;
  ctx.translate(s.x, s.y);
  ctx.lineWidth = Math.max(1.5, 2 * sc);
  ctx.fillStyle = '#7a4e22'; ctx.strokeStyle = '#2c1a0c';
  ctx.fillRect(-w / 2, -h / 2 + h * 0.35, w, h * 0.65);
  ctx.strokeRect(-w / 2, -h / 2 + h * 0.35, w, h * 0.65);
  ctx.fillStyle = '#9a6a30';                       // lid
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.4);
  ctx.strokeRect(-w / 2, -h / 2, w, h * 0.4);
  ctx.fillStyle = '#ffd45a';                       // gold band + lock
  ctx.fillRect(-2.5 * sc, -h / 2, 5 * sc, h);
  ctx.beginPath(); ctx.arc(0, -h * 0.05, 3 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Draw a creature's sight range as a soft glow, CLIPPED to what it can actually
// SEE: rays that hit rock stop at the rock face (Substrate.visionPolygon), so
// the glow never bleeds through a boulder — the visible shape ends where the
// rock does. A faint even wash makes the seen shape (and its rock-cut edges)
// legible; a soft rim near the sight radius marks the range. `rgb` is "r,g,b".
function drawOccludedSight(wx, wy, radiusWorld, rgb, edgeA) {
  const poly = state.substrate.visionPolygon(wx, wy, radiusWorld);
  if (!poly || !poly.length) return;
  const sight = radiusWorld * camera.zoom;
  const s = camera.worldToScreen(wx, wy);
  ctx.save();
  // Clip to the visibility polygon so nothing paints past the rock.
  ctx.beginPath();
  const p0 = camera.worldToScreen(poly[0].x, poly[0].y);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < poly.length; i++) {
    const p = camera.worldToScreen(poly[i].x, poly[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.clip();
  // Faint even wash over the seen area…
  ctx.fillStyle = `rgba(${rgb},${edgeA * 0.32})`;
  ctx.fillRect(s.x - sight, s.y - sight, sight * 2, sight * 2);
  // …plus the original soft rim near the sight edge.
  const g = ctx.createRadialGradient(s.x, s.y, sight * 0.78, s.x, s.y, sight);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(1, `rgba(${rgb},${edgeA})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s.x, s.y, sight, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Show each roaming mould cloud's sight range — the area within which it will
// sense and head for food / your colony, occluded by rock (it can't see past a
// boulder). A soft greenish glow, clipped to the visible shape.
function drawCloudSight() {
  const clouds = state.clouds;
  if (!clouds || !clouds.length) return;
  const sight = state.config.trichoderma.sightRadius;
  for (const c of clouds) {
    if (!c.showSight) continue;                       // only when the player has tapped this cloud
    drawOccludedSight(c.cx, c.cy, sight, '150,190,70', c.dying ? 0.05 : 0.10);
  }
}

// Tap a worm or mould cloud to TOGGLE its sight-range ring (so the player can
// check how far it can see); tap it again to hide. Returns true if one was hit.
function inspectVisionAt(sx, sy) {
  let best = null, bestD = 28 * 28;                   // tap tolerance², px
  const consider = (obj, wx, wy) => {
    const s = camera.worldToScreen(wx, wy);
    const d = (s.x - sx) * (s.x - sx) + (s.y - sy) * (s.y - sy);
    if (d < bestD) { bestD = d; best = obj; }
  };
  for (const w of (state.nematodes || [])) consider(w, w.x, w.y);
  for (const c of (state.clouds || [])) consider(c, c.cx, c.cy);
  if (!best) return false;
  best.showSight = !best.showSight;
  return true;
}

// Hide every sight ring — used when the player taps empty map.
function clearSightRings() {
  for (const w of (state.nematodes || [])) w.showSight = false;
  for (const c of (state.clouds || [])) c.showSight = false;
}

// --- Ant rendering helpers --------------------------------------------------

// Tiny deterministic PRNG so a nest's dug-out colony + ant placement stay
// STABLE every frame (no flicker) yet differ between nests.
function antRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Colony sprite width as a multiple of the substrate cell size (world units).
const COLONY_W_CELLS = 0.85;
// The sprites are higher-res and brighter than the procedural environment, so
// they pop out. Dim + slightly desaturate + soften them so they sit into the
// earth instead of reading as pasted-on photos.
const COLONY_FILTER = 'brightness(0.68) saturate(0.82) blur(0.7px)';

// Pick which colony sprite a nest uses. Two hand-picked variants (A/B) are
// distributed deterministically by column so a nest keeps the same art every
// frame; falls back gracefully if only one (or neither) variant is present.
function colonyKey(nest) {
  const variants = ['antColonyA', 'antColonyB'].filter(hasAsset);
  if (!variants.length) return null;
  return variants[(nest.col >>> 0) % variants.length];
}

// Screen-space bounds of a nest's colony sprite (anchored at the surface
// entrance, extending down). Returns null if no sprite variant is present.
function colonyBounds(nest, sub) {
  const key = colonyKey(nest);
  if (!key) return null;
  const img = asset(key);
  const w = sub.cellSize * COLONY_W_CELLS * camera.zoom;
  const h = w * (img.height / img.width);
  const top = camera.worldToScreen(nest.x, nest.y);
  return { key, img, w, h, x: top.x - w / 2, y: top.y };
}

// The underground colony layout (a formicarium cross-section): chambers strung
// down from the surface entrance by tunnels. World coords, deterministic from
// the nest's column so it's the same shape each frame.
function nestLayout(nest, sub) {
  const cs = sub.cellSize;
  const rnd = antRand(nest.col * 2654435761 + 17);
  const nx = nest.x, ny = nest.y;
  const chambers = [];
  const tunnels = [];
  let prevX = nx, prevY = ny;
  let y = ny + cs * 0.8;
  const count = 3 + Math.floor(rnd() * 2);          // 3–4 chambers deep
  for (let i = 0; i < count; i++) {
    const x = nx + (rnd() * 2 - 1) * cs * (0.9 - i * 0.05);   // weave side to side
    const r = cs * (0.42 + rnd() * 0.4);
    chambers.push({ x, y, r, eggs: Math.floor(rnd() * 4), ants: 1 + Math.floor(rnd() * 3), seed: nest.col * 131 + i * 977 });
    tunnels.push({ x1: prevX, y1: prevY, x2: x, y2: y });
    prevX = x; prevY = y;
    y += cs * (0.85 + rnd() * 0.65);
  }
  return { chambers, tunnels };
}

// Draw one ant as a 3-segment body (gaster · thorax · head) oriented along
// `ang`, with legs + antennae when it's large enough to read. Screen coords.
function drawAnt(g, x, y, ang, scale, dim) {
  const dx = Math.cos(ang), dy = Math.sin(ang);   // forward
  const px = -dy, py = dx;                         // perpendicular
  const seg = scale * 1.05;
  const body = `rgba(${(38 * dim) | 0},${(22 * dim) | 0},${(12 * dim) | 0},0.97)`;
  const head = `rgba(${(64 * dim) | 0},${(38 * dim) | 0},${(20 * dim) | 0},0.98)`;
  const hx = x + dx * seg, hy = y + dy * seg;      // head (front)
  const gx = x - dx * seg, gy = y - dy * seg;      // gaster (rear)

  if (scale >= 1.7) {
    g.strokeStyle = body;
    g.lineWidth = Math.max(0.5, scale * 0.16);
    for (let i = -1; i <= 1; i++) {                // three leg pairs off the thorax
      const lx = x + dx * seg * i * 0.55, ly = y + dy * seg * i * 0.55;
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + px * seg * 1.25 + dx * seg * 0.25, ly + py * seg * 1.25 + dy * seg * 0.25); g.stroke();
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx - px * seg * 1.25 + dx * seg * 0.25, ly - py * seg * 1.25 + dy * seg * 0.25); g.stroke();
    }
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + dx * seg * 0.7 + px * seg * 0.45, hy + dy * seg * 0.7 + py * seg * 0.45); g.stroke();
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + dx * seg * 0.7 - px * seg * 0.45, hy + dy * seg * 0.7 - py * seg * 0.45); g.stroke();
  }

  g.fillStyle = body;
  g.beginPath(); g.ellipse(gx, gy, scale * 0.95, scale * 0.78, ang, 0, Math.PI * 2); g.fill();   // gaster
  g.beginPath(); g.ellipse(x, y, scale * 0.58, scale * 0.48, ang, 0, Math.PI * 2); g.fill();      // thorax
  g.fillStyle = head;
  g.beginPath(); g.ellipse(hx, hy, scale * 0.58, scale * 0.52, ang, 0, Math.PI * 2); g.fill();    // head
}

// Build a gently-weaving centreline (world coords) from the trail's path cells,
// tapering the wiggle to 0 at both ends. Returns sampled points + total length.
function weaveTrail(path, sub, amp, wavelen, phase) {
  const base = path.map((p) => sub.cellCenter(p.col, p.row));
  const cum = [0];
  for (let i = 1; i < base.length; i++) cum[i] = cum[i - 1] + Math.hypot(base[i].x - base[i - 1].x, base[i].y - base[i - 1].y);
  const total = cum[base.length - 1] || 1;
  const cs = sub.cellSize;
  const pts = [];
  for (let i = 0; i < base.length - 1; i++) {
    const a = base[i], b = base[i + 1];
    const segLen = (cum[i + 1] - cum[i]) || 1;
    const px = -(b.y - a.y) / segLen, py = (b.x - a.x) / segLen;
    const steps = Math.max(2, Math.ceil(segLen / (cs * 0.33)));
    for (let k = 0; k < steps; k++) {
      const f = k / steps;
      const ss = cum[i] + segLen * f;
      const taper = Math.max(0, Math.min(1, ss / (cs * 1.3), (total - ss) / (cs * 1.3)));
      const off = Math.sin(ss / wavelen + phase) * amp * taper;
      const baseX = a.x + (b.x - a.x) * f, baseY = a.y + (b.y - a.y) * f;
      let wx = baseX + px * off, wy = baseY + py * off;
      const wc = sub.cellAtWorld(wx, wy);              // never weave the trail onto a rock cell
      if (wc && wc.rock) { wx = baseX; wy = baseY; }   // fall back to the (rock-free) path centreline
      pts.push({ x: wx, y: wy, s: ss });
    }
  }
  pts.push({ x: base[base.length - 1].x, y: base[base.length - 1].y, s: total });
  return { pts, len: total };
}

// Point + heading at arc-length L along a weaved centreline.
function sampleTrail(pts, L) {
  L = Math.max(0, Math.min(pts[pts.length - 1].s, L));
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].s < L) i++;
  const a = pts[i], b = pts[i + 1];
  const span = (b.s - a.s) || 1, f = (L - a.s) / span;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: Math.atan2(b.y - a.y, b.x - a.x) };
}

// Ants: each nest is a dug-out underground colony (chambers + tunnels from the
// surface) running an impassable trail of marching ants to its target food.
// The trail weaves like a real ant line, with two opposing lanes of traffic.
// A dormant nest (no reachable food) is dimmed; an HP bar shows bombs remaining.
function drawAnts(time) {
  const ants = state.ants;
  if (!ants || !ants.length) return;
  const sub = state.substrate;
  const z = camera.zoom;
  const cs = sub.cellSize;
  ctx.save();
  ctx.lineCap = 'round';
  for (const nest of ants) {
    const dim = nest.dormant ? 0.6 : 1;
    const path = nest.path || [];

    // === the marching trail (drawn first, beneath the colony) ===
    if (path.length >= 2) {
      const weave = weaveTrail(path, sub, cs * 0.32, cs * 2.1, nest.col * 0.7);
      // faint pheromone trace so the impassable route still reads as a barrier
      ctx.strokeStyle = nest.dormant ? 'rgba(110,85,55,0.12)' : 'rgba(74,50,28,0.22)';
      ctx.lineWidth = Math.max(1.5, 3 * z);
      ctx.beginPath();
      for (let i = 0; i < weave.pts.length; i++) {
        const sp = camera.worldToScreen(weave.pts[i].x, weave.pts[i].y);
        if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();

      if (!nest.dormant) {
        const count = Math.min(28, Math.max(4, Math.round(weave.len / (cs * 0.95))));
        const laneGap = cs * 0.15;
        const flow = (time * 0.001) * (cs * 1.7) / weave.len;   // fraction/sec along trail
        for (let i = 0; i < count; i++) {
          const lane = (i % 2) ? -1 : 1;                         // +1 to food, -1 returning
          const j = (i * 0.6180339887) % 1;                      // even golden-ratio spread
          const u = lane > 0 ? (j + flow) % 1 : ((j - flow) % 1 + 1) % 1;
          const sa = sampleTrail(weave.pts, u * weave.len);
          const off = laneGap * lane;
          let ax = sa.x - Math.sin(sa.ang) * off, ay = sa.y + Math.cos(sa.ang) * off;
          const ac = sub.cellAtWorld(ax, ay);              // keep the ant off rock cells
          if (ac && ac.rock) { ax = sa.x; ay = sa.y; }      // drop the lane offset rather than walk onto rock
          const sp = camera.worldToScreen(ax, ay);
          drawAnt(ctx, sp.x, sp.y, lane > 0 ? sa.ang : sa.ang + Math.PI, Math.max(1.6, 2.3 * z), 1);
        }
      }
    }

    // === the underground colony ===
    const colony = colonyBounds(nest, sub);
    if (colony) {
      // Image-based nest burrow, anchored at the surface and extending down.
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.filter = COLONY_FILTER;   // dim + soften so it blends with the earth
      ctx.drawImage(colony.img, colony.x, colony.y, colony.w, colony.h);
      ctx.restore();
    } else {
      const lay = nestLayout(nest, sub);
      // 1) loose excavated-soil halo behind tunnels + chambers
      ctx.strokeStyle = `rgba(${(120 * dim) | 0},${(88 * dim) | 0},${(52 * dim) | 0},0.5)`;
      for (const t of lay.tunnels) {
        const a = camera.worldToScreen(t.x1, t.y1), b = camera.worldToScreen(t.x2, t.y2);
        ctx.lineWidth = Math.max(5, 9 * z);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const ch of lay.chambers) {
        const c = camera.worldToScreen(ch.x, ch.y);
        const R = ch.r * z * 1.5;
        const halo = ctx.createRadialGradient(c.x, c.y, R * 0.25, c.x, c.y, R);
        halo.addColorStop(0, `rgba(${(122 * dim) | 0},${(90 * dim) | 0},${(54 * dim) | 0},0.55)`);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill();
      }
      // 2) hollow interiors (the open dug-out tunnels + chambers)
      ctx.strokeStyle = `rgba(${(22 * dim) | 0},${(14 * dim) | 0},${(8 * dim) | 0},0.92)`;
      for (const t of lay.tunnels) {
        const a = camera.worldToScreen(t.x1, t.y1), b = camera.worldToScreen(t.x2, t.y2);
        ctx.lineWidth = Math.max(2, 4 * z);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const ch of lay.chambers) {
        const c = camera.worldToScreen(ch.x, ch.y);
        const R = ch.r * z;
        ctx.fillStyle = `rgba(${(24 * dim) | 0},${(15 * dim) | 0},${(8 * dim) | 0},0.95)`;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, R, R * 0.82, 0, 0, Math.PI * 2); ctx.fill();
        // 3) chamber contents — pale eggs + a few resident ants
        const rnd = antRand(ch.seed);
        ctx.fillStyle = `rgba(${(238 * dim) | 0},${(228 * dim) | 0},${(200 * dim) | 0},0.9)`;
        for (let e = 0; e < ch.eggs; e++) {
          const ex = c.x + (rnd() * 2 - 1) * R * 0.55, ey = c.y + (rnd() * 2 - 1) * R * 0.4;
          ctx.beginPath(); ctx.ellipse(ex, ey, Math.max(1, 1.5 * z), Math.max(1.5, 2.5 * z), 0.5, 0, Math.PI * 2); ctx.fill();
        }
        for (let aI = 0; aI < ch.ants; aI++) {
          const ax = c.x + (rnd() * 2 - 1) * R * 0.6, ay = c.y + (rnd() * 2 - 1) * R * 0.5;
          drawAnt(ctx, ax, ay, rnd() * Math.PI * 2, Math.max(1.5, 2.1 * z), dim);
        }
      }
    }
    // 4) surface entrance hole
    const ent = camera.worldToScreen(nest.x, nest.y);
    ctx.fillStyle = `rgba(${(14 * dim) | 0},${(8 * dim) | 0},${(4 * dim) | 0},0.92)`;
    ctx.beginPath(); ctx.ellipse(ent.x, ent.y, Math.max(4, 6 * z), Math.max(2, 3.2 * z), 0, 0, Math.PI * 2); ctx.fill();

    // (No HP bar — nest health is intentionally not surfaced.)
  }
  ctx.restore();
}

// Optional image-based terrain textures (art pipeline). World-anchored and
// zoom-scaled so they sit on the earth; gated on the asset being present, so
// with no assets the game keeps its procedural look.
function drawTerrainAssets() {
  const sub = state.substrate, z = camera.zoom;
  const tl = camera.worldToScreen(0, sub.surfaceY);
  const br = camera.worldToScreen(sub.worldWidth, sub.worldHeight);
  const cover = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };

  if (hasAsset('soil')) fillPatternWorld('soil', null, cover, 0.5);
}

// Substrate food = heaped sprites, keyed to what the pile IS:
//   • MAP caches (foodKind 'cache') → heaped ORANGE oak/maple LEAVES — wild litter
//     that grants a Basic/Event card draft when fully digested.
//   • ENGINE caches (foodKind 'cache-engine') → RED autumn leaves — draft an Engine.
//   • DUFF caches (foodKind 'duff') → mostly YELLOW/golden autumn leaves (their own
//     sprite set) so they lift off the brown soil, with a few pieces tinted mid-brown
//     and a couple of dark-brown ones (a dedicated dark leaf) mixed in; a smaller/
//     flatter heap: energy only, NO draft. (Was the orange leaves tinted brown, which
//     melted into the brown background.)
//   • PLAYER-placed food (foodKind 'nut') → a small scatter of ACORNS, CHESTNUTS
//     and PINE CONES — a humble lower-tier cache that only yields energy.
// The pile SHRINKS as the cell is digested (fewer pieces); every piece's
// position/size/type is hashed from (col,row,k) so the heap is stable across
// frames and digestion peels pieces off the top. Nuts are drawn smaller, sparser
// and slightly muted so they nestle into the soil instead of sitting on top.
const RED_LEAF_KEYS = ['leafRedMaple', 'leafRedOak', 'leafRedSweetgum', 'leafRedJapanese', 'leafRedDogwood', 'leafRedBeech'];
// DUFF piles: the yellowest leaf set (the owner's top-row pick) — reads clearly
// yellow against the brown soil and distinct from the orange cache piles.
const YELLOW_LEAF_KEYS = ['leafYellowHophornbeam', 'leafYellowSassafras', 'leafYellowMulberry', 'leafYellowRedbud', 'leafYellowSycamore'];
function _leafSets() {
  const oak = asset('leafOak'), maple = asset('leafMaple');
  const acorn = asset('acorn'), chestnut = asset('chestnut'), pinecone = asset('pinecone');
  const leaves = (oak || maple) ? [oak || maple, maple || oak] : null;
  // ENGINE caches: a mix drawn from ALL SIX red/autumn leaves so each pile reads
  // as its own varied red litter (the heap picks a leaf per piece from this set).
  const red = RED_LEAF_KEYS.map(asset).filter(Boolean);
  // DUFF caches: the yellow leaf set (see YELLOW_LEAF_KEYS).
  const yellow = YELLOW_LEAF_KEYS.map(asset).filter(Boolean);
  const nutSet = [acorn, chestnut, pinecone].filter(Boolean);
  return { leaves, red: red.length ? red : null, yellow: yellow.length ? yellow : null, nuts: nutSet.length ? nutSet : null };
}

// Draw one cell's heaped pile of leaf/nut sprites at `alphaMul` opacity. The
// arrangement is FIXED — a constant piece count and a bias taken from the pile's
// ORIGINAL footprint (maxNutrient), NOT the live nutrient — so a pile never
// changes shape or rearranges as it's eaten. It simply fades (via alphaMul) once
// consumed. Deterministic per (col,row) so a cell's heap is stable frame-to-frame.
function _drawLeafHeap(sets, col, row, kind, alphaMul) {
  const isNut = kind === 'nut';
  const isDuff = kind === 'duff';
  // 'cache-engine' → red litter (fall back to normal leaves if red art missing);
  // 'nut' → acorn/chestnut scatter; 'duff' → the YELLOW/gold set (a few pieces tinted
  // brown below); 'cache' (or anything else) → orange leaves.
  const set = isNut ? sets.nuts
    : kind === 'cache-engine' ? (sets.red || sets.leaves)
    : isDuff ? (sets.yellow || sets.leaves)
    : sets.leaves;
  if (!set) return;                            // this pile's sprites not loaded
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const margin = cs * 1.6 * z;
  const ctr = sub.cellCenter(col, row);
  const s = camera.worldToScreen(ctr.x, ctr.y);
  if (s.x < -margin || s.x > camera.viewW + margin || s.y < -margin || s.y > camera.viewH + margin) return;
  const count = isNut ? 8 : isDuff ? 9 : 11;   // FIXED piece count — duff reads as a slightly thinner heap; never drops pieces as it drains
  const base = cs * (isNut ? 0.26 : isDuff ? 0.52 : 0.64);  // …smaller pieces for nuts + duff, so they read as lower-value
  // Pull this cell's pieces toward the local food centroid so a cluster reads as
  // ONE heaped pile (not a cross of separate cells), keyed off the ORIGINAL
  // footprint so the arrangement stays put while neighbours drain.
  let bx = 0, by = 0;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const nb = sub.cellAt(col + dc, row + dr);
    if (nb && nb.maxNutrient > 0) { bx += dc; by += dr; }
  }
  const bl = Math.hypot(bx, by);
  const biasX = bl ? (bx / bl) * cs * 0.55 * z : 0;
  const biasY = bl ? (by / bl) * cs * 0.55 * z : 0;
  for (let k = 0; k < count; k++) {
    const h1 = _hashf(col * 7.1 + k * 13.3, row * 11.7 + k * 5.2);
    const h2 = _hashf(col * 3.3 + k * 17.1, row * 19.3 + k * 7.7);
    const h3 = _hashf(col * 23.7 + k * 2.1, row * 29.1 + k * 3.3);
    const pick = _hashf(col * 5.9 + k * 3.7, row * 8.3 + k * 9.1);
    let img = set[Math.min(set.length - 1, Math.floor(pick * set.length))];
    if (!img) continue;
    // Per-piece look. Duff is PURELY yellow/gold (the leaves are already gold, drawn
    // from YELLOW_LEAF_KEYS) — the earlier brown/dark-brown mix was removed so the heap
    // reads clearly against the brown soil. Nuts are muted + slightly translucent.
    let filter = null, alpha = isNut ? 0.9 : 1;
    if (isNut) filter = 'brightness(0.9) saturate(0.82) contrast(0.9)';
    else if (isDuff) {                  // DUFF = purely YELLOW/gold leaves (no brown/grey mixed in)
      alpha = 0.96;
      filter = 'saturate(1.08) brightness(1.03)';   // keep the gold vivid against the brown soil
    }
    const lh = base * (0.7 + h1 * 0.6) * z;
    const lw = lh * (img.width / img.height);
    const ox = (h1 * 2 - 1) * cs * 0.3 * z + biasX, oy = (h2 * 2 - 1) * cs * 0.28 * z + biasY;
    ctx.save();
    ctx.translate(s.x + ox, s.y + oy);
    // leaves scatter every which way; nuts mostly sit upright (a slight tilt).
    ctx.rotate(isNut ? (h3 - 0.5) * 1.1 : h3 * Math.PI * 2);
    ctx.globalAlpha = alpha * alphaMul;
    if (filter) ctx.filter = filter;
    ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
  }
}

// =============================================================================
// FLOATING ENERGY LABELS ("+43⚡") — over food piles
// =============================================================================
// Queue a floating energy label at a world point. `sign` ('' or '+') and `dur`/`rise`
// tune the look; it rises `rise` px over its life and fades out.
function addEnergyFloater(wx, wy, amount, opts = {}) {
  const amt = Math.max(0, Math.round(amount || 0));
  if (amt <= 0) return;
  // `age` counts UP each frame (frame-based, not wall-clock) so an erratic rAF
  // timestamp can never skip or freeze the animation; it fades over `life` frames.
  floaters.push({ x: wx, y: wy, amount: amt, sign: opts.sign || '', age: 0, life: opts.life || 80, rise: opts.rise != null ? opts.rise : 30, size: opts.size || 13 });
}

// A pile "+N⚡" pops the instant it finishes digesting (checkPileRewards stamped
// pile.finishEnergy + pile.center), slightly ABOVE the pile so it clears the rising
// draft glyph. `pile._floated` guards against re-spawning it every frame.
function spawnFinishFloaters() {
  const sub = state.substrate; if (!sub || !sub.foodPiles) return;
  for (const p of sub.foodPiles) {
    if (p._floated || p.finishEnergy == null || !p.center) continue;
    p._floated = true;
    if (p.finishEnergy > 0) addEnergyFloater(p.center.x, p.center.y - sub.cellSize * 1.4, p.finishEnergy, { sign: '+', rise: 30, size: 14 });
  }
}

// Tap → the CURRENT energy value of the food pile under the tap (remaining nutrient ×
// each cell's own energy-per-nutrient rate — a map pile totals its fixed 1..8 value),
// floated over the pile. Returns true if a pile was hit.
function showPileEnergyAt(sx, sy) {
  const sub = state.substrate;
  const w = camera.screenToWorld(sx, sy);
  const eff = state.config.energy.incomeEfficiency || 0;
  const tol = sub.cellSize * 1.3;
  // nearest food cell within a forgiving tap tolerance
  let best = null, bestD = tol * tol;
  sub.cellsInRadius(w.x, w.y, tol, (cell, col, row, ctr) => {
    if (cell.rock || cell.maxNutrient <= 0) return;
    const d = (ctr.x - w.x) ** 2 + (ctr.y - w.y) ** 2;
    if (d < bestD) { bestD = d; best = { col, row }; }
  });
  if (!best) return false;
  const idx = sub.index(best.col, best.row);
  const pile = (sub.foodPiles || []).find((p) => p.cells.includes(idx));
  const cellIdxs = pile ? pile.cells : floodFoodCells(sub, best.col, best.row);
  let energy = 0, cx = 0, cy = 0, n = 0;
  for (const ci of cellIdxs) {
    const c = sub.cells[ci]; if (!c || c.nutrient <= 0) continue;
    energy += c.nutrient * (c.energyPerNutrient != null ? c.energyPerNutrient : eff);
    const cc = sub.cellCenter(ci % sub.cols, Math.floor(ci / sub.cols));
    cx += cc.x; cy += cc.y; n++;
  }
  if (!n) return false;
  addEnergyFloater(cx / n, cy / n - sub.cellSize * 0.6, energy, { rise: 26, size: 14 });
  return true;
}

// BFS the connected blob of food cells (maxNutrient > 0) around a cell — for loose
// player-placed caches that aren't a registered foodPile.
function floodFoodCells(sub, col0, row0) {
  const start = sub.index(col0, row0);
  const seen = new Set([start]); const out = [start]; const q = [[col0, row0]];
  while (q.length) {
    const [c, r] = q.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr; const cell = sub.cellAt(nc, nr);
      if (!cell || cell.maxNutrient <= 0) continue;
      const i = sub.index(nc, nr);
      if (seen.has(i)) continue;
      seen.add(i); out.push(i); q.push([nc, nr]);
    }
  }
  return out;
}

// Draw + age the floating energy labels (screen space, on top of the map). Pins the
// base device-pixel transform + source-over compositing so a prior world-space /
// 'lighter' pass can't fling the text off-screen or composite it away.
function drawFloaters(time) {
  if (!floaters.length) return;
  ctx.save();
  const dpr = renderDpr();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.age += 1;                                   // frame-based aging (immune to rAF timestamp jumps)
    const p = f.age / f.life;
    if (p >= 1) { floaters.splice(i, 1); continue; }
    const alpha = p < 0.08 ? p / 0.08 : 1 - (p - 0.08) / 0.92;   // near-instant fade-in, gentle ease-out
    const s = camera.worldToScreen(f.x, f.y);
    const y = s.y - 6 - f.rise * p;               // drift up as it fades
    const txt = `${f.sign}${f.amount}`;
    ctx.font = `700 ${f.size}px ${FLOAT_FONT}`;
    const tw = ctx.measureText(txt).width;
    const bolt = f.size * 1.02, boltW = bolt * 0.56, gap = f.size * 0.14;
    const startX = s.x - (tw + gap + boltW) / 2;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, f.size * 0.2);
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';           // dark outline so it reads over any terrain
    ctx.fillStyle = '#7fe6a3';                      // green — matches the top pill's energy value (--accent)
    ctx.strokeText(txt, startX, y);
    ctx.fillText(txt, startX, y);
    if (ENERGY_BOLT) {
      ctx.save();
      ctx.translate(startX + tw + gap, y - bolt / 2);
      ctx.scale(bolt / 24, bolt / 24);
      ctx.lineWidth = 24 * 0.16;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.stroke(ENERGY_BOLT);
      ctx.fillStyle = '#f4c22e'; ctx.fill(ENERGY_BOLT);   // gold bolt, same as the pill icon
      ctx.restore();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// A food pile keeps its full, fixed heap while ANY nutrient remains, then simply
// FADES away (time-based) once fully consumed — it never changes shape or loses
// pieces as it's eaten. `cell._leafGone` (render-only) marks when a cell emptied.
const LEAF_FADE_MS = 460;
function drawSubstrateLeaves() {
  const sets = _leafSets();
  if (!sets.leaves && !sets.nuts && !sets.red) return;
  const sub = state.substrate;
  // A digested MAP pile keeps its full heap until ITS OWN draft starts, so several
  // piles finished in the same round vanish one-by-one as each is drafted — not all
  // at once. `pile.draftHeld` (set when the pile's offer is queued) holds the heap
  // full; `pile._fadeAt` (set when that draft's glyph rises) starts the fade. Nut
  // piles / ant-eaten piles (no draft) fall back to fading from when the cell emptied.
  const heldCells = new Set();
  const fadeAtCell = new Map();
  for (const p of (sub.foodPiles || [])) {
    if (p.draftHeld) { for (const idx of p.cells) heldCells.add(idx); }
    else if (p._fadeAt) { for (const idx of p.cells) fadeAtCell.set(idx, p._fadeAt); }
  }
  sub.forEachCell((cell, col, row) => {
    if (cell.rock || !cell.foodKind) return;             // only leaf/nut food cells
    const kind = cell.foodKind;                          // 'cache' | 'cache-engine' | 'duff' | 'nut'
    if (cell.nutrient > 0) {
      cell._leafGone = 0;                                 // still has food → full heap, no fade
      _drawLeafHeap(sets, col, row, kind, 1);
      return;
    }
    if (cell.maxNutrient <= 0) return;                    // never had food
    const idx = sub.index(col, row);
    if (heldCells.has(idx)) {                             // digested but awaiting its draft → stay full
      cell._leafGone = 0;
      _drawLeafHeap(sets, col, row, kind, 1);
      return;
    }
    // Fading: from this pile's draft-release moment if it has one, else from when
    // the cell first emptied (nut caches, ant-eaten piles that grant no draft).
    const start = fadeAtCell.get(idx) || cell._leafGone || (cell._leafGone = lastTime);
    const a = 1 - (lastTime - start) / LEAF_FADE_MS;
    if (a > 0) _drawLeafHeap(sets, col, row, kind, a);
  });
}

// =============================================================================
// FOOD-PILE CARD DRAFT — sequenced intro
//
// When a colonised food pile finishes digesting, a card draft is offered. Rather
// than pop the panel instantly, we play a beat: (1) WAIT for the played card's
// grow to finish revealing (the pile's leaves have already faded out on consume —
// see drawSubstrateLeaves), (2) a brief pause, then we hand off to the UI: a
// glowing 3-card glyph rises where the pile stood and each of its three cards
// flies + grows into one of the three draft cards (render/ui.js `releaseOffer` →
// `_playDraftReveal`). Driven per-frame. The offer carries its own world centre
// (engine/cards.js), so multiple queued drafts each animate from their own pile.
// =============================================================================
const DRAFT_WAIT_MAX = 4200;   // hard cap so a stuck reveal never hangs the draft
const DRAFT_START_GRACE = 500; // if no grow reveal ever starts, stop waiting after this
const DRAFT_LEAF_MS = 320;     // brief beat after the grow before the glyph rises

function anyRevealing(time) {
  for (const r of networkRenderers.values()) {
    if (r.isRevealing && r.isRevealing(time)) return true;
  }
  return false;
}

// Advance the draft-intro phase machine (wait → leaf → handoff). Sets
// di.ghostAlpha for the leaf-ghost draw; when the leaves have faded it hands the
// pile's screen point to the UI, which owns the glyph + per-card morph.
function updateDraftIntro(time) {
  const offer = state.cards && state.cards.pendingOffers && state.cards.pendingOffers[0];
  if (!offer) { draftIntro = null; return; }

  // A legacy offer with no captured footprint (or cards layer edge cases) just
  // shows the panel immediately — nothing to animate from.
  if (!offer.center) {
    if (!draftIntro || draftIntro.offer !== offer) {
      draftIntro = { offer, phase: 'done' };
      if (ui && ui.releaseOffer) ui.releaseOffer(null);
    }
    return;
  }

  if (!draftIntro || draftIntro.offer !== offer) {
    draftIntro = { offer, phase: 'wait', t0: time, sawReveal: false, released: false };
    if (ui && ui.holdOffer) ui.holdOffer();   // keep the panel hidden until the glyph is in
  }
  const di = draftIntro;

  if (di.phase === 'wait') {
    const revealing = anyRevealing(time);
    if (revealing) di.sawReveal = true;
    const waited = time - di.t0;
    const revealDone = di.sawReveal && !revealing;      // a grow played and has finished
    const noReveal = !di.sawReveal && waited > DRAFT_START_GRACE;  // nothing was playing
    if (revealDone || noReveal || waited > DRAFT_WAIT_MAX) { di.phase = 'leaf'; di.t0 = time; }
  } else if (di.phase === 'leaf') {
    // A brief beat after the grow finishes. The pile's leaves have already faded
    // out on consumption (see drawSubstrateLeaves), so there's nothing to draw here.
    if (time - di.t0 >= DRAFT_LEAF_MS) {
      di.phase = 'done';
      if (!di.released) {
        const scr = camera.worldToScreen(offer.center.x, offer.center.y);
        if (ui && ui.releaseOffer) ui.releaseOffer(scr);   // glyph rises here, then morphs into the panel
        // THIS pile's draft is starting — release its held leaves so they fade now,
        // as part of the glyph rising (see drawSubstrateLeaves). Other finished piles
        // stay full on the map until their own draft's turn.
        if (offer.pile) { offer.pile.draftHeld = false; offer.pile._fadeAt = time; }
        di.released = true;
      }
    }
  }
}

// Fill `cover` (screen rect) with a world-anchored, zoom-scaled tiled texture,
// optionally clipped to a screen-space Path2D.
function fillPatternWorld(key, clipPath, cover, defaultOpacity) {
  const p = pattern(ctx, key);
  if (!p) return;
  const meta = assetMeta(key) || {};
  const scale = (meta.scale || 1) * camera.zoom;
  const o = camera.worldToScreen(0, 0);
  if (p.setTransform) p.setTransform(new DOMMatrix([scale, 0, 0, scale, o.x, o.y]));
  ctx.save();
  if (clipPath) ctx.clip(clipPath);
  ctx.globalAlpha = meta.opacity != null ? meta.opacity : defaultOpacity;
  if (meta.blend) ctx.globalCompositeOperation = meta.blend;
  ctx.fillStyle = p;
  ctx.fillRect(cover.x, cover.y, cover.w, cover.h);
  ctx.restore();
}

// Rock formations grouped into connected clusters. Each cluster is assigned a
// "recipe" — a small palette of rock-sprite types — so most formations are a
// grey slate+basalt mix with occasional veined / mossy / river ones. Static per
// map, cached by state.
const ROCK_RECIPES = [
  ['rockSlate', 'rockBasalt'],
  ['rockSlate', 'rockBasalt'],
  ['rockSlate', 'rockBasalt'],
  ['rockVeined', 'rockSlate'],
  ['rockMossy', 'rockBasalt'],
  ['rockRiver', 'rockSlate'],
];
const ALL_ROCKS = ['rockSlate', 'rockBasalt', 'rockRiver', 'rockVeined', 'rockMossy'];
let _rockState = null, _rockGroups = null;
function rockGroups() {
  if (_rockState === state) return _rockGroups;
  const sub = state.substrate;
  const haveAny = ALL_ROCKS.some(hasAsset);
  const groups = [];
  if (haveAny) {
    const seen = new Set();
    const id = (c, r) => r * sub.cols + c;
    const NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let gi = 0;
    sub.forEachCell((cell, col, row) => {
      // lakes (water) draw as water; formation + column cells draw as AI sprites;
      // rockFill = soil solidified UNDER another rock's sprite (never its own boulder).
      if (!cell.rock || cell.water || cell.formation || cell.column || cell.rockFill || seen.has(id(col, row))) return;
      const cells = [];
      const q = [[col, row]]; seen.add(id(col, row));
      while (q.length) {
        const [c, r] = q.pop();
        cells.push(sub.cellCenter(c, r));
        for (const [dc, dr] of NB) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= sub.cols || nr >= sub.rows || seen.has(id(nc, nr))) continue;
          const ncell = sub.cellAt(nc, nr);
          if (ncell && ncell.rock && !ncell.water && !ncell.formation && !ncell.column && !ncell.rockFill) { seen.add(id(nc, nr)); q.push([nc, nr]); }
        }
      }
      let pal = ROCK_RECIPES[gi % ROCK_RECIPES.length].filter(hasAsset);
      if (!pal.length) pal = ALL_ROCKS.filter(hasAsset);
      groups.push({ palette: pal, cells });
      gi++;
    });
  }
  _rockState = state; _rockGroups = groups;
  return groups;
}

// Draw each rock formation as a heap of boulder sprites: a dark base fill (so
// no earth shows through gaps) + overlapping boulders drawn back-to-front, with
// small rotations so the baked one-sided lighting stays consistent. Boulder
// type / size / offset / rotation are hashed from the cell so it's stable.
function drawRockPiles() {
  const groups = rockGroups();
  if (!groups.length) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  // Lone scattered boulders — one rock sprite each, never piled. (The large
  // piled masses were the path-blocking walls, now removed.)
  for (const g of groups) {
    if (!g.palette.length) continue;
    for (const c of g.cells) {
      const s = camera.worldToScreen(c.x, c.y);
      if (s.x > -cs * 3 && s.x < camera.viewW + cs * 3 && s.y > -cs * 3 && s.y < camera.viewH + cs * 3)
        drawBoulder(c, g.palette, 0, 1.0, cs, z);
    }
  }
}

function drawBoulder(c, palette, k, mult, cs, z) {
  const h1 = _hashf(c.x * 0.13 + k * 7.7, c.y * 0.17 + k * 3.3);
  const h2 = _hashf(c.x * 0.19 + k * 5.1, c.y * 0.11 + k * 9.2);
  const h3 = _hashf(c.x * 0.23 + k * 2.7, c.y * 0.29 + k * 4.4);
  const img = asset(palette[Math.floor(h3 * palette.length) % palette.length]);
  if (!img) return;
  const bh = cs * (1.35 + h1 * h1 * 2.0) * z * mult;   // spread of small (~1.35 cells) to large (~3.3 cells) boulders
  const bw = bh * (img.width / img.height);
  const s = camera.worldToScreen(c.x, c.y);
  if (s.x < -bw || s.x > camera.viewW + bw || s.y < -bh || s.y > camera.viewH + bh) return;
  const ox = (h1 * 2 - 1) * cs * 0.3 * z, oy = (h2 * 2 - 1) * cs * 0.3 * z;
  ctx.save();
  ctx.translate(s.x + ox, s.y + oy);
  ctx.rotate((h3 * 2 - 1) * 0.3);
  ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
  ctx.restore();
}

// Large rock FORMATIONS — each connected patch of formation cells is drawn as a
// single big AI rock-formation sprite (crystal / ember / fungal / glow), scaled
// to the patch's footprint and embedded into the earth so its base melts into
// the soil rather than sitting on top. Distinct sprites per map (seeded), no
// piling. Falls back to piled boulders when the sprites are absent.
const ROCKFORM_KEYS = Array.from({ length: 14 }, (_, i) => 'rockform' + (i + 1));
let _formState = null, _formGroups = null;
function formationGroups() {
  if (_formState === state) return _formGroups;
  const sub = state.substrate, cs = sub.cellSize;
  const groups = [];
  const seen = new Set();
  const id = (c, r) => r * sub.cols + c;
  const NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  sub.forEachCell((cell, col, row) => {
    if (!cell.formation || cell.water || seen.has(id(col, row))) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const cells = [];
    const q = [[col, row]]; seen.add(id(col, row));
    while (q.length) {
      const [c, r] = q.pop();
      const cc = sub.cellCenter(c, r); cells.push(cc);
      if (cc.x < x0) x0 = cc.x; if (cc.x > x1) x1 = cc.x;
      if (cc.y < y0) y0 = cc.y; if (cc.y > y1) y1 = cc.y;
      for (const [dc, dr] of NB) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= sub.cols || nr >= sub.rows || seen.has(id(nc, nr))) continue;
        const ncell = sub.cellAt(nc, nr);
        if (ncell && ncell.formation && !ncell.water) { seen.add(id(nc, nr)); q.push([nc, nr]); }
      }
    }
    groups.push({ cells, bbox: { x0: x0 - cs / 2, y0: y0 - cs / 2, x1: x1 + cs / 2, y1: y1 + cs / 2 } });
  });
  // Assign distinct sprites per map: a seeded shuffle of the available pool.
  const avail = ROCKFORM_KEYS.filter(hasAsset);
  if (avail.length) {
    const seed = (state.seed || 1) * 0.017;
    const order = avail
      .map((k, i) => ({ k, r: _hashf(i + 1, seed) }))
      .sort((a, b) => a.r - b.r)
      .map((o) => o.k);
    groups.forEach((g, i) => { g.key = order[i % order.length]; });
  }
  _formState = state; _formGroups = groups;
  return groups;
}

// Blit one formation sprite, anchored by its screen top-left (tlx,tly) at size
// (sw,sh). Composited through an offscreen buffer so the cool-stone lift and the
// soil-tone base blend are MASKED to the rock silhouette (source-atop) — they
// never band over the sprite's transparent margins. baseBlend fades the bottom
// into the soil; the lift (scaled inversely with zoom) keeps warm rock readable
// against the brown earth when zoomed out without washing the detail when close.
let _formBuf = null;
function _blitFormation(img, sw, sh, tlx, tly, z, cs, soil, baseBlend, rot = 0) {
  const W = Math.max(1, Math.ceil(sw)), H = Math.max(1, Math.ceil(sh));
  if (!_formBuf) _formBuf = document.createElement('canvas');
  if (_formBuf.width !== W || _formBuf.height !== H) { _formBuf.width = W; _formBuf.height = H; }
  const bctx = _formBuf.getContext('2d');
  bctx.clearRect(0, 0, W, H);
  bctx.drawImage(img, 0, 0, sw, sh);
  bctx.globalCompositeOperation = 'source-atop';
  const liftA = Math.max(0, Math.min(0.16, 0.16 - (z - 0.5) * 0.26));
  if (liftA > 0.001) { bctx.fillStyle = `rgba(116,128,146,${liftA.toFixed(3)})`; bctx.fillRect(0, 0, W, H); }
  if (baseBlend) {
    const fadeH = Math.min(sh * 0.24, cs * 1.7 * z);
    const grad = bctx.createLinearGradient(0, sh - fadeH, 0, sh);
    grad.addColorStop(0, `rgba(${soil},0)`);
    grad.addColorStop(1, `rgba(${soil},0.94)`);
    bctx.fillStyle = grad;
    bctx.fillRect(0, sh - fadeH, W, fadeH);
  }
  bctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = Math.max(2, 5 * z);
  if (rot) {                                          // rotate around the sprite centre
    ctx.translate(tlx + W / 2, tly + H / 2);
    ctx.rotate(rot);
    ctx.drawImage(_formBuf, -W / 2, -H / 2);
  } else {
    ctx.drawImage(_formBuf, tlx, tly);
  }
  ctx.restore();
}

// The world-space rectangle a formation's sprite is drawn into. Shared by the
// draw pass and the collision-solidify pass so "what you see is what blocks"
// stays exact. Returns null when the sprite isn't loaded yet (draw falls back to
// boulders, whose footprint already matches the cells).
function formationRect(g, sub, cs) {
  const img = g.key ? asset(g.key) : null;
  if (!img) return null;
  const b = g.bbox;
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2;
  const aspect = img.width / img.height;
  // Cover the footprint: size by width, but grow if needed so the image is at
  // least as tall as the footprint. Slight overhang so edges fully cover.
  let dw = bw * 1.08, dh = dw / aspect;
  if (dh < bh * 1.02) { dh = bh * 1.02; dw = dh * aspect; }
  const embed = cs * 0.55;                          // bury the jagged base into the soil
  const baseY = b.y1 + embed;
  // Anchor the base, but never let the (taller-than-footprint) sprite jut above
  // the soil line — clamp its top down to the surface for shallow formations.
  const topW = Math.max(sub.surfaceY, baseY - dh);
  return { img, cx, dw, dh, topW, baseY, footBottom: b.y1 };
}

// WYSIWYG collision: every rock TYPE (boulders, formations, columns) is drawn as
// a sprite LARGER than its cell footprint, so mycelium in the open soil a sprite
// visually covers used to look like it was growing ON the rock. Once per map,
// solidifyRock() marks every soil cell that any rock sprite's OPAQUE silhouette
// actually covers as rock, so the whole visible rock blocks growth. The
// silhouette is sampled from each sprite's alpha (not its bounding box) so the
// transparent margins around the art stay passable soil. Solidified cells are
// tagged `rockFill` so they're never re-drawn as their own boulder/formation.
let _solidBuf = null;
const _alphaMaskCache = new Map();     // img.src -> { mw, mh, data }
function _alphaMask(img) {
  const key = img.src || img;
  let m = _alphaMaskCache.get(key);
  if (m) return m;
  const mw = Math.min(160, Math.max(16, img.width | 0));
  const mh = Math.min(160, Math.max(16, Math.round(mw * img.height / img.width)));
  if (!_solidBuf) _solidBuf = document.createElement('canvas');
  _solidBuf.width = mw; _solidBuf.height = mh;
  const mctx = _solidBuf.getContext('2d', { willReadFrequently: true });
  mctx.clearRect(0, 0, mw, mh);
  mctx.drawImage(img, 0, 0, mw, mh);
  let data;
  try { data = mctx.getImageData(0, 0, mw, mh).data; } catch (e) { return null; }
  m = { mw, mh, data };
  _alphaMaskCache.set(key, m);
  return m;
}

// Mark (into `mask`, a gCols×gRows grid of `gSize`-px cells whose rows start at the
// surface line) every grid cell whose CENTRE falls under one rock sprite's opaque
// silhouette — the point growth-collision tests. Geometry matches the draw exactly
// (centre cxW,cyW, size wW×hW, rotation rot), so what blocks == what you see. Called
// twice per sprite: once on the COARSE cell grid (→ cell.rock, for LoS/spawn/draw)
// and once on a FINE grid (→ the growth collision mask, several× finer so it tracks
// the visible art and there are no coarse-grid false gaps / false walls). Skips lake
// water + food + above-surface. Returns false if the sprite isn't decodable yet.
function markCoverGrid(sub, img, cxW, cyW, wW, hW, rot, mask, gCols, gRows, gSize) {
  const m = _alphaMask(img);
  if (!m) return false;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const hwR = Math.abs(wW / 2 * cr) + Math.abs(hW / 2 * sr);   // rotated AABB half-extents
  const hhR = Math.abs(wW / 2 * sr) + Math.abs(hW / 2 * cr);
  const surfaceY = sub.surfaceY;
  const c0 = Math.max(0, Math.floor((cxW - hwR) / gSize)), c1 = Math.min(gCols - 1, Math.floor((cxW + hwR) / gSize));
  const r0 = Math.max(0, Math.floor((cyW - hhR - surfaceY) / gSize)), r1 = Math.min(gRows - 1, Math.floor((cyW + hhR - surfaceY) / gSize));
  for (let gc = c0; gc <= c1; gc++) {
    for (let gr = r0; gr <= r1; gr++) {
      const wx = gc * gSize + gSize / 2, wy = surfaceY + gr * gSize + gSize / 2;
      if (wy <= surfaceY) continue;                               // underground only
      const cell = sub.cellAtWorld(wx, wy);
      if (cell && cell.water) continue;                           // lakes stay water (handled separately)
      if (cell && (cell.nutrient > 0 || cell.maxNutrient > 0)) continue;   // never bury a food pile
      const dx = wx - cxW, dy = wy - cyW;
      const lx = cr * dx + sr * dy, ly = -sr * dx + cr * dy;      // world -> sprite-local (undo rot)
      const u = (lx + wW / 2) / wW, v = (ly + hW / 2) / hW;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const px = Math.min(m.mw - 1, Math.max(0, Math.floor(u * m.mw)));
      const py = Math.min(m.mh - 1, Math.max(0, Math.floor(v * m.mh)));
      if (m.data[(py * m.mw + px) * 4 + 3] < 128) continue;       // sprite transparent here — leave as soil
      mask[gr * gCols + gc] = 1;
    }
  }
  return true;
}

// One-shot per map: derive rock COLLISION from EXACTLY what we draw, at TWO
// resolutions. Generation flags cells rock/column/formation only to tell the
// renderer WHERE to draw a sprite; on their own those flags must NOT block growth,
// or a cell the sprite's irregular silhouette never covers becomes an INVISIBLE
// WALL. So we stamp the opaque silhouette of every drawn sprite (boulders,
// formations, columns) into:
//   • a COARSE per-cell cover → reconciled into cell.rock (LoS / spawn / rendering).
//   • a FINE mask (¼-cell, `sub._fineSolid`) → the GROWTH collision. The 36px cell
//     grid is too coarse to match the art: a cell can fall in the seam between two
//     touching rocks (a false gap you grow through) or cover a real sub-cell channel
//     (a false wall that blocks you). The fine mask tracks the visible sprite, so
//     growth threads a real gap and stops at a real edge — WYSIWYG.
// Both keep lake water solid and the guaranteed winnable corridor (pathClear) open.
// Runs only once ALL sprites decode, so we never reconcile against a half-loaded
// set; until then the original (SUPERSET) flags stay, so nothing is wrongly passable.
function solidifyRock() {
  const sub = state.substrate;
  if (sub._rockSolidified) return;
  const cs = sub.cellSize;
  const cover = new Uint8Array(sub.cols * sub.rows);
  const K = 4, fSize = cs / K;                                  // fine mask: 4× finer (9px cells)
  const fCols = Math.max(1, Math.round(sub.worldWidth / fSize));
  const fRows = Math.max(1, Math.ceil((sub.worldHeight - sub.surfaceY) / fSize));
  const fine = new Uint8Array(fCols * fRows);
  let ready = true;
  // Stamp one sprite into BOTH the coarse and fine masks (identical geometry).
  const stamp = (img, cx, cy, w, h, rot) => {
    const a = markCoverGrid(sub, img, cx, cy, w, h, rot, cover, sub.cols, sub.rows, cs);
    const b = markCoverGrid(sub, img, cx, cy, w, h, rot, fine, fCols, fRows, fSize);
    return a && b;
  };

  // Boulders (drawRockPiles / drawBoulder geometry, k=0, mult=1).
  for (const g of rockGroups()) {
    if (!g.palette.length) continue;
    for (const c of g.cells) {
      const h1 = _hashf(c.x * 0.13, c.y * 0.17);
      const h2 = _hashf(c.x * 0.19, c.y * 0.11);
      const h3 = _hashf(c.x * 0.23, c.y * 0.29);
      const img = asset(g.palette[Math.floor(h3 * g.palette.length) % g.palette.length]);
      if (!img) { ready = false; continue; }
      const bhW = cs * (1.35 + h1 * h1 * 2.0);
      const bwW = bhW * (img.width / img.height);
      const ox = (h1 * 2 - 1) * cs * 0.3, oy = (h2 * 2 - 1) * cs * 0.3;
      if (!stamp(img, c.x + ox, c.y + oy, bwW, bhW, (h3 * 2 - 1) * 0.3)) ready = false;
    }
  }

  // Formations (formationRect / drawRockFormations geometry, rot 0). Cover the
  // sprite's FULL drawn box [topW, topW+dh] — NOT [topW, baseY], which is shorter
  // for a surface-clamped formation and would leave its deep half un-collided.
  for (const g of formationGroups()) {
    const r = formationRect(g, sub, cs);
    if (!r) { ready = false; continue; }
    if (!stamp(r.img, r.cx, r.topW + r.dh / 2, r.dw, r.dh, 0)) ready = false;
  }

  // Columns (drawRockColumns geometry — a stack of rotated sprites per column).
  const cols = sub.rockColumns;
  if (cols && cols.length && ROCKFORM_KEYS.some(hasAsset)) {
    const colW = state.config.substrate.columnWidthCols || 2;
    const seed = (state.seed || 1);
    const overlap = 0.16;
    const cdMin = state.config.substrate.columnDepthMinRows || 6;
    const cdMax = state.config.substrate.columnDepthMaxRows || 11;
    const dspan = Math.max(1, cdMax - cdMin);
    cols.forEach((col, ci) => {
      const tanT = Math.tan(col.tilt);
      const topX = (col.cx + colW / 2) * cs, topY = sub.surfaceY;
      const botX = topX + col.depth * tanT * cs, botY = sub.surfaceY + col.depth * cs;
      const dx = botX - topX, dy = botY - topY;
      const axLen0 = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / axLen0, uy = dy / axLen0;
      const poke = cs * 0.3;
      const startX = topX - ux * poke, startY = topY - uy * poke;
      const axLen = axLen0 + poke;
      let N = Math.max(2, Math.min(4, 2 + Math.round((col.depth - cdMin) / dspan * 2)));
      const styleNames = Object.keys(COLUMN_STYLES).filter((k) => COLUMN_STYLES[k].filter(hasAsset).length >= N);
      const pool = (styleNames.length
        ? COLUMN_STYLES[styleNames[Math.floor(_hashf(ci + 2, seed * 0.017) * styleNames.length) % styleNames.length]]
        : ROCKFORM_KEYS).filter(hasAsset);
      N = Math.min(N, pool.length);
      if (!N) return;
      const chosen = pool
        .map((k, i) => ({ k, r: _hashf(i + 1, seed * 0.019 + ci * 1.7) }))
        .sort((a, b) => a.r - b.r).map((o) => o.k).slice(0, N);
      const ell = axLen / (1 + (N - 1) * (1 - overlap));
      for (let i = 0; i < N; i++) {
        const img = asset(chosen[i]); if (!img) { ready = false; continue; }
        const aspect = img.width / img.height;
        const longW = ell, crossW = ell / aspect;
        const t = ell / 2 + i * ell * (1 - overlap);
        const rot = Math.PI / 2 + (_hashf(ci * 9.1 + i, seed * 0.023) * 2 - 1) * (Math.PI / 6);
        if (!stamp(img, startX + ux * t, startY + uy * t, longW, crossW, rot)) ready = false;
      }
    });
  }

  if (!ready) return;   // some rock sprite still loading — retry next frame (original superset flags stand)

  // Bake lakes (solid) + the guaranteed winnable corridor (open) into the FINE mask,
  // per coarse cell → all K×K of its fine sub-cells.
  for (let r = 0; r < sub.rows; r++) {
    for (let c = 0; c < sub.cols; c++) {
      const cell = sub.cells[r * sub.cols + c];
      if (!cell.water && !cell.pathClear) continue;
      const val = cell.water ? 1 : 0;
      for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
        const fc = c * K + b, fr = r * K + a;
        if (fc < fCols && fr < fRows) fine[fr * fCols + fc] = val;
      }
    }
  }

  // Reconcile the COARSE cell.rock (LoS / spawn / rendering) from the coarse cover:
  // a cell reads as rock iff a sprite covers its centre (+ lake water); the winnable
  // corridor stays open. _rockReclaimed / _rockFlagged: diagnostic (invisible-wall
  // cells cleared vs total flagged) — inspect via __game.state.substrate._rockReclaimed.
  let reclaimed = 0, flagged = 0;
  for (let i = 0; i < sub.cells.length; i++) {
    const cell = sub.cells[i];
    if (cell.water) continue;                          // lakes: drawn as water, stay solid
    if (cell.pathClear) { cell.rock = false; continue; }   // guaranteed winnable corridor stays open
    const covered = cover[i] === 1;
    const wasSource = cell.rock && !cell.rockFill;     // an original generation rock (boulder/formation/column)
    if (wasSource) { flagged++; if (!covered) reclaimed++; }
    cell.rock = covered;
    cell.rockFill = covered && !wasSource;             // soil under an overhang → don't re-draw it as its own boulder
    if (covered) cell.hazard = false;
  }
  sub._rockReclaimed = reclaimed; sub._rockFlagged = flagged;
  // Publish the FINE growth-collision mask (read by substrate.solidAtWorld / network _placeOk).
  sub._fineSolid = fine; sub._fineSize = fSize; sub._fineCols = fCols; sub._fineRows = fRows;
  sub._rockSolidified = true;
}

function drawRockFormations() {
  const groups = formationGroups();
  if (!groups.length) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const soil = _rgb(state.config.render.soilDeep || '#2a1d12');
  for (const g of groups) {
    const r = formationRect(g, sub, cs);
    if (!r) {
      // Fallback: no formation sprites loaded — render as piled boulders so the
      // impassable mass is never invisible.
      const pal = ALL_ROCKS.filter(hasAsset);
      if (!pal.length) continue;
      const cells = g.cells.slice().sort((a, b) => a.y - b.y);
      for (const c of cells) drawBoulder(c, pal, 0, 1.0, cs, z);
      continue;
    }
    const sw = r.dw * z, sh = r.dh * z;
    const tl = camera.worldToScreen(r.cx - r.dw / 2, r.topW);
    if (tl.x > camera.viewW + sw || tl.x + sw < 0 || tl.y > camera.viewH + sh || tl.y + sh < 0) continue;
    _blitFormation(r.img, sw, sh, tl.x, tl.y, z, cs, soil, true);
  }
}

// Path-blocking ROCK COLUMNS — each is a near-vertical stack of 2–4 DISTINCT
// large rock sprites (no repeated type), barely overlapping, each rotated to
// follow the column's axis with a little per-rock jitter, running from the soil
// line down to the column's depth so the mycelium must dig UNDER it. Crystal /
// ember / glow styles only (fungal mushrooms would sit sideways). Geometry comes
// from sub.rockColumns; the sprite picks are seeded so they're stable per map.
// Only sprites whose native aspect is chunky (≲2.2:1) — the ultra-wide ones
// (rockform5/10/13) would become pancakes when sized to a column's width.
const COLUMN_STYLES = {
  ember:   ['rockform2', 'rockform6', 'rockform9', 'rockform12'],
  crystal: ['rockform3', 'rockform7', 'rockform14'],
};
function drawRockColumns() {
  const cols = state.substrate.rockColumns;
  if (!cols || !cols.length || !ROCKFORM_KEYS.some(hasAsset)) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const soil = _rgb(state.config.render.soilDeep || '#2a1d12');
  const colW = state.config.substrate.columnWidthCols || 2;
  const seed = (state.seed || 1);
  const overlap = 0.16;                                    // barely overlap the stacked edges
  const cdMin = state.config.substrate.columnDepthMinRows || 6;
  const cdMax = state.config.substrate.columnDepthMaxRows || 11;
  const dspan = Math.max(1, cdMax - cdMin);
  cols.forEach((col, ci) => {
    const tanT = Math.tan(col.tilt);                       // whole-column lean (±30°)
    // Column axis: from just above the soil line straight DOWN to the column depth,
    // drifting sideways by the tilt. Each rock is stood VERTICALLY along this axis.
    const topX = (col.cx + colW / 2) * cs, topY = sub.surfaceY;
    const botX = topX + col.depth * tanT * cs, botY = sub.surfaceY + col.depth * cs;
    const dx = botX - topX, dy = botY - topY;
    const axLen0 = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / axLen0, uy = dy / axLen0;
    const poke = cs * 0.3;                                 // lift the top rock so the column clearly MEETS the surface line (a sliver above is fine)
    const startX = topX - ux * poke, startY = topY - uy * poke;
    const axLen = axLen0 + poke;
    // Rock count grows with depth (2 at the shallowest … 4 at the deepest). No repeats.
    let N = Math.max(2, Math.min(4, 2 + Math.round((col.depth - cdMin) / dspan * 2)));
    const styleNames = Object.keys(COLUMN_STYLES).filter((k) => COLUMN_STYLES[k].filter(hasAsset).length >= N);
    const pool = (styleNames.length
      ? COLUMN_STYLES[styleNames[Math.floor(_hashf(ci + 2, seed * 0.017) * styleNames.length) % styleNames.length]]
      : ROCKFORM_KEYS).filter(hasAsset);
    N = Math.min(N, pool.length);
    if (!N) return;
    const chosen = pool
      .map((k, i) => ({ k, r: _hashf(i + 1, seed * 0.019 + ci * 1.7) }))
      .sort((a, b) => a.r - b.r).map((o) => o.k).slice(0, N);   // distinct, no repeats
    const ell = axLen / (1 + (N - 1) * (1 - overlap));     // along-axis length per rock
    for (let i = 0; i < N; i++) {
      const img = asset(chosen[i]); if (!img) continue;
      const aspect = img.width / img.height;               // native (wide) sprite
      const longW = ell;                                   // along the axis — the rock stood on end
      const crossW = ell / aspect;                         // NATURAL proportions across — no distortion
      const t = ell / 2 + i * ell * (1 - overlap);
      const ceX = startX + ux * t, ceY = startY + uy * t;
      // each rock stands VERTICAL ±30°, varied per rock — far more natural than a uniform stack
      const rot = Math.PI / 2 + (_hashf(ci * 9.1 + i, seed * 0.023) * 2 - 1) * (Math.PI / 6);
      const sw = longW * z, sh = crossW * z;
      const sc = camera.worldToScreen(ceX, ceY);
      if (sc.x < -sw - sh || sc.x > camera.viewW + sw + sh) continue;
      _blitFormation(img, sw, sh, sc.x - sw / 2, sc.y - sh / 2, z, cs, soil, i === N - 1, rot);
    }
  });
}

// Above-ground props (trees / grass / houses) placed along the surface line.
// Deterministic per map (seeded by state.seed) and cached, so they don't flicker
// or move between frames. Gated on the sprites being present.
const _hashf = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
// '#rrggbb' -> 'r,g,b' (for building rgba() strings with a separate alpha)
const _rgb = (hex) => { const h = hex.replace('#', ''); const n = parseInt(h, 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
let _propState = null, _props = null;
function surfaceProps() {
  if (_propState === state) return _props;
  const sub = state.substrate, seed = (state.seed || 1) * 0.013, props = [];
  let lastTree = -99;
  for (let c = 2; c < sub.cols - 2; c++) {
    const surf = sub.surface[c];
    const r = _hashf(c + 0.5, seed);
    // Trees scatter over fruitable soil. (The lone 'house' prop was removed — the
    // city skylines are the man-made surface now.) Skip the goal zone — that's the
    // summery landscape, with its own bush props.
    if (surf.soil && !surf.goal && r < 0.07 && c - lastTree > 3 && hasAsset('tree')) {
      props.push({ key: 'tree', col: c, h: 124, embed: 24, flip: _hashf(c, 7) < 0.5 }); lastTree = c;
    }
  }
  _propState = state; _props = props;
  return props;
}

// Mountain barriers: one sprite per contiguous run of 'mountain' surface, its
// solid base anchored at (and slightly embedded into) the surface line so it
// rises from the ground rather than floating. Sized large; the base spans wider
// than the impassable wall so the slopes reach the ground on both sides.
let _mtnState = null, _mtns = null;
let _rangeBuf = null;   // offscreen buffer for the faded range backdrop
function mountainRuns() {
  if (_mtnState === state) return _mtns;
  const sub = state.substrate, runs = [];
  let c = 0;
  while (c < sub.cols) {
    if (sub.surface[c] && sub.surface[c].barrier === 'mountain') {
      let end = c;
      while (end < sub.cols && sub.surface[end].barrier === 'mountain') end++;
      // Per-mountain width varies in [MIN,MAX] tiles — deterministic from the map
      // seed + column, so it's stable across frames but different per mountain/map.
      const wCells = MOUNTAIN_W_MIN + _hashf(c + 0.5, (state.seed || 1) * 0.071) * (MOUNTAIN_W_MAX - MOUNTAIN_W_MIN);
      runs.push({ c0: c, c1: end - 1, wCells });
      c = end;
    } else c++;
  }
  _mtnState = state; _mtns = runs;
  return runs;
}

const MOUNTAIN_PEAK_KEYS = ['mountain1', 'mountain2', 'mountain3', 'mountain4', 'mountain5']; // foreground single peaks
const MOUNTAIN_RANGE_KEYS = ['range1', 'range2'];   // wide ranges used as a distant backdrop
const MOUNTAIN_W_MIN = 10;         // narrowest foreground mountain (tiles)
const MOUNTAIN_W_MAX = 40;         // widest foreground mountain (tiles)
// Foreground peaks: the mountain sprites are full triangles whose BASE fills the
// image width, so their slopes hit the left/right edges in the lower ~half — drawn
// with a shallow embed that reads as a mountain CUT OFF at the sides. Fix by SIZING
// + PLACEMENT: draw the peaks bigger and bury MORE of the base below the soil line,
// so only the naturally-tapering UPPER peak (transparent sky on its sides) emerges —
// the soil line reads as the horizon hiding the wide base. No side-fade needed.
const MOUNTAIN_EMBED_FRAC = 0.5;   // foreground: bury the base + full-width lower slopes; only the peak emerges
const MOUNTAIN_SIZE = 1.32;        // …drawn bigger so the emergent upper peak still reads large
const RANGE_EMBED_FRAC = 0.76;     // background range: bury most of it so only a low distant skyline shows

// Mountains are drawn in two layers: a single wide RANGE spanning the whole map
// as a distant, dimmed backdrop, then the foreground single PEAKS overlaid at the
// wall runs (a distinct variant + varied width each) — giving depth and variety.
function drawMountains() {
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const surfY = camera.worldToScreen(0, sub.surfaceY).y;
  const skyTopY = camera.worldToScreen(0, 0).y;   // top of the starry sky — cut peaks off here
  const seed = (state.seed || 1) >>> 0;

  // --- background: one map-wide range, low on the horizon, faded back ---
  const ranges = MOUNTAIN_RANGE_KEYS.filter(hasAsset);
  if (ranges.length) {
    const img = asset(ranges[seed % ranges.length]);
    const w = sub.worldWidth + cs * 4, h = w * (img.height / img.width);
    const s = camera.worldToScreen(sub.worldWidth / 2, sub.surfaceY);
    const sw = w * z, sh = h * z;
    const by = s.y + sh * RANGE_EMBED_FRAC;
    const bandW = Math.max(1, Math.ceil(camera.viewW));
    const bandH = Math.max(1, Math.ceil(surfY - skyTopY));
    if (bandH > 1) {
      // Render to an offscreen buffer and FADE the lower edge into the horizon:
      // drawn straight, the solid base of the range silhouette reads as a flat
      // grey slab hugging the surface (looks like a concrete strip). The buffer
      // also clips to the sky band (its own bounds), like the old clip rect.
      if (!_rangeBuf) _rangeBuf = document.createElement('canvas');
      if (_rangeBuf.width !== bandW || _rangeBuf.height !== bandH) { _rangeBuf.width = bandW; _rangeBuf.height = bandH; }
      const bctx = _rangeBuf.getContext('2d');
      bctx.clearRect(0, 0, bandW, bandH);
      bctx.filter = 'brightness(0.72) saturate(0.78) blur(1.0px)';  // atmospheric — far back, but readable
      bctx.drawImage(img, s.x - sw / 2, (by - sh) - skyTopY, sw, sh);
      bctx.filter = 'none';
      const fade = bctx.createLinearGradient(0, bandH * 0.42, 0, bandH);
      fade.addColorStop(0, 'rgba(0,0,0,0)');                  // keep the peaks up high
      fade.addColorStop(1, 'rgba(0,0,0,1)');                  // dissolve into the horizon at the surface
      bctx.globalCompositeOperation = 'destination-out';
      bctx.fillStyle = fade;
      bctx.fillRect(0, 0, bandW, bandH);
      bctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha = 0.55;                                 // distant haze
      ctx.drawImage(_rangeBuf, 0, skyTopY);
      ctx.restore();
    }
  }

  // --- foreground: single peaks at the wall runs, distinct + varied per map ---
  const peaks = MOUNTAIN_PEAK_KEYS.filter(hasAsset);
  const runs = mountainRuns();
  if (!peaks.length || !runs.length) return;
  // Lake screen x-band: a foreground peak that would reach into it is SHRUNK
  // (whole image, uniformly) so its edge stops just before the lake — the
  // mountain sits next to the lake with no overlap, no cut, and no fade.
  let lakeL = Infinity, lakeR = -Infinity;
  for (const lk of lakeRuns()) {
    lakeL = Math.min(lakeL, camera.worldToScreen(lk.c0 * cs, sub.surfaceY).x);
    lakeR = Math.max(lakeR, camera.worldToScreen((lk.c1 + 1) * cs, sub.surfaceY).x);
  }
  const hasLake = lakeR > lakeL;
  const GAP = 2;                                   // tiny gap so they're adjacent, not touching
  // Seeded shuffle so each map shows a different distinct subset of the peak pool.
  const order = peaks
    .map((k, i) => ({ k, r: _hashf(i + 1, seed * 0.013) }))
    .sort((a, b) => a.r - b.r)
    .map((o) => o.k);
  runs.forEach((run, i) => {
    const img = asset(order[i % order.length]);
    const aspect = img.height / img.width;
    const midX = ((run.c0 + run.c1 + 1) / 2) * cs;
    const s = camera.worldToScreen(midX, sub.surfaceY);
    let sw = cs * run.wCells * z * MOUNTAIN_SIZE;
    if (hasLake) {
      if (s.x <= lakeL) {                          // peak left of the lake: end at its left edge
        sw = Math.min(sw, Math.max(0, 2 * (lakeL - GAP - s.x)));
      } else if (s.x >= lakeR) {                   // peak right of the lake: end at its right edge
        sw = Math.min(sw, Math.max(0, 2 * (s.x - (lakeR + GAP))));
      } else {
        return;                                    // centred over the lake (shouldn't happen) — skip
      }
    }
    if (sw < 4) return;
    const sh = sw * aspect;
    const by = s.y + sh * MOUNTAIN_EMBED_FRAC;      // bury the base below the soil line
    if (s.x < -sw || s.x > camera.viewW + sw) return;
    // Fainter/backdrop-like via DIMMING (darkened toward the night sky), NOT
    // transparency — so overlapping peaks occlude each other instead of showing
    // through. Larger peaks stay a touch brighter (a bit more present).
    const t = Math.max(0, Math.min(1, (run.wCells - MOUNTAIN_W_MIN) / (MOUNTAIN_W_MAX - MOUNTAIN_W_MIN)));
    const bright = 0.6 + 0.22 * t;
    ctx.save();
    ctx.beginPath();                                // clip to the sky band — cut tops at the sky top, hide the buried base
    ctx.rect(0, skyTopY, camera.viewW, surfY - skyTopY);
    ctx.clip();
    ctx.filter = `brightness(${bright.toFixed(3)}) saturate(0.82)`;
    ctx.drawImage(img, s.x - sw / 2, by - sh, sw, sh);
    ctx.restore();
  });
}

// Lake basins: each 'lake' run is a water-filled cross-section. When the lake
// art is loaded we draw the chosen sprite over the basin (waterline on the soil
// line, sized to the carved bowl — depth follows the art aspect so it isn't
// distorted; the sprite's feathered edges blend into the earth). The procedural
// bowl in render/substrate.js is the fallback when the art is absent.
const LAKE_KEYS = ['lake1', 'lake2', 'lake3'];
let _lakeState = null, _lakes = null;
function lakeRuns() {
  if (_lakeState === state) return _lakes;
  const sub = state.substrate, runs = [];
  let c = 0;
  while (c < sub.cols) {
    if (sub.surface[c] && sub.surface[c].barrier === 'lake') {
      let end = c;
      while (end < sub.cols && sub.surface[end].barrier === 'lake') end++;
      let maxD = 0;                                   // deepest water row in the run
      for (let col = c; col < end; col++) {
        let d = 0; while (d < sub.rows && sub.cellAt(col, d) && sub.cellAt(col, d).water) d++;
        if (d > maxD) maxD = d;
      }
      runs.push({ c0: c, c1: end - 1, maxD });
      c = end;
    } else c++;
  }
  _lakeState = state; _lakes = runs;
  return runs;
}

function drawLakes() {
  const keys = LAKE_KEYS.filter(hasAsset);
  if (!keys.length) return;
  const runs = lakeRuns();
  if (!runs.length) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const seed = (state.seed || 1) >>> 0;
  for (const run of runs) {
    if (run.maxD <= 0) continue;
    const img = asset(keys[(seed + run.c0) % keys.length]);
    if (!img) continue;
    const tl = camera.worldToScreen(run.c0 * cs, sub.surfaceY);   // top-left at the waterline
    const sw = (run.c1 - run.c0 + 1) * cs * z;
    const sh = run.maxD * cs * z;
    if (tl.x > camera.viewW || tl.x + sw < 0) continue;
    ctx.drawImage(img, tl.x, tl.y, sw, sh);
  }
}

// City skylines sit on the CONCRETE barrier (the man-made middle). Each concrete
// run gets a distinct skyline from the pool, and a skyline appears AT MOST ONCE
// per map (no repeats): a seeded shuffle assigns one per run, stopping when the
// pool is exhausted. Drawn dimmed + opaque (backdrop feel, no see-through).
const CITY_KEYS = ['skyline1', 'skyline2', 'skyline3', 'skyline4', 'skyline5', 'skyline6'];
const CITY_W_MIN = 7, CITY_W_MAX = 12;    // city width in tiles — small, varied (capped at run width)
const CITY_MIN_RUN = 5;                   // skip barrier runs narrower than this (plain ground there)
const CITY_EMBED_FRAC = 0.04;             // flat base sits just on the soil line
let _cityState = null, _cities = null;
function cityRuns() {
  if (_cityState === state) return _cities;
  const sub = state.substrate, runs = [];
  let c = 0;
  while (c < sub.cols) {
    if (sub.surface[c] && sub.surface[c].barrier === 'concrete') {
      let end = c;
      while (end < sub.cols && sub.surface[end].barrier === 'concrete') end++;
      const runCells = end - c;
      if (runCells >= CITY_MIN_RUN) {
        // Each city fits WITHIN its run (centred) — runs are always separated by a
        // lake/mountain gap, so cities can never overlap. Width varies but is
        // capped at the run width.
        const want = CITY_W_MIN + _hashf(c + 0.3, (state.seed || 1) * 0.029) * (CITY_W_MAX - CITY_W_MIN);
        runs.push({ c0: c, c1: end - 1, wCells: Math.min(want, runCells) });
      }
      c = end;
    } else c++;
  }
  _cityState = state; _cities = runs;
  return runs;
}

function drawCities() {
  const keys = CITY_KEYS.filter(hasAsset);
  if (!keys.length) return;
  const runs = cityRuns();
  if (!runs.length) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const surfY = camera.worldToScreen(0, sub.surfaceY).y;
  const skyTopY = camera.worldToScreen(0, 0).y;
  // Horizontal map edges — clip so a skyline never spills off the map.
  const leftX = Math.max(0, camera.worldToScreen(0, sub.surfaceY).x);
  const rightX = Math.min(camera.viewW, camera.worldToScreen(sub.worldWidth, sub.surfaceY).x);
  if (rightX <= leftX) return;
  const seed = (state.seed || 1) >>> 0;
  // Seeded shuffle of the pool → distinct skyline per run, none repeated.
  const order = keys.map((k, i) => ({ k, r: _hashf(i + 1, seed * 0.017) })).sort((a, b) => a.r - b.r).map((o) => o.k);
  runs.forEach((run, i) => {
    if (i >= order.length) return;                 // no repeats: only as many cities as distinct skylines
    const img = asset(order[i]);
    const w = cs * run.wCells, h = w * (img.height / img.width);
    const midX = ((run.c0 + run.c1 + 1) / 2) * cs;
    const s = camera.worldToScreen(midX, sub.surfaceY);
    const sw = w * z, sh = h * z;
    const by = s.y + sh * CITY_EMBED_FRAC;
    if (s.x < leftX - sw || s.x > rightX + sw) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(leftX, skyTopY, rightX - leftX, surfY - skyTopY); ctx.clip();
    ctx.filter = 'brightness(0.85) saturate(0.92)';  // dimmed backdrop, opaque (no see-through)
    ctx.drawImage(img, s.x - sw / 2, by - sh, sw, sh);
    ctx.restore();
  });
}

function drawSurfaceProps() {
  const props = surfaceProps();
  if (!props || !props.length) return;
  const sub = state.substrate, z = camera.zoom;
  for (const pr of props) {
    const img = asset(pr.key);
    if (!img) continue;
    const h = pr.h * z, w = h * (img.width / img.height);
    const cx = pr.col * sub.cellSize + sub.cellSize / 2;
    const s = camera.worldToScreen(cx, sub.surfaceY);
    const by = s.y + (pr.embed || 0) * z;       // base embedded into the ground (not floating on the soil line)
    if (s.x < -w || s.x > camera.viewW + w || by < -h || by - h > camera.viewH) continue;
    ctx.save();
    if (pr.flip) { ctx.translate(s.x, by); ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h, w, h); }
    else ctx.drawImage(img, s.x - w / 2, by - h, w, h);
    ctx.restore();
  }
}

// The GOAL (right) side is a bright SUMMERY landscape — a stark contrast to the
// dark deep-earth world. Two layers: a low sunlit green hill band along the
// horizon (drawn as a far backdrop, behind everything) and a couple of leafy
// bush clusters sitting on the fruiting soil (drawn with the surface props).
function goalCol0() {
  const sub = state.substrate;
  for (let c = 0; c < sub.cols; c++) if (sub.surface[c] && sub.surface[c].goal) return c;
  return -1;
}
// The MOON — a luminous body high in the twilight sky (replaces the old sun
// disc). World-anchored so it sits with the sky; rendered on black, composited
// with 'screen' so its cyan glow adds over the sky and the black drops out.
function drawMoon() {
  const img = asset('moon'); if (!img) return;
  const sub = state.substrate, z = camera.zoom;
  const cx = sub.worldWidth * 0.72, cy = sub.surfaceY * 0.32;   // high in the sky (the old sun spot)
  const hWorld = sub.surfaceY * 0.55;
  const wWorld = hWorld * (img.width / img.height);
  const s = camera.worldToScreen(cx, cy);
  const sw = wWorld * z, sh = hWorld * z;
  // Clip to the world frame so the moon is cut off cleanly at the edges, never
  // floating over the off-map dark beyond the sky.
  const tl = camera.worldToScreen(0, 0), br = camera.worldToScreen(sub.worldWidth, sub.worldHeight);
  if (s.x + sw / 2 < tl.x || s.x - sw / 2 > br.x || s.y - sh / 2 > br.y) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); ctx.clip();
  ctx.drawImage(img, s.x - sw / 2, s.y - sh / 2, sw, sh);
  ctx.restore();
}

// Clip whatever's drawn in `fn` to the world's horizontal extent so the goal
// scene never bleeds past the map edges into the off-map dark.
function withWorldClip(fn) {
  const sub = state.substrate;
  const lx = camera.worldToScreen(0, sub.surfaceY).x;
  const rx = camera.worldToScreen(sub.worldWidth, sub.surfaceY).x;
  ctx.save();
  ctx.beginPath(); ctx.rect(lx, 0, rx - lx, camera.viewH); ctx.clip();
  fn();
  ctx.restore();
}
function drawGoalBackdrop() {
  const hill = asset('goalhill'); if (!hill) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const g0 = goalCol0(); if (g0 < 0) return;
  const x0 = g0 * cs, x1 = sub.worldWidth;   // span the whole fruitable summery zone, ending AT the map edge
  const wWorld = x1 - x0, hWorld = wWorld * (hill.height / hill.width);
  const sw = wWorld * z, sh = hWorld * z;
  const left = camera.worldToScreen(x0, sub.surfaceY);
  const by = left.y + sh * 0.04;                                     // flat base sits just ON the soil line (like the city skylines), hill rising above
  if (left.x > camera.viewW || left.x + sw < 0) return;
  withWorldClip(() => ctx.drawImage(hill, left.x, by - sh, sw, sh));
}
function drawGoalProps() {
  const bush = asset('goalbush'); if (!bush) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const g0 = goalCol0(); if (g0 < 0) return;
  const aspect = bush.width / bush.height;
  withWorldClip(() => {
    for (const [col, hCells] of [[g0 + 4, 3.0], [g0 + 9, 2.2]]) {    // a big cluster + a smaller one, spread across the hill
      if (col < 0 || col >= sub.cols) continue;
      const hWorld = cs * hCells, wWorld = hWorld * aspect;
      const s = camera.worldToScreen((col + 0.5) * cs, sub.surfaceY);
      const sw = wWorld * z, sh = hWorld * z;
      const by = s.y + sh * 0.05;                                    // base on the soil line, sitting on the ground (not sunk, not floating)
      if (s.x < -sw || s.x > camera.viewW + sw) continue;
      ctx.drawImage(bush, s.x - sw / 2, by - sh, sw, sh);
    }
  });
}

// Nematodes: small pale wriggling worms. They writhe in place, tint reddish
// while feeding, and glisten green while stuck by a fresh Excrete. The Excrete
// action fires a brief sticky pulse over the network.
function drawNematodes(time) {
  const worms = state.nematodes;
  const sub = state.substrate;
  const z = camera.zoom;
  const cs = sub.cellSize;

  // Excrete pulse: a sticky green wash over the colony, fading over ~450ms.
  const flashAge = time - excreteFlashStart;
  if (flashAge >= 0 && flashAge < 450 && state.active) {
    const a = 0.35 * (1 - flashAge / 450);
    const r = state.config.actions.excrete.range * z;
    ctx.save();
    ctx.fillStyle = `rgba(150,210,140,${a})`;
    const nodes = state.active.nodes;
    for (let i = 0; i < nodes.length; i += 3) {     // subsample — the blobs union up
      const sp = camera.worldToScreen(nodes[i].x, nodes[i].y);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  if (!worms || !worms.length) return;

  // --- sight-range overlay: a soft glow clipped to what the worm can SEE (rock
  // blocks its line of sight), shown for SEARCHING worms (a worm that's already
  // locked on is coming regardless, so its range adds nothing but clutter). ---
  {
    const sight = state.config.nematodes.sightRadius;
    for (const w of worms) {
      // Shown for any worm the player has TAPPED, plus the dev "Worm Vision" overlay.
      if (!(w.showSight || (showNematodeVision && !w.sees))) continue;
      drawOccludedSight(w.x, w.y, sight, '165,205,115', 0.10);
    }
  }

  ctx.save();
  ctx.lineCap = 'round';
  const len = Math.max(7, cs * 0.55 * z);           // worm body length, px
  for (const w of worms) {
    const sp = camera.worldToScreen(w.x, w.y);
    const ang = w.heading || 0;
    const dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
    const wig = (w.stuck > 0 ? 0.2 : 1) * len * 0.14;
    const segs = 5;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const along = (f - 0.5) * len;
      const off = Math.sin(time * 0.0035 + (w.phase || 0) + f * 6) * wig;   // gentle wriggle (~50% slower = less frantic)
      const x = sp.x + dx * along + px * off, y = sp.y + dy * along + py * off;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = w.stuck > 0 ? 'rgba(150,215,140,0.92)'
      : w.feeding ? 'rgba(232,180,150,0.94)'
        : 'rgba(228,216,190,0.82)';
    ctx.lineWidth = Math.max(1.4, 2.3 * z);
    ctx.stroke();
    // tiny darker head at the leading end
    const hx = sp.x + dx * len * 0.5, hy = sp.y + dy * len * 0.5;
    ctx.fillStyle = 'rgba(120,90,70,0.92)';
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.1, 1.7 * z), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawTargetingCursor(time) {
  // Dev worm-placement reticle (independent of the action targeting below).
  if (placingWorm) {
    const rect = canvas.getBoundingClientRect();
    const sp = { x: mouse.x - rect.left, y: mouse.y - rect.top };
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.008);
    ctx.save();
    ctx.strokeStyle = `rgba(228,216,190,${0.6 + 0.3 * pulse})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(228,216,190,0.95)';
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // A directional grow is mid press-drag: show where growth starts and which way.
  if (aim) { drawAimLine(time); return; }

  // Card awaiting its FIRST touch: draw NO pre-touch aim line — it would anchor a
  // source before you've decided where to grow. Single-tap targets resolve on tap;
  // directional grows resolve via the press-drag aim above. So targeting mode shows
  // only the hint text / "Aiming" chip until you act.
  if (ui && ui.pendingCard) return;

  const sel = ui && ui.selectedAction;
  if (!sel) return;
  const rect = canvas.getBoundingClientRect();
  const w = camera.screenToWorld(mouse.x - rect.left, mouse.y - rect.top);
  if (sel === 'addSubstrate') {
    const rad = state.config.actions.addSubstrate.radius * state.substrate.cellSize * camera.zoom;
    const s = camera.worldToScreen(w.x, w.y);
    ctx.save();
    ctx.strokeStyle = w.y > state.substrate.surfaceY ? 'rgba(120,220,140,0.8)' : 'rgba(220,120,120,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (sel === 'amputate') {
    const rad = state.config.actions.amputate.radius;
    const r2 = rad * rad;
    const s = camera.worldToScreen(w.x, w.y);
    ctx.save();
    // Highlight every strand that would be cut out within the radius.
    ctx.strokeStyle = 'rgba(255,90,90,0.9)';
    ctx.lineWidth = 2;
    for (const n of state.active.nodes) {
      const dx = n.x - w.x, dy = n.y - w.y;
      if (dx * dx + dy * dy > r2 || n.parentId == null) continue;
      const p = state.active.byId.get(n.parentId);
      if (!p) continue;
      const a = camera.worldToScreen(p.x, p.y), b = camera.worldToScreen(n.x, n.y);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // The cut radius itself.
    ctx.strokeStyle = 'rgba(255,120,120,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(s.x, s.y, rad * camera.zoom, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (sel === 'attackAnts') {
    // Mark the nest that this click would bomb (nearest within pick radius).
    const pick = state.config.actions.attackAnts.pickRadius;
    let best = null, bestD2 = pick * pick;
    for (const nest of (state.ants || [])) {
      const dx = nest.x - w.x, dy = nest.y - w.y, d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) { bestD2 = d2; best = nest; }
    }
    ctx.save();
    if (best) {
      // Encircle the whole underground colony (entrance + every chamber).
      let minX, maxX, minY, maxY;
      const colKey = colonyKey(best);
      if (colKey) {
        const img = asset(colKey);
        const w = state.substrate.cellSize * COLONY_W_CELLS, h = w * (img.height / img.width);
        minX = best.x - w / 2; maxX = best.x + w / 2; minY = best.y; maxY = best.y + h;
      } else {
        const lay = nestLayout(best, state.substrate);
        minX = best.x; maxX = best.x; minY = best.y; maxY = best.y;
        for (const ch of lay.chambers) {
          minX = Math.min(minX, ch.x - ch.r); maxX = Math.max(maxX, ch.x + ch.r);
          minY = Math.min(minY, ch.y - ch.r); maxY = Math.max(maxY, ch.y + ch.r);
        }
      }
      const tl = camera.worldToScreen(minX, minY), br = camera.worldToScreen(maxX, maxY);
      const cx = (tl.x + br.x) / 2, cy = (tl.y + br.y) / 2;
      const rx = Math.abs(br.x - tl.x) / 2 + 14, ry = Math.abs(br.y - tl.y) / 2 + 14;
      const pulse = 0.6 + 0.4 * Math.sin(time * 0.008);
      ctx.strokeStyle = `rgba(255,90,60,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      // crosshair at the colony centre
      ctx.beginPath();
      ctx.moveTo(cx - rx - 12, cy); ctx.lineTo(cx - rx + 4, cy);
      ctx.moveTo(cx + rx - 4, cy); ctx.lineTo(cx + rx + 12, cy);
      ctx.moveTo(cx, cy - ry - 12); ctx.lineTo(cx, cy - ry + 4);
      ctx.moveTo(cx, cy + ry - 4); ctx.lineTo(cx, cy + ry + 12);
      ctx.stroke();
    } else {
      // no nest in range — a faint reticle at the cursor
      const sp = camera.worldToScreen(w.x, w.y);
      ctx.strokeStyle = 'rgba(200,200,200,0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 16, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

// The directional press-drag aim overlay: an origin ring where growth starts, a
// bright arrow showing the projected reach + direction, and a faint guide out to
// the finger. When the player drags too far it flips to a red "cancel" marker and
// the arrow vanishes (releasing then does nothing). Screen-space; recomputed each
// frame from the live world coords so it stays put under zoom.
function drawAimLine(time) {
  const o = camera.worldToScreen(aim.origin.x, aim.origin.y);
  const glow = 0.55 + 0.45 * Math.sin(time * 0.006);
  const GREEN = '127,230,163', RED = '224,106,106';
  ctx.save();

  if (aim.cancelled) {
    // Dragged too far → cancel: red ring + cross-out, no aim line.
    ctx.strokeStyle = `rgba(${RED},0.95)`; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(o.x, o.y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x - 6, o.y - 6); ctx.lineTo(o.x + 6, o.y + 6);
    ctx.moveTo(o.x + 6, o.y - 6); ctx.lineTo(o.x - 6, o.y + 6);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Origin ring + dot — where growth will start. (Kept translucent so the aimer
  // reads as a soft overlay, not a bold graphic stuck over the scene.)
  ctx.strokeStyle = `rgba(${GREEN},${0.42 + 0.18 * glow})`; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(o.x, o.y, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(${GREEN},0.6)`;
  ctx.beginPath(); ctx.arc(o.x, o.y, 2.6, 0, Math.PI * 2); ctx.fill();

  if (aim.dragged) {
    // Aim direction (world) from the source toward the drag point.
    const ddx = aim.cur.x - aim.origin.x, ddy = aim.cur.y - aim.origin.y;
    const len = Math.hypot(ddx, ddy) || 1, ux = ddx / len, uy = ddy / len;
    // Bright arrow spans the projected growth reach; its head is the growth tip.
    const tip = camera.worldToScreen(aim.origin.x + ux * aim.reach, aim.origin.y + uy * aim.reach);
    const end = camera.worldToScreen(aim.cur.x, aim.cur.y);
    // Faint dashed guide from the tip out to the finger (you're still steering).
    ctx.strokeStyle = `rgba(${GREEN},0.28)`; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    // Solid growth path, origin → tip — translucent so it doesn't stick out.
    ctx.strokeStyle = `rgba(${GREEN},${0.4 + 0.12 * glow})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    // Arrowhead at the tip, pointing along the aim.
    const ang = Math.atan2(tip.y - o.y, tip.x - o.x), ah = 10;
    ctx.fillStyle = `rgba(${GREEN},${0.46 + 0.12 * glow})`;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - ah * Math.cos(ang - 0.4), tip.y - ah * Math.sin(ang - 0.4));
    ctx.lineTo(tip.x - ah * Math.cos(ang + 0.4), tip.y - ah * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// --- boot -------------------------------------------------------------------
// Default to a random SANDBOX on load (we're playtesting the ant threat, which
// only appears in the sandbox). "#puzzle" boots the fixed puzzle; "#notrich"
// (or "#ants") boots a Trichoderma-free sandbox for testing the ants in
// isolation. The matching buttons switch modes at any time.
setupInput();
// Preload art assets, then invalidate the per-map caches that gate on assets
// (rock formations + surface props) — they may have been computed empty on the
// first frame before the async load finished.
loadAssets().then(() => {
  uiDirty = true; _rockState = null; _formState = null; _propState = null; _mtnState = null; _cityState = null; _lakeState = null;
  if (substrateRenderer) substrateRenderer.rebake();
  assetsReady = true;
  _revealPending = true;   // first map: fade in after the first art-complete frame draws
  initMusic();   // only NOW start streaming a random track — game art loads first
  initSfx();     // decode the grow SFX in the background so the first grow has sound
});
// Safety net: if the manifest fetch hangs, reveal anyway rather than sit blank.
setTimeout(() => { if (!assetsReady) { assetsReady = true; _revealPending = true; } initMusic(); initSfx(); }, 4000);
// Warm the card-face image cache so drafts / the hand don't pop in one by one.
preloadCardArt(CARD_DATA.map((c) => cardSlug(c.name)));
if (location.hash === '#puzzle') startPuzzle();
else if (location.hash === '#notrich' || location.hash === '#ants') { noTrich = true; currentLevel = 1; startRun(); }
else if (location.hash === '#dev') { chosenSpecies = null; currentLevel = 1; startRun(); }   // skip the picker
else if (location.hash === '#tutorial') { tutorialPending = true; showPicker(); }             // force the first-run tutorial (testing)
else showTitleScreen({          // title → Survival New (wipe unlocks) / Continue (keep unlocks) → picker
  // The tutorial runs ONCE — the first time NEW is pressed (arm it here if unseen).
  onNew: () => { resetProgress(); tutorialPending = !tutorialSeen(); showPicker(); },
  onContinue: () => showPicker(),
  // TEMP dev: jump straight into the tutorial with a random starter species.
  onDevTutorial: () => {
    chosenSpecies = SPECIES[(Math.random() * SPECIES.length) | 0];
    currentLevel = 1; carryOver = null; tutorialDevForce = true;
    startRun();
  },
});
requestAnimationFrame(frame);
