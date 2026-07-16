// =============================================================================
// Reusable animated MYCELIUM wordmark — procedural white mycelium on a transparent
// background, grown by space-colonization (mirrors the title screen's look).
//
//   growMyceliumTitle(container, opts?) → { destroy() }
//
// Creates a <canvas> filling `container`, grows the word once (each letter blooms
// from its own random point, with a hairy fringe + stray strands), then HOLDS —
// the RAF loop stops when growth completes (unlike the full title screen, which
// composites every frame), so it's cheap to leave on the species picker.
// Self-contained; the canvas is `.myc-title`. `opts`: { word, stepRate }.
// =============================================================================

import { playGrowBurst } from './sfx.js';

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

export function growMyceliumTitle(container, opts = {}) {
  const WORD = opts.word || 'MYCELIUM';
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'myc-title';
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1, ink = null, ictx = null;
  let titleSize = 0, cx = 0, cy = 0, g = null, raf = 0, stepAcc = 0, alive = true;
  let sfxAcc = 0, sfxLastT = 0;   // grow-SFX swell: nodes since last burst + throttle clock
  const STEP_RATE = opts.stepRate || 2.4;

  // ---- spatial-grid space colonization -----------------------------------
  function grid(gr, x, y) { return ((x / gr.cell) | 0) + ',' + ((y / gr.cell) | 0); }
  function addNode(gr, x, y, parent) {
    const i = gr.nodes.length; gr.nodes.push({ x, y, parent });
    const k = grid(gr, x, y); let a = gr.map.get(k); if (!a) { a = []; gr.map.set(k, a); } a.push(i);
    return i;
  }
  function nearestNode(gr, x, y) {
    const cxg = (x / gr.cell) | 0, cyg = (y / gr.cell) | 0; let best = -1, bd = gr.attract2;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = gr.map.get((cxg + dx) + ',' + (cyg + dy)); if (!a) continue;
      for (const i of a) { const n = gr.nodes[i]; const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    return best < 0 ? -1 : (gr._bd = bd, best);
  }
  function newGrowth() {
    const seg = Math.max(0.5, titleSize * 0.010), attract = titleSize * 0.05;
    return { nodes: [], segs: [], attractors: [], map: new Map(), seg, attract, attract2: attract * attract, kill2: seg * seg, cell: attract, _bd: 0, done: false };
  }
  function step(gr) {
    if (!gr.attractors.length || gr.nodes.length > 90000) { gr.done = true; return; }
    const infl = new Map(), survivors = [];
    for (const at of gr.attractors) {
      const ni = nearestNode(gr, at.x, at.y);
      if (ni < 0) { survivors.push(at); continue; }
      if (gr._bd <= gr.kill2) continue;
      survivors.push(at);
      const n = gr.nodes[ni]; let e = infl.get(ni); if (!e) { e = [0, 0]; infl.set(ni, e); }
      const dx = at.x - n.x, dy = at.y - n.y, L = Math.hypot(dx, dy) || 1; e[0] += dx / L; e[1] += dy / L;
    }
    gr.attractors = survivors;
    for (const [ni, e] of infl) {
      const n = gr.nodes[ni]; let dx = e[0], dy = e[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const ja = rnd(-0.45, 0.45), c = Math.cos(ja), s = Math.sin(ja);
      const rx = dx * c - dy * s, ry = dx * s + dy * c;
      const nx = n.x + rx * gr.seg, ny = n.y + ry * gr.seg;
      addNode(gr, nx, ny, ni); gr.segs.push([n.x, n.y, nx, ny]);
    }
  }
  // Supersample small wordmarks so strand density tracks the font size (see title_screen).
  function attractorsFromText(drawFn, stepPx, aMin = 70, aMax = 256, scale = 1) {
    const st = Math.max(2, Math.round(stepPx));
    const cw = Math.max(1, Math.round(W * scale)), ch = Math.max(1, Math.round(H * scale));
    const off = document.createElement('canvas'); off.width = cw; off.height = ch;
    const o = off.getContext('2d'); if (scale !== 1) o.scale(scale, scale); drawFn(o);
    const d = o.getImageData(0, 0, cw, ch).data, pts = [];
    for (let y = 0; y < ch; y += st) for (let x = 0; x < cw; x += st) {
      const a = d[(y * cw + x) * 4 + 3];
      if (a >= aMin && a < aMax) pts.push({ x: (x + rnd(-st / 2, st / 2)) / scale, y: (y + rnd(-st / 2, st / 2)) / scale });
    }
    return pts;
  }
  const font = (size) => '800 ' + size + 'px "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

  function seed() {
    g = newGrowth();
    const S = Math.max(1, Math.min(4, Math.round(200 / titleSize)));
    const draw = (o, blur) => {
      if (blur) o.filter = 'blur(' + blur + 'px)';
      o.fillStyle = '#fff'; o.font = font(titleSize); o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(WORD, cx, cy);
    };
    const pts = attractorsFromText((o) => draw(o, 0), Math.max(2, Math.round(g.seg * 0.9)), 70, 256, S);
    g.attractors = pts;
    ctx.font = font(titleSize);
    const total = ctx.measureText(WORD).width, x0 = cx - total / 2; let prevW = 0;
    for (let i = 0; i < WORD.length; i++) {
      const w = ctx.measureText(WORD.slice(0, i + 1)).width; const lo = x0 + prevW, hi = x0 + w; prevW = w;
      const inL = pts.filter((pt) => pt.x >= lo && pt.x < hi);
      if (inL.length) { const s = inL[(Math.random() * inL.length) | 0]; addNode(g, s.x, s.y, -1); }
    }
    const fringe = attractorsFromText((o) => draw(o, titleSize * 0.028), Math.max(4, g.seg * 3.5), 12, 100, S);
    for (const f of fringe) g.attractors.push(f);
    const edge = fringe.length ? fringe : pts, sp = g.attract * 0.6;
    for (let i = 0; i < 150; i++) {
      const s = edge[(Math.random() * edge.length) | 0]; if (!s) break;
      const ang = Math.atan2(s.y - cy, s.x - cx) + rnd(-0.7, 0.7), len = 1 + ((Math.random() * 2) | 0);
      let ex = s.x, ey = s.y;
      for (let k = 1; k <= len; k++) { ex = s.x + Math.cos(ang) * sp * k; ey = s.y + Math.sin(ang) * sp * k; g.attractors.push({ x: ex, y: ey }); }
      const br = 3 + ((Math.random() * 4) | 0);
      for (let bi = 0; bi < br; bi++) {
        const ba = ang + rnd(-1, 1), bl = g.attract * rnd(0.4, 0.95);
        g.attractors.push({ x: ex + Math.cos(ba) * bl, y: ey + Math.sin(ba) * bl });
        if (Math.random() < 0.35) g.attractors.push({ x: ex + Math.cos(ba) * bl * 1.6, y: ey + Math.sin(ba) * bl * 1.6 });
      }
    }
    if (reduce) { let guard = 0; while (!g.done && guard++ < 40000) step(g); flushInk(); }
  }

  function flushInk() {
    if (!g.segs.length) return;
    ictx.strokeStyle = 'rgba(233,255,247,0.9)'; ictx.lineWidth = 0.7 * dpr; ictx.lineCap = 'round';
    ictx.beginPath();
    for (const s of g.segs) { ictx.moveTo(s[0] * dpr, s[1] * dpr); ictx.lineTo(s[2] * dpr, s[3] * dpr); }
    ictx.stroke(); g.segs.length = 0;
  }
  function composite() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(' + (2.5 * dpr) + 'px)'; ctx.globalAlpha = 0.55; ctx.drawImage(ink, 0, 0);   // bloom
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.drawImage(ink, 0, 0);                              // sharp
    ctx.restore();
  }
  function frame() {
    if (!alive) return;
    const before = g.nodes.length;
    stepAcc += STEP_RATE;
    while (stepAcc >= 1) { step(g); stepAcc -= 1; }
    flushInk(); composite();
    playGrowSfx(g.nodes.length - before);
    if (!g.done) raf = requestAnimationFrame(frame);   // stop compositing once fully grown
  }
  // Layered "growing" swell that tracks the visible growth: size each burst by the
  // strands added since the last one, throttled so it reads as one organic swell that
  // settles when the word finishes (playGrowBurst self-caps layers/voices/gain).
  function playGrowSfx(grew) {
    if (grew <= 0) return;
    sfxAcc += grew;
    const now = performance.now();
    if (now - sfxLastT >= 170) { playGrowBurst(sfxAcc, 350); sfxAcc = 0; sfxLastT = now; }
  }
  function layout() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const r = container.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ink = document.createElement('canvas'); ink.width = canvas.width; ink.height = canvas.height; ictx = ink.getContext('2d');
    titleSize = Math.min(H * 0.72, (W * 0.9) / (WORD.length * 0.62));
    cx = W / 2; cy = H * 0.52;
    seed();
    composite();
  }

  layout();
  if (!reduce) raf = requestAnimationFrame(frame);

  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (!alive) return; cancelAnimationFrame(raf); layout(); if (!reduce) raf = requestAnimationFrame(frame); }, 200); };
  window.addEventListener('resize', onResize);

  return { destroy() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); canvas.remove(); } };
}
