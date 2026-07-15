// =============================================================================
// Start-of-run species picker (in-game overlay).
//
// Shown once at boot before the sandbox starts. Renders the roster from
// species.js, derives each hand card's face (art / effect / type / play cost)
// from CARD_DATA, and calls back:
//   onPick(species) — a playable species chosen → start a run seeded with it
//   onDev()         — the temporary dev button → start the current default run
// Namespaced under #speciesSelect (ss-* classes) so it can't collide with the
// game's own .card/.overlay UI.
// =============================================================================

import { SPECIES, LOCKED_TIERS } from '../species.js';
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

// Play-cost pips for a card face (water / phosphorus; energy play-cost is always 0).
function costPips(c) {
  let out = '';
  if (c && c.costW) out += '<span class="ss-cpip">' + RI.water + c.costW + '</span>';
  if (c && c.costP) out += '<span class="ss-cpip p">' + RI.phos + c.costP + '</span>';
  return out ? '<span class="ss-cost">' + out + '</span>' : '';
}

// One "actual card" face for the starting hand.
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
    const v = res && res[key];
    if (!v) continue;
    out += '<span class="ss-respill ' + icon + '">' + RI[icon] + '<span class="ss-rv">' + v + '</span>' +
      '<span class="ss-rk">' + key + '</span></span>';
  }
  return out;
}

export function showSpeciesSelect({ onPick, onDev }) {
  const root = el('div'); root.id = 'speciesSelect';
  root.innerHTML =
    '<div class="ss-console" role="dialog" aria-label="Select your species">' +
      '<button class="ss-dev" id="ssDev" type="button" title="Skip selection and start the default dev run (300 of each resource, 5 of each card)">Dev quick-start ▸</button>' +
      '<header class="ss-head">' +
        '<div class="ss-eyebrow">Mycelium · New run</div>' +
        '<h1>Select your species</h1>' +
        '<p class="ss-lede">Every run begins as a single spore. Choose the colony you\'ll grow from the dark — its <b>temperament</b> and its <b>starting hand</b> are set here. Two strains are yours from the start; the rest are earned in the deep.</p>' +
      '</header>' +
      '<div class="ss-body">' +
        '<section class="ss-section">' +
          '<div class="ss-rowlabel"><span class="ss-lk">Available now</span><span class="ss-badge">Choose one</span><span class="ss-rule"></span><span class="ss-hint">Tap a card to inspect</span></div>' +
          '<div class="ss-grid" id="ssAvail"></div>' +
        '</section>' +
        '<div id="ssLocked"></div>' +
      '</div>' +
    '</div>' +
    '<div class="ss-detailwrap" id="ssDetailWrap" role="dialog" aria-modal="true">' +
      '<div class="ss-detail" id="ssDetail">' +
        '<button class="ss-close" id="ssClose" aria-label="Close">✕</button>' +
        '<div class="ss-d-art"><img id="ssDArt" alt=""></div>' +
        '<div class="ss-d-body">' +
          '<div><div class="ss-d-name" id="ssDName"></div><div class="ss-d-latin" id="ssDLatin"></div></div>' +
          '<p class="ss-d-blurb" id="ssDBlurb"></p>' +
          '<div class="ss-hand"><h3>Starting hand</h3><p class="ss-sub">The actual cards this colony brings to the surface on turn one.</p>' +
            '<div class="ss-resprow" id="ssDRes"></div><div class="ss-deck" id="ssDHand"></div></div>' +
          '<div class="ss-actions"><button class="ss-btn ghost" id="ssCancel">Cancel</button><button class="ss-btn primary" id="ssStart">Start game</button></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  const wrap = root.querySelector('#ssDetailWrap');
  const detail = root.querySelector('#ssDetail');
  let currentSpecies = null;

  function makeCard(s, locked) {
    const card = el('button', 'ss-card ' + s.vibe + (locked ? ' ss-locked' : ''));
    card.type = 'button';
    card.setAttribute('aria-label', (locked ? 'Preview ' : 'Inspect ') + s.name);
    card.innerHTML =
      '<div class="ss-card-art"><img src="' + speciesImg(s.img) + '" alt="' + esc(s.name) + '" onerror="this.style.opacity=0"></div>' +
      (locked ? '<span class="ss-lockbadge">🔒 Locked</span>' : '') +
      '<span class="ss-choose">' + (locked ? 'Preview ▸' : 'Inspect ▸') + '</span>' +
      '<div class="ss-card-info"><div class="ss-sp-name">' + esc(s.name) + '</div><div class="ss-sp-latin">' + esc(s.latin) + '</div></div>';
    card.addEventListener('click', () => openDetail(s));
    return card;
  }

  const availGrid = root.querySelector('#ssAvail');
  for (const s of SPECIES) if (!s.unlock) availGrid.appendChild(makeCard(s, false));

  const lockedRows = root.querySelector('#ssLocked');
  for (const row of LOCKED_TIERS) {
    const sec = el('section', 'ss-section' + (row.communal ? ' ss-communal' : ''));
    const label = el('div', 'ss-rowlabel ss-locked-label');
    label.innerHTML = row.communal
      ? '<span class="ss-lock">🔒</span><span class="ss-lk">' + esc(row.label) + '</span><span class="ss-rule"></span><span class="ss-hint">Yet to be discovered</span>'
      : '<span class="ss-lock">🔒</span><span class="ss-lk">Unlock · ' + esc(row.label) + '</span><span class="ss-rule"></span><span class="ss-hint">' + row.n + ' species</span>';
    const grid = el('div', 'ss-grid');
    const tier = SPECIES.filter((s) => s.unlock === row.label);
    for (const s of tier) grid.appendChild(makeCard(s, true));
    for (let k = tier.length; k < row.n; k++) {
      const lc = el('div', 'ss-lock-card'); lc.setAttribute('aria-hidden', 'true');
      lc.innerHTML = '<span class="ss-q">?</span>';
      grid.appendChild(lc);
    }
    sec.appendChild(label); sec.appendChild(grid);
    lockedRows.appendChild(sec);
  }

  function openDetail(s) {
    currentSpecies = s;
    detail.className = 'ss-detail ' + s.vibe;
    const art = root.querySelector('#ssDArt');
    art.src = speciesImg(s.img); art.alt = 'Portrait of ' + s.name;
    root.querySelector('#ssDName').textContent = s.name;
    root.querySelector('#ssDLatin').textContent = s.latin;
    root.querySelector('#ssDBlurb').innerHTML = s.blurb;
    root.querySelector('#ssDRes').innerHTML = resPills(s.res);
    root.querySelector('#ssDHand').innerHTML = s.hand.map(cardFace).join('');
    const start = root.querySelector('#ssStart');
    const cancel = root.querySelector('#ssCancel');
    if (s.unlock) {
      start.disabled = true; start.classList.add('is-locked');
      start.textContent = 'Locked · ' + s.unlock;
      cancel.textContent = 'Close';
    } else {
      start.disabled = false; start.classList.remove('is-locked');
      start.textContent = 'Start game';
      cancel.textContent = 'Cancel';
    }
    wrap.classList.add('open');
  }
  function closeDetail() { wrap.classList.remove('open'); }

  root.querySelector('#ssClose').addEventListener('click', closeDetail);
  root.querySelector('#ssCancel').addEventListener('click', closeDetail);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeDetail(); });
  root.querySelector('#ssStart').addEventListener('click', () => {
    if (!currentSpecies || currentSpecies.unlock) return;
    hide(); onPick && onPick(currentSpecies);
  });
  root.querySelector('#ssDev').addEventListener('click', () => { hide(); onDev && onDev(); });

  function onKey(e) { if (e.key === 'Escape') { if (wrap.classList.contains('open')) closeDetail(); } }
  document.addEventListener('keydown', onKey);

  function hide() { document.removeEventListener('keydown', onKey); root.remove(); }
  return { hide, root };
}
