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

const TRAITS = [
  { key: 'melanize', label: 'Melanize', hint: 'armour; resists the initial mould contact' },
];

const TESTING_QUESTIONS = [
  'Is steering the semi-autonomous growth (Grow + Add Substrate + Amputate) satisfying — do I feel like I\'m shaping a living thing?',
  'Does 3-moves + Energy make each turn a real prioritisation?',
  'Is the grow-toward-rich-food-but-it\'s-dangerous (Trichoderma) tension fun?',
  'Does Express (defend, organism-wide) vs. Grow (expand) feel like a meaningful recurring tradeoff?',
  'Is Fruit a satisfying payoff, and does the soil/shade surface make WHERE to fruit an interesting choice?',
  'Is Digest-burst a useful lever or redundant?',
];

export class UI {
  constructor(state, handlers) {
    this.state = state;
    this.handlers = handlers;
    this.selectedAction = null;
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
        <div class="stat"><span class="k">Moves</span><span class="v" id="hud-moves">3</span></div>
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
      ['repeating-conic-gradient(#aacd5a 0 12deg,transparent 12deg 24deg)', 'Mould sight range (dashed ring)'],
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

    // ---- Bottom action bar ----
    const bar = div('panel actionbar');
    this.el.buttons = {};

    const order = ['grow', 'addSubstrate', 'amputate'];
    for (const name of order) bar.appendChild(this._actionButton(name));

    // Express group (three traits)
    const exprGroup = div('expr-group');
    exprGroup.appendChild(span('Express', 'group-label'));
    for (const t of TRAITS) {
      const b = button(`btn trait`, '');
      b.dataset.trait = t.key;
      b.title = t.hint;
      b.onclick = () => this.handlers.onAction('express', { trait: t.key });
      exprGroup.appendChild(b);
      this.el.buttons['express:' + t.key] = b;
    }
    bar.appendChild(exprGroup);

    for (const name of ['digest', 'fruit']) bar.appendChild(this._actionButton(name));

    // End turn + restart
    const ctrl = div('ctrl');
    const endBtn = button('btn end', 'End Turn ⏭');
    endBtn.onclick = () => this.handlers.onEndTurn();
    this.el.endBtn = endBtn;
    const restartBtn = button('btn restart', 'New Map ↻');
    restartBtn.onclick = () => this.handlers.onRestart();
    ctrl.appendChild(endBtn);
    ctrl.appendChild(restartBtn);
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
      amputate: 'Click a strand to cut it (and everything downstream).',
    };
    if (name && hints[name]) this.setHint(hints[name]);
  }

  setHint(text) { this.el.hint.textContent = text; }

  showOverlay(result) {
    const o = this.el.overlay;
    o.classList.remove('hidden');
    const died = result && result.died;
    o.innerHTML = `
      <div class="card">
        <h1>${died ? 'The colony has died' : 'The network has fruited'}</h1>
        <p>${died
          ? 'Trichoderma and hazards overwhelmed the network before it could fruit.'
          : `It pushed up <b>${result.bodies}</b> fruiting bodies and released <b>${result.spores}</b> spores.`}</p>
        <p class="dim">Total Spores this run: <b>${this.state.spores}</b></p>
        <p class="dim small">In the full game these spores would seed the next generation. Phase 1 ends here.</p>
        <button class="btn big" id="overlay-restart">Begin a new colony ↻</button>
      </div>`;
    o.querySelector('#overlay-restart').onclick = () => this.handlers.onRestart();
  }
  hideOverlay() { this.el.overlay.classList.add('hidden'); }

  update() {
    const s = this.state;
    const net = s.active;
    text('hud-energy', Math.floor(net.energy));
    text('hud-spores', Math.floor(s.spores));
    text('hud-turn', s.turn);
    text('hud-moves', `${s.movesLeft}/${s.config.turn.movesPerTurn}`);
    const vfill = document.getElementById('hud-vitality');
    if (vfill) {
      vfill.style.width = `${Math.round(net.vitality * 100)}%`;
      vfill.style.background = vitalityColor(net.vitality);
    }

    // Express trait readout
    const traitsEl = document.getElementById('hud-traits');
    if (traitsEl) {
      traitsEl.innerHTML = TRAITS.map((t) => {
        const lvl = net.traits[t.key];
        return `<span class="tr ${lvl > 0 ? 'on' : ''}">${t.label[0]}${t.label[1]}<b>${lvl}</b></span>`;
      }).join('');
    }

    // Button states / costs
    for (const name of ['grow', 'addSubstrate', 'amputate', 'digest', 'fruit']) {
      const btn = this.el.buttons[name];
      if (!btn) continue;
      const { moves, energy } = actionCost(s, name);
      btn.innerHTML = `${ACTIONS[name].label} <span class="cost">${energy}⚡ ${moves}◆</span>`;
      btn.disabled = s.runOver || s.movesLeft < moves || net.energy < energy || !net.alive;
    }
    // Express trait buttons (dynamic cost)
    for (const t of TRAITS) {
      const btn = this.el.buttons['express:' + t.key];
      if (!btn) continue;
      const lvl = net.traits[t.key];
      const cost = net.expressCost(t.key);
      const maxed = lvl >= s.config.actions.express.maxLevel;
      btn.innerHTML = `${t.label} <span class="lvl">L${lvl}</span> <span class="cost">${maxed ? 'MAX' : cost + '⚡'}</span>`;
      btn.disabled = s.runOver || maxed || s.movesLeft < s.config.actions.express.moveCost
        || net.energy < cost || !net.alive;
    }
    this.el.endBtn.disabled = s.runOver;

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
