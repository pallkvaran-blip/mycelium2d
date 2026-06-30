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
import { hasAsset } from './assets.js';

export class SubstrateRenderer {
  constructor(substrate, config, seed = 1) {
    this.substrate = substrate;
    this.config = config;
    this.noise = makeNoise((seed ^ 0x9e3779b1) >>> 0);
    this.rng = makeRng((seed ^ 0x85ebca6b) >>> 0);
    this.nutrientRef = config.substrate.foodCellNutrient;

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

  // Re-bake the static base layer (e.g. once art assets finish loading, so the
  // asset-gated passes like _bakeWater pick them up). Also refreshes dynamic.
  rebake() { this._bakeBase(); this.dynamicDirty = true; }

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
    this._bakeRockFormations();
    this._bakeHazards();
    this._bakeWater();
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

    // (The sun disc was removed — the MOON is drawn per-frame in main.js, a
    // luminous body in the twilight sky to suit the night scene.)

    // warm daylight haze hugging the horizon
    const hg = octx.createLinearGradient(0, sy - 160, 0, sy);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(1, r.horizonGlow);
    octx.fillStyle = hg;
    octx.fillRect(0, sy - 160, W, 160);

    // (Per-column sky washes + canopy silhouettes removed — the washes read as
    // vertical "light beams" rising from the ground.)
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

  // Impassable rock formations — solid faceted stone the mycelium routes around.
  _bakeRockFormations() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const cs = sub.cellSize, sy = sub.surfaceY;

    const cells = [];
    // When the rock-formation sprites exist, ALL rock (formations, mountain walls
    // and lone boulders) is drawn per-frame by sprites over plain earth, so NONE
    // of it bakes here — otherwise the procedural faceted rock peeks out from
    // behind the tilted sprites as stray dark slabs. Without the sprites we bake
    // the procedural rock as the fallback so it's never invisible.
    let haveForm = false;
    for (let i = 1; i <= 14; i++) { if (hasAsset('rockform' + i)) { haveForm = true; break; } }
    if (haveForm) return;
    sub.forEachCell((cell, col, row) => { if (cell.rock && !cell.water) cells.push([col, row]); });
    if (!cells.length) return;

    const unionPath = () => {
      octx.beginPath();
      for (const [col, row] of cells) {
        const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
        octx.moveTo(cx + cs * 0.78, cy);
        octx.arc(cx, cy, cs * 0.78, 0, Math.PI * 2);
      }
    };

    // solid body with a soft drop shadow so it sits in the earth
    octx.save();
    octx.shadowColor = r.rockShadow;
    octx.shadowBlur = 9;
    octx.shadowOffsetY = 4;
    octx.fillStyle = r.rockMass;
    unionPath();
    octx.fill();
    octx.restore();

    // facets, cracks and top-light, clipped to the formation
    octx.save();
    unionPath();
    octx.clip();
    // angular facets
    for (const [col, row] of cells) {
      const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
      octx.fillStyle = r.rockFacet;
      octx.globalAlpha = 0.2 + h2(col, row) * 0.3;
      const a0 = h2(col, row) * 6.283;
      octx.beginPath();
      octx.moveTo(cx, cy);
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 2.1;
        octx.lineTo(cx + Math.cos(a) * cs * 0.55, cy + Math.sin(a) * cs * 0.5);
      }
      octx.closePath();
      octx.fill();
    }
    octx.globalAlpha = 1;
    // cracks
    octx.strokeStyle = r.rockEdge;
    octx.lineWidth = 1.4;
    for (const [col, row] of cells) {
      if (h2(col * 3, row * 3) < 0.55) continue;
      const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
      const a = h2(col, row) * 3.14;
      octx.beginPath();
      octx.moveTo(cx - Math.cos(a) * cs * 0.5, cy - Math.sin(a) * cs * 0.5);
      octx.lineTo(cx + Math.cos(a) * cs * 0.6, cy + Math.sin(a) * cs * 0.55);
      octx.stroke();
    }
    // top highlight -> bottom shadow across the whole formation
    const gg = octx.createLinearGradient(0, sy, 0, this.base.height);
    gg.addColorStop(0, 'rgba(255,255,255,0.10)');
    gg.addColorStop(0.5, 'rgba(0,0,0,0)');
    gg.addColorStop(1, 'rgba(0,0,0,0.28)');
    octx.fillStyle = gg;
    octx.fillRect(0, sy, this.base.width, this.base.height - sy);
    octx.restore();
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

  // Lake basins — large water-filled cross-sections carved into the earth. Each
  // contiguous run of 'lake' surface columns is drawn as one bowl: a smooth
  // semi-elliptical basin with a reflective waterline, water deepening with
  // depth, a silt bed, bioluminescent plants, and a few pale drifting fish.
  // PROCEDURAL FALLBACK ONLY — when the lake art sprites are loaded, main.js
  // draws them over the basin instead, so skip the procedural bake.
  _bakeWater() {
    if (hasAsset('lake1') || hasAsset('lake2') || hasAsset('lake3')) return;
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const cs = sub.cellSize, sy = sub.surfaceY;

    const runs = [];
    let c = 0;
    while (c < sub.cols) {
      if (sub.surface[c] && sub.surface[c].barrier === 'lake') {
        let e = c; while (e < sub.cols && sub.surface[e].barrier === 'lake') e++;
        runs.push([c, e - 1]); c = e;
      } else c++;
    }
    if (!runs.length) return;

    for (const [c0, c1] of runs) {
      const nCols = c1 - c0 + 1;
      const xL = c0 * cs, xR = (c1 + 1) * cs;
      // deepest water row in the run sets the bowl depth
      let maxD = 0;
      for (let col = c0; col <= c1; col++) {
        let d = 0; while (d < sub.rows && sub.cellAt(col, d) && sub.cellAt(col, d).water) d++;
        if (d > maxD) maxD = d;
      }
      if (maxD <= 0) continue;
      const cx = (xL + xR) / 2, rX = (xR - xL) / 2, rY = maxD * cs;
      const maxBot = sy + rY;

      // ---- water body, clipped to the smooth bowl --------------------------
      octx.save();
      octx.beginPath();
      octx.ellipse(cx, sy, rX, rY, 0, 0, Math.PI, false);   // bottom arc (xR,sy)->bowl->(xL,sy)
      octx.closePath();                                      // straight waterline across the top
      octx.clip();

      const wg = octx.createLinearGradient(0, sy - 4, 0, maxBot);
      wg.addColorStop(0, r.waterSurface);
      wg.addColorStop(0.32, r.water);
      wg.addColorStop(1, r.waterDeep);
      octx.fillStyle = wg;
      octx.fillRect(xL - 2, sy - 6, (xR - xL) + 4, rY + 12);

      // bioluminescent plants rising from the bed (cluster toward the deep middle)
      const plants = Math.max(2, Math.round(nCols / 3));
      for (let p = 0; p < plants; p++) {
        const px = xL + ((p + 0.5) / plants) * (xR - xL);
        const tt = (px - cx) / rX;                            // -1..1
        const bedY = sy + rY * Math.sqrt(Math.max(0, 1 - tt * tt));
        const hgt = (bedY - sy) * (0.45 + this.rng() * 0.4);
        if (hgt < cs * 0.8) continue;
        const sway = (this.rng() - 0.5) * cs;
        octx.strokeStyle = r.waterPlantStalk;
        octx.lineWidth = 2;
        octx.lineCap = 'round';
        octx.globalAlpha = 0.85;
        octx.beginPath();
        octx.moveTo(px, bedY);
        octx.quadraticCurveTo(px + sway, bedY - hgt * 0.55, px + sway * 0.5, bedY - hgt);
        octx.stroke();
        octx.globalAlpha = 1;
        octx.fillStyle = r.waterPlantGlow;
        octx.shadowColor = r.waterPlantGlow;
        octx.shadowBlur = 9;
        octx.beginPath();
        octx.arc(px + sway * 0.5, bedY - hgt, 2.4 + this.rng() * 1.6, 0, Math.PI * 2);
        octx.fill();
        octx.shadowBlur = 0;
      }

      // a few small pale fish drifting in the mid-water
      const fish = Math.max(1, Math.round(nCols / 6));
      octx.fillStyle = r.waterFish;
      for (let f = 0; f < fish; f++) {
        const fx = xL + (0.2 + this.rng() * 0.6) * (xR - xL);
        const fy = sy + cs * 0.7 + this.rng() * Math.max(cs, rY * 0.45);
        const fs = cs * (0.16 + this.rng() * 0.08);
        octx.save();
        octx.translate(fx, fy);
        if (this.rng() < 0.5) octx.scale(-1, 1);
        octx.beginPath();
        octx.ellipse(0, 0, fs, fs * 0.42, 0, 0, Math.PI * 2);   // body
        octx.moveTo(-fs * 0.9, 0);
        octx.lineTo(-fs * 1.6, -fs * 0.45);                     // tail
        octx.lineTo(-fs * 1.6, fs * 0.45);
        octx.closePath();
        octx.fill();
        octx.restore();
      }

      // ripple glints just under the waterline
      octx.fillStyle = r.waterGlint;
      for (let k = 0; k < nCols; k++) {
        octx.globalAlpha = 0.3 + this.rng() * 0.4;
        octx.fillRect(xL + this.rng() * (xR - xL), sy - 2 + this.rng() * 6, this.rng() * 7 + 2, 1);
      }
      octx.globalAlpha = 1;
      octx.restore();   // end bowl clip

      // ---- silt bed along the bowl curve -----------------------------------
      octx.strokeStyle = r.lakeBed;
      octx.lineWidth = 4;
      octx.lineCap = 'round';
      octx.beginPath();
      octx.ellipse(cx, sy, rX, rY, 0, 0, Math.PI, false);
      octx.stroke();

      // ---- reflective waterline across the top -----------------------------
      octx.fillStyle = r.waterLip;
      octx.fillRect(xL, sy - 2, xR - xL, 2.5);
    }
  }

  _bakeSurface() {
    const octx = this.baseCtx;
    const r = this.config.render;
    const sub = this.substrate;
    const cs = sub.cellSize, sy = sub.surfaceY;

    for (let c = 0; c < sub.cols; c++) {
      const surf = sub.surface[c];
      const x = c * cs;
      const lineY = sy;   // flat, continuous soil line (per-column jitter made jagged corners)

      if (surf.soil) {
        // Fruitable ground (the goal zone). Sunlit + a soft glow so it reads as
        // the way out; ordinary soil crust otherwise.
        if (surf.goal) {
          const gg = octx.createLinearGradient(0, lineY - 18, 0, lineY + 16);
          gg.addColorStop(0, r.goalGlow);
          gg.addColorStop(0.5, 'rgba(0,0,0,0)');
          octx.fillStyle = gg;
          octx.fillRect(x, lineY - 18, cs + 1, 18);
          const cg = octx.createLinearGradient(0, lineY - 2, 0, lineY + 16);
          cg.addColorStop(0, r.goalSoil);
          cg.addColorStop(1, r.soilTop);
          octx.fillStyle = cg;
          octx.fillRect(x, lineY, cs + 1, 18);
          octx.fillStyle = r.goalSoil;
          octx.globalAlpha = 0.7;
          octx.fillRect(x, lineY - 1, cs + 1, 1.5);
          octx.globalAlpha = 1;
        } else {
          const cg = octx.createLinearGradient(0, lineY - 2, 0, lineY + 16);
          cg.addColorStop(0, r.crust);
          cg.addColorStop(1, r.soilTop);
          octx.fillStyle = cg;
          octx.fillRect(x, lineY, cs + 1, 18);
          octx.fillStyle = r.crustLip;
          octx.globalAlpha = 0.6;
          octx.fillRect(x, lineY - 1, cs + 1, 1.5);
          octx.globalAlpha = 1;
        }
      } else if (surf.barrier === 'lake') {
        // Lake basins are drawn as full water-filled bowls by _bakeWater().
      } else if (surf.barrier === 'mountain') {
        if (hasAsset('mountain1') || hasAsset('mountain2') || hasAsset('mountain3')) {
          // A mountain SPRITE caps this run (main.js). The ground beneath is now
          // plain earth (the path-blocking rock column was removed), so bake the
          // normal soil crust here too — the surface band reads continuous across
          // the mountain instead of breaking at it.
          const cg = octx.createLinearGradient(0, lineY - 2, 0, lineY + 16);
          cg.addColorStop(0, r.crust);
          cg.addColorStop(1, r.soilTop);
          octx.fillStyle = cg;
          octx.fillRect(x, lineY, cs + 1, 18);
          octx.fillStyle = r.crustLip;
          octx.globalAlpha = 0.6;
          octx.fillRect(x, lineY - 1, cs + 1, 1.5);
          octx.globalAlpha = 1;
        } else {
          // Procedural fallback — a raised rocky ridge rising above the soil line.
          const rise = 10 + this.rng() * 22;
          octx.fillStyle = r.mountainRock;
          octx.fillRect(x, lineY - rise, cs + 1, rise + 16);
          octx.fillStyle = r.mountainFacet;
          octx.beginPath();
          octx.moveTo(x, lineY - rise * 0.6);
          octx.lineTo(x + cs * 0.5, lineY - rise);
          octx.lineTo(x + cs * 0.5, lineY + 14);
          octx.lineTo(x, lineY + 14);
          octx.closePath();
          octx.fill();
          octx.strokeStyle = 'rgba(0,0,0,0.45)';
          octx.lineWidth = 1;
          octx.beginPath();
          octx.moveTo(x + this.rng() * cs, lineY - rise * 0.5);
          octx.lineTo(x + this.rng() * cs, lineY + 12);
          octx.stroke();
        }
      } else {
        // Man-made / impassable middle ground — rendered as ordinary dark dirt so
        // it reads as plain non-fruitable ground. (The old grey 'concrete' cap is
        // gone; cities, lakes and mountains are the surface landmarks now.)
        const cg = octx.createLinearGradient(0, lineY - 2, 0, lineY + 16);
        cg.addColorStop(0, r.crust);
        cg.addColorStop(1, r.soilTop);
        octx.fillStyle = cg;
        octx.fillRect(x, lineY, cs + 1, 18);
        octx.fillStyle = r.crustLip;
        octx.globalAlpha = 0.6;
        octx.fillRect(x, lineY - 1, cs + 1, 1.5);
        octx.globalAlpha = 1;
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
    octx.lineCap = 'round';

    // Substrate (food) is now drawn as heaped LEAF SPRITES by main.js, so the
    // old procedural detritus (the round lumps that showed through under the
    // leaves) is no longer baked here.

    // Trichoderma — fuzzy speckled growth. Drawn boldly so it's easy to spot:
    // even faint mould reads clearly, and it holds opacity well across the cell.
    sub.forEachCell((cell, col, row) => {
      if (cell.trich <= 0) return;
      const a = Math.min(0.95, 0.5 + cell.trich * 0.5);
      const cx = col * cs + cs / 2, cy = sy + row * cs + cs / 2;
      const rad = cs * 0.85;
      const g = octx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, withAlpha(hexToRgb(r.trich), a));
      g.addColorStop(0.6, withAlpha(hexToRgb(r.trich), a * 0.85));
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
// Stable per-cell pseudo-random in [0,1) — keeps detritus/mat detail fixed
// across re-bakes so the matter doesn't shimmer each turn.
function h2(a, b) { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); }
