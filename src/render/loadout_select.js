// =============================================================================
// Run-end LOADOUT picker for "memory" species (e.g. Split Gill).
//
// showLoadoutSelect({ species, drafted, fixed, onConfirm }) — a full-screen
// overlay shown when a run ENDS with a memory species. Two card carousels that
// REUSE the in-game hand carousel (same .cardbtn faces + .fchip filters):
//   • UPPER = next run's starting hand: the species' FIXED opener (locked) plus
//     the copies the player selects (up to 5).
//   • LOWER = every NON-ENGINE card DRAFTED this run, with remaining copies.
// Single-click a lower card to move ONE copy up; single-click a selected upper
// card to move it back down. Fixed cards can't be moved. Between the rows sits
// "Choose 5 cards for your next run". Confirm saves the picked list.
//
// Namespaced #loadoutSelect / .lo-*; card faces/filters come from ui.js so they
// stay identical to the in-game carousel.
// =============================================================================

import { CARD_DATA } from '../cards-data.js';
import { cardFaceHTML, catClass, cardGroups, GROUP_ORDER } from './ui.js';

const CARD_BY_NAME = {};
for (const c of CARD_DATA) CARD_BY_NAME[c.name] = c;

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const cardOf = (name) => CARD_BY_NAME[name] || { name, type: '', effect: '' };

// Mouse drag-to-scroll for a horizontal carousel list (touch already scrolls natively),
// mirroring the in-game hand carousel: inertial glide on release, and a >6px drag cancels
// the trailing click so dragging over a card doesn't add/remove a copy.
function enableDragScroll(el) {
  if (!el) return;
  let down = false, startX = 0, startScroll = 0, moved = 0, lastX = 0, lastT = 0, vel = 0, raf = 0;
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
    if (dt > 0) { vel = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = t; }
  });
  const end = () => {
    if (!down) return;
    down = false;
    let v = -vel * 16;   // px/ms → px/frame; scroll moves opposite the drag
    if (Math.abs(v) < 1) return;
    const step = () => { el.scrollLeft += v; v *= 0.93; raf = Math.abs(v) > 0.3 ? requestAnimationFrame(step) : 0; };
    raf = requestAnimationFrame(step);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointerleave', end);
  el.addEventListener('click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
}

export function showLoadoutSelect({ species, drafted, enginePool, fixed, maxPick, maxEngines, onConfirm }) {
  const root = el('div'); root.id = 'loadoutSelect';
  const MAX_PICK = maxPick || 8;
  const MAX_ENG = maxEngines || 0;

  // model: pool = copies drafted this run (non-engine + optional engine drafts). engineNames
  // marks which pool entries are ENGINE cards — those curate under a separate, smaller cap.
  const pool = {};
  const engineNames = new Set();
  for (const d of (drafted || [])) if (d && d.name && d.count > 0) pool[d.name] = (pool[d.name] || 0) + d.count;
  if (MAX_ENG > 0) for (const d of (enginePool || [])) if (d && d.name && d.count > 0) { pool[d.name] = (pool[d.name] || 0) + d.count; engineNames.add(d.name); }
  const selected = {};
  const fixedList = (fixed || []).map((f) => ({ name: f.name, count: f.count || 0 }));
  const isEng = (n) => engineNames.has(n);
  const selCountNon = () => Object.keys(selected).reduce((a, n) => a + (isEng(n) ? 0 : selected[n]), 0);
  const selCountEng = () => Object.keys(selected).reduce((a, n) => a + (isEng(n) ? selected[n] : 0), 0);
  const capFor = (n) => (isEng(n) ? MAX_ENG : MAX_PICK);
  const catCount = (n) => (isEng(n) ? selCountEng() : selCountNon());
  let upperFilter = 'all', lowerFilter = 'all';
  const midTxt = MAX_ENG > 0
    ? 'Choose up to ' + MAX_PICK + ' cards + ' + MAX_ENG + ' engines for this run'
    : 'Choose ' + MAX_PICK + ' cards for this run';

  root.innerHTML =
    '<div class="lo-panel" role="dialog" aria-label="Choose cards for this run">' +
      '<div class="lo-caro"><div class="lo-label">Your starting hand</div>' +
        '<div class="lo-filter" id="loUpFilter"></div><div class="lo-list" id="loUpper"></div></div>' +
      '<div class="lo-mid"><span class="lo-mid-txt">' + midTxt + '</span>' +
        '<span class="lo-count" id="loCount"></span></div>' +
      '<div class="lo-caro"><div class="lo-label">Drafted last run — click to add</div>' +
        '<div class="lo-filter" id="loLoFilter"></div><div class="lo-list" id="loLower"></div></div>' +
      '<div class="lo-actions"><button class="lo-btn" id="loConfirm" type="button">Confirm</button></div>' +
    '</div>';
  document.body.appendChild(root);

  const upper = root.querySelector('#loUpper');
  const lower = root.querySelector('#loLower');
  const upFilterBar = root.querySelector('#loUpFilter');
  const loFilterBar = root.querySelector('#loLoFilter');
  const countEl = root.querySelector('#loCount');
  enableDragScroll(upper); enableDragScroll(lower);   // mouse drag-to-scroll (like the in-game carousel)

  // A card face identical to the in-game hand card (.cardbtn + shared faceHTML).
  function faceEl(name, count, { extra, locked, onClick }) {
    const c = cardOf(name);
    const b = el('button', 'cardbtn ' + catClass(c) + (extra ? ' ' + extra : ''));
    b.type = 'button';
    b.innerHTML = cardFaceHTML(name, c, count) + (locked ? '<span class="lo-lock" title="Fixed opener">◉</span>' : '');
    b.setAttribute('data-name', name);
    if (onClick && !locked) b.addEventListener('click', onClick);
    return b;
  }

  // Filter chips for a row, built from the cards currently IN that row (All + each
  // group present), mirroring the in-game hand filter. `entries` = [{name,count}].
  function renderFilter(bar, entries, active, onPick) {
    const present = new Map();
    let total = 0;
    for (const e of entries) {
      total += e.count;
      for (const gr of cardGroups(cardOf(e.name))) {
        const p = present.get(gr.key) || { key: gr.key, label: gr.label, n: 0 };
        p.n += e.count; present.set(gr.key, p);
      }
    }
    if (active !== 'all' && !present.has(active)) { active = 'all'; onPick('all', true); }
    const ordered = GROUP_ORDER.filter((k) => present.has(k)).map((k) => present.get(k));
    bar.style.display = ordered.length > 1 ? '' : 'none';
    const chip = (key, label, n, on) => `<button class="fchip${on ? ' on' : ''}" data-f="${key}">${esc(label)}<span class="fn">${n}</span></button>`;
    bar.innerHTML = chip('all', 'All', total, active === 'all') + ordered.map((e) => chip(e.key, e.label, e.n, active === e.key)).join('');
    bar.querySelectorAll('.fchip').forEach((btn) => { btn.onclick = () => onPick(btn.dataset.f, false); });
    return active;
  }

  const matches = (name, key) => key === 'all' || cardGroups(cardOf(name)).some((g) => g.key === key);

  function render() {
    // ---- UPPER: fixed opener (locked) + selected copies ----
    const upEntries = fixedList.concat(Object.keys(selected).filter((n) => selected[n] > 0).map((n) => ({ name: n, count: selected[n] })));
    upperFilter = renderFilter(upFilterBar, upEntries, upperFilter, (k) => { upperFilter = k; render(); });
    upper.innerHTML = '';
    for (const f of fixedList) if (matches(f.name, upperFilter)) upper.appendChild(faceEl(f.name, f.count, { extra: 'lo-fixed', locked: true }));
    for (const name of Object.keys(selected)) {
      if (selected[name] <= 0 || !matches(name, upperFilter)) continue;
      upper.appendChild(faceEl(name, selected[name], { onClick: () => { selected[name]--; if (selected[name] <= 0) delete selected[name]; render(); } }));
    }
    if (!upper.children.length) upper.appendChild(el('div', 'lo-empty', 'No cards in this filter.'));

    // ---- LOWER: drafted pool with remaining copies (dim at 0 or when the pick is full) ----
    const loEntries = Object.keys(pool).map((n) => ({ name: n, count: pool[n] }));
    lowerFilter = renderFilter(loFilterBar, loEntries, lowerFilter, (k) => { lowerFilter = k; render(); });
    lower.innerHTML = '';
    let shown = 0;
    for (const name of Object.keys(pool)) {
      if (!matches(name, lowerFilter)) continue;
      shown++;
      const remaining = pool[name] - (selected[name] || 0);
      const catFull = catCount(name) >= capFor(name);   // this card's category cap is reached
      const dim = remaining <= 0 || catFull;
      lower.appendChild(faceEl(name, remaining, {
        extra: dim ? 'unaff' : '', locked: dim,
        onClick: () => { if (catCount(name) < capFor(name) && (pool[name] - (selected[name] || 0)) > 0) { selected[name] = (selected[name] || 0) + 1; render(); } },
      }));
    }
    if (!shown) lower.appendChild(el('div', 'lo-empty', Object.keys(pool).length ? 'No cards in this filter.' : 'Nothing drafted last run.'));

    const nNon = selCountNon(), nEng = selCountEng();
    countEl.textContent = MAX_ENG > 0 ? (nNon + '/' + MAX_PICK + ' cards · ' + nEng + '/' + MAX_ENG + ' engines') : (nNon + ' / ' + MAX_PICK);
    const full = MAX_ENG > 0 ? (nNon >= MAX_PICK && nEng >= MAX_ENG) : (nNon >= MAX_PICK);
    countEl.className = 'lo-count' + (full ? ' lo-full' : '');
  }
  render();

  function hide() { root.remove(); }
  root.querySelector('#loConfirm').addEventListener('click', () => {
    const list = Object.keys(selected).filter((n) => selected[n] > 0).map((n) => ({ name: n, count: selected[n] }));
    hide();
    onConfirm && onConfirm(list);
  });
  return { hide, root };
}
