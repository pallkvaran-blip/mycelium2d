// =============================================================================
// Grow SFX — a short organic "growing" sample, layered per batch of strands.
//
// A grow reveals its new strands over ~1–2.4 s (see network.js). We fire ONE
// sample per ~STRANDS_PER_HIT new strands, its instances staggered across that
// reveal window, so a single tendril is one soft hit while a big fan builds a
// layered swell. Hard caps keep it from overloading: at most MAX_LAYERS hits per
// grow, MAX_VOICES concurrent voices total, per-hit gain scaled down as layers
// stack, and a compressor on the bus. Decoded once (Web Audio); playback is a
// cheap buffer source per hit. Loaded lazily after boot; the sample never
// blocks the game and isn't in the image manifest.
// =============================================================================

let AC = null, BUF = null, ready = false, MASTER = null, voices = 0;
const STRANDS_PER_HIT = 10;   // one sample trigger per this many new strands
const MAX_LAYERS = 6;         // cap for a single grow
const MAX_VOICES = 8;         // global concurrent-voice cap

function ctx() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }

function master() {
  if (MASTER) return MASTER;
  const a = ctx();
  const comp = a.createDynamicsCompressor();   // tame overlapping layers so stacking never clips
  comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
  const g = a.createGain(); g.gain.value = 0.9;
  g.connect(comp); comp.connect(a.destination);
  MASTER = g; return MASTER;
}

// Decode the sample and arm gesture-unlock. Called after boot (non-blocking).
export function initSfx() {
  const a = ctx();
  fetch('assets/sfx/grow.wav').then((r) => r.arrayBuffer()).then((b) => a.decodeAudioData(b))
    .then((buf) => { BUF = buf; ready = true; }).catch(() => {});
  const kick = () => { if (a.state === 'suspended') a.resume(); };   // browsers need a gesture to start audio
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('keydown', kick, true);
  window.addEventListener('touchend', kick, true);
}

function hit(when, gain, rate, pan) {
  if (!BUF || voices >= MAX_VOICES) return;   // never exceed the concurrent-voice cap
  const a = ctx();
  const src = a.createBufferSource(); src.buffer = BUF; src.playbackRate.value = rate;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(g);
  let out = g;
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  out.connect(master());
  voices++;
  src.onended = () => { voices--; };
  src.start(when);
}

// Fire a layered burst for `count` strands that begin growing over `spreadMs`.
export function playGrowBurst(count, spreadMs) {
  if (!ready || !count) return;
  const a = ctx();
  if (a.state === 'suspended') a.resume();
  const layers = Math.max(1, Math.min(MAX_LAYERS, Math.round(count / STRANDS_PER_HIT)));
  const spread = Math.max(0, spreadMs || 0) / 1000;
  const t0 = a.currentTime + 0.01;
  const perGain = 0.55 / Math.sqrt(layers);   // summed level stays in check as layers stack
  for (let i = 0; i < layers; i++) {
    const frac = layers > 1 ? i / (layers - 1) : 0;
    const jitter = (Math.random() - 0.5) * (spread / Math.max(1, layers));   // desync layers a touch
    const when = Math.max(t0, t0 + frac * spread + jitter);
    hit(when, perGain * (0.85 + Math.random() * 0.3), 0.92 + Math.random() * 0.2, (Math.random() * 2 - 1) * 0.35);
  }
}
