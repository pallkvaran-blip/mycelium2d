// =============================================================================
// Start-of-run species picker + between-level campaign overlays (in-game).
//
//   showSpeciesSelect({onPick,onDev}) — boot picker. Unlocked species (per saved
//     progress) appear as playable; gated ones show as locked previews.
//   showLevelComplete({level,maxLevel,unlocked,onNext}) — congrats after a level;
//     any newly-unlocked species are shown and inspectable before continuing.
//   showGameWon({onNewRun}) — cleared the final level.
//
// Card faces (effect/type/cost/art) are derived LIVE from CARD_DATA + the deck's
// assets/cards art, so card-data/art changes flow through automatically.
// Everything is namespaced (#speciesSelect / .ss-*) to avoid colliding with the
// in-game .card/.overlay UI.
// =============================================================================

import { SPECIES, LOCKED_TIERS, isUnlocked, loadProgress } from '../species.js';
import { CARD_DATA } from '../cards-data.js';
import { cardSlug } from './ui.js';

const CARD_BY_NAME = {};
for (const c of CARD_DATA) CARD_BY_NAME[c.name] = c;

const VER = (typeof globalThis !== 'undefined' && globalThis.__ASSET_VER) ? '?v=' + globalThis.__ASSET_VER : '';
const speciesImg = (id) => `assets/species/${id}.jpg${VER}`;
const cardImg = (name) => `assets/cards/${cardSlug(name)}.jpg${VER}`;

const RI = {
  energy: '<svg class="ss-ri" viewBox="0 0 24 24" fill="#e6b45c" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
  water: '<svg class="ss-ri" viewBox="0 0 24 24" fill="#7fd0e0" aria-hidden="true"><path d="M12 2s7 7.6 7 12a7 7 0 1 1-14 0c0-4.4 7-12 7-12z"/></svg>',
  phos: '<svg class="ss-ri" viewBox="0 0 24 24" fill="#c79be6" aria-hidden="true"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"/></svg>',
};

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function costPips(c) {
  let out = '';
  if (c && c.costW) out += '<span class="ss-cpip">' + RI.water + c.costW + '</span>';
  if (c && c.costP) out += '<span class="ss-cpip p">' + RI.phos + c.costP + '</span>';
  return out ? '<span class="ss-cost">' + out + '</span>' : '';
}

function cardFace(entry) {
  const c = CARD_BY_NAME[entry.name] || { name: entry.name, type: '', effect: '' };
  const multi = entry.count > 1 ? ' ss-multi' : '';
  return '<div class="ss-gc' + multi + '">' +
    '<div class="ss-gc-art"><img src="' + cardImg(entry.name) + '" alt="" onerror="this.style.display=\'none\'">' +
      costPips(c) +
      '<span class="ss-gc-count">×' + entry.count + '</span>' +
      (c.type ? '<span class="ss-gc-type">' + esc(c.type) + '</span>' : '') +
    '</div>' +
    '<div class="ss-gc-name">' + esc(c.name) + '</div>' +
    '<div class="ss-gc-eff">' + esc(c.effect || '') + '</div>' +
  '</div>';
}

function resPills(res) {
  const order = [['energy', 'energy'], ['water', 'water'], ['phosphorus', 'phos']];
  let out = '';
  for (const [key, icon] of order) {
    const v = res && res[key]; if (!v) continue;
    out += '<span class="ss-respill ' + icon + '">' + RI[icon] + '<span class="ss-rv">' + v + '</span>' +
      '<span class="ss-rk">' + key + '</span></span>';
  }
  return out;
}

// --- shared species detail (inspector) — a single body-level overlay ----------
let _insp = null;
function inspector() {
  if (_insp) return _insp;
  const wrap = el('div', 'ss-detailwrap'); wrap.id = 'ssInspector'; wrap.style.zIndex = '1006';
  wrap.innerHTML =
    '<div class="ss-detail" id="ssIDetail">' +
      '<button class="ss-close" id="ssIClose" aria-label="Close">✕</button>' +
      '<div class="ss-d-art"><img id="ssIArt" alt=""></div>' +
      '<div class="ss-d-body">' +
        '<div><div class="ss-d-name" id="ssIName"></div><div class="ss-d-latin" id="ssILatin"></div></div>' +
        '<p class="ss-d-blurb" id="ssIBlurb"></p>' +
        '<div class="ss-hand"><h3>Starting hand</h3><p class="ss-sub">The actual cards this colony brings to the surface on turn one.</p>' +
          '<div class="ss-resprow" id="ssIRes"></div><div class="ss-deck" id="ssIHand"></div></div>' +
        '<div class="ss-actions" id="ssIActions"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  const detail = wrap.querySelector('#ssIDetail');
  const close = () => wrap.classList.remove('open');
  wrap.querySelector('#ssIClose').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('open')) close(); });
  _insp = { wrap, detail, close };
  return _insp;
}

// opts.mode: 'start' (Cancel + Start→onStart) · 'locked' (Close + disabled Locked pill) · 'inspect' (Close)
function openSpeciesDetail(species, opts = {}) {
  const ins = inspector();
  ins.detail.className = 'ss-detail ' + species.vibe;
  ins.wrap.querySelector('#ssIArt').src = speciesImg(species.img);
  ins.wrap.querySelector('#ssIArt').alt = 'Portrait of ' + species.name;
  ins.wrap.querySelector('#ssIName').textContent = species.name;
  ins.wrap.querySelector('#ssILatin').textContent = species.latin;
  ins.wrap.querySelector('#ssIBlurb').innerHTML = species.blurb;
  ins.wrap.querySelector('#ssIRes').innerHTML = resPills(species.res);
  ins.wrap.querySelector('#ssIHand').innerHTML = species.hand.map(cardFace).join('');
  const actions = ins.wrap.querySelector('#ssIActions');
  if (opts.mode === 'start') {
    actions.innerHTML = '<button class="ss-btn ghost" id="ssICancel">Cancel</button><button class="ss-btn primary" id="ssIStart">Start game</button>';
    actions.querySelector('#ssICancel').onclick = ins.close;
    actions.querySelector('#ssIStart').onclick = () => { ins.close(); opts.onStart && opts.onStart(); };
  } else if (opts.mode === 'locked') {
    actions.innerHTML = '<button class="ss-btn ghost" id="ssICancel">Close</button><button class="ss-btn primary is-locked" disabled>Locked · ' + esc(species.unlock) + '</button>';
    actions.querySelector('#ssICancel').onclick = ins.close;
  } else {
    actions.innerHTML = '<button class="ss-btn primary" id="ssIOk">Continue</button>';
    actions.querySelector('#ssIOk').onclick = ins.close;
  }
  ins.wrap.classList.add('open');
}

// --- a species card tile (available / locked preview) -------------------------
function speciesCard(s, { locked, onClick }) {
  const card = el('button', 'ss-card ' + s.vibe + (locked ? ' ss-locked' : ''));
  card.type = 'button';
  card.setAttribute('aria-label', (locked ? 'Preview ' : 'Inspect ') + s.name);
  card.innerHTML =
    '<div class="ss-card-art"><img src="' + speciesImg(s.img) + '" alt="' + esc(s.name) + '" onerror="this.style.opacity=0"></div>' +
    (locked ? '<span class="ss-lockbadge">🔒 Locked</span>' : '') +
    '<span class="ss-choose">' + (locked ? 'Preview ▸' : 'Inspect ▸') + '</span>' +
    '<div class="ss-card-info"><div class="ss-sp-name">' + esc(s.name) + '</div><div class="ss-sp-latin">' + esc(s.latin) + '</div></div>';
  card.addEventListener('click', onClick);
  return card;
}

// ============================ boot picker ====================================
export function showSpeciesSelect({ onPick, onDev }) {
  const progress = loadProgress();
  const root = el('div'); root.id = 'speciesSelect';
  root.innerHTML =
    '<div class="ss-console" role="dialog" aria-label="Select your species">' +
      '<button class="ss-dev" id="ssDev" type="button" title="Skip selection and start the default dev run (300 of each resource, 5 of each card)">Dev quick-start ▸</button>' +
      '<header class="ss-head">' +
        '<div class="ss-eyebrow">Mycelium · New run</div>' +
        '<h1>Select your species</h1>' +
        '<p class="ss-lede">Every run begins as a single spore. Choose the colony you\'ll grow from the dark — its <b>temperament</b> and its <b>starting hand</b> are set here. Unlock more by clearing levels; they carry into future runs.</p>' +
      '</header>' +
      '<div class="ss-body">' +
        '<section class="ss-section">' +
          '<div class="ss-rowlabel"><span class="ss-lk">Available now</span><span class="ss-badge">Choose one</span><span class="ss-rule"></span><span class="ss-hint">Tap a card to inspect</span></div>' +
          '<div class="ss-grid" id="ssAvail"></div>' +
        '</section>' +
        '<div id="ssLocked"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  function hide() { root.remove(); }

  const availGrid = root.querySelector('#ssAvail');
  for (const s of SPECIES) {
    if (!isUnlocked(s, progress)) continue;
    availGrid.appendChild(speciesCard(s, { locked: false, onClick: () =>
      openSpeciesDetail(s, { mode: 'start', onStart: () => { hide(); onPick && onPick(s); } }) }));
  }

  const lockedRows = root.querySelector('#ssLocked');
  for (const row of LOCKED_TIERS) {
    const sec = el('section', 'ss-section' + (row.communal ? ' ss-communal' : ''));
    const label = el('div', 'ss-rowlabel ss-locked-label');
    label.innerHTML = row.communal
      ? '<span class="ss-lock">🔒</span><span class="ss-lk">' + esc(row.label) + '</span><span class="ss-rule"></span><span class="ss-hint">Yet to be discovered</span>'
      : '<span class="ss-lock">🔒</span><span class="ss-lk">Unlock · ' + esc(row.label) + '</span><span class="ss-rule"></span><span class="ss-hint">' + row.n + ' species</span>';
    const grid = el('div', 'ss-grid');
    // real species pinned to this tier that are STILL locked (unlocked ones moved to "Available now")
    const tier = SPECIES.filter((s) => s.unlock === row.label && !isUnlocked(s, progress));
    for (const s of tier) grid.appendChild(speciesCard(s, { locked: true, onClick: () => openSpeciesDetail(s, { mode: 'locked' }) }));
    for (let k = tier.length; k < row.n; k++) {
      const lc = el('div', 'ss-lock-card'); lc.setAttribute('aria-hidden', 'true');
      lc.innerHTML = '<span class="ss-q">?</span>';
      grid.appendChild(lc);
    }
    sec.appendChild(label); sec.appendChild(grid);
    lockedRows.appendChild(sec);
  }

  root.querySelector('#ssDev').addEventListener('click', () => { hide(); onDev && onDev(); });
  return { hide, root };
}

// ===================== between-level: level complete =========================
export function showLevelComplete({ level, maxLevel, unlocked, onNext }) {
  const root = el('div', 'ss-detailwrap open'); root.id = 'ssLevelComplete';
  const hasUnlock = unlocked && unlocked.length;
  root.innerHTML =
    '<div class="ss-lc">' +
      '<div class="ss-lc-badge">Level ' + level + ' of ' + maxLevel + ' cleared</div>' +
      '<h2 class="ss-lc-title">The colony fruits at the surface! 🍄</h2>' +
      '<p class="ss-lc-sub">You crossed level ' + level + ' — your deck, engines and reserves carry forward. Level ' + (level + 1) + ' brings more of the dark to contend with.</p>' +
      (hasUnlock
        ? '<div class="ss-lc-unlock"><span class="ss-lc-star">✦</span> Congratulations! You unlocked a new species — available on your next run.<span class="ss-lc-tap"> Tap to inspect it.</span></div><div class="ss-lc-cards" id="ssLcCards"></div>'
        : '') +
      '<div class="ss-lc-actions"><button class="ss-btn primary" id="ssLcNext">Descend to level ' + (level + 1) + ' →</button></div>' +
    '</div>';
  document.body.appendChild(root);
  function hide() { root.remove(); }
  if (hasUnlock) {
    const cards = root.querySelector('#ssLcCards');
    for (const s of unlocked) cards.appendChild(speciesCard(s, { locked: false, onClick: () => openSpeciesDetail(s, { mode: 'inspect' }) }));
  }
  root.querySelector('#ssLcNext').addEventListener('click', () => { hide(); onNext && onNext(); });
  return { hide, root };
}

// =========================== game won (final) ================================
export function showGameWon({ onNewRun }) {
  const root = el('div', 'ss-detailwrap open'); root.id = 'ssGameWon';
  root.innerHTML =
    '<div class="ss-lc">' +
      '<div class="ss-lc-badge">Run complete</div>' +
      '<h2 class="ss-lc-title">You carried the colony to the surface — all the way. 🍄✦</h2>' +
      '<p class="ss-lc-sub">Every level cleared. The mycelium has conquered the deep. Start a fresh run with any species you\'ve unlocked.</p>' +
      '<div class="ss-lc-actions"><button class="ss-btn primary" id="ssGwNew">Begin a new run ↻</button></div>' +
    '</div>';
  document.body.appendChild(root);
  function hide() { root.remove(); }
  root.querySelector('#ssGwNew').addEventListener('click', () => { hide(); onNewRun && onNewRun(); });
  return { hide, root };
}
