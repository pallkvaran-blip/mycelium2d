// =============================================================================
// UI — the DOM heads-up display over the 3D view.
//
// HUD stats, the action bar (hotkeys 1-7 work while the mouse is captured),
// event log, hints, crosshair + cursor distance, goal arrow, the run-end
// overlay and a small dev panel. Reads engine state; mutates it only through
// the handler callbacks supplied by main.js.
// =============================================================================

import { ACTIONS, actionCost, actionBlockedReason } from '../engine/actions.js';

const ACTION_ORDER = ['grow', 'addSubstrate', 'amputate', 'attackAnts', 'excrete', 'digest', 'fruit'];
const TARGETED = new Set(['addSubstrate', 'amputate', 'attackAnts']);

export class UI {
  constructor(state, handlers) {
    this.state = state;
    this.handlers = handlers;
    this.selectedAction = null;
    this.fruitArmed = false;
    this.root = document.getElementById('ui');
    this._build();
    this.update();
  }

  setState(state) {
    this.state = state;
    this.selectedAction = null;
    this.fruitArmed = false;
    this.hideOverlay();
    this.update();
  }

  _build() {
    this.root.innerHTML = `
      <div class="panel hud">
        <div class="title">MYCELIUM <span class="sub">· 3D</span></div>
        <div class="stats">
          <div class="stat"><span class="k">Energy</span><span class="v" id="stat-energy">0</span></div>
          <div class="stat"><span class="k">Spores</span><span class="v" id="stat-spores">0</span></div>
          <div class="stat"><span class="k">Strands</span><span class="v" id="stat-strands">0</span></div>
          <div class="stat"><span class="k">Step</span><span class="v" id="stat-turn">1</span></div>
        </div>
        <div class="vitality"><span class="k">Colony health</span>
          <div class="bar"><div class="fill" id="vit-fill"></div></div>
        </div>
      </div>

      <div class="panel logpanel">
        <div class="title clickable" id="log-title">EVENTS <span class="chev">▾</span></div>
        <div class="loglist" id="loglist"></div>
      </div>

      <div class="panel helppanel collapsed" id="helppanel">
        <div class="title clickable" id="help-title">FLIGHT CONTROLS <span class="chev">▸</span></div>
        <div class="help-body">
          <div class="li"><b>Click</b> the view to take the controls (Esc releases)</div>
          <div class="li"><b>Mouse</b> look · <b>W A S D</b> glide · <b>Space / C</b> rise & sink</div>
          <div class="li"><b>Shift</b> boost · <b>Scroll</b> targeting distance</div>
          <div class="li"><b>1–7</b> actions · targeted ones aim with the glowing cursor, <b>click</b> to apply · <b>X</b> cancels</div>
          <div class="li"><b>H</b> fly home · <b>G</b> face the goal beacon</div>
          <div class="li note">Cross the dark volume west→east, dig under the rock curtains, reach the sunlit soil and Fruit.</div>
        </div>
      </div>

      <div class="actionbar" id="actionbar"></div>
      <div class="hint" id="hint"></div>

      <div class="crosshair" id="crosshair">+</div>
      <div class="cursor-dist" id="cursor-dist"></div>
      <div class="goal-arrow" id="goal-arrow">▲<span>goal</span></div>

      <div class="lockprompt" id="lockprompt">
        <div class="lp-card"><b>Click to fly</b><br/>Mouse to look · WASD to glide · 1–7 for actions</div>
      </div>

      <div class="overlay hidden" id="overlay"><div class="card" id="overlay-card"></div></div>

      <div class="panel dev collapsed" id="devpanel">
        <div class="title clickable" id="dev-title">DEV <span class="chev">▸</span></div>
        <div class="dev-body">
          <div class="cheats">
            <button class="btn dev-btn" data-cheat="energy">+Energy</button>
            <button class="btn dev-btn" data-cheat="spores">+Spores</button>
            <button class="btn dev-btn" data-cheat="trichoderma">Spawn mould</button>
            <button class="btn dev-btn" data-cheat="nematode">Spawn worms</button>
            <button class="btn dev-btn" data-cheat="reveal">Fog off/on</button>
          </div>
        </div>
      </div>
    `;

    // action bar buttons
    const bar = this.root.querySelector('#actionbar');
    this.buttons = new Map();
    ACTION_ORDER.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn action';
      btn.dataset.action = name;
      btn.innerHTML = `<span class="key">${i + 1}</span>${ACTIONS[name].label}<span class="cost" data-cost></span>`;
      btn.title = ACTIONS[name].desc;
      btn.addEventListener('click', () => this._pressAction(name));
      btn.addEventListener('mouseenter', () => { if (name === 'fruit') this.handlers.onFruitPreview(true); });
      btn.addEventListener('mouseleave', () => { if (name === 'fruit' && !this.fruitArmed) this.handlers.onFruitPreview(false); });
      bar.appendChild(btn);
      this.buttons.set(name, btn);
    });
    const restart = document.createElement('button');
    restart.className = 'btn restart';
    restart.textContent = 'New Map';
    restart.addEventListener('click', () => this.handlers.onRestart());
    bar.appendChild(restart);

    // collapsibles
    const collapse = (panelId, titleId) => {
      const panel = this.root.querySelector(panelId);
      this.root.querySelector(titleId).addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        const chev = panel.querySelector('.chev');
        if (chev) chev.textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
      });
    };
    collapse('#helppanel', '#help-title');
    collapse('#devpanel', '#dev-title');
    const logPanel = this.root.querySelector('.logpanel');
    this.root.querySelector('#log-title').addEventListener('click', () => logPanel.classList.toggle('collapsed'));

    // dev cheats
    this.root.querySelectorAll('[data-cheat]').forEach((b) =>
      b.addEventListener('click', () => this.handlers.onCheat(b.dataset.cheat)));

    // hotkeys
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(e.code);
      if (idx >= 0) this._pressAction(ACTION_ORDER[idx]);
      // X cancels while flying (the browser reserves Esc to exit pointer lock,
      // so the page never sees it while the mouse is captured).
      else if (e.code === 'Escape' || e.code === 'KeyX') this.setSelectedAction(null);
      else if (e.code === 'KeyH') this.handlers.onHome();
      else if (e.code === 'KeyG') this.handlers.onFaceGoal();
    });

    this.elEnergy = this.root.querySelector('#stat-energy');
    this.elSpores = this.root.querySelector('#stat-spores');
    this.elStrands = this.root.querySelector('#stat-strands');
    this.elTurn = this.root.querySelector('#stat-turn');
    this.elVit = this.root.querySelector('#vit-fill');
    this.elLog = this.root.querySelector('#loglist');
    this.elHint = this.root.querySelector('#hint');
    this.elCursorDist = this.root.querySelector('#cursor-dist');
    this.elGoalArrow = this.root.querySelector('#goal-arrow');
    this.elLockPrompt = this.root.querySelector('#lockprompt');
    this.elCrosshair = this.root.querySelector('#crosshair');
  }

  // An action button/hotkey press. Targeted actions arm the cursor; Fruit asks
  // for a second press to confirm (it ends the run); the rest fire immediately.
  _pressAction(name) {
    if (this.state.runOver) return;
    if (TARGETED.has(name)) {
      this.setSelectedAction(this.selectedAction === name ? null : name);
      return;
    }
    if (name === 'fruit' && !this.fruitArmed) {
      this.fruitArmed = true;
      this.handlers.onFruitPreview(true);
      this.setHint('Fruiting ends this life cycle. Press 7 (or click Fruit) again to confirm — X to cancel.');
      this.update();
      return;
    }
    // ANY fired instant action disarms a pending Fruit confirm (and its preview).
    if (this.fruitArmed) { this.fruitArmed = false; this.handlers.onFruitPreview(false); }
    this.handlers.onAction(name, {});
  }

  setSelectedAction(name) {
    this.selectedAction = name;
    if (this.fruitArmed && name !== 'fruit') { this.fruitArmed = false; this.handlers.onFruitPreview(false); }
    this.handlers.onSelectAction(name);
    this.update();
  }

  setHint(text) {
    this.elHint.textContent = text || '';
    this.elHint.style.display = text ? 'block' : 'none';
  }

  setLockState(locked) {
    this.elLockPrompt.style.display = locked || this.state.runOver ? 'none' : 'flex';
    this.elCrosshair.style.opacity = locked ? 1 : 0.25;
    if (!locked && this.selectedAction) { /* keep armed; user may re-lock */ }
    this.update();
  }

  updateCursorReadout(dist, visible) {
    this.elCursorDist.style.display = visible ? 'block' : 'none';
    if (visible) this.elCursorDist.textContent = `${Math.round(dist)}u`;
  }

  // Screen-space goal arrow: hidden when the goal is on screen ahead of us.
  updateGoalArrow(visible, x, y, angleRad) {
    const el = this.elGoalArrow;
    el.style.display = visible ? 'flex' : 'none';
    if (visible) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = `translate(-50%,-50%) rotate(${angleRad}rad)`;
    }
  }

  showOverlay(result) {
    const overlay = this.root.querySelector('#overlay');
    const card = this.root.querySelector('#overlay-card');
    if (result && result.died) {
      card.innerHTML = `
        <h1>The colony is gone</h1>
        <p>The network was consumed before it could fruit.</p>
        <p class="dim">Spores banked: <b>${result.spores || 0}</b></p>
        <button class="btn big" id="overlay-restart">Grow a new colony</button>`;
    } else if (result) {
      card.innerHTML = `
        <h1>The life cycle completes</h1>
        <p>${result.bodies} fruiting bod${result.bodies === 1 ? 'y' : 'ies'} broke the sunlit soil.</p>
        <p>Spores released: <b>+${result.spores}</b></p>
        <p class="dim small">Fly up to the goal surface to see the mushrooms before you go.</p>
        <button class="btn big" id="overlay-restart">Grow a new colony</button>
        <button class="btn" id="overlay-fly">Keep flying</button>`;
    }
    overlay.classList.remove('hidden');
    this.elLockPrompt.style.display = 'none';
    card.querySelector('#overlay-restart').addEventListener('click', () => this.handlers.onRestart());
    const fly = card.querySelector('#overlay-fly');
    if (fly) fly.addEventListener('click', () => this.hideOverlay());
  }
  hideOverlay() {
    this.root.querySelector('#overlay').classList.add('hidden');
  }

  update() {
    const s = this.state, net = s.active;
    this.elEnergy.textContent = Math.floor(net.energy);
    this.elSpores.textContent = Math.floor(s.spores);
    this.elStrands.textContent = net.nodes.length;
    this.elTurn.textContent = s.turn;
    const v = Math.max(0, Math.min(1, net.vitality));
    this.elVit.style.width = `${Math.round(v * 100)}%`;
    this.elVit.style.background = v > 0.66 ? 'var(--accent)' : v > 0.33 ? 'var(--warn)' : 'var(--danger)';

    for (const [name, btn] of this.buttons) {
      const blocked = actionBlockedReason(s, name);
      btn.disabled = !!blocked;
      btn.classList.toggle('selected', this.selectedAction === name || (name === 'fruit' && this.fruitArmed));
      const { energy } = actionCost(s, name);
      btn.querySelector('[data-cost]').textContent = ` −${Math.ceil(energy)}⚡`;
    }

    // log (newest at the bottom, autoscroll)
    const entries = s.logEntries.slice(-60);
    this.elLog.innerHTML = entries.map((e) =>
      `<div class="le ${e.kind}"><span class="t">${e.turn}</span>${escapeHtml(e.message)}</div>`).join('');
    this.elLog.scrollTop = this.elLog.scrollHeight;

    // default hint by mode
    if (this.selectedAction) {
      const label = ACTIONS[this.selectedAction].label;
      this.setHint(`${label}: aim with the glowing cursor (scroll = distance) and click to apply. X cancels.`);
    } else if (!this.fruitArmed) {
      this.setHint('');
    }
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
