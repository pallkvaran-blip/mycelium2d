// =============================================================================
// NetworkRenderer — the living mycelial network (A8, B2).
//
// REUSABLE per network: one instance per Network object. In Phase 1 a single
// network is drawn; later the same renderer draws elder networks at lower
// vitality/brightness (A5) without change.
//
// Bakes the static structure (filaments + nodes) to an offscreen canvas and
// re-bakes only when the structure changes (grow / amputate / prune). The
// dynamic layer — nutrient pulses, tip glow, sensing rings — animates each
// frame in screen space. Vitality drives overall brightness.
// =============================================================================

export class NetworkRenderer {
  constructor(network, config) {
    this.network = network;
    this.config = config;
    this.structureDirty = true;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.ceil(config.world.width);
    this.canvas.height = Math.ceil(config.world.height);
    this.octx = this.canvas.getContext('2d');
    this.edges = [];   // cached for pulse animation
    this.tips = [];    // cached for sensing rings / tip glow
  }

  markStructureDirty() { this.structureDirty = true; }

  _rebuildCaches() {
    const net = this.network;
    // Subtree sizes for organic tapering (thick trunk -> thin tips).
    const size = new Map();
    const order = [...net.nodes];
    for (const n of order) size.set(n.id, 1);
    // process leaves->root by repeatedly summing (n small so cheap)
    for (let i = order.length - 1; i >= 0; i--) {
      const n = order[i];
      if (n.parentId != null) {
        const ps = size.get(n.parentId) || 1;
        size.set(n.parentId, ps + (size.get(n.id) || 1));
      }
    }
    this.subtreeSize = size;

    this.edges = [];
    this.tips = [];
    for (const n of net.nodes) {
      if (n.children.length === 0) this.tips.push(n);
      if (n.parentId != null) {
        const p = net.byId.get(n.parentId);
        if (p) {
          this.edges.push({ ax: p.x, ay: p.y, bx: n.x, by: n.y, w: size.get(n.id) || 1, h: n.health });
        }
      }
    }

    // Frontier tips: only the OUTER edge of the network senses into the unknown
    // (interior sensing is obvious). In each angular sector around the centroid,
    // keep the tip furthest from the centre — that traces the perimeter.
    this.frontierTips = [];
    if (net.nodes.length > 1 && this.tips.length) {
      let cx = 0, cy = 0;
      for (const n of net.nodes) { cx += n.x; cy += n.y; }
      cx /= net.nodes.length; cy /= net.nodes.length;
      const SECTORS = 64;
      const best = new Array(SECTORS).fill(null);
      const bestD = new Array(SECTORS).fill(-1);
      for (const t of this.tips) {
        const dx = t.x - cx, dy = t.y - cy, d = dx * dx + dy * dy;
        let s = Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * SECTORS);
        if (s < 0) s = 0; else if (s >= SECTORS) s = SECTORS - 1;
        if (d > bestD[s]) { bestD[s] = d; best[s] = t; }
      }
      this.frontierTips = best.filter(Boolean);
    }
  }

  bakeStructure() {
    this._rebuildCaches();
    const { octx, network } = this;
    const r = this.config.render;
    octx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    octx.lineCap = 'round';

    // Filaments, thicker near the trunk.
    for (const n of network.nodes) {
      if (n.parentId == null) continue;
      const p = network.byId.get(n.parentId);
      if (!p) continue;
      const s = this.subtreeSize.get(n.id) || 1;
      const width = Math.min(5, 0.8 + Math.log(1 + s) * 0.7);
      // health tints the strand (sick strands go dim/brown)
      const tint = lerpColor([130, 90, 60], hexToRgb(r.filament), n.health);
      octx.strokeStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`;
      octx.lineWidth = width;
      octx.beginPath();
      octx.moveTo(p.x, p.y);
      octx.lineTo(n.x, n.y);
      octx.stroke();
    }

    // Soft, uniform node dots (no special glowing tips).
    octx.fillStyle = withAlpha(r.filament, 0.5);
    for (const n of network.nodes) {
      octx.beginPath();
      octx.arc(n.x, n.y, 1.4, 0, Math.PI * 2);
      octx.fill();
    }

    this.structureDirty = false;
  }

  // brightnessScale: extra multiplier for elders later (default 1).
  draw(ctx, camera, time, brightnessScale = 1) {
    if (this.structureDirty) this.bakeStructure();
    const r = this.config.render;
    const net = this.network;
    const brightness = (r.minBrightness + (1 - r.minBrightness) * net.vitality) * brightnessScale;

    // Static structure (baked), dimmed by vitality.
    const tl = camera.worldToScreen(0, 0);
    ctx.save();
    ctx.globalAlpha = brightness;
    ctx.drawImage(
      this.canvas, 0, 0, this.canvas.width, this.canvas.height,
      tl.x, tl.y, this.canvas.width * camera.zoom, this.canvas.height * camera.zoom,
    );
    ctx.restore();

    // --- Dynamic layer (screen space) ---
    // Sensing rings ONLY on the outer frontier tips (interior sensing is
    // obvious and the inner rings just add clutter).
    const sr = this.config.growth.sensingRadius * camera.zoom;
    ctx.save();
    ctx.strokeStyle = r.sensingRing;
    ctx.lineWidth = 1;
    for (const t of this.frontierTips) {
      const s = camera.worldToScreen(t.x, t.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, sr, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Nutrient pulses travelling outward along a sampled set of filaments.
    ctx.save();
    ctx.globalAlpha = brightness;
    ctx.fillStyle = r.pulseColor;
    const speed = r.pulseSpeed;
    const estride = Math.max(1, Math.ceil(this.edges.length / 120));
    for (let i = 0; i < this.edges.length; i += estride) {
      const e = this.edges[i];
      const len = Math.hypot(e.bx - e.ax, e.by - e.ay) || 1;
      const phase = ((time * 0.001 * speed) + i * 13.7) % (len + 40);
      if (phase > len) continue; // gap between pulses
      const f = phase / len;
      const wx = e.ax + (e.bx - e.ax) * f;
      const wy = e.ay + (e.by - e.ay) * f;
      const s = camera.worldToScreen(wx, wy);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// --- Fruiting bodies rising through the soil line (A8) ----------------------
export function drawFruitBodies(ctx, camera, points, time, preview = false) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const base = camera.worldToScreen(p.x, p.y);
    const grow = preview ? 0.5 : Math.min(1, (Math.sin(time * 0.003 + i) * 0.1 + 0.9));
    const h = 26 * camera.zoom * grow;
    const capR = 10 * camera.zoom * grow;
    const stalkW = 3.5 * camera.zoom;
    const topY = base.y - h;
    ctx.save();
    ctx.globalAlpha = preview ? 0.45 : 1;
    // stalk
    ctx.strokeStyle = '#e8e0d0';
    ctx.lineWidth = stalkW;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x, topY);
    ctx.stroke();
    // cap (shaded = bluer/richer, sunny = paler)
    ctx.fillStyle = p.shade ? '#9a6cff' : '#caa15a';
    ctx.beginPath();
    ctx.ellipse(base.x, topY, capR, capR * 0.7, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }
}

// --- colour helpers --------------------------------------------------------
function withAlpha(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.substring(0, 2), 16), parseInt(v.substring(2, 4), 16), parseInt(v.substring(4, 6), 16)];
}
function lerpColor(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}
