// =============================================================================
// Background music — lazy and non-blocking. TWO contexts:
//
//   • MENU  — the title screen + species picker play backrooms-vol29 ("the
//     backrooms music vol 29"). It BEGINS playback at the 0:20 mark (skipping the
//     long intro) with a quick fade-in, plays continuously across title → picker
//     without restarting, and loops back to 0:20 (never replays the intro).
//   • LEVEL — the moment a level starts, a RANDOM track from the OTHER three
//     (vol7/vol10/vol23) takes over; vol29 is NEVER used in-level. A level track
//     keeps playing across level→level transitions and re-picks when it ends.
//
// The game boots fully playable before any audio is fetched. Browser autoplay
// policy usually needs the first tap/click, so we retry on the first gesture. A
// persisted mute toggle turns it off (and then nothing is fetched at all).
// =============================================================================

const MENU_TRACK = 'assets/music/backrooms-vol29.mp3';
const LEVEL_TRACKS = [
  'assets/music/backrooms-vol7.mp3',
  'assets/music/backrooms-vol10.mp3',
  'assets/music/backrooms-vol23.mp3',
];
const FULL_VOL = 0.32;
const MENU_START_S = 20;     // vol29 BEGINS playback at the 0:20 mark (skips the long intro)
const MENU_FADE_MS = 1200;   // quick fade-in when it starts there
const LEVEL_FADE_MS = 1400;  // a level track eases in quickly when it takes over

let audio = null, muted = false, mode = null, lastLevelIdx = -1, gestureBound = false, fadeTimer = null, seekRetry = null;
try { muted = localStorage.getItem('mycMuted') === '1'; } catch (e) {}

function stopFade() { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; } }
function stopSeek() { if (seekRetry) { clearInterval(seekRetry); seekRetry = null; } }

// Drive the menu track to its 0:20 start. A raw `currentTime = 20` is unreliable
// (a seek can be deferred while the browser buffers, and a non-range host won't
// serve the offset until the file is downloaded), so retry every 100ms until it
// sticks (≈5s cap). On a range-serving host (GitHub Pages) it lands immediately.
function forceMenuStart() {
  stopSeek();
  let tries = 0;
  const tick = () => {
    if (mode !== 'menu' || !audio) { stopSeek(); return; }
    if (audio.currentTime >= MENU_START_S - 0.5) { stopSeek(); return; }   // reached 0:20
    try { audio.currentTime = MENU_START_S; } catch (e) {}
    if (++tries > 50) stopSeek();
  };
  tick();
  seekRetry = setInterval(tick, 100);
}
// Generic wall-clock ramp to `to` over `ms` (eases a track in).
function ramp(to, ms) {
  stopFade();
  if (!audio) return;
  const from = audio.volume, start = performance.now();
  fadeTimer = setInterval(() => {
    if (!audio) { stopFade(); return; }
    const k = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
    audio.volume = from + (to - from) * k;
    if (k >= 1) stopFade();
  }, 40);
}

function ensureAudio() {
  if (audio) return;
  audio = new Audio();
  audio.preload = 'auto';
  audio.volume = FULL_VOL;
  audio.addEventListener('ended', onEnded);
  audio.addEventListener('error', () => { if (mode === 'level') setTimeout(() => playLevelMusic(true), 4000); });
}
function onEnded() {
  if (mode === 'menu') { forceMenuStart(); tryPlay(); }   // loop vol29 back to 0:20, never replay the intro
  else if (mode === 'level') playLevelMusic(true);        // next random level track
}
function tryPlay() {
  if (!audio || muted) return;
  const p = audio.play();
  if (p && p.catch) p.catch(() => {});   // autoplay-blocked → a gesture retries
}
function bindGesture() {
  if (gestureBound) return; gestureBound = true;
  const kick = () => tryPlay();           // harmless passive retry; no-ops once already playing
  window.addEventListener('pointerdown', kick, true);
  window.addEventListener('keydown', kick, true);
  window.addEventListener('touchend', kick, true);
}

// Title + species picker: play vol29 from 0:20 (quick fade-in). Idempotent — if it's
// already the menu track, just keep it going (title → picker is seamless).
export function playMenuMusic() {
  ensureAudio(); bindGesture();
  if (muted) return;
  const already = mode === 'menu' && audio.src && audio.src.indexOf(MENU_TRACK) >= 0;
  if (already) { tryPlay(); return; }
  mode = 'menu';
  audio.loop = false;                      // manual loop back to 0:20 (see onEnded), not 0:00
  audio.src = MENU_TRACK + '#t=' + MENU_START_S;   // declarative start hint (honoured on range hosts)
  audio.load();
  audio.volume = 0; stopFade();
  // Quick fade-in the moment playback actually starts (survives an autoplay-blocked
  // start that only begins on the first gesture), and force the 0:20 offset.
  audio.addEventListener('playing', () => { if (mode === 'menu') ramp(FULL_VOL, MENU_FADE_MS); }, { once: true });
  forceMenuStart();
  tryPlay();
}

// A level started: switch to a RANDOM level track (never vol29). If already in level
// mode, keep the current track playing across the level transition; only `force`
// (a track ended / errored) picks a fresh one.
export function playLevelMusic(force) {
  ensureAudio(); bindGesture();
  if (muted) return;
  if (mode === 'level' && !force) { tryPlay(); return; }
  stopSeek();
  mode = 'level';
  audio.loop = false;
  let i = 0;
  if (LEVEL_TRACKS.length > 1) { do { i = Math.floor(Math.random() * LEVEL_TRACKS.length); } while (i === lastLevelIdx); }
  lastLevelIdx = i;
  audio.src = LEVEL_TRACKS[i]; audio.load();
  audio.volume = 0; ramp(FULL_VOL, LEVEL_FADE_MS);
  tryPlay();
}

// Back-compat: ensure the audio element + gesture retry exist. Actual playback is
// driven by playMenuMusic / playLevelMusic; this no longer force-starts a track.
export function initMusic() { ensureAudio(); if (!muted) bindGesture(); }

// Flip mute; persists the choice. Returns the new muted state.
export function toggleMusic() {
  muted = !muted;
  try { localStorage.setItem('mycMuted', muted ? '1' : '0'); } catch (e) {}
  if (audio) {
    if (muted) audio.pause();
    else if (!audio.src) playMenuMusic();   // first unmute with nothing loaded → default to the menu track
    else tryPlay();
  }
  return muted;
}
export function isMusicMuted() { return muted; }
