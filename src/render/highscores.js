// =============================================================================
// High-scores overlays (plain black & white). Namespaced #hsOverlay / .hs-*.
//
//   showHighScores({onClose})   — the leaderboard (Weekly / All-Time tabs, top 10 each:
//                                 rank · name · level · species). Shows the GLOBAL board
//                                 when a backend is configured (net_scores.js), else the
//                                 local per-device board; falls back to local if offline.
//   maybeHighScore({level, species, speciesName, onDone})
//                               — called at run end: checks the (global or local) top 10;
//                                 if the run qualifies, prompts for a name, records it
//                                 (locally always + globally when enabled), shows the
//                                 board, then fires onDone (→ the run-over card).
// =============================================================================

import { weeklyBoard, allTimeBoard, recordScore, beatsBoard } from '../highscores.js';
import { scoresEnabled, fetchGlobalBoards, submitGlobalScore } from '../net_scores.js';

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
      '<h2 class="hs-title">High Scores</h2>' +
      '<div class="hs-note" id="hsNote"></div>' +
      '<div class="hs-tabs">' +
        '<button class="hs-tab hs-on" id="hsTabWeek" type="button">Weekly</button>' +
        '<button class="hs-tab" id="hsTabAll" type="button">All-Time</button>' +
      '</div>' +
      '<div class="hs-board" id="hsBoard"></div>' +
    '</div>';
  document.body.appendChild(root);
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
  function close() { document.removeEventListener('keydown', onKey); root.remove(); onClose && onClose(); }
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

// The name-entry → board view shown when a run qualifies (internal to maybeHighScore).
function showEntry({ level, species, speciesName, isGlobal, onDone }) {
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
      '<div class="hs-note" id="hsNote" style="display:none"></div>' +
      '<div class="hs-board" id="hsBoard" style="display:none"></div>' +
      '<button class="hs-btn hs-cont" id="hsCont" type="button" style="display:none">Continue</button>' +
    '</div>';
  document.body.appendChild(root);
  const input = root.querySelector('#hsName');
  const done = () => { root.remove(); onDone && onDone(); };
  let saving = false;
  async function save() {
    if (saving) return; saving = true;
    const name = cleanName(input.value);
    recordScore({ name, level, species, speciesName });   // local always (offline history + fallback)
    let list, noteTxt = '';
    if (isGlobal) {
      const ok = await submitGlobalScore({ name, level, species, speciesName });
      const g = ok ? await fetchGlobalBoards() : null;
      if (g) { list = g.weekly.some((e) => e.name === name && (e.level | 0) === (level | 0)) ? g.weekly : g.allTime; noteTxt = 'Global'; }
      else { list = weeklyBoard(); noteTxt = 'Saved locally — the global board is unreachable right now.'; }
    } else {
      list = weeklyBoard();
    }
    root.querySelector('#hsHead').textContent = 'You made the board';
    root.querySelector('#hsSub').style.display = 'none';
    root.querySelector('#hsEntry').style.display = 'none';
    if (noteTxt) { const n = root.querySelector('#hsNote'); n.textContent = noteTxt; n.style.display = ''; }
    const boardEl = root.querySelector('#hsBoard');
    boardEl.innerHTML = boardTable(list, { name, level });
    boardEl.style.display = '';
    const cont = root.querySelector('#hsCont'); cont.style.display = ''; cont.onclick = done;
  }
  root.querySelector('#hsSave').onclick = save;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  setTimeout(() => { try { input.focus(); } catch (_) {} }, 50);
  return { root };
}

// Run ended: qualify against the GLOBAL board (if a backend is configured and reachable)
// or the LOCAL board, prompt + record when it cracks the top 10, then fire onDone.
export function maybeHighScore({ level, species, speciesName, onDone } = {}) {
  const done = onDone || (() => {});
  const decide = (boards, isGlobal) => {
    if (!(beatsBoard(boards.weekly, level) || beatsBoard(boards.allTime, level))) { done(); return; }
    showEntry({ level, species, speciesName, isGlobal, onDone: done });
  };
  if (scoresEnabled()) {
    fetchGlobalBoards().then((g) => { g ? decide(g, true) : decide(localBoards(), false); });
  } else {
    decide(localBoards(), false);
  }
}
