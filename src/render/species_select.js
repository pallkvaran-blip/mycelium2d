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

import { SPECIES, LOCKED_TIERS, isRevealed, isPlayable, unlockCost, sporesBalance, purchaseSpecies, loadProgress, devUnlockAll } from '../species.js';
import { CARD_DATA } from '../cards-data.js';
import { cardSlug, SPORE_ICON } from './ui.js';
import { growMyceliumTitle } from './mycelium_title.js';

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

// The shiny-spore currency chip (wallet balance / cost badges).
const sporeChip = (n, cls) => '<span class="ss-spores' + (cls ? ' ' + cls : '') + '">' + SPORE_ICON +
  '<span class="ss-sp-n">' + n + '</span><span class="ss-sp-lbl">Spores</span></span>';

function costPips(c) {
  let out = '';
  // Energy to PLAY/install the card (buyCostEnergy) — was missing, so cards like
  // Rhizomorph Lance (1⚡ + 2💧) showed only the Water cost.
  if (c && c.buyCostEnergy) out += '<span class="ss-cpip e">' + RI.energy + c.buyCostEnergy + '</span>';
  // Action cards install for Energy only; their W/P is a per-activation cost, not an
  // install gate — so match the in-game face and don't show W/P for actions.
  if (c && c.type !== 'action') {
    if (c.costW) out += '<span class="ss-cpip">' + RI.water + c.costW + '</span>';
    if (c.costP) out += '<span class="ss-cpip p">' + RI.phos + c.costP + '</span>';
  }
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

// A placeholder "Choose Five" card shown on a MEMORY species' starting-hand display:
// a "?" art window standing in for the 5 cards the player curates each run.
function chooseFiveFace(sp) {
  const pick = (sp && sp.memPick) || 8;
  const eng = (sp && sp.memEngines) || 0;
  const title = eng > 0 ? ('Choose ' + pick + ' + ' + eng + ' engines') : ('Choose ' + pick);
  const eff = eng > 0
    ? ('Any combination of ' + pick + ' basic and event cards, plus ' + eng + ' engine cards, <b>drafted during your last run</b>.')
    : ('Any combination of ' + pick + ' basic and event cards <b>drafted during your last run</b>.');
  return '<div class="ss-gc ss-gc-choose">' +
    '<div class="ss-gc-art ss-gc-q"><span class="ss-q">?</span></div>' +
    '<div class="ss-gc-name">' + esc(title) + '</div>' +
    '<div class="ss-gc-eff">' + eff + '</div>' +
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
  ins.wrap.querySelector('#ssIHand').innerHTML = species.hand.map(cardFace).join('') + (species.memory ? chooseFiveFace(species) : '');
  const actions = ins.wrap.querySelector('#ssIActions');
  if (opts.mode === 'start') {
    actions.innerHTML = '<button class="ss-btn ghost" id="ssICancel">Cancel</button><button class="ss-btn primary" id="ssIStart">Start game</button>';
    actions.querySelector('#ssICancel').onclick = ins.close;
    actions.querySelector('#ssIStart').onclick = () => { ins.close(); opts.onStart && opts.onStart(); };
  } else if (opts.mode === 'locked') {
    actions.innerHTML = '<button class="ss-btn ghost" id="ssICancel">Close</button><button class="ss-btn primary is-locked" disabled>Locked · ' + esc(species.unlock) + '</button>';
    actions.querySelector('#ssICancel').onclick = ins.close;
  } else if (opts.mode === 'purchase') {
    // Revealed but not yet bought: offer to spend Spores to unlock it for play.
    const cost = unlockCost(species);
    const bal = sporesBalance();
    const afford = bal >= cost;
    actions.innerHTML =
      '<div class="ss-buyhint">' + (afford
        ? 'Unlock <b>' + esc(species.name) + '</b> for play.'
        : 'You need <b>' + (cost - bal) + '</b> more.') +
        ' You have ' + sporeChip(bal, 'inline') + '</div>' +
      '<button class="ss-btn ghost" id="ssICancel">Close</button>' +
      '<button class="ss-btn primary ss-buybtn' + (afford ? '' : ' is-locked') + '" id="ssIBuy"' + (afford ? '' : ' disabled') + '>' +
        'Unlock · ' + SPORE_ICON + '<span class="ss-buyn">' + cost + '</span></button>';
    actions.querySelector('#ssICancel').onclick = ins.close;
    const buy = actions.querySelector('#ssIBuy');
    if (afford && buy) buy.onclick = () => {
      const r = purchaseSpecies(species);
      if (r.ok) { ins.close(); opts.onBuy && opts.onBuy(); }
    };
  } else {
    actions.innerHTML = '<button class="ss-btn primary" id="ssIOk">Continue</button>';
    actions.querySelector('#ssIOk').onclick = ins.close;
  }
  ins.wrap.classList.add('open');
}

// --- a species card tile ------------------------------------------------------
// Three visual states: playable (bright, "Inspect"), revealed-but-unbought
// (greyed, a Spore-cost badge + "Unlock"), and — via mysteryCard() below — the
// not-yet-revealed "?" placeholder.
function speciesCard(s, { locked, cost, onClick }) {
  const card = el('button', 'ss-card ' + s.vibe + (locked ? ' ss-locked' : ''));
  card.type = 'button';
  const buyable = cost != null;
  card.setAttribute('aria-label', (buyable ? 'Unlock ' : locked ? 'Preview ' : 'Inspect ') + s.name);
  const badge = buyable
    ? '<span class="ss-lockbadge ss-buybadge">' + SPORE_ICON + '<span class="ss-sp-n">' + cost + '</span></span>'
    : (locked ? '<span class="ss-lockbadge">Locked</span>' : '');
  const choose = buyable ? 'Unlock ▸' : (locked ? 'Preview ▸' : 'Inspect ▸');
  card.innerHTML =
    '<div class="ss-card-art"><img src="' + speciesImg(s.img) + '" alt="' + esc(s.name) + '" onerror="this.style.opacity=0"></div>' +
    badge +
    '<span class="ss-choose">' + choose + '</span>' +
    '<div class="ss-card-info"><div class="ss-sp-name">' + esc(s.name) + '</div><div class="ss-sp-latin">' + esc(s.latin) + '</div></div>';
  card.addEventListener('click', onClick);
  return card;
}

// The "?" placeholder for a species that hasn't been revealed yet.
function mysteryCard() {
  const lc = el('div', 'ss-lock-card'); lc.setAttribute('aria-hidden', 'true');
  lc.innerHTML = '<span class="ss-q">?</span>';
  return lc;
}

// ============================ boot picker ====================================
export function showSpeciesSelect({ onPick, onDev }) {
  let progress = loadProgress();
  const root = el('div'); root.id = 'speciesSelect';
  root.innerHTML =
    '<div class="ss-title" aria-label="Mycelium"></div>' +
    '<div class="ss-console" role="dialog" aria-label="Select your species">' +
      '<button class="ss-dev" id="ssDev" type="button" title="Skip selection and start the default dev run (300 of each resource, 5 of each card)">Dev quick-start ▸</button>' +
      '<button class="ss-dev ss-dev2" id="ssDevUnlock" type="button" title="TEMP DEV: reveal + unlock every species">Dev: unlock all ▸</button>' +
      '<header class="ss-head">' +
        '<div class="ss-headrow"><h1>Select your species</h1>' +
          '<span class="ss-spores ss-wallet" id="ssWallet" title="Spores — earned by finishing levels, spent to unlock species"></span></div>' +
      '</header>' +
      '<div class="ss-body">' +
        '<section class="ss-section">' +
          '<div class="ss-rowlabel"><span class="ss-lk">Starter species</span><span class="ss-rule"></span></div>' +
          '<div class="ss-grid" id="ssAvail"></div>' +
        '</section>' +
        '<div id="ssLocked"></div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  const title = growMyceliumTitle(root.querySelector('.ss-title'));
  function hide() { title.destroy(); root.remove(); }

  const wallet = root.querySelector('#ssWallet');
  function updateWallet() {
    wallet.innerHTML = SPORE_ICON + '<span class="ss-sp-n">' + sporesBalance(progress) + '</span>';
  }

  const availGrid = root.querySelector('#ssAvail');
  for (const s of SPECIES) {
    if (s.unlock) continue;   // gated species stay in their tier row below, even once unlocked
    availGrid.appendChild(speciesCard(s, { locked: false, onClick: () =>
      openSpeciesDetail(s, { mode: 'start', onStart: () => { hide(); onPick && onPick(s); } }) }));
  }

  const lockedRows = root.querySelector('#ssLocked');
  function renderLocked() {
    lockedRows.innerHTML = '';
    for (const row of LOCKED_TIERS) {
      const sec = el('section', 'ss-section' + (row.communal ? ' ss-communal' : ''));
      const label = el('div', 'ss-rowlabel ss-locked-label');
      label.innerHTML = '<span class="ss-lk">' + esc(row.label) + '</span><span class="ss-rule"></span>';
      const grid = el('div', 'ss-grid');
      const tier = SPECIES.filter((s) => s.unlock === row.label);
      for (const s of tier) {
        // Not yet revealed → stays a "?"; revealed+bought → playable; revealed but
        // unbought → a viewable Locked card with a Spore price (opens the buy sheet).
        if (!isRevealed(s, progress)) { grid.appendChild(mysteryCard()); continue; }
        if (isPlayable(s, progress)) {
          grid.appendChild(speciesCard(s, { locked: false, onClick: () =>
            openSpeciesDetail(s, { mode: 'start', onStart: () => { hide(); onPick && onPick(s); } }) }));
        } else {
          grid.appendChild(speciesCard(s, { locked: true, cost: unlockCost(s), onClick: () =>
            openSpeciesDetail(s, { mode: 'purchase', onBuy: refresh }) }));
        }
      }
      for (let k = tier.length; k < row.n; k++) grid.appendChild(mysteryCard());
      sec.appendChild(label); sec.appendChild(grid);
      lockedRows.appendChild(sec);
    }
  }
  function refresh() { progress = loadProgress(); updateWallet(); renderLocked(); }

  updateWallet();
  renderLocked();
  root.querySelector('#ssDev').addEventListener('click', () => { hide(); onDev && onDev(); });
  root.querySelector('#ssDevUnlock').addEventListener('click', () => { devUnlockAll(); refresh(); });
  return { hide, root };
}

// ===================== between-level: level complete =========================
const WIN_WORDS = ['Success', 'You made it'];

export function showLevelComplete({ level, maxLevel, unlocked, earned, balance, onNext }) {
  const root = el('div', 'ss-win'); root.id = 'ssLevelComplete';
  const hasUnlock = unlocked && unlocked.length;
  const word = WIN_WORDS[(Math.random() * WIN_WORDS.length) | 0];
  // No container — the win headline is grown in mycelium (with lighting behind), then a
  // plain line + the spores earned + either the new-species card(s) or just Proceed.
  root.innerHTML =
    '<div class="ss-win-title" role="img" aria-label="' + esc(word) + '"></div>' +
    '<p class="ss-win-sub">You fruited and spored' + (earned ? ' <b>+' + earned + '</b>' + SPORE_ICON : '') + '</p>' +
    (hasUnlock
      ? '<div class="ss-win-unlock">New species available for purchase!</div>' +
        '<div class="ss-win-cards" id="ssWinCards"></div>'
      : '') +
    '<button class="ss-win-btn" id="ssWinProceed" type="button">Proceed</button>';
  document.body.appendChild(root);
  const title = growMyceliumTitle(root.querySelector('.ss-win-title'), { word: word.toUpperCase(), stepRate: 3.2 });
  function hide() { title.destroy(); root.remove(); }
  if (hasUnlock) {
    const cards = root.querySelector('#ssWinCards');
    for (const s of unlocked) cards.appendChild(speciesCard(s, { locked: false, onClick: () => openSpeciesDetail(s, { mode: 'inspect' }) }));
  }
  root.querySelector('#ssWinProceed').addEventListener('click', () => { hide(); onNext && onNext(); });
  return { hide, root };
}

// =========================== game won (final) ================================
export function showGameWon({ spores, balance, onNewRun }) {
  const root = el('div', 'ss-detailwrap open'); root.id = 'ssGameWon';
  root.innerHTML =
    '<div class="ss-lc">' +
      '<div class="ss-lc-badge">Run complete</div>' +
      '<h2 class="ss-lc-title">You carried the colony to the surface — all the way. 🍄✦</h2>' +
      '<p class="ss-lc-sub">Every level cleared. The mycelium has conquered the deep. Start a fresh run with any species you\'ve unlocked.</p>' +
      (spores ? '<div class="ss-win-spores ss-lc-spores">You fruited and spored <b>+' + spores + '</b>' + SPORE_ICON + '</div>' : '') +
      '<div class="ss-lc-actions"><button class="ss-btn primary" id="ssGwNew">Begin a new run ↻</button></div>' +
    '</div>';
  document.body.appendChild(root);
  function hide() { root.remove(); }
  root.querySelector('#ssGwNew').addEventListener('click', () => { hide(); onNewRun && onNewRun(); });
  return { hide, root };
}
