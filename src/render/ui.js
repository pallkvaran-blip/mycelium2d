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
import { cardDeckAdditions } from '../engine/cards.js';

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
    this.armed = null;                // {kind:'hand'|'offer', index?, name} a card awaiting Confirm
    this.handFilter = 'all';          // active card-hand filter group key
    this.handOpen = !this._isNarrow();// phones start with the hand tray collapsed
    this.defaultHint = '';            // cached card-mode hint, restored on cancel
    this.el = {};
    this._build();
    this._watchViewport();
  }

  // Keep the hand tray consistent when the viewport crosses the narrow↔wide
  // breakpoint (e.g. a desktop window dragged out from a narrow width). The tray
  // is shown only via the .open class now, so widening past the breakpoint must
  // re-open it or the carousel stays stuck hidden. Narrowing never force-closes.
  _watchViewport() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const onChange = () => { if (!this._isNarrow() && !this.handOpen) this.setHandOpen(true); };
    const mqs = [window.matchMedia('(max-width: 760px)'),
                 window.matchMedia('(orientation: landscape) and (max-height: 520px)')];
    for (const mq of mqs) {
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  // Mouse drag-to-scroll for the carousel (touch already scrolls natively). A
  // real drag suppresses the trailing click so it doesn't accidentally arm a card.
  _enableDragScroll(el) {
    if (!el) return;
    let down = false, startX = 0, startScroll = 0, moved = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;   // let touch scroll natively
      down = true; startX = e.clientX; startScroll = el.scrollLeft; moved = 0;
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      el.scrollLeft = startScroll - dx;
    });
    const end = () => { down = false; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
    // Capture-phase: cancel the click after a >6px drag before it reaches a card.
    el.addEventListener('click', (e) => {
      if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; }
    }, true);
  }

  // Small screens (phone portrait or short landscape) use the collapsible hand
  // tray + card-selection flow; desktop keeps the always-open hand.
  _isNarrow() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(max-width: 760px)').matches
        || window.matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
  }

  setState(state) { this.state = state; }

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
      ? `<span class="res e"><span class="rk">⚡</span><span class="rv" id="hud-energy">0</span></span>`
        + `<span class="res w"><span class="rk">W</span><span class="rv" id="hud-water">0</span></span>`
        + `<span class="res p"><span class="rk">P</span><span class="rv" id="hud-phosphorus">0</span></span>`
      : `<span class="res e"><span class="rk">⚡</span><span class="rv" id="hud-energy">0</span></span>`
        + `<span class="res"><span class="rk">spores</span><span class="rv" id="hud-spores">0</span></span>`;
    hud.innerHTML =
      `<div class="resrow">${resRow}`
      + `<button class="logbtn" id="logbtn" aria-label="Event log">Log <span class="lchev">▾</span></button>`
      + `</div>`
      + `<div class="logdrop hidden" id="logdrop"><div class="loglist" id="loglist"></div></div>`;
    root.appendChild(hud);
    this.el.logdrop = hud.querySelector('#logdrop');
    this.el.loglist = hud.querySelector('#loglist');
    hud.querySelector('#logbtn').onclick = () => this.toggleLog();

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
      const handBtn = button('btn handbtn abtn', `<span class="blabel">Show Hand</span>`);
      handBtn.onclick = () => this.toggleHand();
      this.el.handbtn = handBtn;

      const drawBtn = button('btn deckbtn abtn', 'Draw');
      drawBtn.onclick = () => this.handlers.onDraw();
      const skipBtn = button('btn deckbtn abtn', 'Skip');
      skipBtn.onclick = () => this.handlers.onSkip();
      this.el.drawBtn = drawBtn; this.el.skipBtn = skipBtn;

      const playBtn = button('btn playbtn abtn', `<span class="blabel">Play Card</span><span class="bcost"></span>`);
      playBtn.id = 'handplay';
      playBtn.disabled = true;
      playBtn.onclick = () => this.playArmed();
      this.el.handplay = playBtn;

      const left = div('abgroup left'); left.appendChild(handBtn);
      const centre = div('abgroup centre'); centre.appendChild(drawBtn); centre.appendChild(skipBtn);
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
        // Drag-to-scroll carousel (no nav buttons — drag on phone and desktop).
        + `<div class="handcarousel">`
        + `<div class="handlist" id="handlist"></div>`
        + `</div>`
        // Text-only preview — shown ONLY when a draw-engine (+5) card is selected.
        + `<div class="handpreview hidden" id="handpreview"></div>`
        + `</div>`;
      this.el.handbar = hand;
      this.el.handlist = hand.querySelector('#handlist');
      this.el.handfilter = hand.querySelector('#handfilter');
      this.el.handsel = hand.querySelector('#handsel');
      this.el.handpreview = hand.querySelector('#handpreview');
      this._enableDragScroll(this.el.handlist);
      root.appendChild(hand);
      this.setHandOpen(this.handOpen);   // sync the Show Hand chevron + open class
    }

    // ---- Hint line ----
    this.el.hint = div('hint');
    this.defaultHint = cardsOn
      ? 'Draw pulls 3 basics (⚡). Playing a premium card costs its ⚡ + any W/P gate. Water = grow + substrate · Phosphorus = digest/defense/actions (harvest it from rocks). Finish a food pile to draft a card. Reach the goal to win.'
      : 'Hover an action for details. Grow extends the network toward sensed food.';
    this.el.hint.textContent = this.defaultHint;
    root.appendChild(this.el.hint);

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
    }
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

  // Event-log drop-down (top HUD). Auto-opens on an error (openLog).
  toggleLog() { this.setLogOpen(this.el.logdrop ? this.el.logdrop.classList.contains('hidden') : false); }
  setLogOpen(open) {
    if (!this.el.logdrop) return;
    this.el.logdrop.classList.toggle('hidden', !open);
    const chev = document.querySelector('.logbtn .lchev');
    if (chev) chev.textContent = open ? '▴' : '▾';
    if (open) this._renderLog();
  }
  openLog() { this.setLogOpen(true); }
  // Minimize the carousel so the map is visible (only meaningful on small screens).
  collapseHand() { if (this._isNarrow()) this.setHandOpen(false); }
  expandHand() { if (this._isNarrow()) this.setHandOpen(true); }

  // The "selected card" chip in the hand header — makes it clear which card is
  // armed while the carousel is minimized and you're aiming on the map.
  _renderHandSelection() {
    const el = this.el.handsel;
    if (!el) return;
    if (this.pendingCard) {
      el.classList.remove('hidden');
      el.innerHTML = `<span class="hslabel">Aiming</span><span class="hsname"></span>`
        + `<button class="hscancel" aria-label="Cancel selection">✕</button>`;
      el.querySelector('.hsname').textContent = this.pendingCard.name;
      el.querySelector('.hscancel').onclick = (e) => {
        e.stopPropagation();
        if (this.handlers.onCancelCard) this.handlers.onCancelCard();
      };
    } else {
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  }

  setHint(text) { this.el.hint.textContent = text; }
  resetHint() { this.el.hint.textContent = this.defaultHint; }

  showOverlay(result) {
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
      this._renderHand();
      const cc = s.config.cards;
      const drawE = Math.max(1, cc.drawCostEnergy - (s.cards.drawDiscount || 0));
      const drawN = Math.min(cc.drawCount || 1, s.cards.drawDeck.length);
      if (this.el.drawBtn) {
        this.el.drawBtn.innerHTML = `<span class="blabel">Draw ${drawN || (cc.drawCount || 1)}</span><span class="bcost">${drawE}⚡</span>`;
        this.el.drawBtn.disabled = s.runOver || !net.alive || !s.cards.drawDeck.length || net.energy < drawE;
      }
      if (this.el.skipBtn) {
        this.el.skipBtn.innerHTML = `<span class="blabel">Skip</span><span class="bcost">${cc.skipCostEnergy}⚡</span>`;
        this.el.skipBtn.disabled = s.runOver || !net.alive || net.energy < cc.skipCostEnergy;
      }
      this._renderOffer();
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
    const filtered = this.handFilter === 'all' ? all : all.filter((g) => cardGroup(g.card).key === this.handFilter);

    const prevScroll = list.scrollLeft;
    if (!s.cards.hand.length) { list.innerHTML = '<div class="handempty">Hand empty — Draw a card (⚡) or Skip.</div>'; return; }
    list.innerHTML = '';
    if (!filtered.length) { list.innerHTML = '<div class="handempty">No cards in this filter.</div>'; return; }

    filtered.forEach((g) => {
      const c = g.card;
      const affordable = net.energy >= c.buyCostEnergy && net.water >= c.costW && net.phosphorus >= c.costP && !s.runOver && net.alive;
      const pending = this.pendingCard && this.pendingCard.name === g.name;
      const armed = this.armed && this.armed.kind === 'hand' && this.armed.name === g.name;
      const cls = 'cardbtn' + (affordable ? '' : ' unaff') + (pending || armed ? ' selected' : '');
      const b = button(cls, cardFaceHTML(g.name, c, g.count));
      b.setAttribute('data-name', g.name);
      b.title = c.effect;
      b.onclick = () => this.armCard(g.firstIndex, g.name);
      list.appendChild(b);
    });
    list.scrollLeft = prevScroll;   // keep carousel position across a re-render
  }

  // Filter chips: All + one per card group present in hand (with counts).
  _renderHandFilter(groups) {
    const fbar = this.el.handfilter;
    if (!fbar) return;
    const present = new Map();
    groups.forEach((g) => { const gr = cardGroup(g.card); const e = present.get(gr.key) || { key: gr.key, label: gr.label, n: 0 }; e.n += g.count; present.set(gr.key, e); });
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
  _renderOffer() {
    const el = this.el.offer;
    if (!el) return;
    const s = this.state;
    const off = !s.runOver && s.cards && s.cards.pendingOffers && s.cards.pendingOffers[0];
    if (!off) { el.classList.add('hidden'); return; }
    const cards = off.choices.map((name) => {
      const c = CARD_BY_NAME[name] || { costW: 0, costP: 0, buyCostEnergy: 0, effect: '', type: '' };
      return `<button class="offercard" data-name="${escapeHtml(name)}">` + cardFaceHTML(name, c, 0) + `</button>`;
    }).join('');
    const more = s.cards.pendingOffers.length - 1;
    el.innerHTML = `<div class="offerbox">`
      + `<h2>Pile digested — draft a card</h2>`
      + `<p class="dim small">It joins your hand for free. You still pay its ⚡ / W·P to play it.</p>`
      + `<div class="offerrow">${cards}</div>`
      + (more > 0 ? `<p class="dim small">${more} more draft${more > 1 ? 's' : ''} waiting.</p>` : '')
      + `</div>`;
    el.classList.remove('hidden');
    el.querySelectorAll('.offercard').forEach((btn) => {
      btn.onclick = () => this.handlers.onChooseCard(btn.dataset.name);
    });
  }

  // --- select / play flow --------------------------------------------------
  // Tapping a card just HIGHLIGHTS it (no popup). The footer "Play Card" button
  // plays the highlighted card; "Cancel" minimizes the carousel. The only popup
  // is a text preview of what a draw-engine (+5) card shuffles into your deck.
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
    if (ok) { this.clearArmed(); this.collapseHand(); }   // minimize so the map result shows
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
    if (play) {
      play.disabled = !armed;
      // Second row of the Play Card button shows the selected card's play cost.
      const costEl = play.querySelector('.bcost');
      if (costEl) {
        let txt = '';
        if (armed) {
          const c = CARD_BY_NAME[armed.name] || { buyCostEnergy: 0, costW: 0, costP: 0 };
          const parts = [];
          if (c.buyCostEnergy) parts.push(`${c.buyCostEnergy}⚡`);
          if (c.costW) parts.push(`${c.costW}W`);
          if (c.costP) parts.push(`${c.costP}P`);
          txt = parts.join(' ');   // basics cost nothing to play → row stays empty
        }
        costEl.textContent = txt;
      }
    }
    if (!prev) return;
    const adds = armed ? cardDeckAdditions(armed.name) : null;
    if (adds) {
      const ac = CARD_BY_NAME[adds.name] || { effect: '' };
      prev.innerHTML = `<div class="hplabel">Shuffles ${adds.count} × <b>${escapeHtml(adds.name)}</b> into your draw deck:</div>`
        + `<div class="hpdesc">${escapeHtml(ac.effect || '')}</div>`;
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
// Card art slug — MUST match scripts/gen_card_art.py (lowercase, non-alphanumeric -> '-').
function cardSlug(name) { return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
// The art window: a bespoke image per card; if it's missing the dark gradient shows through.
function cardArt(name) {
  return `<span class="cart"><img class="caimg" src="assets/cards/${cardSlug(name)}.jpg" alt="" loading="lazy" onerror="this.style.display='none'"></span>`;
}
// Card -> filter group (bucket). Used for the hand filter chips + stacking view.
const GROUP_ORDER = ['grow', 'substrate', 'digest', 'water', 'mineral', 'energy', 'engine', 'action', 'defense', 'extender', 'other'];
function cardGroup(c) {
  const t = c.type || '', cat = (c.category || '').toLowerCase(), fam = (c.family || '').toLowerCase();
  if (t === 'extender') return { key: 'extender', label: 'Draw' };
  if (cat.includes('growth')) return { key: 'grow', label: 'Grow' };
  if (cat.includes('substrate')) return { key: 'substrate', label: 'Substrate' };
  if (cat.includes('economy') || cat.includes('digest')) return { key: 'digest', label: 'Digest' };
  if (fam === 'water' || cat.includes('water')) return { key: 'water', label: 'Water' };
  if (fam === 'phosphorus' || cat.includes('phosphorus') || cat.includes('mineral')) return { key: 'mineral', label: 'Mineral' };
  if (fam === 'energy' || cat.includes('energy')) return { key: 'energy', label: 'Energy' };
  if (t === 'engine') return { key: 'engine', label: 'Engine' };
  if (cat.includes('defense') || cat.includes('anti')) return { key: 'defense', label: 'Defense' };
  if (t === 'event' || t === 'action') return { key: 'action', label: 'Action' };
  return { key: 'other', label: 'Other' };
}
// Themed cost pips (Energy / Water / Phosphorus).
function gateChips(c) {
  const g = [];
  if (c.buyCostEnergy) g.push(`<span class="cc e">${c.buyCostEnergy}⚡</span>`);
  if (c.costW) g.push(`<span class="cc w">${c.costW}W</span>`);
  if (c.costP) g.push(`<span class="cc p">${c.costP}P</span>`);
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
