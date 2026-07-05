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
    // The structure is drawn per-frame as VECTORS under a world→screen transform
    // (below), so the fine hyphae stay crisp at any zoom / device-pixel-ratio.
    // (It used to bake to a world-resolution canvas and upscale that bitmap by
    //  zoom×DPR, which made the bright threads look grainy/blurry when zoomed in
    //  or on high-DPI phones.) Only the topology caches are rebuilt on change.
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

    const root = net.nodes[0];
    this.maxDist = 1;
    this.edges = [];
    this.tips = [];
    for (const n of net.nodes) {
      if (n.children.length === 0) this.tips.push(n);
      if (n.parentId != null) {
        const p = net.byId.get(n.parentId);
        if (p) {
          const d = root ? Math.hypot(n.x - root.x, n.y - root.y) : 0;
          if (d > this.maxDist) this.maxDist = d;
          this.edges.push({ ax: p.x, ay: p.y, bx: n.x, by: n.y, w: size.get(n.id) || 1, h: n.health, d });
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

  // Draw the mycelial structure as crisp vectors. The caller has already applied
  // a world→screen transform (translate to the map origin, scale by camera.zoom)
  // on top of the device-pixel-ratio transform, so world coordinates and world-
  // unit line widths rasterise directly at native device resolution — no bitmap
  // upscale, no blur. `cull` is the visible world rect (+ decoration margin);
  // `detail` draws the sub-pixel cottony fuzz/fan only when it's big enough to see.
  _strokeStructure(ctx, brightness, cull, detailAmt) {
    const network = this.network;
    const r = this.config.render;
    const fil = hexToRgb(r.filament);
    const cream = `rgb(${fil[0]},${fil[1]},${fil[2]})`;
    const AGE_FULL = 7;
    const { minX, maxX, minY, maxY } = cull;

    // Petri-dish mycelium: fine meandering hyphae plus an age-driven cottony
    // "fuzz" of short hyphae that thickens as the colony matures — dense at the
    // old centre, feathery at the young growing margin. Fuzz is decorative
    // (the sim skeleton stays light) and hashed per-node so it's stable.
    for (const n of network.nodes) {
      if (n.parentId == null) continue;
      const p = network.byId.get(n.parentId);
      if (!p) continue;
      // Cull by the STRAND's bounding box vs the viewport — not just its endpoints,
      // so a long bridge strand (e.g. a dig-through that spans off-screen→off-screen
      // across the view) is still drawn instead of vanishing.
      const exlo = p.x < n.x ? p.x : n.x, exhi = p.x < n.x ? n.x : p.x;
      const eylo = p.y < n.y ? p.y : n.y, eyhi = p.y < n.y ? n.y : p.y;
      if (exhi < minX || exlo > maxX || eyhi < minY || eylo > maxY) continue;
      // Decoration (fuzz/fan) hangs off the node itself; gate it on the node being in view.
      const nVis = n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY;
      const s = this.subtreeSize.get(n.id) || 1;
      const dx = n.x - p.x, dy = n.y - p.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, perpx = -uy, perpy = ux;
      const baseAng = Math.atan2(uy, ux);
      const isTip = n.children.length === 0;
      const ageF = Math.min(1, n.age / AGE_FULL);
      // Infected strands render green (overrun by mould); otherwise constant
      // cream (look is independent of vitality/health).
      ctx.strokeStyle = n.infected ? r.infected : cream;

      // main hypha — at most a slim 2-strand cord near the trunk; fine elsewhere.
      // Narrower spread between trunk and fine strands: thinner main cords, a
      // touch thicker secondaries (the trunks read too heavy before).
      const strands = s > 8 ? 2 : 1;
      const baseW = 1.0 + Math.min(0.55, Math.log(1 + s) * 0.13);
      const meander = Math.min(len * 0.22, 4.5) * (nh(n.id, 1) * 2 - 1);
      for (let k = 0; k < strands; k++) {
        const o = (k - (strands - 1) / 2) * 1.2;
        const mx = (p.x + n.x) / 2 + perpx * (o + meander);
        const my = (p.y + n.y) / 2 + perpy * (o + meander);
        ctx.lineWidth = baseW * (0.8 + 0.4 * nh(n.id, k + 2));
        ctx.globalAlpha = 0.95 * brightness;
        ctx.beginPath();
        ctx.moveTo(p.x + perpx * o, p.y + perpy * o);
        ctx.quadraticCurveTo(mx, my, n.x + perpx * o, n.y + perpy * o);
        ctx.stroke();
      }

      // The cottony fuzz/fan is a few world units long; skip it when it would be
      // sub-pixel (zoomed out) or the colony is huge, and FADE it across those
      // thresholds (detailAmt) so it doesn't pop on/off colony-wide in one frame.
      if (detailAmt <= 0.02 || !nVis) continue;

      // cottony fuzz — short fine hyphae radiating out, denser as the strand ages
      const fuzz = isTip ? Math.round(ageF * 2) : Math.round(ageF * 5);
      ctx.lineWidth = 0.7;
      for (let f = 0; f < fuzz; f++) {
        const a = nh(n.id, f + 11) * 6.283;
        const hl = 4 + 7 * nh(n.id, f + 23);
        const mx = n.x + Math.cos(a) * hl * 0.5 + perpx * (nh(n.id, f + 31) * 2 - 1) * 1.4;
        const my = n.y + Math.sin(a) * hl * 0.5 + perpy * (nh(n.id, f + 31) * 2 - 1) * 1.4;
        ctx.globalAlpha = (0.3 + 0.2 * nh(n.id, f + 5)) * brightness * detailAmt;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.quadraticCurveTo(mx, my, n.x + Math.cos(a) * hl, n.y + Math.sin(a) * hl);
        ctx.stroke();
      }

      // exploratory feather-fan at the growing tip
      if (isTip) {
        ctx.globalAlpha = 0.62 * brightness * detailAmt;
        ctx.lineWidth = 0.7;
        const fan = 4 + Math.floor(nh(n.id, 5) * 3);
        for (let f = 0; f < fan; f++) {
          const a = baseAng + (f / (fan - 1) - 0.5) * 1.5 + (nh(n.id, f + 50) - 0.5) * 0.3;
          const hl = 5 + 6 * nh(n.id, f + 60);
          const mx = n.x + Math.cos(a) * hl * 0.55 + perpx * (nh(n.id, f) * 2 - 1) * 1.5;
          const my = n.y + Math.sin(a) * hl * 0.55 + perpy * (nh(n.id, f) * 2 - 1) * 1.5;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.quadraticCurveTo(mx, my, n.x + Math.cos(a) * hl, n.y + Math.sin(a) * hl);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // brightnessScale: extra multiplier for elders later (default 1).
  draw(ctx, camera, time, brightnessScale = 1) {
    if (this.structureDirty) { this._rebuildCaches(); this.structureDirty = false; }
    const r = this.config.render;
    const net = this.network;
    // Steady brightness — no global "breathing" (the constant brightening/dimming
    // made the whole map pulse and was hard to look at). Appearance is also
    // INDEPENDENT of vitality (that stays a HUD/gameplay stat only), so the
    // mycelium never dims or browns as health drops.
    const brightness = brightnessScale;
    const zoom = camera.zoom;
    const tl = camera.worldToScreen(0, 0);

    // Visible world rect (+ a margin for decoration overhang) for culling.
    const c0 = camera.screenToWorld(0, 0);
    const c1 = camera.screenToWorld(camera.viewW, camera.viewH);
    const M = 28;
    const cull = {
      minX: Math.min(c0.x, c1.x) - M, maxX: Math.max(c0.x, c1.x) + M,
      minY: Math.min(c0.y, c1.y) - M, maxY: Math.max(c0.y, c1.y) + M,
    };
    // The cottony fuzz/fan is ~4-13 world units; only worth drawing when a world
    // unit is a decent fraction of a screen pixel, and it reads as an indistinct
    // haze on a huge colony (also costly). FADE it across both thresholds — via a
    // smoothstep on zoom and on node count — so it never pops on/off colony-wide
    // in a single frame; near 0 it's skipped entirely to keep strokes bounded.
    const detailAmt = smoothstep(0.42, 0.62, zoom) * (1 - smoothstep(1400, 1900, net.nodes.length));

    // Static structure — drawn as crisp vectors in world space (transform composes
    // with the ctx's device-pixel-ratio transform, so lines are sharp at any zoom).
    ctx.save();
    ctx.translate(tl.x, tl.y);
    ctx.scale(zoom, zoom);
    ctx.lineCap = 'round';
    this._strokeStructure(ctx, brightness, cull, detailAmt);
    ctx.restore();

    // --- Dynamic layer (screen space) ---
    // (The sensing range is shown by the lighting pass as a soft "in-range"
    //  glow, not per-tip rings.)

    // A single, slow nutrient pulse sweeping outward from the core as one soft
    // ring (~every 3.8s) — a heartbeat, not a stream of marching dots.
    const period = 3800;
    const bandW = 55;
    const front = ((time % period) / period) * (this.maxDist + bandW * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = r.pulseColor;
    const estride = Math.max(1, Math.ceil(this.edges.length / 220));
    for (let i = 0; i < this.edges.length; i += estride) {
      const e = this.edges[i];
      const dd = Math.abs(e.d - front);
      if (dd > bandW) continue;
      ctx.globalAlpha = (1 - dd / bandW) * 0.45 * brightness;
      ctx.lineWidth = 1.6;
      const a = camera.worldToScreen(e.ax, e.ay), b = camera.worldToScreen(e.bx, e.by);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
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
// Stable per-node pseudo-random in [0,1) for decorative hyphae detail.
function nh(id, k) { const v = Math.sin(id * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); }
// Smooth 0→1 ramp between edges a and b (Hermite), for gradual LOD fades.
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function lerpColor(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}
