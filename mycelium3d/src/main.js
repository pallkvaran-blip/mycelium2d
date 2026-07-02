// =============================================================================
// main.js — wiring: input -> actions (mutating engine state) -> renderers
// (reading state). Simulation and rendering stay strictly separated; this file
// is the only place they meet.
// =============================================================================

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createState } from './engine/state.js';
import { performAction, ACTIONS, devSpawnTrichoderma } from './engine/actions.js';
import { spawnNematodeAt } from './engine/nematodes.js';
import { createScene } from './render/scene.js';
import { TerrainRenderer } from './render/terrain.js';
import { StrandRenderer } from './render/strands.js';
import { CreatureRenderer } from './render/creatures.js';
import { FlightControls } from './render/controls.js';
import { UI } from './render/ui.js';

const canvas = document.getElementById('game');
const view = createScene(CONFIG, canvas);

let state, ui, controls;
let terrain = null, strands = null, creatures = null;
const goalVec = new THREE.Vector3();

function start(seed) {
  state = createState(CONFIG, seed);

  if (terrain) terrain.dispose();
  if (strands) strands.dispose();
  if (creatures) creatures.dispose();
  terrain = new TerrainRenderer(state.substrate, CONFIG, view.scene);
  strands = new StrandRenderer(state.active, CONFIG, view.scene);
  creatures = new CreatureRenderer(state, view.scene);

  if (!controls) {
    controls = new FlightControls(view.camera, canvas, state.substrate, CONFIG, view.scene);
    controls.onApply = onCursorApply;
    controls.onLockChange = (locked) => ui && ui.setLockState(locked);
  } else {
    controls.sub = state.substrate;
  }
  goHome();
  controls.setSelectedAction(null);

  if (ui) ui.setState(state); else ui = new UI(state, handlers);
  ui.setLockState(controls.locked);

  if (CONFIG.dev.enabled) {
    window.__game = {
      get state() { return state; },
      performAction, camera: view.camera, controls, start, view, ACTIONS,
      // UI-path action (keeps renderers + HUD in sync) — used by tests too.
      act: (name, ctx) => handlers.onAction(name, ctx),
    };
  }
}

// Spawn hovering just south-east of the colony seed, looking at it (the goal
// arrow then points the way east).
function goHome() {
  const root = state.active.root || { x: 100, y: -160, z: state.substrate.worldBreadth / 2 };
  const px = root.x + 240, py = root.y - 60, pz = root.z + 300;
  view.camera.position.set(px, Math.max(-(state.substrate.worldDepth - 20), py), pz);
  const dx = root.x - px, dy = (root.y - 60) - py, dz = root.z - pz;
  controls.yaw = Math.atan2(-dx, -dz);
  controls.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  controls.vel.set(0, 0, 0);
  controls._applyLook();
}

// --- action plumbing ----------------------------------------------------------
function afterAction(name, res) {
  if (res && res.ok) {
    strands.markStructureDirty();
    terrain.refreshFood();
    creatures.refresh();
    if (name === 'fruit') creatures.showFruitBodies(state.active.fruitPoints);
    if (state.runOver) {
      document.exitPointerLock && document.exitPointerLock();
      ui.setSelectedAction(null);
      ui.showOverlay(state.runResult);
    }
  }
  ui.update();
}

const handlers = {
  onAction(name, ctx) {
    const res = performAction(state, name, ctx || {});
    afterAction(name, res);
  },
  onSelectAction(name) {
    controls.setSelectedAction(name);
  },
  onFruitPreview(on) {
    if (on && !state.runOver) creatures.showFruitPreview(state.active.computeFruitPoints(state.substrate));
    else creatures.clearFruitPreview();
  },
  onRestart() {
    start((Date.now() & 0x7fffffff) || 1);
  },
  onHome() { goHome(); },
  onFaceGoal() {
    if (!terrain.goalPos) return;
    const cam = view.camera.position;
    const dx = terrain.goalPos.x - cam.x, dy = terrain.goalPos.y - cam.y, dz = terrain.goalPos.z - cam.z;
    controls.yaw = Math.atan2(-dx, -dz);
    controls.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    controls._applyLook();
  },
  onCheat(type) {
    const net = state.active;
    if (type === 'energy') { net.energy += CONFIG.dev.cheatEnergy; state.log(`DEV: +${CONFIG.dev.cheatEnergy} Energy.`, 'dev'); }
    else if (type === 'spores') { state.spores += CONFIG.dev.cheatSpores; state.log(`DEV: +${CONFIG.dev.cheatSpores} Spores.`, 'dev'); }
    else if (type === 'trichoderma') {
      const n = net.nodes.length ? net.nodes[Math.floor(state.rng() * net.nodes.length)] : null;
      if (n) devSpawnTrichoderma(state, n.x + state.rng.range(-25, 25), n.y - state.rng.range(10, 40), n.z + state.rng.range(-25, 25));
      creatures.refresh();
    }
    else if (type === 'nematode') {
      const n = net.nodes.length ? net.nodes[Math.floor(state.rng() * net.nodes.length)] : null;
      for (let i = 0; i < 3 && n; i++) {
        spawnNematodeAt(state, n.x + state.rng.range(-160, 160), n.y - state.rng.range(40, 160), n.z + state.rng.range(-160, 160));
      }
      state.log('DEV: spawned nematodes.', 'dev');
    }
    else if (type === 'reveal') {
      view.scene.fog.density = view.scene.fog.density > 0.0001 ? 0.00001 : CONFIG.render.fogDensity;
    }
    ui.update();
  },
};

// A locked click with a targeted action armed applies it at the cursor point.
function onCursorApply(point) {
  const sel = ui.selectedAction;
  if (!sel) return;
  const res = performAction(state, sel, { x: point.x, y: point.y, z: point.z });
  afterAction(sel, res);
}

// --- goal wayfinding ------------------------------------------------------------
function updateGoalArrow() {
  if (!terrain.goalPos || state.runOver) { ui.updateGoalArrow(false); return; }
  goalVec.copy(terrain.goalPos).project(view.camera);
  const W = window.innerWidth, H = window.innerHeight;
  const behind = goalVec.z > 1;
  let sx = (goalVec.x + 1) / 2 * W;
  let sy = (1 - goalVec.y) / 2 * H;
  if (behind) { sx = W - sx; sy = H - sy; }
  const onScreen = !behind && sx > 60 && sx < W - 60 && sy > 60 && sy < H - 60;
  if (onScreen) { ui.updateGoalArrow(false); return; }
  // clamp to the screen edge, point outward from centre
  const cx = W / 2, cy = H / 2;
  let dx = sx - cx, dy = sy - cy;
  if (behind && Math.abs(dx) < 1 && Math.abs(dy) < 1) { dx = 0; dy = 1; }
  const len = Math.hypot(dx, dy) || 1;
  const margin = 46;
  const scale = Math.min((W / 2 - margin) / Math.abs(dx || 1e-6), (H / 2 - margin) / Math.abs(dy || 1e-6));
  const ex = cx + dx * Math.min(1, scale);
  const ey = cy + dy * Math.min(1, scale);
  ui.updateGoalArrow(true, ex, ey, Math.atan2(dy, dx) + Math.PI / 2);
}

// --- render loop ------------------------------------------------------------------
let last = performance.now();
function frame(time) {
  const dt = Math.min(0.05, (time - last) / 1000);
  last = time;

  controls.update(dt);
  terrain.update(time);
  strands.update(time, dt);
  creatures.update(time, dt);

  ui.updateCursorReadout(controls.cursorDist, !!ui.selectedAction && controls.locked);
  updateGoalArrow();

  view.composer.render();
  requestAnimationFrame(frame);
}

start((Date.now() & 0x7fffffff) || 1);
requestAnimationFrame(frame);
