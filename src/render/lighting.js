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
    // The sensing aura is a SMOOTH radial falloff (no bright plateau). A plateau
    // held full brightness out to ~62% then dropped sharply, so its hard disc edge
    // read as a SECOND lit circle sitting inside the colony's own glow. A smooth
    // gradient blends with the network glow into one soft lantern while still
    // reaching most of the sensing range.
    this.spriteSense = makeGlowSprite(r.senseLight, [[0, 0.95], [0.4, 0.6], [0.68, 0.3], [0.86, 0.12], [1, 0]]);
  }

  // Dim the scene already drawn to `ctx` and add the colony's light back in.
  compose(ctx, camera, state, networkRenderers, substrateRenderer, time = 0) {
    const r = this.config.render;
    if (!r.lighting || r.ambientLight >= 1) return; // lighting off / no darkening
    const breath = 1; // steady lighting (no global breathing — it's distracting)
    const W = camera.viewW, H = camera.viewH;
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W; this.canvas.height = H;
    }
    const lc = this.lctx;

    // 1) Darken ONLY the underground; the daytime sky above stays bright (the
    //    light map is white over the sky, so the multiply leaves it untouched).
    const a = r.ambientLight;
    // warm tint so unlit earth reads as rich brown (not cold black)
    const amb = `rgb(${clamp255(255 * a)},${clamp255(255 * a * 0.9)},${clamp255(255 * a * 0.76)})`;
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

    // Nutrient pockets no longer emit a radial glow — that halo read like a
    // "field of vision" around the substrate. Food is shown as heaped leaves
    // (main.js), lit only by ambient + the colony, not its own light.
    if (substrateRenderer) {
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
      if (!tips || !tips.length) continue;
      // The aura builds up where many frontier tips overlap; with only a few tips
      // (the seed strand at game start) a lone aura is faint and its lit edge falls
      // well short of the true range. Scale each tip's alpha up when the frontier is
      // sparse so the lit area reaches the real reach from the very first turn.
      // Weight the frontier count by each tip's reveal so a grow's not-yet-revealed
      // tips don't instantly collapse the boost (which would DIM the existing aura
      // for the whole reveal); the boost eases down as the new tips fade in.
      const revs = tips.map((t) => rend.revealFactor(t, time));
      let effTips = 0; for (const rv of revs) effTips += rv;
      const sparseBoost = Math.min(2.6, Math.max(1, 5 / Math.max(1, effTips)));
      const senseAlpha = 0.06 * breath * sparseBoost;   // faint aura — well below the colony's own glow
      for (let ti = 0; ti < tips.length; ti++) {
        // Follow the growth animation: a frontier tip only casts its aura once
        // its strand has started growing in, ramping + moving with the tip.
        const rev = revs[ti];
        if (rev <= 0) continue;
        const t = tips[ti];
        let tx = t.x, ty = t.y;
        if (rev < 1) {
          const p = t.parentId != null ? net.byId.get(t.parentId) : null;
          if (p) { tx = p.x + (t.x - p.x) * rev; ty = p.y + (t.y - p.y) * rev; }
        }
        this._light(lc, camera, this.spriteSense, tx, ty, senseR, senseAlpha * rev, W, H);
      }
    }

    // The living network — mint glow following the filaments.
    for (const net of state.networks) {
      if (!net.alive && !net.fruited) continue;
      const bright = breath; // glow independent of vitality
      const nodes = net.nodes;
      const rend = networkRenderers && networkRenderers.get(net.id);
      // Keep glow DENSITY roughly constant as the colony grows (don't let a
      // fixed light budget spread thin and make a big colony look faint).
      const stride = Math.max(1, Math.ceil(nodes.length / 600));
      for (let i = 0; i < nodes.length; i += stride) {
        const n = nodes[i];
        if (n.infected) continue;  // dead strands don't glow
        // Follow the growth animation instead of lighting the whole end-state
        // colony at once: skip a node until its strand starts, and fade + move
        // its glow with the growing tip.
        let nx = n.x, ny = n.y, k = bright * 0.9;
        if (rend) {
          const rev = rend.revealFactor(n, time);
          if (rev <= 0) continue;
          if (rev < 1) {
            const p = n.parentId != null ? net.byId.get(n.parentId) : null;
            if (p) { nx = p.x + (n.x - p.x) * rev; ny = p.y + (n.y - p.y) * rev; }
            k *= rev;
          }
        }
        this._light(lc, camera, this.spriteNetwork, nx, ny, baseR * 1.0, k, W, H);
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
// `stops` is an optional [pos, alpha] falloff profile (pos 0→1 = centre→edge);
// the default is a steep point-light falloff. A fuller profile keeps the glow
// bright further out so its visible extent matches the drawn radius.
function makeGlowSprite(color, stops) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const rgb = color.replace(/rgba?\(/, '').replace(')', '').split(',').slice(0, 3).map((s) => s.trim());
  const profile = stops || [[0, 1], [0.5, 0.35], [1, 0]];
  for (const [pos, a] of profile) grd.addColorStop(pos, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
