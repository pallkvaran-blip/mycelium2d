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
// An EXPLICITLY-set key wins even when empty, so `globalThis.MYCELIUM_SUPABASE = {url:'',
// anonKey:''}` genuinely DISABLES the backend — that's the switch tests use to stay off
// production. Only a MISSING key falls back to the baked-in default. (The old `(g && g.url)
// || SUPABASE_URL` fell back on ANY falsy value, so an empty url silently reverted to the
// real URL and test runs leaked run_start/perf events into the live events table.)
function cfg() {
  const g = (typeof globalThis !== 'undefined' && globalThis.MYCELIUM_SUPABASE) || null;
  const has = (k) => g && Object.prototype.hasOwnProperty.call(g, k);
  return {
    url: has('url') ? g.url : SUPABASE_URL,
    anonKey: has('anonKey') ? g.anonKey : SUPABASE_ANON_KEY,
  };
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

// One board (top 10). monthOnly filters to the rolling last 30 days. Returns normalized
// [{name, level, speciesName, ts}] or null on any failure (caller falls back to local).
async function getBoard(monthOnly) {
  const p = new URLSearchParams();
  p.set('select', 'name,level,species_name,created_at');
  p.set('order', 'level.desc,created_at.asc');
  p.set('limit', '10');
  if (monthOnly) p.set('created_at', 'gte.' + new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
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
    const [monthly, allTime] = await Promise.all([getBoard(true), getBoard(false)]);
    if (!monthly || !allTime) return null;
    return { monthly, allTime };
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

// =============================================================================
// Anonymous run telemetry — a tiny event stream to a SEPARATE `events` table so
// we can see the funnel the leaderboard can't (how far people get, retention,
// purchases). NO names or PII: just an anonymous per-device id (to count distinct
// players + returns) and a per-page-load session id. Best-effort + fire-and-forget;
// every failure is swallowed. Needs the `events` table + RLS (docs/leaderboard-setup.md);
// until it exists these POSTs just 404 harmlessly. Events:
//   run_start  {species, level}          — a run begins at the picker
//   level_clear{species, level}          — a level was cleared
//   run_end    {species, level, cause, turns} — cause: 'won' | (a death cause:
//              'water' | 'energy' | 'nocards' | 'infected' | 'devoured' | 'abandon')
//   purchase   {species}                 — a species was unlocked with Spores
const EVENTS_REST = () => cfg().url.replace(/\/+$/, '') + '/rest/v1/events';
const CLIENT_KEY = 'mycelium.clientid.v1';
function uuid() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
  return 'x' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}
function clientId() {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) { id = uuid(); localStorage.setItem(CLIENT_KEY, id); }
    return id;
  } catch (_) { return 'anon'; }
}
let _sid = null;
function sessionId() { return _sid || (_sid = uuid()); }

// Fire-and-forget one event. Returns nothing; never throws.
export function logEvent(kind, fields) {
  if (!scoresEnabled()) return;
  try {
    const f = fields || {};
    const row = { client_id: clientId(), session_id: sessionId(), kind: String(kind).slice(0, 24) };
    if (f.species != null) row.species = String(f.species).slice(0, 32);
    if (f.level != null) row.level = f.level | 0;
    if (f.cause != null) row.cause = String(f.cause).slice(0, 16);
    if (f.turns != null) row.turns = f.turns | 0;
    fetchT(EVENTS_REST(), { method: 'POST', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(row), keepalive: true }, 3000)
      .catch(() => {});
  } catch (_) { /* never let telemetry break the game */ }
}
