// =============================================================================
// UI — HUD, action buttons, event log, dev tools, "what we're testing" panel.
//
// DOM-based overlay (buttons/sliders/log) on top of the canvas world view.
// Reads engine state; never mutates it directly — all changes go through the
// handlers wired up by main.js. Dev cheats + sliders are clearly marked for
// later removal (B7).
// =============================================================================

import { ACTIONS, actionCost } from '../engine/actions.js';
import { SLIDERS, getByPath, setByPath } from '../config.js';
import { CARD_BY_NAME } from '../cards-data.js';
import { cardDeckAdditions, actionUsable } from '../engine/cards.js';
import { toggleMusic, isMusicMuted } from './music.js';

// Small self-contained line-icons for the action bar (inlined so they survive the
// single-file bundle). Hidden on narrow phones via CSS so the bar stays uncluttered.
const ICON_SVG = {
  hand: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8" width="8.5" height="11.5" rx="1.4" transform="rotate(-13 7.75 13.75)"/><rect x="12" y="8" width="8.5" height="11.5" rx="1.4" transform="rotate(13 16.25 13.75)"/></svg>',
  draw: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3.5" width="16" height="10.5" rx="1.6"/><path d="M12 6.5v4.2m0 0l-2-2m2 2l2-2"/><path d="M6.5 18.5h11"/></svg>',
  skip: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5l7.2 6.5L5 18.5z"/><path d="M13 5.5l6 6.5-6 6.5z"/></svg>',
  play: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l4.5 4.5L19.5 6.5"/></svg>',
};
const ICON = (id) => ICON_SVG[id] || '';

// Resource marks that replace the plain W/P letters (Water = solid drop,
// Phosphorus = spark/shine). Self-contained inline SVGs so they survive the
// single-file bundle; coloured by the surrounding context via currentColor.
const RES_ICON = {
  energy: '<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4 13.5h6L9 22l9.5-11.5h-6L13.5 2Z" fill="currentColor"/></svg>',
  water: '<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5C12 2.5 5.5 10 5.5 14.5a6.5 6.5 0 1 0 13 0C18.5 10 12 2.5 12 2.5Z" fill="currentColor"/></svg>',
  phos: '<svg class="ri" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5c1 6.2 4.3 9.5 10.5 10.5C16.3 13 13 16.3 12 22.5 11 16.3 7.7 13 1.5 12 7.7 11 11 7.7 12 1.5Z" fill="currentColor"/></svg>',
};

// Pickaxe glyph for the Actions dock. Inline SVG (not the ⛏ emoji) so it survives
// the bundle AND honours CSS `color` — the emoji renders as a fixed-colour glyph on
// many devices (Android) and ignores `color`, so it could never be reliably red.
// A proper tilted pickaxe (Lucide "pickaxe", ISC-licensed): diagonal handle + a
// curved double-point head, which reads far more like a pickaxe than a plain arc.
const PICK_SVG = '<svg class="pk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999"/><path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024"/><path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069"/><path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z"/></svg>';

// Warning glyph for the error toast (self-contained so it survives the bundle;
// coloured via currentColor). A rounded warning triangle — reads as "can't do
// that" without shouting.
const WARN_SVG = '<svg class="tk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.2 2.6 20h18.8L12 4.2Z"/><path d="M12 10.3v4"/><circle cx="12" cy="17.1" r="0.35" fill="currentColor" stroke="none"/></svg>';

// Colour-coded resource cost: ⚡ energy (amber, the .bcost default), then water
// (cyan drop) and phosphorus (violet spark). Returns inner HTML for a .bcost span.
function costHTML(energy, w, p) {
  const parts = [];
  if (energy) parts.push(`${energy}⚡`);
  if (w) parts.push(`<span class="w">${w}${RES_ICON.water}</span>`);
  if (p) parts.push(`<span class="p">${p}${RES_ICON.phos}</span>`);
  return parts.join(' ');
}

const TESTING_QUESTIONS = [
  'Is steering the semi-autonomous growth (Grow + Add Substrate + Amputate) satisfying — do I feel like I\'m shaping a living thing?',
  'Does crossing left→right — dig under walls, manage sparse energy — make a satisfying journey?',
  'Is the grow-toward-rich-food-but-it\'s-dangerous (Trichoderma) tension fun?',
  'Ants: is "go around / race them to the food / bomb the nest" a meaningful three-way choice?',
  'Nematodes: does the spot-you → swarm-in → Excrete loop create real pressure on your frontier?',
  'Is Fruit a satisfying payoff, and does the soil/shade surface make WHERE to fruit an interesting choice?',
  'Is Digest-burst a useful lever or redundant?',
];

export class UI {
  constructor(state, handlers) {
    this.state = state;
    this.handlers = handlers;
    this.selectedAction = null;
    this.pendingCard = null;          // {id, name} a card awaiting a map target
    this.pendingAction = null;        // index into cards.actions[] awaiting a map target
    this.armed = null;                // {kind:'hand'|'offer', index?, name} a card awaiting Confirm
    this.armedOffer = null;           // name of the highlighted draft card awaiting Draft-confirm
    this._lastCardTap = null;         // {name, t} — for double-tap/double-click-to-play detection
    this.handFilter = 'all';          // active card-hand filter group key
    this.handOpen = true;             // the hand carousel starts visible on every screen; only the Show/Hide button toggles it
    this.defaultHint = '';            // cached card-mode hint, restored on cancel
    this.el = {};
    this._build();
  }

  // Mouse drag-to-scroll for the carousel (touch already scrolls natively, with
  // momentum). We add inertial glide on release so a mouse drag feels as smooth as
  // a phone swipe. A real drag suppresses the trailing click so it doesn't
  // accidentally arm a card.
  _enableDragScroll(el) {
    if (!el) return;
    let down = false, startX = 0, startScroll = 0, moved = 0;
    let lastX = 0, lastT = 0, vel = 0, raf = 0;
    const stopGlide = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;   // touch scrolls natively
      stopGlide();
      down = true; startX = e.clientX; startScroll = el.scrollLeft; moved = 0;
      lastX = e.clientX; lastT = performance.now(); vel = 0;
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      el.scrollLeft = startScroll - dx;
      const t = performance.now(), dt = t - lastT;
      if (dt > 0) { vel = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = t; }   // px/ms
    });
    const end = () => {
      if (!down) return;
      down = false;
      // Inertia: glide on after release, decelerating — mimics touch momentum.
      let v = -vel * 16;   // px/ms (screen) → px/frame; scroll moves opposite the drag
      if (Math.abs(v) < 1) return;
      const step = () => {
        el.scrollLeft += v; v *= 0.93;
        raf = Math.abs(v) > 0.3 ? requestAnimationFrame(step) : 0;
      };
      raf = requestAnimationFrame(step);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
    // Capture-phase: cancel the click after a >6px drag before it reaches a card.
    el.addEventListener('click', (e) => {
      if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; }
    }, true);
  }

  setState(state) { this.state = state; this._hideCardPopup(); }

  _build() {
    const root = document.getElementById('ui');
    root.innerHTML = '';
    // On a phone-sized screen, start the secondary panels collapsed so the
    // living network stays the focus; they're one tap away.
    const narrow = window.innerWidth < 760;
    const maybeCollapsed = narrow ? ' collapsed' : '';
    const cardsOn = !!(this.state.config.cards && this.state.config.cards.enabled);
    this.cardsOn = cardsOn;

    // ---- Top HUD: one compact resource row + a drop-down event log ----
    const hud = div('panel hud');
    const resRow = cardsOn
      ? `<span class="res e">${RES_ICON.energy}<span class="rv" id="hud-energy">0</span><span class="rd" id="hud-energy-inc"></span></span>`
        + `<span class="res w">${RES_ICON.water}<span class="rv" id="hud-water">0</span><span class="rd" id="hud-water-inc"></span></span>`
        + `<span class="res p">${RES_ICON.phos}<span class="rv" id="hud-phosphorus">0</span><span class="rd" id="hud-phosphorus-inc"></span></span>`
      : `<span class="res e"><span class="rk">⚡</span><span class="rv" id="hud-energy">0</span></span>`
        + `<span class="res"><span class="rk">spores</span><span class="rv" id="hud-spores">0</span></span>`;
    hud.innerHTML =
      `<div class="resrow">${resRow}`
      + `<button class="mutebtn" id="mutebtn" aria-label="Toggle music"></button>`
      + `<button class="logbtn" id="logbtn" aria-label="Event log">Log <span class="lchev">▾</span></button>`
      + `</div>`
      + `<div class="logdrop hidden" id="logdrop"><div class="loglist" id="loglist"></div></div>`;
    root.appendChild(hud);
    this.el.logdrop = hud.querySelector('#logdrop');
    this.el.loglist = hud.querySelector('#loglist');
    hud.querySelector('#logbtn').onclick = () => this.toggleLog();
    const mb = hud.querySelector('#mutebtn');
    mb.textContent = isMusicMuted() ? '🔇' : '🔊';
    mb.onclick = () => { mb.textContent = toggleMusic() ? '🔇' : '🔊'; };

    // ---- Installed engines: income ledger (top-left, hangs under the pill) ----
    // and the ACTIONS menu (top-right). Both only exist with the card layer on.
    if (cardsOn) {
      // Both corner panels start OPEN on desktop (pinned by default) and CLOSED on
      // a phone; either way, clicking the pill / Actions button collapses & expands.
      if (this.ledgerOpen == null) this.ledgerOpen = window.innerWidth >= 760;
      if (this.actionsOpen == null) this.actionsOpen = window.innerWidth >= 760;
      const led = div('engledger hidden');
      led.id = 'engledger';
      hud.appendChild(led);
      this.el.engledger = led;
      // Clicking the resource pill (anywhere but the Log button) collapses/expands
      // the income ledger — on every screen size now.
      hud.querySelector('.resrow').addEventListener('click', (e) => {
        if (e.target.closest('#logbtn') || e.target.closest('#mutebtn')) return;
        this.toggleLedger();
      });

      const dock = div('actionsdock hidden');
      // Just the (red) pickaxe + ready-count badge + chevron — no "Actions" label, so
      // the pill stays compact and never crowds the resource pill in portrait.
      dock.innerHTML =
        `<button class="actbtn" id="actbtn" aria-label="Colony actions">`
        + PICK_SVG
        + `<span class="abadge" id="actbadge">0</span></button>`
        + `<div class="actmenu hidden" id="actmenu"></div>`;
      root.appendChild(dock);
      this.el.actdock = dock;
      this.el.actbtn = dock.querySelector('#actbtn');
      this.el.actmenu = dock.querySelector('#actmenu');
      this.el.actbadge = dock.querySelector('#actbadge');
      this.el.actbtn.onclick = () => this.toggleActions();
    }

    // ---- Bottom action bar ----
    const bar = div('panel actionbar');
    this.el.buttons = {};

    // Old always-available actions: only when the card layer is OFF (cards replace them).
    if (!cardsOn) {
      const order = ['grow', 'addSubstrate', 'amputate', 'attackAnts', 'excrete', 'digest', 'fruit'];
      for (const name of order) bar.appendChild(this._actionButton(name));
    } else {
      // Three groups: [Show Hand] far left · [Draw][Skip] centre · [Play Card] far
      // right. Every button is two rows — function on top, cost below.
      const handBtn = button('btn handbtn abtn', `${ICON('hand')}<span class="txt"><span class="blabel">Show Hand</span></span>`);
      handBtn.onclick = () => this.toggleHand();
      this.el.handbtn = handBtn;

      // Draw removed — cards enter the hand only by drafting them (choosing after a
      // finished food pile). Skip stays as the "pass / advance a round" control.
      const skipBtn = button('btn deckbtn abtn', 'Skip');
      skipBtn.onclick = () => this.handlers.onSkip();
      this.el.skipBtn = skipBtn;

      const playBtn = button('btn playbtn abtn', `${ICON('play')}<span class="txt"><span class="blabel">Play Card</span></span>`);
      playBtn.id = 'handplay';
      playBtn.disabled = true;
      playBtn.onclick = () => this.playArmed();
      this.el.handplay = playBtn;

      const left = div('abgroup left'); left.appendChild(handBtn);
      const centre = div('abgroup centre'); centre.appendChild(skipBtn);
      const right = div('abgroup right'); right.appendChild(playBtn);
      bar.appendChild(left); bar.appendChild(centre); bar.appendChild(right);
    }

    root.appendChild(bar);

    // ---- Hand bar (card layer) ----
    if (cardsOn) {
      const hand = div('panel handbar' + (this.handOpen ? ' open' : ''));
      hand.innerHTML =
        // Header (phone only): a chip showing which card is selected/aiming.
        // The open/close toggle now lives in the bottom action bar (Show Hand).
        `<div class="handhead">`
        + `<div class="handsel hidden" id="handsel"></div>`
        + `</div>`
        + `<div class="handbody" id="handbody">`
        + `<div class="handfilter" id="handfilter"></div>`
        // Drag-to-scroll carousel. Phones swipe; browsers also get ‹ › nav arrows
        // (hidden by CSS on phones, and auto-hidden when the hand doesn't overflow).
        + `<div class="handcarousel">`
        + `<button class="handnav prev" id="handprev" aria-label="Scroll cards left" hidden>‹</button>`
        + `<div class="handlist" id="handlist"></div>`
        + `<button class="handnav next" id="handnext" aria-label="Scroll cards right" hidden>›</button>`
        + `</div>`
        // Text-only preview — shown ONLY when a draw-engine (+5) card is selected.
        + `<div class="handpreview hidden" id="handpreview"></div>`
        + `</div>`;
      this.el.handbar = hand;
      this.el.handlist = hand.querySelector('#handlist');
      this.el.handfilter = hand.querySelector('#handfilter');
      this.el.handsel = hand.querySelector('#handsel');
      this.el.handpreview = hand.querySelector('#handpreview');
      this.el.handprev = hand.querySelector('#handprev');
      this.el.handnext = hand.querySelector('#handnext');
      const nav = (dir) => { const l = this.el.handlist; if (l) l.scrollBy({ left: dir * Math.max(220, l.clientWidth * 0.8), behavior: 'smooth' }); };
      if (this.el.handprev) this.el.handprev.onclick = () => nav(-1);
      if (this.el.handnext) this.el.handnext.onclick = () => nav(1);
      this._enableDragScroll(this.el.handlist);
      root.appendChild(hand);
      this.setHandOpen(this.handOpen);   // sync the Show Hand chevron + open class
    }

    // ---- Hint line ----
    // No persistent hint in card mode — the bar shows only for transient, contextual
    // hints (e.g. "Tap the map to aim …" while a targeted card is armed) and hides
    // itself when empty (see setHint), so there's no always-on paragraph.
    this.el.hint = div('hint');
    this.defaultHint = cardsOn
      ? ''
      : 'Hover an action for details. Grow extends the network toward sensed food.';
    this.el.hint.textContent = this.defaultHint;
    this.el.hint.style.display = this.defaultHint ? '' : 'none';
    root.appendChild(this.el.hint);

    // ---- Error toast (transient) ----
    // A blocked play surfaces here — a themed banner that fades in and auto-clears,
    // instead of yanking the whole event-log open.
    this.el.toast = div('toast hidden');
    root.appendChild(this.el.toast);
    this._toastHide = null;

    // (Event log now lives in the top HUD drop-down; see above.)

    // ---- Dev panel (cheats + sliders), clearly marked ----
    if (this.state.config.dev.enabled) {
      const dev = div('panel dev' + maybeCollapsed);
      dev.innerHTML = `<div class="title clickable">DEV TOOLS <span class="warn">(remove for release)</span> <span class="chev">▾</span></div>`;
      const body = div('dev-body');

      const cheats = div('cheats');
      const c1 = button('btn dev-btn', `+${this.state.config.dev.cheatEnergy} Energy`);
      c1.onclick = () => this.handlers.onCheat('energy');
      const c2 = button('btn dev-btn', `+${this.state.config.dev.cheatSpores} Spores`);
      c2.onclick = () => this.handlers.onCheat('spores');
      const c3 = button('btn dev-btn', 'Spawn Trichoderma');
      c3.onclick = () => this.handlers.onCheat('trichoderma');
      const c4 = button('btn dev-btn', 'No-Trich Map ↻');
      c4.onclick = () => this.handlers.onNoTrichMap();
      const c5 = button('btn dev-btn', 'Spawn Nematode');
      c5.onclick = () => this.handlers.onCheat('nematode');
      const c6 = button('btn dev-btn', 'Worm Vision: OFF');
      c6.onclick = () => { const on = this.handlers.onToggleWormVision(); c6.textContent = 'Worm Vision: ' + (on ? 'ON' : 'OFF'); };
      const c7 = button('btn dev-btn', 'Place Worm: OFF');
      c7.onclick = () => { const on = this.handlers.onPlaceWorm(); c7.textContent = 'Place Worm: ' + (on ? 'ON' : 'OFF'); };
      cheats.append(c1, c2, c3, c4, c5, c6, c7);
      body.appendChild(cheats);

      const sliders = div('sliders');
      for (const s of SLIDERS) {
        const wrap = div('slider');
        const val = getByPath(this.state.config, s.path);
        wrap.innerHTML = `<label>${s.label} <span class="sv">${val}</span></label>`;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = s.min; input.max = s.max; input.step = s.step; input.value = val;
        const sv = wrap.querySelector('.sv');
        input.oninput = () => {
          const v = parseFloat(input.value);
          setByPath(this.state.config, s.path, v);
          sv.textContent = v;
          this.handlers.onSliderChange(s.path, v);
        };
        wrap.appendChild(input);
        sliders.appendChild(wrap);
      }
      body.appendChild(sliders);
      dev.appendChild(body);
      dev.querySelector('.title').onclick = () => dev.classList.toggle('collapsed');
      root.appendChild(dev);
    }

    // ---- Run-over overlay ----
    this.el.overlay = div('overlay hidden');
    root.appendChild(this.el.overlay);

    // ---- Card-draft overlay (pick 1 of 3 after finishing a food pile) ----
    if (cardsOn) {
      this.el.offer = div('offer hidden');
      root.appendChild(this.el.offer);
      // Tempo-upgrade picker: "which installed ability should this speed up?"
      this.el.pick = div('offer pick hidden');
      root.appendChild(this.el.pick);
    }

    // ---- Tap-away: close any open drop-down when tapping elsewhere ----------
    // On a phone the Log / ledger / Actions drop-downs float over the map; a tap
    // on the map, a card, the bottom bar — anything outside the open panel and its
    // own toggle — dismisses them. Desktop keeps the corner panels pinned, so this
    // only acts on phone widths. (Capture phase so it runs before the tapped
    // control's own handler, e.g. arming a card.)
    if (this._onTapAway) document.removeEventListener('pointerdown', this._onTapAway, true);
    this._onTapAway = (e) => {
      // While the card preview is up it owns all input — its own click dismisses it.
      // (This capture-phase pointerdown would otherwise collapse the corner pills,
      // since the popup lives on document.body, outside .hud / .actionsdock.)
      if (this._cardPop && this._cardPop.classList.contains('show')) return;
      if (window.innerWidth >= 760) return;
      const t = e.target;
      if (!t || !t.closest) return;
      const inHud = t.closest('.hud');            // resource pill + Log + engine ledger
      const inDock = t.closest('.actionsdock');   // Actions button + menu
      let ledChanged = false, actChanged = false;
      if (!inHud) {
        if (this.ledgerOpen) { this.ledgerOpen = false; ledChanged = true; }
        if (this.el.logdrop && !this.el.logdrop.classList.contains('hidden')) this.setLogOpen(false);
      }
      if (!inDock && this.actionsOpen) { this.actionsOpen = false; actChanged = true; }
      if (ledChanged || actChanged) {
        // Re-render ONLY the panel that closed — re-rendering the OTHER panel too
        // would detach a row the user is mid-tap on (both panels can be open at
        // phone width after a desktop→phone resize), swallowing the click that
        // opens its card popup.
        if (ledChanged) this._renderEngines();
        if (actChanged) this._renderActions();
        this._syncPanelHeights();
      }
    };
    document.addEventListener('pointerdown', this._onTapAway, true);
  }

  _actionButton(name) {
    const a = ACTIONS[name];
    const b = button('btn act', '');
    b.dataset.action = name;
    b.title = a.desc;
    b.onclick = () => this.handlers.onAction(name);
    if (name === 'fruit') {
      b.onmouseenter = () => this.handlers.onFruitPreview(true);
      b.onmouseleave = () => this.handlers.onFruitPreview(false);
    }
    this.el.buttons[name] = b;
    return b;
  }

  setSelectedAction(name) {
    this.selectedAction = name;
    for (const [key, btn] of Object.entries(this.el.buttons)) {
      btn.classList.toggle('selected', key === name);
    }
    const hints = {
      addSubstrate: 'Click underground to place a food patch and lure growth there.',
      amputate: 'Click to cut out every strand inside the red circle.',
      attackAnts: 'Click an ant nest to bomb it — each hit removes a chunk of its HP.',
    };
    if (name && hints[name]) this.setHint(hints[name]);
  }

  setPendingCard(index) {
    const h = this.state.cards && this.state.cards.hand[index];
    this.pendingCard = h ? { id: h.id, name: h.name } : null;
    this._renderHandSelection();
  }
  clearPendingCard() { this.pendingCard = null; this._renderHandSelection(); }

  // Collapsible hand tray. The open/close toggle is the "Show Hand" button in
  // the bottom action bar; this keeps its chevron + the tray's .open class in sync.
  setHandOpen(open) {
    this.handOpen = open;
    if (this.el.handbar) this.el.handbar.classList.toggle('open', open);
    const lab = this.el.handbtn && this.el.handbtn.querySelector('.blabel');
    if (lab) lab.textContent = open ? 'Hide Hand' : 'Show Hand';
  }
  toggleHand() { this.setHandOpen(!this.handOpen); }

  // Event-log drop-down (top HUD). Opened/closed only by the player tapping the
  // Log button now — errors surface as a transient toast (see toast()), not by
  // yanking the whole log open.
  toggleLog() { this.setLogOpen(this.el.logdrop ? this.el.logdrop.classList.contains('hidden') : false); }
  setLogOpen(open) {
    if (!this.el.logdrop) return;
    // Phone: the log shares screen space with the two corner drop-downs — close
    // them when it opens so only one is visible at a time.
    if (open && window.innerWidth < 760) {
      this.ledgerOpen = false; this.actionsOpen = false;
      this._renderEngines(); this._renderActions();
    }
    this.el.logdrop.classList.toggle('hidden', !open);
    const chev = document.querySelector('.logbtn .lchev');
    if (chev) chev.textContent = open ? '▴' : '▾';
    if (open) this._renderLog();
  }
  openLog() { this.setLogOpen(true); }

  // --- installed-engines ledger (top-left) + actions menu (top-right) --------
  // On a phone the three drop-downs (Log, ledger, Actions) would overlap, so only
  // one is open at a time. On desktop both corner panels stay pinned (no conflict).
  toggleLedger() {
    this.ledgerOpen = !this.ledgerOpen;
    if (this.ledgerOpen) {
      this.setLogOpen(false);                                  // log + ledger share the top-left column
      if (window.innerWidth < 760) this.actionsOpen = false;   // phone: one drop-down at a time
    }
    this._renderEngines(); this._renderActions(); this._syncPanelHeights();
  }
  toggleActions() {
    this.actionsOpen = !this.actionsOpen;
    if (this.actionsOpen && window.innerWidth < 760) { this.ledgerOpen = false; this.setLogOpen(false); }
    this._renderActions(); this._renderEngines(); this._syncPanelHeights();
  }

  // A targeted installed action (e.g. Suberin Wall) is armed and awaiting a map
  // tap. On a phone, drop the Actions menu so the map is tappable underneath.
  setPendingAction(i) {
    this.pendingAction = i;
    if (window.innerWidth < 760 && this.actionsOpen) { this.actionsOpen = false; this._renderActions(); this._syncPanelHeights(); }
    this._renderHandSelection();   // show the "Aiming … ✕" chip (phone) so it can be cancelled
  }
  clearPendingAction() { this.pendingAction = null; this._renderHandSelection(); }

  _renderEngines() {
    const led = this.el.engledger; if (!led) return;
    const C = this.state.cards; const engines = (C && C.engines) || [];
    const sum = summarizeEngines(engines);
    // The left ledger is only resource income + economy modifiers. Timed dig
    // abilities (e.g. Tap-Root Rhizomorph) render in the Actions menu instead, so
    // the ledger hides when the only install is one of those.
    const hasLeft = sum.energy.rows.size || sum.phosphorus.rows.size || sum.water.rows.size || sum.mods.length;
    const show = !!hasLeft && this.ledgerOpen;   // collapsible via the pill on every screen
    led.classList.toggle('hidden', !show);
    if (!show) { led.innerHTML = ''; return; }
    // Cadence indicator (shared with the Actions menu): a steady producer shows
    // "/rd"; one that fires every N rounds shows N lights counting DOWN to the
    // payout — all lit when freshly charged, one lit when it fires next round.
    const CK = { energy: 'e', water: 'w', phosphorus: 'p' };
    const block = (key, glyph) => {
      const g = sum[key]; if (!g.rows.size) return '';
      // No resource header — each row carries its own colour dot + glyph, so the
      // effects read as one flat list (grouped by resource via order & colour).
      return [...g.rows.values()].map((r) =>
        `<div class="erow ${key}" data-card="${escapeHtml(r.raw)}"><span class="edot ${key}"></span>`
        + `${r.n > 1 ? `<span class="exn">×${r.n}</span>` : ''}`
        + `<span class="enm">${r.name}</span>`
        + `<span class="eval">+${r.amt}${glyph}</span>`
        + cadenceLightsHTML(r.cad, r.left, CK[key]) + `</div>`).join('');
    };
    let h = block('energy', '⚡') + block('phosphorus', '✦') + block('water', '💧');
    // (Timed dig abilities moved to the Actions menu — see _renderActions.)
    if (sum.mods.length) {
      h += '<div class="lgdiv"></div><div class="lgblock"><div class="lghead m"><span>Modifiers</span></div>'
        + sum.mods.map((m) => `<div class="erow" data-card="${escapeHtml(m.raw)}"><span class="enm dim">${m.name} · ${m.text}</span></div>`).join('') + '</div>';
    }
    led.innerHTML = h;
    // Click any installed-engine row to preview that card (see _showCardPopup).
    led.querySelectorAll('.erow[data-card]').forEach((row) =>
      row.addEventListener('click', () => this._showCardPopup(row.dataset.card)));
  }

  _renderActions() {
    const dock = this.el.actdock, menu = this.el.actmenu, btn = this.el.actbtn, badge = this.el.actbadge;
    if (!dock) return;
    const C = this.state.cards; const actions = (C && C.actions) || [];
    // Timed dig engines (e.g. Tap-Root Rhizomorph) are automatic abilities that act
    // on the world, so they belong here (right) rather than the resource ledger.
    const timed = summarizeEngines((C && C.engines) || []).timed;
    const hasAny = actions.length > 0 || timed.length > 0;
    dock.classList.toggle('hidden', !hasAny);
    if (!hasAny) { menu.innerHTML = ''; return; }
    const ready = actions.filter((a) => actionUsable(this.state, a)).length;   // player-usable now (autos don't count)
    badge.textContent = ready; badge.classList.toggle('zero', ready === 0);
    const show = this.actionsOpen;   // collapsible via the Actions pill on every screen
    btn.classList.toggle('open', show);
    menu.classList.toggle('hidden', !show);
    if (!show) { menu.innerHTML = ''; return; }
    menu.innerHTML = actions.map((a, i) => actionRowHTML(a, i, this.state)).join('')
      + timed.map((t) => autoActionRowHTML(t)).join('');
    menu.querySelectorAll('.use:not(.off)').forEach((b) => {
      b.onclick = (e) => { e.stopPropagation(); this.handlers.onActivateAction(+b.dataset.i); };  // don't also open the preview
    });
    // Click a row (anywhere but its Use button) to preview that card.
    menu.querySelectorAll('.actrow[data-card]').forEach((row) =>
      row.addEventListener('click', (e) => { if (e.target.closest('.use')) return; this._showCardPopup(row.dataset.card); }));
  }

  // Preview an installed card (from either corner panel) as a compact, fixed-shape
  // CCG card floating over the scene. A full-screen backdrop catches the next click
  // anywhere else and dismisses it; clicks on the card itself do nothing.
  _showCardPopup(name) {
    const c = CARD_BY_NAME[name];
    if (!c) return;
    if (!this._cardPop) {
      const el = document.createElement('div');
      el.className = 'cardpop';
      // Any click outside the card face closes the preview (and nothing else).
      el.addEventListener('click', (e) => { if (!e.target.closest('.cardpop-card')) { e.stopPropagation(); this._hideCardPopup(); } });
      document.body.appendChild(el);
      this._cardPop = el;
    }
    this._cardPop.innerHTML = `<div class="cardbtn cardpop-card">${cardFaceHTML(name, c, 0)}</div>`;
    this._cardPop.classList.add('show');
  }
  _hideCardPopup() { if (this._cardPop) this._cardPop.classList.remove('show'); }

  // Match the two panels' heights so the corners read as a balanced pair. Uses
  // `min-height` (not `height`) so a panel always GROWS to fit its content and
  // never clips — with `box-sizing: border-box`, an exact `height = scrollHeight`
  // would fall short by the border and force a stray scrollbar. Each panel ends up
  // at least as tall as the taller one's content, so neither ever scrolls.
  _syncPanelHeights() {
    const led = this.el.engledger, menu = this.el.actmenu;
    if (!led || !menu) return;
    led.style.height = ''; menu.style.height = '';
    led.style.minHeight = ''; menu.style.minHeight = '';
    const ledVis = !led.classList.contains('hidden');
    const menuVis = menu && this.el.actdock && !this.el.actdock.classList.contains('hidden') && !menu.classList.contains('hidden');
    if (ledVis && menuVis) {
      const hh = Math.max(led.scrollHeight, menu.scrollHeight);
      led.style.minHeight = hh + 'px'; menu.style.minHeight = hh + 'px';
    }
  }

  // The "selected card" chip in the hand header — makes it clear which card is
  // armed while you're aiming on the map.
  _renderHandSelection() {
    const el = this.el.handsel;
    if (!el) return;
    // A targeted card OR a targeted installed action can be aiming (mutually
    // exclusive). Show whichever is armed, with a ✕ to cancel it.
    const act = (!this.pendingCard && this.pendingAction != null && this.state.cards && this.state.cards.actions[this.pendingAction]) || null;
    const name = this.pendingCard ? this.pendingCard.name : (act ? act.name : null);
    if (name) {
      el.classList.remove('hidden');
      el.innerHTML = `<span class="hslabel">Aiming</span><span class="hsname"></span>`
        + `<button class="hscancel" aria-label="Cancel selection">✕</button>`;
      el.querySelector('.hsname').textContent = name;
      const cancel = this.pendingCard ? this.handlers.onCancelCard : this.handlers.onCancelAction;
      el.querySelector('.hscancel').onclick = (e) => {
        e.stopPropagation();
        if (cancel) cancel();
      };
    } else {
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  }

  setHint(text) { const el = this.el.hint; if (!el) return; el.textContent = text || ''; el.style.display = text ? '' : 'none'; }
  resetHint() { this.setHint(this.defaultHint); }

  // Transient error banner — shown when a play is blocked (can't afford, no
  // target in range, …). Fades in near the top, then auto-clears after a beat.
  // Non-blocking (pointer-events off) so it never gets in the way of the map.
  toast(message, kind = 'warn') {
    const el = this.el.toast;
    if (!el || !message) return;
    el.className = `toast ${kind}`;   // clears .hidden and .in (base = faded out)
    el.innerHTML = `<span class="tk-wrap">${WARN_SVG}</span><span class="tmsg"></span>`;
    el.querySelector('.tmsg').textContent = message;
    void el.offsetWidth;             // reflow so the fade-in restarts even if one is up
    el.classList.add('in');
    if (this._toastHide) clearTimeout(this._toastHide);
    this._toastHide = setTimeout(() => {
      el.classList.remove('in');
      this._toastHide = setTimeout(() => el.classList.add('hidden'), 240);
    }, 2600);
  }

  showOverlay(result) {
    this._hideCardPopup();   // a card preview must never sit over the run-over screen
    const o = this.el.overlay;
    o.classList.remove('hidden');
    const won = result && result.won;
    const died = result && result.died;
    const puzzle = this.state.mode === 'puzzle';

    let title, body;
    if (won) {
      title = this.cardsOn && !puzzle ? 'You reached the goal! 🍄' : 'Treasure reached! 🧩';
      body = this.cardsOn && !puzzle
        ? `The colony crossed the map and fruited at the summer goal in <b>${result.turns}</b> steps.`
        : `The colony threaded the map and reached the chest in <b>${result.turns}</b> turns.`;
    } else if (died) {
      title = 'The colony has died';
      body = puzzle
        ? 'It starved or was overrun before reaching the treasure. Try a different route.'
        : this.cardsOn
          ? 'It ran card-dry and out of Energy, or was overwhelmed, before reaching the goal.'
          : 'Trichoderma and hazards overwhelmed the network before it could fruit.';
    } else {
      title = 'The network has fruited';
      body = `It pushed up <b>${result.bodies}</b> fruiting bodies and released <b>${result.spores}</b> spores.`;
    }

    // Mode-aware buttons (primary first).
    const puzzleBtn = `<button class="btn big" id="overlay-puzzle">${won ? 'Play again 🧩' : 'Retry puzzle 🧩'}</button>`;
    const randomBtn = `<button class="btn big" id="overlay-restart">${puzzle ? 'New random map ↻' : 'Begin a new colony ↻'}</button>`;
    o.innerHTML = `
      <div class="card">
        <h1>${title}</h1>
        <p>${body}</p>
        ${won || puzzle ? `<div class="ctrl" style="justify-content:center">${puzzleBtn}${randomBtn}</div>`
          : `<p class="dim small">In the full game these spores would seed the next generation. Phase 1 ends here.</p>${randomBtn}`}
      </div>`;
    const rb = o.querySelector('#overlay-restart');
    if (rb) rb.onclick = () => this.handlers.onRestart();
    const pb = o.querySelector('#overlay-puzzle');
    if (pb) pb.onclick = () => this.handlers.onPuzzle();
  }
  hideOverlay() { this.el.overlay.classList.add('hidden'); }

  update() {
    const s = this.state;
    const net = s.active;
    text('hud-energy', Math.floor(net.energy));
    text('hud-spores', Math.floor(s.spores));

    // Card layer: resources, hand, draw/skip.
    if (this.cardsOn && s.cards) {
      text('hud-water', Math.floor(net.water || 0));
      text('hud-phosphorus', Math.floor(net.phosphorus || 0));
      // Per-round income shown on the pill next to each stock (e.g. "200 +1–3"):
      // steady producers set the floor, cadenced ones (every N) add the ceiling.
      const inc = summarizeEngines(s.cards.engines || []);
      const incStr = (g) => { const mn = g.steady, mx = g.steady + g.cad; if (mx <= 0) return ''; return mn === mx ? `+${mn}` : `+${mn}–${mx}`; };
      text('hud-energy-inc', incStr(inc.energy));
      text('hud-water-inc', incStr(inc.water));
      text('hud-phosphorus-inc', incStr(inc.phosphorus));
      this._renderHand();
      const cc = s.config.cards;
      if (this.el.skipBtn) {
        this.el.skipBtn.innerHTML = `${ICON('skip')}<span class="txt"><span class="blabel">Skip</span><span class="bcost">${costHTML(cc.skipCostEnergy, 0, 0)}</span></span>`;
        this.el.skipBtn.disabled = s.runOver || !net.alive || net.energy < cc.skipCostEnergy;
      }
      this._renderOffer();
      this._renderEngines();
      this._renderActions();
      this._syncPanelHeights();
    }

    // Old action buttons (only present when the card layer is off).
    for (const name of ['grow', 'addSubstrate', 'amputate', 'attackAnts', 'excrete', 'digest', 'fruit']) {
      const btn = this.el.buttons[name];
      if (!btn) continue;
      const { energy } = actionCost(s, name);
      btn.innerHTML = `${ACTIONS[name].label} <span class="cost">${energy}⚡</span>`;
      const noAnts = name === 'attackAnts' && !(s.ants && s.ants.length);
      const noWorms = name === 'excrete' && !(s.nematodes && s.nematodes.length);
      const hidden = noAnts || noWorms;
      btn.style.display = hidden ? 'none' : '';
      btn.disabled = s.runOver || net.energy < energy || !net.alive || hidden;
    }

    this._renderLog();
  }

  _renderHand() {
    const list = this.el.handlist;
    if (!list) return;
    const s = this.state, net = s.active;
    this._renderHandSelection();

    // STACK: group identical cards by name; keep the first hand index to play.
    const groups = new Map();
    s.cards.hand.forEach((h, i) => {
      let g = groups.get(h.name);
      if (!g) { g = { name: h.name, card: CARD_BY_NAME[h.name] || { costW: 0, costP: 0, buyCostEnergy: 0, effect: '', type: '' }, count: 0, firstIndex: i }; groups.set(h.name, g); }
      g.count++;
    });
    const all = [...groups.values()];

    // Reconcile the selection with the freshly-built hand: drop it if that card
    // is gone, else refresh its index to the current firstIndex (the hand can
    // splice/shift, e.g. after a draw or a pending targeted card resolving).
    if (this.armed) {
      const g = groups.get(this.armed.name);
      if (!g) this.armed = null; else this.armed.index = g.firstIndex;
    }
    this._renderHandFooter();

    // FILTER chips (built from the groups present), then apply the active filter.
    this._renderHandFilter(all);
    const filtered = this.handFilter === 'all' ? all : all.filter((g) => cardGroups(g.card).some((x) => x.key === this.handFilter));

    const prevScroll = list.scrollLeft;
    if (!s.cards.hand.length) { list.innerHTML = '<div class="handempty">Hand empty — Draw a card (⚡) or Skip.</div>'; return; }
    list.innerHTML = '';
    if (!filtered.length) { list.innerHTML = '<div class="handempty">No cards in this filter.</div>'; return; }

    filtered.forEach((g) => {
      const c = g.card;
      // Action cards install for Energy only (their W/P is a per-activation cost),
      // so don't grey them for W/P you don't need to play them — matches cardBlockedReason.
      const isAction = c.type === 'action';
      const affordable = net.energy >= c.buyCostEnergy
        && (isAction || (net.water >= c.costW && net.phosphorus >= c.costP))
        && !s.runOver && net.alive;
      const pending = this.pendingCard && this.pendingCard.name === g.name;
      const armed = this.armed && this.armed.kind === 'hand' && this.armed.name === g.name;
      const cls = 'cardbtn' + (affordable ? '' : ' unaff') + (pending || armed ? ' selected' : '');
      const b = button(cls, cardFaceHTML(g.name, c, g.count));
      b.setAttribute('data-name', g.name);
      b.title = c.effect;
      b.onclick = () => this.onCardTap(g.firstIndex, g.name);
      list.appendChild(b);
    });
    list.scrollLeft = prevScroll;   // keep carousel position across a re-render
    this._updateHandNav();
  }

  // Show the ‹ › carousel arrows only when the hand actually overflows its width
  // (browser only — CSS hides them on phones regardless).
  _updateHandNav() {
    const l = this.el.handlist, prev = this.el.handprev, next = this.el.handnext;
    if (!l || !prev || !next) return;
    const overflow = l.scrollWidth > l.clientWidth + 4;
    prev.hidden = !overflow; next.hidden = !overflow;
  }

  // Filter chips: All + one per card group present in hand (with counts).
  _renderHandFilter(groups) {
    const fbar = this.el.handfilter;
    if (!fbar) return;
    const present = new Map();
    groups.forEach((g) => { cardGroups(g.card).forEach((gr) => { const e = present.get(gr.key) || { key: gr.key, label: gr.label, n: 0 }; e.n += g.count; present.set(gr.key, e); }); });
    if (this.handFilter !== 'all' && !present.has(this.handFilter)) this.handFilter = 'all';  // active filter emptied out
    const total = groups.reduce((a, g) => a + g.count, 0);
    const ordered = GROUP_ORDER.filter((k) => present.has(k)).map((k) => present.get(k));
    const chip = (key, label, n, on) => `<button class="fchip${on ? ' on' : ''}" data-f="${key}">${escapeHtml(label)}<span class="fn">${n}</span></button>`;
    // Only worth showing filters when there's more than one group.
    fbar.style.display = ordered.length > 1 ? '' : 'none';
    fbar.innerHTML = chip('all', 'All', total, this.handFilter === 'all') + ordered.map((e) => chip(e.key, e.label, e.n, this.handFilter === e.key)).join('');
    fbar.querySelectorAll('.fchip').forEach((b) => { b.onclick = () => { this.handFilter = b.dataset.f; this._renderHand(); }; });
  }

  // Card-draft overlay: a finished map pile lets you pick 1 of 3 free cards.
  // Selecting a card just HIGHLIGHTS it (and previews what a +5 draw-engine card
  // shuffles in); the "Draft Card" button confirms the pick.
  _renderOffer() {
    const el = this.el.offer;
    if (!el) return;
    const s = this.state;
    const off = !s.runOver && s.cards && s.cards.pendingOffers && s.cards.pendingOffers[0];
    if (!off) {
      el.classList.add('hidden');
      this.armedOffer = null;
      this._offerHold = false; this._offerReleased = null; this._offerOrigin = null;
      this._offerBuiltFor = null;
      this._clearDraftMorph();   // stop a mid-flight morph if the offer went away
      return;
    }
    // Draft-intro gate: while the glyph animation is playing (held, and not yet
    // released for THIS offer), keep the panel hidden — main.js releases it once
    // the glyph is in. With no intro running, _offerHold is false and it shows as before.
    if (this._offerHold && this._offerReleased !== off) { el.classList.add('hidden'); return; }
    // Drop a stale selection if it isn't among the current choices.
    if (this.armedOffer && !off.choices.includes(this.armedOffer)) this.armedOffer = null;
    // Build the panel once per offer (choices are fixed; selection is repainted
    // separately). Rebuilding every frame would fight the expand animation.
    if (this._offerBuiltFor !== off) {
      const cards = off.choices.map((name) => {
        const c = CARD_BY_NAME[name] || { costW: 0, costP: 0, buyCostEnergy: 0, effect: '', type: '' };
        const sel = name === this.armedOffer ? ' selected' : '';
        return `<button class="offercard${sel}" data-name="${escapeHtml(name)}">` + cardFaceHTML(name, c, 0) + `</button>`;
      }).join('');
      el.innerHTML = `<div class="offerbox">`
        + `<h2>Choose one</h2>`
        + `<div class="offerrow">${cards}</div>`
        + `<div class="handpreview offerpreview hidden" id="offerpreview"></div>`
        + `<div class="offerfooter"><button class="btn big" id="offerconfirm" disabled>Draft Card</button></div>`
        + `</div>`;
      // Single click selects; a DOUBLE click drafts it straight to hand (mirrors the
      // hand's double-tap-to-play). Detected off `click` so it behaves the same on
      // mouse and touch.
      el.querySelectorAll('.offercard').forEach((btn) => {
        btn.onclick = () => {
          const name = btn.dataset.name;
          const now = Date.now();
          const last = this._lastOfferTap;
          const isDouble = last && last.name === name && now - last.t < 320;
          this._lastOfferTap = isDouble ? null : { name, t: now };
          if (isDouble) this.pickOffer(name);
          else this.armOffer(name);
        };
      });
      const confirm = el.querySelector('#offerconfirm');
      if (confirm) confirm.onclick = () => this.confirmOffer();
      this._offerBuiltFor = off;
    }
    el.classList.remove('hidden');
    this._paintOffer();
  }

  // --- draft intro (main.js drives the timing) -----------------------------
  // Keep the draft panel hidden while the leaf pile fades on the canvas.
  holdOffer() {
    this._clearDraftMorph();
    this._offerHold = true;
    this._offerReleased = null;
    this._renderOffer();
  }
  // Release the panel FROM the pile's screen point `origin`: a glowing 3-card
  // glyph rises there on EVERY screen. Where the three draft slots all fit on
  // screen, each glyph card flies + grows into its slot (the icon/draft borders
  // match, so it reads as one shape transforming); where the row scrolls (phone
  // portrait) the icon holds and the whole panel expands out of it. Reduced-motion
  // just shows the panel.
  releaseOffer(origin) {
    this._clearDraftMorph();
    this._offerHold = false;
    this._offerOrigin = origin || null;
    const s = this.state;
    const off = (s.cards && s.cards.pendingOffers && s.cards.pendingOffers[0]) || null;
    this._offerReleased = off;
    this._renderOffer();                         // build + show the panel (cards laid out)
    if (!off || !origin || this._reducedMotion()) return;
    this._playDraftReveal(origin);
  }

  _reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  // Fan geometry for the glyph, in SCREEN coords, centred on `origin`, fitted to
  // height H. Mirrors the icon the owner picked: three cards, "Standard" 16°
  // spread, stacked left→right. Returns [{cx,cy,w,h,rot}] per card (left,mid,right).
  _draftFanCards(origin, H) {
    const deg = 16, W0 = 100, H0 = 142;
    const pivot = { x: 0, y: H0 * 1.0 };
    const cards = [-deg, 0, deg].map((ang) => {
      const r = ang * Math.PI / 180;
      return { x: pivot.x + Math.sin(r) * (H0 * 0.8), y: pivot.y - Math.cos(r) * (H0 * 0.8), rot: ang };
    });
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const cd of cards) {
      const hw = W0 / 2, hh = H0 / 2, r = cd.rot * Math.PI / 180, co = Math.cos(r), si = Math.sin(r);
      for (const [px, py] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
        const x = cd.x + px * co - py * si, y = cd.y + px * si + py * co;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    const pad = 14; minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const scale = H / (maxY - minY);
    const bcx = (minX + maxX) / 2, bcy = (minY + maxY) / 2;
    return cards.map((cd) => ({
      cx: origin.x + (cd.x - bcx) * scale,
      cy: origin.y + (cd.y - bcy) * scale,
      w: W0 * scale, h: H0 * scale, rot: cd.rot,
    }));
  }

  // Raise the glowing 3-card glyph at the pile, then hand off to the per-card
  // morph (roomy layouts) or an icon-hold + panel-expand (scrolling row).
  _playDraftReveal(origin) {
    const el = this.el.offer;
    const cardEls = el ? [...el.querySelectorAll('.offerrow .offercard')] : [];
    if (!cardEls.length || !cardEls[0].animate) return;   // panel already shown by _renderOffer
    const vw = window.innerWidth, vh = window.innerHeight;
    const targets = cardEls.map((c) => c.getBoundingClientRect());
    // All three draft slots fully on screen? (Phone portrait scrolls the row, so
    // some slots sit off the right edge — there we hold the icon + expand instead.)
    const allFit = targets.every((r) => r.width >= 8 && r.left >= -2 && r.right <= vw + 2 && r.top >= -2 && r.bottom <= vh + 2);

    const ICON_H = allFit ? 78 : 96;   // a touch larger when it won't fly into slots
    const fan = this._draftFanCards(origin, ICON_H);

    // Three glowing glyph frames at the pile — a clone of each card inside, hidden
    // (CSS opacity 0) so the icon reads as an outline until it becomes the card.
    const frames = cardEls.map((cardEl, i) => {
      const f = fan[Math.min(i, fan.length - 1)];
      const frame = document.createElement('div');
      frame.className = 'draftmorph';
      const clone = cardEl.cloneNode(true);
      clone.classList.add('dmclone'); clone.classList.remove('selected');
      frame.appendChild(clone);
      document.body.appendChild(frame);
      Object.assign(frame.style, {
        left: (f.cx - f.w / 2) + 'px', top: (f.cy - f.h / 2) + 'px',
        width: f.w + 'px', height: f.h + 'px', borderRadius: (f.w * 0.13) + 'px',
        transform: `rotate(${f.rot}deg)`, opacity: '0',
      });
      return { frame, clone, f };
    });

    el.style.opacity = '0';   // hide the panel while the icon reads
    if (allFit) this._draftMorphToSlots(el, cardEls, targets, frames);
    else this._draftIconThenExpand(origin, el, frames);
  }

  // Roomy layouts: each glyph card flies + grows + de-rotates into its slot, face
  // revealing inside. A FLIP over left/top/width/height (NOT transform-scale, so
  // the border stays crisp at icon size); real cards cross-fade in at the end.
  _draftMorphToSlots(el, cardEls, targets, frames) {
    const MORPH_MS = 940, STAGGER = 80;
    cardEls.forEach((c) => { c.style.opacity = '0'; });   // real cards hidden until handoff
    const dim = el.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 320, delay: MORPH_MS * 0.40, easing: 'ease-out', fill: 'both' });
    dim.onfinish = () => { el.style.opacity = ''; };

    frames.forEach(({ frame, clone, f }, i) => {
      const tr = targets[i];
      const sl = f.cx - f.w / 2, st = f.cy - f.h / 2, sbr = f.w * 0.13;
      const base = { left: tr.left + 'px', top: tr.top + 'px', width: tr.width + 'px', height: tr.height + 'px', borderRadius: '12px', transform: 'rotate(0deg)' };
      const start = { left: sl + 'px', top: st + 'px', width: f.w + 'px', height: f.h + 'px', borderRadius: sbr + 'px', transform: `rotate(${f.rot}deg)` };
      // Linear timeline + PER-KEYFRAME easing: a global ease-out would race through
      // the early "hold" in wall-time and collapse the icon beat.
      const opts = { duration: MORPH_MS, delay: i * STAGGER, fill: 'both' };
      frame.animate([
        { ...start, opacity: 0, offset: 0, easing: 'ease-out' },
        { ...start, opacity: 1, offset: 0.14, easing: 'linear' },   // glyph card appears at the pile
        { ...start, opacity: 1, offset: 0.42, easing: 'cubic-bezier(.2,.8,.25,1)' },  // holds as a small glowing outline
        { ...base, opacity: 1, offset: 1 },       // then flies + grows + straightens into the slot
      ], opts);
      frame.animate([
        { boxShadow: '0 0 18px rgba(127,230,163,0.8), inset 0 0 14px rgba(127,230,163,0.26)', borderColor: 'rgba(182,255,207,0.98)', offset: 0 },
        { boxShadow: '0 0 18px rgba(127,230,163,0.8), inset 0 0 14px rgba(127,230,163,0.26)', borderColor: 'rgba(182,255,207,0.98)', offset: 0.42 },
        { boxShadow: '0 0 10px rgba(127,230,163,0.3), inset 0 0 6px rgba(127,230,163,0.08)', borderColor: 'rgba(130,230,166,0.55)', offset: 1 },
      ], opts);
      clone.animate([
        { opacity: 0, offset: 0 }, { opacity: 0, offset: 0.46 },
        { opacity: 1, offset: 0.84 }, { opacity: 1, offset: 1 },
      ], opts);
    });

    const total = MORPH_MS + (frames.length - 1) * STAGGER;
    const timer = setTimeout(() => this._finishDraftMorph(), Math.max(0, total - 70));
    this._draftMorph = { frames: frames.map((x) => x.frame), cardEls, timer };
  }

  // Scrolling row (phone portrait): the icon reads, then the whole panel expands
  // out of it as the glyph dissolves.
  _draftIconThenExpand(origin, el, frames) {
    const APPEAR = 200, HOLD = 380, FADE = 340, life = APPEAR + HOLD + FADE;
    frames.forEach(({ frame }, i) => {
      frame.animate([
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: APPEAR / life },
        { opacity: 1, offset: (APPEAR + HOLD) / life },
        { opacity: 0, offset: 1 },
      ], { duration: life, delay: i * 60, easing: 'ease-in-out', fill: 'both' });
    });
    const aux = setTimeout(() => { el.style.opacity = ''; this._playOfferExpand(origin); }, APPEAR + HOLD * 0.72);
    const total = life + (frames.length - 1) * 60;
    const timer = setTimeout(() => { frames.forEach(({ frame }) => frame.remove()); this._draftMorph = null; }, total + 80);
    this._draftMorph = { frames: frames.map((x) => x.frame), cardEls: [], timer, aux };
  }

  // Hand off from the flying frames to the real (interactive) cards: cross-fade.
  _finishDraftMorph() {
    const dm = this._draftMorph;
    if (!dm) return;
    dm.cardEls.forEach((c) => {
      c.style.opacity = '';
      if (c.animate) c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
    });
    dm.frames.forEach((f) => {
      if (f.animate) { const a = f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' }); a.onfinish = () => f.remove(); }
      else f.remove();
    });
    clearTimeout(dm.timer);
    this._draftMorph = null;
  }

  _clearDraftMorph() {
    const dm = this._draftMorph;
    if (!dm) return;
    clearTimeout(dm.timer);
    if (dm.aux) clearTimeout(dm.aux);
    dm.frames.forEach((f) => f.remove());
    dm.cardEls.forEach((c) => { c.style.opacity = ''; });
    this._draftMorph = null;
  }

  // Fallback: expand the whole panel out of the pile point (narrow / reduced-motion).
  _playOfferExpand(origin) {
    const el = this.el.offer;
    const box = el && el.querySelector('.offerbox');
    if (!box || !box.animate) return;
    if (this._reducedMotion()) return;
    const br = box.getBoundingClientRect();
    const dx = origin.x - (br.left + br.width / 2), dy = origin.y - (br.top + br.height / 2);
    try {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
      box.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(0.10)`, opacity: 0 },
        { transform: `translate(${dx * 0.22}px, ${dy * 0.22}px) scale(0.62)`, opacity: 1, offset: 0.55 },
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
      ], { duration: 380, easing: 'cubic-bezier(.2,.85,.3,1)' });
    } catch (e) {}
  }

  // Highlight a draft choice (tap again to deselect); the "Draft Card" button
  // then confirms it. No full rebuild — just repaint the selection + preview.
  armOffer(name) {
    this.armedOffer = this.armedOffer === name ? null : name;
    this._paintOffer();
  }
  _paintOffer() {
    const el = this.el.offer;
    if (!el) return;
    el.querySelectorAll('.offercard').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.name === this.armedOffer);
    });
    const confirm = el.querySelector('#offerconfirm');
    if (confirm) confirm.disabled = !this.armedOffer;
    const prev = el.querySelector('#offerpreview');
    if (prev) {
      // Preview what a +5 draw-engine card grants: just the granted card's name +
      // function (e.g. "Foraging Fan: Grow 1 step: every direction").
      const adds = this.armedOffer ? cardDeckAdditions(this.armedOffer) : null;
      if (adds) {
        const ac = CARD_BY_NAME[adds.name] || { effect: '' };
        prev.innerHTML = `<div class="hpdesc"><b class="hpname">${escapeHtml(adds.name)}</b>: ${escapeHtml(ac.effect || '')}</div>`;
        prev.classList.remove('hidden');
      } else {
        prev.classList.add('hidden');
        prev.innerHTML = '';
      }
    }
  }
  confirmOffer() {
    if (!this.armedOffer) return;
    const name = this.armedOffer;
    this.armedOffer = null;
    this.handlers.onChooseCard(name);
  }
  // Draft a specific card straight to hand (double-click shortcut).
  pickOffer(name) {
    const off = this.state.cards && this.state.cards.pendingOffers && this.state.cards.pendingOffers[0];
    if (!off || !off.choices.includes(name)) return;
    this.armedOffer = null;
    this.handlers.onChooseCard(name);
  }

  // --- tempo-upgrade picker ------------------------------------------------
  // A tempo card (e.g. Impulse Relay) speeds up ONE chosen installed ability.
  // `eligible` is [{ i, name, every }] — abilities still waiting >1 round, `i`
  // is the index into cards.actions / cards.engines. Tapping a row replays the
  // card with that index; Cancel / backdrop dismisses without spending it.
  showAbilityPicker(handIndex, scope, amount, eligible) {
    const el = this.el.pick;
    if (!el) return;
    const noun = scope === 'action' ? 'action' : 'engine';
    const rows = eligible.map((a) => {
      const next = Math.max(1, a.every - amount);
      const rd = (n) => `${n} round${n > 1 ? 's' : ''}`;
      return `<button class="pickrow" data-i="${a.i}">`
        + `<span class="picknm">${escapeHtml(a.name)}</span>`
        + `<span class="pickwait"><span class="pw-old">${rd(a.every)}</span>`
        + `<span class="pw-arrow">→</span><span class="pw-new">${rd(next)}</span></span>`
        + `</button>`;
    }).join('');
    el.innerHTML = `<div class="offerbox pickbox">`
      + `<h2>Speed up which ${escapeHtml(noun)}?</h2>`
      + `<div class="picksub">−${amount} round${amount > 1 ? 's' : ''} between uses · permanent</div>`
      + `<div class="pickrows">${rows}</div>`
      + `<div class="offerfooter"><button class="btn" id="pickcancel">Cancel</button></div>`
      + `</div>`;
    el.querySelectorAll('.pickrow').forEach((btn) => {
      btn.onclick = () => this.handlers.onPickAbility(handIndex, +btn.dataset.i);
    });
    const cancel = el.querySelector('#pickcancel');
    if (cancel) cancel.onclick = () => this.handlers.onCancelAbilityPick();
    // Backdrop tap (outside the box) also cancels.
    el.onclick = (e) => { if (e.target === el) this.handlers.onCancelAbilityPick(); };
    el.classList.remove('hidden');
  }
  hideAbilityPicker() {
    const el = this.el.pick;
    if (el) { el.classList.add('hidden'); el.innerHTML = ''; el.onclick = null; }
  }

  // --- select / play flow --------------------------------------------------
  // Tapping a card just HIGHLIGHTS it (no popup). The bottom action bar's "Play
  // Card" button plays the highlighted card. The carousel stays visible whether
  // or not a card is played — only the Show/Hide button toggles it. The only
  // popup is a text preview of what a draw-engine (+5) card shuffles in.
  //
  // A DOUBLE tap / double click on the same card plays it straight away (a
  // shortcut past the select-then-Play step). We detect it manually off the
  // single `click` so it behaves identically on mouse and touch — a native
  // `dblclick` would fight the single-tap select/deselect toggle below.
  onCardTap(index, name) {
    const now = Date.now();
    const last = this._lastCardTap;
    const isDouble = last && last.name === name && now - last.t < 320;
    this._lastCardTap = isDouble ? null : { name, t: now };
    if (isDouble) {
      // Arm the intended card, then play it. playArmed() resolves the live hand
      // index by name at play time, so the stored index can't go stale on us.
      this.armed = { kind: 'hand', index, name };
      this.playArmed();
      return;
    }
    this.armCard(index, name);
  }
  armCard(index, name) {
    // tap the already-selected card again to deselect it (match by NAME — the
    // stored index is a group firstIndex and can go stale as the hand mutates)
    if (this.armed && this.armed.name === name) { this.clearArmed(); return; }
    this.armed = { kind: 'hand', index, name };
    this._paintArmed();
    this._renderHandFooter();
  }
  clearArmed() {
    this.armed = null;
    this._paintArmed();
    this._renderHandFooter();
  }
  playArmed() {
    if (!this.armed) return;
    // Resolve the current hand index by NAME at play time — never trust the
    // stored index, which can be stale after the hand splices (e.g. a pending
    // targeted card resolving on the map shifts every later index down).
    const idx = this.state.cards.hand.findIndex((h) => h.name === this.armed.name);
    if (idx < 0) { this.clearArmed(); return; }
    const ok = this.handlers.onPlayCard(idx);   // false if blocked (e.g. can't afford)
    if (ok) this.clearArmed();   // deselect on a real play; leave the carousel visible
  }

  // Highlight the selected (or aiming) card in the carousel without a full rebuild.
  _paintArmed() {
    const list = this.el.handlist;
    if (!list) return;
    list.querySelectorAll('.cardbtn').forEach((btn) => {
      const nm = btn.getAttribute('data-name');
      const on = (this.armed && this.armed.name === nm) || (this.pendingCard && this.pendingCard.name === nm);
      btn.classList.toggle('selected', !!on);
    });
  }

  // Footer state: enable Play when a card is selected, and show the text-only
  // deck-additions preview for draw-engine (+5) cards.
  _renderHandFooter() {
    const play = this.el.handplay, prev = this.el.handpreview;
    const armed = this.armed && this.armed.kind === 'hand' ? this.armed : null;
    // The Play Card button just enables/disables — the cost already shows on the
    // card face in the carousel, so we don't repeat it on the button.
    if (play) play.disabled = !armed;
    if (!prev) return;
    const adds = armed ? cardDeckAdditions(armed.name) : null;
    if (adds) {
      const ac = CARD_BY_NAME[adds.name] || { effect: '' };
      prev.innerHTML = `<div class="hpdesc"><b class="hpname">${escapeHtml(adds.name)}</b>: ${escapeHtml(ac.effect || '')}</div>`;
      prev.classList.remove('hidden');
    } else {
      prev.classList.add('hidden');
      prev.innerHTML = '';
    }
  }

  _renderLog() {
    const list = this.el.loglist;
    if (!list) return;
    const entries = this.state.logEntries.slice(-40);
    list.innerHTML = entries
      .map((e) => `<div class="le ${e.kind}"><span class="t">T${e.turn}</span> ${escapeHtml(e.message)}</div>`)
      .join('');
    list.scrollTop = list.scrollHeight;
  }
}

// --- DOM helpers ------------------------------------------------------------
function div(cls) { const d = document.createElement('div'); d.className = cls; return d; }
function span(t, cls) { const s = document.createElement('span'); s.className = cls; s.textContent = t; return s; }
function button(cls, html) { const b = document.createElement('button'); b.className = cls; b.innerHTML = html; return b; }
function text(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// --- installed-engine ledger helpers ---------------------------------------
// Group installed engines by their output, summing duplicates (×N) and splitting
// steady (per-round) from cadenced (every-N) income so the ledger can show a range.
function summarizeEngines(engines) {
  const mk = () => ({ steady: 0, cad: 0, rows: new Map() });
  const out = { energy: mk(), water: mk(), phosphorus: mk(), timed: [], mods: [] };
  for (const e of engines) {
    const res = e.energy ? 'energy' : e.water ? 'water' : e.phosphorus ? 'phosphorus' : null;
    if (res) {
      const amt = e[res], cad = (e.every && e.every > 1) ? e.every : 1, g = out[res];
      if (cad > 1) g.cad += amt; else g.steady += amt;
      const key = e.name + '|' + cad, row = g.rows.get(key) || { name: escapeHtml(e.name), raw: e.name, amt: 0, n: 0, cad, left: cad };
      row.amt += amt; row.n += 1;
      // Rounds until this producer next fires (soonest across any duplicates).
      // `_et` counts ticks since its last payout, so `cad - _et` rounds remain.
      if (cad > 1) row.left = Math.min(row.left, cad - (e._et || 0));
      g.rows.set(key, row);
    } else if (e.digEvery) {
      out.timed.push({ name: escapeHtml(e.name), raw: e.name, every: e.digEvery, left: Math.max(0, e.digEvery - (e._t || 0)) });
    } else if (e.drawDiscount) {
      out.mods.push({ name: escapeHtml(e.name), raw: e.name, text: `draws −${e.drawDiscount}⚡` });
    }
  }
  return out;
}

// Cadence display shared by the LEFT ledger and the RIGHT actions menu, so round
// times read identically on both corners: a steady per-round item shows "/rd"; a
// cadenced one shows `cad` dots with `lit` of them on. For a producer/auto, `lit`
// = rounds remaining until its next payout/fire. For a player action it's a CHARGE
// meter — full = ready to use (so a freshly-installed, usable action shows all dots
// lit), draining to empty right after a use and refilling as the cooldown ticks.
// `ck` tints the lit dots: 'e'/'w'/'p' by resource, 't' for a timed ability.
function cadenceLightsHTML(cad, lit, ck = 't', title) {
  if (!cad || cad <= 1) return `<span class="ecad">/rd</span>`;
  let dots = '';
  for (let i = 0; i < cad; i++) dots += `<i class="clight${i < lit ? ' on' : ''}"></i>`;
  const t = title != null ? title : `every ${cad} rounds · ${lit} left`;
  return `<span class="ecad cad ck-${ck}" title="${t}">${dots}</span>`;
}

// --- actions-menu row -------------------------------------------------------
const ACT_GLYPH = { energy: '⚡', water: '💧', phosphorus: '✦' };
const ACT_DOT = { energy: 'e', water: 'w', phosphorus: 'p' };
function actionRowHTML(a, i, state) {
  const usable = actionUsable(state, a);
  const meta = [];
  if (a.cost) meta.push(`<span class="acost ${ACT_DOT[a.res]}">${a.cost}${ACT_GLYPH[a.res]}</span>`);
  if (a.per) meta.push(`<span class="aleft">${(a.per - (a.used || 0))} / ${a.per} left</span>`);
  // Round time as a CHARGE meter (same widget as the left ledger): full = ready to
  // use, so an installed/off-cooldown action shows all dots lit. `cd` counts down
  // from `every` (just used) to 0 (ready), so lit = every − cd fills as it recharges.
  if (a.every) meta.push(cadenceLightsHTML(a.every, a.every - (a.cd || 0), a.cost ? ACT_DOT[a.res] : 't', (a.cd || 0) > 0 ? `ready in ${a.cd}` : 'ready'));
  const dot = a.cost ? ACT_DOT[a.res] : (a.every ? 't' : 'e');
  return `<div class="actrow${usable ? '' : ' off'}" data-card="${escapeHtml(a.name)}">`
    + `<span class="edot ${dot}"></span>`
    + `<div class="acttxt"><div class="actnm">${escapeHtml(a.name)}</div>`
    + `<div class="acteff">${escapeHtml(a.effect || '')}</div>`
    + (meta.length ? `<div class="actmeta">${meta.join('')}</div>` : '')
    + `</div>`
    + `<button class="use${usable ? '' : ' off'}" data-i="${i}"${usable ? '' : ' disabled'}>Use</button></div>`;
}
// An AUTOMATIC ability (a timed dig engine like Tap-Root Rhizomorph): it fires on
// its own cadence, so it shows the same countdown lights + an "auto" tag instead
// of a Use button.
function autoActionRowHTML(t) {
  return `<div class="actrow auto" data-card="${escapeHtml(t.raw || t.name)}">`
    + `<span class="edot t"></span>`
    + `<div class="acttxt"><div class="actnm">${escapeHtml(t.name)}</div>`
    + `<div class="acteff">clears a rock formation/column</div>`
    + `<div class="actmeta">${cadenceLightsHTML(t.every, t.left != null ? t.left : t.every, 't')}</div></div>`
    + `<span class="autotag">auto</span></div>`;
}
// Card art slug — MUST match scripts/gen_card_art.py (lowercase, non-alphanumeric -> '-').
export function cardSlug(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
// The art window: a bespoke image per card; if it's missing the dark gradient shows
// through. Loaded eagerly (not lazy) and preloaded at boot (main.js) so the faces
// don't pop in one by one when a draft or the hand opens.
function cardArt(name) {
  return `<span class="cart"><img class="caimg" draggable="false" src="assets/cards/${cardSlug(name)}.jpg" alt="" onerror="this.style.display='none'"></span>`;
}
// Card -> filter groups. A card can belong to SEVERAL filters. Two kinds of tag:
//  • a VERB tag (what you DO with the card) that partitions every card, so nothing
//    is ever uncategorised ("Other"): anything you INSTALL (passive engines AND
//    activated abilities — types engine + action) -> Engine; deck/draw engines
//    (extenders) -> Draw; everything else (one-shot plays) -> Action.
//  • EFFECT tags (what the card AFFECTS) from its category/family — cross-cutting,
//    zero or more per card (Grow, Substrate, Water, Mineral, Energy, Defense).
const GROUP_LABELS = { engine: 'Engine', action: 'Action', draw: 'Draw', grow: 'Grow',
  substrate: 'Substrate', water: 'Water', mineral: 'Mineral', energy: 'Energy', defense: 'Defense' };
const GROUP_ORDER = ['engine', 'action', 'draw', 'grow', 'substrate', 'water', 'mineral', 'energy', 'defense'];
function cardGroups(c) {
  const t = c.type || '', cat = (c.category || '').toLowerCase(), fam = (c.family || '').toLowerCase();
  const keys = new Set();
  if (t === 'engine' || t === 'action') keys.add('engine');       // you install it
  else if (t === 'extender') keys.add('draw');                    // a deck / draw engine
  else keys.add('action');                                        // a one-shot play
  if (/growth|mobility|routing|utility|finisher/.test(cat)) keys.add('grow');   // grows / digs / fruits the network
  if (cat.includes('substrate')) keys.add('substrate');
  if (fam === 'water' || cat.includes('water')) keys.add('water');
  if (fam === 'phosphorus' || cat.includes('phosphorus') || cat.includes('mineral')) keys.add('mineral');
  if (fam === 'energy' || cat.includes('energy')) keys.add('energy');
  if (fam === 'defense' || /defense|anti-/.test(cat)) keys.add('defense');
  return [...keys].map((k) => ({ key: k, label: GROUP_LABELS[k] }));
}
// Themed cost pips (Energy / Water / Phosphorus).
function gateChips(c) {
  const g = [];
  if (c.buyCostEnergy) g.push(`<span class="cc e">${c.buyCostEnergy}⚡</span>`);
  // Action cards install for Energy only; their W/P is a per-activation cost shown
  // in the Actions menu (not an install gate), so don't imply it on the card face.
  if (c.type !== 'action') {
    if (c.costW) g.push(`<span class="cc w">${c.costW}${RES_ICON.water}</span>`);
    if (c.costP) g.push(`<span class="cc p">${c.costP}${RES_ICON.phos}</span>`);
  }
  return g.join('');
}
// One portrait card face: framed art window + cost pips + name plate + FULL rules.
function cardFaceHTML(name, c, count) {
  return cardArt(name)
    + (count > 1 ? `<span class="stackn">×${count}</span>` : '')
    + `<span class="pips">${gateChips(c) || '<span class="cc free">free</span>'}</span>`
    + `<span class="cplate"><span class="cn">${escapeHtml(name)}</span><span class="ct">${escapeHtml(c.type || '')}</span></span>`
    + `<span class="crules">${escapeHtml(c.effect || '')}</span>`;
}
function vitalityColor(v) {
  const r = Math.round(200 - v * 140), g = Math.round(70 + v * 150), b = Math.round(60 + v * 40);
  return `rgb(${r},${g},${b})`;
}
