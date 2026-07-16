// =============================================================================
// Title screen — procedural white MYCELIUM on black.
//
// The word "MYCELIUM" is spelled by living white mycelium: filaments fill the
// letter shapes (space-colonization growth) and a few tendrils creep outward in
// every direction. Menu words are DOM (for layout/accessibility/grayed states):
//   Survival — New / Continue   (active)
//   Campaign — New / Continue   (grayed) + "coming soon"
// Pressing New/Continue grows the mycelium INTO that word and consumes it (the
// word becomes mycelium) before the transition fires.
//
// Self-contained (own growth + renderer) so it matches the game's look without
// coupling to the sim. Namespaced #titleScreen / .ts-*.
// =============================================================================

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const TITLE = 'MYCELIUM';

export function showTitleScreen({ onNew, onContinue }) {
  const reduce = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = el('div'); root.id = 'titleScreen';
  root.innerHTML =
    '<canvas id="tsCanvas"></canvas>' +
    '<div class="ts-menu">' +
      '<div class="ts-block">' +
        '<div class="ts-mode">Survival</div>' +
        '<div class="ts-actions">' +
          '<button class="ts-btn" id="tsNew" type="button">New</button>' +
          '<button class="ts-btn" id="tsCont" type="button">Continue</button>' +
        '</div>' +
      '</div>' +
      '<div class="ts-gap" id="tsGap"></div>' +
      '<div class="ts-block">' +
        '<div class="ts-actions">' +
          '<span class="ts-btn ts-locked">New</span>' +
          '<span class="ts-btn ts-locked">Continue</span>' +
        '</div>' +
        '<div class="ts-mode ts-locked">Campaign</div>' +
        '<div class="ts-soon">coming soon</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  const canvas = root.querySelector('#tsCanvas');
  const ctx = canvas.getContext('2d');
  const gapEl = root.querySelector('#tsGap');

  let W = 0, H = 0, dpr = 1, ink = null, ictx = null;
  let titleSize = 0, titleY = 0, cx = 0;
  let g = null;                 // growth state
  let raf = 0, consuming = false, finished = false;

  // ---- spatial-grid space colonization -----------------------------------
  function grid(gr, x, y) { return ((x / gr.cell) | 0) + ',' + ((y / gr.cell) | 0); }
  function addNode(gr, x, y, parent) {
    const i = gr.nodes.length;
    gr.nodes.push({ x, y, parent });
    const k = grid(gr, x, y);
    let a = gr.map.get(k); if (!a) { a = []; gr.map.set(k, a); }
    a.push(i);
    return i;
  }
  function nearestNode(gr, x, y) {                 // nearest node index within attractionDist, else -1
    const cxg = (x / gr.cell) | 0, cyg = (y / gr.cell) | 0;
    let best = -1, bd = gr.attract2;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = gr.map.get((cxg + dx) + ',' + (cyg + dy));
      if (!a) continue;
      for (const i of a) { const n = gr.nodes[i]; const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = i; } }
    }
    return best < 0 ? -1 : (gr._bd = bd, best);
  }

  function newGrowth() {
    // Fine segments + short reach + tight kill = a DENSE mat of strands that fills the
    // glyphs (the letters read from the strands alone — no fill/ghost). Short attraction
    // keeps the grid cheap so the high strand count stays smooth.
    const seg = Math.max(2, titleSize * 0.016);
    const attract = titleSize * 0.06;
    return {
      nodes: [], segs: [], attractors: [], map: new Map(),
      seg, attract, attract2: attract * attract, kill2: (seg * 1.05) ** 2, cell: attract, _bd: 0, done: false,
    };
  }

  function step(gr) {
    if (!gr.attractors.length || gr.nodes.length > 60000) { gr.done = true; return; }
    const infl = new Map(); const survivors = [];
    for (const at of gr.attractors) {
      const ni = nearestNode(gr, at.x, at.y);
      if (ni < 0) { survivors.push(at); continue; }
      if (gr._bd <= gr.kill2) continue;                 // reached — consume this attractor
      survivors.push(at);
      const n = gr.nodes[ni];
      let e = infl.get(ni); if (!e) { e = [0, 0]; infl.set(ni, e); }
      const dx = at.x - n.x, dy = at.y - n.y, L = Math.hypot(dx, dy) || 1;
      e[0] += dx / L; e[1] += dy / L;
    }
    gr.attractors = survivors;
    for (const [ni, e] of infl) {
      const n = gr.nodes[ni];
      let dx = e[0], dy = e[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const ja = rnd(-0.35, 0.35), c = Math.cos(ja), s = Math.sin(ja);
      const rx = dx * c - dy * s, ry = dx * s + dy * c;
      const nx = n.x + rx * gr.seg, ny = n.y + ry * gr.seg;
      const idx = addNode(gr, nx, ny, ni);
      gr.segs.push([n.x, n.y, nx, ny, gr.nodes[idx]]);
    }
  }

  // Sample white pixels from a text render into attractor points (CSS coords).
  function attractorsFromText(drawFn, stepPx) {
    const st = Math.max(2, Math.round(stepPx));        // MUST be an integer — it indexes a typed pixel array
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d'); drawFn(o);
    const d = o.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += st) for (let x = 0; x < W; x += st) {
      if (d[(y * W + x) * 4 + 3] > 70) pts.push({ x: x + rnd(-st / 2, st / 2), y: y + rnd(-st / 2, st / 2) });
    }
    return pts;
  }
  function titleFont(size) { return '800 ' + size + 'px "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'; }

  function seedTitle() {
    g = newGrowth();
    // dense glyph attractors → the letters are built ENTIRELY from strands (no fill)
    let pts = attractorsFromText((o) => {
      o.fillStyle = '#fff'; o.font = titleFont(titleSize); o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(TITLE, cx, titleY);
    }, Math.max(2, Math.round(g.seg * 0.9)));
    // seeds: many spread points become the first nodes so every part of every letter fills
    for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = pts[i]; pts[i] = pts[j]; pts[j] = t; }
    const seeds = pts.splice(0, Math.min(140, pts.length));
    for (const s of seeds) addNode(g, s.x, s.y, -1);
    g.attractors = pts;
    // outward tendrils: chains of attractors leading out from seed points (reach in all dirs)
    for (let i = 0; i < 24; i++) {
      const s = seeds[(Math.random() * seeds.length) | 0]; if (!s) break;
      const ang = Math.atan2(s.y - titleY, s.x - cx) + rnd(-0.55, 0.55);
      const n = 6 + ((Math.random() * 9) | 0);
      for (let k = 1; k <= n; k++) g.attractors.push({ x: s.x + Math.cos(ang) * g.attract * 0.6 * k, y: s.y + Math.sin(ang) * g.attract * 0.6 * k });
    }
    if (reduce) { let guard = 0; while (!g.done && guard++ < 40000) step(g); flushInk(); }
  }

  // ---- rendering ---------------------------------------------------------
  function flushInk() {
    if (!g.segs.length) return;
    ictx.strokeStyle = 'rgba(233,255,247,0.9)';
    ictx.lineWidth = 0.85 * dpr; ictx.lineCap = 'round';
    ictx.beginPath();
    for (const s of g.segs) { ictx.moveTo(s[0] * dpr, s[1] * dpr); ictx.lineTo(s[2] * dpr, s[3] * dpr); }
    ictx.stroke();
    g.segs.length = 0;
  }
  function composite() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(' + (2.5 * dpr) + 'px)'; ctx.globalAlpha = 0.55; ctx.drawImage(ink, 0, 0);   // bloom
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.drawImage(ink, 0, 0);                              // sharp
    ctx.restore();
  }

  function frame() {
    if (finished) return;
    if (!g.done || consuming) { for (let i = 0; i < 5; i++) step(g); flushInk(); }
    composite();
    raf = requestAnimationFrame(frame);
  }

  // ---- consume a menu word, then fire its callback ------------------------
  function consume(btn, cb) {
    if (consuming || finished) return; consuming = true;
    root.querySelectorAll('.ts-btn').forEach((b) => { if (b !== btn) b.style.pointerEvents = 'none'; });
    const rr = root.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const bx = br.left - rr.left + br.width / 2, by = br.top - rr.top + br.height / 2;
    const cs = getComputedStyle(btn);
    const pts = attractorsFromText((o) => {
      o.fillStyle = '#fff'; o.font = cs.fontWeight + ' ' + cs.fontSize + '/' + cs.fontSize + ' ' + cs.fontFamily;
      o.textAlign = 'center'; o.textBaseline = 'middle';
      // honour letter-spacing so the sampled mask matches the rendered word
      const t = btn.textContent, ls = parseFloat(cs.letterSpacing) || 0;
      if (ls) { o.save(); let total = 0; for (const ch of t) total += o.measureText(ch).width + ls; let x = bx - (total - ls) / 2; o.textAlign = 'left'; for (const ch of t) { o.fillText(ch, x, by); x += o.measureText(ch).width + ls; } o.restore(); }
      else o.fillText(t, bx, by);
    }, Math.max(2.5, titleSize * 0.02));
    // bridge: a trail of attractors from the nearest title node to the button
    let near = g.nodes[0] || { x: cx, y: titleY };
    let bd = Infinity;
    for (const n of g.nodes) { const d = (n.x - bx) ** 2 + (n.y - by) ** 2; if (d < bd) { bd = d; near = n; } }
    const steps = Math.max(2, Math.hypot(bx - near.x, by - near.y) / (g.attract * 0.55) | 0);
    for (let i = 1; i <= steps; i++) g.attractors.push({ x: near.x + (bx - near.x) * i / steps, y: near.y + (by - near.y) * i / steps });
    for (const p of pts) g.attractors.push(p);
    g.done = false;
    btn.classList.add('ts-consuming');
    const finish = () => {
      finished = true;
      root.style.transition = 'opacity .55s ease'; root.style.opacity = '0';
      setTimeout(() => { cancelAnimationFrame(raf); root.remove(); cb && cb(); }, 560);
    };
    if (reduce) { let guard = 0; while (!g.done && guard++ < 4000) step(g); flushInk(); composite(); setTimeout(finish, 300); }
    else setTimeout(finish, 1350);
  }

  // ---- layout / boot -----------------------------------------------------
  function layout() {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    W = root.clientWidth; H = root.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ink = document.createElement('canvas'); ink.width = canvas.width; ink.height = canvas.height;
    ictx = ink.getContext('2d');
    titleSize = Math.min(H * 0.24, (W * 0.82) / (TITLE.length * 0.62));
    gapEl.style.height = (titleSize * 1.6) + 'px';
    const gr = gapEl.getBoundingClientRect(), rr = root.getBoundingClientRect();
    cx = W / 2; titleY = gr.top - rr.top + gr.height / 2;
    seedTitle();
    composite();
  }

  root.querySelector('#tsNew').addEventListener('click', () => consume(root.querySelector('#tsNew'), onNew));
  root.querySelector('#tsCont').addEventListener('click', () => consume(root.querySelector('#tsCont'), onContinue));

  let rt = 0;
  const onResize = () => { if (consuming || finished) return; clearTimeout(rt); rt = setTimeout(layout, 200); };
  window.addEventListener('resize', onResize);

  layout();
  if (!reduce) raf = requestAnimationFrame(frame);

  return { hide() { finished = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); root.remove(); } };
}
