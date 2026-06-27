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
import { endTurn } from './engine/turn.js';
import { Camera } from './render/camera.js';
import { SubstrateRenderer } from './render/substrate.js';
import { NetworkRenderer, drawFruitBodies } from './render/network.js';
import { Lighting } from './render/lighting.js';
import { UI } from './render/ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const camera = new Camera();
const lighting = new Lighting(CONFIG);

let state, ui, substrateRenderer;
const networkRenderers = new Map();

let uiDirty = true;
let previewFruit = false;
let previewFruitPoints = [];
const mouse = { x: 0, y: 0, down: false, moved: false, startX: 0, startY: 0 };
const pointers = new Map();          // active pointers (touch/mouse) by id
let pinchDist = 0;                    // last two-finger spread, for pinch-zoom
let lastTapTime = 0, lastTapX = 0, lastTapY = 0; // double-tap-to-refit

// --- setup / restart --------------------------------------------------------
function start(seed) { begin(createState(CONFIG, seed)); }
function startPuzzle() { begin(createPuzzleState(CONFIG)); }

function begin(newState) {
  state = newState;
  buildRenderers();
  if (CONFIG.dev.enabled) window.__game = { get state() { return state; }, camera, performAction, endTurn };
  if (ui) ui.setState(state); else ui = new UI(state, handlers);
  ui.hideOverlay();
  ui.setSelectedAction(null);
  previewFruit = false;
  previewFruitPoints = [];
  resize();
  if (state.mode === 'puzzle') {
    // show the whole level so the layout (rocks, food, chest, mould) reads;
    // pad the sides so the start (far left) and chest (far right) aren't jammed
    // against the screen edges / under the HUD + dev panels.
    camera.fitBounds({ minX: -160, minY: state.substrate.surfaceY - 30,
      maxX: state.substrate.worldWidth + 160, maxY: state.substrate.worldHeight }, 30);
  } else {
    camera.fitBounds(expandedBounds(), 120);
  }
  uiDirty = true;
}

function buildRenderers() {
  substrateRenderer = new SubstrateRenderer(state.substrate, state.config, state.seed);
  networkRenderers.clear();
  for (const net of state.networks) networkRenderers.set(net.id, new NetworkRenderer(net, state.config));
}

function rendererFor(net) {
  let r = networkRenderers.get(net.id);
  if (!r) { r = new NetworkRenderer(net, state.config); networkRenderers.set(net.id, r); }
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
  // The mould steps on EVERY action, so both layers may have changed: clouds
  // moved / ate (substrate) and the rot advanced along filaments (structure).
  substrateRenderer.markDirty();
  rendererFor(state.active).markStructureDirty();
  if (name === 'fruit') state.active.computeFruitPoints(state.substrate);
  if (state.runOver) ui.showOverlay(state.runResult);
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

function pointerSpread() {
  const p = [...pointers.values()];
  if (p.length < 2) return 0;
  return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
}
function pointerMid() {
  const p = [...pointers.values()];
  return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
}

function setupInput() {
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      mouse.down = true; mouse.moved = false;
      mouse.startX = e.clientX; mouse.startY = e.clientY;
      mouse.x = e.clientX; mouse.y = e.clientY;
    } else if (pointers.size === 2) {
      pinchDist = pointerSpread();
      mouse.moved = true; // a second finger cancels tap/pan
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
    if (mouse.moved) return;
    const rect = canvas.getBoundingClientRect();
    if (!ui.selectedAction) {
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

  substrateRenderer.draw(ctx, camera, time);

  for (const net of state.networks) {
    rendererFor(net).draw(ctx, camera, time);
    if (net.fruited && net.fruitPoints.length) drawFruitBodies(ctx, camera, net.fruitPoints, time, false);
  }

  // Fruit preview (where would it fruit?) — uses the cache from hover-start.
  if (previewFruit && !state.runOver) {
    drawFruitBodies(ctx, camera, previewFruitPoints, time, true);
  }

  // Dynamic lighting: dim the earth, then add the colony's glow back in.
  lighting.compose(ctx, camera, state, networkRenderers, substrateRenderer, time);

  // Atmosphere drifts on top of the lighting so spores read as bright motes.
  substrateRenderer.drawAtmosphere(ctx, camera, time);

  drawChest(time);
  drawCloudSight();
  drawAnts(time);
  drawTargetingCursor(time);

  if (uiDirty) { ui.update(); uiDirty = false; }
  requestAnimationFrame(frame);
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

// Show each roaming mould cloud's sight range — the area within which it will
// sense and head for food / your colony. A soft greenish rim near the edge.
function drawCloudSight() {
  const clouds = state.clouds;
  if (!clouds || !clouds.length) return;
  const sight = state.config.trichoderma.sightRadius * camera.zoom;
  ctx.save();
  for (const c of clouds) {
    const s = camera.worldToScreen(c.cx, c.cy);
    const a = c.dying ? 0.05 : 0.10;
    // a soft rim just inside the edge marks the range (no hard line needed)
    const g = ctx.createRadialGradient(s.x, s.y, sight * 0.78, s.x, s.y, sight);
    g.addColorStop(0, 'rgba(150,190,70,0)');
    g.addColorStop(1, `rgba(150,190,70,${a})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, sight, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// Ants: each nest is a surface mound running an impassable trail to its target
// food, with little ants marching along it. A dormant nest (no reachable food)
// is dimmed. Nests carry an HP bar so the player can see how many bombs remain.
function drawAnts(time) {
  const ants = state.ants;
  if (!ants || !ants.length) return;
  const sub = state.substrate;
  const z = camera.zoom;
  ctx.save();
  for (const nest of ants) {
    const path = nest.path || [];
    const total = path.length - 1;

    // --- trail line through the path cells ---
    if (total >= 1) {
      ctx.lineWidth = Math.max(2, 3.5 * z);
      ctx.strokeStyle = nest.dormant ? 'rgba(110,85,55,0.30)' : 'rgba(55,38,22,0.55)';
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const c = sub.cellCenter(path[i].col, path[i].row);
        const p = camera.worldToScreen(c.x, c.y);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // --- marching ants: dots flowing toward the food end ---
      if (!nest.dormant) {
        const dots = Math.min(14, Math.max(3, total));
        const flow = (time * 0.00045) % 1;
        ctx.fillStyle = 'rgba(20,14,8,0.92)';
        for (let d = 0; d < dots; d++) {
          const t = (flow + d / dots) % 1;
          const fp = t * total;
          const i0 = Math.min(total - 1, Math.floor(fp)), frac = fp - i0;
          const a = sub.cellCenter(path[i0].col, path[i0].row);
          const b = sub.cellCenter(path[i0 + 1].col, path[i0 + 1].row);
          const sp = camera.worldToScreen(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac);
          ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(1.3, 2.2 * z), 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // --- nest mound at the surface ---
    const s = camera.worldToScreen(nest.x, nest.y);
    const rad = Math.max(13, 16 * z);
    ctx.save();
    ctx.translate(s.x, s.y);
    const dim = nest.dormant ? 0.6 : 1;
    const g = ctx.createRadialGradient(0, -rad * 0.3, rad * 0.2, 0, 0, rad);
    g.addColorStop(0, `rgba(${Math.round(125 * dim)},${Math.round(90 * dim)},${Math.round(55 * dim)},1)`);
    g.addColorStop(1, `rgba(${Math.round(58 * dim)},${Math.round(38 * dim)},${Math.round(20 * dim)},1)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-rad, 0);
    ctx.quadraticCurveTo(0, -rad * 1.25, rad, 0);
    ctx.closePath();
    ctx.fill();
    // entrance hole
    ctx.fillStyle = 'rgba(10,6,3,0.9)';
    ctx.beginPath(); ctx.ellipse(0, -rad * 0.12, rad * 0.28, rad * 0.20, 0, 0, Math.PI * 2); ctx.fill();

    // HP bar above the mound
    const bw = rad * 1.8, bh = Math.max(3, 4 * z), by = -rad * 1.55;
    const frac = Math.max(0, nest.hp / nest.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-bw / 2, by, bw, bh);
    ctx.fillStyle = frac > 0.5 ? '#5fbf52' : frac > 0.25 ? '#d8b13a' : '#d85a3a';
    ctx.fillRect(-bw / 2, by, bw * frac, bh);
    ctx.restore();
  }
  ctx.restore();
}

function drawTargetingCursor(time) {
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
      const sp = camera.worldToScreen(best.x, best.y);
      const pulse = 0.6 + 0.4 * Math.sin(time * 0.008);
      ctx.strokeStyle = `rgba(255,90,60,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(20, 22 * camera.zoom), 0, Math.PI * 2); ctx.stroke();
      // crosshair
      ctx.beginPath();
      ctx.moveTo(sp.x - 30, sp.y); ctx.lineTo(sp.x - 14, sp.y);
      ctx.moveTo(sp.x + 14, sp.y); ctx.lineTo(sp.x + 30, sp.y);
      ctx.moveTo(sp.x, sp.y - 30); ctx.lineTo(sp.x, sp.y - 14);
      ctx.moveTo(sp.x, sp.y + 14); ctx.lineTo(sp.x, sp.y + 30);
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

// --- boot -------------------------------------------------------------------
// Default to a random SANDBOX on load (we're playtesting the ant threat, which
// only appears in the sandbox). "#puzzle" in the URL boots the fixed puzzle;
// the "Puzzle 🧩" button switches to it at any time.
setupInput();
if (location.hash === '#puzzle') startPuzzle();
else start((Date.now() & 0x7fffffff) || 1);
requestAnimationFrame(frame);
