// =============================================================================
// Background music — lazy and non-blocking. TWO contexts:
//
//   • MENU  — the title screen + species picker play backrooms-vol29 ("the
//     backrooms music vol 29"), fading IN over its first 20 seconds (full at
//     0:20). It plays continuously across title → picker (never restarts) and
//     loops for as long as you're in the menus.
//   • LEVEL — the moment a level starts, a RANDOM track from the OTHER three
//     plays; vol29 is NEVER used in-level. When one ends, another random level
//     track loads. The track keeps playing across level→level transitions.
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
const MENU_FADE_S = 20;      // vol29 fades in over its first 20 seconds (full volume at 0:20)
const LEVEL_FADE_MS = 1400;  // a level track eases in quickly when it takes over

let audio = null, muted = false, mode = null, lastLevelIdx = -1, gestureBound = false, fadeTimer = null;
try { muted = localStorage.getItem('mycMuted') === '1'; } catch (e) {}

function stopFade() { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; } }

// vol29: ramp the volume off the track's OWN playback position, so an autoplay-
// blocked (silent) start doesn't burn the fade, and it reaches full exactly at 0:20.
function startMenuFade() {
  stopFade();
  fadeTimer = setInterval(() => {
    if (!audio || mode !== 'menu') { stopFade(); return; }
    const t = audio.currentTime || 0;
    audio.volume = FULL_VOL * Math.min(1, t / MENU_FADE_S);
    if (t >= MENU_FADE_S) stopFade();
  }, 100);
}
// Generic wall-clock ramp to `to` over `ms` (eases a level track in).
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
  if (mode === 'level') playLevelMusic(true);   // next random level track (menu loops via audio.loop)
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

// Title + species picker: play vol29 (fading in over 20s). Idempotent — if it's
// already the menu track, just keep it going (so title → picker is seamless).
export function playMenuMusic() {
  ensureAudio(); bindGesture();
  if (muted) return;
  const already = mode === 'menu' && audio.src && audio.src.indexOf(MENU_TRACK) >= 0;
  if (already) { tryPlay(); return; }
  mode = 'menu';
  audio.loop = true;                       // loop vol29 for as long as you're in the menus
  audio.src = MENU_TRACK; audio.load();
  audio.volume = 0; startMenuFade();
  tryPlay();
}

// A level started: switch to a RANDOM level track (never vol29). If already in
// level mode, keep the current track playing across the level transition; only
// `force` (a track ended / errored) picks a fresh one.
export function playLevelMusic(force) {
  ensureAudio(); bindGesture();
  if (muted) return;
  if (mode === 'level' && !force) { tryPlay(); return; }
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
