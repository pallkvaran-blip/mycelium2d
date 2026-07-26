// The telemetry/leaderboard backend is gated by scoresEnabled(), which reads the runtime
// override globalThis.MYCELIUM_SUPABASE. The disable switch tests rely on MUST actually turn
// the backend off — a batch of `perf` events once leaked to production because an empty url
// silently fell back to the baked-in endpoint. These pin the config resolution.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoresEnabled, logEvent, submitGlobalScore, classifySource } from '../src/net_scores.js';

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

// ---- source separation ------------------------------------------------------------------

test('classifySource buckets real origins the way the dashboard filters on', () => {
  assert.equal(classifySource('pallkvaran-blip.github.io'), 'pages');
  assert.equal(classifySource('html-classic.itch.zone'), 'itch');
  assert.equal(classifySource('v6p9d9t4.ssl.hwcdn.net'), 'itch');       // itch's CDN host
  assert.equal(classifySource('random.itch.io'), 'itch');
  assert.equal(classifySource('localhost'), 'dev');
  assert.equal(classifySource('127.0.0.1'), 'dev');
  assert.equal(classifySource('192.168.1.9'), 'dev');
  assert.equal(classifySource(''), 'dev');                              // no host = local file/boot
  assert.equal(classifySource('example.com'), 'web:example.com');       // unknown kept verbatim
  assert.ok(classifySource('a'.repeat(99) + '.com').length <= 24);      // capped
});

// Capture POST bodies so we can assert the stamped source and the 400-fallback.
async function capture(responderFn, body) {
  const realFetch = globalThis.fetch;
  const bodies = [];
  let i = 0;
  globalThis.fetch = (url, opts) => { bodies.push(JSON.parse(opts.body)); return Promise.resolve(responderFn(i++)); };
  const prev = globalThis.MYCELIUM_SUPABASE;
  globalThis.MYCELIUM_SUPABASE = { url: 'https://x.example.co', anonKey: 'k' };
  try { await body(); await new Promise((r) => setTimeout(r, 5)); }
  finally { globalThis.fetch = realFetch; globalThis.MYCELIUM_SUPABASE = prev; }
  return bodies;
}

test('logEvent stamps a source on the row (dev in node, no location)', async () => {
  const bodies = await capture(() => ({ ok: true, status: 201 }), async () => {
    logEvent('run_start', { species: 'marasmius', level: 1 });
  });
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].source, 'dev');
});

test('on a 400 (source column missing) it retries once WITHOUT source', async () => {
  const bodies = await capture((n) => (n === 0 ? { ok: false, status: 400 } : { ok: true, status: 201 }), async () => {
    logEvent('run_start', { species: 'marasmius', level: 1 });
  });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].source, 'dev');            // first attempt carries source
  assert.equal('source' in bodies[1], false);       // retry drops it so the insert lands
});
