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
import { cardDeckAdditions, cardNeedsTarget } from '../engine/cards.js';

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

    // ---- Top-left HUD ----
    const hud = div('panel hud');
    const resStats = cardsOn ? `
        <div class="stat res-w"><span class="k">Water</span><span class="v" id="hud-water">0</span></div>
        <div class="stat res-p"><span class="k">Phos</span><span class="v" id="hud-phosphorus">0</span></div>`
      : `<div class="stat"><span class="k">Spores</span><span class="v" id="hud-spores">0</span></div>`;
    const build = (typeof globalThis !== 'undefined' && globalThis.__BUILD__) ? globalThis.__BUILD__ : 'dev';
    hud.innerHTML = `
      <div class="title">MYCELIUM <span class="sub">· cards · <span id="hud-build">${build}</span></span></div>
      <div class="stats">
        <div class="stat"><span class="k">Energy</span><span class="v" id="hud-energy">0</span></div>
        ${resStats}
        <div class="stat"><span class="k">Step</span><span class="v" id="hud-turn">1</span></div>
      </div>
      <div class="vitality"><span class="k">Healthy</span>
        <div class="bar"><div class="fill" id="hud-vitality"></div></div>
      </div>
    `;
    root.appendChild(hud);

    // (Map legend panel removed.)

    // ---- Bottom action bar ----
    const bar = div('panel actionbar');
    this.el.buttons = {};

    // Old always-available actions: only when the card layer is OFF (cards replace them).
    if (!cardsOn) {
      const order = ['grow', 'addSubstrate', 'amputate', 'attackAnts', 'excrete', 'digest', 'fruit'];
      for (const name of order) bar.appendChild(this._actionButton(name));
    } else {
      // Draw + Skip drive the card round.
      const drawBtn = button('btn deckbtn', 'Draw');
      drawBtn.onclick = () => this.handlers.onDraw();
      const skipBtn = button('btn deckbtn', 'Skip');
      skipBtn.onclick = () => this.handlers.onSkip();
      this.el.drawBtn = drawBtn; this.el.skipBtn = skipBtn;
      bar.appendChild(drawBtn); bar.appendChild(skipBtn);
    }

    // New map + puzzle (no End Turn — there are no turns; you just keep acting)
    const ctrl = div('ctrl');
    const restartBtn = button('btn restart', 'New Map ↻');
    restartBtn.onclick = () => this.handlers.onRestart();
    const puzzleBtn = button('btn restart', 'Puzzle 🧩');
    puzzleBtn.onclick = () => this.handlers.onPuzzle();
    ctrl.appendChild(restartBtn);
    ctrl.appendChild(puzzleBtn);
    bar.appendChild(ctrl);

    root.appendChild(bar);

    // ---- Hand bar (card layer) ----
    if (cardsOn) {
      const hand = div('panel handbar' + (this.handOpen ? ' open' : ''));
      hand.innerHTML =
        // Header (phone only): tap to expand/collapse the carousel + a chip
        // showing which card is currently selected/aiming.
        `<div class="handhead">`
        + `<button class="handtoggle" id="handtoggle" aria-label="Show or hide your hand">`
        + `<span class="htchev">${this.handOpen ? '▾' : '▴'}</span><span class="htlabel">Hand</span>`
        + `<span class="htcount" id="htcount">0</span></button>`
        + `<div class="handsel hidden" id="handsel"></div>`
        + `</div>`
        + `<div class="handbody" id="handbody">`
        + `<div class="handfilter" id="handfilter"></div>`
        + `<div class="handcarousel">`
        + `<button class="handnav prev" id="handprev" aria-label="Previous cards">‹</button>`
        + `<div class="handlist" id="handlist"></div>`
        + `<button class="handnav next" id="handnext" aria-label="More cards">›</button>`
        + `</div>`
        + `</div>`;
      this.el.handbar = hand;
      this.el.handlist = hand.querySelector('#handlist');
      this.el.handfilter = hand.querySelector('#handfilter');
      this.el.handsel = hand.querySelector('#handsel');
      this.el.htcount = hand.querySelector('#htcount');
      const scrollByCard = (dir) => {
        const t = this.el.handlist; if (!t) return;
        const card = t.querySelector('.cardbtn');
        const step = card ? card.offsetWidth + 8 : t.clientWidth * 0.8;
        t.scrollBy({ left: dir * step, behavior: 'smooth' });
      };
      hand.querySelector('#handprev').onclick = () => scrollByCard(-1);
      hand.querySelector('#handnext').onclick = () => scrollByCard(1);
      hand.querySelector('#handtoggle').onclick = () => this.toggleHand();
      root.appendChild(hand);
    }

    // ---- Hint line ----
    this.el.hint = div('hint');
    this.defaultHint = cardsOn
      ? 'Draw pulls 3 basics (⚡). Playing a premium card costs its ⚡ + any W/P gate. Water = grow + substrate · Phosphorus = digest/defense/actions (harvest it from rocks). Finish a food pile to draft a card. Reach the goal to win.'
      : 'Hover an action for details. Grow extends the network toward sensed food.';
    this.el.hint.textContent = this.defaultHint;
    root.appendChild(this.el.hint);

    // ---- Right column: event log ----
    const logPanel = div('panel logpanel');
    logPanel.innerHTML = `<div class="title">Event Log</div><div class="loglist" id="loglist"></div>`;
    root.appendChild(logPanel);
    this.el.loglist = logPanel.querySelector('#loglist');

    // ("What we're testing" panel removed.)

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
      // Confirm/preview overlay: arm a card (hand or draft) → see what it does
      // (incl. any cards it shuffles into your deck) → Confirm to commit.
      this.el.confirm = div('offer confirm hidden');
      root.appendChild(this.el.confirm);
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

  // Collapsible hand tray (phones). Desktop keeps it open and hides the toggle.
  setHandOpen(open) {
    this.handOpen = open;
    if (this.el.handbar) this.el.handbar.classList.toggle('open', open);
    const chev = this.el.handbar && this.el.handbar.querySelector('.htchev');
    if (chev) chev.textContent = open ? '▾' : '▴';
  }
  toggleHand() { this.setHandOpen(!this.handOpen); }
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
    text('hud-turn', s.turn);
    const vfill = document.getElementById('hud-vitality');
    if (vfill) {
      vfill.style.width = `${Math.round(net.vitality * 100)}%`;
      vfill.style.background = vitalityColor(net.vitality);
    }

    // Card layer: resources, hand, draw/skip.
    if (this.cardsOn && s.cards) {
      text('hud-water', Math.floor(net.water || 0));
      text('hud-phosphorus', Math.floor(net.phosphorus || 0));
      this._renderHand();
      const cc = s.config.cards;
      const drawE = Math.max(1, cc.drawCostEnergy - (s.cards.drawDiscount || 0));
      const drawN = Math.min(cc.drawCount || 1, s.cards.drawDeck.length);
      if (this.el.drawBtn) {
        this.el.drawBtn.innerHTML = `Draw ${drawN || (cc.drawCount || 1)} <span class="cost">${drawE}⚡</span> <span class="deckn">${s.cards.drawDeck.length} left</span>`;
        this.el.drawBtn.disabled = s.runOver || !net.alive || !s.cards.drawDeck.length || net.energy < drawE;
      }
      if (this.el.skipBtn) {
        this.el.skipBtn.innerHTML = `Skip <span class="cost">${cc.skipCostEnergy}⚡</span>`;
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
    if (this.el.htcount) this.el.htcount.textContent = s.cards.hand.length;
    this._renderHandSelection();

    // STACK: group identical cards by name; keep the first hand index to play.
    const groups = new Map();
    s.cards.hand.forEach((h, i) => {
      let g = groups.get(h.name);
      if (!g) { g = { name: h.name, card: CARD_BY_NAME[h.name] || { costW: 0, costP: 0, buyCostEnergy: 0, effect: '', type: '' }, count: 0, firstIndex: i }; groups.set(h.name, g); }
      g.count++;
    });
    const all = [...groups.values()];

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
      btn.onclick = () => this.armOffer(btn.dataset.name);
    });
    this._renderConfirm();
  }

  // --- arm / confirm flow --------------------------------------------------
  // Clicking a card (hand or draft) ARMS it: a confirm overlay shows what it
  // does — including any cards it shuffles into your deck — before you commit.
  armCard(index, name) { this.armed = { kind: 'hand', index, name }; this._renderConfirm(); this._renderHand(); }
  armOffer(name) { this.armed = { kind: 'offer', name }; this._renderConfirm(); }
  clearArmed() {
    this.armed = null;
    if (this.el.confirm) { this.el.confirm.classList.add('hidden'); this.el.confirm.innerHTML = ''; }
    this._renderHand();
  }

  _renderConfirm() {
    const el = this.el.confirm;
    if (!el) return;
    if (!this.armed) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const name = this.armed.name;
    const c = CARD_BY_NAME[name] || { costW: 0, costP: 0, buyCostEnergy: 0, effect: '', type: '' };
    const isOffer = this.armed.kind === 'offer';
    const adds = cardDeckAdditions(name);
    let addHTML = '';
    if (adds) {
      const ac = CARD_BY_NAME[adds.name] || { costW: 0, costP: 0, buyCostEnergy: 0, effect: '', type: '' };
      addHTML = `<p class="dim small addslabel">Shuffles ${adds.count} of these into your draw deck:</p>`
        + `<div class="offerrow"><div class="offercard static">${cardFaceHTML(adds.name, ac, adds.count)}</div></div>`;
    }
    const doLabel = isOffer ? 'Take card' : (cardNeedsTarget(name) ? 'Aim on map' : 'Play card');
    el.innerHTML = `<div class="offerbox confirmbox">`
      + `<h2>${isOffer ? 'Draft this card?' : 'Play this card?'}</h2>`
      + `<div class="offerrow"><div class="offercard static">${cardFaceHTML(name, c, isOffer ? 0 : 0)}</div></div>`
      + addHTML
      + `<div class="confirmbtns"><button class="btn big confirmyes">${doLabel}</button>`
      + `<button class="btn confirmno">Cancel</button></div>`
      + `</div>`;
    el.classList.remove('hidden');
    el.onclick = (e) => { if (e.target === el) this.clearArmed(); };  // tap backdrop = cancel
    el.querySelector('.confirmyes').onclick = () => {
      const armed = this.armed;
      this.clearArmed();
      if (!armed) return;
      if (armed.kind === 'offer') this.handlers.onChooseCard(armed.name);
      else this.handlers.onPlayCard(armed.index);
    };
    el.querySelector('.confirmno').onclick = () => this.clearArmed();
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
