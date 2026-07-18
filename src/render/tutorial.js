// =============================================================================
// First-run TUTORIAL — a scripted series of clean black-and-white popups that
// zoom in on what they describe and, where relevant, FORCE an interaction
// (play Apical Drive, drag to grow) before advancing.
//
//   startTutorial(deps) → controller { tick(time), destroy(), get active() }
//
// The overlay ROOT is pointer-events:none so the game underneath (hand carousel,
// canvas) stays usable during forced steps. Explanatory steps drop a transparent
// full-screen catcher (pointer-events:auto) so a click ANYWHERE advances; forced
// / interactive steps omit it so the player can act on the real game.
//
// deps (all supplied by main.js):
//   getState()            → the live game state
//   worldToScreen(x,y)    → {x,y} screen px for a world point (live camera)
//   focusWorld(x,y,zoom)  → smoothly move the camera to frame a world point
//   focusBounds(b,pad)    → smoothly frame a world bounding box
//   handCardEl(name)      → the DOM .cardbtn for a hand card (or null)
//   pendingCard()         → the currently-armed hand card {name,...} (or null)
//   setHandOpen(open)     → open/close the hand carousel
//   threats()             → { ant:{x,y}|null, nematode:{x,y}|null, trich:{x,y}|null }
//   colonyRoot()          → {x,y} of the colony entry node (or null)
//   goalPoint()           → {x,y} at the surface of the goal zone (or null)
//   duffPile()            → {x,y} of the tutorial's guaranteed yellow pile (or null)
//   onDone()              → called once when the tutorial ends (finish OR End)
// =============================================================================

const VER = (typeof globalThis !== 'undefined' && globalThis.__ASSET_VER) ? '?v=' + globalThis.__ASSET_VER : '';
const threatImg = (slug) => `assets/tutorial/${slug}.jpg${VER}`;

// On a PORTRAIT PHONE the popup + threat pics are large relative to the screen, so
// the tutorial MINIMIZES the hand carousel on every step that doesn't need the hand
// (and maximizes it again when the tutorial ends — see enter()/finish()). On wider
// screens there's room for both, so the hand is left alone.
const phonePortrait = () => {
  try { return !!(window.matchMedia && window.matchMedia('(max-width:720px) and (orientation:portrait)').matches); }
  catch (_) { return false; }
};

// On a wide DESKTOP screen the popup goes to the TOP HALF, on the LEFT or RIGHT
// OPPOSITE the framed subject (main.js offsets the camera so the subject sits on its
// own side) — so it never covers the subject, the top pill, or the bottom carousel.
const desktopWide = () => {
  try { return window.innerWidth >= 900 && !phonePortrait(); }
  catch (_) { return false; }
};

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

export function startTutorial(deps) {
  // ---- step script --------------------------------------------------------
  // Each step: { text, focus(s), target(s), image, gate(s,mem), interactive,
  //              place, glowCard, demo, onEnter(s,mem) }
  const APICAL = 'Apical Drive';
  const steps = [
    {
      text: 'This is your mycelium colony.<br><b>You are mycelium. Mycelium is you.</b>',
      focus: (s) => world(deps.colonyRoot(), 1.35),
      target: (s) => worldTarget(deps.colonyRoot()),
      place: 'bottom',
    },
    {
      text: 'Your goal is to grow your colony all the way <b>here</b>, so you can fruit and throw spores.',
      focus: (s) => world(deps.goalPoint(), 1.0),
      target: (s) => worldTarget(deps.goalPoint()),
      place: 'bottom',
    },
    {
      text: 'This is your hand.<br><b>Double-click a card to play it.</b>',
      focus: (s) => world(deps.colonyRoot(), 1.1),
      target: () => cardTarget(APICAL),
      glowCard: APICAL,
      hand: 'open',          // needs the carousel visible (points at Apical Drive)
      filter: 'grow',        // showcase the GROWTH cards (Apical Drive lives here)
      place: 'top',
      // Forced: advance once Apical Drive is armed for aiming (double-clicked).
      gate: () => { const pc = deps.pendingCard(); return !!(pc && pc.name === APICAL); },
    },
    {
      text: '<b>Drag and release to grow.</b><br>Press on your colony and pull down into the soil you want to reach.',
      focus: (s) => world(deps.colonyRoot(), 1.1),
      target: (s) => worldTarget(deps.colonyRoot()),
      glowCard: APICAL,
      demo: true,
      hand: 'open',          // keep the glowing card visible while dragging to grow
      place: 'top',
      onEnter: (s, mem) => { mem.baseNodes = nodeCount(s); },
      // Forced: advance the moment the colony actually grows.
      gate: (s, mem) => nodeCount(s) > (mem.baseNodes || 0),
    },
    {
      text: 'Grow into <b>substrate</b> to consume it — for energy, and&nbsp;<i>sometimes</i>&nbsp;new cards.',
      focus: (s) => world(deps.duffPile() || deps.colonyRoot(), 1.5),
      target: (s) => worldTarget(deps.duffPile()),
      place: 'bottom',
    },
    {
      text: 'Touch <b>water</b> to get Water income.<br>Your colony will <b>die</b> if you run out of water.',
      focus: (s) => world(deps.reservoir() || deps.colonyRoot(), 1.5),
      target: (s) => worldTarget(deps.reservoir()),
      skip: (s) => !(deps.reservoir && deps.reservoir()),   // no reservoir on this map → skip cleanly
      place: 'bottom',
    },
    {
      text: 'Ants will eat your substrate.',
      focus: (s) => world(deps.threats().ant, 1.1),
      target: (s) => worldTarget(deps.threats().ant),
      image: threatImg('ant'),
      place: 'bottom',
    },
    {
      text: 'Nematodes love eating ants. But they love eating <b>you</b> more.<br>You are currently defenceless: <b>run or hide.</b>',
      focus: (s) => world(deps.threats().nematode, 1.3),
      target: (s) => worldTarget(deps.threats().nematode),
      image: threatImg('nematode'),
      place: 'bottom',
    },
    {
      text: 'Trichoderma is drawn to substrate — and even more drawn to <b>you</b>.<br><b>Not good.</b>',
      focus: (s) => world(deps.threats().trich, 1.3),
      target: (s) => worldTarget(deps.threats().trich),
      image: threatImg('trichoderma'),
      place: 'bottom',
    },
    {
      text: '<b>Click on threats</b> to see their field of vision.',
      focus: (s) => world(deps.threats().nematode || deps.threats().trich || deps.threats().ant, 1.1),
      target: (s) => worldTarget(deps.threats().nematode || deps.threats().trich || deps.threats().ant),
      interactive: true,   // leave the canvas live so a threat-tap really shows its sight
      place: 'bottom',
    },
    {
      text: '<b>Good luck.</b>',
      focus: (s) => world(deps.colonyRoot(), 1.0),
      place: 'center',
      last: true,
    },
  ];

  // ---- helpers used by the script -----------------------------------------
  function world(p, zoom) { return p ? { x: p.x, y: p.y, zoom } : null; }
  function worldTarget(p) { return p ? { world: p } : null; }
  function cardTarget(name) { const e = deps.handCardEl(name); return e ? { el: e } : null; }
  function nodeCount(s) { return (s && s.active && s.active.nodes) ? s.active.nodes.length : 0; }

  // ---- DOM scaffold -------------------------------------------------------
  const root = el('div'); root.id = 'tutorial';
  const catcher = el('div', 'tut-catcher');
  const ring = el('div', 'tut-ring');
  const demo = el('div', 'tut-demo', '<div class="tut-demo-dot"></div>');
  const pop = el('div', 'tut-pop');
  pop.innerHTML =
    '<div class="tut-fig" id="tutFig"><img id="tutImg" alt="" draggable="false"></div>' +
    '<div class="tut-body" id="tutBody"></div>' +
    '<div class="tut-btns">' +
      '<button class="tut-btn tut-end" id="tutEnd" type="button">End</button>' +
      '<button class="tut-btn tut-next" id="tutNext" type="button">Next ▸</button>' +
    '</div>';
  root.appendChild(catcher);
  root.appendChild(ring);
  root.appendChild(demo);
  root.appendChild(pop);
  document.body.appendChild(root);

  const fig = pop.querySelector('#tutFig');
  const img = pop.querySelector('#tutImg');
  const body = pop.querySelector('#tutBody');
  const btnEnd = pop.querySelector('#tutEnd');
  const btnNext = pop.querySelector('#tutNext');

  // ---- controller state ---------------------------------------------------
  let idx = -1;
  let mem = {};
  let alive = true;
  let glowed = null;

  const stopEvt = (e) => e.stopPropagation();
  pop.addEventListener('click', stopEvt);
  catcher.addEventListener('click', () => next());
  btnNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  btnEnd.addEventListener('click', (e) => { e.stopPropagation(); finish(); });
  const onKey = (e) => { if (!alive) return; if (e.key === 'Escape') finish(); };
  document.addEventListener('keydown', onKey);

  function clearGlow() { if (glowed) { glowed.classList.remove('tut-glow'); glowed = null; } }
  function applyGlow(name) {
    clearGlow();
    if (!name) return;
    const e = deps.handCardEl(name);
    if (e) { e.classList.add('tut-glow'); glowed = e; }
  }

  function enter(i) {
    // A step can opt OUT on maps where its subject is absent (e.g. no reservoir) —
    // jump straight past it so the walkthrough never frames an empty spot.
    const cand = steps[i];
    if (cand && cand.skip && cand.skip(deps.getState())) {
      if (i >= steps.length - 1) { finish(); return; }
      return enter(i + 1);
    }
    idx = i;
    mem = {};
    const step = steps[i];
    const s = deps.getState();
    const f = step.focus && step.focus(s);
    // popup content
    body.innerHTML = step.text;
    if (step.image) { img.src = step.image; img.onerror = () => { fig.style.display = 'none'; }; fig.style.display = ''; }
    else { fig.style.display = 'none'; img.removeAttribute('src'); }
    // ---- placement ----------------------------------------------------------
    // Portrait phone: popup at step.place (top/bottom/centre), subject framed in the
    //   top half vertically (anchorY), carousel minimised, view zoomed out.
    // Desktop (wide): popup in the TOP HALF on the LEFT or RIGHT; the subject is centred
    //   in the OPPOSITE top quadrant (anchor ~0.25,0.25 or ~0.75,0.25) so popup + subject
    //   each own a top quadrant, clear of each other, the top pill, and the bottom carousel.
    // Otherwise: popup at step.place (top/bottom/centre).
    const desktop = desktopWide();
    pop.classList.remove('tut-pop--top', 'tut-pop--bottom', 'tut-pop--center', 'tut-pop--side', 'tut-pop--left', 'tut-pop--right');
    let anchorY = step.place === 'top' ? 0.5 : 0.28;   // portrait vertical framing
    let anchorX;                                        // desktop horizontal framing (undef elsewhere)
    if (desktop) {
      const midX = (s && s.substrate) ? s.substrate.worldWidth / 2 : 0;
      const subjLeft = (f && f.x != null) ? (f.x < midX) : true;
      anchorX = subjLeft ? 0.25 : 0.75;                // centre of the top-left / top-right quadrant…
      anchorY = 0.25;                                   // …centre of the top half
      pop.classList.add('tut-pop--side', subjLeft ? 'tut-pop--right' : 'tut-pop--left');   // …popup in the OTHER top quadrant
    } else {
      pop.classList.add('tut-pop--' + (step.place || 'bottom'));
    }
    // hand carousel: open it for the steps that need it; on a portrait phone,
    // MINIMIZE it on every other step so the popup + pics have room. Wider screens
    // keep the hand as-is (the top-half popup never reaches the carousel).
    if (step.hand === 'open') deps.setHandOpen(true);
    else if (phonePortrait()) deps.setHandOpen(false);
    // select a card FILTER for this step (e.g. the card-play showcase highlights Grow)
    if (step.filter && deps.setHandFilter) deps.setHandFilter(step.filter);
    // forced (gated) → no Next, no catcher; interactive → Next but no catcher;
    // explanatory → Next + full-screen click catcher.
    const forced = !!step.gate;
    const interactive = !!step.interactive;
    btnNext.style.display = forced ? 'none' : '';
    btnNext.textContent = step.last ? 'Begin ▸' : 'Next ▸';
    catcher.style.display = (forced || interactive) ? 'none' : '';
    // camera focus: frame the subject at (anchorX, anchorY). focusWorld applies the
    // offsets only on the matching form factor (portrait → anchorY; desktop → both).
    if (f && f.zoom != null) deps.focusWorld(f.x, f.y, f.zoom, anchorY, anchorX);
    else if (f && f.bounds) deps.focusBounds(f.bounds, f.pad || 80);
    // card glow
    applyGlow(step.glowCard);
    // demo gesture
    demo.style.display = step.demo ? '' : 'none';
    if (step.onEnter) step.onEnter(deps.getState(), mem);
    layout();
  }

  function next() {
    if (!alive) return;
    if (idx >= steps.length - 1) { finish(); return; }
    enter(idx + 1);
  }

  function finish() {
    if (!alive) return;
    alive = false;
    clearGlow();
    deps.setHandOpen(true);   // always leave the hand carousel maximized afterward
    if (deps.setHandFilter) deps.setHandFilter('all');   // ...and back to the full hand
    document.removeEventListener('keydown', onKey);
    root.remove();
    try { deps.onDone && deps.onDone(); } catch (_) {}
  }

  // Position the ring (+ demo) over the current step's target each frame.
  function layout() {
    if (!alive) return;
    const step = steps[idx]; if (!step) return;
    const t = step.target && step.target(deps.getState());
    let tx = null, ty = null, r = 46;
    if (t && t.world) { const s = deps.worldToScreen(t.world.x, t.world.y); tx = s.x; ty = s.y; r = 52; }
    else if (t && t.el) { const b = t.el.getBoundingClientRect(); if (b.width) { tx = b.left + b.width / 2; ty = b.top + b.height / 2; r = Math.max(b.width, b.height) / 2 + 12; } }
    if (tx == null) { ring.style.display = 'none'; }
    else {
      ring.style.display = '';
      ring.style.left = (tx - r) + 'px'; ring.style.top = (ty - r) + 'px';
      ring.style.width = ring.style.height = (r * 2) + 'px';
    }
    // demo drag gesture anchored at the colony
    if (step.demo) {
      const rootp = deps.colonyRoot();
      if (rootp) { const s = deps.worldToScreen(rootp.x, rootp.y); demo.style.left = s.x + 'px'; demo.style.top = s.y + 'px'; }
    }
  }

  // Called each render frame by main.js: check the gate, keep the overlay glued.
  function tick() {
    if (!alive) return;
    const step = steps[idx];
    if (step && step.gate && step.gate(deps.getState(), mem)) { next(); return; }
    layout();
  }

  enter(0);
  return {
    tick,
    destroy: finish,
    get active() { return alive; },
  };
}
