// =============================================================================
// main.js — wiring (A9).
//
// Connects input -> actions (mutating engine state) -> renderers (reading
// state). Keeps simulation and rendering strictly separated: this file is the
// only place they meet. The render loop draws the world (canvas) every frame;
// the DOM UI updates only when state changes.
// =============================================================================

import { CONFIG } from './config.js';
import { createState, newRun } from './engine/state.js';
import { performAction, devSpawnTrichoderma, ACTIONS } from './engine/actions.js';
import { endTurn } from './engine/turn.js';
import { Camera } from './render/camera.js';
import { SubstrateRenderer } from './render/substrate.js';
import { NetworkRenderer, drawFruitBodies } from './render/network.js';
import { UI } from './render/ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const camera = new Camera();

let state, ui, substrateRenderer;
const networkRenderers = new Map();

let uiDirty = true;
let previewFruit = false;
let previewFruitPoints = [];
const mouse = { x: 0, y: 0, down: false, moved: false, startX: 0, startY: 0 };

// --- setup / restart --------------------------------------------------------
function start(seed) {
  state = createState(CONFIG, seed);
  buildRenderers();
  if (CONFIG.dev.enabled) window.__game = { get state() { return state; }, camera, performAction, endTurn };
  if (ui) ui.setState(state); else ui = new UI(state, handlers);
  ui.hideOverlay();
  ui.setSelectedAction(null);
  previewFruit = false;
  previewFruitPoints = [];
  resize();
  camera.fitBounds(expandedBounds(), 120);
  uiDirty = true;
}

function buildRenderers() {
  substrateRenderer = new SubstrateRenderer(state.substrate, CONFIG);
  networkRenderers.clear();
  for (const net of state.networks) networkRenderers.set(net.id, new NetworkRenderer(net, CONFIG));
}

function rendererFor(net) {
  let r = networkRenderers.get(net.id);
  if (!r) { r = new NetworkRenderer(net, CONFIG); networkRenderers.set(net.id, r); }
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
  onAction(name, ctx) {
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
  onEndTurn() {
    endTurn(state);
    substrateRenderer.markDirty();
    for (const net of state.networks) rendererFor(net).markStructureDirty();
    if (state.runOver) ui.showOverlay(state.runResult);
    uiDirty = true;
  },
  onRestart() {
    start((Date.now() & 0x7fffffff) || 1);
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
    uiDirty = true;
  },
  onSliderChange() { uiDirty = true; },
  onFruitPreview(on) {
    previewFruit = on;
    // Compute the candidate fruit points once, on hover-start (a UI event, not
    // the render loop), so the per-frame draw just reuses this cache.
    if (on && !state.runOver) previewFruitPoints = state.active.computeFruitPoints(state.substrate);
  },
};

function afterAction(name, res) {
  if (!res || !res.ok) { uiDirty = true; return; }
  if (name === 'grow' || name === 'amputate') rendererFor(state.active).markStructureDirty();
  if (name === 'addSubstrate' || name === 'digest') substrateRenderer.markDirty();
  if (name === 'fruit') { state.active.computeFruitPoints(state.substrate); if (state.runOver) ui.showOverlay(state.runResult); }
  uiDirty = true;
}

// --- canvas interaction -----------------------------------------------------
function onCanvasClick(worldX, worldY) {
  const sel = ui.selectedAction;
  if (!sel) return;
  const a = ACTIONS[sel];
  if (a.target === 'point' || a.target === 'node') {
    const res = performAction(state, sel, { x: worldX, y: worldY });
    afterAction(sel, res);
    if (state.movesLeft <= 0 || state.active.energy < 0) ui.setSelectedAction(null);
  }
}

function setupInput() {
  canvas.addEventListener('pointerdown', (e) => {
    mouse.down = true; mouse.moved = false;
    mouse.startX = e.clientX; mouse.startY = e.clientY;
    mouse.x = e.clientX; mouse.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (mouse.down) {
      if (Math.abs(e.clientX - mouse.startX) + Math.abs(e.clientY - mouse.startY) > 4) mouse.moved = true;
      if (mouse.moved) camera.panByScreen(dx, dy);
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    mouse.down = false;
    if (!mouse.moved) {
      const rect = canvas.getBoundingClientRect();
      const w = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      onCanvasClick(w.x, w.y);
    }
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); handlers.onEndTurn(); }
    else if (e.code === 'Escape') { ui.setSelectedAction(null); uiDirty = true; }
    else if (e.code === 'KeyF') { camera.fitBounds(expandedBounds(), 120); }
  });

  window.addEventListener('resize', resize);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.setViewport(window.innerWidth, window.innerHeight);
}

// --- render loop ------------------------------------------------------------
function frame(time) {
  // background (outside the world bounds)
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  substrateRenderer.draw(ctx, camera);

  for (const net of state.networks) {
    rendererFor(net).draw(ctx, camera, time);
    if (net.fruited && net.fruitPoints.length) drawFruitBodies(ctx, camera, net.fruitPoints, time, false);
  }

  // Fruit preview (where would it fruit?) — uses the cache from hover-start.
  if (previewFruit && !state.runOver) {
    drawFruitBodies(ctx, camera, previewFruitPoints, time, true);
  }

  drawTargetingCursor(time);

  if (uiDirty) { ui.update(); uiDirty = false; }
  requestAnimationFrame(frame);
}

function drawTargetingCursor(time) {
  const sel = ui && ui.selectedAction;
  if (!sel) return;
  const rect = canvas.getBoundingClientRect();
  const w = camera.screenToWorld(mouse.x - rect.left, mouse.y - rect.top);
  if (sel === 'addSubstrate') {
    const rad = CONFIG.actions.addSubstrate.radius * state.substrate.cellSize * camera.zoom;
    const s = camera.worldToScreen(w.x, w.y);
    ctx.save();
    ctx.strokeStyle = w.y > state.substrate.surfaceY ? 'rgba(120,220,140,0.8)' : 'rgba(220,120,120,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  } else if (sel === 'amputate') {
    const target = state.active.nodeNear(w.x, w.y, CONFIG.actions.amputate.pickRadius * 2);
    if (target) {
      // Highlight the subtree that would be cut.
      const toCut = collectSubtree(state.active, target.id);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,90,90,0.9)';
      ctx.lineWidth = 2;
      for (const id of toCut) {
        const n = state.active.byId.get(id);
        if (!n || n.parentId == null) continue;
        const p = state.active.byId.get(n.parentId);
        if (!p) continue;
        const a = camera.worldToScreen(p.x, p.y), b = camera.worldToScreen(n.x, n.y);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const ts = camera.worldToScreen(target.x, target.y);
      ctx.fillStyle = 'rgba(255,90,90,0.95)';
      ctx.beginPath(); ctx.arc(ts.x, ts.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

function collectSubtree(net, nodeId) {
  const set = new Set(); const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop();
    if (set.has(id)) continue;
    set.add(id);
    const n = net.byId.get(id);
    if (n) for (const c of n.children) stack.push(c);
  }
  return set;
}

// --- boot -------------------------------------------------------------------
setupInput();
start((Date.now() & 0x7fffffff) || 1);
requestAnimationFrame(frame);
