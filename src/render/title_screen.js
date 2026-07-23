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

import { playGrowBurst } from './sfx.js';
import { loadProgress } from '../species.js';

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const TITLE = 'MYCELIUM';

export function showTitleScreen({ onNew, onContinue, onDevTutorial, onHighScores, onCredits, playerName }) {
  const reduce = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = el('div'); root.id = 'titleScreen';
  root.innerHTML =
    '<canvas id="tsCanvas"></canvas>' +
    '<div class="ts-menu">' +
      '<div class="ts-block ts-top">' +
        '<div class="ts-actions">' +
          '<span class="ts-act"><span class="ts-cap">start a new game</span><button class="ts-btn" id="tsNew" type="button">New</button></span>' +
          '<div class="ts-mode">Survival</div>' +
          '<span class="ts-act"><span class="ts-cap">continue last game</span><button class="ts-btn" id="tsCont" type="button">Old</button></span>' +
        '</div>' +
      '</div>' +
      '<div class="ts-block ts-bottom">' +
        '<div class="ts-actions">' +
          '<span class="ts-btn ts-locked">New</span>' +
          '<div class="ts-modewrap"><div class="ts-mode ts-locked">Campaign</div><div class="ts-soon">coming soon</div></div>' +
          '<span class="ts-btn ts-locked">Old</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  // TEMP dev button (bottom-right): jump straight into the tutorial with a random
  // starter species — bypasses New/picker. Only shown when a handler is supplied.
  let devBtn = null;
  if (onDevTutorial) {
    devBtn = el('button', null, 'Dev: tutorial ▸');
    devBtn.id = 'tsDevTut'; devBtn.type = 'button';
    devBtn.style.cssText =
      'position:absolute; right:14px; bottom:14px; z-index:6; font:600 12px/1 "Segoe UI",system-ui,sans-serif;' +
      'color:#e6b45c; background:rgba(24,26,18,0.7); border:1px dashed rgba(230,180,92,0.6);' +
      'border-radius:8px; padding:7px 12px; cursor:pointer; letter-spacing:.02em; backdrop-filter:blur(4px);';
    root.appendChild(devBtn);
  }

  // Small, plain B&W "High Scores" button centred at the very bottom of the title.
  if (onHighScores) {
    const hsBtn = el('button', 'ts-hs', 'High Scores'); hsBtn.id = 'tsHighScores'; hsBtn.type = 'button';
    root.appendChild(hsBtn);
    hsBtn.addEventListener('click', () => { if (consuming || finished) return; onHighScores(); });
  }

  // Matching plain "Credits" button, parked bottom-right.
  if (onCredits) {
    const crBtn = el('button', 'ts-credits', 'Credits'); crBtn.id = 'tsCredits'; crBtn.type = 'button';
    root.appendChild(crBtn);
    crBtn.addEventListener('click', () => { if (consuming || finished) return; onCredits(); });
  }

  const canvas = root.querySelector('#tsCanvas');
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, dpr = 1, ink = null, ictx = null;
  let titleSize = 0, titleY = 0, cx = 0;
  let g = null;                 // growth state
  let raf = 0, consuming = false, finished = false, stepAcc = 0;
  let sfxAcc = 0, sfxLastT = 0, sfxPeak = 0, sfxQuiet = 0, sfxT0 = 0, sfxDone = false;   // grow-SFX swell state
  let finishFn = null, consumeT0 = 0, bloomT0 = 0;   // handoff + phase clocks (strand / bloom bells)
  const STEP_RATE = 1.4;    // growth steps per frame while the title blooms (~30% slower than old 2/frame)
  // A consumed menu word grows in TWO bell-paced phases:
  //  1) STRAND — a strand climbs from MYCELIUM to the word's middle letter: slow → speeds up.
  //  2) BLOOM  — once that letter is reached, the whole word grows on its OWN bell: slow
  //     again → gradually full speed → gradually eases off at the end.
  const STRAND_DUR = 900;   // ms over which the strand ramp reaches full speed
  const STRAND_MIN = 1;     // steps/frame at the strand start (nice and slow)
  const STRAND_PEAK = 3;    // steps/frame as the strand nears the letter
  const STRAND_MAX = 1600;  // ms — fallback: start the bloom even if arrival isn't detected
  const BLOOM_DUR = 1500;   // ms of the word bloom (its own bell); the staggered letters ride its full arc
  const BLOOM_MIN = 1.2;    // steps/frame at bloom start/end (slow again as it hits the letter)
  const BLOOM_PEAK = 7;     // steps/frame at bloom peak (low → fill is rate-limited so the bell shape shows)
  let startBloomFn = null, strandTargetY = 0;   // strand→bloom handoff (bloom starts when the strand arrives)

  // ---- spatial-grid space colonization -----------------------------------
  function grid(gr, x, y) { return ((x / gr.cell) | 0) + ',' + ((y / gr.cell) | 0); }
  function addNode(gr, x, y, parent) {
    const i = gr.nodes.length;
    gr.nodes.push({ x, y, parent });
    if (y < gr.minY) gr.minY = y;                 // cheap running reach-so-far (highest point grown)
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
    const seg = Math.max(0.5, titleSize * 0.010);   // scales with the title (small on narrow/portrait)
    const attract = titleSize * 0.05;
    return {
      nodes: [], segs: [], attractors: [], map: new Map(), minY: Infinity,
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

  // Sample white pixels from a text render into attractor points (CSS coords). `scale`
  // supersamples: the text is drawn into a scale×W × scale×H buffer and sampled at the
  // integer step there, giving an EFFECTIVE step of stepPx/scale — so a small title (or
  // menu word) gets as many strands, relatively, as a big one (constant-px sampling
  // otherwise leaves small text sparse/malformed).
  function attractorsFromText(drawFn, stepPx, aMin = 70, aMax = 256, scale = 1) {
    const st = Math.max(2, Math.round(stepPx));        // MUST be an integer — it indexes a typed pixel array
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
  function titleFont(size) { return '800 ' + size + 'px "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif'; }

  function seedTitle() {
    g = newGrowth();
    // Supersample small titles so strand density is ~constant relative to the title size
    // (a fixed-px sample leaves a narrow/portrait title sparse and malformed).
    const S = Math.max(1, Math.min(4, Math.round(200 / titleSize)));
    // dense glyph attractors → the letters are built ENTIRELY from strands (no fill)
    const pts = attractorsFromText((o) => {
      o.fillStyle = '#fff'; o.font = titleFont(titleSize); o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(TITLE, cx, titleY);
    }, Math.max(2, Math.round(g.seg * 0.9)), 70, 256, S);
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
    }, Math.max(4, g.seg * 3.5), 12, 100, S);
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
      let rate = STEP_RATE;
      if (consuming) {
        const now = performance.now();
        // hand off from strand to bloom the moment the strand reaches the letter (or a fallback time)
        if (!bloomT0 && startBloomFn && consumeT0 && (g.minY <= strandTargetY + g.seg * 3 || now - consumeT0 > STRAND_MAX)) {
          const fn = startBloomFn; startBloomFn = null; fn();
        }
        if (bloomT0) {                                // BLOOM: its own bell — slow → full → slow
          const t = Math.max(0, Math.min(1, (now - bloomT0) / BLOOM_DUR));
          rate = BLOOM_MIN + (BLOOM_PEAK - BLOOM_MIN) * Math.sin(Math.PI * t);
        } else if (consumeT0) {                       // STRAND: rising ramp — slow → speeds up
          const t = Math.max(0, Math.min(1, (now - consumeT0) / STRAND_DUR));
          rate = STRAND_MIN + (STRAND_PEAK - STRAND_MIN) * Math.sin(t * Math.PI / 2);
        } else rate = STRAND_MIN;
      }
      const before = g.nodes.length;
      stepAcc += rate;
      while (stepAcc >= 1) { step(g); stepAcc -= 1; }
      flushInk();
      playGrowSfx(g.nodes.length - before);
    }
    composite();
    raf = requestAnimationFrame(frame);
  }
  // Layered "growing" swell that tracks the visible bloom (title bloom + each consumed menu
  // word): size each burst by the strands added since the last, throttled so it reads as one
  // organic swell. It fires ONLY during the vigorous bloom and then latches off (sfxDone):
  // the space-colonization tail trickles a few nodes ~forever (the mat wanders into scattered
  // unreachable attractors), so without this the sound would loop endlessly. End the swell
  // when activity falls to a trickle for a short run of frames, with a hard time cap backstop.
  function playGrowSfx(grew) {
    if (sfxDone) return;
    if (grew > sfxPeak) sfxPeak = grew;
    if (sfxPeak >= 20 && grew < Math.max(4, sfxPeak * 0.06)) { if (++sfxQuiet >= 10) { sfxDone = true; return; } }
    else sfxQuiet = 0;
    if (grew <= 0) return;
    const tSfx = performance.now();
    if (!sfxT0) sfxT0 = tSfx;
    if (tSfx - sfxT0 > 1800) { sfxDone = true; return; }   // never sonify longer than the bloom
    sfxAcc += grew;
    if (tSfx - sfxLastT >= 170) { playGrowBurst(sfxAcc, 350); sfxAcc = 0; sfxLastT = tSfx; }
  }
  // Restart the swell for a fresh growth phase (the strand → bloom of a consumed menu word),
  // since the title bloom's swell has already latched off by the time a button is pressed.
  function resetGrowSfx() { sfxAcc = 0; sfxLastT = 0; sfxPeak = 0; sfxQuiet = 0; sfxT0 = 0; sfxDone = false; }

  // ---- consume a menu word, then fire its callback ------------------------
  // Global nearest node (across ALL grown nodes, no distance cap) — used to pick the
  // MYCELIUM point a new strand should sprout from.
  function nearestExistingNode(x, y) {
    const ns = g.nodes; let best = -1, bd = Infinity;
    for (let i = 0; i < ns.length; i++) { const n = ns[i]; const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // Lay a gently-wandering line of attractors between two points so growth creeps
  // from one to the other, one segment at a time (a visible travelling strand), with
  // frequent little side-branches + tip sprays along the way so it reads as MYCELIUM
  // rather than a bare line. The main wander is a SMOOTH sine along the length (single
  // random phase/frequency) so consecutive points stay within the attraction radius —
  // a per-point random jitter would break the chain mid-way and stall the strand.
  function bridgeAttractors(ax, ay, bx2, by2, branch) {
    const dx = bx2 - ax, dy = by2 - ay, L = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.round(L / (g.attract * 0.55)));   // dense: spacing < attraction radius
    const px = -dy / L, py = dx / L;                             // unit perpendicular
    const amp = g.attract * 0.8, ph = rnd(0, Math.PI * 2), waves = rnd(1.2, 2.2);
    let lx = ax, ly = ay;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const w = Math.sin(ph + t * Math.PI * waves) * amp * Math.sin(t * Math.PI);   // tapers to 0 at both ends
      const x = ax + dx * t + px * w, y = ay + dy * t + py * w;
      g.attractors.push({ x, y });
      if (branch && k > 1 && k < n && Math.random() < 0.5) {     // side branch with a tip spray
        const side = Math.random() < 0.5 ? 1 : -1;
        const bang = Math.atan2(y - ly, x - lx) + side * rnd(0.5, 1.15), blen = 1 + ((Math.random() * 2) | 0);
        let ex = x, ey = y;
        for (let s = 1; s <= blen; s++) { ex = x + Math.cos(bang) * g.attract * 0.85 * s; ey = y + Math.sin(bang) * g.attract * 0.85 * s; g.attractors.push({ x: ex, y: ey }); }
        const tips = 1 + ((Math.random() * 3) | 0);
        for (let ti = 0; ti < tips; ti++) { const ta = bang + rnd(-0.9, 0.9), tl = g.attract * rnd(0.4, 0.9); g.attractors.push({ x: ex + Math.cos(ta) * tl, y: ey + Math.sin(ta) * tl }); }
      }
      lx = x; ly = y;
    }
  }

  // Sample a button's word into attractor points (glyph + hairy fringe) plus several
  // random bloom seeds per letter. The glyph is SUPERSAMPLED (rendered into a small
  // canvas scaled ×S, then sampled) so a small menu word gets FAR more attractors than
  // the coarse title-pixel grid would allow at this size — that's what makes the grown
  // word dense + legible instead of a sparse tangle. `SPL` seeds per letter → several
  // fans fill each glyph. Returns the font `size` so the caller can scale growth to it.
  function sampleWord(btn) {
    const rr = root.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const bx = br.left - rr.left + br.width / 2, by = br.top - rr.top + br.height / 2;
    const cs = getComputedStyle(btn);
    const size = parseFloat(cs.fontSize);
    const spacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const font = cs.fontWeight + ' ' + size + 'px ' + cs.fontFamily;
    let text = btn.textContent;                    // match the button's DISPLAYED casing (CSS text-transform)
    if (cs.textTransform === 'uppercase') text = text.toUpperCase();
    else if (cs.textTransform === 'lowercase') text = text.toLowerCase();
    const m = ctx; m.font = font; try { m.letterSpacing = spacing; } catch (_) {}
    const total = m.measureText(text).width; try { m.letterSpacing = '0px'; } catch (_) {}
    const box = { x: bx - total / 2 - size * 0.4, y: by - size * 0.9, w: total + size * 0.8, h: size * 1.8 };
    const S = 2;   // supersample → ~1px effective sampling (dense but not so many attractors that steps crawl)
    const draw = (o, blur) => {
      o.filter = blur ? 'blur(' + blur + 'px)' : 'none';
      o.fillStyle = '#fff'; o.font = font; o.textAlign = 'center'; o.textBaseline = 'middle';
      try { o.letterSpacing = spacing; } catch (_) {}
      o.fillText(text, bx, by);
    };
    const sample = (drawFn, stepPx, aMin, aMax) => {
      const st = Math.max(2, Math.round(stepPx));
      const cw = Math.max(1, Math.ceil(box.w * S)), ch = Math.max(1, Math.ceil(box.h * S));
      const off = document.createElement('canvas'); off.width = cw; off.height = ch;
      const o = off.getContext('2d'); o.setTransform(S, 0, 0, S, -box.x * S, -box.y * S); drawFn(o);
      const d = o.getImageData(0, 0, cw, ch).data, pts = [];
      for (let y = 0; y < ch; y += st) for (let x = 0; x < cw; x += st) {
        const a = d[(y * cw + x) * 4 + 3];
        if (a >= aMin && a < aMax) pts.push({ x: box.x + (x + rnd(-st / 2, st / 2)) / S, y: box.y + (y + rnd(-st / 2, st / 2)) / S });
      }
      return pts;
    };
    const glyph = sample((o) => draw(o, 0), 2, 70, 256);
    const fringe = sample((o) => draw(o, size * 0.03), 3, 12, 100);
    // Split the glyph into per-letter groups. Each letter gets an entry `seed` (a point
    // near its centre — where a connector strand plugs in) and its full `pts` (used to
    // burst-seed the letter with many growth fronts so it fills fast once reached).
    m.font = font; try { m.letterSpacing = spacing; } catch (_) {}
    const x0 = bx - total / 2, letters = []; let prevW = 0;
    for (let i = 0; i < text.length; i++) {
      const w = m.measureText(text.slice(0, i + 1)).width;
      const lo = x0 + prevW, hi = x0 + w, cxL = (lo + hi) / 2; prevW = w;
      const pts = glyph.filter((pt) => pt.x >= lo && pt.x < hi);
      let seed = null;
      if (pts.length) {
        const near = pts.slice().sort((a, b) => Math.abs(a.x - cxL) - Math.abs(b.x - cxL));
        seed = near[(Math.random() * Math.min(near.length, Math.max(4, near.length >> 2))) | 0];
      }
      letters.push({ seed, pts });
    }
    try { m.letterSpacing = '0px'; } catch (_) {}
    return { glyph, fringe, letters, bx, by, size };
  }

  // Grow the button's word so it reads exactly like MYCELIUM and unfurls FROM the title,
  // in two bell-paced phases:
  //  1) STRAND — ONLY a branching strand is laid, climbing (coarse seg) from the nearest
  //     MYCELIUM node to the word's MIDDLE letter. Nothing else grows yet, so the word
  //     doesn't start filling early.
  //  2) BLOOM — the instant the strand reaches the letter (frame() detects it via g.minY),
  //     the glyph/fringe/strays + connector strands are added and each letter is
  //     BURST-SEEDED as it's reached. Growth now follows the bloom bell (slow → full →
  //     slow), so the word grows at a gentle, visible pace.
  function growButtonWord(btn) {
    consumeT0 = performance.now(); bloomT0 = 0; startBloomFn = null;   // start the STRAND-phase clock
    resetGrowSfx();                                                    // a fresh swell for the word's strand→bloom
    const { glyph, fringe, letters, bx, by, size } = sampleWord(btn);
    const valid = letters.filter((l) => l.seed);
    if (!valid.length) { g.done = false; return; }
    g.attract = size * 0.05; g.attract2 = g.attract * g.attract;   // (g.cell left alone → title buckets stay valid)
    // seg MUST stay below the bridge spacing (≈0.0275·size) or the strand's first attractor
    // lands inside kill2 and is eaten without advancing — the strand stalls (small fonts!).
    const coarse = () => { g.seg = Math.max(0.7, size * 0.02); g.kill2 = g.seg * g.seg; };   // fast-climbing strand
    const fine = () => { g.seg = Math.max(0.5, size * 0.009); g.kill2 = g.seg * g.seg; };    // dense letter fill
    // middle letter = growth point; lay ONLY the branching strand from MYCELIUM into it
    const centre = (letters.length - 1) / 2;
    const midV = valid.reduce((best, o) => Math.abs(letters.indexOf(o) - centre) < Math.abs(letters.indexOf(best) - centre) ? o : best, valid[0]);
    const mid = midV.seed, start = nearestExistingNode(mid.x, mid.y);
    coarse();
    if (start >= 0) bridgeAttractors(g.nodes[start].x, g.nodes[start].y, mid.x, mid.y, true);
    strandTargetY = mid.y;
    g.done = false;
    // burst-seed a letter with a FEW fronts so it fills over a visible beat (not instantly)
    const burst = (l) => {
      const pts = l.pts, k = Math.min(5, pts.length);
      for (let i = 0; i < k; i++) { const p = pts[(Math.random() * pts.length) | 0]; addNode(g, p.x, p.y, -1); }
      g.done = false;
    };
    // Called when the strand reaches the letter: add the word body + connectors and bloom it.
    startBloomFn = () => {
      bloomT0 = performance.now(); fine();
      for (const p of glyph) g.attractors.push(p);
      for (const f of fringe) g.attractors.push(f);
      const edge = fringe.length ? fringe : glyph, sp = g.attract * 0.6, strays = Math.round(valid.length * 10);
      for (let i = 0; i < strays; i++) {
        const s = edge[(Math.random() * edge.length) | 0]; if (!s) break;
        const ang = Math.atan2(s.y - by, s.x - bx) + rnd(-0.7, 0.7), len = 1 + ((Math.random() * 2) | 0);
        let ex = s.x, ey = s.y;
        for (let k = 1; k <= len; k++) { ex = s.x + Math.cos(ang) * sp * k; ey = s.y + Math.sin(ang) * sp * k; g.attractors.push({ x: ex, y: ey }); }
        const br = 2 + ((Math.random() * 3) | 0);
        for (let bi = 0; bi < br; bi++) { const ba = ang + rnd(-1, 1), bl = g.attract * rnd(0.4, 0.9); g.attractors.push({ x: ex + Math.cos(ba) * bl, y: ey + Math.sin(ba) * bl }); }
      }
      for (const o of valid) if (o !== midV) bridgeAttractors(mid.x, mid.y, o.seed.x, o.seed.y, false);   // connectors
      burst(midV); g.done = false;
      // other letters unfurl ONE AT A TIME (from the middle outward) so the last finishes
      // during the bell's slow tail — the word eases to a stop rather than popping in.
      const others = valid.filter((v) => v !== midV);
      others.forEach((v, i) => setTimeout(() => burst(v), 500 + i * 450));
      setTimeout(() => finishFn && finishFn(), BLOOM_DUR - 150);   // transition a beat after the bloom completes
    };
    if (reduce) { startBloomFn(); startBloomFn = null; return; }
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
    // (2) at +300ms a strand creeps out of MYCELIUM into the word's middle letter and the
    // word unfurls from it on a bell-shaped speed curve (CONSUME_DUR). Fixed wall-clock
    // pacing → same timing on every device; the word keeps maturing through the fade.
    setTimeout(() => growButtonWord(btn), 300);       // (2) strand climbs, then bloom (startBloomFn schedules the fade)
    setTimeout(finishFn, 6000);                       // safety cap only
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
    cx = W / 2; titleY = Math.round(H * 0.47);   // title centre; menu is positioned symmetrically around it
    positionMenu();
    seedTitle();
    composite();
  }

  // Place the two menu rows SYMMETRICALLY about the title centre: each NEW·MODE·OLD
  // row (SURVIVAL now sits INLINE between NEW and OLD) sits the same distance D from
  // the title. ("coming soon" tucks under the Campaign row and doesn't factor in.)
  function positionMenu() {
    const topB = root.querySelector('.ts-top'), botB = root.querySelector('.ts-bottom');
    const topAct = topB.querySelector('.ts-actions');
    const botAct = botB.querySelector('.ts-actions');
    const actH = topAct.offsetHeight || botAct.offsetHeight || 90;
    const halfTitle = titleSize * 0.58;              // effective title half-height (incl. fringe)
    const gapTitle = Math.max(16, H * 0.045);        // title edge → row
    const D = halfTitle + gapTitle + actH / 2;        // title centre → row centre (equal top & bottom)
    topB.style.bottom = 'auto'; topB.style.top = Math.round(titleY - D - actH / 2) + 'px';
    botB.style.bottom = 'auto'; botB.style.top = Math.round(titleY + D - actH / 2) + 'px';
  }

  // True when there's saved unlock progress from an old run — which "New" (Survival) wipes
  // (main.js onNew → resetProgress). Guard that with a confirm so it isn't erased by accident.
  function hasProgress() {
    try { const p = loadProgress(); return !!(p && p.clears && Object.keys(p.clears).length); } catch (_) { return false; }
  }
  // Plain black-and-white "New Game" dialog (no gradients): enter the display name used
  // for high scores this run, plus the erase-progress warning when there's saved progress.
  // Start → onNew(name); Cancel/backdrop/Esc → dismiss.
  function newGameDialog() {
    if (consuming || finished) return;
    const erase = hasProgress();
    const back = el('div', 'ts-confirm');
    back.innerHTML =
      '<div class="ts-confirm-box" role="dialog" aria-modal="true" aria-label="New game">' +
        '<p class="ts-confirm-msg">Enter your name</p>' +
        '<input class="ts-name-input" id="tsNameInput" type="text" maxlength="14" placeholder="Your name" autocomplete="off" spellcheck="false">' +
        '<div class="ts-confirm-actions">' +
          '<button class="ts-confirm-btn" id="tsNameStart" type="button">Start</button>' +
          '<button class="ts-confirm-btn" id="tsNameCancel" type="button">Cancel</button>' +
        '</div>' +
        (erase ? '<p class="ts-confirm-sub">Starting a new game will erase all previous progress.</p>' : '') +
      '</div>';
    root.appendChild(back);
    const input = back.querySelector('#tsNameInput');
    input.value = playerName || '';
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', onKey); back.remove(); }
    function start() {
      if (consuming || finished) return;
      const nm = input.value;
      close();
      consume(root.querySelector('#tsNew'), () => onNew && onNew(nm));
    }
    back.querySelector('#tsNameStart').addEventListener('click', start);
    back.querySelector('#tsNameCancel').addEventListener('click', close);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') start(); });
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    setTimeout(() => { try { input.focus(); input.select(); } catch (_) {} }, 60);
  }

  root.querySelector('#tsNew').addEventListener('click', () => { newGameDialog(); });
  root.querySelector('#tsCont').addEventListener('click', () => consume(root.querySelector('#tsCont'), onContinue));

  let rt = 0;
  const onResize = () => { if (consuming || finished) return; clearTimeout(rt); rt = setTimeout(layout, 200); };
  window.addEventListener('resize', onResize);

  // TEMP dev: skip the consume animation and hand straight off to the tutorial run.
  if (devBtn) devBtn.addEventListener('click', () => {
    if (consuming || finished) return;
    finished = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); root.remove();
    onDevTutorial && onDevTutorial();
  });

  layout();
  if (!reduce) raf = requestAnimationFrame(frame);

  return { hide() { finished = true; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); root.remove(); } };
}
