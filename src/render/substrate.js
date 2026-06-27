// =============================================================================
// SubstrateRenderer — the cross-section terrain (A4, A8, B1/B2).
//
// Art direction: a subterranean diorama. A twilight sky over deep, textured
// earth strata; warm glowing nutrient pockets; toxic pools with a sickly
// caustic sheen; grass and dappled shade on the surface; mushrooms and a
// luminous network elsewhere. The earth stays quiet and rich so the mint of
// the living network reads as the one bright thing.
//
// Two baked layers keep it cheap:
//   - base    : everything static (sky, earth texture, rocks, veins, hazards,
//               surface crust, grass) — baked once per map.
//   - dynamic : nutrient pockets + Trichoderma — re-baked only when they change.
// A light atmosphere layer (drifting spores/motes) animates each frame.
// =============================================================================

import { makeNoise } from './noise.js';
import { makeRng } from '../engine/rng.js';

export class SubstrateRenderer {
  constructor(substrate, config, seed = 1) {
    this.substrate = substrate;
    this.config = config;
    this.noise = makeNoise((seed ^ 0x9e3779b1) >>> 0);
    this.rng = makeRng((seed ^ 0x85ebca6b) >>> 0);
    this.nutrientRef = config.substrate.foodRichnessMax * 1.4;

    const W = Math.ceil(substrate.worldWidth);
    const H = Math.ceil(substrate.worldHeight);
    this.base = makeCanvas(W, H);
    this.baseCtx = this.base.getContext('2d');
    this.dyn = makeCanvas(W, H);
    this.dynCtx = this.dyn.getContext('2d');
    this.dynamicDirty = true;

    this.foodLightPoints = [];   // {x, y, i} emissive nutrient pockets (for lighting)
    this.hazardLightPoints = []; // {x, y} glowing toxic pools (for lighting)
    this.particles = this._initParticles();
    this._bakeBase();
  }

  markDirty() { this.dynamicDirty = true; }

  // --- draw (per frame) ----------------------------------------------------
  draw(ctx, camera, time) {
    if (this.dynamicDirty) this._bakeDynamic();
    const tl = camera.worldToScreen(0, 0);
    const W = this.base.width * camera.zoom;
    const H = this.base.height * camera.zoom;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, this.base.width, this.base.height, tl.x, tl.y, W, H);
    ctx.drawImage(this.dyn, 0, 0, this.dyn.width, this.dyn.height, tl.x, tl.y, W, H);
  }

  // =========================================================================
  // BASE LAYER
  // =========================================================================
  _bakeBase() {
    const octx = this.baseCtx;
    octx.clearRect(0, 0, this.base.width, this.base.height);
    this._bakeSky();
    this._bakeEarth();
    this._bakeVeins();
    this._bakeRocks();
    this._bakeFlecks();
    this._bakeHazards();
    this._bakeSurface();
  }

  _bakeSky() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const W = this.base.width, sy = sub.surfaceY;

    const grad = octx.createLinearGradient(0, 0, 0, sy);
    grad.addColorStop(0, r.skyTop);
    grad.addColorStop(1, r.skyHorizon);
    octx.fillStyle = grad;
    octx.fillRect(0, 0, W, sy);

    // faint stars in the upper sky
    octx.fillStyle = r.star;
    for (let i = 0; i < 90; i++) {
      const x = this.rng() * W, y = this.rng() * sy * 0.7;
      const a = this.rng() * 0.6 + 0.1;
      octx.globalAlpha = a;
      octx.beginPath();
      octx.arc(x, y, this.rng() * 0.9 + 0.3, 0, Math.PI * 2);
      octx.fill();
    }
    octx.globalAlpha = 1;

    // warm glow hugging the horizon
    const hg = octx.createLinearGradient(0, sy - 150, 0, sy);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(1, r.horizonGlow);
    octx.fillStyle = hg;
    octx.fillRect(0, sy - 150, W, 150);

    // per-column light: warm over sunny soil, cool + canopy over shaded soil
    const cs = sub.cellSize;
    for (let c = 0; c < sub.cols; c++) {
      const surf = sub.surface[c];
      if (!surf.soil) continue;
      const x = c * cs;
      const wash = octx.createLinearGradient(0, sy - 150, 0, sy);
      wash.addColorStop(0, 'rgba(0,0,0,0)');
      wash.addColorStop(1, surf.shade ? r.shadeWash : r.sunWash);
      octx.fillStyle = wash;
      octx.fillRect(x, sy - 150, cs + 1, 150);
    }

    // soft foliage silhouettes above shaded runs
    octx.fillStyle = r.canopy;
    for (let c = 0; c < sub.cols; c++) {
      if (!(sub.surface[c].soil && sub.surface[c].shade)) continue;
      const x = c * cs + cs / 2;
      for (let k = 0; k < 2; k++) {
        const cy = 10 + this.rng() * 26;
        octx.globalAlpha = 0.5;
        octx.beginPath();
        octx.arc(x + this.rng() * cs - cs / 2, cy, cs * (0.5 + this.rng() * 0.5), 0, Math.PI * 2);
        octx.fill();
      }
    }
    octx.globalAlpha = 1;
  }

  // Earth painted as a colour field: depth gradient modulated by fbm + strata.
  _bakeEarth() {
    const sub = this.substrate;
    const r = this.config.render;
    const W = this.base.width, sy = sub.surfaceY, gh = this.base.height - sy;
    const scale = 4;
    const tw = Math.ceil(W / scale), th = Math.ceil(gh / scale);
    const tex = makeCanvas(tw, th);
    const tctx = tex.getContext('2d');
    const img = tctx.createImageData(tw, th);
    const d = img.data;
    const top = hexToRgb(r.soilTop), mid = hexToRgb(r.soilMid), deep = hexToRgb(r.soilDeep);

    for (let ty = 0; ty < th; ty++) {
      const worldY = sy + (ty / th) * gh;
      const depth = (worldY - sy) / gh;
      const col = depth < 0.35
        ? lerpRgb(top, mid, depth / 0.35)
        : lerpRgb(mid, deep, (depth - 0.35) / 0.65);
      for (let tx = 0; tx < tw; tx++) {
        const wx = (tx / tw) * W;
        const n = this.noise.fbm(wx * 0.006, worldY * 0.006, 4);
        const strata = Math.sin(worldY * 0.03 + this.noise.noise2(wx * 0.002, worldY * 0.01) * 3) * 0.5;
        const b = 1 + n * 0.22 + strata * 0.08;
        const i = (ty * tw + tx) * 4;
        d[i] = clamp255(col[0] * b);
        d[i + 1] = clamp255(col[1] * b);
        d[i + 2] = clamp255(col[2] * b);
        d[i + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    this.baseCtx.imageSmoothingEnabled = true;
    this.baseCtx.drawImage(tex, 0, 0, tw, th, 0, sy, W, gh);
  }

  _bakeVeins() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const W = this.base.width, sy = sub.surfaceY, H = this.base.height;
    octx.strokeStyle = r.vein;
    octx.lineCap = 'round';
    const veins = Math.max(4, Math.floor(W / 380));
    for (let v = 0; v < veins; v++) {
      let x = this.rng() * W;
      let y = sy + this.rng() * (H - sy) * 0.4;
      let ang = Math.PI / 2 + (this.rng() - 0.5);
      const steps = 20 + Math.floor(this.rng() * 30);
      octx.lineWidth = this.rng() * 1.2 + 0.5;
      octx.globalAlpha = this.rng() * 0.3 + 0.2;
      octx.beginPath();
      octx.moveTo(x, y);
      for (let s = 0; s < steps; s++) {
        ang += (this.noise.noise2(x * 0.01, y * 0.01)) * 0.6;
        x += Math.cos(ang) * 14;
        y += Math.abs(Math.sin(ang)) * 14 + 4;
        if (y > H) break;
        octx.lineTo(x, y);
      }
      octx.stroke();
    }
    octx.globalAlpha = 1;
  }

  _bakeRocks() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const W = this.base.width, sy = sub.surfaceY, gh = this.base.height - sy;
    const count = Math.floor((W * gh) / 26000);
    for (let i = 0; i < count; i++) {
      const x = this.rng() * W;
      const y = sy + Math.pow(this.rng(), 0.8) * gh;
      const rr = this.rng() * 7 + 2;
      const rot = this.rng() * Math.PI;
      // body
      octx.save();
      octx.translate(x, y);
      octx.rotate(rot);
      octx.fillStyle = r.rock;
      octx.beginPath();
      octx.ellipse(0, 0, rr, rr * (0.6 + this.rng() * 0.3), 0, 0, Math.PI * 2);
      octx.fill();
      // bottom shadow
      octx.fillStyle = 'rgba(0,0,0,0.28)';
      octx.beginPath();
      octx.ellipse(0, rr * 0.25, rr * 0.9, rr * 0.45, 0, 0, Math.PI * 2);
      octx.fill();
      // top lip highlight
      octx.fillStyle = r.rockLip;
      octx.globalAlpha = 0.5;
      octx.beginPath();
      octx.ellipse(-rr * 0.2, -rr * 0.3, rr * 0.5, rr * 0.25, 0, 0, Math.PI * 2);
      octx.fill();
      octx.restore();
    }
    octx.globalAlpha = 1;
  }

  _bakeFlecks() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const W = this.base.width, sy = sub.surfaceY, gh = this.base.height - sy;
    octx.fillStyle = r.fleck;
    const count = Math.floor((W * gh) / 2600);
    for (let i = 0; i < count; i++) {
      octx.globalAlpha = this.rng() * 0.4 + 0.1;
      octx.fillRect(this.rng() * W, sy + this.rng() * gh, 1, 1);
    }
    octx.globalAlpha = 1;
  }

  _bakeHazards() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const cs = sub.cellSize, sy = sub.surfaceY;

    // Collect hazard cells; bail early if there are none.
    const cells = [];
    sub.forEachCell((cell, col, row) => { if (cell.hazard) cells.push([col, row]); });
    this.hazardLightPoints = cells.map(([col, row]) => sub.cellCenter(col, row));
    if (!cells.length) return;

    // Build one path that is the UNION of soft circles over the hazard cells.
    const unionPath = () => {
      octx.beginPath();
      for (const [col, row] of cells) {
        const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
        octx.moveTo(cx + cs * 0.82, cy);
        octx.arc(cx, cy, cs * 0.82, 0, Math.PI * 2);
      }
    };

    // 1) Body + a single continuous caustic glow around the whole pool.
    octx.save();
    octx.shadowColor = r.hazardCaustic;
    octx.shadowBlur = 13;
    octx.fillStyle = r.hazardDeep;
    unionPath();
    octx.fill();
    octx.restore();

    // 2) Everything else is clipped to the pool so it reads as one liquid body.
    octx.save();
    unionPath();
    octx.clip();

    // dappled lit surface
    for (const [col, row] of cells) {
      const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
      const rad = cs * 0.9;
      const g = octx.createRadialGradient(cx, cy - cs * 0.2, 0, cx, cy, rad);
      g.addColorStop(0, withAlpha(hexToRgb(r.hazardMid), 0.8));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(cx, cy, rad, 0, Math.PI * 2);
      octx.fill();
    }

    // caustic ripples + bubbles
    octx.strokeStyle = r.hazardCaustic;
    octx.lineWidth = 1;
    for (const [col, row] of cells) {
      const x0 = col * cs, y0 = sy + row * cs;
      octx.globalAlpha = 0.45;
      for (let k = 0; k < 2; k++) {
        const yy = y0 + this.rng() * cs;
        octx.beginPath();
        octx.moveTo(x0, yy);
        octx.quadraticCurveTo(x0 + cs * 0.5, yy - 3, x0 + cs, yy);
        octx.stroke();
      }
      octx.fillStyle = r.hazardBubble;
      octx.globalAlpha = 0.5;
      for (let k = 0; k < 2; k++) {
        octx.beginPath();
        octx.arc(x0 + this.rng() * cs, y0 + this.rng() * cs, this.rng() * 1.6 + 0.6, 0, Math.PI * 2);
        octx.fill();
      }
    }
    octx.globalAlpha = 1;
    octx.restore();
  }

  _bakeSurface() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const cs = sub.cellSize, sy = sub.surfaceY;

    for (let c = 0; c < sub.cols; c++) {
      const surf = sub.surface[c];
      const x = c * cs;
      const jitter = this.noise.noise2(c * 0.32, 7) * 4;
      const lineY = sy + jitter;

      if (surf.soil) {
        // topsoil crust + rim light
        const cg = octx.createLinearGradient(0, lineY - 2, 0, lineY + 16);
        cg.addColorStop(0, r.crust);
        cg.addColorStop(1, r.soilTop);
        octx.fillStyle = cg;
        octx.fillRect(x, lineY, cs + 1, 18);
        octx.fillStyle = r.crustLip;
        octx.globalAlpha = 0.6;
        octx.fillRect(x, lineY - 1, cs + 1, 1.5);
        octx.globalAlpha = 1;
        // grass blades
        const blades = 3 + Math.floor(this.rng() * 3);
        for (let b = 0; b < blades; b++) {
          const bx = x + this.rng() * cs;
          const h = 6 + this.rng() * 9;
          const sway = (this.rng() - 0.5) * 7;
          octx.strokeStyle = surf.shade ? r.grassShade : r.grassSun;
          octx.globalAlpha = 0.85;
          octx.lineWidth = 1.4;
          octx.beginPath();
          octx.moveTo(bx, lineY);
          octx.quadraticCurveTo(bx + sway * 0.5, lineY - h * 0.6, bx + sway, lineY - h);
          octx.stroke();
        }
        octx.globalAlpha = 1;
      } else {
        // non-soil: a hard concrete/rock cap — no fruiting here
        octx.fillStyle = r.concrete;
        octx.fillRect(x, lineY - 4, cs + 1, 20);
        octx.fillStyle = 'rgba(255,255,255,0.06)';
        octx.fillRect(x, lineY - 4, cs + 1, 2);
        octx.strokeStyle = r.concreteCrack;
        octx.lineWidth = 1;
        for (let k = 0; k < 2; k++) {
          const cxs = x + this.rng() * cs;
          octx.beginPath();
          octx.moveTo(cxs, lineY - 4);
          octx.lineTo(cxs + (this.rng() - 0.5) * 6, lineY + 12);
          octx.stroke();
        }
        octx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 3; k++) octx.fillRect(x + this.rng() * cs, lineY + this.rng() * 12, 1, 1);
      }
    }
  }

  // =========================================================================
  // DYNAMIC LAYER (nutrient + Trichoderma)
  // =========================================================================
  _bakeDynamic() {
    const octx = this.dynCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const cs = sub.cellSize, sy = sub.surfaceY;
    octx.clearRect(0, 0, this.dyn.width, this.dyn.height);
    this.foodLightPoints = [];

    // Nutrient pockets — soft glowing blobs that blend into organic shapes.
    sub.forEachCell((cell, col, row) => {
      if (cell.hazard || cell.nutrient <= 0) return;
      const a = Math.min(1, cell.nutrient / this.nutrientRef);
      const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
      if (a > 0.18) this.foodLightPoints.push({ x: cx, y: cy, i: a });
      const rad = cs * (0.7 + a * 0.85);
      const g = octx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, withAlpha(hexToRgb(r.foodCore), 0.55 * a));
      g.addColorStop(0.55, withAlpha(hexToRgb(r.foodEdge), 0.32 * a));
      g.addColorStop(1, withAlpha(hexToRgb(r.foodEdge), 0));
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(cx, cy, rad, 0, Math.PI * 2);
      octx.fill();
    });

    // Bright nutrient veins/flecks inside the richest pockets.
    octx.fillStyle = r.foodVein;
    sub.forEachCell((cell, col, row) => {
      if (cell.hazard || cell.nutrient < this.nutrientRef * 0.5) return;
      const x0 = col * cs, y0 = sy + row * cs;
      octx.globalAlpha = 0.5;
      for (let k = 0; k < 3; k++) {
        octx.beginPath();
        octx.arc(x0 + this.rng() * cs, y0 + this.rng() * cs, this.rng() * 1.2 + 0.5, 0, Math.PI * 2);
        octx.fill();
      }
    });
    octx.globalAlpha = 1;

    // Trichoderma — fuzzy speckled growth.
    sub.forEachCell((cell, col, row) => {
      if (cell.trich <= 0) return;
      const a = Math.min(0.8, cell.trich);
      const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
      const rad = cs * 0.8;
      const g = octx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, withAlpha(hexToRgb(r.trich), a));
      g.addColorStop(1, withAlpha(hexToRgb(r.trich), 0));
      octx.fillStyle = g;
      octx.beginPath();
      octx.arc(cx, cy, rad, 0, Math.PI * 2);
      octx.fill();
      octx.fillStyle = withAlpha(hexToRgb(r.trichSpore), a * 0.7);
      for (let k = 0; k < 4; k++) {
        octx.beginPath();
        octx.arc(col * cs + this.rng() * cs, sy + row * cs + this.rng() * cs, this.rng() * 1.3 + 0.4, 0, Math.PI * 2);
        octx.fill();
      }
      octx.fillStyle = r.trichSpore;
    });

    this.dynamicDirty = false;
  }

  // =========================================================================
  // ATMOSPHERE (drifting spores in the air, motes in the earth)
  // =========================================================================
  _initParticles() {
    const sub = this.substrate;
    const n = this.config.render.particleCount;
    const arr = [];
    for (let i = 0; i < n; i++) {
      const air = this.rng() < 0.42;
      arr.push({
        x: this.rng() * sub.worldWidth,
        y: air ? this.rng() * sub.surfaceY : sub.surfaceY + this.rng() * (sub.worldHeight - sub.surfaceY),
        r: (air ? 1.0 : 0.8) + this.rng() * 1.1,
        phase: this.rng() * Math.PI * 2,
        ax: this.rng() * 18 + 8,
        ay: this.rng() * 12 + 5,
        spd: this.rng() * 0.0004 + 0.00018,
        air,
      });
    }
    return arr;
  }

  drawAtmosphere(ctx, camera, time) {
    const r = this.config.render;
    const vw = camera.viewW, vh = camera.viewH;
    for (const p of this.particles) {
      const wx = p.x + Math.sin(time * p.spd + p.phase) * p.ax;
      const wy = p.y + Math.cos(time * p.spd * 0.8 + p.phase) * p.ay;
      const s = camera.worldToScreen(wx, wy);
      if (s.x < -8 || s.x > vw + 8 || s.y < -8 || s.y > vh + 8) continue;
      const rad = p.r * camera.zoom * (0.7 + 0.3 * Math.sin(time * 0.003 + p.phase));
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad * 3);
      g.addColorStop(0, p.air ? r.spore : r.mote);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rad * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// --- helpers ---------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [parseInt(v.substring(0, 2), 16), parseInt(v.substring(2, 4), 16), parseInt(v.substring(4, 6), 16)];
}
function lerpRgb(a, b, t) {
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function withAlpha(rgb, a) { return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`; }
function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
