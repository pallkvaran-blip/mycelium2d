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
      '<div class="ts-block ts-top">' +
        '<div class="ts-mode">Survival</div>' +
        '<div class="ts-actions">' +
          '<button class="ts-btn" id="tsNew" type="button">New</button>' +
          '<button class="ts-btn" id="tsCont" type="button">Continue</button>' +
        '</div>' +
      '</div>' +
      '<div class="ts-block ts-bottom">' +
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

  let W = 0, H = 0, dpr = 1, ink = null, ictx = null;
  let titleSize = 0, titleY = 0, cx = 0;
  let g = null;                 // growth state
  let raf = 0, consuming = false, finished = false, stepAcc = 0;
  let finishFn = null;      // consume-completion handoff
  const STEP_RATE = 1.4;    // growth steps per frame while the title blooms (~30% slower than old 2/frame)
  const CONSUME_RATE = 6;   // faster while a strand shoots out and unfurls a menu word (fewer frames = snappier on hi-dpi)

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
    const seg = Math.max(2, titleSize * 0.010);
    const attract = titleSize * 0.05;
    return {
      nodes: [], segs: [], attractors: [], map: new Map(),
      seg, attract, attract2: attract * attract, kill2: (seg * 1.0) ** 2, cell: attract, _bd: 0, done: false,
    };
  }

  function step(gr) {
    if (!gr.attractors.length || gr.nodes.length > 90000) { gr.done = true; return; }
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
      const ja = rnd(-0.45, 0.45), c = Math.cos(ja), s = Math.sin(ja);
      const rx = dx * c - dy * s, ry = dx * s + dy * c;
      const nx = n.x + rx * gr.seg, ny = n.y + ry * gr.seg;
      const idx = addNode(gr, nx, ny, ni);
      gr.segs.push([n.x, n.y, nx, ny, gr.nodes[idx]]);
    }
  }

  // Sample white pixels from a text render into attractor points (CSS coords).
  function attractorsFromText(drawFn, stepPx, aMin = 70, aMax = 256) {
    const st = Math.max(2, Math.round(stepPx));        // MUST be an integer — it indexes a typed pixel array
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d'); drawFn(o);
    const d = o.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += st) for (let x = 0; x < W; x += st) {
      const a = d[(y * W + x) * 4 + 3];
      if (a >= aMin && a < aMax) pts.push({ x: x + rnd(-st / 2, st / 2), y: y + rnd(-st / 2, st / 2) });
    }
    return pts;
  }
  function titleFont(size) { return '800 ' + size + 'px "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'; }

  function seedTitle() {
    g = newGrowth();
    // dense glyph attractors → the letters are built ENTIRELY from strands (no fill)
    const pts = attractorsFromText((o) => {
      o.fillStyle = '#fff'; o.font = titleFont(titleSize); o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(TITLE, cx, titleY);
    }, Math.max(2, Math.round(g.seg * 0.9)));
    g.attractors = pts;
    // ONE seed per letter — each letter grows outward from a single RANDOM point in it.
    ctx.font = titleFont(titleSize);
    const total = ctx.measureText(TITLE).width, x0 = cx - total / 2;
    let prevW = 0;
    for (let i = 0; i < TITLE.length; i++) {
      const w = ctx.measureText(TITLE.slice(0, i + 1)).width;
      const lo = x0 + prevW, hi = x0 + w; prevW = w;               // this letter's x-band
      const inLetter = pts.filter((pt) => pt.x >= lo && pt.x < hi);
      if (inLetter.length) { const s = inLetter[(Math.random() * inLetter.length) | 0]; addNode(g, s.x, s.y, -1); }
    }
    // FRINGE: a LIGHT wispy halo just outside each letter (sampled sparsely from a
    // lightly-blurred glyph mask) so a few filaments spill past the crisp edges —
    // hairy, but thin enough that letters stay separate and legible.
    const fringe = attractorsFromText((o) => {
      o.filter = 'blur(' + (titleSize * 0.028) + 'px)';
      o.fillStyle = '#fff'; o.font = titleFont(titleSize); o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(TITLE, cx, titleY);
    }, Math.max(4, g.seg * 3.5), 12, 100);
    for (const f of fringe) g.attractors.push(f);
    // STRAY STRANDS: many SHORT filaments straying off the letter edges, each finishing
    // in a little branch/spray. Start from edge (fringe) points, grow outward, then fork.
    const edge = fringe.length ? fringe : pts;
    const sp = g.attract * 0.6;
    for (let i = 0; i < 180; i++) {
      const s = edge[(Math.random() * edge.length) | 0]; if (!s) break;
      const ang = Math.atan2(s.y - titleY, s.x - cx) + rnd(-0.7, 0.7);
      const len = 1 + ((Math.random() * 2) | 0);         // very short: 1-2 segments
      let ex = s.x, ey = s.y;
      for (let k = 1; k <= len; k++) { ex = s.x + Math.cos(ang) * sp * k; ey = s.y + Math.sin(ang) * sp * k; g.attractors.push({ x: ex, y: ey }); }
      // branch/spray at the tip so each stray strand finishes with some branching
      const br = 3 + ((Math.random() * 4) | 0);
      for (let bi = 0; bi < br; bi++) {
        const ba = ang + rnd(-1.0, 1.0), bl = g.attract * rnd(0.4, 0.95);
        g.attractors.push({ x: ex + Math.cos(ba) * bl, y: ey + Math.sin(ba) * bl });
        if (Math.random() < 0.35) g.attractors.push({ x: ex + Math.cos(ba) * bl * 1.6, y: ey + Math.sin(ba) * bl * 1.6 });
      }
    }
    // Each letter grows from its single seed, all at once (no left-to-right front).
    if (reduce) { let guard = 0; while (!g.done && guard++ < 40000) step(g); flushInk(); }
  }

  // ---- rendering ---------------------------------------------------------
  function flushInk() {
    if (!g.segs.length) return;
    ictx.strokeStyle = 'rgba(233,255,247,0.9)';
    ictx.lineWidth = 0.7 * dpr; ictx.lineCap = 'round';
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
    if (!g.done || consuming) {                       // fractional rate paces the bloom
      stepAcc += consuming ? CONSUME_RATE : STEP_RATE;
      while (stepAcc >= 1) { step(g); stepAcc -= 1; }
      flushInk();
    }
    composite();
    raf = requestAnimationFrame(frame);
  }

  // ---- consume a menu word, then fire its callback ------------------------
  // Global nearest node (across ALL grown nodes, no distance cap) — used to pick the
  // MYCELIUM point a new strand should sprout from.
  function nearestExistingNode(x, y) {
    const ns = g.nodes; let best = -1, bd = Infinity;
    for (let i = 0; i < ns.length; i++) { const n = ns[i]; const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // Lay a gently-wandering line of attractors between two points so growth creeps
  // from one to the other, one segment at a time (a visible travelling strand).
  // The wander is a SMOOTH sine along the length (single random phase/frequency) so
  // consecutive points stay well within the attraction radius — a per-point random
  // jitter would break the chain mid-way and stall the strand.
  function bridgeAttractors(ax, ay, bx2, by2) {
    const dx = bx2 - ax, dy = by2 - ay, L = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.round(L / (g.attract * 0.55)));   // dense: spacing < attraction radius
    const px = -dy / L, py = dx / L;                             // unit perpendicular
    const amp = g.attract * 0.8, ph = rnd(0, Math.PI * 2), waves = rnd(1.2, 2.2);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const w = Math.sin(ph + t * Math.PI * waves) * amp * Math.sin(t * Math.PI);   // tapers to 0 at both ends
      g.attractors.push({ x: ax + dx * t + px * w, y: ay + dy * t + py * w });
    }
  }

  // Sample a button's word into attractor points (glyph + hairy fringe) plus one
  // random bloom seed per letter — all in the title's OWN growth units, so the word
  // ends up drawn with identical strands/colour to MYCELIUM.
  function sampleWord(btn) {
    const rr = root.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const bx = br.left - rr.left + br.width / 2, by = br.top - rr.top + br.height / 2;
    const cs = getComputedStyle(btn);
    const size = parseFloat(cs.fontSize);
    const spacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const font = cs.fontWeight + ' ' + size + 'px ' + cs.fontFamily;
    const text = btn.textContent;
    const draw = (o, blur) => {
      o.filter = blur ? 'blur(' + blur + 'px)' : 'none';
      o.fillStyle = '#fff'; o.font = font; o.textAlign = 'center'; o.textBaseline = 'middle';
      try { o.letterSpacing = spacing; } catch (_) {}
      o.fillText(text, bx, by);
    };
    const glyph = attractorsFromText((o) => draw(o, 0), Math.max(2, Math.round(g.seg * 0.9)));
    const fringe = attractorsFromText((o) => draw(o, size * 0.03), Math.max(3, g.seg * 3), 12, 100);
    const m = ctx; m.font = font; try { m.letterSpacing = spacing; } catch (_) {}
    const total = m.measureText(text).width, x0 = bx - total / 2;
    const seeds = []; let prevW = 0;
    for (let i = 0; i < text.length; i++) {
      const w = m.measureText(text.slice(0, i + 1)).width;
      const lo = x0 + prevW, hi = x0 + w; prevW = w;
      const inL = glyph.filter((pt) => pt.x >= lo && pt.x < hi);
      if (inL.length) seeds.push(inL[(Math.random() * inL.length) | 0]);
    }
    try { m.letterSpacing = '0px'; } catch (_) {}
    return { glyph, fringe, seeds, bx, by };
  }

  // Grow the button's word so it reads exactly like MYCELIUM: EVERY letter blooms
  // from its own random point with dense glyph attractors + hairy strays (identical to
  // seedTitle), AND 1–2 connector strands creep out of the nearest MYCELIUM letters so
  // the word visibly grows straight out of the title. Same growth `g` → same strand
  // style and colour by construction.
  function growButtonWord(btn) {
    const { glyph, fringe, seeds, bx, by } = sampleWord(btn);
    for (const p of glyph) g.attractors.push(p);
    for (const f of fringe) g.attractors.push(f);
    if (!seeds.length) { g.done = false; return; }
    // (A) immediately: 1–2 connector strands creep OUT of the nearest MYCELIUM nodes
    //     toward where the word will be — the visible "it grows from the title" beat.
    const ranked = seeds.map((s) => {
      const ni = nearestExistingNode(s.x, s.y);
      const n = ni >= 0 ? g.nodes[ni] : null;
      return { s, n, d: n ? (n.x - s.x) ** 2 + (n.y - s.y) ** 2 : Infinity };
    }).sort((a, b) => a.d - b.d);
    const nBridge = seeds.length >= 2 ? 1 + ((Math.random() * 2) | 0) : 1;   // 1 or 2 strands
    for (const e of ranked.slice(0, nBridge)) if (e.n) bridgeAttractors(e.n.x, e.n.y, e.s.x, e.s.y);
    g.done = false;
    // (B) a beat later: every letter blooms from its own random point (dense + legible,
    //     exactly like the title) plus stray fuss — the strand resolves into a full word.
    const bloom = () => {
      if (finished) return;
      for (const s of seeds) addNode(g, s.x, s.y, -1);
      const edge = fringe.length ? fringe : glyph, sp = g.attract * 0.6, strays = Math.round(seeds.length * 8);
      for (let i = 0; i < strays; i++) {
        const s = edge[(Math.random() * edge.length) | 0]; if (!s) break;
        const ang = Math.atan2(s.y - by, s.x - bx) + rnd(-0.7, 0.7), len = 1 + ((Math.random() * 2) | 0);
        let ex = s.x, ey = s.y;
        for (let k = 1; k <= len; k++) { ex = s.x + Math.cos(ang) * sp * k; ey = s.y + Math.sin(ang) * sp * k; g.attractors.push({ x: ex, y: ey }); }
        const br = 2 + ((Math.random() * 3) | 0);
        for (let bi = 0; bi < br; bi++) { const ba = ang + rnd(-1, 1), bl = g.attract * rnd(0.4, 0.9); g.attractors.push({ x: ex + Math.cos(ba) * bl, y: ey + Math.sin(ba) * bl }); }
      }
      g.done = false;
    };
    if (reduce) bloom(); else setTimeout(bloom, 450);
  }

  function consume(btn, cb) {
    if (consuming || finished) return; consuming = true;
    root.querySelectorAll('.ts-btn').forEach((b) => { if (b !== btn) b.style.pointerEvents = 'none'; });
    btn.classList.add('ts-fading');                 // (1) the DOM word fades away quickly + completely
    finishFn = () => {                               // (3) fade the screen out, then fire the callback (idempotent)
      if (finished) return; finished = true;
      root.style.transition = 'opacity .55s ease'; root.style.opacity = '0';
      setTimeout(() => { cancelAnimationFrame(raf); root.remove(); cb && cb(); }, 560);
    };
    if (reduce) { btn.style.opacity = '0'; growButtonWord(btn); let guard = 0; while (!g.done && guard++ < 12000) step(g); flushInk(); composite(); setTimeout(finishFn, 350); return; }
    // (2) a strand creeps out of MYCELIUM (at +300ms) and the word unfurls from it
    // (bloom seeds at +750ms). Predictable wall-clock pacing so the transition timing is
    // the same on every device — the word keeps maturing through the hold + fade.
    setTimeout(() => growButtonWord(btn), 300);
    setTimeout(finishFn, 2100);                      // (3) fade to the next screen a beat after the word forms
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
    cx = W / 2; titleY = Math.round(H * 0.47);   // title sits at screen centre; menu blocks pin to top/bottom
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
