// =============================================================================
// Global leaderboard backend — Supabase (PostgREST). The browser talks to the auto
// REST API directly; there is no server code to run. Reads are public; inserts are
// public but sanity-capped by a row-level-security policy (see docs/leaderboard-setup.md).
//
// ── SETUP ────────────────────────────────────────────────────────────────────
// Paste your project's URL + PUBLIC anon key below (or set globalThis.MYCELIUM_SUPABASE
// = {url, anonKey} before the bundle loads). The anon key is designed to be exposed in
// client code — it's safe to commit. NEVER put the service_role key here (that one is a
// real secret). Leave both empty to disable the global board (the local board is used).
// =============================================================================

const SUPABASE_URL = 'https://daebrdzdoewpuedhxwud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZWJyZHpkb2V3cHVlZGh4d3VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NzcwNDAsImV4cCI6MjEwMDI1MzA0MH0.sOYQLy4_IedoR3mEX_-kxheXvRUYt3N4evxz_wUU8Uw';   // PUBLIC anon key (safe to expose), NOT service_role

// Runtime override (handy for testing / setting creds without a rebuild).
function cfg() {
  const g = (typeof globalThis !== 'undefined' && globalThis.MYCELIUM_SUPABASE) || null;
  return { url: (g && g.url) || SUPABASE_URL, anonKey: (g && g.anonKey) || SUPABASE_ANON_KEY };
}
export function scoresEnabled() { const c = cfg(); return !!(c.url && c.anonKey); }

const REST = () => cfg().url.replace(/\/+$/, '') + '/rest/v1/scores';
function headers(extra) {
  const c = cfg();
  return Object.assign({ apikey: c.anonKey, Authorization: 'Bearer ' + c.anonKey, 'Content-Type': 'application/json' }, extra || {});
}
async function fetchT(url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 4500);
  try { return await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {})); }
  finally { clearTimeout(timer); }
}

// One board (top 10). weekOnly filters to the rolling last 7 days. Returns normalized
// [{name, level, speciesName, ts}] or null on any failure (caller falls back to local).
async function getBoard(weekOnly) {
  const p = new URLSearchParams();
  p.set('select', 'name,level,species_name,created_at');
  p.set('order', 'level.desc,created_at.asc');
  p.set('limit', '10');
  if (weekOnly) p.set('created_at', 'gte.' + new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
  const r = await fetchT(REST() + '?' + p.toString(), { headers: headers() });
  if (!r || !r.ok) return null;
  const rows = await r.json();
  if (!Array.isArray(rows)) return null;
  return rows.map((e) => ({ name: e.name, level: e.level | 0, speciesName: e.species_name || '', ts: Date.parse(e.created_at) || 0 }));
}

// Fetch both boards; null if the backend is unreachable (→ local fallback).
export async function fetchGlobalBoards() {
  if (!scoresEnabled()) return null;
  try {
    const [weekly, allTime] = await Promise.all([getBoard(true), getBoard(false)]);
    if (!weekly || !allTime) return null;
    return { weekly, allTime };
  } catch (_) { return null; }
}

// Post one qualifying score. Returns true on success (best-effort; failure → local only).
export async function submitGlobalScore({ name, level, species, speciesName }) {
  if (!scoresEnabled()) return false;
  try {
    const body = JSON.stringify({
      name: (String(name || '').trim() || 'Anon').slice(0, 14),
      level: level | 0,
      species: species || '',
      species_name: speciesName || '',
    });
    const r = await fetchT(REST(), { method: 'POST', headers: headers({ Prefer: 'return=minimal' }), body });
    return !!(r && r.ok);
  } catch (_) { return false; }
}
