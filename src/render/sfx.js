// =============================================================================
// Grow SFX — a short organic "growing" sample, layered per batch of strands.
//
// A grow reveals its new strands over ~1–2.4 s (see network.js). We fire ONE
// sample per ~STRANDS_PER_HIT new strands, so a single tendril is one soft hit
// while a big fan builds a layered swell. The hits are FRONT-LOADED (fired within
// a short window near the start, not across the whole reveal) so the sound leads
// the reveal's tail instead of trailing it, and each hit is RELEASED after its
// body (HOLD_S + RELEASE_S) so the long sustained sample settles shortly after the
// growth rather than ringing on. Hard caps keep it from overloading: at most
// MAX_LAYERS hits per grow, MAX_VOICES concurrent voices total, per-hit gain scaled
// down as layers stack, and a compressor on the bus. Decoded once (Web Audio);
// playback is a cheap buffer source per hit. Loaded lazily after boot; the sample
// never blocks the game and isn't in the image manifest.
// =============================================================================

let AC = null, BUF = null, ready = false, MASTER = null, voices = 0;
// Sound-effects mute (separate from Music). Persisted in localStorage; toggled from the
// settings menu. The sample still loads + the audio context still arms so un-muting works
// instantly — only playback is gated (see playGrowBurst).
let muted = false;
try { muted = localStorage.getItem('mycSfxMuted') === '1'; } catch (e) {}
export function isSfxMuted() { return muted; }
export function toggleSfx() {
  muted = !muted;
  try { localStorage.setItem('mycSfxMuted', muted ? '1' : '0'); } catch (e) {}
  return muted;
}
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

// The grow sample is a long, SUSTAINED swell (~2.4s, loud most of the way). Playing it
// whole made the sound ring on well after the strands finished. Let the body play, then
// release it smoothly over RELEASE_S so it settles shortly after the growth — a gentle
// ramp, never an abrupt mid-sound cut.
const HOLD_S = 1.3;      // full-gain body
const RELEASE_S = 0.4;   // fade-out after the body → ring ≈ 1.7s instead of ~2.4s

function hit(when, gain, rate, pan) {
  if (!BUF || voices >= MAX_VOICES) return;   // never exceed the concurrent-voice cap
  const a = ctx();
  const src = a.createBufferSource(); src.buffer = BUF; src.playbackRate.value = rate;
  const g = a.createGain();
  const dur = BUF.duration / rate;                 // sample length at this rate (s)
  const end = Math.min(dur, HOLD_S + RELEASE_S);
  g.gain.setValueAtTime(gain, when);
  if (dur > HOLD_S) {                              // hold, then release the tail
    g.gain.setValueAtTime(gain, when + Math.min(dur, HOLD_S));
    g.gain.linearRampToValueAtTime(0.0001, when + end);
  }
  src.connect(g);
  let out = g;
  if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  out.connect(master());
  voices++;
  src.onended = () => { voices--; };
  src.start(when);
  if (dur > end) src.stop(when + end + 0.03);      // free the voice once faded (already silent → no click)
}

// Fire a layered burst for `count` strands that begin growing over `spreadMs`.
export function playGrowBurst(count, spreadMs) {
  if (muted || !ready || !count) return;
  const a = ctx();
  if (a.state === 'suspended') a.resume();
  const layers = Math.max(1, Math.min(MAX_LAYERS, Math.round(count / STRANDS_PER_HIT)));
  const spread = Math.max(0, spreadMs || 0) / 1000;
  // FRONT-LOAD the layers: fire them within a short window near the start rather than
  // across the whole reveal, so the LATEST hits begin well before the reveal's tail (the
  // reveal is slow + the sample is long). Otherwise the last hit started ~2.4s in and rang
  // on for another ~2s. Capped so even big fans build within ~0.7s.
  const stagger = Math.min(spread * 0.45, 0.7);
  const t0 = a.currentTime + 0.01;
  const perGain = 0.55 / Math.sqrt(layers);   // summed level stays in check as layers stack
  for (let i = 0; i < layers; i++) {
    const frac = layers > 1 ? i / (layers - 1) : 0;
    const jitter = (Math.random() - 0.5) * (stagger / Math.max(1, layers));   // desync layers a touch
    const when = Math.max(t0, t0 + frac * stagger + jitter);
    hit(when, perGain * (0.85 + Math.random() * 0.3), 0.92 + Math.random() * 0.2, (Math.random() * 2 - 1) * 0.35);
  }
}
