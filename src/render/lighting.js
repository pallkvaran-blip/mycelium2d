// =============================================================================
// Lighting — dynamic 2D lighting for the cross-section (render only).
//
// The underground is dimmed to an ambient darkness, then light is added back
// where things glow: the living network (mint), nutrient pockets (warm) and
// toxic pools (teal). Composited over the scene with a multiply pass, so areas
// far from any light fall into shadow and the colony reads as a light source in
// the dark — which also makes distant food/danger glow as points of interest.
//
// Performance: lights are drawn from a few pre-rendered radial "glow sprites"
// (one drawImage each) instead of building a gradient per light per frame, so
// it stays cheap even on phones.
// =============================================================================

export class Lighting {
  constructor(config) {
    this.config = config;
    this.canvas = document.createElement('canvas');
    this.lctx = this.canvas.getContext('2d');
    const r = config.render;
    this.spriteNetwork = makeGlowSprite(r.networkLight);
    this.spriteFood = makeGlowSprite(r.foodLight);
    this.spriteHazard = makeGlowSprite(r.hazardLight);
    this.spriteSense = makeGlowSprite(r.senseLight);
  }

  // Dim the scene already drawn to `ctx` and add the colony's light back in.
  compose(ctx, camera, state, networkRenderers, substrateRenderer, time = 0) {
    const r = this.config.render;
    if (!r.lighting || r.ambientLight >= 1) return; // lighting off / no darkening
    const breath = 0.86 + 0.14 * Math.sin(time * (Math.PI * 2 / 4200)); // slow glow breath
    const W = camera.viewW, H = camera.viewH;
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W; this.canvas.height = H;
    }
    const lc = this.lctx;

    // 1) Darken ONLY the underground; the daytime sky above stays bright (the
    //    light map is white over the sky, so the multiply leaves it untouched).
    const a = r.ambientLight;
    // warm tint so unlit earth reads as brown, not cold black
    const amb = `rgb(${clamp255(255 * a)},${clamp255(255 * a * 0.92)},${clamp255(255 * a * 0.8)})`;
    lc.globalCompositeOperation = 'source-over';
    const surfY = camera.worldToScreen(0, state.substrate.surfaceY).y;
    const band = 50; // soft transition across the soil line
    const ay = Math.max(0, Math.min(H, surfY - band));
    const by = Math.max(0, Math.min(H, surfY + band));
    lc.fillStyle = '#ffffff';
    lc.fillRect(0, 0, W, ay);
    if (by > ay) {
      const tg = lc.createLinearGradient(0, ay, 0, by);
      tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, amb);
      lc.fillStyle = tg; lc.fillRect(0, ay, W, by - ay);
    }
    lc.fillStyle = amb;
    lc.fillRect(0, by, W, H - by);

    // 2) Add light from every emitter (additive).
    lc.globalCompositeOperation = 'lighter';
    const baseR = r.lightRadius * camera.zoom;

    // Nutrient pockets — warm glow.
    if (substrateRenderer) {
      for (const p of substrateRenderer.foodLightPoints) {
        this._light(lc, camera, this.spriteFood, p.x, p.y, baseR * (0.7 + p.i * 0.6), 0.5 + p.i * 0.4, W, H);
      }
      // Toxic pools — teal glow.
      const hp = substrateRenderer.hazardLightPoints;
      const hs = Math.max(1, Math.ceil(hp.length / 60));
      for (let i = 0; i < hp.length; i += hs) {
        this._light(lc, camera, this.spriteHazard, hp[i].x, hp[i].y, baseR * 1.0, 0.6, W, H);
      }
    }

    // Sensing range — the area the colony can sense reads as faintly more lit
    // than out-of-range earth (a soft aura at the frontier, not per-tip rings).
    const senseR = this.config.growth.sensingRadius * camera.zoom;
    for (const net of state.networks) {
      if (!net.alive && !net.fruited) continue;
      const rend = networkRenderers && networkRenderers.get(net.id);
      const tips = rend && rend.frontierTips;
      if (!tips) continue;
      for (const t of tips) {
        this._light(lc, camera, this.spriteSense, t.x, t.y, senseR, 0.1 * breath, W, H);
      }
    }

    // The living network — mint glow following the filaments.
    for (const net of state.networks) {
      if (!net.alive && !net.fruited) continue;
      const bright = (0.35 + 0.65 * net.vitality) * breath;
      const nodes = net.nodes;
      // Keep glow DENSITY roughly constant as the colony grows (don't let a
      // fixed light budget spread thin and make a big colony look faint).
      const stride = Math.max(1, Math.ceil(nodes.length / 600));
      for (let i = 0; i < nodes.length; i += stride) {
        const n = nodes[i];
        this._light(lc, camera, this.spriteNetwork, n.x, n.y, baseR * 1.0, bright * 0.9 * n.health, W, H);
      }
    }

    // 3) Multiply the light map over the scene.
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();

    // 4) Gentle additive bloom from the same lights for a soft halo.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    ctx.drawImage(this.canvas, 0, 0);
    ctx.restore();
  }

  _light(lc, camera, sprite, wx, wy, rad, alpha, W, H) {
    const s = camera.worldToScreen(wx, wy);
    if (s.x < -rad || s.x > W + rad || s.y < -rad || s.y > H + rad) return;
    lc.globalAlpha = Math.max(0, Math.min(1, alpha));
    lc.drawImage(sprite, s.x - rad, s.y - rad, rad * 2, rad * 2);
  }
}

// A radial glow sprite: solid colour at the centre fading to transparent.
function makeGlowSprite(color) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const rgb = color.replace(/rgba?\(/, '').replace(')', '').split(',').slice(0, 3).map((s) => s.trim());
  grd.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
  grd.addColorStop(0.5, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.35)`);
  grd.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
