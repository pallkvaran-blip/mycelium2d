// =============================================================================
// High scores — local (per-device) top-10 boards, WEEKLY + ALL-TIME.
//
// A run's score is the campaign LEVEL it reached before being overrun. Scores are
// kept in localStorage as a flat list of {name, level, species, speciesName, ts};
// the two boards are derived on read:
//   • ALL-TIME — the best 10 levels ever recorded on this device.
//   • WEEKLY   — the best 10 from the last 7 days (rolling window).
// A run QUALIFIES for name entry if it would place in the top 10 of EITHER board.
//
// NOTE: this is a static browser game with no backend, so scores are per-device —
// each player sees their own machine's board. A shared/global leaderboard would
// need a server; this file is the local foundation for that.
// =============================================================================

const KEY = 'mycelium.highscores.v1';
const MAX = 10;                       // top-N per board
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RETAIN = 60;                    // cap stored entries: last week + all-time top RETAIN

function now() { return Date.now(); }

export function loadScores() {
  try { const p = JSON.parse(localStorage.getItem(KEY)); return (p && Array.isArray(p.entries)) ? p.entries : []; }
  catch (_) { return []; }
}
function saveScores(entries) {
  try { localStorage.setItem(KEY, JSON.stringify({ entries })); } catch (_) {}
}

// Highest level first; on a tie the EARLIER run ranks above (you got there first).
function ranked(list) { return list.slice().sort((a, b) => (b.level - a.level) || (a.ts - b.ts)); }

export function allTimeBoard() { return ranked(loadScores()).slice(0, MAX); }
export function weeklyBoard(t) {
  const cut = (t || now()) - WEEK_MS;
  return ranked(loadScores().filter((e) => e.ts >= cut)).slice(0, MAX);
}

// A board has room (< 10) → any score gets in; otherwise you must BEAT its lowest.
function makesBoard(board, level) { return board.length < MAX || level > board[board.length - 1].level; }

// True if `level` would place in the top 10 of the weekly OR all-time board.
export function qualifies(level, t) {
  const lvl = level | 0;
  return makesBoard(weeklyBoard(t), lvl) || makesBoard(allTimeBoard(), lvl);
}

// Record a finished run. Returns the new boards (+ the entry's ts, for highlighting).
export function recordScore({ name, level, species, speciesName }) {
  const ts = now();
  const entry = {
    name: (String(name || '').trim() || 'Anon').slice(0, 14),
    level: level | 0,
    species: species || '',
    speciesName: speciesName || '',
    ts,
  };
  const entries = loadScores();
  entries.push(entry);
  // Prune so storage stays bounded: keep everything from the last week (for the weekly
  // board) PLUS the all-time top RETAIN (so an old record is never lost).
  const cut = ts - WEEK_MS;
  const keepTop = new Set(ranked(entries).slice(0, RETAIN));
  saveScores(entries.filter((e) => e.ts >= cut || keepTop.has(e)));
  return { ts, weekly: weeklyBoard(ts), allTime: allTimeBoard() };
}
