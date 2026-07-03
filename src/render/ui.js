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
    const cardsOn = !!(this.state.config.cards && this.state.config.cards.enabled);
    this.cardsOn = cardsOn;

    // ---- Top-left HUD ----
    const hud = div('panel hud');
    const resStats = cardsOn ? `
        <div class="stat res-w"><span class="k">Water</span><span class="v" id="hud-water">0</span></div>
        <div class="stat res-n"><span class="k">Nitro</span><span class="v" id="hud-nitrogen">0</span></div>
        <div class="stat res-p"><span class="k">Phos</span><span class="v" id="hud-phosphorus">0</span></div>`
      : `<div class="stat"><span class="k">Spores</span><span class="v" id="hud-spores">0</span></div>`;
    hud.innerHTML = `
      <div class="title">MYCELIUM <span class="sub">· cards</span></div>
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
      const hand = div('panel handbar');
      hand.innerHTML = `<div class="handlist" id="handlist"></div>`;
      this.el.handlist = hand.querySelector('#handlist');
      root.appendChild(hand);
    }

    // ---- Hint line ----
    this.el.hint = div('hint');
    this.el.hint.textContent = cardsOn
      ? 'Draw basics (⚡), then play cards from your hand. Grow costs Water · Digest costs Nitrogen · Actions cost Phosphorus. Reach the goal on the right to win.'
      : 'Hover an action for details. Grow extends the network toward sensed food.';
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
  }
  clearPendingCard() { this.pendingCard = null; }

  setHint(text) { this.el.hint.textContent = text; }

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
      text('hud-nitrogen', Math.floor(net.nitrogen || 0));
      text('hud-phosphorus', Math.floor(net.phosphorus || 0));
      this._renderHand();
      const cc = s.config.cards;
      const drawE = Math.max(1, cc.drawCostEnergy - (s.cards.drawDiscount || 0));
      if (this.el.drawBtn) {
        this.el.drawBtn.innerHTML = `Draw <span class="cost">${drawE}⚡</span> <span class="deckn">${s.cards.drawDeck.length} left</span>`;
        this.el.drawBtn.disabled = s.runOver || !net.alive || !s.cards.drawDeck.length || net.energy < drawE;
      }
      if (this.el.skipBtn) {
        this.el.skipBtn.innerHTML = `Skip <span class="cost">${cc.skipCostEnergy}⚡</span>`;
        this.el.skipBtn.disabled = s.runOver || !net.alive || net.energy < cc.skipCostEnergy;
      }
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
    list.innerHTML = '';
    s.cards.hand.forEach((h, i) => {
      const c = CARD_BY_NAME[h.name] || { costW: 0, costN: 0, costP: 0, effect: '', type: '' };
      const gate = [];
      if (c.costW) gate.push(`<span class="cc w">${c.costW}W</span>`);
      if (c.costN) gate.push(`<span class="cc n">${c.costN}N</span>`);
      if (c.costP) gate.push(`<span class="cc p">${c.costP}P</span>`);
      const affordable = net.water >= c.costW && net.nitrogen >= c.costN && net.phosphorus >= c.costP && !s.runOver && net.alive;
      const pending = this.pendingCard && this.pendingCard.id === h.id;
      const cls = 'cardbtn' + (affordable ? '' : ' unaff') + (pending ? ' selected' : '');
      const b = button(cls, `<span class="cn">${escapeHtml(h.name)}</span><span class="ct">${escapeHtml(c.type)}</span><span class="cgate">${gate.join('') || '<span class="cc free">free</span>'}</span>`);
      b.title = c.effect;
      b.onclick = () => this.handlers.onPlayCard(i);
      list.appendChild(b);
    });
    if (!s.cards.hand.length) list.innerHTML = '<div class="handempty">Hand empty — Draw a card (⚡) or Skip.</div>';
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
