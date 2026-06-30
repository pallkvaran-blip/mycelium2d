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
import { Camera } from './render/camera.js';
import { SubstrateRenderer } from './render/substrate.js';
import { NetworkRenderer, drawFruitBodies } from './render/network.js';
import { Lighting } from './render/lighting.js';
import { UI } from './render/ui.js';
import { loadAssets, hasAsset, asset, pattern, assetMeta } from './render/assets.js';

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
let showNematodeVision = false;       // dev overlay: nematode sight range + line of sight (off by default — the rings cluttered the map)
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
  if (CONFIG.dev.enabled) window.__game = { get state() { return state; }, camera, performAction, tickWorld };
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
    // Traversal level: frame the whole width so the left→right journey (entry,
    // barriers, goal) reads at a glance — the player zooms in to work.
    camera.fitBounds({ minX: -120, minY: state.substrate.surfaceY - 80,
      maxX: state.substrate.worldWidth + 120, maxY: state.substrate.worldHeight }, 30);
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
    if (e.code === 'Escape') { ui.setSelectedAction(null); placingWorm = false; uiDirty = true; }
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
  drawTerrainAssets();          // optional image-based textures over the earth (gated)
  drawSubstrateLeaves();        // food piles rendered as heaped leaves (gated) — UNDER rocks
  drawRockPiles();              // lone boulders (gated) — over food/earth
  drawRockFormations();         // large AI rock-formation sprites (gated) — over food/earth, embedded in soil
  drawRockColumns();            // path-blocking vertical rock columns (gated) — barriers from the surface down
  drawLakes();                  // lake basins (matted) — over rocks so a boulder can't spill into the water
  drawMountains();              // mountain barriers rendered as a sprite over the wall (gated)
  drawCities();                 // city skylines over the concrete barriers (gated)
  drawSurfaceProps();           // optional above-ground sprites: trees/grass/houses (gated)

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

// Substrate = heaped leaves. Each food cell draws a small pile of oak/maple
// leaves; the pile SHRINKS as the cell is digested (fewer leaves), and every
// leaf's position/rotation/size/type is hashed from (col,row,k) so the heap is
// stable across frames and digestion peels leaves off the top. No glow.
function drawSubstrateLeaves() {
  const oak = asset('leafOak'), maple = asset('leafMaple');
  if (!oak && !maple) return;
  const leaves = [oak || maple, maple || oak];
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const base = cs * 0.64;                       // base leaf height in world units (kept tight to the cell)
  const MAXL = 11, margin = cs * 1.6 * z;       // more leaves per cell → a fuller heap once bundled
  sub.forEachCell((cell, col, row) => {
    if (cell.nutrient <= 0 || cell.rock) return;
    const ctr = sub.cellCenter(col, row);
    const s = camera.worldToScreen(ctr.x, ctr.y);
    if (s.x < -margin || s.x > camera.viewW + margin || s.y < -margin || s.y > camera.viewH + margin) return;
    const frac = Math.min(1, cell.nutrient / (cell.maxNutrient || 100));
    const count = Math.max(1, Math.round(MAXL * frac));
    // Pull this cell's leaves toward the local food centroid so a cluster reads
    // as ONE heaped pile (not a cross of separate cells). This also bundles
    // leaves inward — away from any nearby rock.
    let bx = 0, by = 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nb = sub.cellAt(col + dc, row + dr);
      if (nb && nb.nutrient > 0) { bx += dc; by += dr; }
    }
    const bl = Math.hypot(bx, by);
    const biasX = bl ? (bx / bl) * cs * 0.55 * z : 0;
    const biasY = bl ? (by / bl) * cs * 0.55 * z : 0;
    for (let k = 0; k < count; k++) {           // low k = bottom of the pile (eaten last)
      const h1 = _hashf(col * 7.1 + k * 13.3, row * 11.7 + k * 5.2);
      const h2 = _hashf(col * 3.3 + k * 17.1, row * 19.3 + k * 7.7);
      const h3 = _hashf(col * 23.7 + k * 2.1, row * 29.1 + k * 3.3);
      const img = leaves[h3 < 0.5 ? 0 : 1];
      if (!img) continue;
      const lh = base * (0.7 + h1 * 0.6) * z;
      const lw = lh * (img.width / img.height);
      const ox = (h1 * 2 - 1) * cs * 0.3 * z + biasX, oy = (h2 * 2 - 1) * cs * 0.28 * z + biasY;
      ctx.save();
      ctx.translate(s.x + ox, s.y + oy);
      ctx.rotate(h3 * Math.PI * 2);
      ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh);
      ctx.restore();
    }
  });
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
      // lakes (water) draw as water; formation + column cells draw as AI sprites
      if (!cell.rock || cell.water || cell.formation || cell.column || seen.has(id(col, row))) return;
      const cells = [];
      const q = [[col, row]]; seen.add(id(col, row));
      while (q.length) {
        const [c, r] = q.pop();
        cells.push(sub.cellCenter(c, r));
        for (const [dc, dr] of NB) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= sub.cols || nr >= sub.rows || seen.has(id(nc, nr))) continue;
          const ncell = sub.cellAt(nc, nr);
          if (ncell && ncell.rock && !ncell.water && !ncell.formation && !ncell.column) { seen.add(id(nc, nr)); q.push([nc, nr]); }
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
  const bh = cs * (1.95 + h1 * 0.55) * z * mult;
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

function drawRockFormations() {
  const groups = formationGroups();
  if (!groups.length) return;
  const sub = state.substrate, z = camera.zoom, cs = sub.cellSize;
  const soil = _rgb(state.config.render.soilDeep || '#2a1d12');
  for (const g of groups) {
    const img = g.key ? asset(g.key) : null;
    if (!img) {
      // Fallback: no formation sprites loaded — render as piled boulders so the
      // impassable mass is never invisible.
      const pal = ALL_ROCKS.filter(hasAsset);
      if (!pal.length) continue;
      const cells = g.cells.slice().sort((a, b) => a.y - b.y);
      for (const c of cells) drawBoulder(c, pal, 0, 1.0, cs, z);
      continue;
    }
    const b = g.bbox;
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const cx = (b.x0 + b.x1) / 2;
    const aspect = img.width / img.height;
    // Cover the footprint: size by width, but grow if needed so the image is at
    // least as tall as the footprint. Slight overhang so edges fully cover.
    let dw = bw * 1.08;
    let dh = dw / aspect;
    if (dh < bh * 1.02) { dh = bh * 1.02; dw = dh * aspect; }
    const embed = cs * 0.55;                         // bury the jagged base into the soil
    const sw = dw * z, sh = dh * z;
    const tl = camera.worldToScreen(cx - dw / 2, (b.y1 + embed) - dh);
    if (tl.x > camera.viewW + sw || tl.x + sw < 0 || tl.y > camera.viewH + sh || tl.y + sh < 0) continue;
    _blitFormation(img, sw, sh, tl.x, tl.y, z, cs, soil, true);
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
  cols.forEach((col, ci) => {
    const tanT = Math.tan(col.tilt);                       // whole-column lean (±30°)
    const cxw = (col.cx + colW / 2) * cs;                  // world X of the column centre at the surface
    const poke = cs * 0.45;                                // top rock just breaks the soil line
    const vSpan = col.depth * cs + poke;                   // vertical drop the stack must cover
    // Rock count scales with depth so each rock stays a CHUNKY, undistorted boulder
    // rather than being stretched to fill a deep column. 2–4 rocks, no repeats.
    let N = Math.max(2, Math.min(4, Math.round(col.depth / 2.4)));
    const styleNames = Object.keys(COLUMN_STYLES).filter((k) => COLUMN_STYLES[k].filter(hasAsset).length >= N);
    const pool = (styleNames.length
      ? COLUMN_STYLES[styleNames[Math.floor(_hashf(ci + 2, seed * 0.017) * styleNames.length) % styleNames.length]]
      : ROCKFORM_KEYS).filter(hasAsset);
    N = Math.min(N, pool.length);
    if (!N) return;
    const chosen = pool
      .map((k, i) => ({ k, r: _hashf(i + 1, seed * 0.019 + ci * 1.7) }))
      .sort((a, b) => a.r - b.r).map((o) => o.k).slice(0, N);   // distinct, no repeats
    const vh = vSpan / (1 + (N - 1) * (1 - overlap));      // vertical extent per rock
    const step = vh * (1 - overlap);                       // centre-to-centre drop down the column
    for (let i = 0; i < N; i++) {
      const img = asset(chosen[i]); if (!img) continue;
      const aspect = img.width / img.height;               // native (wide) — drawn UNDISTORTED
      const dh = vh, dw = vh * aspect;                     // chunky boulder at its natural proportions
      const ceY = sub.surfaceY - poke + vh / 2 + i * step; // world Y of this rock's centre
      const ceX = cxw + (ceY - sub.surfaceY) * tanT;       // drift sideways so the stack leans with the tilt
      const wob = (_hashf(ci * 9.1 + i, seed * 0.023) * 2 - 1) * 0.18;   // ±~10° upright wobble for variety
      const sw = dw * z, sh = dh * z;
      const sc = camera.worldToScreen(ceX, ceY);
      if (sc.x < -sw - sh || sc.x > camera.viewW + sw + sh) continue;
      _blitFormation(img, sw, sh, sc.x - sw / 2, sc.y - sh / 2, z, cs, soil, i === N - 1, wob);
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
    // city skylines are the man-made surface now.)
    if (surf.soil && r < 0.07 && c - lastTree > 3 && hasAsset('tree')) {
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
const MOUNTAIN_EMBED_FRAC = 0.34;  // foreground: bury the base, clip to soil line so the peak emerges
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
      bctx.filter = 'brightness(0.58) saturate(0.65) blur(1.2px)';  // atmospheric — push it far back
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
      ctx.globalAlpha = 0.4;                                  // distant haze
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
    let sw = cs * run.wCells * z;
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

  // --- sight-range overlay: a soft glow rim (same style as the mould's),
  // shown for SEARCHING worms (a worm that's already locked on is coming
  // regardless, so its range adds nothing but clutter). ---
  if (showNematodeVision) {
    const sight = state.config.nematodes.sightRadius * z;
    ctx.save();
    for (const w of worms) {
      if (w.sees) continue;
      const sp = camera.worldToScreen(w.x, w.y);
      const g = ctx.createRadialGradient(sp.x, sp.y, sight * 0.78, sp.x, sp.y, sight);
      g.addColorStop(0, 'rgba(165,205,115,0)');
      g.addColorStop(1, 'rgba(165,205,115,0.10)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sight, 0, Math.PI * 2); ctx.fill();
    }
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

// --- boot -------------------------------------------------------------------
// Default to a random SANDBOX on load (we're playtesting the ant threat, which
// only appears in the sandbox). "#puzzle" boots the fixed puzzle; "#notrich"
// (or "#ants") boots a Trichoderma-free sandbox for testing the ants in
// isolation. The matching buttons switch modes at any time.
setupInput();
// Preload art assets, then invalidate the per-map caches that gate on assets
// (rock formations + surface props) — they may have been computed empty on the
// first frame before the async load finished.
loadAssets().then(() => { uiDirty = true; _rockState = null; _formState = null; _propState = null; _mtnState = null; _cityState = null; _lakeState = null; if (substrateRenderer) substrateRenderer.rebake(); });
if (location.hash === '#puzzle') startPuzzle();
else if (location.hash === '#notrich' || location.hash === '#ants') { noTrich = true; start((Date.now() & 0x7fffffff) || 1); }
else start((Date.now() & 0x7fffffff) || 1);
requestAnimationFrame(frame);
