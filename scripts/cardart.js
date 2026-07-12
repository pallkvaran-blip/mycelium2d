/* =============================================================================
 * Generative card art for the six TEMPO cards (browser Canvas 2D).
 *
 * One source of truth: the picker artifact inlines this, and the Playwright baker
 * calls it to render the chosen option to a 520x404 JPG. Fully deterministic
 * (seeded PRNG) so a given (slug, option) ALWAYS draws the same image — the
 * preview the player picks is exactly what ships.
 *
 * On-brand with the deck: dark fungal soil, glowing hyphal network, travelling
 * "impulse" pulses (the tempo/speed motif). Two families:
 *   action  → cool teal-green signal (Quickened Reflex / Impulse Relay / Hair-Trigger)
 *   engine  → warm amber metabolism (Brisk Metabolism / Enzyme Overclock / Metabolic Surge)
 * Tier (1-3) scales glow, pulse count and heat. Five composition "lenses" give
 * five distinct options per card.
 * ========================================================================== */
(function (root) {
  'use strict';

  // (slug -> art spec). Order matters for the picker layout.
  const CARD_ART_SPECS = [
    { slug: 'quickened-reflex', name: 'Quickened Reflex', family: 'action', tier: 1 },
    { slug: 'impulse-relay', name: 'Impulse Relay', family: 'action', tier: 2 },
    { slug: 'hair-trigger-hyphae', name: 'Hair-Trigger Hyphae', family: 'action', tier: 3 },
    { slug: 'brisk-metabolism', name: 'Brisk Metabolism', family: 'engine', tier: 1 },
    { slug: 'enzyme-overclock', name: 'Enzyme Overclock', family: 'engine', tier: 2 },
    { slug: 'metabolic-surge', name: 'Metabolic Surge', family: 'engine', tier: 3 },
  ];
  const SPEC_BY_SLUG = {};
  for (const s of CARD_ART_SPECS) SPEC_BY_SLUG[s.slug] = s;

  const LENS = ['radial', 'relay', 'macro', 'drill', 'mat'];
  const LENS_LABEL = ['Radial burst', 'Signal relay', 'Macro close-up', 'Deep drill', 'Dense mat'];

  // deterministic seed from a string
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // option (0..4) -> { lens, seed } for a slug
  function optionParams(slug, opt) {
    const spec = SPEC_BY_SLUG[slug] || { family: 'action', tier: 1 };
    return {
      slug, family: spec.family, tier: spec.tier,
      lens: LENS[opt % LENS.length],
      seed: (hashStr(slug) + opt * 0x9E37 + 1) >>> 0,
    };
  }

  // ---- palette ------------------------------------------------------------
  function palette(family, tier) {
    if (family === 'engine') {
      // warm amber / gold metabolism; hotter with tier
      return {
        bg0: '#140d06', bg1: '#050303',
        thread: [255, 190, 108],
        spark: [255, 226, 150],
        bloom: [255, 150, 60],
        accentCss: 'rgba(255,185,94,',
        heat: 0.55 + tier * 0.15,
      };
    }
    // cool teal-green signal
    return {
      bg0: '#08140f', bg1: '#03080a',
      thread: [126, 240, 192],
      spark: [190, 255, 224],
      bloom: [70, 200, 160],
      accentCss: 'rgba(126,240,192,',
      heat: 0.42 + tier * 0.12,
    };
  }
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  // ---- background ---------------------------------------------------------
  function drawGround(ctx, W, H, pal, rng) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.bg0); g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // grain: soft dark blobs so the soil isn't flat
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = rng() * W, y = rng() * H, r = 30 + rng() * 90;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(pal.bloom, 0.05 + rng() * 0.05));
      rg.addColorStop(1, rgba(pal.bloom, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // one organic glowing strand from (x,y) heading `ang`, recursively branching
  function strand(ctx, x, y, ang, len, width, depth, pal, rng, nodes) {
    if (depth <= 0 || len < 6) return;
    const segs = 3 + ((rng() * 3) | 0);
    let px = x, py = y, a = ang;
    const step = len / segs;
    ctx.lineCap = 'round';
    for (let i = 0; i < segs; i++) {
      a += (rng() - 0.5) * 0.6;
      const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
      const midx = (px + nx) / 2 + (rng() - 0.5) * step * 0.4;
      const midy = (py + ny) / 2 + (rng() - 0.5) * step * 0.4;
      // faint outer glow pass
      ctx.strokeStyle = rgba(pal.thread, 0.10);
      ctx.lineWidth = width * 2.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(midx, midy, nx, ny); ctx.stroke();
      // bright core
      ctx.strokeStyle = rgba(pal.thread, 0.7);
      ctx.lineWidth = Math.max(0.6, width);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(midx, midy, nx, ny); ctx.stroke();
      px = nx; py = ny;
      if (rng() < 0.35) nodes.push({ x: px, y: py, r: width * (0.9 + rng()) });
    }
    // branch
    const branches = rng() < 0.85 ? 2 : 1;
    for (let b = 0; b < branches; b++) {
      strand(ctx, px, py, a + (rng() - 0.5) * 1.3, len * (0.6 + rng() * 0.25), width * 0.7, depth - 1, pal, rng, nodes);
    }
    nodes.push({ x: px, y: py, r: width });
  }

  function glowNodes(ctx, nodes, pal, tier) {
    ctx.globalCompositeOperation = 'lighter';
    for (const n of nodes) {
      const r = Math.max(1.2, n.r) * 2.4;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
      g.addColorStop(0, rgba(pal.spark, 0.5));
      g.addColorStop(0.4, rgba(pal.thread, 0.22));
      g.addColorStop(1, rgba(pal.thread, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // travelling impulse: a bright head + comet tail (the tempo motif)
  function impulse(ctx, x, y, ang, size, pal, rng) {
    const len = size * (5 + rng() * 5);
    ctx.globalCompositeOperation = 'lighter';
    // tail
    const tx = x - Math.cos(ang) * len, ty = y - Math.sin(ang) * len;
    const g = ctx.createLinearGradient(x, y, tx, ty);
    g.addColorStop(0, rgba(pal.spark, 0.9));
    g.addColorStop(1, rgba(pal.spark, 0));
    ctx.strokeStyle = g; ctx.lineWidth = size * 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    // head bloom
    const hb = ctx.createRadialGradient(x, y, 0, x, y, size * 3.4);
    hb.addColorStop(0, rgba([255, 255, 255], 0.95));
    hb.addColorStop(0.3, rgba(pal.spark, 0.7));
    hb.addColorStop(1, rgba(pal.spark, 0));
    ctx.fillStyle = hb; ctx.beginPath(); ctx.arc(x, y, size * 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function motes(ctx, W, H, n, pal, rng) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = rng() * W, y = rng() * H, r = 0.6 + rng() * 1.8;
      ctx.fillStyle = rgba(pal.spark, 0.15 + rng() * 0.4);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function bloom(ctx, x, y, r, pal, a) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(pal.bloom, a));
    g.addColorStop(1, rgba(pal.bloom, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function vignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---- the composition ----------------------------------------------------
  function drawCardArt(ctx, W, H, opts) {
    const pal = palette(opts.family, opts.tier);
    const rng = mulberry32(opts.seed >>> 0);
    const tier = opts.tier || 1;

    drawGround(ctx, W, H, pal, rng);

    const nodes = [];
    const pulseCount = 3 + tier * 3;      // more pulses at higher tier
    const heat = pal.heat;

    ctx.save();
    if (opts.lens === 'radial') {
      const cx = W * (0.42 + rng() * 0.16), cy = H * (0.5 + (rng() - 0.5) * 0.12);
      bloom(ctx, cx, cy, Math.max(W, H) * 0.5, pal, 0.10 + heat * 0.12);
      const arms = 6 + tier;
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2 + rng() * 0.4;
        strand(ctx, cx, cy, a, W * (0.28 + rng() * 0.14), 2.2, 3, pal, rng, nodes);
      }
      glowNodes(ctx, nodes, pal, tier);
      for (let i = 0; i < pulseCount; i++) {
        const a = rng() * Math.PI * 2, d = 30 + rng() * (W * 0.32);
        impulse(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, a, 2 + tier * 0.8, pal, rng);
      }
    } else if (opts.lens === 'relay') {
      // strands crossing left->right with pulses mid-flight
      const lanes = 3 + tier;
      for (let i = 0; i < lanes; i++) {
        const y = H * (0.15 + 0.7 * (i + rng() * 0.6) / lanes);
        strand(ctx, -10, y, (rng() - 0.5) * 0.4, W * (0.9 + rng() * 0.3), 2.0, 3, pal, rng, nodes);
      }
      bloom(ctx, W * 0.5, H * 0.5, Math.max(W, H) * 0.42, pal, 0.08 + heat * 0.1);
      glowNodes(ctx, nodes, pal, tier);
      for (let i = 0; i < pulseCount + 2; i++) {
        const y = H * (0.12 + rng() * 0.76);
        impulse(ctx, W * (0.2 + rng() * 0.7), y, 0.05 + (rng() - 0.5) * 0.3, 2 + tier * 0.9, pal, rng);
      }
    } else if (opts.lens === 'macro') {
      // few thick strands, big node, shallow-DOF feel
      const cx = W * (0.3 + rng() * 0.2), cy = H * (0.62 + rng() * 0.14);
      bloom(ctx, cx, cy - H * 0.1, Math.max(W, H) * 0.4, pal, 0.12 + heat * 0.14);
      for (let i = 0; i < 3 + tier; i++) {
        strand(ctx, cx, cy, -Math.PI / 2 + (rng() - 0.5) * 1.6, H * (0.5 + rng() * 0.2), 3.6, 3, pal, rng, nodes);
      }
      glowNodes(ctx, nodes, pal, tier);
      // hero node
      const hx = cx + (rng() - 0.5) * W * 0.15, hy = cy - H * (0.25 + rng() * 0.1);
      const hb = ctx.createRadialGradient(hx, hy, 0, hx, hy, 34 + tier * 6);
      hb.addColorStop(0, rgba([255, 255, 255], 0.9)); hb.addColorStop(0.35, rgba(pal.spark, 0.6)); hb.addColorStop(1, rgba(pal.thread, 0));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hb; ctx.beginPath(); ctx.arc(hx, hy, 34 + tier * 6, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < pulseCount; i++) impulse(ctx, hx + (rng() - 0.5) * 60, hy + (rng() - 0.2) * 90, -Math.PI / 2 + (rng() - 0.5), 3 + tier, pal, rng);
    } else if (opts.lens === 'drill') {
      // vertical taproot with descending pulses
      const cx = W * (0.42 + rng() * 0.16);
      bloom(ctx, cx, H * 0.15, Math.max(W, H) * 0.4, pal, 0.09 + heat * 0.11);
      strand(ctx, cx, -10, Math.PI / 2, H * 1.1, 4.2, 4, pal, rng, nodes);
      for (let i = 0; i < 2 + tier; i++) strand(ctx, cx + (rng() - 0.5) * W * 0.3, H * (0.2 + rng() * 0.5), Math.PI / 2 + (rng() - 0.5), H * 0.4, 2.2, 2, pal, rng, nodes);
      glowNodes(ctx, nodes, pal, tier);
      for (let i = 0; i < pulseCount; i++) impulse(ctx, cx + (rng() - 0.5) * 26, H * rng(), Math.PI / 2 + (rng() - 0.5) * 0.3, 2 + tier, pal, rng);
    } else { // mat
      const strands = 10 + tier * 3;
      for (let i = 0; i < strands; i++) {
        strand(ctx, rng() * W, H + 10, -Math.PI / 2 + (rng() - 0.5) * 1.2, H * (0.4 + rng() * 0.5), 1.6, 3, pal, rng, nodes);
      }
      bloom(ctx, W * (0.3 + rng() * 0.4), H * (0.4 + rng() * 0.3), Math.max(W, H) * 0.45, pal, 0.08 + heat * 0.1);
      glowNodes(ctx, nodes, pal, tier);
      motes(ctx, W, H, 30 + tier * 12, pal, rng);
      for (let i = 0; i < pulseCount; i++) impulse(ctx, rng() * W, rng() * H, rng() * Math.PI * 2, 1.6 + tier * 0.7, pal, rng);
    }
    ctx.restore();

    motes(ctx, W, H, 18 + tier * 6, pal, rng);
    vignette(ctx, W, H);
  }

  root.CardArt = { CARD_ART_SPECS, SPEC_BY_SLUG, LENS, LENS_LABEL, optionParams, drawCardArt };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CardArt;
})(typeof window !== 'undefined' ? window : globalThis);
