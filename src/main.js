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
let noTrich = false;                  // testing aid: spawn sandbox maps with no Trichoderma
const networkRenderers = new Map();

let uiDirty = true;
let previewFruit = false;
let previewFruitPoints = [];
let lastTime = 0;                     // most recent frame timestamp (for action-driven effects)
let excreteFlashStart = -1e9;         // when the last Excrete fired, for the sticky pulse
let showNematodeVision = true;        // dev overlay: nematode sight range + line of sight
let placingWorm = false;              // dev: click the map to drop a nematode
const mouse = { x: 0, y: 0, down: false, moved: false, startX: 0, startY: 0 };
const pointers = new Map();          // active pointers (touch/mouse) by id
let pinchDist = 0;                    // last two-finger spread, for pinch-zoom
let lastTapTime = 0, lastTapX = 0, lastTapY = 0; // double-tap-to-refit

// --- setup / restart --------------------------------------------------------
function start(seed) {
  let cfg = CONFIG;
  if (noTrich) {
    // A trich-free sandbox (testing aid): clone CONFIG so the global stays
    // intact, and disable both the initial clouds and respawns.
    cfg = JSON.parse(JSON.stringify(CONFIG));
    cfg.trichoderma.initialPatches = 0;
    cfg.trichoderma.respawnChance = 0;
  }
  begin(createState(cfg, seed));
}
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
  onEndTurn() {
    endTurn(state);
    substrateRenderer.markDirty();
    for (const net of state.networks) rendererFor(net).markStructureDirty();
    if (state.runOver) ui.showOverlay(state.runResult);
    uiDirty = true;
  },
  onRestart() {
    noTrich = false;                  // "New Map" returns to a normal (mould) map
    start((Date.now() & 0x7fffffff) || 1);
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
  if (name === 'excrete') excreteFlashStart = lastTime;   // trigger the sticky pulse
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
    if (placingWorm) {
      // Dev placement: each tap drops a worm where you click (mode stays on).
      const w = camera.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      spawnNematodeAt(state, w.x, w.y);
      state.log('DEV: placed a nematode.', 'dev');
      uiDirty = true;
      return;
    }
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
    else if (e.code === 'Escape') { ui.setSelectedAction(null); placingWorm = false; uiDirty = true; }
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
  lastTime = time;
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
  drawNematodes(time);
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

// --- Ant rendering helpers --------------------------------------------------

// Tiny deterministic PRNG so a nest's dug-out colony + ant placement stay
// STABLE every frame (no flicker) yet differ between nests.
function antRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
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
      pts.push({ x: a.x + (b.x - a.x) * f + px * off, y: a.y + (b.y - a.y) * f + py * off, s: ss });
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
          const sp = camera.worldToScreen(sa.x - Math.sin(sa.ang) * off, sa.y + Math.cos(sa.ang) * off);
          drawAnt(ctx, sp.x, sp.y, lane > 0 ? sa.ang : sa.ang + Math.PI, Math.max(1.6, 2.3 * z), 1);
        }
      }
    }

    // === the underground colony ===
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
    // 4) surface entrance hole
    const ent = camera.worldToScreen(nest.x, nest.y);
    ctx.fillStyle = `rgba(${(14 * dim) | 0},${(8 * dim) | 0},${(4 * dim) | 0},0.92)`;
    ctx.beginPath(); ctx.ellipse(ent.x, ent.y, Math.max(4, 6 * z), Math.max(2, 3.2 * z), 0, 0, Math.PI * 2); ctx.fill();

    // 5) HP bar above the entrance
    const bw = Math.max(26, 34 * z), bh = Math.max(3, 4 * z), by = ent.y - Math.max(12, 16 * z);
    const hpFrac = Math.max(0, nest.hp / nest.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(ent.x - bw / 2, by, bw, bh);
    ctx.fillStyle = hpFrac > 0.5 ? '#5fbf52' : hpFrac > 0.25 ? '#d8b13a' : '#d85a3a';
    ctx.fillRect(ent.x - bw / 2, by, bw * hpFrac, bh);
  }
  ctx.restore();
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

  // --- dev vision overlay: how far each worm sees + its line of sight ---
  if (showNematodeVision) {
    const sight = state.config.nematodes.sightRadius * z;
    ctx.save();
    for (const w of worms) {
      const sp = camera.worldToScreen(w.x, w.y);
      if (w.seeX != null) {
        // sees a strand (clear LOS) — solid green line to it
        const t = camera.worldToScreen(w.seeX, w.seeY);
        ctx.strokeStyle = 'rgba(120,240,140,0.7)'; ctx.lineWidth = 1.8; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(t.x, t.y); ctx.stroke();
      } else {
        // searching — show its sight range (dashed boundary) so you can read
        // when it'll spot you
        ctx.strokeStyle = 'rgba(160,220,140,0.28)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sight, 0, Math.PI * 2); ctx.stroke();
        if (w.blockX != null) {
          // a strand is in range but rock blocks the view — red dashed line to the block
          const b = camera.worldToScreen(w.blockX, w.blockY);
          ctx.strokeStyle = 'rgba(245,110,90,0.65)'; ctx.lineWidth = 1.8; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.fillStyle = 'rgba(245,110,90,0.85)';
          ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
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
      const off = Math.sin(time * 0.013 + (w.phase || 0) + f * 6) * wig;
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
      const lay = nestLayout(best, state.substrate);
      let minX = best.x, maxX = best.x, minY = best.y, maxY = best.y;
      for (const ch of lay.chambers) {
        minX = Math.min(minX, ch.x - ch.r); maxX = Math.max(maxX, ch.x + ch.r);
        minY = Math.min(minY, ch.y - ch.r); maxY = Math.max(maxY, ch.y + ch.r);
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

// --- boot -------------------------------------------------------------------
// Default to a random SANDBOX on load (we're playtesting the ant threat, which
// only appears in the sandbox). "#puzzle" boots the fixed puzzle; "#notrich"
// (or "#ants") boots a Trichoderma-free sandbox for testing the ants in
// isolation. The matching buttons switch modes at any time.
setupInput();
if (location.hash === '#puzzle') startPuzzle();
else if (location.hash === '#notrich' || location.hash === '#ants') { noTrich = true; start((Date.now() & 0x7fffffff) || 1); }
else start((Date.now() & 0x7fffffff) || 1);
requestAnimationFrame(frame);
