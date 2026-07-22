// =============================================================================
// High-scores overlays (plain black & white). Namespaced #hsOverlay / .hs-*.
//
//   showHighScores({onClose})            — the leaderboard (Weekly / All-Time tabs,
//                                          top 10 each: rank · name · level · species).
//   promptHighScoreEntry({level, species,
//     speciesName, onDone})              — shown at run end when the run cracks the top
//                                          10: enter a name → records it → shows the
//                                          board with your fresh row highlighted → Continue.
// =============================================================================

import { weeklyBoard, allTimeBoard, recordScore } from '../highscores.js';

const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// A top-10 table for one board; `hi` (a ts) highlights the just-added row.
function boardTable(entries, hi) {
  if (!entries.length) return '<div class="hs-empty">No scores yet — be the first.</div>';
  let rows = '';
  entries.forEach((e, i) => {
    const on = (hi && e.ts === hi) ? ' hs-hi' : '';
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
      '<h2 class="hs-title">High Scores</h2>' +
      '<div class="hs-tabs">' +
        '<button class="hs-tab hs-on" id="hsTabWeek" type="button">Weekly</button>' +
        '<button class="hs-tab" id="hsTabAll" type="button">All-Time</button>' +
      '</div>' +
      '<div class="hs-board" id="hsBoard"></div>' +
    '</div>';
  document.body.appendChild(root);
  const boardEl = root.querySelector('#hsBoard');
  const tabW = root.querySelector('#hsTabWeek'), tabA = root.querySelector('#hsTabAll');
  function show(which) {
    tabW.classList.toggle('hs-on', which === 'week');
    tabA.classList.toggle('hs-on', which === 'all');
    boardEl.innerHTML = boardTable(which === 'week' ? weeklyBoard() : allTimeBoard());
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { document.removeEventListener('keydown', onKey); root.remove(); onClose && onClose(); }
  tabW.onclick = () => show('week');
  tabA.onclick = () => show('all');
  root.querySelector('#hsClose').onclick = close;
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  document.addEventListener('keydown', onKey);
  show('week');
  return { close, root };
}

// Run cracked the top 10 → collect a name, record the score, then show the board with the
// new row highlighted and a Continue that fires onDone (proceeds to the run-over card).
export function promptHighScoreEntry({ level, species, speciesName, onDone } = {}) {
  const root = el('div', 'hs-wrap'); root.id = 'hsOverlay';
  root.innerHTML =
    '<div class="hs-card" role="dialog" aria-label="New high score">' +
      '<h2 class="hs-title" id="hsHead">Top 10!</h2>' +
      '<p class="hs-sub" id="hsSub">You reached <b>level ' + (level | 0) + '</b>' +
        (speciesName ? (' as <b>' + esc(speciesName) + '</b>') : '') + '.</p>' +
      '<div class="hs-entry" id="hsEntry">' +
        '<input class="hs-input" id="hsName" type="text" maxlength="14" placeholder="Enter your name" autocomplete="off" spellcheck="false">' +
        '<button class="hs-btn" id="hsSave" type="button">Save</button>' +
      '</div>' +
      '<div class="hs-board" id="hsBoard" style="display:none"></div>' +
      '<button class="hs-btn hs-cont" id="hsCont" type="button" style="display:none">Continue</button>' +
    '</div>';
  document.body.appendChild(root);
  const input = root.querySelector('#hsName');
  const done = () => { root.remove(); onDone && onDone(); };
  let saved = false;
  function save() {
    if (saved) return; saved = true;
    const { ts } = recordScore({ name: input.value, level, species, speciesName });
    root.querySelector('#hsHead').textContent = 'You made the board';
    root.querySelector('#hsSub').style.display = 'none';
    root.querySelector('#hsEntry').style.display = 'none';
    // Show whichever board holds the fresh entry (weekly usually; all-time if it only
    // placed there), with its row highlighted.
    const wk = weeklyBoard();
    const list = wk.some((e) => e.ts === ts) ? wk : allTimeBoard();
    const boardEl = root.querySelector('#hsBoard');
    boardEl.innerHTML = boardTable(list, ts);
    boardEl.style.display = '';
    const cont = root.querySelector('#hsCont'); cont.style.display = ''; cont.onclick = done;
  }
  root.querySelector('#hsSave').onclick = save;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  setTimeout(() => { try { input.focus(); } catch (_) {} }, 50);
  return { root };
}
