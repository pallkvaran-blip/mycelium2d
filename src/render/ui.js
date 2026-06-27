// =============================================================================
// UI — HUD, action buttons, event log, dev tools, "what we're testing" panel.
//
// DOM-based overlay (buttons/sliders/log) on top of the canvas world view.
// Reads engine state; never mutates it directly — all changes go through the
// handlers wired up by main.js. Dev cheats + sliders are clearly marked for
// later removal (B7).
// =============================================================================

import { CARDS } from '../engine/cards.js';
import { SLIDERS, getByPath, setByPath } from '../config.js';

const TRAITS = [
  { key: 'melanize', label: 'Melanize', hint: 'armour; resists the initial mould contact' },
];

const TESTING_QUESTIONS = [
  'Does drawing a hand of cards (instead of free actions) make each turn a real decision?',
  'Is the deck — Grow / Digest / Amputate / substrate lures / engine cards — the right starting set?',
  'Is the grow-toward-rich-food-but-it\'s-dangerous (Trichoderma) tension fun?',
  'Do the engine-building cards feel worth drafting over more growth?',
  'Does card scarcity make navigating to food/the chest more interesting?',
];

export class UI {
  constructor(state, handlers) {
    this.state = state;
    this.handlers = handlers;
    this.selectedCard = null;   // a targeted card awaiting a board click
    this.el = {};
    this._build();
  }

  setState(state) { this.state = state; }

  _build() {
    const root = document.getElementById('ui');
    root.innerHTML = '';
    // On a phone-sized screen, start the secondary panels collapsed so the
    // living network stays the focus; they're one tap away.
    const narrow = window.innerWidth < 760;
    const maybeCollapsed = narrow ? ' collapsed' : '';

    // ---- Top-left HUD ----
    const hud = div('panel hud');
    hud.innerHTML = `
      <div class="title">MYCELIUM <span class="sub">· Phase 1</span></div>
      <div class="stats">
        <div class="stat"><span class="k">Energy</span><span class="v" id="hud-energy">0</span></div>
        <div class="stat"><span class="k">Spores</span><span class="v" id="hud-spores">0</span></div>
        <div class="stat"><span class="k">Turn</span><span class="v" id="hud-turn">1</span></div>
        <div class="stat"><span class="k">Deck</span><span class="v" id="hud-deck">0</span></div>
      </div>
      <div class="vitality"><span class="k">Healthy</span>
        <div class="bar"><div class="fill" id="hud-vitality"></div></div>
      </div>
      <div class="traits" id="hud-traits"></div>
    `;
    root.appendChild(hud);

    // ---- Map legend (keeps the cross-section legible) ----
    const legend = div('panel legend' + maybeCollapsed);
    const items = [
      ['#7c5326', 'Substrate (organic matter)'],
      ['#8aa23e', 'Trichoderma — infects your net'],
      ['radial-gradient(circle,rgba(150,190,70,0) 55%,rgba(150,190,70,0.5))', 'Mould sight range (soft ring)'],
      ['#5d574e', 'Rock — impassable'],
      ['#7a5d3c', 'Soil — fruitable'],
      ['#3a3d45', 'Non-soil — no fruiting'],
      ['linear-gradient(180deg,rgba(40,90,140,0),rgba(40,90,140,0.6))', 'Shade — more spores'],
    ];
    legend.innerHTML = `<div class="title clickable">Map legend <span class="chev">▾</span></div>` +
      `<div class="legend-body">` +
      items.map(([c, t]) => `<div class="li"><span class="sw" style="background:${c}"></span>${t}</div>`).join('') +
      `<div class="li note">Drag to pan · scroll to zoom · F to refit</div>` +
      `</div>`;
    legend.querySelector('.title').onclick = () => legend.classList.toggle('collapsed');
    root.appendChild(legend);

    // ---- Bottom bar: your HAND of cards + controls ----
    const bar = div('panel actionbar');
    this.el.hand = div('hand');           // populated each update() from state.hand
    bar.appendChild(this.el.hand);

    const ctrl = div('ctrl');
    const endBtn = button('btn end', 'End Turn ⏭');
    endBtn.onclick = () => this.handlers.onEndTurn();
    this.el.endBtn = endBtn;
    const fruitBtn = button('btn', 'Fruit 🍄');
    fruitBtn.title = 'Push up fruiting bodies for Spores — ends the colony.';
    fruitBtn.onclick = () => this.handlers.onFruit();
    this.el.fruitBtn = fruitBtn;
    const restartBtn = button('btn restart', 'New Map ↻');
    restartBtn.onclick = () => this.handlers.onRestart();
    const puzzleBtn = button('btn restart', 'Puzzle 🧩');
    puzzleBtn.onclick = () => this.handlers.onPuzzle();
    ctrl.append(endBtn, fruitBtn, restartBtn, puzzleBtn);
    bar.appendChild(ctrl);

    root.appendChild(bar);

    // ---- Hint line ----
    this.el.hint = div('hint');
    this.el.hint.textContent = 'Hover an action for details. Grow extends the network toward sensed food.';
    root.appendChild(this.el.hint);

    // ---- Right column: event log ----
    const logPanel = div('panel logpanel');
    logPanel.innerHTML = `<div class="title">Event Log</div><div class="loglist" id="loglist"></div>`;
    root.appendChild(logPanel);
    this.el.loglist = logPanel.querySelector('#loglist');

    // ---- "What we're testing" (pinned, collapsible) ----
    const testing = div('panel testing' + maybeCollapsed);
    testing.innerHTML = `<div class="title clickable">What we're testing <span class="chev">▾</span></div>`;
    const list = div('testing-list');
    list.innerHTML = TESTING_QUESTIONS.map((q, i) => `<div class="q"><b>${i + 1}.</b> ${q}</div>`).join('');
    testing.appendChild(list);
    testing.querySelector('.title').onclick = () => testing.classList.toggle('collapsed');
    root.appendChild(testing);

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
      cheats.append(c1, c2, c3);
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
  }

  // Select a targeted card (it waits for a board click); pass null to clear.
  setSelectedCard(inst) {
    this.selectedCard = inst;
    const card = inst && CARDS[inst.key];
    if (card) {
      const what = card.target === 'node'
        ? 'Click the map to cut out strands inside the red circle.'
        : 'Click the map to place it (within the green circle of the colony).';
      this.setHint(`${card.name}: ${what}`);
    } else {
      this.setHint('Play a card from your hand.');
    }
    this._renderHand();
  }

  // Build the hand of cards from state.hand.
  _renderHand() {
    const wrap = this.el.hand;
    if (!wrap) return;
    const s = this.state;
    const net = s.active;
    wrap.innerHTML = '';
    for (const inst of (s.hand || [])) {
      const card = CARDS[inst.key];
      if (!card) continue;
      const el = div('card t-' + card.type);
      const affordable = net && net.energy >= card.cost && !s.runOver && net.alive;
      if (!affordable) el.classList.add('disabled');
      if (inst === this.selectedCard) el.classList.add('selected');
      el.title = card.desc;
      el.innerHTML = `<div class="card-cost">${card.cost}⚡</div>`
        + `<div class="card-name">${card.name}</div>`
        + `<div class="card-type">${card.type}</div>`;
      el.onclick = () => this.handlers.onCard(inst);
      wrap.appendChild(el);
    }
    if (!(s.hand && s.hand.length)) {
      wrap.innerHTML = '<div class="hand-empty">No cards in hand — End Turn to draw.</div>';
    }
  }

  setHint(text) { this.el.hint.textContent = text; }

  showOverlay(result) {
    const o = this.el.overlay;
    o.classList.remove('hidden');
    const won = result && result.won;
    const died = result && result.died;
    const puzzle = this.state.mode === 'puzzle';

    let title, body;
    if (won) {
      title = 'Treasure reached! 🧩';
      body = `The colony threaded the map and reached the chest in <b>${result.turns}</b> turns.`;
    } else if (died) {
      title = 'The colony has died';
      body = puzzle
        ? 'It starved or was overrun before reaching the treasure. Try a different route.'
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
    text('hud-deck', `${(s.deck || []).length}+${(s.discard || []).length}`);
    const vfill = document.getElementById('hud-vitality');
    if (vfill) {
      vfill.style.width = `${Math.round(net.vitality * 100)}%`;
      vfill.style.background = vitalityColor(net.vitality);
    }

    // Express trait readout (Melanize level, from the card)
    const traitsEl = document.getElementById('hud-traits');
    if (traitsEl) {
      traitsEl.innerHTML = TRAITS.map((t) => {
        const lvl = net.traits[t.key];
        return `<span class="tr ${lvl > 0 ? 'on' : ''}">${t.label[0]}${t.label[1]}<b>${lvl}</b></span>`;
      }).join('');
    }

    this._renderHand();
    if (this.el.endBtn) this.el.endBtn.disabled = s.runOver;
    if (this.el.fruitBtn) this.el.fruitBtn.disabled = s.runOver || !net.alive;

    this._renderLog();
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
function vitalityColor(v) {
  const r = Math.round(200 - v * 140), g = Math.round(70 + v * 150), b = Math.round(60 + v * 40);
  return `rgb(${r},${g},${b})`;
}
