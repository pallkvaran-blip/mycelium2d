// =============================================================================
// Run-end LOADOUT picker for "memory" species (e.g. Split Gill).
//
// showLoadoutSelect({ species, drafted, fixed, onConfirm }) — a full-screen
// overlay shown when a run ENDS with a memory species. Two card rows:
//   • UPPER = next run's starting hand: the species' FIXED opener (locked) plus
//     the copies the player selects (up to 5).
//   • LOWER = every NON-ENGINE card DRAFTED this run, with remaining copies.
// Single-click a lower card to move ONE copy up; single-click a selected upper
// card to move it back down. Fixed cards can't be moved. Between the rows sits
// "Choose 5 cards for your next run". Confirm saves the picked list.
//
// Card faces (art / name / count) are derived from CARD_DATA + assets/cards, so
// data/art changes flow through automatically. Namespaced #loadoutSelect / .lo-*.
// =============================================================================

import { CARD_DATA } from '../cards-data.js';
import { cardSlug } from './ui.js';

const CARD_BY_NAME = {};
for (const c of CARD_DATA) CARD_BY_NAME[c.name] = c;

const VER = (typeof globalThis !== 'undefined' && globalThis.__ASSET_VER) ? '?v=' + globalThis.__ASSET_VER : '';
const cardImg = (name) => `assets/cards/${cardSlug(name)}.jpg${VER}`;
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

const MAX_PICK = 5;

export function showLoadoutSelect({ species, drafted, fixed, onConfirm }) {
  const root = el('div'); root.id = 'loadoutSelect';

  // model: pool = copies drafted this run; selected = copies chosen (name -> count)
  const pool = {};
  for (const d of (drafted || [])) if (d && d.name && d.count > 0) pool[d.name] = (pool[d.name] || 0) + d.count;
  const selected = {};
  const fixedList = (fixed || []).map((f) => ({ name: f.name, count: f.count || 0 }));
  const selCount = () => Object.keys(selected).reduce((a, n) => a + selected[n], 0);

  root.innerHTML =
    '<div class="lo-panel" role="dialog" aria-label="Choose cards for your next run">' +
      '<div class="lo-title">' + esc((species && species.name) || 'Your colony') + ' — carry cards forward</div>' +
      '<div class="lo-sub">Only cards you <b>drafted this run</b> can be carried. Your fixed opener is locked in.</div>' +
      '<div class="lo-carowrap"><div class="lo-label">Next run’s starting hand</div>' +
        '<div class="lo-row lo-upper" id="loUpper"></div></div>' +
      '<div class="lo-mid"><span class="lo-mid-txt">Choose 5 cards for your next run</span>' +
        '<span class="lo-count" id="loCount"></span></div>' +
      '<div class="lo-carowrap"><div class="lo-label">Drafted this run — click to add</div>' +
        '<div class="lo-row lo-lower" id="loLower"></div></div>' +
      '<div class="lo-actions"><button class="lo-btn" id="loConfirm" type="button">Confirm ▸</button></div>' +
    '</div>';
  document.body.appendChild(root);

  const upper = root.querySelector('#loUpper');
  const lower = root.querySelector('#loLower');
  const countEl = root.querySelector('#loCount');

  function tile(name, count, opts = {}) {
    const c = CARD_BY_NAME[name] || { name, type: '', effect: '' };
    const t = el('button', 'lo-card' + (opts.locked ? ' lo-locked' : '') + (opts.dim ? ' lo-dim' : ''));
    t.type = 'button';
    t.innerHTML =
      '<span class="lo-art"><img src="' + cardImg(name) + '" alt="" onerror="this.style.display=\'none\'"></span>' +
      (opts.locked ? '<span class="lo-lock" title="Fixed opener">◉</span>' : '') +
      '<span class="lo-cnt">×' + count + '</span>' +
      (c.type ? '<span class="lo-type">' + esc(c.type) + '</span>' : '') +
      '<span class="lo-nm">' + esc(c.name) + '</span>';
    if (opts.onClick && !opts.locked && !opts.dim) t.addEventListener('click', opts.onClick);
    return t;
  }

  function render() {
    // UPPER: fixed opener (locked) then the selected copies (click to remove one)
    upper.innerHTML = '';
    for (const f of fixedList) upper.appendChild(tile(f.name, f.count, { locked: true }));
    for (const name of Object.keys(selected)) {
      if (selected[name] <= 0) continue;
      upper.appendChild(tile(name, selected[name], { onClick: () => {
        selected[name]--; if (selected[name] <= 0) delete selected[name]; render();
      } }));
    }
    // LOWER: drafted pool with REMAINING copies (dim when depleted or the pick is full)
    lower.innerHTML = '';
    const names = Object.keys(pool);
    if (!names.length) { lower.appendChild(el('div', 'lo-empty', 'No non-engine cards drafted this run.')); }
    const full = selCount() >= MAX_PICK;
    for (const name of names) {
      const remaining = pool[name] - (selected[name] || 0);
      lower.appendChild(tile(name, remaining, {
        dim: remaining <= 0 || full,
        onClick: () => {
          if (selCount() < MAX_PICK && (pool[name] - (selected[name] || 0)) > 0) {
            selected[name] = (selected[name] || 0) + 1; render();
          }
        },
      }));
    }
    const n = selCount();
    countEl.textContent = n + ' / ' + MAX_PICK;
    countEl.className = 'lo-count' + (n === MAX_PICK ? ' lo-full' : '');
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
