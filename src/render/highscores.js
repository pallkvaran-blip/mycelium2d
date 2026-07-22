// =============================================================================
// High-scores overlays (plain black & white). Namespaced #hsOverlay / .hs-*.
//
//   showHighScores({onClose})   — the leaderboard (Weekly / All-Time tabs, top 10 each:
//                                 rank · name · level · species). Shows the GLOBAL board
//                                 when a backend is configured (net_scores.js), else the
//                                 local per-device board; falls back to local if offline.
//   checkHighScore({level, species, speciesName}) → Promise<ctx | null>
//                               — at run end, does the level reached crack the (global or
//                                 local) top 10? ctx feeds the INLINE entry on the run-over
//                                 card (ui.showOverlay); null = didn't qualify.
//   recordHighScore({name, level, species, speciesName, isGlobal}) → Promise
//                               — persist a submitted score (local always + global when enabled).
// =============================================================================

import { weeklyBoard, allTimeBoard, recordScore, beatsBoard } from '../highscores.js';
import { scoresEnabled, fetchGlobalBoards, submitGlobalScore } from '../net_scores.js';
import { growMyceliumTitle } from './mycelium_title.js';

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cleanName = (s) => (String(s == null ? '' : s).trim() || 'Anon').slice(0, 14);
const localBoards = () => ({ weekly: weeklyBoard(), allTime: allTimeBoard() });

// A top-10 table for one board; `hi` = {name, level} highlights matching row(s).
function boardTable(entries, hi) {
  if (!entries || !entries.length) return '<div class="hs-empty">No scores yet — be the first.</div>';
  let rows = '';
  entries.forEach((e, i) => {
    const on = (hi && e.name === hi.name && (e.level | 0) === (hi.level | 0)) ? ' hs-hi' : '';
    rows += '<tr class="hs-row' + on + '">' +
      '<td class="hs-rank">' + (i + 1) + '</td>' +
      '<td class="hs-name">' + esc(e.name) + '</td>' +
      '<td class="hs-lvl">' + (e.level | 0) + '</td>' +
      '<td class="hs-sp">' + esc(e.speciesName || '—') + '</td>' +
    '</tr>';
  });
  return '<table class="hs-table"><thead><tr><th></th><th>Name</th><th>Lvl</th><th>Species</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
}

// The leaderboard overlay (title-screen "High Scores" button).
export function showHighScores({ onClose } = {}) {
  const root = el('div', 'hs-wrap'); root.id = 'hsOverlay';
  root.innerHTML =
    '<div class="hs-card" role="dialog" aria-label="High scores">' +
      '<button class="hs-close" id="hsClose" type="button" aria-label="Close">✕</button>' +
      '<div class="hs-title-myc" id="hsTitleMyc" role="img" aria-label="High Scores"></div>' +
      '<div class="hs-note" id="hsNote"></div>' +
      '<div class="hs-tabs">' +
        '<button class="hs-tab hs-on" id="hsTabWeek" type="button">Weekly</button>' +
        '<button class="hs-tab" id="hsTabAll" type="button">All-Time</button>' +
      '</div>' +
      '<div class="hs-board" id="hsBoard"></div>' +
    '</div>';
  document.body.appendChild(root);
  const myc = growMyceliumTitle(root.querySelector('#hsTitleMyc'), { word: 'HIGH SCORES' });
  const boardEl = root.querySelector('#hsBoard'), note = root.querySelector('#hsNote');
  const tabW = root.querySelector('#hsTabWeek'), tabA = root.querySelector('#hsTabAll');
  let global = null, tab = 'week';
  function render() {
    const src = global || localBoards();
    boardEl.innerHTML = boardTable(tab === 'week' ? src.weekly : src.allTime);
    tabW.classList.toggle('hs-on', tab === 'week');
    tabA.classList.toggle('hs-on', tab === 'all');
  }
  tabW.onclick = () => { tab = 'week'; render(); };
  tabA.onclick = () => { tab = 'all'; render(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { document.removeEventListener('keydown', onKey); try { myc.destroy(); } catch (_) {} root.remove(); onClose && onClose(); }
  root.querySelector('#hsClose').onclick = close;
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  document.addEventListener('keydown', onKey);

  if (scoresEnabled()) {
    note.textContent = 'Global';
    boardEl.innerHTML = '<div class="hs-empty">Loading…</div>';
    fetchGlobalBoards().then((g) => {
      if (g) { global = g; note.textContent = 'Global'; }
      else { global = null; note.textContent = 'Offline — showing your local scores'; }
      render();
    });
  } else {
    note.textContent = '';
    render();
  }
  return { close, root };
}

// Does a finished run (level reached) crack the top 10? Resolves to a context object
// {level, species, speciesName, isGlobal} when it qualifies, else null. Qualifies against
// the GLOBAL board when a backend is configured + reachable, otherwise the LOCAL board.
// The name entry itself is rendered INLINE in the run-over overlay (ui.showOverlay), not
// as a separate popup — this only decides whether to offer it.
export function checkHighScore({ level, species, speciesName }) {
  const decide = (boards, isGlobal) => {
    const q = beatsBoard(boards.weekly, level) || beatsBoard(boards.allTime, level);
    return q ? { level, species, speciesName, isGlobal } : null;
  };
  if (scoresEnabled()) {
    return fetchGlobalBoards().then((g) => (g ? decide(g, true) : decide(localBoards(), false)));
  }
  return Promise.resolve(decide(localBoards(), false));
}

// Persist a submitted score: locally always (offline history + fallback), plus the global
// board when this run qualified against it. Resolves once done.
export function recordHighScore({ name, level, species, speciesName, isGlobal }) {
  const nm = cleanName(name);
  recordScore({ name: nm, level, species, speciesName });
  return isGlobal ? submitGlobalScore({ name: nm, level, species, speciesName }).then(() => {}) : Promise.resolve();
}
