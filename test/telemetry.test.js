// The telemetry/leaderboard backend is gated by scoresEnabled(), which reads the runtime
// override globalThis.MYCELIUM_SUPABASE. The disable switch tests rely on MUST actually turn
// the backend off — a batch of `perf` events once leaked to production because an empty url
// silently fell back to the baked-in endpoint. These pin the config resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoresEnabled, logEvent, submitGlobalScore } from '../src/net_scores.js';

function withOverride(v, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'MYCELIUM_SUPABASE');
  const prev = globalThis.MYCELIUM_SUPABASE;
  if (v === undefined) delete globalThis.MYCELIUM_SUPABASE;
  else globalThis.MYCELIUM_SUPABASE = v;
  try { fn(); }
  finally {
    if (had) globalThis.MYCELIUM_SUPABASE = prev;
    else delete globalThis.MYCELIUM_SUPABASE;
  }
}

test('no override → baked-in creds, backend ON (real players)', () => {
  withOverride(undefined, () => assert.equal(scoresEnabled(), true));
});

test('explicit empty {url:"",anonKey:""} → backend OFF (the test switch)', () => {
  withOverride({ url: '', anonKey: '' }, () => assert.equal(scoresEnabled(), false));
});

test('empty url alone → OFF (this is the case that used to leak)', () => {
  withOverride({ url: '' }, () => assert.equal(scoresEnabled(), false));
});

test('overriding only anonKey keeps the default url → still ON', () => {
  withOverride({ anonKey: 'whatever' }, () => assert.equal(scoresEnabled(), true));
});

test('a full custom override stays ON', () => {
  withOverride({ url: 'https://x.example.co', anonKey: 'k' }, () => assert.equal(scoresEnabled(), true));
});

// End-to-end on the actual emit path: with the switch off, logEvent()/submitGlobalScore()
// must not touch the network at all. (This is what a Playwright boot exercises, minus the
// browser — logEvent is fire-and-forget and swallows everything, so we watch fetch itself.)
async function fetchCalls(override, body) {
  const realFetch = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = () => { hits++; return Promise.resolve({ ok: true, json: async () => [] }); };
  try {
    await new Promise((res) => { withOverride(override, async () => { await body(); res(); }); });
  } finally { globalThis.fetch = realFetch; }
  return hits;
}

test('telemetry disabled → logEvent makes no network call', async () => {
  const hits = await fetchCalls({ url: '', anonKey: '' }, async () => {
    logEvent('perf', { species: 'marasmius', level: 230, turns: 34, cause: 'ok' });
    logEvent('run_start', { species: 'marasmius', level: 1 });
    await submitGlobalScore({ name: 'P', level: 3, species: 'x' });
  });
  assert.equal(hits, 0);
});

test('telemetry enabled (custom endpoint) → logEvent DOES call fetch', async () => {
  const hits = await fetchCalls({ url: 'https://x.example.co', anonKey: 'k' }, async () => {
    logEvent('run_start', { species: 'marasmius', level: 1 });
  });
  assert.equal(hits, 1);
});
